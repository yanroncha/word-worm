#!/usr/bin/env node
/**
 * Builds the game dictionary from the WordNet database files.
 *
 *   node tools/build-dict.mjs [--dict <path to WordNet dict dir>]
 *
 * Why WordNet: its `index.*` files list head words in base form only. Regular
 * inflections (cats, walked, walks) simply are not in there, so the game's "no
 * inflected forms" rule mostly falls out of dictionary membership with no
 * stemming at runtime. Words that have become established in their own right --
 * sightseeing being the spec's own example -- do have their own entry and so
 * are accepted.
 *
 * Two things WordNet does not hand us for free, both dealt with below:
 *
 *   1. Proper nouns. The index files are lowercased, so france/einstein/paris
 *      sit alongside common nouns. The *data* files keep the real spelling, so a
 *      lemma that never once appears lowercase is a proper noun and is dropped.
 *      Country names are then added back from data/countries.txt, per the rule
 *      that proper nouns count only for countries.
 *
 *   2. Comparatives and superlatives. WordNet does record a few of these as
 *      satellite adjectives (bigger, greatest, older). They are caught by
 *      de-inflecting adjective-only lemmas ending in -er/-est and checking
 *      whether the result is itself an adjective.
 *
 * Deliberately NOT done: a general "reject -ing/-ed words whose stem is also a
 * word" rule. It would reject sightseeing (sightsee is a WordNet verb) and
 * break the very requirement it was meant to serve. The -er/-est check above is
 * narrow on purpose, and its two known false positives (modest, outer) are
 * handled by data/allow.txt rather than by widening the logic.
 *
 * Output: public/dict/words.txt.gz plus a small manifest the loader checks.
 */

import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DATA_DIR = path.join(HERE, 'data');
const OUT_DIR = path.join(ROOT, 'public', 'dict');

/** Matches the game's own limits: 3..27 letters, a-z only. */
const MIN_LENGTH = 3;
const MAX_LENGTH = 27;
const WORD_RE = new RegExp(`^[a-z]{${MIN_LENGTH},${MAX_LENGTH}}$`);

const PARTS = ['noun', 'verb', 'adj', 'adv'];

function fail(message) {
  console.error(`build-dict: ${message}`);
  process.exit(1);
}

function locateWordNetDict() {
  const flagIndex = process.argv.indexOf('--dict');
  if (flagIndex !== -1) {
    const dir = process.argv[flagIndex + 1];
    if (!dir) fail('--dict needs a directory path');
    return path.resolve(dir);
  }
  if (process.env.WORDNET_DICT) return path.resolve(process.env.WORDNET_DICT);

  // wordnet-db ships the WordNet database files and exposes their directory.
  try {
    const db = createRequire(import.meta.url)('wordnet-db');
    if (db?.path) return db.path;
  } catch {
    /* not installed */
  }

  fail(
    'Could not find the WordNet database files.\n' +
      '  Either:  npm install --save-dev wordnet-db\n' +
      '  Or:      node tools/build-dict.mjs --dict <path to a WordNet dict directory>\n' +
      '  (the directory holding index.noun, data.noun, index.verb, ...)',
  );
}

function readLines(file) {
  return fs.readFileSync(file, 'latin1').split('\n');
}

/** WordNet files open with a licence header whose lines all begin with a space. */
const isHeader = (line) => line.startsWith(' ') || line.trim() === '';

/** Head words of one index file. These are already lowercase. */
function readIndexLemmas(file) {
  const lemmas = new Set();
  for (const line of readLines(file)) {
    if (isHeader(line)) continue;
    const lemma = line.split(' ')[0];
    if (lemma) lemmas.add(lemma);
  }
  return lemmas;
}

/**
 * Lemmas that appear at least once in their true, lowercase spelling in a data
 * file. Anything in the index but missing here only ever occurs capitalised,
 * which is what makes it a proper noun.
 */
