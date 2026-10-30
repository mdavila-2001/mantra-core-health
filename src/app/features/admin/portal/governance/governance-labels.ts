import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { Rotulo } from '../../platform/platform-labels';

/* ============================================================================
    Rótulos y tonos del gobierno de acceso (auditoría, usuarios y roles,
    deriva de permisos).

    Traducen los códigos de `/audit`, `/authz` y la deriva a texto y color. No
    deciden nada: un código que no está acá se muestra tal cual con tono
    neutro. El color nunca va solo — todo rótulo trae su texto.
    ========================================================================== */

/** Un rotulador que además sabe qué códigos conoce (para armar las opciones de un filtro). */
export type LabelTable = ((code: string | null | undefined) => Rotulo) & {
  readonly codes: readonly string[];
};

function labelTable(entries: Readonly<Record<string, Rotulo>>, missing = 'Sin dato'): LabelTable {
  const label = (code: string | null | undefined): Rotulo =>
    code ? (entries[code] ?? { label: code, tone: 'secondary' }) : { label: missing, tone: 'secondary' };
  return Object.assign(label, { codes: Object.keys(entries) });
}

/** Las opciones de un filtro: los códigos que la API acepta, con su texto. */
export function optionsFrom(table: LabelTable, codes: readonly string[] = table.codes): readonly SelectOption<string>[] {
  return codes.map((code) => ({ value: code, label: table(code).label }));
}

/** Riesgo para la seguridad de la salud. Lo deriva la API al leer. */
export const healthRisk = labelTable({
  CRITICAL: { label: 'Riesgo crítico', tone: 'error' },
  HIGH: { label: 'Riesgo alto', tone: 'error' },
  MEDIUM: { label: 'Riesgo medio', tone: 'warning' },
  LOW: { label: 'Riesgo bajo', tone: 'success' },
});

export const auditResult = labelTable({
  SUCCESS: { label: 'Correcta', tone: 'success' },
  FAILURE: { label: 'Fallida', tone: 'error' },
  UNKNOWN: { label: 'Sin resultado', tone: 'secondary' },
});

export const httpMethod = labelTable({
  GET: { label: 'GET', tone: 'info' },
  POST: { label: 'POST', tone: 'success' },
  PUT: { label: 'PUT', tone: 'warning' },
  PATCH: { label: 'PATCH', tone: 'warning' },
  DELETE: { label: 'DELETE', tone: 'error' },
});

export const dataOperation = labelTable({
  READ: { label: 'Lectura', tone: 'info' },
  CREATE: { label: 'Alta', tone: 'success' },
  UPDATE: { label: 'Cambio', tone: 'warning' },
  DELETE: { label: 'Borrado', tone: 'error' },
  EXPORT: { label: 'Exportación', tone: 'error' },
});

/** Qué bitácora se leyó, cuando el acceso sensible es a la propia auditoría. */
export const resourceKind = labelTable(
  {
    AUDIT_LOG: { label: 'Bitácora de acciones', tone: 'secondary' },
    DATA_ACCESS_LOG: { label: 'Bitácora de accesos', tone: 'secondary' },
  },
  'Sin tipo de recurso',
);

export const accessPurpose = labelTable(
  { SECURITY_OVERSIGHT: { label: 'Supervisión de seguridad', tone: 'secondary' } },
  'Sin propósito declarado',
);

export const assignmentStatus = labelTable({
  ACTIVE: { label: 'Activa', tone: 'success' },
  REVOKED: { label: 'Revocada', tone: 'secondary' },
  EXPIRED: { label: 'Vencida', tone: 'warning' },
  OTHER: { label: 'Otro estado', tone: 'secondary' },
});

export const roleScope = labelTable(
  {
    GLOBAL: { label: 'Ámbito global', tone: 'primary' },
    TENANT: { label: 'Por organización', tone: 'info' },
    BRANCH: { label: 'Por sede', tone: 'info' },
    SELF: { label: 'Sobre sí mismo', tone: 'secondary' },
  },
  'Ámbito sin declarar',
);

export const permissionEffect = labelTable({
  ALLOW: { label: 'Permite', tone: 'success' },
  DENY: { label: 'Niega', tone: 'error' },
  OTHER: { label: 'Otro efecto', tone: 'secondary' },
});

/** ¿Hay fila del rol en la base? `null` = la API no la consultó. */
export function roleInDatabase(value: boolean | null): Rotulo {
  if (value === null) return { label: 'Sin consultar la base', tone: 'secondary' };
  return value
    ? { label: 'Existe en la base, sin siembra', tone: 'warning' }
    : { label: 'No existe en la base', tone: 'error' };
}

/**
 * Una ruta partida después de cada `/`, para dibujarla con `<wbr>`: así parte
 * en las barras y no a media palabra ni empuja la columna fuera de la tabla.
 */
export function pathSegments(path: string): readonly string[] {
  return path.split(/(?<=\/)/);
}

/** Fecha y hora legibles, en la zona del navegador. */
export function dateTime(value: Date | undefined | null): string {
  if (!value) return 'Sin dato';
  return value.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Sólo la hora («3:50 a. m.»): se dibuja sin cortes, separada de la fecha. */
export function timeOnly(value: Date | undefined | null): string {
  if (!value) return '';
  return value.toLocaleTimeString('es-BO', { timeStyle: 'short' });
}

/** Sólo la fecha. */
export function dateOnly(value: Date | undefined | null): string {
  if (!value) return 'Sin dato';
  return value.toLocaleDateString('es-BO', { dateStyle: 'medium' });
}
