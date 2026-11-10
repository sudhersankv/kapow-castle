export const NPCS = {
  sumi: {
    subject: 'math',
    lesson: 'Times tables are just fast adding, and division is sharing things into equal groups.',
    puzzles: [
      { question: 'What is 7 times 6?', expected: '42', aliases: ['42', 'forty two', 'forty-two'], choices: ['36', '42', '48'], hint: 'Try counting up by sevens, six times.' },
      { question: 'What is half of 30?', expected: '15', aliases: ['15', 'fifteen'], choices: ['10', '15', '20'], hint: 'Split 30 into two equal piles.' },
      { question: 'What is 24 divided by 4?', expected: '6', aliases: ['6', 'six'], choices: ['4', '6', '8'], hint: 'How many fours fit inside 24?' },
    ],
  },
  quill: {
    subject: 'history of Genghis Khan',
    lesson: 'Long ago on the grassy steppe of Mongolia, a boy named Temujin grew up in a round felt tent called a ger. Life was hard, but he learned to ride and made loyal friends.',
    puzzles: [
      { question: 'What was Genghis Khan called when he was a boy?', expected: 'Temujin', aliases: ['temujin', 'temuchin', 'tamujin', 'temu jin', 'temoojin', 'timujin'], choices: ['Temujin', 'Kublai', 'Marco'], hint: 'Listen for the name that starts with T.' },
      { question: 'What is a round felt Mongolian tent called?', expected: 'a ger, also known as a yurt', aliases: ['ger', 'yurt', 'gear'], choices: ['Igloo', 'Ger', 'Cabin'], hint: 'It is a short word that rhymes with air.' },
    ],
  },
  tolu: {
    subject: 'history of Genghis Khan',
    lesson: 'The tribes of the steppe often fought each other. In 1206 Temujin brought them together and was given the title Genghis Khan, often translated as universal ruler.',
    puzzles: [
      { question: 'Genghis Khan united the tribes of which land?', expected: 'Mongolia', aliases: ['mongolia', 'mongol', 'mongols', 'mongolian'], choices: ['Egypt', 'Peru', 'Mongolia'], hint: 'You are standing on its grassy steppe right now.' },
      { question: 'Which animal did Mongol riders travel on across the steppe?', expected: 'horses', aliases: ['horse'], choices: ['Horses', 'Camels', 'Elephants'], hint: 'It gallops and goes neigh.' },
    ],
  },
  sarnai: {
    subject: 'history of Genghis Khan',
    lesson: 'The Mongols built the Yam, a chain of relay stations where messengers swapped to fresh horses, so news raced across the empire. Traders on the Silk Road became safer too.',
    puzzles: [
      { question: 'What was the Mongol messenger relay system called?', expected: 'the Yam', aliases: ['yam', 'ortoo'], choices: ['The Yam', 'The Metro', 'The Mailbox'], hint: 'It sounds like a sweet orange vegetable.' },
      { question: 'Which famous trade route became safer under Mongol rule?', expected: 'the Silk Road', aliases: ['silk road', 'silk route'], choices: ['Silk Road', 'Route 66', 'Autobahn'], hint: 'It is named after a soft, shiny cloth.' },
    ],
  },
};

export function getPuzzle(npcId, index) {
  return NPCS[npcId]?.puzzles[index] || null;
}

export function publicPuzzle(npcId, index) {
  const puzzle = getPuzzle(npcId, index);
  return puzzle ? { question: puzzle.question, choices: puzzle.choices } : null;
}
