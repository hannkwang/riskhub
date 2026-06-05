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
npm run build:prod            # Build dist/ AND install server deps (used by deploy)
npm start                     # node server/index.js — serves API + built dist/ from one port
npm run lint                  # ESLint (frontend only)
./pentest.sh                  # API security test suite (requires backend running)
./pentest.sh --with-ai        # Same, plus 2 live Claude API calls
```

There is no unit-test suite. `pentest.sh` is the de-facto regression check — a bash
suite that hits a running backend and asserts on HTTP status codes (auth, privilege
escalation, stage-lock, SQL injection, input validation, rate limits, audit-log
integrity). Run it against any backend port with `API_BASE=http://localhost:PORT
./pentest.sh`. After changing any auth/role/validation logic, re-run it and keep it
green; update its assertions in lockstep when you intentionally change a contract.

**Deployment:** Hosted on Railway, built from the root `Dockerfile` (Nixpacks is
bypassed). The Dockerfile installs **both** dependency trees (root + `server/`),
runs `npm run build`, and starts `node server/index.js`, which serves the API and
the static `dist/` from a single port. `better-sqlite3` needs `python3/make/g++`
(the alpine image installs them). `ANTHROPIC_API_KEY` is set in Railway's Variables
(never committed). A Railway Volume is mounted at `/app/data`; the env var
`DB_PATH=/app/data/riskhub.db` points `db.js` there so the SQLite file survives
redeploys. Without `DB_PATH` the server falls back to `server/riskhub.db` (local dev
default). On startup, `db.js` logs the resolved path: `[db] opening database at …`.

GitHub Actions run CodeQL and Fortify SAST scans (`.github/workflows/`) on push;
`SECURITY.md` documents the reporting policy.

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
    UserContext.jsx    # Current user + role; ROLE_LABELS map; ANALYTICS_ROLES set; localStorage fallback
  components/
    Layout.jsx         # Sidebar + topbar shell; role-switcher; NotificationBell; ROLE_COLORS map
    ui.jsx             # Shared primitives: Badge, RiskBadge, StageBadge, Avatar, Button, Card, KpiCard, etc.
  screens/
    Dashboard.jsx         # Risk table; 3 KPI cards (high open risks, SLA breaches, expiring soon); CSV export (respects role-based visibility)
    NewRisk.jsx           # Risk creation form: title + description + AI review panel; Save Draft + Submit
    Workflow.jsx          # Risk detail: stage transitions, concurrent review panel, x/3 progress path
    WorkflowOverview.jsx  # Kanban board at /workflow; timeline filter (6m / custom)
    Approvals.jsx         # Queue of risks awaiting current user's action
    Analytics.jsx         # Stage timing, pending approvals, route-backs; timeline filter (6m / custom)
    Users.jsx             # Admin: user list + role/system assignment; PERMISSIONS map
    SystemsDB.jsx         # Admin: system catalog; filter by RML and internet-facing
    SLA.jsx               # Admin: workflow SLA deadlines + default review period (TGA-only edit)
    RiskAcceptanceDB.jsx  # Admin: searchable/filterable full risk table; edit panel for TGA/GRC
    SampleRisks.jsx       # Admin: 5 static reference risk acceptances (no backend); read-only
```

Admin nav order: Risks DB → Systems DB → Users & Roles → SLA Settings → Sample RAs.

Screens import `useUser()` from `UserContext` to get `currentUser` (with `.role`). All REST calls go through `api.*` methods in `lib/api.js`. `lib/api.js` sets the `X-Riskhub-User` header to the user's `id` on every request — this is what `getActor(req)` reads on the server.

Always use `src/lib/time.js` for timestamp display — never `new Date(sqliteStr)` directly (SQLite strings have no timezone marker and parse as local time). `parseUtc()` appends `Z` before parsing. All display is in `Asia/Singapore` (SGT, UTC+8).

The `ui.jsx` primitives own all badge colours and button variants — add new variants there rather than inline Tailwind. It also exports the shared `RiskMatrix` component and `riskLevel(score)` helper (the score→level thresholds: Very Low <4, Low 4–8, Medium 9–14, High ≥15). Import these rather than re-implementing the 5×5 matrix or the threshold ladder in a screen — `NewRisk.jsx` and `SampleRisks.jsx` both consume them, and the same thresholds are mirrored server-side in `routes/risks.js` `computeLevel`. When adding a new role, update `ROLE_LABELS` in `UserContext.jsx` and `ROLE_COLORS` in `Layout.jsx`.

### Backend structure

```
server/
  index.js               # Express app; mounts all routers; security headers; serves dist/ in prod; reads ANTHROPIC_API_KEY from ../.env
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
    users.js             # PATCH /api/users/:id — role/name/active are admin-only; team is self-service
    systems.js           # GET public; PATCH /api/systems/:id — admin-only (tech_governance/grc_chair/admin)
```

`index.js` applies baseline security headers to every response via a small
dependency-free middleware (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, and HSTS in prod). No CSP is set — it would
break the Tailwind SPA's inline styles. CORS is locked to the Vite dev origin in dev
and disabled in prod (same-origin).

The backend uses **CommonJS** (`require`/`module.exports`). The frontend uses **ESM** (`import`/`export`). Do not mix them.

