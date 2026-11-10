// Transcribes a short recorded question with Deepgram.
export async function transcribe(audio, contentType) {
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', {
    method: 'POST',
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, 'Content-Type': contentType || 'audio/webm' },
    body: audio,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`deepgram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
}
