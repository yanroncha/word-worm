/** Every piece of UI text, in one place. */

import type { FailReason, PlayerId } from '../core/types.js';
import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from '../core/rules.js';

export const UI = {
  title: 'Word Worm',
  loading: 'Loading dictionary...',
  loadFailed: 'The dictionary could not be loaded. Run "npm run build:dict" and reload.',

  playerName: (player: PlayerId): string => (player === 'P1' ? 'Player 1' : 'Player 2'),
  turnOf: (player: PlayerId): string => `${UI.playerName(player)} to play`,

  giveUp: 'Give up',
  showNet: 'Unfold',
  showCube: 'Cube',
  newGame: 'New game',
  play: 'Play',
  cancel: 'Cancel',

  seedAppeared: 'Double-tap or press and hold a letter to build from it.',
  pickDirection: 'Pick an arrow to choose which way the word runs.',
  enterWord: (letter: string): string => `Enter a word starting with "${letter.toUpperCase()}".`,
  gaveUp: (player: PlayerId): string => `${UI.playerName(player)} gave up.`,
  onePassLeft: 'One more pass in a row ends the game.',

  wordPlayed: (player: PlayerId, word: string): string =>
    `${UI.playerName(player)} played ${word.toUpperCase()} (+${word.length}).`,

  resultTitle: 'Game over',
  resultWinner: (player: PlayerId): string => `${UI.playerName(player)} wins`,
  resultDraw: 'A draw',
  resultWordsHeading: 'Words played',
  resultNoWords: 'No words were played.',
  letters: (n: number): string => `${n} ${n === 1 ? 'letter' : 'letters'}`,

  failure: (reason: FailReason): string => FAILURE_TEXT[reason],
} as const;

const FAILURE_TEXT: Record<FailReason, string> = {
  INVALID_CHARS: 'Letters only, please.',
  BAD_LENGTH: `Words must be ${MIN_WORD_LENGTH} to ${MAX_WORD_LENGTH} letters long.`,
  NOT_A_WORD: 'Not a word in the dictionary. Plurals and other inflected forms do not count.',
  ALREADY_USED: 'That word is already on the cube.',
  ANCHOR_EMPTY: 'Start from a letter that is already on the cube.',
  ANCHOR_MISMATCH: 'The word has to start with the letter you picked.',
  NOT_PERPENDICULAR: 'A new word must branch off at a right angle.',
  HEAD_COLLISION: 'Another word is directly behind the start of that one.',
  BLOCKED: 'Something is in the way. Words may only cross where the letter is the same.',
  TAIL_COLLISION: 'It has to stop short of the next word, not run into it.',
};