Note: `server/routes/bestpractices.js` exists on disk but is **not mounted** in `index.js` and not used anywhere. The `best_practices` table also exists in the DB schema but is unpopulated in fresh installs and unused at runtime.

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
- `waived`: `0 | 1` — TGA has waived this reviewer's requirement due to absence; does not affect `status`
- `waive_reason`: mandatory text set when `waived = 1`; cleared to NULL on removal
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
  security        → approve / route_back / withdraw  (ANY ONE from security team satisfies the team)
  tech_governance → approve / route_back / withdraw  (ANY ONE from TGA team satisfies the team)
  grc_chair       → approve / route_back / withdraw  (ALL co-chairs must individually approve)
  creator         → raiser_respond (resets all routed_back → pending; any role, not just engineer)
  tech_governance → waive any reviewer (any team) if absent; sets waived=1 with mandatory reason

allTeamsApproved() → auto-transition to Approved
```

`allTeamsApproved(riskId)`: waived reviewers are excluded from each team's requirement.
- security: ≥1 non-waived approved, OR all members waived
- tech_governance: ≥1 non-waived approved, OR all members waived
- grc_chair: all non-waived co-chairs approved (empty set → satisfied)

Waiving fires `allTeamsApproved()` immediately — if the waiver unblocks all three teams the risk auto-transitions to Approved inside the same transaction. `raiser-respond` resets `routed_back → pending` but does not touch `waived`.

The Workflow.jsx progress path shows `x/3` for Concurrent Review where each of the 3 teams counts as one unit (security=any-one, TGA=any-one, GRC=all). The frontend progress logic mirrors the server rules exactly, filtering out waived rows before evaluating each team.

Stage transitions for Draft/System Owner go through `POST /api/workflow/:id/transition` with the `TRANSITIONS` map in `workflow.js`. Concurrent Review uses separate endpoints:
- `POST /api/workflow/:id/concurrent` — `{ action: 'approve'|'route_back'|'withdraw', comment }`. `withdraw` resets the caller's own row from `approved` → `pending`; only valid while the risk is still in Concurrent Review.
- `POST /api/workflow/:id/raiser-respond` — `{ comment }` (creator of any role, or any engineer)
- `POST /api/workflow/:id/waive-reviewer` — `{ actor_id, waived: bool, reason }` (TGA only); sets or clears the waiver on any concurrent reviewer row; `reason` is required when `waived: true`.
- `GET /api/workflow/:id/concurrent-status` — returns all reviewer rows with `actor_name`, `waived`, and `waive_reason`

**Queue endpoint** `GET /api/workflow/queue/:role` behaviour by role:
- `biz_owner`: JOINs risks to `systems` on `systems.owner = actor.name` — only sees risks for their own systems.
- `security` / `tech_governance` / `grc_chair`: returns risks where this specific actor has a `pending` CA row. (The old team-based filter that hid risks once any teammate approved was removed — a reviewer who withdraws must be able to re-approve even if a teammate is still approved.)
- `engineer` (and any other role): returns only Drafts where `created_by = actor.id`.

**Draft privacy**: a Draft is private to its creator for **both reads and writes** — admins get no bypass. `routes/risks.js` centralises this in one predicate, `isHiddenDraft(actor, row)`, used by `GET /api/risks/:id`, `PATCH /api/risks/:id`, and `DELETE /api/risks/:id` (and the `GET /api/risks` list applies the same rule in SQL). Non-creators receive **404** (not 403) on direct read, edit, or delete, so the endpoint never leaks a draft's existence. If you change who may see a draft, change `isHiddenDraft` and the list query together.

**Dashboard access control**: engineers see all non-Draft risks (team visibility) plus their own Drafts; `biz_owner` users see non-Draft risks for systems they own plus their own Drafts (matched via `systems.owner = actor.name`). All other roles see all non-Draft risks plus their own Drafts. This filtering is applied in `GET /api/risks`.

**Analytics access**: restricted to `security`, `tech_governance`, and `grc_chair` — enforced on **both** the backend (`GET /api/analytics` returns 403 for other roles) and the frontend (nav item hidden; `Analytics.jsx` redirects to `/` on mount). `ANALYTICS_ROLES` is the shared constant — defined once in `UserContext.jsx` and imported by `Layout.jsx` and `Analytics.jsx`. When adding other role-gated nav items, follow the same pattern: export the set from `UserContext.jsx` and apply it to the NAV entry's `roles` field.

### Notifications (`notifications.js`)

`GET /api/notifications?since=ISO` returns up to 20 recent `workflow_history` events relevant to the requesting user, filtered by role:
- **engineer**: actions by others on risks they created
- **biz_owner**: actions on risks for systems they own
- **security / tech_governance / grc_chair**: actions on risks they have a `concurrent_approvals` row for

`is_new: true` is set on items newer than the `since` param. The frontend (`Layout.jsx NotificationBell`) stores `riskhub_notif_seen_{userId}` in localStorage and marks-seen on dropdown open.

### AI review (claude.js)

`reviewRisk()` uses `tool_choice: { type: 'any' }` to force a single `submit_risk_review` tool call. The system prompt is marked `cache_control: ephemeral` for prompt caching. Best practice rules (BP-007, BP-013, BP-019, BP-024, BP-031, BP-042) are hardcoded as `BEST_PRACTICES_TEXT` directly in `claude.js` — they are **not** loaded from the database. The tool schema returns:
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
- **SampleRisks.jsx is fully static**: No API calls, no backend dependency. All 5 sample risk acceptances are hardcoded in the component. The `RiskMatrix` component in that file is a local copy — it does not share code with `NewRisk.jsx`.
