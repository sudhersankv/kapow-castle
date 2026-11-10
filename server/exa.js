const DOMAINS = ['britannica.com', 'kids.nationalgeographic.com', 'nasa.gov', 'khanacademy.org', 'wikipedia.org'];

const KID_SUMMARY = (question) => `Answer this question for a 9 year old in two short, friendly sentences with simple words: "${question}". Keep it gentle and age-appropriate, with no violence or scary details.`;

async function search(body) {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': process.env.EXA_API_KEY, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(9000),
    body: JSON.stringify({ type: 'auto', numResults: 3, includeDomains: DOMAINS, ...body }),
  });
  if (!res.ok) throw new Error(`exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).results || [];
}

const domainOf = (url) => new URL(url).hostname.replace(/^www\./, '');

// Raw highlights for a character to rephrase in its own voice.
export async function searchClue(question, subject) {
  const results = await search({
    query: `${question} (${subject}, explained for kids)`,
    contents: { highlights: { maxCharacters: 400 } },
  });
  const top = results.find((r) => r.highlights?.length);
  return top ? { text: top.highlights.join(' '), domain: domainOf(top.url) } : null;
}

// A kid-friendly written answer for Exa the goat's pop-ups.
export async function searchKidAnswer(question, subject) {
  const results = await search({
    query: `${question} (${subject}, explained for kids)`,
    contents: { summary: { query: KID_SUMMARY(question) } },
  });
  const top = results.find((r) => r.summary);
  return top ? { text: top.summary, domain: domainOf(top.url) } : null;
}
