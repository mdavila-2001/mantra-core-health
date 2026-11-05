import type { ReplyTemplate } from '../../data-access/support-access/support-inbox.types';
import { plantillas } from '../fixtures/support-hospital-inbox';
import { notFound, reply, type MockReply, type MockRouter } from '../mock-router';
import { TENANT_NAMES } from '../mock-session';
import { cuerpo, nuevoId } from '../mock-store';
import { conMotivo } from './support-access.errors';
import { anotar, soloOrganizacion, esRespuesta as esRespuestaAcceso } from './support-access.core';

/* ============================================================================
    Las **respuestas preparadas** de la organización: lo que la API entrega a quien
    responde (`GET /me/support-reply-templates`, en el archivo del chat) y la
    administración de `SECURITY_ADMIN` (`/org/reply-templates`): crear, cambiar,
    retirar y reactivar, con `expectedVersion` para no pisar a otra persona.
   ========================================================================== */

/** Una respuesta preparada como la entrega la API: con `retired` y `version`. */
export function vistaDePlantilla(fila: { id: string; category: ReplyTemplate['category']; title: string; bodyText: string; practitionerProfileId?: string; retired?: boolean; version?: number }): ReplyTemplate {
  return {
    id: fila.id,
    category: fila.category,
    title: fila.title,
    bodyText: fila.bodyText,
    ...(fila.practitionerProfileId === undefined ? {} : { practitionerProfileId: fila.practitionerProfileId }),
    retired: fila.retired === true,
    version: fila.version ?? 1,
  };
}

const CATEGORIAS: readonly string[] = ['GENERAL', 'SCHEDULING', 'BILLING', 'PREPARATION'];

/** Las validaciones de `CreateReplyTemplateDto` y `UpdateReplyTemplateDto` (400). */
function problemaDePlantilla(datos: { category?: string; title?: string; bodyText?: string; retired?: boolean; expectedVersion?: number }, alta: boolean): MockReply | null {
  const campos: { field: string; message: string }[] = [];
  if ((alta || datos.category !== undefined) && !CATEGORIAS.includes(datos.category ?? '')) campos.push({ field: 'category', message: 'categoría no válida' });
  if ((alta || datos.title !== undefined) && (typeof datos.title !== 'string' || datos.title.trim().length < 1 || datos.title.length > 120)) campos.push({ field: 'title', message: 'de 1 a 120 caracteres' });
  if ((alta || datos.bodyText !== undefined) && (typeof datos.bodyText !== 'string' || datos.bodyText.trim().length < 1 || datos.bodyText.length > 2000)) campos.push({ field: 'bodyText', message: 'de 1 a 2000 caracteres' });
  if (datos.expectedVersion !== undefined && (!Number.isInteger(datos.expectedVersion) || datos.expectedVersion < 1)) campos.push({ field: 'expectedVersion', message: 'debe ser un entero desde 1' });
  return campos.length === 0 ? null : reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Revise la respuesta preparada.', error: 'Bad Request', details: { fields: campos } });
}

export function registrarRespuestasPreparadas(router: MockRouter): void {
  /* ---- respuestas preparadas: administración de la organización -------------------- */

  router.get('/org/reply-templates', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuestaAcceso(acceso)) return acceso;
    const items = plantillas.filtrar((p) => p.tenantId === acceso.tenantId).map(vistaDePlantilla);
    return { items, count: items.length };
  });

  router.post('/org/reply-templates', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuestaAcceso(acceso)) return acceso;
    const datos = cuerpo<{ category: ReplyTemplate['category']; title: string; bodyText: string; practitionerProfileId: string }>(request);
    const problema = problemaDePlantilla(datos, true);
    if (problema !== null) return problema;
    const fila = plantillas.agregar({
      id: nuevoId('plantilla'),
      tenantId: acceso.tenantId,
      category: datos.category!,
      title: datos.title!.trim(),
      bodyText: datos.bodyText!.trim(),
      ...(datos.practitionerProfileId === undefined ? {} : { practitionerProfileId: datos.practitionerProfileId }),
      retired: false,
      version: 1,
    });
    anotar(acceso.tenantId, TENANT_NAMES[acceso.tenantId] ?? 'La organización', 'reply_template.created', 'Se creó una respuesta preparada.');
    return { status: 201, body: vistaDePlantilla(fila) };
  });

  /** Cambiarla, retirarla o reactivarla. Con `expectedVersion` no se pisa lo que otra persona cambió: 409 `REPLY_TEMPLATE_STALE`. */
  router.patch('/org/reply-templates/:id', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuestaAcceso(acceso)) return acceso;
    const fila = plantillas.get(request.params['id']!);
    if (fila === undefined || fila.tenantId !== acceso.tenantId) return notFound('Respuesta preparada no encontrada.');
    const datos = cuerpo<{ category: ReplyTemplate['category']; title: string; bodyText: string; retired: boolean; expectedVersion: number }>(request);
    const problema = problemaDePlantilla(datos, false);
    if (problema !== null) return problema;
    const actual = fila.version ?? 1;
    if (datos.expectedVersion !== undefined && datos.expectedVersion !== actual) {
      return conMotivo(409, 'Otra persona cambió esta respuesta mientras usted la editaba. Vuelva a leerla y repita su cambio.', 'REPLY_TEMPLATE_STALE', { currentVersion: actual });
    }
    const cambiada = plantillas.actualizar(fila.id, {
      ...(datos.title === undefined ? {} : { title: datos.title.trim() }),
      ...(datos.bodyText === undefined ? {} : { bodyText: datos.bodyText.trim() }),
      ...(datos.category === undefined ? {} : { category: datos.category }),
      ...(datos.retired === undefined ? {} : { retired: datos.retired }),
      version: actual + 1,
    })!;
    anotar(acceso.tenantId, TENANT_NAMES[acceso.tenantId] ?? 'La organización', 'reply_template.updated', datos.retired === true ? 'Se retiró una respuesta preparada.' : 'Se cambió una respuesta preparada.');
    return vistaDePlantilla(cambiada);
  });
}
