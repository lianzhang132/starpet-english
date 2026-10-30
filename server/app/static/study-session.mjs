const DAILY_LISTS = ['dailyWords', 'dailySentences', 'dailyQuizzes', 'dailyAttemptIds'];
const dayKey = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const strings = (value, limit = 10000) => Array.isArray(value)
  ? [...new Set(value.filter(item => typeof item === 'string' && item.length > 0 && item.length <= 100))].slice(0, limit) : [];

function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? dayKey(date) : '';
}

// Reading today's plan must never count as studying. Keep its calendar separate
// from the last real learning day, including migration from pre-1.7.1 records.
export function refreshStudyDay(state, {studying = false, now = new Date()} = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
  const today = dayKey(now);
  let changed = false;
  const assign = (key, value) => {
    if (JSON.stringify(state[key]) !== JSON.stringify(value)) { state[key] = value; changed = true; }
  };
  const lastStudy = calendarDay(state.lastDay);
  const recordedDay = calendarDay(state.dailyDay) || lastStudy;
  assign('lastDay', lastStudy);
  assign('dailyDay', today);
  for (const key of DAILY_LISTS) assign(key, recordedDay === today ? strings(state[key]) : []);
  if (studying && lastStudy !== today) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
    const streak = Number.isSafeInteger(state.streak) && state.streak >= 0 ? state.streak : 0;
    assign('streak', lastStudy === dayKey(yesterday) ? Math.min(100000, streak + 1) : 1);
    assign('lastDay', today);
  }
  return changed;
}

export function studyExtrasSnapshot(state, now = new Date()) {
  refreshStudyDay(state, {now});
  return {
    studySession: {day: state.dailyDay, lastStudyDay: state.lastDay,
      ...Object.fromEntries(DAILY_LISTS.map(key => [key, [...state[key]]]))},
    phonicsPracticed: strings(state.phonicsPracticed, 1000),
    cardCursor: Number.isSafeInteger(state.cardCursor) ? Math.max(0, Math.min(10000, state.cardCursor)) : 0,
  };
}

export function restoreStudyExtras(state, progress, now = new Date()) {
  const session = progress.studySession;
  if (session && typeof session === 'object' && !Array.isArray(session)) {
    state.dailyDay = calendarDay(session.day);
    state.lastDay = calendarDay(session.lastStudyDay);
    for (const key of DAILY_LISTS) state[key] = strings(session[key]);
  }
  // An older server/queued snapshot may omit these fields; omission is not reset.
  if (Array.isArray(progress.phonicsPracticed)) state.phonicsPracticed = strings(progress.phonicsPracticed, 1000);
  if (Number.isSafeInteger(progress.cardCursor) && progress.cardCursor >= 0) state.cardCursor = Math.min(10000, progress.cardCursor);
  refreshStudyDay(state, {now});
}
