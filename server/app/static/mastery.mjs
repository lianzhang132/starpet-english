const DAY = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

export function normalizeMastery(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const safe = {};
  for (const [id, item] of Object.entries(value)) {
    if (!id || id.length > 100 || !item || !Number.isInteger(item.level) || !Number.isInteger(item.attempts)) continue;
    safe[id] = {
      level: Math.max(0, Math.min(5, item.level)), attempts: Math.max(0, item.attempts),
      correct: Math.max(0, Math.min(item.attempts, Number.isInteger(item.correct) ? item.correct : 0)),
      lastSeen: Number.isSafeInteger(item.lastSeen) ? Math.max(0, item.lastSeen) : 0,
      dueAt: Number.isSafeInteger(item.dueAt) ? Math.max(0, item.dueAt) : 0
    };
  }
  return safe;
}

export function recordAttempt(mastery, itemId, correct, now = Date.now()) {
  const previous = mastery[itemId] || { level: 0, attempts: 0, correct: 0 };
  // Repeating an answer immediately is practice, not evidence of delayed recall.
  const advances = !previous.attempts || now >= previous.dueAt;
  const level = correct ? Math.min(5, previous.level + (advances ? 1 : 0)) : Math.max(0, previous.level - 1);
  const delay = correct ? INTERVAL_DAYS[level] * DAY : 10 * 60 * 1000;
  mastery[itemId] = {
    level,
    attempts: previous.attempts + 1,
    correct: previous.correct + (correct ? 1 : 0),
    lastSeen: now,
    dueAt: correct && !advances ? previous.dueAt : now + delay
  };
  return mastery[itemId];
}

export function dueIds(mastery, now = Date.now()) {
  return Object.entries(normalizeMastery(mastery))
    .filter(([, item]) => Number(item.dueAt) <= now)
    .sort((a, b) => Number(a[1].dueAt) - Number(b[1].dueAt) || a[1].level - b[1].level)
    .map(([id]) => id);
}

export function accuracy(item) {
  return item?.attempts ? Math.round(item.correct / item.attempts * 100) : 0;
}
