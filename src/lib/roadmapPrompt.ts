// Optional helper: a prompt the user can copy into ChatGPT/Claude.
// Any format can be pasted into StudyRoad, but nested markdown lists
// are parsed instantly without using the AI.
export const ROADMAP_PROMPT = `Help me build a learning roadmap for: [WHAT YOU WANT TO LEARN / BUILD].

My situation and preferences: [what you already know, the order you want, things to skip].

When we're done, give the final roadmap as markdown:
- "# " for the roadmap title
- "## " for main sections
- nested "- " bullets for topics and sub-topics (indent to nest, any depth)
- "- [x] " for anything I've already finished
No extra commentary in the final version.`
