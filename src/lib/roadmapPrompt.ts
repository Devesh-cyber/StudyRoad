export const ROADMAP_PROMPT = `Generate a structured learning roadmap about "[INSERT SUBJECT HERE]". 
Provide the final output strictly as a downloadable Markdown (.md) file containing the roadmap content. 

You must strictly follow this exact formatting structure so it can be parsed correctly:
- Use a single hash (# ) for the main title of the roadmap.
- Use double hashes (## ) for main topics or sections.
- Use dash or asterisk bullet points (- or *) for subtopics under each respective topic.

Do not include any extra conversational text, markdown code blocks, commentary, or intro/outro text, just output the raw markdown file content directly.`;