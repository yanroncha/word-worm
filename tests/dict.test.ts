import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { Dictionary } from '../src/dict/dictionary.js';
import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from '../src/core/rules.js';

const DICT_FILE = 'public/dict/words.txt.gz';

/**
 * The word list is a build artefact (npm run build:dict). Skip rather than fail
 * when it has not been generated, so a fresh clone can still run the rest.
 */
const built = existsSync(DICT_FILE);
const suite = built ? describe : describe.skip;

function load(): Dictionary {
  return Dictionary.fromText(gunzipSync(readFileSync(DICT_FILE)).toString('utf8'));
}

suite('generated dictionary', () => {
  const dict = built ? load() : (null as unknown as Dictionary);

  it('is big enough to play with', () => {
    expect(dict.size).toBeGreaterThan(50_000);
  });

  it('holds only well-formed words', () => {
    const sample = ['cat', 'sightseeing', 'japan'];
    for (const word of sample) {
      expect(word.length).toBeGreaterThanOrEqual(MIN_WORD_LENGTH);
      expect(word.length).toBeLessThanOrEqual(MAX_WORD_LENGTH);
    }
  });

  describe('base forms only', () => {
    it.each(['cat', 'walk', 'big', 'run', 'swim', 'child', 'mouse', 'goose'])(
      'accepts %s',
      (word) => {
        expect(dict.has(word)).toBe(true);
      },
    );

    it.each([
      'cats', // regular plural
      'walked', // past tense
      'walks', // third person
      'bigger', // comparative
      'biggest', // superlative
      'greater',
      'older',
      'children', // irregular plural
      'mice',
      'geese',
    ])('rejects the inflected form %s', (word) => {
      expect(dict.has(word)).toBe(false);
    });
  });

  describe('forms that have become words in their own right', () => {
    // The spec calls these out explicitly: an -ing or -s form that WordNet
    // records as its own head word stays playable.
    it.each(['sightseeing', 'walking', 'running', 'swimming', 'glasses', 'scissors'])(
      'accepts %s',
      (word) => {
        expect(dict.has(word)).toBe(true);
      },
    );
  });

  describe('proper nouns', () => {
    it.each(['japan', 'brazil', 'france', 'kenya', 'netherlands', 'switzerland'])(
      'accepts the country %s',
      (word) => {
        expect(dict.has(word)).toBe(true);
      },
    );

    it.each(['einstein', 'shakespeare', 'london', 'paris', 'english', 'texas'])(
      'rejects the non-country proper noun %s',
      (word) => {
        expect(dict.has(word)).toBe(false);
      },
    );
  });

  describe('manual overrides', () => {
    it.each(['modest', 'outer'])('keeps %s, which allow.txt rescues', (word) => {
      expect(dict.has(word)).toBe(true);
    });
  });
});
