# StudyRoad - Project Context & Rules

## Project Overview

You are building "StudyRoad," a minimalist, dark-themed (zinc-950 background) personal learning tracker. The core feature allows a user to upload a Markdown (`.md`) learning roadmap, which is parsed into a visual hierarchy. Users can track progress by marking subtopics as "NOT_STARTED", "CURRENT", or "COMPLETED".

This is a strictly constrained 1-Day MVP. We are using a Frontend-only architecture talking directly to Supabase via its SDK.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui, Lucide React (for icons)
- **Backend/Database/Auth:** Supabase (PostgreSQL, Row Level Security, Google OAuth)
- **Routing:** React Router (if needed, keep it flat: `/` and `/roadmap/:id`)

## 🛑 STRICT RULES & GUARDRAILS 🛑

1. **NO HALLUCINATION & NO ASSUMPTIONS:** Do not invent APIs, mock data structures, or assume environmental variables exist.
2. **STOP AND ASK FOR SECRETS:** When configuring Supabase or Google Auth, you MUST stop and ask the user to provide the `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and Google Auth Client ID. Do NOT generate dummy keys. Tell the user exactly where to go in the Supabase dashboard to get them.
3. **ONE STEP AT A TIME:** Follow the Implementation Phases below sequentially. Do NOT move to Phase 2 until Phase 1 is confirmed working by the user. Ask for user confirmation after every major phase.
4. **DO NOT OVERENGINEER:** Stick only to the requirements defined below. No drag-and-drop, no custom Python backend, no animations.

---

## Database Schema & Supabase Rules

We are using Supabase PostgreSQL with Row Level Security (RLS).

- `users` (handled by Supabase Auth `auth.users`)
- `roadmaps` (id, user_id, title, created_at)
- `topics` (id, roadmap_id, title, notes, sort_order)
- `subtopics` (id, topic_id, title, status ['NOT_STARTED', 'CURRENT', 'COMPLETED'], sort_order)

All tables must enforce RLS where `auth.uid() = user_id` (or joined appropriately for child tables).

---

## Markdown Parsing Rules (TypeScript)

The user will upload a `.md` file. The frontend must parse it locally before pushing to Supabase.

- H1 (`# `) = Roadmap Title
- H2 (`## `) = Main Topic Title
- List items (`- `, `* `, `+ `) = Subtopics
- Ignore all other text (paragraphs, links).
- Ensure a clean structured JSON/JS object is created containing the tree before sending batch inserts to Supabase.

---

## Implementation Phases (Execute in Order)

### Phase 1: Initialization & Supabase Setup

- Initialize Vite + React + TypeScript + Tailwind CSS.
- Install `@supabase/supabase-js`, `lucide-react`, and configure `shadcn/ui`.
- **Action Required:** Ask the user to run the provided SQL Schema in their Supabase SQL editor. Ask the user for their Supabase URL and Anon Key to set up `.env.local` and `supabaseClient.ts`.

### Phase 2: Authentication & Shell UI

- Implement Google Sign-In using Supabase Auth.
- Create a minimal login screen.
- Create the global dark-themed layout (`zinc-950` background, `zinc-200` text).
- Require the user to test the login before proceeding.

### Phase 3: The Parser & Import UI

- Create a file dropzone for `.md` files.
- Implement the client-side parser in TypeScript.
- Build a preview tree UI so the user can see what will be imported.
- Write the Supabase multi-table batch insert logic to save the parsed tree.

### Phase 4: The Roadmap Workspace

- Build the `/roadmap/{id}` view fetching data from Supabase.
- Display the hierarchical list (Topics -> Subtopics).
- Implement status toggling (Clicking a circle cycles: NOT_STARTED -> CURRENT -> COMPLETED).
- **Rule:** If a subtopic is marked CURRENT, automatically set any previously CURRENT subtopic in the same roadmap to NOT_STARTED.

### Phase 5: Dashboard & Polish

- Build the Dashboard `/` showing roadmap summary cards.
- Calculate and display overall completion percentages (based on total subtopics).
- Add the Markdown notes modal to Main Topics.
- Apply final polish: warm amber accents (`amber-200`) for "CURRENT" states, muted greens for "COMPLETED", rounded cards, and clean typography.

## 🏗️ Core Engineering Standards & Functional Workflows

### 1. Frontend Architecture & Data Flow

Do not rely on basic `useState`/`useEffect` for data fetching. You must implement robust state management and error handling:

- **Data Fetching & Caching:** Use **TanStack Query (React Query)** wrapping the Supabase JS Client. This ensures automatic caching, background refetching, and prevents race conditions.
- **Optimistic UI Updates:** When a user clicks a subtopic to mark it as `CURRENT` or `COMPLETED`, update the UI immediately using React Query's `onMutate` function. Do not wait for the server response. If the Supabase mutation fails, catch the error, roll back to the previous state, and show a Toast notification.
- **Type Safety:** Use the Supabase CLI to generate the `Database` TypeScript definitions. All frontend API calls must be strictly typed using these definitions to catch schema mismatches.
- **UI States:** Every data-fetching component must gracefully handle and render three states: `Loading` (skeleton loaders or spinners), `Empty` (clean illustration/text when no roadmaps exist), and `Error` (toast notifications or fallback boundaries).

### 2. Backend & Database Workflows (Supabase)

Do not push complex business logic solely to the client. Leverage PostgreSQL to maintain data integrity:

- **Atomic Transactions via RPC:** When importing a parsed `.md` roadmap, do NOT send dozens of individual `INSERT` requests from the frontend. Instead, write a Supabase Postgres Function (RPC) called `import_roadmap_tree` that accepts a single JSON payload. The RPC must insert the roadmap, topics, and subtopics inside a single atomic database transaction. If any part fails, the entire insertion rolls back.
- **State Machine Enforcement (Triggers):** The rule "Only one CURRENT subtopic per roadmap" must be enforced at the database level. Write a Postgres `BEFORE UPDATE` trigger on the `subtopics` table. If a subtopic's status is changing to `CURRENT`, the trigger must automatically find any existing `CURRENT` subtopic in the same roadmap and downgrade it to `NOT_STARTED`. This prevents race conditions if a user clicks too fast.
- **Database Optimization:** Ensure Foreign Key columns (`user_id`, `roadmap_id`, `topic_id`) are explicitly indexed in PostgreSQL. This is critical for performance since Row Level Security (RLS) policies rely heavily on joining these tables.

