import type { RetireBlockerKind, SiteSummary, SiteViewer } from '../../../../core/data-access/infrastructure/infrastructure.types';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import type { TreeNode } from '../../../../shared/components/organisms/tree/tree.types';
import type { CareSpaceDetail, CareSpaceNode } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { buildSpaceTree, type SpaceTreeItem } from '../../../../core/data-access/infrastructure/infrastructure.logic';

/* ============================================================================
    Ayudas de presentación compartidas por la pestaña, la ficha y los diálogos
    de infraestructura. Sin Angular: texto, tonos y permisos que sólo reflejan.
    ========================================================================== */

/** La ruta de la ficha de un espacio. */
export const rutaDeEspacio = (id: string): string => `/administration/medical-organization/spaces/${id}`;

/** Tono del badge por **código** de ciclo de vida, nunca por rótulo. */
export function varianteDeEstado(codigo: string): BadgeVariant {
  switch (codigo) {
    case 'SPACE_ACTIVE':
    case 'UNIT_ACTIVE':
      return 'success';
    case 'SPACE_PLANNED':
    case 'UNIT_PLANNED':
      return 'info';
    case 'SPACE_SUSPENDED':
    case 'UNIT_SUSPENDED':
      return 'warning';
    default:
      return 'secondary';
  }
}

/** Tono de una habilitación por código de estado (el vencimiento ya viene calculado). */
export function varianteDeHabilitacion(codigo: string): BadgeVariant {
  switch (codigo) {
    case 'LIC_VALID':
      return 'success';
    case 'LIC_IN_PROCESS':
      return 'info';
    case 'LIC_SUSPENDED':
      return 'warning';
    default:
      return 'error';
  }
}

const TITULO_DE_BLOQUEO: Readonly<Record<RetireBlockerKind, string>> = {
  ACTIVE_CHILDREN: 'Espacios hijos vigentes',
  ACTIVE_ENCOUNTER: 'Pacientes internados',
  FUTURE_PROCEDURE: 'Cirugías programadas',
  FUTURE_BOOKING: 'Citas o reservas futuras',
  SCHEDULABLE_RESOURCE: 'Recurso agendable vigente',
  INVENTORY_LOCATION: 'Stock en el espacio',
  EQUIPMENT: 'Equipos ubicados aquí',
};

export const tituloDeBloqueo = (kind: RetireBlockerKind): string => TITULO_DE_BLOQUEO[kind] ?? kind;

/**
 * Qué puede hacer quien mira, para **mostrar u ocultar controles**.
 *
 * Manda lo que el servidor declara en `SiteSummary.viewer`. Si no lo declara,
 * se cae al rol de plataforma del token — lo único visible desde acá, porque el
 * administrador de organización o de sucursal sale de una membresía que el token
 * no trae. Ocultar un control no es seguridad: la API responde 403 igual.
 */
export function permisosDe(sitio: SiteSummary | null, roles: readonly string[]): SiteViewer {
  if (sitio?.viewer !== undefined) return sitio.viewer;
  const plataforma = roles.includes('SECURITY_ADMIN') || roles.includes('SUPERADMIN');
  return { canWriteStructure: plataforma, canEditRegulatory: plataforma, canSeeHistory: plataforma };
}

const FECHA = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' });
const FECHA_HORA = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/La_Paz',
});

/** `2026-10-29` o ISO completo → `29/10/2026`. Una fecha sin hora no se corre por zona. */
export function fechaCorta(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = new Date(soloDia ? `${valor}T12:00:00Z` : valor);
  if (Number.isNaN(d.getTime())) return valor;
  return soloDia ? new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d) : FECHA.format(d);
}

export function fechaYHora(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? valor : FECHA_HORA.format(d);
}

/** Minutos de antigüedad de una lectura. */
export function minutosDesde(asOf: string, ahora: Date = new Date()): number {
  const t = new Date(asOf).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((ahora.getTime() - t) / 60_000));
}

/** Pasado este tiempo la lectura se muestra como S7 (datos atrasados). */
export const UMBRAL_DE_ATRASO_MIN = 5;

export function antiguedadEnPalabras(minutos: number): string {
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} h`;
}

export interface DatoDeEspacio {
  readonly espacio: CareSpaceNode;
}

/** Convierte el árbol de espacios al que dibuja `app-tree`. */
export function aNodosDelArbol(items: readonly SpaceTreeItem[]): readonly TreeNode<CareSpaceNode>[] {
  return items.map((item) => ({
    id: item.space.id,
    label: item.space.name,
    hint: item.space.code,
    muted: item.space.status.code === 'SPACE_RETIRED',
    data: item.space,
    children: aNodosDelArbol(item.children),
  }));
}

export function arbolDeEspacios(espacios: readonly CareSpaceNode[], mostrarClausurados: boolean): readonly TreeNode<CareSpaceNode>[] {
  return aNodosDelArbol(buildSpaceTree(espacios, (s) => mostrarClausurados || s.status.code !== 'SPACE_RETIRED'));
}

/** El nodo del árbol plano que corresponde a la ficha que acaba de devolver la API. */
export function detalleANodo(d: CareSpaceDetail): CareSpaceNode {
  const propietaria = d.assignments.find((a) => a.role.code === 'SPACE_UNIT_ROLE_OWNER');
  return {
    id: d.id,
    parentId: d.parentId,
    code: d.code,
    name: d.name,
    form: d.form,
    function: d.function,
    status: d.status,
    operationalStatus: d.operationalStatus,
    clinicalUnitId: propietaria?.clinicalUnitId ?? d.clinicalUnitId,
    capacity: d.capacity,
    rowVersion: d.rowVersion,
    childCount: d.childCount,
  };
}
