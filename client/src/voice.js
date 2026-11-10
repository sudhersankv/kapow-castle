import Vapi from '@vapi-ai/web';

let vapi;
let assistantId;

export async function initVoice(handlers = {}) {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Server config is unavailable');
  const config = await res.json();
  if (!config.publicKey || !config.assistantId) throw new Error('Vapi keys are missing on the server');
  assistantId = config.assistantId;
  vapi = new Vapi(config.publicKey);
  for (const [event, fn] of Object.entries(handlers)) vapi.on(event, fn);
}

export const voiceReady = () => Boolean(vapi);

// Returns the call object, whose id links server tool events to this call.
export function startCall(variableValues, voiceId) {
  return vapi.start(assistantId, { variableValues, voice: { provider: 'deepgram', voiceId, model: 'aura-2' } });
}

export function endCall() {
  try {
    vapi?.stop();
  } catch (e) {
    console.warn(e);
  }
}

export function muteCall(muted) {
  try {
    vapi?.setMuted(muted);
  } catch (e) {
    console.warn(e);
  }
}

// Records one short clip. Call stop() to finish early; done resolves with the audio.
export async function startRecording(maxMs) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  const stop = () => {
    clearTimeout(timer);
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const timer = setTimeout(stop, maxMs);
  recorder.start();
  return { stop, done };
}

// Tells the character what happened when the child tapped or typed.
export function tellCharacter(content) {
  vapi?.send({ type: 'add-message', message: { role: 'system', content }, triggerResponseEnabled: true });
}
