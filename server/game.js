import { NPCS, getPuzzle } from './puzzles.js';
import { referee } from './referee.js';
import { searchClue, searchKidAnswer } from './exa.js';

const sessions = new Map();

let lastRegistered = null;

export function getSession(id, init = {}) {
  if (!sessions.has(id)) sessions.set(id, { npcId: init.npcId || 'sumi', index: init.index || 0, seq: 0, events: [], misses: 0 });
  const session = sessions.get(id);
  if (init.npcId) {
    Object.assign(session, { npcId: init.npcId, index: init.index || 0, misses: 0 });
    lastRegistered = session;
  }
  return session;
}

// Makes a Vapi call id share the browser's existing session.
export function linkSession(id, from) {
  const session = sessions.get(from);
  if (session) {
    sessions.set(id, session);
    lastRegistered = session;
  }
  return session;
}

// A tool call must never land on a blank session, or it would grade the wrong puzzle.
export function sessionForCall(callId) {
  if (callId && sessions.has(callId)) return sessions.get(callId);
  console.warn(`tool call for unregistered call: ${callId || 'no id'}`);
  return lastRegistered || getSession(callId || 'unknown');
}

function emit(session, event) {
  session.events.push({ seq: ++session.seq, ...event });
}

function redact(text, aliases) {
  return aliases.reduce((t, a) => t.replace(new RegExp(`\\b${a}\\b`, 'gi'), 'something'), text);
}

// Returns the instruction the character speaks from.
export async function askGoat(session, question) {
  const puzzle = getPuzzle(session.npcId, session.index);
  const subject = NPCS[session.npcId]?.subject || 'general knowledge';
  let found = null;
  try {
    found = await searchClue(question, subject);
  } catch (e) {
    console.warn(`goat: ${e.message}`);
  }
  emit(session, { type: 'goat', domain: found?.domain || null, hint: puzzle?.hint || null });
  const fact = found && puzzle ? redact(found.text, puzzle.aliases) : found?.text;
  const hint = puzzle ? ` A hint for the current puzzle: ${puzzle.hint}` : '';
  if (!fact) return `Exa the goat found nothing this time. Encourage the child and offer a simple idea of your own.${hint}`;
  return `Exa the goat found this on ${found.domain}: ${fact}\nIn one simple sentence for a child, explain it in your own words and say Exa found it. Never read this text out, and never say the puzzle's answer.${hint}`;
}

// Direct questions to the goat. It answers on screen and only hints at the live puzzle.
export async function goatAnswer(session, question) {
  const puzzle = session ? getPuzzle(session.npcId, session.index) : null;
  const subject = session ? NPCS[session.npcId]?.subject : 'general knowledge';
  const found = await searchKidAnswer(question, subject || 'general knowledge');
  const answer = found ? (puzzle ? redact(found.text, puzzle.aliases) : found.text) : null;
  return { question, answer, domain: found?.domain || null, hint: puzzle?.hint || null };
}

export async function gradeAnswer(session, utterance) {
  const puzzle = getPuzzle(session.npcId, session.index);
  if (!puzzle) return { spoken: 'All puzzles are solved. Congratulate the child and say goodbye.' };

  const verdict = await referee({ puzzle: puzzle.question, expected: puzzle.expected, aliases: puzzle.aliases, utterance });

  // The Jev gate: unrelated talk is never graded and never counts as a miss.
  if (verdict.intent === 'off_topic' && !verdict.correct) {
    emit(session, { type: 'filtered' });
    return { spoken: `The child said something unrelated to the puzzle. Do not answer it or comment on it. In a few friendly words, bring them back to this puzzle: ${puzzle.question}` };
  }

  if (verdict.intent === 'doubt' && !verdict.correct) return { spoken: await askGoat(session, utterance) };

  if (verdict.intent === 'skip' && !verdict.correct) {
    session.index += 1;
    session.misses = 0;
    emit(session, { type: 'skip', index: session.index });
    return { spoken: 'No problem at all. Say one cheerful sentence, tell the child the next gate is open, and say goodbye. Ask no more puzzles.' };
  }

  if (!verdict.correct) {
    session.misses += 1;
    if (session.misses >= 2) {
      session.index += 1;
      session.misses = 0;
      emit(session, { type: 'skip', index: session.index, reveal: puzzle.expected });
      return { spoken: `Good effort. Kindly tell the child the answer was ${puzzle.expected}, say the next gate is open anyway, and say goodbye. Ask no more puzzles.` };
    }
    emit(session, { type: 'wrong', feedback: verdict.feedback, hint: puzzle.hint });
    return { spoken: `Not quite. The puzzle is still: ${puzzle.question} Kindly give this hint and never say the answer: ${puzzle.hint}` };
  }

  session.index += 1;
  session.misses = 0;
  emit(session, { type: 'correct', power: verdict.power, feedback: verdict.feedback, index: session.index });
  return { spoken: 'Correct! Say your catchphrase, celebrate in one short sentence, tell the child the next gate is open, and say goodbye. Ask no more puzzles.' };
}
