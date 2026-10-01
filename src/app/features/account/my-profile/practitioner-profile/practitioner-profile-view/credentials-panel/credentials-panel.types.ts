import type { NavIconName } from '../../../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { StatusSealVariant } from '../../../../../../shared/components/organisms/status-seal/status-seal.types';

/** Las cuatro clases de credencial que la ficha del médico conoce. */
export const CREDENTIAL_KINDS = ['license', 'specialty', 'education', 'language'] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

/**
 * Qué ícono le toca a cada clase.
 *
 * Uno por clase y ninguno repetido: la regla del set (`nav-icon.types.ts`) es
 * que un ícono aporte algo que su etiqueta no diga ya, y el reconocimiento es
 * lo único que aporta. El escudo es la habilitación —lo que te deja ejercer—,
 * el estetoscopio la especialidad, el libro la formación y el globo el idioma.
 */
export const CREDENTIAL_ICONS: Readonly<Record<CredentialKind, NavIconName>> = {
  license: 'shield',
  specialty: 'stethoscope',
  education: 'book',
  language: 'globe',
} as const;

/**
 * El encabezado del bloque de cada clase, en plural: es el nombre de la lista,
 * no de una tarjeta.
 */
export const CREDENTIAL_GROUP_LABELS: Readonly<Record<CredentialKind, string>> = {
  license: 'Matrículas',
  specialty: 'Especialidades',
  education: 'Títulos y formación',
  language: 'Idiomas',
} as const;

/**
 * Una credencial lista para pintarse como tarjeta.
 *
 * Es la forma que la rejilla necesita, no la del backend: las cuatro listas
 * que la pestaña mostraba —matrículas, especialidades, idiomas y títulos—
 * responden todas la misma pregunta («¿qué respalda a esta persona?») y se
 * leían como cuatro pantallas apiladas.
 */
export interface CredencialEnTarjeta {
  readonly id: string;
  readonly clase: CredentialKind;
  /** El nombre propio: «Santa Cruz», «Cardiología», «Medicina», «Quechua». */
  readonly titulo: string;
  /** Renglones de detalle, ya armados. Los vacíos no se pasan. */
  readonly detalles: readonly string[];
  /** El sello del trámite, o `null` cuando la clase no tramita nada. */
  readonly sello: { readonly variant: StatusSealVariant; readonly label: string } | null;
  /** Contra qué se comprobó. Sólo lo tiene lo verificado. */
  readonly fuente: string | null;
  /** Si pasó por una verificación contra una fuente. Decide el filtro. */
  readonly verificada: boolean;
}

/** Los tres cortes de la barra de filtro. */
export type CredentialFilter = 'all' | 'verified' | 'declared';
