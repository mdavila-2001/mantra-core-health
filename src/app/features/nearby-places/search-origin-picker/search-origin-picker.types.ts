/** De dónde sale el punto que se usa para medir «lo más cerca» (FT-19 · B.2). */
export type SearchOriginSource = 'home' | 'work' | 'current';

/** El origen elegido, ya resuelto a un punto consultable. */
export interface SearchOrigin {
  readonly source: SearchOriginSource;
  readonly lat: number;
  readonly lng: number;
}
