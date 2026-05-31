# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**RiskHub** — a risk assessment management tool for a government technology agency (Ministry of Meetings). Engineers draft security risk assessments, which flow through a multi-stage approval workflow. An AI assistant (Claude) reviews drafts against best practices before submission.

There is no authentication. Users are simulated via a role-switcher in the sidebar, persisted in `localStorage`. The current user drives all workflow permissions.

---

## Running the project

**After cloning**, install dependencies in both directories:
```bash
npm install               # root (frontend)
cd server && npm install  # backend
```

Two processes must run simultaneously — they are **not** managed by a single command.

**Backend** (port 3001):
```bash
cd server && npm run dev      # nodemon with auto-reload
cd server && npm start        # plain node, no reload
```

**Frontend** (port 5173):
```bash
npm run dev                   # Vite dev server with HMR
```

Vite proxies all `/api/*` requests to `http://localhost:3001`, so the frontend always uses relative `/api` paths. The database file lives at `server/riskhub.db` (SQLite, auto-created with seed data on first run).

**To reset the database:** stop the server first, then delete `server/riskhub.db`. Deleting while nodemon is running will corrupt the file.

**Other commands:**
```bash
npm run build                 # Production build to dist/
npm run lint                  # ESLint (frontend only)
./pentest.sh                  # API security test suite (requires backend running)
./pentest.sh --with-ai        # Same, plus 2 live Claude API calls
```

There are no tests.

---

## Architecture

### Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, lucide-react |
| Backend  | Node.js, Express 4, better-sqlite3 (synchronous), CommonJS |
| AI | Anthropic SDK (`claude-sonnet-4-6`), tool_use for structured JSON output |

### Frontend structure

```
src/
  App.jsx              # Route tree — all routes nested under <Layout>
  lib/
    api.js             # Typed fetch wrapper; all REST calls live here
    time.js            # Shared time utilities: parseUtc, timeAgo, formatDate, formatDateTime (SGT)
    data.js            # Static fixture data from early prototyping — not used by any live screen
  contexts/
    UserContext.jsx    # Current user + role; ROLE_LABELS map; localStorage fallback
  components/
    Layout.jsx         # Sidebar + topbar shell; role-switcher; NotificationBell; ROLE_COLORS map
    ui.jsx             # Shared primitives: Badge, RiskBadge, StageBadge, Avatar, Button, Card, KpiCard, etc.
  screens/
    Dashboard.jsx      # Risk table; 3 KPI cards (high open risks, SLA breaches, expiring soon)
    NewRisk.jsx        # Risk creation form: title + description + AI review panel; Save Draft + Submit
    Workflow.jsx       # Risk detail: stage transitions, concurrent review panel, x/3 progress path
    WorkflowOverview.jsx # Kanban board at /workflow; timeline filter (6m / custom)
    Approvals.jsx      # Queue of risks awaiting current user's action
    Analytics.jsx      # Stage timing, pending approvals, route-backs; timeline filter (6m / custom)
    Users.jsx          # Admin: user list + role/system assignment; PERMISSIONS map
    SystemsDB.jsx      # Admin: system catalog; filter by RML and internet-facing
    BestPractices.jsx  # Admin: GRC best practice library
    SLA.jsx            # Admin: workflow SLA deadlines + default review period (TGA-only edit)
    RiskAcceptanceDB.jsx # Admin: searchable/filterable full risk table; edit panel for TGA/GRC
```

Screens import `useUser()` from `UserContext` to get `currentUser` (with `.role`). All REST calls go through `api.*` methods in `lib/api.js`. `lib/api.js` sets the `X-Riskhub-User` header to the user's `id` on every request — this is what `getActor(req)` reads on the server.

Always use `src/lib/time.js` for timestamp display — never `new Date(sqliteStr)` directly (SQLite strings have no timezone marker and parse as local time). `parseUtc()` appends `Z` before parsing. All display is in `Asia/Singapore` (SGT, UTC+8).

The `ui.jsx` primitives own all badge colours and button variants — add new variants there rather than inline Tailwind. When adding a new role, update `ROLE_LABELS` in `UserContext.jsx` and `ROLE_COLORS` in `Layout.jsx`.

### Backend structure

