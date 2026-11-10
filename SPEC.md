# Kapow Castle

A 3D voice learning game for kids, in the browser. Free-roam a floating memory castle, walk up to a character, and beat their puzzle shield by answering out loud or by typing. Pitch hook: the method of loci, where knowledge is attached to places.

Genre reference only: over-the-shoulder 3D arena game with big HUD bars. All characters, names, art and UI are original.

## Core loop
1. Roam (WASD/arrows, third-person chase camera). Stages: Math Hall, then a three-stage Genghis Khan tour. Each stage teaches a short lesson; its quiz opens the gate to the next stage. Any topic could slot in later; these are the two examples.
2. Near a character: "Press Space to talk".
3. Space starts a Vapi web call with that character's persona. The camera moves over the shoulder and the duel HUD appears.
4. Character asks one short puzzle. The kid answers by voice, or types (typing also works if voice fails).
5. Correct answer: the power bar charges, a blast breaks the puzzle shield, and the kid earns a star. `power` scales the blast.
6. Wrong answer: a hint, never a scolding. Shield holds.
7. Doubt ("what's a volcano?"): Exa the goat trots in and gives a simple clue from a real source.
8. Enough stars opens the next room's door. Ending the call returns to roaming.

## Characters
| Id | Name | Room | Personality |
|---|---|---|---|
| sumi | Sumi the Abacus Knight | Math Hall | Brave, counts everything |
| quill | Old Quill | Steppe stage 1: young Temujin | Owl storyteller, tour guide |
| tolu | Tolu the Ger Builder | Steppe stage 2: uniting the tribes | Warm, proud, hammers while talking |
| sarnai | Sarnai the Rider | Steppe stage 3: the Yam and Silk Road | Fast-talking relay messenger |
| exa | Exa the Goat | Companion | Curious, follows the player, fetches clues |

## NPC persona template (one Vapi assistant)
Called with `vapi.start(assistantId, { variableValues: { npcName, subject, personality, puzzleSeed, npcId } })`. The system prompt and first message use `{{npcName}}` etc.

Prompt rules: speaking to a child aged 7 to 11. One short puzzle at a time. Replies under 2 sentences. Always call `grade_answer` when the kid attempts an answer. Always call `ask_goat` when the kid asks a doubt, then rephrase simply; never read results aloud. Wrong answers get a hint. No scary, violent or adult content.

Vapi config: transcriber `{ provider: "deepgram", model: "nova-3" }`, voice `{ provider: "deepgram", voiceId: "asteria" }`.

## Tools (Vapi function tools, `server.url` = `<PUBLIC_URL>/vapi/tools`)
Vapi POSTs `message.type === "tool-calls"` with `message.toolCallList[]` and `message.call.id`. Reply HTTP 200 with `{ "results": [{ "toolCallId", "result": "<flat string>" }] }`.

- `grade_answer({ npcId, puzzle, expected, kidUtterance })`
- `ask_goat({ question, subject })`

## Jev referee
`POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer`, `model: "jev-latest"`, with `state` holding puzzle, expected answer and utterance.

| Question | Type | Maps to |
|---|---|---|
| intent | choice: answer, doubt, skip | `intent` |
| correct | noul | `correct = noul > 0.5` |
| confidence_of_answer | score | `power` 0 to 1 |

App interface, stable across providers: `{ intent, correct, power, feedback }`.
Jev returns typed decisions and no prose, so `feedback` comes from a server template. If Jev blocks us for more than 10 minutes, swap `server/referee.js` to a plain LLM JSON call behind the same interface.

## Exa clue tool
`POST https://api.exa.ai/search`, header `x-api-key`.
`{ query, type: "auto", numResults: 3, includeDomains: ["britannica.com","kids.nationalgeographic.com","nasa.gov","khanacademy.org","wikipedia.org"], contents: { highlights: { maxCharacters: 400 } } }`.
Returns short highlights plus source title to the character, who rephrases. The goat shows the source name in a speech bubble.

## Getting tool results into the game
The server stores events by Vapi call id. The client polls `GET /api/events?callId=` during a call and applies stars, blasts and goat clues. Typed answers call `POST /api/grade` directly and use the same event path.

## Failure rules
A call failure shows a toast and returns to roaming. Typed answers keep the puzzle playable with no voice. Exa or Jev failure returns a friendly fallback string, so the call never hangs.

## File layout
```
client/   Vite + Three.js: index.html, src/{main,world,player,npcs,hud,voice,duel}.js
server/   Express: index.js, referee.js, exa.js, events.js, puzzles.js
scripts/  setup-vapi.mjs (creates tools and assistant through the Vapi API)
Dockerfile, fly.toml  one Fly app serving API and built client over HTTPS
```

## Art direction
Cool, funky, loud color: anime-arena energy with our own shapes. A floating castle under a saturated sunset, with magenta-orange skies, sandstone mesas, and chunky cel-shaded characters with inked outlines. Over-the-shoulder duel camera, thick vivid HUD bars in castle-battlement frames, character portraits in the corners, big comic numbers and KAPOW bursts popping off every correct answer. Type: Lilita One for display, Atkinson Hyperlegible for reading. Signature moment: the spoken answer charges the bar and shatters the puzzle shield into stars.

## Build order
0. Spec. 1. Vapi hello-world. 2. 3D world and movement. 3. Space starts a persona call. 4. Referee, stars, door, goat. 5. Stretch: Librarian spawns a topic character. Feature freeze 7:05pm.
