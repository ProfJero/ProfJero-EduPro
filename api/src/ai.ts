/**
 * EduIntelligence: AI Companion (tutor chat, streamed) and Teacher Resource
 * Studio (structured generation). Grounded in approved curriculum items and
 * the learner's lesson; usage is metered by public.ai_consume (as the user).
 *
 * Provider: Google Gemini via its OpenAI-compatible endpoint.
 */
import OpenAI from 'openai';
import type { Env } from './env';
import { HttpError, UUID, body, json, rest, rpc, type User } from './util';

const MODEL = 'gemini-2.5-flash';
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/';

type Item = { id: string; code: string | null; title: string; kind: string; description: string | null; grade_level: string | null; framework: string; path: string | null };
type Allowance = { allowed: boolean; reason?: string; remaining: number | null; limit: number | null; is_teacher?: boolean };

export const aiReady = (env: Env) => Boolean(env.GEMINI_API_KEY && env.SUPABASE_URL);

const client = (env: Env) =>
  new OpenAI({
    apiKey: env.GEMINI_API_KEY!,
    baseURL: env.GEMINI_BASE_URL || DEFAULT_BASE,
    fetch: async (url, init) => {
      // Google Gemini's OpenAI-compatible endpoint rejects unknown fields like `store`.
      // The OpenAI SDK injects `store: false` by default, so we strip it out here.
      if (init?.body && typeof init.body === 'string') {
        try {
          const bodyObj = JSON.parse(init.body);
          delete bodyObj.store;
          init.body = JSON.stringify(bodyObj);
        } catch {
          // If parsing fails, let the SDK handle it (or fail naturally).
        }
      }
      return fetch(url, init);
    },
  });

async function consume(env: Env, user: User) {
  const r = await rpc<Allowance>(env, user.token, 'ai_consume', { p_tokens: 0 });
  if (!r.ok) throw new HttpError(502, 'Could not check your AI allowance.');
  if (!r.data.allowed) throw new HttpError(429, r.data.reason ?? 'AI requests are not available right now.');
  return r.data;
}

