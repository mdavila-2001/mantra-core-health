import { activityKindOf } from './support-access.activity-kinds';
import type { FilaBitacora } from '../fixtures/support-hospital.types';
import { vinculos } from '../fixtures/support-hospital';
import { reply, type MockReply } from '../mock-router';
import { MOCK_USERS } from '../mock-session';
import { uuid } from '../mock-store';
import { catalogoDe } from './support-access.core';

/* ============================================================================
    La bitácora de actividad con la forma y el comportamiento de la API
    (`SupportActivityQuery` / `SupportActivityEntryDto`):

    - filtros `userId`, `person` (id **o** nombre completo, sin distinguir mayúsculas ni
      acentos), `doctor` (asignación de rol, perfil o nombre), `action` (el código de la
      entrada o el asiento crudo), `from`/`to` (`YYYY-MM-DD` = el día completo en la hora de
      La Paz, UTC-4; o un instante ISO), `tenantId`, `limit` (1-200) y `cursor` (`instante|id`);
    - lo más reciente primero y, a igual instante, el id mayor primero;
    - cada fila repite la persona (`personName`/`actorName`) y el instante
      (`createdAt`/`occurredAt`/`recordedAt`) como la API.
   ========================================================================== */

const DIA_EN_MS = 86_400_000;
/** La Paz está en UTC-4 todo el año. */
const HORAS_DE_DESFASE = 4;

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}

/** Un límite de fecha: `YYYY-MM-DD` es el día completo en La Paz; con hora, el instante tal cual. */
export function limiteDeFecha(valor: string, borde: 'inicio' | 'fin'): number | undefined {
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (dia !== null) {
    const inicio = Date.UTC(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3]), HORAS_DE_DESFASE);
    return borde === 'inicio' ? inicio : inicio + DIA_EN_MS - 1;
  }
  const instante = new Date(valor).getTime();
  return Number.isNaN(instante) ? undefined : instante;
}

/** El usuario de quien actuó: el del vínculo con ese nombre, el de la cuenta demo o uno estable derivado del nombre. */
function userIdDe(fila: FilaBitacora): string {
  const vinculo = vinculos.filtrar((v) => v.tenantId === fila.tenantId && v.personName === fila.actorName)[0];
  if (vinculo !== undefined) return vinculo.userId;
  return MOCK_USERS.find((u) => u.displayName === fila.actorName)?.id ?? uuid(`actor-${fila.actorName}`);
}

function entradaDeLaRed(fila: FilaBitacora) {
  const tipo = activityKindOf(fila.action);
  const doctor = fila.doctorId === undefined ? undefined : catalogoDe(fila.tenantId).doctors.find((d) => d.id === fila.doctorId);
  return {
    id: fila.id,
    tenantId: fila.tenantId,
    userId: userIdDe(fila),
    personName: fila.actorName,
    actorName: fila.actorName,
    action: fila.action,
    auditAction: tipo.auditAction,
    ...(tipo.permission === undefined ? {} : { permission: tipo.permission }),
    entity: tipo.entity,
    ...(fila.doctorId === undefined ? {} : { practitionerRoleAssignmentId: fila.doctorId }),
    ...(doctor === undefined ? {} : { practitionerName: doctor.name }),
    summary: fila.summary,
    success: true,
    result: 'SUCCESS' as const,
    createdAt: fila.occurredAt,
    occurredAt: fila.occurredAt,
    recordedAt: fila.occurredAt,
  };
}

export type EntradaDeLaRed = ReturnType<typeof entradaDeLaRed>;

function codificar(fila: { createdAt: string; id: string }): string {
  return btoa(`${fila.createdAt}|${fila.id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodificar(cursor: string): { createdAt: string; id: string } | undefined {
  try {
    const normal = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const [createdAt, id] = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, '=')).split('|');
    return createdAt === undefined || Number.isNaN(new Date(createdAt).getTime()) ? undefined : { createdAt, id: id ?? '' };
  } catch {
    return undefined;
  }
}

/** La página que la API entregaría: filtrada, ordenada y con su cursor. */
export function paginaDeActividad(filas: readonly FilaBitacora[], query: URLSearchParams, tope = 200): { items: EntradaDeLaRed[]; count: number; nextCursor: string | null } | MockReply {
  const leer = (clave: string): string | undefined => {
    const valor = query.get(clave);
    return valor === null || valor === '' ? undefined : valor;
  };
  const userId = leer('userId');
  const persona = leer('person');
  const doctor = leer('doctor');
  const accion = leer('action');
  const desde = leer('from') === undefined ? undefined : limiteDeFecha(leer('from')!, 'inicio');
  const hasta = leer('to') === undefined ? undefined : limiteDeFecha(leer('to')!, 'fin');
  const tenantId = leer('tenantId');
  // `limit` va de 1 a 200 (`SupportActivityQuery`): fuera de ese rango o sin ser entero, 400.
  const limite = leer('limit') === undefined ? tope : Number(leer('limit'));
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) {
    return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'El tope va de 1 a 200.', error: 'Bad Request', details: { fields: [{ field: 'limit', message: 'debe estar entre 1 y 200' }] } });
  }
  const cursor = leer('cursor') === undefined ? undefined : decodificar(leer('cursor')!);

  const entradas = filas
    .filter((f) => tenantId === undefined || f.tenantId === tenantId)
    .map(entradaDeLaRed)
    .filter((e) => {
      if (userId !== undefined && e.userId !== userId) return false;
      if (persona !== undefined && e.userId !== persona && sinTildes(e.personName) !== sinTildes(persona)) return false;
      if (doctor !== undefined && !(e.practitionerRoleAssignmentId === doctor || (e.practitionerName !== undefined && sinTildes(e.practitionerName) === sinTildes(doctor)))) return false;
      if (accion !== undefined && e.action !== accion && e.auditAction !== accion) return false;
      const instante = new Date(e.createdAt).getTime();
      if (desde !== undefined && instante < desde) return false;
      if (hasta !== undefined && instante > hasta) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .filter((e) => cursor === undefined || e.createdAt < cursor.createdAt || (e.createdAt === cursor.createdAt && e.id < cursor.id));

  const pagina = entradas.slice(0, limite);
  const ultima = pagina.at(-1);
  return { items: pagina, count: pagina.length, nextCursor: entradas.length > limite && ultima !== undefined ? codificar(ultima) : null };
}
