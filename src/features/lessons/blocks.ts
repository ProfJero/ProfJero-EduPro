import { z } from 'zod';

export const BLOCK_TYPES = [
  'heading', 'paragraph', 'image', 'video', 'audio', 'code', 'callout', 'activity', 'quiz', 'lab', 'resource', 'link', 'table', 'steps', 'embed', 'divider',
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

const https = z.string().trim().url().refine((u) => u.startsWith('https://'), 'Use a secure https:// link');
const optHttps = z.union([https, z.literal('')]).optional();

export const blockSchemas = {
  heading: z.object({ text: z.string().max(200).default(''), level: z.union([z.literal(2), z.literal(3)]).default(2) }),
  paragraph: z.object({ text: z.string().max(20000).default('') }),
  image: z.object({ url: optHttps, alt: z.string().max(300).default(''), caption: z.string().max(300).optional() }),
  video: z.object({ url: optHttps, caption: z.string().max(300).optional(), transcript: z.string().max(20000).optional() }),
  audio: z.object({ url: optHttps, caption: z.string().max(300).optional(), transcript: z.string().max(20000).optional() }),
  code: z.object({ language: z.string().max(30).default('python'), code: z.string().max(20000).default(''), output: z.string().max(5000).optional() }),
  callout: z.object({ tone: z.enum(['info', 'tip', 'warning', 'important']).default('info'), title: z.string().max(120).optional(), text: z.string().max(4000).default('') }),
  activity: z.object({ title: z.string().max(160).default('Practical activity'), instructions: z.string().max(8000).default(''), expected: z.string().max(4000).optional() }),
  quiz: z.object({
    question: z.string().max(1000).default(''),
    options: z.array(z.string().max(300)).max(8).default(['', '']),
    answer: z.number().int().min(0).default(0),
    explanation: z.string().max(2000).optional(),
    assessment_id: z.string().uuid().optional().or(z.literal('')),
  }),
  resource: z.object({ title: z.string().max(160).default(''), url: optHttps, description: z.string().max(500).optional() }),
  link: z.object({ title: z.string().max(160).default(''), url: optHttps, description: z.string().max(500).optional() }),
  table: z.object({ caption: z.string().max(200).optional(), headers: z.array(z.string().max(120)).max(10).default(['Column 1', 'Column 2']), rows: z.array(z.array(z.string().max(500))).max(100).default([['', '']]) }),
  steps: z.object({ title: z.string().max(160).optional(), steps: z.array(z.string().max(2000)).max(50).default(['']) }),
  embed: z.object({ url: optHttps, title: z.string().max(160).default('Interactive content'), height: z.number().int().min(200).max(1200).default(480) }),
  lab: z.object({
    lab: z.enum(['code', 'science', 'math']).default('code'),
    tool: z.string().max(40).default('python'),
    title: z.string().max(160).default('Try it in the lab'),
    instructions: z.string().max(4000).default(''),
    starter: z.string().max(20000).optional(),
  }),
  divider: z.object({}).passthrough(),
} satisfies Record<BlockType, z.ZodTypeAny>;

export type BlockContent<T extends BlockType = BlockType> = z.infer<(typeof blockSchemas)[T]>;
export type LessonBlock = { id: string; type: BlockType; content: Record<string, unknown> };

export const blockMeta: Record<BlockType, { label: string; hint: string }> = {
  heading: { label: 'Heading', hint: 'Section title' },
  paragraph: { label: 'Text', hint: 'Explanation or narrative' },
  image: { label: 'Image', hint: 'Diagram, photo or illustration' },
  video: { label: 'Video', hint: 'YouTube, Vimeo or uploaded demo' },
  audio: { label: 'Audio', hint: 'Narration or listening exercise' },
  code: { label: 'Code', hint: 'Code with expected output' },
  callout: { label: 'Callout', hint: 'Tip, warning or key point' },
  activity: { label: 'Practical activity', hint: 'Hands-on task' },
  quiz: { label: 'Knowledge check', hint: 'Quick practice question' },
  lab: { label: 'Lab activity', hint: 'Code, simulation or maths tool' },
  resource: { label: 'Downloadable resource', hint: 'Notes, worksheets, files' },
  link: { label: 'External link', hint: 'Further reading' },
  table: { label: 'Table', hint: 'Structured data' },
  steps: { label: 'Step-by-step', hint: 'Numbered instructions' },
  embed: { label: 'Embedded content', hint: 'Simulations, slides, forms' },
  divider: { label: 'Divider', hint: 'Visual break' },
};

/** Hosts allowed in embed blocks (interactive learning tools). */
export const EMBED_HOSTS = [
  'www.youtube-nocookie.com', 'www.youtube.com', 'player.vimeo.com', 'docs.google.com', 'forms.gle', 'phet.colorado.edu',
  'www.geogebra.org', 'www.desmos.com', 'trinket.io', 'codepen.io', 'replit.com', 'onecompiler.com', 'www.canva.com', 'h5p.org', 'scratch.mit.edu',
];
export function isAllowedEmbed(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && EMBED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export function defaultContent(type: BlockType): Record<string, unknown> {
  return blockSchemas[type].parse({}) as Record<string, unknown>;
}

export function validateBlocks(blocks: LessonBlock[]): { ok: true } | { ok: false; index: number; message: string } {
  for (let i = 0; i < blocks.length; i++) {
    const r = blockSchemas[blocks[i].type].safeParse(blocks[i].content);
    if (!r.success) return { ok: false, index: i, message: r.error.issues[0]?.message ?? 'Invalid block' };
  }
  return { ok: true };
}

export function newBlock(type: BlockType): LessonBlock {
  return { id: crypto.randomUUID(), type, content: defaultContent(type) };
}
