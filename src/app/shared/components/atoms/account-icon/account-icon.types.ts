/**
 * Los tipos de cuenta que la plataforma da de alta **sin intervención de nadie**.
 *
 * Cerrado a propósito, igual que `NavIconName`: un string libre acabaría en un
 * nombre que no existe y en una tarjeta muda. Y cerrado por otra razón, que es
 * la que importa acá: cada uno de estos tres tiene un alta pública de verdad
 * detrás (`register-patient`, `register-practitioner`, `register-organization`).
 * Agregar un cuarto ícono sin su alta sería prometer una puerta que no abre.
 */
export const ACCOUNT_ICON_NAMES = ['patient', 'practitioner', 'insurer'] as const;

export type AccountIconName = (typeof ACCOUNT_ICON_NAMES)[number];
