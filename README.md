# Word Worm

A two-player word game played on the surface of a cube. Each of the six faces is
a 7x7 grid. One letter appears in the middle of one face, and the players take
turns sticking English words onto the cube, each new word branching off an
existing letter at a right angle. Words run around the cube's edges onto the
next face. When both players pass in a row, whoever has laid down more letters
wins.

## Running it

```bash
npm install
```

```bash
npm run build:dict
```

```bash
npm run dev
```

`build:dict` only needs to be run once; it turns the WordNet database into
`public/dict/words.txt.gz`. `npm run build` produces a static site in `dist/`
that needs no server of its own.

```bash
npm test
```

## How a turn goes

1. Drag anywhere to turn the cube. It rotates freely in every direction.
2. Double-tap, or press and hold, a letter already on the cube.
3. Arrows appear beside it, pointing the ways a word may run. Only legal
   directions are offered. Tap one.
4. Type a word into the bar at the bottom. It must start with the letter you
   picked -- that letter is shared, and counts towards your score.
5. **Give up** passes the turn. Two passes in a row end the game.
6. **Unfold** flattens the cube into a cross so the whole board can be seen at
   once; tapping a face there brings it round to the front.

### The rules a word has to satisfy

- 3 to 27 letters (27 is one lap of the cube, less one cell).
- In the dictionary, and not already played.
- Starts on the anchor letter and runs at a right angle to whatever word that
  letter already belongs to.
- Stops short of other words: the cell just before it and the cell just after it
  must both be empty.
- May cross another word where the letter is the same and the two run at right
  angles. Crossed cells are shown in a third colour.
- Running parallel and adjacent to another word is fine.

## What counts as a word

The dictionary is built from WordNet's index files, whose head words are base
forms. Inflections (`cats`, `walked`, `bigger`) are therefore not in it, while
forms that have become words in their own right (`sightseeing`, `running`,
`glasses`) are. Proper nouns are dropped -- WordNet's data files keep the real
capitalisation, so a word that never appears lowercase is a proper noun -- and
then country names are added back, since those are the one kind of proper noun
the game allows.

Judgement calls are settled in `tools/data/allow.txt` and
`tools/data/deny.txt` rather than by changing the filtering. Edit either and
re-run `npm run build:dict`.

The word list is bundled, so the game needs no network once loaded.

## Layout

```
src/
  core/     board, rules and scoring. No Three.js, no DOM -- runs under vitest alone.
    cube.ts   the six faces and their coordinate frames
    walk.ts   moving in a straight line, including around edges
    rules.ts  the one function that decides whether a word may be placed
  dict/     loading the bundled word list
  render/   the cube's face textures, the unfolded net, arrows, camera moves
  input/    drag-vs-tap-vs-hold, and free rotation
  ui/       score bar, word entry, effects, result screen
tools/      build-dict.mjs and its hand-maintained word lists
tests/      geometry, rules and dictionary
```

The cube's geometry is held as 3D lattice coordinates rather than a table of
which face borders which. A cell sits at `2 * (3.5*n + (u-3)*r + (3-v)*p)`, so
one axis is +-7 and the other two are even numbers in [-6, 6]. Stepping over an
edge is then just `pos += dir - normal`, with the face normal and heading
swapping roles. Cell centres are offset by integers while the cube's corners are
at half-integers, so a straight walk can never hit a corner, and every walk
closes after 28 cells across 4 faces. `tests/walk.test.ts` checks that from all
294 cells in all 4 directions.

## Credits

Word list derived from [WordNet](https://wordnet.princeton.edu/) 3.x, Princeton
University. See `public/dict/LICENSE-WordNet.txt`.