```
server/
  index.js               # Express app; mounts all routers; reads ANTHROPIC_API_KEY from ../.env
  db.js                  # SQLite schema + idempotent migrations + seed data (runs on import)
  lib/
    auth.js              # getActor(req) / requireActor(req, res) — reads X-Riskhub-User header
    claude.js            # reviewRisk() — Anthropic tool_use call; returns structured review JSON
  routes/
    risks.js             # CRUD; computes inherent/residual scores; formatRisk() normalises DB rows
    workflow.js          # Stage transitions, concurrent review actions, queue endpoint
    review.js            # POST /api/review — calls claude.js, logs to workflow_history
    analytics.js         # Aggregated stats; accepts ?from_date= for timeline filtering
    notifications.js     # GET /api/notifications — role-filtered recent workflow events
    sla.js               # GET/PATCH /api/sla — stage SLA days (PATCH: tech_governance only)
    portal-settings.js   # GET/PATCH /api/portal-settings — global settings (PATCH: tech_governance only)
    bestpractices.js
    users.js
    systems.js
```

The backend uses **CommonJS** (`require`/`module.exports`). The frontend uses **ESM** (`import`/`export`). Do not mix them.

### Data model

**risks** — central table:
- `id`: auto-generated as `RA-{year}-{NNN}` (e.g. `RA-2026-015`)
- `title`: short descriptive name, explicitly entered by the user
- `risk_statement`: the full risk description (UI label: "Risk Description"); cause → event → consequence
- `impact` / `likelihood`: integers 1–5; `inherent_score = impact × likelihood`
- `residual_impact` / `residual_likelihood` / `residual_score`: same scale, post-mitigation
- `ai_residual_impact` / `ai_residual_likelihood`: AI-proposed residual scores stored on submission
- Risk level thresholds: Very Low < 4, Low 4–8, Medium 9–14, High ≥ 15
- `mitigations`: JSON array stored as TEXT — always parse/stringify explicitly
- `stage`: one of `Draft | System Owner | Concurrent Review | Approved | Rejected`
- `expires_at`: set at approval time — last day of the same calendar month, `review_period_months` months later (sourced from `portal_settings`, default 12). e.g. approved 23 Jan → expires 31 Jan next year.
- `created_by`: stores the user `id` — Draft risks are only visible to their creator

**concurrent_approvals** — tracks per-reviewer status during Concurrent Review:
- Primary key: `(risk_id, actor_id)`
- `status`: `pending | approved | routed_back`
- Rows created when System Owner approves (one per active `security`, `tech_governance`, `grc_chair` user)
- Auto-transition to Approved when `allTeamsApproved()` is satisfied (see Workflow section)

**workflow_history** — append-only audit log of every stage transition and concurrent action.

**sla_settings** — stage SLA deadlines: `(stage TEXT PK, days INTEGER)`. Seeded with Draft=14, System Owner=3, Concurrent Review=7. Editable by `tech_governance`.

**portal_settings** — global key/value settings: `(key TEXT PK, value INTEGER, description TEXT)`. Currently one row: `review_period_months = 12`. Editable by `tech_governance`.

**systems** — includes `rml` column (High/Medium/Low) for Risk Management Level. The `owner` column stores the system owner's display name (not user ID). Name changes in `users.js` cascade via `UPDATE systems SET owner = new_name WHERE owner = old_name`.

**users** — `team` is a plain TEXT column for non-biz_owner roles. For biz_owner, systems are matched via `systems.owner = user.name`, not the `team` column.

### Workflow & role enforcement

```
Draft → System Owner:
  any user (any role) can submit their own Draft
  any engineer can also submit any Draft they did not create

System Owner → Concurrent Review / Draft:
  biz_owner whose name matches systems.owner for that risk
  approve → Concurrent Review (seeds concurrent_approvals rows)
  reject / request_changes → Draft

Concurrent Review (parallel, independent):
  security        → approve / route_back  (ANY ONE from security team satisfies the team)
  tech_governance → approve / route_back  (ANY ONE from TGA team satisfies the team)
  grc_chair       → approve / route_back  (ALL co-chairs must individually approve)
  creator         → raiser_respond (resets all routed_back → pending; any role, not just engineer)

allTeamsApproved() → auto-transition to Approved
```

`allTeamsApproved(riskId)`: security ≥1 approved AND tech_governance ≥1 approved AND grc_chair pending-count = 0.

The Workflow.jsx progress path shows `x/3` for Concurrent Review where each of the 3 teams counts as one unit (security=any-one, TGA=any-one, GRC=all).

Stage transitions for Draft/System Owner go through `POST /api/workflow/:id/transition` with the `TRANSITIONS` map in `workflow.js`. Concurrent Review uses separate endpoints:
- `POST /api/workflow/:id/concurrent` — `{ action: 'approve'|'route_back', comment }`
- `POST /api/workflow/:id/raiser-respond` — `{ comment }` (creator of any role, or any engineer)
- `GET /api/workflow/:id/concurrent-status` — returns all reviewer rows with `actor_name`

