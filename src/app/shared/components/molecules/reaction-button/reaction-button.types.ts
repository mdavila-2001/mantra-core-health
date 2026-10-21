import type { ReactionType } from '@core/data-access/community/community.types';

/** Una reacción como se ofrece: su código del contrato, su rótulo y su ícono. */
export interface ReaccionOfrecida {
  readonly tipo: ReactionType;
  readonly rotulo: string;
  /** Decorativo (`aria-hidden`): el significado lo da el rótulo. */
  readonly emoji: string;
}

/**
 * Las cinco reacciones del modelo (`REACTION_TYPES`), en el orden en que se
 * ofrecen. Los rótulos están de usted y son cortos: el selector los muestra
 * debajo de cada ícono y en 390 px no entra una frase.
 *
 * El primero, `LIKE`, es el que pone el toque simple sobre el botón.
 */
export const REACCIONES_OFRECIDAS: readonly ReaccionOfrecida[] = [
  { tipo: 'LIKE', rotulo: 'Recomendar', emoji: '👍' },
  { tipo: 'LOVE', rotulo: 'Me encanta', emoji: '❤️' },
  { tipo: 'INSIGHTFUL', rotulo: 'Interesante', emoji: '💡' },
  { tipo: 'CELEBRATE', rotulo: 'Celebro', emoji: '🎉' },
  { tipo: 'SUPPORT', rotulo: 'Apoyo', emoji: '🤝' },
];

/** La reacción ofrecida para un tipo del contrato. */
export function reaccionOfrecida(tipo: ReactionType): ReaccionOfrecida {
  return REACCIONES_OFRECIDAS.find((r) => r.tipo === tipo) ?? REACCIONES_OFRECIDAS[0]!;
}
