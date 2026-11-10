import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NPCS, publicPuzzle } from './puzzles.js';
import { getSession, linkSession, sessionForCall, gradeAnswer, goatAnswer } from './game.js';
import { transcribe } from './listen.js';

const app = express();
app.use(express.json({ limit: '2mb', type: 'application/json' }));

app.get('/api/config', (_req, res) => {
  res.json({
    publicKey: process.env.VAPI_PUBLIC_KEY || '',
    assistantId: process.env.VAPI_ASSISTANT_ID || '',
  });
});

app.get('/api/puzzle', (req, res) => {
  const npc = NPCS[req.query.npcId];
  res.json({ puzzle: publicPuzzle(req.query.npcId, Number(req.query.index) || 0), lesson: npc?.lesson || '', total: npc?.puzzles.length || 0 });
});

// Links a browser session or Vapi call id to a character and puzzle.
app.post('/api/session', (req, res) => {
  const { id, npcId, index, from } = req.body;
  if (from && linkSession(id, from)) return res.json({ ok: true });
  if (!id || !NPCS[npcId]) return res.status(400).json({ error: 'Unknown session or character' });
  getSession(id, { npcId, index: Number(index) || 0 });
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  const after = Number(req.query.after) || 0;
  res.json({ events: getSession(req.query.id).events.filter((e) => e.seq > after) });
});

// Typed answers, used when voice is off.
app.post('/api/grade', async (req, res) => {
  const { id, text } = req.body;
  if (!id || !text?.trim()) return res.status(400).json({ error: 'Type an answer first' });
  try {
    const { spoken } = await gradeAnswer(getSession(id), text.slice(0, 300));
    res.json({ ok: true, spoken });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Grading failed. Try again.' });
  }
});

// Exa the goat: voice question in, written answer out. ?text= skips transcription.
app.post('/api/goat', express.raw({ type: () => true, limit: '6mb' }), async (req, res) => {
  try {
    let question = String(req.query.text || '');
    if (!question && req.body?.length) question = await transcribe(req.body, req.get('content-type'));
    if (!question) return res.json({ question: '', answer: null });
    const session = req.query.id ? getSession(String(req.query.id)) : null;
    res.json(await goatAnswer(session, question.slice(0, 300)));
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'Exa could not fetch a clue. Try again.' });
  }
});

// Vapi tool webhook: always HTTP 200, flat string results.
app.post('/vapi/tools', async (req, res) => {
  const message = req.body?.message;
  if (message?.type !== 'tool-calls') return res.json({});
  const session = sessionForCall(message.call?.id);
  const results = await Promise.all((message.toolCallList || []).map(async (toolCall) => {
    const raw = toolCall.function?.arguments;
    const args = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    try {
      if (toolCall.function?.name === 'grade_answer') {
        return { toolCallId: toolCall.id, result: (await gradeAnswer(session, String(args.kidUtterance || ''))).spoken };
      }
      return { toolCallId: toolCall.id, error: 'Unknown tool' };
    } catch (e) {
      console.error(e);
      return { toolCallId: toolCall.id, result: 'The helper is busy. Encourage the child and ask them to try again.' };
    }
  }));
  res.json({ results });
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.use(express.static(dist));

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`server on http://localhost:${port}`));