async function curriculum(env: Env, user: User, query: string, subject?: string, grade?: string): Promise<Item[]> {
  const r = await rpc<Item[]>(env, user.token, 'curriculum_search', { p_query: query.slice(0, 300), p_subject: subject ?? null, p_grade: grade ?? null, p_limit: 8 });
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

function curriculumBlock(items: Item[]) {
  if (!items.length) return 'No approved curriculum items matched this request. Teach from sound, widely accepted knowledge appropriate for the level, and do not invent curriculum codes.';
  return items.map((i) => `- [${i.framework}] ${i.kind}${i.code ? ` ${i.code}` : ''}: ${i.title}${i.path ? ` (under ${i.path})` : ''}${i.grade_level ? ` — ${i.grade_level}` : ''}${i.description ? `\n  ${i.description.slice(0, 400)}` : ''}`).join('\n');
}

/** Strip markdown code fences that Gemini sometimes wraps around JSON. */
function unfence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

const TUTOR_SYSTEM = `You are the ProfJero Edu AI Companion, a warm, patient study partner for learners in Ghana (Basic 7 to tertiary) on the ProfJero Edu learning platform.

Priorities, in order:
1. The approved Ghana Education Service (GES) / NaCCA curriculum. When curriculum items are supplied, align your explanation to them, use their terminology, and mention the relevant strand or standard naturally. Never invent curriculum codes or claim something is "in the syllabus" unless it appears in the supplied items.
2. The learner's own lesson content, when supplied.
3. Accurate general knowledge suited to the learner's level.

How you teach:
- Explain step by step in clear, simple English. Use familiar Ghanaian examples (cedis and pesewas, local foods, markets, trotro, farming, football, places in Ghana) where they genuinely help.
- Check understanding with a short question at the end when it helps.
- Use short paragraphs, bullet lists, numbered steps, small tables and **bold** key terms. Write maths with plain characters (x², √, ×, ÷, fractions like 3/4). Keep answers focused — usually under 350 words unless the learner asks for more.

Academic integrity:
- Help learners understand; do not complete graded assignments, tests or exams for them. If a request looks like graded work, guide with hints, a similar worked example and questions instead of the final answer.

Safety:
- Many learners are minors. Keep content age-appropriate. Do not ask for personal details. For health, safety or wellbeing worries, respond kindly and encourage them to talk to a trusted adult, teacher or counsellor.
- If you are unsure of a fact, say so.`;

const MODE_HINT: Record<string, string> = {
  explain: 'Mode: Explain. Give a clear explanation with an example, then one quick check question.',
  hint: 'Mode: Guide me. Do not give the final answer. Ask guiding questions and give one hint at a time, building on what the learner says.',
  quiz: 'Mode: Quiz me. Ask one question at a time (mostly multiple choice or short answer) on the topic, wait for the answer, then give feedback and the next question. Keep score when asked.',
  summary: 'Mode: Summarise. Produce concise revision notes: key points, key terms with meanings, and 3 practice questions at the end.',
};

/** POST /api/ai/chat — streams the reply as server-sent events. */
export async function chat(req: Request, env: Env, user: User) {
  if (!aiReady(env)) return json({ error: 'The AI Companion is not configured on this server yet.' }, 503);
  const b = await body<{ conversation_id?: string; message?: string; mode?: string; lesson_id?: string; subject?: string; grade?: string }>(req);
  const message = (b.message ?? '').trim();
  if (!message || message.length > 4000) return json({ error: 'Write a message (up to 4000 characters).' }, 400);
  if (b.conversation_id && !UUID.test(b.conversation_id)) return json({ error: 'Invalid conversation' }, 400);
  if (b.lesson_id && !UUID.test(b.lesson_id)) return json({ error: 'Invalid lesson' }, 400);
  const allowance = await consume(env, user);

  // Conversation + history (RLS: only the owner can read or write it).
  let convId = b.conversation_id;
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  if (convId) {
    const h = await rest<{ role: 'user' | 'assistant'; content: string }[]>(env, user.token, `ai_messages?conversation_id=eq.${convId}&select=role,content&order=created_at.desc&limit=20`);
    if (!h.ok) return json({ error: 'Conversation not found' }, 404);
    history = h.data.reverse();
  } else {
    const c = await rest<{ id: string }[]>(env, user.token, 'ai_conversations', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, mode: 'tutor', title: message.slice(0, 70), context: { lesson_id: b.lesson_id ?? null, subject: b.subject ?? null, grade: b.grade ?? null } }) });
    if (!c.ok || !c.data?.[0]) return json({ error: 'Could not start the conversation' }, 500);
    convId = c.data[0].id;
  }

  const [items, lesson] = await Promise.all([
    curriculum(env, user, `${b.subject ?? ''} ${message}`, b.subject, b.grade),
    b.lesson_id ? rpc<{ lesson_title: string; course_title: string; subject: string | null; summary: string | null; text: string | null; curriculum: { code: string | null; title: string }[] } | null>(env, user.token, 'ai_lesson_context', { p_lesson: b.lesson_id }) : Promise.resolve(null),
  ]);
  const lc = lesson?.ok ? lesson.data : null;
  const context = [
    `Learner level: ${b.grade ?? 'not specified'}. Subject: ${b.subject ?? lc?.subject ?? 'not specified'}.`,
    MODE_HINT[b.mode ?? 'explain'] ?? MODE_HINT.explain,
    `Approved curriculum items (most relevant first):\n${curriculumBlock(items)}`,
    lc ? `The learner is studying the lesson "${lc.lesson_title}" in the course "${lc.course_title}".${lc.curriculum?.length ? ` Linked curriculum: ${lc.curriculum.map((c) => `${c.code ?? ''} ${c.title}`.trim()).join('; ')}.` : ''}\nLesson content:\n${(lc.text ?? lc.summary ?? '').slice(0, 12000)}` : '',
  ].filter(Boolean).join('\n\n');

  await rest(env, user.token, 'ai_messages', { method: 'POST', body: JSON.stringify({ conversation_id: convId, role: 'user', content: message }) });

  const citations = items.slice(0, 6).map((i) => ({ code: i.code, title: i.title, kind: i.kind, framework: i.framework }));
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: TUTOR_SYSTEM },
    ...history.map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam)),
    { role: 'user', content: `<context>\n${context}\n</context>\n\n${message}` },
  ];

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const te = new TextEncoder();
  const send = (o: unknown) => writer.write(te.encode(`data: ${JSON.stringify(o)}\n\n`));

  const run = async () => {
    let text = '';
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      await send({ type: 'meta', conversation_id: convId, remaining: allowance.remaining, citations });
      const stream = await client(env).chat.completions.create({
        model: MODEL,
        max_tokens: 8000,
        messages,
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) { text += delta; await send({ type: 'delta', text: delta }); }
        if (chunk.usage) { tokensIn = chunk.usage.prompt_tokens ?? tokensIn; tokensOut = chunk.usage.completion_tokens ?? tokensOut; }
      }
      if (!text) {
        text = 'I can’t help with that request. Let’s get back to your studies — what topic are you working on?';
        await send({ type: 'delta', text });
      }
      await rest(env, user.token, 'ai_messages', { method: 'POST', body: JSON.stringify({ conversation_id: convId, role: 'assistant', content: text.slice(0, 40000) || '…', citations, tokens_in: tokensIn, tokens_out: tokensOut }) });
      await rest(env, user.token, `ai_conversations?id=eq.${convId}`, { method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() }) });
      await send({ type: 'done' });
    } catch (e) {
      console.error('ai chat error:', e);
      if (e instanceof OpenAI.APIError) {
        const bodyText = await e.response?.text().catch(() => 'no body');
        console.error('AI API Error Status:', e.status, 'Body:', bodyText);
      }
      const status = e instanceof OpenAI.APIError ? e.status : 0;
      await send({ type: 'error', message: status === 429 || status === 529 ? 'The AI Companion is very busy. Please try again in a minute.' : 'The AI Companion had a problem answering. Please try again.' });
    } finally {
      await writer.close();
    }
  };
  return { response: new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } }), work: run() };
}