function readLowercaseLemmas(file, into) {
  for (const line of readLines(file)) {
    if (isHeader(line)) continue;
    const head = line.split('|')[0];
    const tokens = head.trim().split(/\s+/);
    // offset lex_filenum ss_type w_cnt (word lex_id)*
    const wordCount = Number.parseInt(tokens[3] ?? '', 16);
    if (!Number.isFinite(wordCount)) continue;
    for (let i = 0; i < wordCount; i++) {
      const raw = tokens[4 + i * 2];
      if (!raw) continue;
      // Adjectives may carry a syntactic marker such as "big(p)".
      const word = raw.replace(/\(.*\)$/, '');
      if (word && word === word.toLowerCase()) into.add(word);
    }
  }
  return into;
}

/** Plausible base forms of a comparative or superlative. */
function comparativeBases(word) {
  const out = [];
  for (const suffix of ['er', 'est']) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    out.push(stem); // taller  -> tall
    out.push(stem + 'e'); // nicer   -> nice
    if (stem.endsWith('i')) out.push(stem.slice(0, -1) + 'y'); // happier -> happy
    if (/(.)\1$/.test(stem)) out.push(stem.slice(0, -1)); // bigger  -> big
  }
  return out;
}

function readWordList(name, { required = false } = {}) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) {
    if (required) fail(`missing required data file: ${file}`);
    return [];
  }
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.split('#')[0].trim().toLowerCase())
    .filter(Boolean);
}

function main() {
  const dictDir = locateWordNetDict();
  for (const part of PARTS) {
    for (const kind of ['index', 'data']) {
      const file = path.join(dictDir, `${kind}.${part}`);
      if (!fs.existsSync(file)) fail(`missing ${kind}.${part} in ${dictDir}`);
    }
  }
  console.log(`build-dict: reading WordNet from ${dictDir}`);

  const index = {};
  const lowercaseLemmas = new Set();
  for (const part of PARTS) {
    index[part] = readIndexLemmas(path.join(dictDir, `index.${part}`));
    readLowercaseLemmas(path.join(dictDir, `data.${part}`), lowercaseLemmas);
  }

  const words = new Set();
  const stats = { seen: 0, shape: 0, properNouns: 0, comparatives: 0 };

  for (const part of PARTS) {
    for (const lemma of index[part]) {
      stats.seen++;
      if (!WORD_RE.test(lemma)) {
        stats.shape++;
        continue;
      }
      if (!lowercaseLemmas.has(lemma)) {
        stats.properNouns++;
        continue;
      }
      const adjectiveOnly =
        part === 'adj' &&
        !index.noun.has(lemma) &&
        !index.verb.has(lemma) &&
        !index.adv.has(lemma);
      if (adjectiveOnly && comparativeBases(lemma).some((base) => index.adj.has(base))) {
        stats.comparatives++;
        continue;
      }
      words.add(lemma);
    }
  }

  const fromWordNet = words.size;

  const countries = readWordList('countries.txt', { required: true });
  for (const name of countries) if (WORD_RE.test(name)) words.add(name);

  const allow = readWordList('allow.txt');
  for (const word of allow) if (WORD_RE.test(word)) words.add(word);

  const deny = readWordList('deny.txt');
  let denied = 0;
  for (const word of deny) if (words.delete(word)) denied++;

  const sorted = [...words].sort();
  const gz = gzipSync(Buffer.from(sorted.join('\n') + '\n', 'utf8'), { level: 9 });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'words.txt.gz'), gz);
  fs.writeFileSync(
    path.join(OUT_DIR, 'words.manifest.json'),
    JSON.stringify(
      {
        source: 'WordNet (Princeton University) index files, base forms only',
        count: sorted.length,
        minLength: MIN_LENGTH,
        maxLength: MAX_LENGTH,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  console.log(
    [
      `  index entries seen  ${stats.seen}`,
      `  rejected by shape   ${stats.shape}  (length, hyphens, multi-word, digits)`,
      `  proper nouns cut    ${stats.properNouns}  (never appear lowercase)`,
      `  comparatives cut    ${stats.comparatives}`,
      `  after WordNet       ${fromWordNet}`,
      `  countries added     ${countries.length}`,
      `  allow.txt added     ${allow.length}`,
      `  deny.txt removed    ${denied}`,
      `  FINAL               ${sorted.length} words`,
      `  written             public/dict/words.txt.gz (${(gz.length / 1024).toFixed(0)} KB)`,
    ].join('\n'),
  );
}

main();
