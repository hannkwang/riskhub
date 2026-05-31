# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**RiskHub** — a risk assessment management tool for a government technology agency (Ministry of Meetings). Engineers draft security risk assessments, which flow through a multi-stage approval workflow. An AI assistant (Claude) reviews drafts against best practices before submission.

There is no authentication. Users are simulated via a role-switcher in the sidebar, persisted in `localStorage`. The current user drives all workflow permissions.

---

## Running the project

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
  lib/api.js           # Typed fetch wrapper; all REST calls live here
  contexts/
    UserContext.jsx    # Current user + role; ROLE_LABELS map; localStorage fallback
  components/
    Layout.jsx         # Sidebar + topbar shell; role-switcher dropdown; ROLE_COLORS map
    ui.jsx             # Shared primitives: Badge, RiskBadge, StageBadge, Avatar, Button, Card, etc.
  screens/
    Dashboard.jsx      # Risk table with KPI cards, filtering, sorting
    NewRisk.jsx        # Multi-step risk creation form with inline AI review panel
    Workflow.jsx       # Risk detail view + stage transitions + concurrent review panel
    WorkflowOverview.jsx # Kanban-style board at /workflow; links to individual risk pages
    Approvals.jsx      # Queue of risks awaiting current user's action
    Analytics.jsx      # Pending approvals focus: who hasn't approved, timelines, route-backs
    Users.jsx          # Admin: user list + role/system assignment
    SystemsDB.jsx      # Admin: system catalog with RML column
    BestPractices.jsx  # Admin: GRC best practice library
```

Screens import `useUser()` from `UserContext` to get `currentUser` (with `.role`). All REST calls go through `api.*` methods in `lib/api.js`. The `ui.jsx` primitives own all badge colours and button variants — add new variants there rather than inline Tailwind. When adding a new role, update `ROLE_LABELS` in `UserContext.jsx` and `ROLE_COLORS` in `Layout.jsx`.

### Backend structure

```
server/
  index.js          # Express app; mounts all routers; reads ANTHROPIC_API_KEY from ../.env
  db.js             # SQLite schema + idempotent migrations + seed data (runs on import)
  lib/
    auth.js         # getActor(req) / requireActor(req, res) — reads X-Riskhub-User header
    claude.js       # reviewRisk() — Anthropic tool_use call; returns structured review JSON
  routes/
    risks.js        # CRUD; computes inherent/residual scores; formatRisk() normalises DB rows
    workflow.js     # Stage transitions, concurrent review actions, queue endpoint
    review.js       # POST /api/review — calls claude.js, logs to workflow_history
    analytics.js    # Aggregated stats: pending by reviewer, stage timing, route-backs
    bestpractices.js
    users.js
    systems.js
```

The backend uses **CommonJS** (`require`/`module.exports`). The frontend uses **ESM** (`import`/`export`). Do not mix them.

### Data model

**risks** — central table:
- `id`: auto-generated as `RA-{year}-{NNN}` (e.g. `RA-2026-015`)
- `impact` / `likelihood`: integers 1–5; `inherent_score = impact × likelihood`
- `residual_impact` / `residual_likelihood` / `residual_score`: same scale, post-mitigation
- `ai_residual_impact` / `ai_residual_likelihood`: AI-proposed residual scores stored on submission
- Risk level thresholds: Very Low < 4, Low 4–8, Medium 9–14, High ≥ 15
- `mitigations`: JSON array stored as TEXT — always parse/stringify explicitly
- `stage`: one of `Draft | System Owner | Concurrent Review | Approved | Rejected`
- `expires_at`: set when transitioning to Approved (current date + `review_period_months`)

**concurrent_approvals** — tracks per-reviewer status during Concurrent Review:
- Primary key: `(risk_id, actor_id)`
- `status`: `pending | approved | routed_back`
- Rows are created when System Owner approves (one row per active reviewer with role `security`, `tech_governance`, or `grc_chair`)
- Risk auto-transitions to Approved when all rows are `approved`

**workflow_history** — append-only audit log of every stage transition and concurrent action.

**systems** — includes `rml` column (High/Medium/Low) for Risk Management Level. The `owner` column stores the system owner's display name (not user ID) — this is how biz_owners are matched to systems. Name changes in `users.js` cascade via `UPDATE systems SET owner = new_name WHERE owner = old_name`.

**users** — `team` is a plain TEXT column for non-biz_owner roles. For biz_owner (System Owner), the systems they are responsible for are determined by `systems.owner = user.name`, not the `team` column.

### Workflow & role enforcement

```
Draft → System Owner:
  creator (any role) or any engineer can submit their own Draft
  biz_owner cannot submit (they approve, not raise)