// ---------------------------------------------------------------------------
// Resource Studio
// ---------------------------------------------------------------------------
type StudioIn = {
  task?: string; subject?: string; grade?: string; topic?: string; duration?: number; strand?: string; sub_strand?: string; content_standard?: string; indicators?: string;
  count?: number; question_types?: string[]; difficulty?: string; weeks?: number; extra?: string; lesson_id?: string;
};
const TASK_BRIEF: Record<string, (f: StudioIn) => string> = {
  lesson_plan: (f) => `Write a complete GES-style lesson plan for a ${f.duration ?? 60}-minute lesson. Use these sections as Markdown headings, in order: Lesson details (a table with Subject, Class, Duration, Strand, Sub-strand, Content standard, Indicator(s), Performance indicator, Core competencies, Key words, Teaching/learning resources, References); Starter (preparing the brain for learning, with timing); Main (new learning, with step-by-step teacher activities and learner activities in a two-column table, including group or pair work and assessment for learning); Reflection (plenary and exit questions); Assessment; Homework; Differentiation (support for struggling learners and extension for fast learners). Use low-cost, locally available resources.`,
  lesson_note: (f) => `Write structured lesson notes for learners on the topic. Sections: Introduction; Learning objectives; Key concepts explained step by step with headings; Worked examples (at least ${Math.max(2, Math.min(5, f.count ?? 3))}); Key vocabulary (table: term and meaning); Common mistakes; Summary; Practice exercise (5 questions with answers at the end).`,
  questions: (f) => `Create ${Math.min(Math.max(f.count ?? 10, 3), 30)} assessment questions. Types to use: ${(f.question_types ?? ['mcq', 'short_answer']).join(', ')}. Difficulty: ${f.difficulty ?? 'mixed'} (if mixed, spread across recall, understanding, application and analysis). For mcq give exactly 4 options and set answer to the exact text of the correct option. For true_false set answer to "True" or "False". For short_answer give a model answer; for essay give the key points expected. Include a one-sentence explanation and marks for each. Also put a short Markdown summary of the question set (topic, coverage, total marks) in markdown.`,
  scheme_of_work: (f) => `Write a scheme of work for ${f.weeks ?? 12} weeks as a Markdown table with columns: Week, Strand, Sub-strand, Content standard / Indicators, Topics and learning activities, Resources, Assessment. Follow a logical teaching sequence and add a short introduction before the table.`,
  rubric: () => 'Write an analytic marking rubric as a Markdown table: criteria as rows and four performance levels as columns (Excellent 4, Good 3, Fair 2, Needs improvement 1), with clear descriptors in every cell, then a short guide on converting the score to marks.',
  worksheet: () => 'Write a printable learner worksheet: title, instructions, Section A (short objective questions), Section B (structured questions), Section C (an activity or real-life problem), then an answer key for the teacher at the end under its own heading.',
};

/**
 * The schema is described in prose for the model (Gemini's OpenAI-compat JSON
 * mode takes response_format:{type:'json_object'} without a full schema), and
 * the same shape is enforced by parse+validate below.
 */
