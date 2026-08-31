export interface ParsedTopic {
  title: string;
  sort_order: number;
  subtopics?: { title: string; sort_order: number }[];
}

export interface ParsedRoadmap {
  title: string;
  topics: ParsedTopic[];
}

export const parseMarkdownTree = (markdown: string): ParsedRoadmap => {
  const lines = markdown.split('\n');
  let title = 'Untitled Roadmap';
  const topics: ParsedTopic[] = [];
  let currentTopic: ParsedTopic | null = null;
  let topicOrder = 1;
  let subtopicOrder = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      title = trimmed.replace(/^#\s+/, '').trim();
    } else if (trimmed.startsWith('## ')) {
      currentTopic = {
        title: trimmed.replace(/^##\s+/, '').trim(),
        sort_order: topicOrder++,
        subtopics: []
      };
      topics.push(currentTopic);
      subtopicOrder = 1;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentTopic) {
        currentTopic.subtopics!.push({
          title: trimmed.replace(/^[-*]\s+/, '').trim(),
          sort_order: subtopicOrder++
        });
      }
    }
  }
  return { title, topics };
};