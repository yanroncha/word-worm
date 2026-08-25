/** Colours shared by the cube textures and the unfolded net, so the two agree. */

export const PALETTE = {
  faceEmpty: '#f4f0e6',
  faceEdge: '#2b2b2b',
  gridLine: '#d8d0bd',

  p1Fill: '#cfe4f7',
  p2Fill: '#f8dcd0',
  sharedFill: '#e0d6f2',
  seedFill: '#b4232a',

  letter: '#22201c',
  seedLetter: '#f6c453',

  wordBorder: '#2b2b2b',
  selection: '#f6c453',
  error: '#d64545',

  /** For the face captions in the net view, which sit on the dark page. */
  caption: '#a49c8d',
} as const;
