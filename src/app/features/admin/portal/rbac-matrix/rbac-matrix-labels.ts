import type {
  CellAction,
  CellCoverage,
  GapKind,
  GapSeverity,
} from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import type { Rotulo } from '../../platform/platform-labels';

/* ============================================================================
    Rótulos de la matriz RBAC por módulo. No deciden nada: un código que no está
    acá se muestra tal cual con tono neutro, y el color nunca va solo — todo
    rótulo trae su texto.
    ========================================================================== */

const NEUTRO = (code: string): Rotulo => ({ label: code, tone: 'secondary' });
const tabla =
  (entradas: Readonly<Record<string, Rotulo>>) =>
  (code: string | null | undefined): Rotulo =>
    code ? (entradas[code] ?? NEUTRO(code)) : { label: 'Sin dato', tone: 'secondary' };

export const accionDeMatriz = tabla({
  read: { label: 'Leer', tone: 'info' },
  list: { label: 'Listar', tone: 'info' },
  create: { label: 'Crear', tone: 'success' },
  update: { label: 'Actualizar', tone: 'warning' },
  delete: { label: 'Eliminar', tone: 'error' },
  export: { label: 'Exportar', tone: 'warning' },
  approve: { label: 'Aprobar', tone: 'primary' },
  reject: { label: 'Rechazar', tone: 'primary' },
  assign: { label: 'Asignar', tone: 'primary' },
  configure: { label: 'Configurar', tone: 'warning' },
  audit: { label: 'Auditar', tone: 'info' },
  other: { label: 'Otra acción', tone: 'secondary' },
} satisfies Record<CellAction, Rotulo>);

export const coberturaDeCelda = tabla({
  FINE_PERMISSION: { label: 'Con permiso fino', tone: 'success' },
  UNDECLARED_AUTH: { label: 'Sin autorización declarada', tone: 'error' },
  ROLE_ONLY: { label: 'Sólo por rol', tone: 'warning' },
  GUARD_ONLY: { label: 'Sólo guard de dominio', tone: 'info' },
  NOT_APPLICABLE: { label: 'No aplica', tone: 'secondary' },
} satisfies Record<CellCoverage, Rotulo>);

export const tipoDeHueco = tabla({
  MODULE_WITHOUT_FINE_PERMISSIONS: { label: 'Módulo sin permisos finos', tone: 'warning' },
  ROLE_ONLY: { label: 'Sólo @Roles', tone: 'warning' },
  GUARD_ONLY: { label: 'Sólo guard', tone: 'info' },
  UNDECLARED_AUTH: { label: 'Autorización no declarada', tone: 'error' },
} satisfies Record<GapKind, Rotulo>);

export const severidadDeHueco = tabla({
  HIGH: { label: 'Prioridad alta', tone: 'error' },
  MEDIUM: { label: 'Prioridad media', tone: 'warning' },
  LOW: { label: 'Prioridad baja', tone: 'info' },
} satisfies Record<GapSeverity, Rotulo>);

export const efectoDeBorrador = tabla({
  ALLOW: { label: 'Permite', tone: 'success' },
  DENY: { label: 'Niega', tone: 'error' },
});

/** Las opciones de filtro (código → rótulo) en el orden en que se declaran. */
export const SEVERIDADES: readonly GapSeverity[] = ['HIGH', 'MEDIUM', 'LOW'];
export const TIPOS_DE_HUECO: readonly GapKind[] = [
  'UNDECLARED_AUTH',
  'ROLE_ONLY',
  'GUARD_ONLY',
  'MODULE_WITHOUT_FINE_PERMISSIONS',
];

/** Clave de módulo → texto legible (`pharma_lab` → `pharma lab`). */
export function nombreDeModulo(key: string): string {
  return key.replace(/_/g, ' ');
}
