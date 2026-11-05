// StudyRoad — structure-roadmap Edge Function
//
// Turns messy text into a roadmap tree using an LLM on Groq (console.groq.com).
//   mode "structure": user pasted a roadmap (e.g. from ChatGPT) -> keep their items, just structure it
//   mode "describe":  user described what they want            -> generate a roadmap draft
//
// Returns JSON shaped exactly like the `items` payload of the
// create_roadmap_from_tree RPC, plus optional `suggestions`.
// NOTHING is saved here: the frontend shows a preview and saves on confirm.
//
// Secrets (set with `supabase secrets set ...`):
//   GROQ_API_KEY  required
//   GROQ_MODEL    optional, defaults to DEFAULT_MODEL below

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_INPUT_CHARS = 20_000;
const MAX_DEPTH = 50;
const MAX_SUGGESTIONS = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- types ----------

type Mode = "structure" | "describe";
type Wording = "keep" | "clean";

interface Options {
  descriptions: boolean; // write a one-liner for items that don't have one
  suggestions: boolean;  // propose missing items, returned separately
  wording: Wording;      // keep user's exact words, or fix spelling/casing
}

interface RequestBody {
  mode: Mode;
  text: string;
  options?: Partial<Options>;
}

export interface TreeItem {
  title: string;
  description?: string;
  is_done?: boolean;
  children: TreeItem[];
}

export interface Suggestion {
  title: string;
  description?: string;
  parent_title: string | null; // exact title of an existing item, or null = top level
  reason?: string;
}

export interface StructureResponse {
  title: string;
  items: TreeItem[];
  suggestions: Suggestion[];
}

// ---------- prompts ----------

const OUTPUT_FORMAT = `
Respond with ONLY a JSON object, no markdown fences, no commentary:
{
  "title": string,                       // short roadmap title
  "items": [ Item ],                     // top-level items in order
  "suggestions": [ {                     // [] unless suggestions are requested
      "title": string,
      "description": string,             // one short line
      "parent_title": string | null,     // EXACT title of an existing item it belongs under, or null for top level
      "reason": string                   // why it's worth adding, one short line
  } ]
}
Item = { "title": string, "description"?: string, "is_done"?: boolean, "children": [ Item ] }
Leaf items have "children": [].`;

function systemPrompt(mode: Mode, o: Options): string {
  const wordingRule = o.wording === "keep"
    ? "Use the user's wording EXACTLY for every item title. Do not rephrase, expand abbreviations, or fix grammar."
    : "You may fix spelling, capitalization and obvious typos in titles, but keep the meaning and level of detail identical.";

  const descriptionRule = o.descriptions
    ? `Every item must have a "description": a single short line (max ~15 words) saying what it covers or what to do. If the source text already explains an item, use that explanation.`
    : `Only include "description" when the source text itself contains an explanation, note, or duration for that item (e.g. "Week 1-2", "focus on intuition"). Never write descriptions of your own.`;

  const suggestionRule = o.suggestions
    ? `Also return up to ${MAX_SUGGESTIONS} "suggestions": genuinely useful items that are MISSING. Never put suggestions inside "items". Each suggestion's "parent_title" must exactly match an existing item title, or be null.`
    : `"suggestions" must be [].`;

  if (mode === "structure") {
    return `You convert a user's learning/project roadmap text into a clean JSON tree.

The user follows their OWN non-traditional plan. Your job is ONLY to structure it.
HARD RULES:
- Keep EVERY item the user wrote. Do not add, remove, merge, split or reorder items.
- ${wordingRule}
- Infer hierarchy from headings (#, ##, ###), indentation, numbering (1., 1.1, a)), bold section labels, and inline lists ("cnn (lenet, resnet)" -> "cnn" with children "lenet", "resnet"; "regression, trees, xgboost" -> three sibling items).
- Any depth is allowed; mirror the user's nesting.
- A checked box ("[x]", "✅", "done") means "is_done": true. Unchecked boxes are just items.
- Ignore chatter that is not part of the roadmap ("Sure! Here's your roadmap", "Good luck!", "Let me know if...").
- URLs and resource lists that belong to an item go into that item's "description" as plain text, not as new items.
- "title": use the user's top-level heading if there is one, else a short (2-5 word) title for the whole roadmap.
- ${descriptionRule}
- ${suggestionRule}
${OUTPUT_FORMAT}`;
  }

  return `You design a personal learning/project roadmap from the user's description.

RULES:
- Respect every constraint, preference, order, and exclusion the user states. If they say "my way" or describe an unusual order, follow it, not the textbook order.
- Organize as a tree: sections -> topics -> concrete, checkable leaf tasks. Usually 2-4 levels.
- Leaf items should be small and actionable (something you can tick off in a sitting or a few days).
- Keep it focused: roughly 5-10 top-level sections, no padding.
- Titles are short (max ~8 words).
- "title": short (2-5 word) title for the roadmap.
- ${descriptionRule.replace("If the source text already explains an item, use that explanation.", "")}
- ${suggestionRule}
${OUTPUT_FORMAT}`;
}

