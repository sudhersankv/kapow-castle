# Kapow Castle

A voice-first 3D learning game for kids aged 7 to 11. Walk through a castle, talk to its characters, and solve spoken puzzles to unlock each new stage. Built on the memory palace idea: knowledge sticks better when it is attached to a place.

Play it: https://kapow-castle.fly.dev (Chrome, with microphone access)

Two example subjects are included: Math Hall and a three-stage Genghis Khan tour.

## How it works

| Piece | Job |
|---|---|
| [Vapi](https://vapi.ai) | Runs each character's live voice conversation, using one assistant with per-character overrides |
| [Deepgram](https://deepgram.com) | Nova-3 speech recognition and a distinct Aura-2 voice for each character |
| [Jev by TypeSafe](https://typesafe.ai) | Referee for everything the child says: answer, doubt, skip or off topic, plus whether it is correct |
| [Exa](https://exa.ai) | Exa the goat answers questions from kid-safe sources and only hints at the current puzzle |
| [Three.js](https://threejs.org) | The castle, characters and effects, all rendered in the browser |
| [Fly.io](https://fly.io) | Hosts the game and the Vapi tool server |

"Make your own castle", which would turn a recording or link into a game, is a design preview and is not connected yet.

## Run it locally

Requires Node 22.

```
npm install
cp .env.example .env    # add your Vapi, Exa, TypeSafe and Deepgram keys
npm run setup:vapi      # creates the Vapi tool and assistant
npm run dev
```

Vapi calls its tool at `PUBLIC_URL`, so voice grading needs the server deployed or tunneled. Deploy with `npm run ship`.
