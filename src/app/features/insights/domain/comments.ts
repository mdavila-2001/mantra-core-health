import { hashSeed } from './prng';
import { select, type OpinionFilter } from './opinion';
import type { Mention, MentionKind, Sentiment } from './opinion.data';

/* ============================================================================
    Explorador de comentarios: cada mención con la confianza de su clasificación.
    Por debajo de 0,80 pide revisión humana: el sentimiento lo estima un modelo.
    ========================================================================== */

export const REVIEW_BELOW = 0.8;

/** Confianza de clasificación, estable por mención (0,72 a 0,98). */
export function confidenceOf(m: Pick<Mention, 'id'>): number {
  return 0.72 + (hashSeed(`conf|${m.id}`) % 27) / 100;
}

export interface CommentFilters {
  readonly sentiment: Sentiment | 'all';
  readonly kind: MentionKind | 'all';
  readonly department: string | 'all';
  readonly query: string;
}

export interface CommentRow {
  readonly mention: Mention;
  readonly confidence: number;
  readonly needsReview: boolean;
}

export function commentRows(filter: OpinionFilter, f: CommentFilters): CommentRow[] {
  const q = f.query.trim().toLowerCase();
  return select(filter)
    .filter((m) => (f.sentiment === 'all' || m.sentiment === f.sentiment) && (f.kind === 'all' || m.kind === f.kind) && (f.department === 'all' || m.department === f.department) && (!q || m.text.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.reach - a.reach)
    .map((mention) => {
      const confidence = confidenceOf(mention);
      return { mention, confidence, needsReview: confidence < REVIEW_BELOW };
    });
}