// ---------- validation / sanitizing ----------

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function sanitizeItems(raw: unknown, depth: number): TreeItem[] {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return [];
  const out: TreeItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const title = str(obj.title, 300);
    if (!title) continue;
    const item: TreeItem = {
      title,
      children: sanitizeItems(obj.children, depth + 1),
    };
    const desc = str(obj.description, 1000);
    if (desc) item.description = desc;
    if (obj.is_done === true) item.is_done = true;
    out.push(item);
  }
  return out;
}

function collectTitles(items: TreeItem[], set = new Set<string>()): Set<string> {
  for (const i of items) {
    set.add(i.title);
    collectTitles(i.children, set);
  }
  return set;
}

function sanitizeSuggestions(raw: unknown, items: TreeItem[]): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  const titles = collectTitles(items);
  const out: Suggestion[] = [];
  for (const r of raw.slice(0, MAX_SUGGESTIONS)) {
    if (!r || typeof r !== "object") continue;
    const obj = r as Record<string, unknown>;
    const title = str(obj.title, 300);
    if (!title || titles.has(title)) continue; // skip empty or duplicates of existing items
    const parent = str(obj.parent_title, 300);
    out.push({
      title,
      description: str(obj.description, 300) || undefined,
      parent_title: parent && titles.has(parent) ? parent : null, // unknown parent -> top level
      reason: str(obj.reason, 300) || undefined,
    });
  }
  return out;
}

function extractJson(content: string): unknown {
  // tolerate ```json fences or stray text around the object
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return valid JSON");
  }
}

// ---------- auth ----------

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically into every Edge Function.
async function isSignedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth || !url || !anon) return false;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: anon },
    });
    if (!res.ok) return false;
    const user = await res.json();
    return typeof user?.id === "string";
  } catch {
    return false;
  }
}

// ---------- handler ----------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return json({ error: "GROQ_API_KEY is not set on the server" }, 500);

  // Only signed-in users may spend LLM credits (the anon key alone is not enough).
  if (!(await isSignedIn(req))) return json({ error: "Sign in required" }, 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const mode: Mode = body.mode === "describe" ? "describe" : "structure";
  const text = str(body.text, MAX_INPUT_CHARS + 1);
  if (!text) return json({ error: "Text is empty" }, 400);
  if (text.length > MAX_INPUT_CHARS) {
    return json({ error: `Text is too long (max ${MAX_INPUT_CHARS} characters)` }, 413);
  }

  const options: Options = {
    descriptions: body.options?.descriptions === true,
    suggestions: body.options?.suggestions === true,
    wording: body.options?.wording === "clean" ? "clean" : "keep",
  };

  let llmRes: Response;
  try {
    llmRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL,
        temperature: mode === "structure" ? 0.1 : 0.5,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(mode, options) },
          { role: "user", content: text },
        ],
      }),
    });
  } catch (e) {
    return json({ error: "Could not reach the LLM", detail: String(e) }, 502);
  }

  if (!llmRes.ok) {
    const detail = await llmRes.text();
    return json({ error: `LLM returned ${llmRes.status}`, detail: detail.slice(0, 1000) }, 502);
  }

  try {
    const data = await llmRes.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content) as Record<string, unknown>;

    const items = sanitizeItems(parsed.items, 1);
    if (items.length === 0) return json({ error: "No roadmap items found in the text" }, 422);

    const result: StructureResponse = {
      title: str(parsed.title, 120) || "Untitled Roadmap",
      items,
      suggestions: options.suggestions ? sanitizeSuggestions(parsed.suggestions, items) : [],
    };
    return json(result);
  } catch (e) {
    return json({ error: "Could not understand the LLM response", detail: String(e) }, 502);
  }
});
