import type {
  Referral,
  ReferralStatus,
  ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import type { Tone } from '../../../../shared/components/tone/tone.types';

/**
 * Cómo se llama cada tipo de derivación, en el vocabulario de quien deriva, y
 * una línea que lo distingue de los vecinos.
 */
export const ETIQUETA_DE_TIPO: Readonly<Record<ReferralType, string>> = {
  CONSULTATION: 'Consulta o atención',
  TREATMENT: 'Tratamiento',
  PROCEDURE: 'Procedimiento',
  DIAGNOSTIC: 'Estudio o análisis',
  THERAPY: 'Terapia',
  HOSPITALIZATION: 'Internación',
  OTHER: 'Otro',
};

/** Ejemplo del servicio pedido según el tipo: es el placeholder del campo. */
export const EJEMPLO_DE_SERVICIO: Readonly<Record<ReferralType, string>> = {
  CONSULTATION: 'Ej.: Interconsulta con endocrinología',
  TREATMENT: 'Ej.: Hemodiálisis tres veces por semana',
  PROCEDURE: 'Ej.: Colonoscopia diagnóstica',
  DIAGNOSTIC: 'Ej.: Perfil lipídico y HbA1c',
  THERAPY: 'Ej.: Fisioterapia de rodilla, 10 sesiones',
  HOSPITALIZATION: 'Ej.: Internación en medicina interna para compensación',
  OTHER: 'Ej.: Valoración nutricional',
};

/** El estado, en palabras y con su tono. El tono nunca va solo: va con el texto. */
export const ESTADO_DE_DERIVACION: Readonly<
  Record<ReferralStatus, { readonly etiqueta: string; readonly tono: Tone }>
> = {
  PENDING: { etiqueta: 'Pendiente', tono: 'warning' },
  ACCEPTED: { etiqueta: 'Aceptada', tono: 'info' },
  REJECTED: { etiqueta: 'Rechazada', tono: 'error' },
  COMPLETED: { etiqueta: 'Con contrarreferencia', tono: 'success' },
  CANCELLED: { etiqueta: 'Anulada', tono: 'secondary' },
};

/** El rótulo del tipo, o «Sin tipo» en las filas anteriores al patch. */
export function etiquetaDeTipo(tipo: ReferralType | undefined): string {
  return tipo === undefined ? 'Sin tipo' : ETIQUETA_DE_TIPO[tipo];
}

/** El estado legible; si la API no lo derivó, se dice sin inventarlo. */
export function estadoDe(referral: Referral): { readonly etiqueta: string; readonly tono: Tone } {
  return referral.status === undefined
    ? { etiqueta: 'Registrada', tono: 'secondary' }
    : ESTADO_DE_DERIVACION[referral.status];
}

/**
 * El destino en una línea, con lo que la API resolvió.
 *
 * Nunca un uuid: si el nombre no vino, se dice qué clase de destino es.
 */
export function destinoDe(referral: Referral): string {
  if (referral.targetExternalName !== undefined) {
    return `${referral.targetExternalName} (externo)`;
  }
  const partes: string[] = [];
  if (referral.targetProfileId !== undefined) {
    partes.push(referral.targetProfileName ?? 'Profesional de la plataforma');
  }
  if (referral.targetTenantId !== undefined || referral.targetBranchId !== undefined) {
    const organizacion = referral.targetTenantName ?? 'Organización de la plataforma';
    partes.push(
      referral.targetBranchName === undefined
        ? organizacion
        : `${organizacion} · ${referral.targetBranchName}`,
    );
  }
  return partes.length === 0 ? 'Sin destino registrado' : partes.join(' — ');
}

/** Si la vigencia ya pasó, mirado al día (no al instante). */
export function vencida(referral: Referral, hoy: Date = new Date()): boolean {
  if (referral.validUntil === undefined) {
    return false;
  }
  const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return referral.validUntil < inicioDeHoy;
}

/** La prioridad en castellano, por código estable; sin código conocido, el `display`. */
const ETIQUETA_DE_PRIORIDAD: Readonly<Record<string, string>> = {
  'PRI-ROUTINE': 'Rutina',
  REF_ROUTINE: 'Rutina',
  'PRI-URGENT': 'Urgente',
  REF_URGENT: 'Urgente',
  'PRI-STAT': 'Inmediata',
  REF_STAT: 'Inmediata',
};

export function etiquetaDePrioridad(code: string, display: string): string {
  return ETIQUETA_DE_PRIORIDAD[code] ?? display;
}
