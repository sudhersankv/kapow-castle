// Creates or updates the Vapi tool and single assistant. Prints statuses only, never keys.
import 'dotenv/config';
import fs from 'node:fs';

const API = 'https://api.vapi.ai';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://kapow-castle.fly.dev';
const headers = {
  Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
  'Content-Type': 'application/json',
};

async function call(method, route, body) {
  const res = await fetch(API + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const SYSTEM_PROMPT = `You are {{npcName}}, a character in a learning game called Kapow Castle. Your subject is {{subject}}. Your personality: {{personality}}.
You are talking with a child aged 7 to 11. You have already told them a short lesson and asked this puzzle: {{puzzleSeed}}
Your catchphrase is "{{catchphrase}}". Use it when the child gets something right. How you talk: {{speechStyle}}
Rules:
- Stay fully in character. Speak in short, clear sentences with natural punctuation so every word is easy to hear. Spell numbers as words.
- Every single time the child says anything at all, even if it sounds unrelated, call grade_answer with their exact words before you reply. Never judge or respond to what they said on your own.
- After the tool returns, follow its instruction. Say it in your own voice in under 2 sentences of simple words.
- Never read tool text out word for word, and never say a puzzle's answer.
- Wrong answers get a kind hint, never a scolding.
- Keep everything age-appropriate. When talking about history, focus on daily life, ideas, journeys and inventions. Politely steer away from violence and scary or grown-up topics.`;

const tool = {
  function: {
    name: 'grade_answer',
    description: "Send the child's latest words to the game referee. Returns what to say next.",
    parameters: {
      type: 'object',
      properties: { kidUtterance: { type: 'string', description: 'The exact words the child just said' } },
      required: ['kidUtterance'],
    },
  },
  server: { url: `${PUBLIC_URL}/vapi/tools` },
};

const tools = await call('GET', '/tool?limit=100');
let toolId = tools.find((t) => t.function?.name === tool.function.name)?.id;
if (toolId) {
  await call('PATCH', `/tool/${toolId}`, tool);
  console.log('tool updated');
} else {
  toolId = (await call('POST', '/tool', { type: 'function', ...tool })).id;
  console.log('tool created');
}

const assistant = {
  name: 'Kapow Castle NPC',
  firstMessage: "{{catchphrase}} I'm {{npcName}}. {{lesson}} Here's your puzzle. {{puzzleSeed}}",
  model: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    toolIds: [toolId],
  },
  voice: { provider: 'deepgram', voiceId: 'thalia', model: 'aura-2' },
  transcriber: { provider: 'deepgram', model: 'nova-3', keyterm: ['Temujin', 'Genghis Khan', 'Mongolia', 'ger', 'yurt', 'Yam', 'Silk Road'] },
};

const creds = await call('GET', '/credential');
if (creds.some((c) => c.provider === 'deepgram')) {
  console.log('deepgram credential: already in Vapi');
} else if (process.env.DEEPGRAM_API_KEY) {
  await call('POST', '/credential', { provider: 'deepgram', apiKey: process.env.DEEPGRAM_API_KEY });
  console.log('deepgram credential: added to Vapi');
} else {
  console.log('deepgram credential: none, using Vapi default');
}

let id = process.env.VAPI_ASSISTANT_ID;
if (id) {
  await call('PATCH', `/assistant/${id}`, assistant);
  console.log('assistant updated');
} else {
  id = (await call('POST', '/assistant', assistant)).id;
  const env = fs.readFileSync('.env', 'utf8');
  fs.writeFileSync(
    '.env',
    /^VAPI_ASSISTANT_ID=.*$/m.test(env)
      ? env.replace(/^VAPI_ASSISTANT_ID=.*$/m, `VAPI_ASSISTANT_ID=${id}`)
      : `${env.trimEnd()}\nVAPI_ASSISTANT_ID=${id}\n`,
  );
  console.log('assistant created and saved to .env');
}
