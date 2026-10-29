import { HttpHeaders } from '@angular/common/http';

import { admissionFileReply } from '../fixtures/admission-files';
import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import {
  MAX_REENVIOS,
  crearAdmisionDeAltaDeDoctor,
  registrarAdmisiones,
  reemplazarEvidencia,
  reiniciarAdmisiones,
} from './admissions.handlers';

/* Las reglas del contrato de `/admissions`, aplicadas por el simulador: roles,
   versión esperada, transiciones, fuente y motivo, cuatro ojos. Un recorrido
   en la maqueta tiene que fallar donde falla la API. */

const router = new MockRouter();
registrarAdmisiones(router);

const revisor = buscarUsuario('admin')!;
const aprobador = buscarUsuario('aprobador')!;
const paciente = buscarUsuario('paciente')!;
const medicoNuevo = buscarUsuario('medico_nuevo')!;
const medica = buscarUsuario('medica')!;
const soloSeguridad = { ...buscarUsuario('admin')!, roles: ['SECURITY_ADMIN'] };

interface Resp {
  readonly status: number;
  readonly body: any;
}

function llamar(method: MockMethod, path: string, body: unknown = undefined, user = revisor, query = ''): Resp {
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin ruta ${method} ${path}`);
  const r = match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(query),
    body,
    headers: new HttpHeaders(),
    user,
  } satisfies MockRequest);
  return isMockReply(r) ? { status: r.status, body: r.body } : { status: 200, body: r };
}

const lista = (query = '', user = revisor) => llamar('GET', '/admissions', undefined, user, query);

function primeraEn(estado: string, extra = ''): any {
  const r = lista(`status=${estado}&${extra}`);
  expect(r.status).toBe(200);
  const fila = r.body.items[0];
  expect(fila, `no hay admisión ${estado}`).toBeDefined();
  return fila;
}

const detalle = (id: string, user = revisor) => llamar('GET', `/admissions/${id}`, undefined, user);

/** La huella que el revisor tenía en pantalla para ese requisito. */
const hashDe = (d: any, requirementId: string): string => d.requirements.find((r: any) => r.id === requirementId).evidenceSha256;

const FUENTE = { sourceType: 'MINSALUD_REGISTRY', sourceRef: 'Comprobante 4512' };
const MOTIVO = { reasonCode: 'ILLEGIBLE', reason: 'La imagen está cortada.' };

/** Toma una admisión enviada y devuelve su detalle. */
function tomar(): any {
  const fila = primeraEn('SUBMITTED');
  const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion });
  expect(r.status).toBe(200);
  return r.body;
}

function verificarObligatorios(d: any): any {
  let actual = d;
  for (const req of actual.requirements.filter((x: any) => x.mandatory)) {
    const r = llamar('POST', `/admissions/${d.id}/items/${req.id}/review`, {
      decision: 'VERIFIED',
      ...FUENTE,
      evidenceSha256: req.evidenceSha256,
      expectedRowVersion: actual.rowVersion,
    });
    expect(r.status).toBe(200);
    actual = r.body;
  }
  return actual;
}

describe('Admisiones del simulador', () => {
  beforeEach(() => reiniciarAdmisiones());

  describe('la bandeja', () => {
    it('exige un rol de la bandeja: el paciente recibe 403 que nombra el rol', () => {
      const r = lista('', paciente);
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_REVIEWER');
    });

    it('SECURITY_ADMIN ve la bandeja (pero no actúa: ver más abajo)', () => {
      expect(lista('', soloSeguridad).status).toBe(200);
    });

    it('trae cuentas por estado y respeta el orden por vencimiento', () => {
      const r = lista();
      expect(r.body.counts['SUBMITTED']).toBeGreaterThan(0);
      expect(r.body.counts['VERIFIED']).toBeGreaterThan(0);
      const conPlazo = r.body.items.filter((i: any) => i.dueAt !== null).map((i: any) => Date.parse(i.dueAt));
      expect([...conPlazo].sort((a, b) => a - b)).toEqual(conPlazo);
      // Las que no tienen plazo corriendo van al final.
      const ultimaConPlazo = r.body.items.map((i: any) => i.dueAt !== null).lastIndexOf(true);
      const primeraSinPlazo = r.body.items.map((i: any) => i.dueAt === null).indexOf(true);
      expect(primeraSinPlazo).toBeGreaterThan(ultimaConPlazo);
    });

    it('filtra por estado, tipo, asignación y vencimiento', () => {
      expect(lista('status=VERIFIED').body.items.every((i: any) => i.status.code === 'VERIFIED')).toBe(true);
      expect(lista('type=OTRO_TIPO').body.items).toHaveLength(0);
      expect(lista('assignedTo=none').body.items.every((i: any) => i.assignedTo === null)).toBe(true);
      const vencidas = lista('overdue=true').body.items;
      expect(vencidas.length).toBeGreaterThan(0);
      expect(vencidas.every((i: any) => i.overdue === true)).toBe(true);
    });

    it('los contadores no se ven afectados por el filtro de estado', () => {
      const todas = lista().body.counts;
      expect(lista('status=VERIFIED').body.counts).toEqual(todas);
    });

    it('pagina por cursor sin repetir ni saltear', () => {
      const primera = lista('limit=5');
      expect(primera.body.items).toHaveLength(5);
      expect(primera.body.nextCursor).not.toBeNull();
      const segunda = lista(`limit=5&cursor=${primera.body.nextCursor}`);
      const ids = [...primera.body.items, ...segunda.body.items].map((i: any) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('la lista enmascara la cédula; el detalle la trae completa', () => {
      const fila = lista().body.items[0];
      expect(fila.practitioner.maskedNationalId).toMatch(/^\*+\d{3}$/);
      expect(fila.practitioner.nationalId).toBeUndefined();
      expect(detalle(fila.id).body.practitioner.nationalId).toMatch(/^\d+$/);
    });

    it('la búsqueda por documento viaja por POST y encuentra a la persona', () => {
      const fila = lista().body.items[0];
      const cedula = detalle(fila.id).body.practitioner.nationalId as string;
      const r = llamar('POST', '/admissions/search', { q: cedula });
      expect(r.status).toBe(200);
      expect(r.body.items.map((i: any) => i.id)).toContain(fila.id);
      expect(r.body.items.length).toBeLessThan(lista().body.items.length);
    });

    it('buscar sin tildes ni mayúsculas por nombre', () => {
      const fila = lista().body.items[0];
      const nombre = (fila.practitioner.fullName as string).split(' ')[0]!.toUpperCase();
      expect(llamar('POST', '/admissions/search', { q: nombre }).body.items.map((i: any) => i.id)).toContain(fila.id);
    });

    it('una búsqueda sin resultados devuelve la lista vacía, no un error', () => {
      const r = llamar('POST', '/admissions/search', { q: 'zzzz-nadie' });
      expect(r.status).toBe(200);
      expect(r.body.items).toEqual([]);
    });
  });

  describe('tomar la revisión', () => {
    it('solo la toma un revisor', () => {
      const fila = primeraEn('SUBMITTED');
      const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion }, aprobador);
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_REVIEWER');
    });

    it('SECURITY_ADMIN solo no puede tomarla: sin rol implícito', () => {
      const fila = primeraEn('SUBMITTED');
      expect(llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion }, soloSeguridad).status).toBe(403);
    });

    it('queda en revisión, asignada y con un evento', () => {
      const d = tomar();
      expect(d.status.code).toBe('IN_REVIEW');
      expect(d.assignedTo.id).toBe(revisor.id);
      expect(d.events.at(-1).type).toBe('CLAIMED');
      expect(d.rowVersion).toBeGreaterThan(1);
    });

    it('con una versión vieja responde 409 ADMISSION_STALE', () => {
      const fila = primeraEn('SUBMITTED');
      const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion - 1 });
      expect(r.status).toBe(409);
      expect(r.body.details.reason).toBe('ADMISSION_STALE');
      expect(r.body.details.currentRowVersion).toBe(fila.rowVersion);
    });

    it('sin versión esperada responde 412', () => {
      const fila = primeraEn('SUBMITTED');
      expect(llamar('POST', `/admissions/${fila.id}/claim`, {}).status).toBe(412);
    });

    it('una admisión que no está enviada responde 412 de transición inválida', () => {
      const fila = primeraEn('VERIFIED');
      const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion });
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_INVALID_TRANSITION');
    });

    it('un id que no existe es 404', () => {
      expect(llamar('GET', '/admissions/no-existe').status).toBe(404);
    });
  });

  describe('revisar un requisito', () => {
    it('verificar exige el tipo de fuente: sin él, 412', () => {
      const d = tomar();
      const req = d.requirements[0];
      const r = llamar('POST', `/admissions/${d.id}/items/${req.id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, req.id), expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_ITEM_REQUIRES_SOURCE');
    });

    it('la referencia es opcional salvo en «Otra fuente»', () => {
      const d = tomar();
      const [a, b] = d.requirements;
      const sinRef = llamar('POST', `/admissions/${d.id}/items/${a.id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, a.id), sourceType: 'SEDES', expectedRowVersion: d.rowVersion });
      expect(sinRef.status).toBe(200);
      expect(sinRef.body.requirements[0].source.type.code).toBe('SEDES');
      expect(sinRef.body.requirements[0].source.ref).toBeNull();
      const otra = llamar('POST', `/admissions/${d.id}/items/${b.id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, b.id), sourceType: 'OTHER', expectedRowVersion: sinRef.body.rowVersion });
      expect(otra.status).toBe(412);
      expect(otra.body.details.reason).toBe('ADMISSION_ITEM_REQUIRES_SOURCE');
    });

    it('no obliga a una dirección web: un número de comprobante alcanza', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, d.requirements[0].id), ...FUENTE, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(200);
      expect(r.body.requirements[0].source.ref).toBe('Comprobante 4512');
    });

    it('rechazar exige el código y el texto', () => {
      const d = tomar();
      const url = `/admissions/${d.id}/items/${d.requirements[0].id}/review`;
      const sinCodigo = llamar('POST', url, { decision: 'REJECTED', reason: 'No se lee el número.', expectedRowVersion: d.rowVersion });
      expect(sinCodigo.status).toBe(412);
      expect(sinCodigo.body.details.reason).toBe('ADMISSION_REASON_CODE_REQUIRED');
      const sinTexto = llamar('POST', url, { decision: 'REJECTED', reasonCode: 'ILLEGIBLE', expectedRowVersion: d.rowVersion });
      expect(sinTexto.status).toBe(412);
      expect(sinTexto.body.details.reason).toBe('ADMISSION_REASON_REQUIRED');
    });

    it('el motivo acepta 500 caracteres y rechaza 501', () => {
      const d = tomar();
      const url = `/admissions/${d.id}/items/${d.requirements[0].id}/review`;
      const en501 = llamar('POST', url, { decision: 'REJECTED', reasonCode: 'OTHER', reason: 'a'.repeat(501), expectedRowVersion: d.rowVersion });
      expect(en501.status).toBe(412);
      const en500 = llamar('POST', url, { decision: 'REJECTED', reasonCode: 'OTHER', reason: 'a'.repeat(500), expectedRowVersion: d.rowVersion });
      expect(en500.status).toBe(200);
      expect(en500.body.requirements[0].reasonText).toHaveLength(500);
    });

    it('un motivo de 4 caracteres es corto', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, { decision: 'REJECTED', reasonCode: 'OTHER', reason: 'abcd', expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(412);
    });

    it('guarda código, texto y nota interna, y el avance se actualiza', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, {
        decision: 'INFO_REQUIRED', ...MOTIVO, internalNote: 'Coincide con otro expediente.', expectedRowVersion: d.rowVersion,
      });
      const req = r.body.requirements[0];
      expect(req.status).toBe('INFO_REQUIRED');
      expect(req.reasonCode).toBe('ILLEGIBLE');
      expect(req.internalNote).toBe('Coincide con otro expediente.');
      expect(r.body.requirementsSummary.pending).toBeGreaterThan(0);
      expect(r.body.documents.filter((x: any) => x.requirementCode === req.code).every((x: any) => x.reviewState === 'INFO_REQUIRED')).toBe(true);
    });

    it('solo quien tomó la revisión puede revisar: otro revisor recibe 403', () => {
      const d = tomar();
      const otro = { ...revisor, id: 'otro-revisor' };
      const r = llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, d.requirements[0].id), ...FUENTE, expectedRowVersion: d.rowVersion }, otro);
      expect(r.status).toBe(403);
      expect(r.body.details.reason).toBe('ADMISSION_NOT_ASSIGNED');
    });

    it('un requisito inexistente es 404 y una versión vieja, 409', () => {
      const d = tomar();
      expect(llamar('POST', `/admissions/${d.id}/items/no-existe/review`, { decision: 'VERIFIED', ...FUENTE, expectedRowVersion: d.rowVersion }).status).toBe(404);
      expect(llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, d.requirements[0].id), ...FUENTE, expectedRowVersion: d.rowVersion - 1 }).status).toBe(409);
    });

    it('no se puede revisar una admisión que no está en revisión', () => {
      const fila = primeraEn('SUBMITTED');
      const d = detalle(fila.id).body;
      const r = llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, { decision: 'VERIFIED', evidenceSha256: hashDe(d, d.requirements[0].id), ...FUENTE, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(412);
    });
  });

  describe('la huella de la evidencia', () => {
    it('cada requisito y cada documento traen su huella de 64 caracteres', () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      for (const r of d.requirements) expect(r.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
      for (const doc of d.documents) expect(doc.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('verificar sin huella es 412: no se decide sin saber qué se miró', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/items/${d.requirements[0].id}/review`, { decision: 'VERIFIED', ...FUENTE, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_EVIDENCE_REQUIRED');
    });

    it('si el médico reemplazó el archivo mientras se lo miraba, 409 ADMISSION_EVIDENCE_CHANGED y no se verifica', () => {
      const d = tomar();
      const req = d.requirements[0];
      expect(reemplazarEvidencia(d.id, req.code)).toBe(true);
      const r = llamar('POST', `/admissions/${d.id}/items/${req.id}/review`, { decision: 'VERIFIED', ...FUENTE, evidenceSha256: req.evidenceSha256, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(409);
      expect(r.body.details.reason).toBe('ADMISSION_EVIDENCE_CHANGED');
      const despues = detalle(d.id).body;
      expect(despues.requirements[0].status).toBe('PENDING');
      expect(despues.requirements[0].evidenceSha256).not.toBe(req.evidenceSha256);
      // Con la huella nueva —tras volver a mirar— sí se puede decidir.
      const ok = llamar('POST', `/admissions/${d.id}/items/${req.id}/review`, { decision: 'VERIFIED', ...FUENTE, evidenceSha256: despues.requirements[0].evidenceSha256, expectedRowVersion: despues.rowVersion });
      expect(ok.status).toBe(200);
    });

    it('al rechazar la huella es opcional, pero si viene y no coincide también es 409', () => {
      const d = tomar();
      const req = d.requirements[0];
      expect(llamar('POST', `/admissions/${d.id}/items/${req.id}/review`, { decision: 'REJECTED', ...MOTIVO, expectedRowVersion: d.rowVersion }).status).toBe(200);
      const d2 = detalle(d.id).body;
      reemplazarEvidencia(d.id, req.code);
      const r = llamar('POST', `/admissions/${d.id}/items/${req.id}/review`, { decision: 'INFO_REQUIRED', ...MOTIVO, evidenceSha256: req.evidenceSha256, expectedRowVersion: d2.rowVersion });
      expect(r.status).toBe(409);
      expect(r.body.details.reason).toBe('ADMISSION_EVIDENCE_CHANGED');
    });
  });

  describe('la propia solicitud', () => {
    const comoMedico = () => ({ ...revisor, id: medicoNuevo.id, roles: ['ADMISSIONS_REVIEWER', 'ADMISSIONS_APPROVER'] });

    it('no aparece en la bandeja de quien tiene rol de admisiones y es el profesional', () => {
      const todas = lista('').body.items.map((i: any) => i.practitioner.fullName);
      expect(todas.some((n: string) => n.includes('Ramiro'))).toBe(true);
      const propias = lista('', comoMedico()).body.items.map((i: any) => i.practitioner.fullName);
      expect(propias.some((n: string) => n.includes('Ramiro'))).toBe(false);
    });

    it('el detalle y las acciones responden 403 ADMISSION_SELF_ACCESS', () => {
      const suya = lista('').body.items.find((i: any) => i.practitioner.fullName.includes('Ramiro'));
      const r = detalle(suya.id, comoMedico());
      expect(r.status).toBe(403);
      expect(r.body.details.reason).toBe('ADMISSION_SELF_ACCESS');
      expect(r.body.message).toContain('No puede revisar su propia solicitud');
      const accion = llamar('POST', `/admissions/${suya.id}/claim`, { expectedRowVersion: suya.rowVersion }, comoMedico());
      expect(accion.body.details.reason).toBe('ADMISSION_SELF_ACCESS');
    });
  });

  describe('la decisión final', () => {
    it('solo la toma un aprobador', () => {
      const d = verificarObligatorios(tomar());
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, revisor);
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_APPROVER');
    });

    it('con un obligatorio sin verificar responde 412 y nombra cuántos faltan', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_REQUIREMENTS_PENDING');
      expect(r.body.details.requirementIds.length).toBeGreaterThan(0);
    });

    it('con todos los obligatorios verificados, otra persona verifica al profesional', () => {
      const d = verificarObligatorios(tomar());
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('VERIFIED');
      expect(r.body.dueAt).toBeNull();
      // Y queda en la lista, con el estado nuevo.
      expect(lista('status=VERIFIED').body.items.map((i: any) => i.id)).toContain(d.id);
    });

    it('la decisión no lleva ítems: el servidor deriva el estado de las revisiones', () => {
      const d = verificarObligatorios(tomar());
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', items: [{ type: 'LICENSE', id: 'x', decision: 'VERIFIED' }], expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(200);
    });

    it('cuatro ojos: quien revisó no puede decidir aunque tenga el rol de aprobador', () => {
      const d = verificarObligatorios(tomar());
      const ambos = { ...revisor, roles: [...revisor.roles, 'ADMISSIONS_APPROVER'] };
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, ambos);
      expect(r.status).toBe(403);
      expect(r.body.details.reason).toBe('ADMISSION_FOUR_EYES');
      expect(r.body.message).toContain('Otra persona debe aprobar');
    });

    it('el propio profesional no puede aprobar su admisión aunque tenga el rol', () => {
      const suya = lista().body.items.find((i: any) => i.practitioner.fullName.includes('Ramiro'));
      const d = detalle(suya.id).body;
      const comoMedico = { ...aprobador, id: medicoNuevo.id };
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', ...MOTIVO, expectedRowVersion: d.rowVersion }, comoMedico);
      expect(r.status).toBe(403);
      expect(r.body.details.reason).toBe('ADMISSION_SELF_ACCESS');
    });

    it('rechazar exige código y motivo; guarda el motivo para el médico', () => {
      const d = tomar();
      const sin = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(sin.status).toBe(412);
      const con = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', reasonCode: 'NOT_IN_REGISTRY', reason: 'La matrícula no figura.', internalNote: 'Revisar con el colegio.', expectedRowVersion: d.rowVersion }, aprobador);
      expect(con.status).toBe(200);
      expect(con.body.status.code).toBe('REJECTED');
      expect(con.body.decisionReasonText).toBe('La matrícula no figura.');
    });
  });

  describe('lo que la API dice que se puede hacer (allowedActions)', () => {
    const accion = (d: any, code: string) => d.allowedActions.find((a: any) => a.code === code);

    it('un revisor puede tomar una enviada y no decidir', () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      expect(accion(d, 'CLAIM').allowed).toBe(true);
      expect(accion(d, 'DECIDE').allowed).toBe(false);
      expect(accion(d, 'DECIDE').reasonCode).toBe('ROLE');
    });

    it('a quien revisó se le explica el cuatro ojos', () => {
      const d = verificarObligatorios(tomar());
      const ambos = { ...revisor, roles: [...revisor.roles, 'ADMISSIONS_APPROVER'] };
      const decide = accion(detalle(d.id, ambos).body, 'DECIDE');
      expect(decide.allowed).toBe(false);
      expect(decide.reasonCode).toBe('FOUR_EYES');
      expect(decide.message).toContain('Otra persona debe aprobar');
    });

    it('un aprobador distinto sí puede decidir y puede reasignar', () => {
      const d = tomar();
      const visto = detalle(d.id, aprobador).body;
      expect(accion(visto, 'DECIDE').allowed).toBe(true);
      expect(accion(visto, 'REASSIGN').allowed).toBe(true);
      expect(visto.assignableReviewers.length).toBeGreaterThan(0);
    });

    it('un revisor no recibe la lista de a quién reasignar', () => {
      expect(detalle(primeraEn('SUBMITTED').id).body.assignableReviewers).toEqual([]);
    });
  });

  describe('pedir información, liberar, reasignar, suspender y reponer', () => {
    it('pedir información pausa el plazo y da un plazo al médico', () => {
      const d = tomar();
      expect(d.dueAt).not.toBeNull();
      const r = llamar('POST', `/admissions/${d.id}/request-info`, { ...MOTIVO, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('INFO_REQUESTED');
      expect(r.body.dueAt).toBeNull();
      expect(Date.parse(r.body.infoDueAt)).toBeGreaterThan(Date.now() + 25 * 86_400_000);
    });

    it('sin código o sin texto, 412', () => {
      const d = tomar();
      expect(llamar('POST', `/admissions/${d.id}/request-info`, { reason: 'Falta el reverso.', expectedRowVersion: d.rowVersion }).status).toBe(412);
      expect(llamar('POST', `/admissions/${d.id}/request-info`, { reasonCode: 'OTHER', expectedRowVersion: d.rowVersion }).status).toBe(412);
    });

    it('liberar devuelve la revisión a la cola', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/release`, { expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('SUBMITTED');
      expect(r.body.assignedTo).toBeNull();
    });

    it('reasignar la pasa a otra persona; un destino inválido es 412', () => {
      const d = tomar();
      const destino = detalle(d.id, aprobador).body.assignableReviewers.find((p: any) => p.id !== revisor.id);
      const malo = llamar('POST', `/admissions/${d.id}/reassign`, { assigneeId: 'nadie', expectedRowVersion: d.rowVersion }, aprobador);
      expect(malo.status).toBe(412);
      const r = llamar('POST', `/admissions/${d.id}/reassign`, { assigneeId: destino.id, expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(200);
      expect(r.body.assignedTo.id).toBe(destino.id);
    });

    it('un revisor no puede reasignar', () => {
      const d = tomar();
      expect(llamar('POST', `/admissions/${d.id}/reassign`, { assigneeId: revisor.id, expectedRowVersion: d.rowVersion }).status).toBe(403);
    });

    it('suspender una verificada y reponerla, ambas con motivo', () => {
      const fila = primeraEn('VERIFIED');
      const sinMotivo = llamar('POST', `/admissions/${fila.id}/suspend`, { expectedRowVersion: fila.rowVersion }, aprobador);
      expect(sinMotivo.status).toBe(412);
      const susp = llamar('POST', `/admissions/${fila.id}/suspend`, { ...MOTIVO, expectedRowVersion: fila.rowVersion }, aprobador);
      expect(susp.status).toBe(200);
      expect(susp.body.status.code).toBe('SUSPENDED');
      const rep = llamar('POST', `/admissions/${fila.id}/reinstate`, { reason: 'Se resolvió la denuncia.', expectedRowVersion: susp.body.rowVersion }, aprobador);
      expect(rep.body.status.code).toBe('VERIFIED');
    });

    it('no se suspende una admisión que no está verificada', () => {
      const fila = primeraEn('SUBMITTED');
      expect(llamar('POST', `/admissions/${fila.id}/suspend`, { ...MOTIVO, expectedRowVersion: fila.rowVersion }, aprobador).status).toBe(412);
    });
  });

  describe('los documentos', () => {
    it('el acceso queda registrado en el historial sin subir la versión', () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      const doc = d.documents[0];
      const acceso = llamar('GET', `/admissions/${d.id}/documents/${doc.fileId}`);
      expect(acceso.status).toBe(200);
      expect(acceso.body.url).toContain(doc.fileId);
      expect(Date.parse(acceso.body.expiresAt)).toBeGreaterThan(Date.now());
      const despues = detalle(d.id).body;
      expect(despues.events.at(-1).type).toBe('DOCUMENT_VIEWED');
      expect(despues.rowVersion).toBe(d.rowVersion);
    });

    it('un archivo que no es de la admisión es 404 y sin rol, 403', () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      expect(llamar('GET', `/admissions/${d.id}/documents/otro-archivo`).status).toBe(404);
      expect(llamar('GET', `/admissions/${d.id}/documents/${d.documents[0].fileId}`, undefined, paciente).status).toBe(403);
    });

    it('el contenido es un PNG o un PDF de verdad y lo lee quien revisa, no un paciente', async () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      const imagen = d.documents.find((x: any) => x.mimeType === 'image/png');
      const pdf = d.documents.find((x: any) => x.mimeType === 'application/pdf');
      const png = admissionFileReply(imagen.fileId, revisor);
      expect(png?.status).toBe(200);
      const bytes = new Uint8Array(await (png!.body as Blob).arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([137, 80, 78, 71]);
      const pdfBytes = new Uint8Array(await (admissionFileReply(pdf.fileId, revisor)!.body as Blob).arrayBuffer());
      expect(String.fromCharCode(...pdfBytes.slice(0, 5))).toBe('%PDF-');
      expect(admissionFileReply(imagen.fileId, paciente)?.status).toBe(403);
      // El dueño del documento también lo puede leer.
      const suya = lista().body.items.find((i: any) => i.practitioner.fullName.includes('Ramiro'));
      const suyoDoc = detalle(suya.id).body.documents[0];
      expect(admissionFileReply(suyoDoc.fileId, medicoNuevo)?.status).toBe(200);
      expect(admissionFileReply(suyoDoc.fileId, medica)?.status).toBe(403);
    });

    it('la semilla trae un caso con decenas de documentos y nombres larguísimos', () => {
      const grande = lista().body.items
        .map((i: any) => detalle(i.id).body)
        .find((d: any) => d.documents.length >= 50);
      expect(grande).toBeDefined();
      expect(grande.documents.some((x: any) => x.name.length > 100)).toBe(true);
      expect(grande.documents.some((x: any) => x.sizeBytes >= 5_000_000)).toBe(true);
    });
  });

  describe('el formulario llenado', () => {
    it('trae secciones, marca los datos obligatorios que faltan y no inventa valores', () => {
      const incompleta = lista().body.items
        .map((i: any) => detalle(i.id).body)
        .find((d: any) => d.submittedForm.some((s: any) => s.fields.some((f: any) => f.required && f.value === null)));
      expect(incompleta).toBeDefined();
      const secciones = incompleta.submittedForm.map((s: any) => s.key);
      expect(secciones).toEqual(expect.arrayContaining(['personal', 'contact', 'home', 'licenses', 'education', 'specialties']));
    });

    it('los campos enlazan a un requisito que existe', () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      const codigos = new Set(d.requirements.map((r: any) => r.code));
      for (const s of d.submittedForm) {
        for (const f of s.fields) {
          if (f.requirementCode !== null && f.requirementCode !== 'SPECIALTY_CERTIFICATE') {
            expect(codigos.has(f.requirementCode)).toBe(true);
          }
        }
      }
    });
  });

  describe('el vocabulario', () => {
    it('no promete consultas a entidades ni trae direcciones inventadas', () => {
      const texto = JSON.stringify(lista().body.items.map((i: any) => detalle(i.id).body.requirements));
      expect(texto).not.toMatch(/SEGIP/i);
      expect(texto).not.toMatch(/https?:\/\//);
    });

    it('el colegio es opcional y la firma no es un requisito de verificación', () => {
      const d = detalle(primeraEn('SUBMITTED').id).body;
      expect(d.requirements.find((r: any) => r.code === 'COLLEGE_REGISTRATION').mandatory).toBe(false);
      expect(d.requirements.some((r: any) => r.code === 'SIGNATURE_SEAL')).toBe(false);
    });

    it('el plazo es de tres días hábiles', () => {
      const fila = lista().body.items.find((i: any) => i.status.code === 'SUBMITTED' && i.dueAt !== null);
      const dias = (Date.parse(fila.dueAt) - Date.parse(fila.submittedAt)) / 86_400_000;
      expect(dias).toBeGreaterThanOrEqual(3);
      expect(dias).toBeLessThanOrEqual(5);
    });
  });

  describe('lo que ve el propio médico', () => {
    it('quien no tiene admisión recibe 404', () => {
      expect(llamar('GET', '/profiles/practitioners/me/admission', undefined, paciente).status).toBe(404);
    });

    it('la médica con la que se entra está verificada', () => {
      const r = llamar('GET', '/profiles/practitioners/me/admission', undefined, medica);
      expect(r.body.status.code).toBe('VERIFIED');
    });

    it('el médico nuevo ve qué se le pidió, sin notas internas ni códigos internos', () => {
      const r = llamar('GET', '/profiles/practitioners/me/admission', undefined, medicoNuevo);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('INFO_REQUESTED');
      expect(r.body.infoRequestedText).toContain('Falta');
      expect(r.body.resubmissionsRemaining).toBe(MAX_REENVIOS);
      expect(JSON.stringify(r.body)).not.toMatch(/internalNote|Nota interna|reasonCode/);
      expect(r.body.items.find((i: any) => i.state === 'INFO_REQUIRED').reasonText).toBeTruthy();
    });

    it('reenviar exige la atestación', () => {
      const r = llamar('POST', '/profiles/practitioners/me/admission/resubmit', {}, medicoNuevo);
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_ATTESTATION_REQUIRED');
    });

    it('reenviar con atestación vuelve a SUBMITTED, reinicia lo observado y descuenta un reenvío', () => {
      const r = llamar('POST', '/profiles/practitioners/me/admission/resubmit', { attested: true, attestationVersion: '2026-10' }, medicoNuevo);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('SUBMITTED');
      expect(r.body.resubmissionsRemaining).toBe(MAX_REENVIOS - 1);
      expect(r.body.items.some((i: any) => i.state === 'INFO_REQUIRED')).toBe(false);
      // La bandeja la ve de nuevo como enviada, con plazo corriendo.
      const fila = lista('status=SUBMITTED', revisor).body.items.find((i: any) => i.practitioner.fullName.includes('Ramiro'));
      expect(fila.dueAt).not.toBeNull();
    });

    it('no se puede reenviar lo que no está observado', () => {
      const r = llamar('POST', '/profiles/practitioners/me/admission/resubmit', { attested: true, attestationVersion: '2026-10' }, medica);
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_INVALID_TRANSITION');
    });

    it('hay un tope de reenvíos', () => {
      const cuerpo = { attested: true, attestationVersion: '2026-10' };
      for (let i = 0; i < MAX_REENVIOS; i++) {
        expect(llamar('POST', '/profiles/practitioners/me/admission/resubmit', cuerpo, medicoNuevo).status).toBe(200);
        // El equipo vuelve a pedir información para que el médico pueda reenviar otra vez.
        const fila = lista('status=SUBMITTED').body.items.find((x: any) => x.practitioner.fullName.includes('Ramiro'));
        const tomada = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion });
        llamar('POST', `/admissions/${fila.id}/request-info`, { ...MOTIVO, expectedRowVersion: tomada.body.rowVersion });
      }
      const r = llamar('POST', '/profiles/practitioners/me/admission/resubmit', cuerpo, medicoNuevo);
      expect(r.status).toBe(412);
      expect(r.body.details.reason).toBe('ADMISSION_RESUBMISSION_LIMIT');
    });
  });

  describe('el alta de un médico', () => {
    it('crea una admisión enviada, con todos sus requisitos pendientes y el plazo corriendo', () => {
      const antes = lista().body.counts['SUBMITTED'] as number;
      crearAdmisionDeAltaDeDoctor({ userId: 'u-nuevo', profileId: 'p-nuevo', displayName: 'Lucía Torrez Aramayo', nationalId: '7771234' });
      const despues = lista().body;
      expect(despues.counts['SUBMITTED']).toBe(antes + 1);
      const fila = despues.items.find((i: any) => i.practitioner.fullName === 'Lucía Torrez Aramayo');
      expect(fila.status.code).toBe('SUBMITTED');
      expect(fila.dueAt).not.toBeNull();
      expect(fila.requirementsSummary.verified).toBe(0);
      expect(fila.practitioner.maskedNationalId).toBe('****234');
    });
  });
});
