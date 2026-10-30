import { isListeningQuestion } from './review.mjs';

export const LISTENING_PROMPT='听一听，选出波波说的单词';

// Narrate only the displayed instruction, never the choices/hint or a hidden answer.
export function questionSpeech(mode,question) {
  if(!question)return '';
  if(!isListeningQuestion(mode,question))return question.prompt||'';
  const target=question.speech||question.answers?.[question.correctIndex];
  return target?`${LISTENING_PROMPT}。\n${target}`:LISTENING_PROMPT;
}
