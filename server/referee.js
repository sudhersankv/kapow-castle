// Referee interface: referee({ puzzle, expected, aliases, utterance }) -> { intent, correct, power, feedback, source }
// Order: Jev, then Neon AI Gateway if configured, then local matching so the demo never stalls.

const PRAISE = ['Kapow! You got it!', 'Boom! That is right!', 'Wow, spot on!'];
const NUDGE = ['So close! Try once more.', 'Good try! Here comes a hint.'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function localMatch(utterance, aliases) {
  const said = ` ${utterance.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ')} `;
  if (aliases.some((a) => said.includes(` ${a} `) || said.includes(` ${a}s `))) return true;
  // Speech-to-text often misspells names, so long word answers may be a little off.
  const words = said.trim().split(' ');
  const candidates = [...words, ...words.slice(1).map((w, i) => words[i] + w)];
  return aliases.some((a) => a.length >= 6 && !/[\s\d]/.test(a) && candidates.some((c) => editDistance(c, a) <= 2));
}

function localIntent(utterance) {
  const said = utterance.toLowerCase().trim();
  if (/^(skip|next|pass)\b|i give up/.test(said)) return 'skip';
  if (/\?$|^(why|what's|whats|what is a|how do|how does|who is|can you explain|i don't get|i dont get)\b/.test(said)) return 'doubt';
  return 'answer';
}

async function askJev({ puzzle, expected, utterance }) {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      model: 'jev-latest',
      state: `Puzzle asked to a child: ${puzzle}\nCorrect answer: ${expected}\nThe child said (from speech recognition, so names may be misspelled; judge by how it sounds): "${utterance}"`,
      questions: {
        intent: {
          type: 'choice',
          instructions: 'What is the child doing?',
          criteria: {
            answer: 'Attempting to answer the puzzle, even if wrong',
            doubt: 'Asking a question or saying they do not understand something',
            skip: 'Asking to skip or move on',
            off_topic: 'Unrelated to the puzzle or its subject: random chatter, talking to someone else, or background noise',
          },
        },
        correct: { type: 'noul', instructions: "Does the child's words give the correct answer to the puzzle?" },
        power: {
          type: 'score',
          instructions: 'How confident and complete is the answer?',
          criteria: ['Guessing or unsure', 'Right idea', 'Confident and complete'],
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`jev ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { answers } = await res.json();
  const confused = answers.intent.confidence < 0.6 || Math.abs(answers.correct.noul - 0.5) < 0.2;
  return { intent: answers.intent.choice, correct: answers.correct.noul > 0.5, power: answers.power.score, confused, source: 'jev' };
}

async function askNeon({ puzzle, expected, utterance }) {
  const { NEON_AI_GATEWAY_BASE_URL: base, NEON_AI_GATEWAY_TOKEN: token } = process.env;
  if (!base || !token) throw new Error('neon not configured');
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      messages: [{
        role: 'user',
        content: `Puzzle: ${puzzle}\nCorrect answer: ${expected}\nChild said: "${utterance}"\nReply with JSON only: {"intent":"answer|doubt|skip|off_topic","correct":true|false,"power":0-1}. Use off_topic for chatter unrelated to the puzzle.`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`neon ${res.status}`);
  const text = (await res.json()).choices[0].message.content;
  return { ...JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)), source: 'neon' };
}

export async function referee({ puzzle, expected, aliases, utterance }) {
  const local = localMatch(utterance, aliases);
  let verdict;
  const attempt = async (provider) => {
    try {
      return await provider({ puzzle, expected, utterance });
    } catch (e) {
      console.warn(`referee: ${e.message}`);
      return null;
    }
  };
  verdict = await attempt(askJev);
  // When Jev errors or is unsure, the LLM decides. If it is unavailable, Jev's verdict stands.
  if (!verdict || verdict.confused) verdict = (await attempt(askNeon)) || verdict;
  verdict ||= { intent: localIntent(utterance), correct: local, power: 0.7, source: 'local' };

  // An exact spoken match always counts, because speech-to-text can confuse a model.
  const correct = verdict.correct || local;
  const intent = local ? 'answer' : verdict.intent;
  const power = Math.max(0.35, Math.min(1, Number(verdict.power) || 0.7));
  console.log(`referee[${verdict.source}] intent=${intent} correct=${correct} power=${power.toFixed(2)}`);
  return { intent, correct, power, feedback: correct ? pick(PRAISE) : pick(NUDGE), source: verdict.source };
}
