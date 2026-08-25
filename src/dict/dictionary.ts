/**
 * The playable word list.
 *
 * Built ahead of time by tools/build-dict.mjs from WordNet's index files, which
 * hold base forms only -- so inflected forms are absent by construction and no
 * stemming happens at runtime. Lookup is a Set hit: synchronous, offline and
 * the same answer every time.
 */

import type { WordSource } from '../core/rules.js';

export const DEFAULT_DICT_URL = 'dict/words.txt.gz';

export class Dictionary implements WordSource {
  private constructor(private readonly words: ReadonlySet<string>) {}

  static fromText(text: string): Dictionary {
    const words = new Set<string>();
    for (const line of text.split('\n')) {
      const word = line.trim();
      if (word) words.add(word);
    }
    return new Dictionary(words);
  }

  /**
   * Fetches the bundled list.
   *
   * Whether the bytes still need gunzipping depends on the server: some send
   * a .gz file as-is, others (Vite's dev server among them) label it
   * `Content-Encoding: gzip`, in which case the browser has already expanded it
   * by the time we see it. Rather than guess, sniff the gzip magic number and
   * only decompress when it is actually there.
   */
  static async load(url: string = DEFAULT_DICT_URL): Promise<Dictionary> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`could not load the dictionary (${response.status} from ${url})`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error('the dictionary file is empty');

    const isGzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!isGzipped) return Dictionary.fromText(new TextDecoder().decode(bytes));

    if (typeof DecompressionStream === 'undefined') {
      throw new Error('this browser cannot gunzip the dictionary (no DecompressionStream)');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return Dictionary.fromText(await new Response(stream).text());
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  get size(): number {
    return this.words.size;
  }
}