**Queue endpoint** `GET /api/workflow/queue/:role` behaviour by role:
- `biz_owner`: JOINs risks to `systems` on `systems.owner = actor.name` — only sees risks for their own systems.
- `security` / `tech_governance`: returns risks where actor has `pending` CA row AND no teammate has already `approved` (team-based: any-one satisfies).
- `grc_chair`: returns risks where this specific actor has a `pending` CA row (all co-chairs must approve individually).
- `engineer` (and any other role): returns only Drafts where `created_by = actor.id`.

**Draft privacy**: `GET /api/risks` and `GET /api/risks/:id` filter Draft-stage risks to the creator only. Non-creators receive 404 on direct access.

### Notifications (`notifications.js`)

`GET /api/notifications?since=ISO` returns up to 20 recent `workflow_history` events relevant to the requesting user, filtered by role:
- **engineer**: actions by others on risks they created
- **biz_owner**: actions on risks for systems they own
- **security / tech_governance / grc_chair**: actions on risks they have a `concurrent_approvals` row for

`is_new: true` is set on items newer than the `since` param. The frontend (`Layout.jsx NotificationBell`) stores `riskhub_notif_seen_{userId}` in localStorage and marks-seen on dropdown open.

### AI review (claude.js)

`reviewRisk()` uses `tool_choice: { type: 'any' }` to force a single `submit_risk_review` tool call. The system prompt (with all best practices from the DB) is marked `cache_control: ephemeral` for prompt caching. The tool schema returns:
- `flags` — policy violations or quality issues
- `suggestions` — before/after improvement text
- `rewritten_statement` — BP-007-compliant rewrite of the risk description
- `proposed_residual_impact` / `proposed_residual_likelihood` — AI-assessed residual scores based solely on stated mitigations
- `residual_assessment` — `{ verdict: 'justified'|'underestimated'|'overestimated', reasoning }`
- `additional_mitigations` — populated only when `verdict = 'underestimated'`
- `confidence` — 0–100 score

### Users & roles

Admin roles (`tech_governance`, `grc_chair`) can update any user's `name`, `role`, and `active` status via `PATCH /api/users/:id`. Name changes cascade to `systems.owner`. Any user can update their own `team`.

`Users.jsx` has a `PERMISSIONS` map that drives the toggles shown in the edit panel — all roles have `submit: true` (anyone can raise a risk).

---

## Key conventions

- **CSS import order**: `@import url(...)` for Google Fonts must come **before** `@import "tailwindcss"` in `index.css` — Tailwind 4 enforces this.
- **Score computation**: Always use `impact × likelihood` — never store separately without also updating `inherent_score`.
- **Mitigations field**: Stored as a JSON string in SQLite. Frontend always sends an array; backend stringifies it.
- **Environment**: `ANTHROPIC_API_KEY` lives in `RiskHub/.env` (project root, one level above `server/`). The server loads it with `dotenv({ path: '../.env' })`.
- **No TypeScript**: The project is plain JSX/JS throughout.
- **Timezone**: SQLite stores all datetimes as `YYYY-MM-DD HH:MM:SS` UTC (no suffix). Always parse via `parseUtc()` from `src/lib/time.js` (appends `Z`). Display in SGT using `formatDate()` / `formatDateTime()` / `timeAgo()` from the same file. Server-side `timeAgo` functions in routes also use the `parseUtc` pattern.
- **Risk Description vs risk_statement**: The UI label is "Risk Description" everywhere. The DB column and API field remain `risk_statement` — do not rename the DB column.
- **Expiry calculation**: `computeExpiry()` in `workflow.js` reads `portal_settings.review_period_months` (default 12), then computes last day of `(approval month + N months)` using `setDate(1); setMonth(M + N + 1, 0)`. Per-risk `review_period_months` is no longer used for this calculation.
- **DB migrations**: New columns added with `ALTER TABLE … ADD COLUMN` guarded by `PRAGMA table_info`. All migrations in `db.js` are idempotent and run on every startup before `seedIfEmpty()`. The migration inserting new users is guarded by `userCount > 0` to avoid poisoning the fresh-DB seed guard.
- **systems.owner is a name string, not a FK**: Compare `systems.owner = user.name`. Name changes must cascade — see `users.js` PATCH handler.
- **Email derivation**: `name.toLowerCase().replace(/ /g, '.') + '@meetings.gov'` — computed in the frontend, not stored.
