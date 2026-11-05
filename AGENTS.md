# StudyRoad: Project Context & Rules

## What it is

A personal roadmap tracker. A user keeps several roadmaps at once (e.g. ML/DL "my way",
internship prep, projects, a 100 Days challenge) and ticks things off to see what's done
and what's left. Roadmaps are **custom**: the user's own items, any depth, always editable.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind v4, lucide-react
- **Routing:** react-router-dom (`/`, `/new`, `/r/:id`)
- **Data:** TanStack Query wrapping supabase-js. Writes are optimistic (see `src/hooks/useRoadmapEditor.ts`).
- **Backend:** Supabase (Postgres + RLS + Google OAuth), no custom server
- **AI:** Supabase Edge Function `structure-roadmap` → Groq (OpenAI-compatible API).
  Key lives in Supabase secrets (`GROQ_API_KEY`), never in the frontend.

## Data model (`supabase/schema.sql`, v2)

Everything is a **node in a tree**.

- `roadmaps`: `kind` = `'tree' | 'challenge'`, `focus_node_id` (★, one per roadmap), `notes`, challenge start/days
- `nodes`: `parent_id` (null = top level, any depth), `position` (fractional, for reordering), `title`,
  `description`, `notes`, `is_done`, `done_at` (set by trigger), `due_date`, `tags`, `day_number` (challenge days)
- `node_links`: resources per node
- `activity_events`: append-only log of done/undone/focus, written **only by triggers** (future analytics)
- `roadmap_summaries` view: dashboard progress (counts **leaf** nodes only)
- RPCs: `create_roadmap_from_tree(payload jsonb)` (atomic create, all entry points), `extend_challenge`

Rules enforced in the DB: a parent must be in the same roadmap, no cycles, and focus must belong to the roadmap.
RLS: `user_id = auth.uid()` on every table.

## Key behaviours

- **Creating** (`/new`): Paste (clean markdown parsed locally in `src/lib/parser.ts`, otherwise AI),
  Blank (empty, or describe → AI draft), Challenge (N days). Always preview → Create.
- **AI default:** keep the user's items and wording exactly; descriptions/suggestions are opt-in toggles.
- **Editing** (`/r/:id`): always-editable outline. Enter / Tab / Shift+Tab / Alt+↑↓ / Backspace-on-empty,
  drag handle (before / inside / after), ⋯ menu, details drawer (notes = plain textarea, links, due date).
- **Progress:** parents are computed from leaves, never stored. Ticking a parent ticks or unticks all its leaves.
- **Delete:** removed from UI at once, real delete after 5s unless Undo.
- **Challenge:** only today and past days can be ticked. Streaks are computed client-side.

## Where things live

- `src/lib/editorOps.ts`: pure tree ops (indent, outdent, move, drop, progress, export markdown)
- `src/hooks/useRoadmapEditor.ts`: all reads/writes for a roadmap page (optimistic + rollback)
- `src/components/editor/*`: outline editor UI
- `src/components/challenge/ChallengeView.tsx`: challenge grid
- `supabase/functions/structure-roadmap/index.ts`: AI structuring (deploy with `--no-verify-jwt`)

## Working rules

1. Don't invent APIs, env vars or secrets. Ask for keys; never put secret keys in `VITE_*` vars.
2. Schema changes go in `supabase/schema.sql` and must keep RLS + triggers intact.
3. Keep writes optimistic with rollback; keep parent progress derived.
4. Discuss before coding; implement in small, testable steps.
