/* ============================================================================
    Contrato del menú de preferencias de una publicación.

    Las siete entradas están fijadas por el pedido del propietario (AC-01-15) y
    son **exactamente** siete: ni una de más ni una de menos. Por eso viven en
    una constante y no sueltas en la plantilla — así una prueba puede afirmar la
    lista entera y fallar si alguien agrega la octava sin discutirlo.
    ========================================================================== */

/**
 * Qué hace falta para poder ofrecer una entrada.
 *
 * - `public`: cualquiera, con o sin sesión.
 * - `session`: exige sesión. Sin ella la entrada **no se esconde**: se ofrece y
 *   lleva a `/auth` con retorno (AC-01-17). Esconderla dejaría a alguien sin
 *   sesión sin saber que denunciar existe.
 */
export type PostPreferenceAccess = 'public' | 'session';

/** Qué hace la entrada al activarse. Es un dato, no un `switch` en la vista. */
export type PostPreferenceAction =
  | 'hideSimilar'
  | 'report'
  | 'openPost'
  | 'share'
  | 'copyLink'
  | 'contactPractitioner'
  | 'openProfile';

import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

export interface PostPreferenceEntry {
  readonly action: PostPreferenceAction;
  /** Toda opción de desplegable lleva ícono (propietario, 2026-09-24). */
  readonly icon: NavIconName;
  /** El texto en castellano, tal como lo pidió el propietario. */
  readonly label: string;
  readonly access: PostPreferenceAccess;
}

/**
 * Las siete entradas, en el orden del pedido.
 *
 * El orden no es alfabético ni por frecuencia: es el que el propietario
 * escribió, y cambiarlo por criterio propio es cambiar el pedido.
 */
export const POST_PREFERENCE_ENTRIES: readonly PostPreferenceEntry[] = [
  { action: 'hideSimilar', icon: 'eye-off', label: 'No ver más este tipo de publicaciones', access: 'session' },
  { action: 'report', icon: 'flag', label: 'Denunciar', access: 'session' },
  { action: 'openPost', icon: 'arrow-right', label: 'Ir a la publicación', access: 'public' },
  { action: 'share', icon: 'share', label: 'Compartir', access: 'public' },
  { action: 'copyLink', icon: 'link', label: 'Copiar enlace', access: 'public' },
  { action: 'contactPractitioner', icon: 'chat', label: 'Contactarme con este doctor', access: 'session' },
  { action: 'openProfile', icon: 'patients', label: 'Ir al perfil del doctor', access: 'public' },
] as const;