System Owner → Concurrent Review / Draft:
  biz_owner whose name matches systems.owner for that risk
  approve → Concurrent Review (seeds concurrent_approvals rows)
  reject / request_changes → Draft

Concurrent Review (parallel, independent):
  security        → approve / route_back  (ANY ONE from security team satisfies the team)
  tech_governance → approve / route_back  (ANY ONE from TGA team satisfies the team)
  grc_chair       → approve / route_back  (ALL co-chairs must individually approve)
  creator         → raiser_respond (resets all routed_back → pending)

All concurrent_approvals approved → auto-transition to Approved
```

Stage transitions for Draft/System Owner go through `POST /api/workflow/:id/transition` with the `TRANSITIONS` map in `workflow.js`. The System Owner transition additionally verifies `systems.owner === actor.name` — a biz_owner cannot approve a risk for a system they don't own. Concurrent Review uses separate endpoints:
- `POST /api/workflow/:id/concurrent` — `{ action: 'approve'|'route_back', comment }`
- `POST /api/workflow/:id/raiser-respond` — `{ comment }` (creator only)
- `GET /api/workflow/:id/concurrent-status` — returns all reviewer rows with `actor_name`

**Queue endpoint** `GET /api/workflow/queue/:role` behaviour by role:
- `biz_owner`: reads `X-Riskhub-User`; JOINs risks to `systems` on `systems.owner = actor.name` — System Owners only see risks for their own systems.
- `security` / `tech_governance`: reads actor; returns risks where actor has `pending` CA row AND no teammate has already `approved` (team-based: any-one satisfies).
- `grc_chair`: returns risks where this specific actor has a `pending` CA row.

### AI review (claude.js)

`reviewRisk()` uses `tool_choice: { type: 'any' }` to force a single `submit_risk_review` tool call. The system prompt (with all best practices from the DB) is marked `cache_control: ephemeral` for prompt caching. The tool schema returns:
- `flags` — policy violations or quality issues
- `suggestions` — before/after improvement text
- `rewritten_statement` — BP-007-compliant rewrite
- `proposed_residual_impact` / `proposed_residual_likelihood` — AI-assessed residual scores based solely on stated mitigations (not the user's claim)
- `residual_assessment` — `{ verdict: 'justified'|'underestimated'|'overestimated', reasoning }` comparing AI scores to user's claimed residual
- `additional_mitigations` — populated only when `verdict = 'underestimated'`; specific controls that would close the gap
- `confidence` — 0–100 score

The AI panel in NewRisk.jsx shows both user residual and AI residual side-by-side with verdict badge. The Workflow.jsx detail view also shows this 3-column comparison (Inherent / User Residual / AI Residual) to all reviewers. AI scores (`ai_residual_impact`, `ai_residual_likelihood`) are saved to the `risks` row at submission time.

### Users & roles

Admin roles (`tech_governance`, `grc_chair`) can update any user's `name`, `role`, and `active` status via `PATCH /api/users/:id`. Name changes cascade to `systems.owner`. Any user can update their own `team`.

When editing a `biz_owner` in the Users screen, the panel shows systems checkboxes (pre-ticked for systems where `systems.owner === user.name`) instead of a team text input. Saving the panel calls `PATCH /api/systems/:id { owner }` for each changed system.

---

## Key conventions

- **CSS import order**: `@import url(...)` for Google Fonts must come **before** `@import "tailwindcss"` in `index.css` — Tailwind 4 enforces this.
- **Score computation**: Always use `impact × likelihood` — never store separately without also updating `inherent_score`.
- **Mitigations field**: Stored as a JSON string in SQLite. Frontend always sends an array; backend stringifies it.
- **Environment**: `ANTHROPIC_API_KEY` lives in `RiskHub/.env` (project root, one level above `server/`). The server loads it with `dotenv({ path: '../.env' })`.
- **No TypeScript**: The project is plain JSX/JS throughout.
- **DB migrations**: New columns are added with `ALTER TABLE … ADD COLUMN` guarded by a `PRAGMA table_info` check. Stage renames use `UPDATE … WHERE stage = '…'`. All migrations in `db.js` are idempotent and run on every startup before `seedIfEmpty()`. The migration that inserts new users is guarded by `userCount > 0` to avoid poisoning the fresh-DB seed guard.
- **systems.owner is a name string, not a FK**: When matching a user to their systems, compare `systems.owner = user.name`. This means name changes must be cascaded — see `users.js` PATCH handler.
- **Email derivation**: `name.toLowerCase().replace(/ /g, '.') + '@meetings.gov'` — computed in the frontend, not stored.
