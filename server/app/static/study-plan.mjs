import { normalizeMastery } from './mastery.mjs';

// A daily session mixes due recall with new material. A different question about
// the same word must not masquerade as new material while that word is resting.
export function planDaily({ questions, mastery, dailyQuizzes = [], dailyAttemptIds = [], completedLessons = [], now = Date.now(), limit = 6 }) {
  const records = normalizeMastery(mastery);
  const completed = new Set(completedLessons);
  const answeredToday = new Set([...dailyQuizzes, ...dailyAttemptIds]);
  const conceptOf = question => question.conceptKey || question.id;
  const concepts = new Map();
  for (const question of questions) {
    const key = conceptOf(question);
    if (!concepts.has(key)) concepts.set(key, []);
    concepts.get(key).push(question);
  }
  const usedToday = new Set(questions.filter(q => answeredToday.has(q.id)).map(conceptOf));
  const due = [];
  const fresh = [];
  for (const [concept, variants] of concepts) {
    if (usedToday.has(concept)) continue;
    const practiced = variants.filter(q => records[q.id]?.attempts > 0);
    const dueVariants = practiced.filter(q => records[q.id].dueAt <= now)
      .sort((a, b) => records[a.id].dueAt - records[b.id].dueAt);
    if (dueVariants.length) {
      const question = dueVariants[0], item = records[question.id];
      due.push({ question, kind: 'due', dueAt: item.dueAt,
        reason: item.level === 0 ? '上次没答对，今天再试试' : '今天到期，看看还记得吗' });
      continue;
    }
    // An existing successful/incorrect attempt is resting until its due date.
    if (practiced.length) continue;
    const question = variants.find(q => !q.lessonId || !completed.has(q.lessonId));
    if (question) fresh.push({ question, kind: 'new', reason: '新内容，先想一想' });
  }
  due.sort((a, b) => a.dueAt - b.dueAt);
  const size = Math.max(0, Math.floor(limit));
  const dueTake = due.slice(0, fresh.length ? Math.min(4, size) : size);
  const newTake = fresh.slice(0, size - dueTake.length);
  const items = [...dueTake, ...newTake];
  return { items, dueCount: dueTake.length, newCount: newTake.length, available: due.length + fresh.length };
}

export function normalizeLessonProgress(value, lessons) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const lesson of lessons) {
    const item = value[lesson.id];
    if (!item || !['cards', 'quiz'].includes(item.phase)) continue;
    const allowed = new Set(lesson.questions.map(q => q.id));
    result[lesson.id] = {
      phase: item.phase,
      cardIndex: Number.isInteger(item.cardIndex) ? Math.max(0, Math.min(lesson.words.length, item.cardIndex)) : 0,
      correctIds: Array.isArray(item.correctIds) ? [...new Set(item.correctIds.filter(id => allowed.has(id)))] : [],
      nextQuestionId: allowed.has(item.nextQuestionId) ? item.nextQuestionId : null
    };
  }
  return result;
}
