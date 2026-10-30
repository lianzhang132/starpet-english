import { dueIds } from './mastery.mjs';

export const isListeningQuestion = (mode, question) =>
  mode === 'listen' || mode === 'phonics-listen' || Boolean(question?.speech);

export function reviewQueue(mastery, questions, scenes, now = Date.now()) {
  const items = new Map(questions.map(question => [question.id, {kind:'quiz', id:question.id, question}]));
  for (const scene of scenes) {
    if (scene.kind === 'conversation') {
      scene.turns.forEach((turn, index) => {
        const id = `conversation:${scene.id}:${turn.id}`;
        items.set(id, {kind:'speaking', id, sceneId:scene.id, index, title:turn.question});
      });
    } else {
      scene.lines.forEach((line, index) => {
        const id = `speaking:${scene.id}:${index}`;
        items.set(id, {kind:'speaking', id, sceneId:scene.id, index, title:line});
      });
    }
  }
  return dueIds(mastery, now).map(id => items.get(id)).filter(Boolean);
}
