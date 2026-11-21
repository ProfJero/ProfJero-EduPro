/**
 * Offline learning store.
 * - Saved lessons live in a per-user Cache Storage bucket and are deleted on
 *   sign-out, so shared devices do not leak a previous learner's material.
 * - Lesson completions made offline are queued per user and replayed when the
 *   connection returns. complete_lesson is idempotent, so retries never
 *   create duplicate records.
 */
const cacheName = (uid: string) => `pje-offline-${uid}`;
const queueKey = (uid: string) => `pje:queue:${uid}`;

export type OfflineLesson = {
  lessonId: string; courseId: string; courseTitle: string; title: string; savedAt: string;
  blocks: { type: string; content: unknown }[];
};

function hasCaches() {
  return typeof caches !== 'undefined';
}

export async function saveLessonOffline(uid: string, lesson: OfflineLesson) {
  if (!hasCaches()) throw new Error('Offline storage is not supported in this browser.');
  const c = await caches.open(cacheName(uid));
  await c.put(`/offline/lesson/${lesson.lessonId}`, new Response(JSON.stringify(lesson), { headers: { 'content-type': 'application/json' } }));
}

export async function getOfflineLesson(uid: string, lessonId: string): Promise<OfflineLesson | null> {
  if (!hasCaches()) return null;
  const c = await caches.open(cacheName(uid));
  const r = await c.match(`/offline/lesson/${lessonId}`);
  return r ? ((await r.json()) as OfflineLesson) : null;
}

export async function listOfflineLessons(uid: string): Promise<OfflineLesson[]> {
  if (!hasCaches()) return [];
  const c = await caches.open(cacheName(uid));
  const keys = await c.keys();
  const out: OfflineLesson[] = [];
  for (const k of keys) {
    const r = await c.match(k);
    if (r) out.push((await r.json()) as OfflineLesson);
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function removeOfflineLesson(uid: string, lessonId: string) {
  if (!hasCaches()) return;
  const c = await caches.open(cacheName(uid));
  await c.delete(`/offline/lesson/${lessonId}`);
}

export function queueCompletion(uid: string, lessonId: string) {
  const q = readQueue(uid);
  if (!q.includes(lessonId)) q.push(lessonId);
  localStorage.setItem(queueKey(uid), JSON.stringify(q));
}
export function readQueue(uid: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(uid)) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function dequeue(uid: string, lessonId: string) {
  localStorage.setItem(queueKey(uid), JSON.stringify(readQueue(uid).filter((x) => x !== lessonId)));
}

export async function clearOfflineDataForUser(uid: string) {
  try {
    if (hasCaches()) await caches.delete(cacheName(uid));
    localStorage.removeItem(queueKey(uid));
  } catch {
    /* ignore */
  }
}
