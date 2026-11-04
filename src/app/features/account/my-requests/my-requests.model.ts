import type {
  MyClaimsView,
  ReceivedClaimOutcome,
} from '../../../core/data-access/insurance/insurance.types';
import type { ViewStateNextAction } from '../../../core/view-state/view-state.types';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';

/**
 * The tabs: what the insurer decided, what it is still deciding, and the
 * care-relationship requests (the former «Buzón de solicitudes», unified here).
 */
export const PESTANAS = [
  'Decisiones de la aseguradora',
  'En espera de decisión',
  'Solicitudes de vínculo',
] as const;
export const PESTANA_DECIDIDAS = 0;
export const PESTANA_VINCULOS = 2;
/** `?pestana=vinculos` opens the care-relationship tab (notification link). */
export const PESTANA_POR_NOMBRE: Readonly<Record<string, number>> = { vinculos: PESTANA_VINCULOS };

/** El dictamen, dicho en palabras y con su sello. */
export const DECISION: Readonly<Record<ReceivedClaimOutcome, { readonly label: string; readonly seal: StatusSealVariant }>> =
  {
    APPROVED: { label: 'Aprobada', seal: 'approved' },
    PARTIAL: { label: 'Aprobada en parte', seal: 'approved' },
    REJECTED: { label: 'Rechazada', seal: 'rejected' },
  };

/** Estado de una solicitud abierta → sello. */
export const SELLO_ABIERTA: Readonly<Record<string, StatusSealVariant>> = {
  SUBMITTED: 'pending',
  IN_REVIEW: 'in-review',
};

export const PERIODOS: readonly { readonly value: string; readonly label: string; readonly dias: number }[] = [
  { value: '30', label: 'Últimos 30 días', dias: 30 },
  { value: '90', label: 'Últimos 90 días', dias: 90 },
  { value: '180', label: 'Últimos 180 días', dias: 180 },
];

export const SUBTITULO: Readonly<Record<MyClaimsView, string>> = {
  PATIENT: 'Lo que su aseguradora decidió sobre sus consultas y estudios: si los cubre, cuánto y por qué.',
  PRACTITIONER: 'Lo que las aseguradoras decidieron sobre las atenciones que presentó: cuánto cubren y por qué.',
  LABORATORY: 'Lo que las aseguradoras decidieron sobre los análisis que hizo su laboratorio.',
  IMAGING: 'Lo que las aseguradoras decidieron sobre los estudios de imagen que hizo su centro.',
  NONE: 'Las solicitudes a aseguradoras y lo que cada una decidió.',
};

/** El vacío de cada pestaña, según de qué lado mira la cuenta. */
export function vacioDe(vista: MyClaimsView, pestana: number): { readonly accion: ViewStateNextAction; readonly texto: string } {
  const panel: ViewStateNextAction = { label: 'Volver al panel', route: '/dashboard' };
  if (vista === 'NONE') {
    return { accion: panel, texto: 'Su cuenta no presenta solicitudes a aseguradoras, así que no hay decisiones que mostrar.' };
  }
  if (pestana === PESTANA_DECIDIDAS) {
    return {
      accion: panel,
      texto:
        'Todavía no hay decisiones de la aseguradora. Cuando apruebe, apruebe en parte o rechace una solicitud, aparece acá con su motivo.',
    };
  }
  return { accion: panel, texto: 'No hay solicitudes esperando decisión: la aseguradora ya respondió todas.' };
}