const STUDIO_JSON_SPEC = `Return a single JSON object (no markdown fences) with these keys:
- "title": string
- "markdown": string (the full document)
- "questions": array of objects, each with:
    "type": one of "mcq" | "true_false" | "short_answer" | "essay",
    "prompt": string,
    "options": array of strings (empty array unless type is mcq),
    "answer": string,
    "explanation": string,
    "marks": integer,
    "difficulty": one of "easy" | "medium" | "hard".
When the task is not "questions", return an empty array for "questions" and put the whole document in "markdown".`;

type StudioOut = { title: string; markdown: string; questions: unknown[] };

function validateStudio(o: unknown): StudioOut | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (typeof r.title !== 'string' || typeof r.markdown !== 'string' || !Array.isArray(r.questions)) return null;
  return { title: r.title, markdown: r.markdown, questions: r.questions };
}

/** POST /api/ai/studio — returns { title, markdown, questions, citations } */
export async function studio(req: Request, env: Env, user: User) {
  if (!aiReady(env)) return json({ error: 'AI drafting is not configured on this server yet.' }, 503);
  const f = await body<StudioIn>(req);
  const brief = TASK_BRIEF[f.task ?? ''];
  if (!brief) return json({ error: 'Unknown resource type' }, 400);
  if (!f.subject) return json({ error: 'Choose a subject' }, 400);
  if (f.lesson_id && !UUID.test(f.lesson_id)) return json({ error: 'Invalid lesson' }, 400);
  const allowance = await consume(env, user);
  if (!allowance.is_teacher) return json({ error: 'The Resource Studio is for teachers.' }, 403);

  const [items, lesson] = await Promise.all([
    curriculum(env, user, [f.topic, f.strand, f.sub_strand, f.content_standard, f.indicators].filter(Boolean).join(' ') || f.subject, f.subject, f.grade),
    f.lesson_id ? rpc<{ lesson_title: string; text: string | null; summary: string | null } | null>(env, user.token, 'ai_lesson_context', { p_lesson: f.lesson_id }) : Promise.resolve(null),
  ]);
  const lc = lesson?.ok ? lesson.data : null;
  const clip = (s?: string, n = 300) => (s ?? '').slice(0, n);
  const prompt = [
    `Subject: ${clip(f.subject, 80)}. Class/level: ${clip(f.grade, 40) || 'not specified'}. Topic: ${clip(f.topic) || lc?.lesson_title || 'see lesson'}.`,
    f.strand || f.sub_strand || f.content_standard || f.indicators ? `Teacher-supplied curriculum references (use this wording exactly): Strand: ${clip(f.strand) || '—'}; Sub-strand: ${clip(f.sub_strand) || '—'}; Content standard: ${clip(f.content_standard) || '—'}; Indicator(s): ${clip(f.indicators, 600) || '—'}.` : '',
    `Approved curriculum items from the platform:\n${curriculumBlock(items)}`,
    lc ? `Base the content on this lesson written by the teacher ("${lc.lesson_title}"):\n${(lc.text ?? lc.summary ?? '').slice(0, 15000)}` : '',
    f.extra ? `Teacher's notes: ${clip(f.extra, 1000)}` : '',
    `Task: ${brief(f)}`,
    STUDIO_JSON_SPEC,
    'Where the curriculum references are missing, write "—" rather than inventing codes.',
  ].filter(Boolean).join('\n\n');

  const completion = await client(env).chat.completions.create({
    model: MODEL,
    max_tokens: 16000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are an experienced Ghanaian teacher-trainer who writes high-quality, curriculum-aligned teaching resources for the GES/NaCCA Standards-Based Curriculum and the Common Core Programme. Write in clear British English with Ghanaian context and examples. Be accurate; never invent official curriculum codes.' },
      { role: 'user', content: prompt },
    ],
  });

  const choice = completion.choices?.[0];
  if (!choice) return json({ error: 'The draft came back empty. Please try again.' }, 502);
  if (choice.finish_reason === 'length') return json({ error: 'The resource was too long to finish. Try a shorter duration or fewer questions.' }, 422);
  const raw = choice.message?.content ?? '';
  let out: StudioOut | null;
  try { out = validateStudio(JSON.parse(unfence(raw))); } catch { out = null; }
  if (!out) return json({ error: 'The draft came back in an unexpected format. Please try again.' }, 502);

  return json({ ...out, citations: items.slice(0, 8).map((i) => ({ code: i.code, title: i.title, kind: i.kind, framework: i.framework })), remaining: allowance.remaining });
}
