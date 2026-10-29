/* eslint-disable @typescript-eslint/no-explicit-any -- los cuerpos son JSON del contrato HTTP del backend (sin tipo estático en la prueba); lo que se verifica es su forma, no su tipo TS. */
import { HttpHeaders } from '@angular/common/http';

import { admissionFileReply } from '../fixtures/admission-files';
import { MAX_REENVIOS, OTRO_REVISOR } from '../fixtures/admissions';
import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import {
  crearAdmisionDeAltaDeDoctor,
  registrarAdmisiones,
  reemplazarEvidencia,
  reiniciarAdmisiones,
  vencerEnlaces,
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

/** La API habla en español (`ENVIADA`, `EN_REVISION`…): el filtro y los códigos de estado van así en el cable. */
function primeraEn(estado: string, extra = ''): any {
  const r = lista(`status=${estado}&${extra}`);
  expect(r.status).toBe(200);
  const fila = r.body.items[0];
  expect(fila, `no hay admisión ${estado}`).toBeDefined();
  return fila;
}

const detalle = (id: string, user = revisor) => llamar('GET', `/admissions/${id}`, undefined, user);

/** La ficha n de un requisito: lo que se revisa. `id` es el de su revisión (el `:itemId` de la ruta) y `rowVersion`, el de la ficha. */
const fichaDe = (d: any, code: string, n = 0): any => d.requirements.find((r: any) => r.code === code).items[n];

/** Revisa una ficha mandando, por defecto, la versión de LA FICHA y la huella que el revisor tenía en pantalla. */
function revisar(d: any, ficha: any, cuerpo: Record<string, unknown>, user = revisor): Resp {
  return llamar('POST', `/admissions/${d.id}/items/${ficha.id}/review`, { expectedRowVersion: ficha.rowVersion, ...cuerpo }, user);
}

const MATRICULA = 'MATRICULA_MSALUD';
const FUENTE = { sourceType: 'REGISTRO_MINSALUD', sourceRef: 'Comprobante 4512' };
const MOTIVO = { reasonCode: 'ILEGIBLE', reason: 'La imagen está cortada.' };

/** Toma una admisión enviada y devuelve su detalle. */
function tomar(): any {
  const fila = primeraEn('ENVIADA');
  const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion });
  expect(r.status).toBe(200);
  return r.body;
}

/** Verifica TODAS las fichas del checklist (también las de requisitos opcionales que el médico aportó: el servidor las bloquea mientras estén pendientes). */
function verificarTodo(d: any): any {
  let actual = d;
  for (const req of d.requirements) {
    for (const ficha of req.items) {
      const vigente = fichaDe(actual, req.code, req.items.indexOf(ficha));
      const r = revisar(actual, vigente, { decision: 'VERIFIED', ...FUENTE, evidenceSha256: vigente.evidenceSha256 });
      expect(r.status, `${req.code}: ${JSON.stringify(r.body)}`).toBe(200);
      actual = r.body;
    }
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

    it('trae cuentas por estado y las ordena por vencimiento (el cable siempre trae dueAt; pausarlo es cosa del cliente)', () => {
      const r = lista();
      expect(r.body.counts['ENVIADA']).toBeGreaterThan(0);
      expect(r.body.counts['VERIFICADA']).toBeGreaterThan(0);
      const plazos = r.body.items.map((i: any) => Date.parse(i.dueAt));
      expect(plazos.every((t: number) => Number.isFinite(t))).toBe(true);
      expect([...plazos].sort((a, b) => a - b)).toEqual(plazos);
    });

    it('filtra por estado, tipo, asignación y vencimiento', () => {
      expect(lista('status=VERIFICADA').body.items.every((i: any) => i.status.code === 'VERIFICADA')).toBe(true);
      expect(lista('type=OTRO_TIPO').body.items).toHaveLength(0);
      expect(lista('assignedTo=none').body.items.every((i: any) => i.assignedTo === null)).toBe(true);
      const vencidas = lista('overdue=true').body.items;
      expect(vencidas.length).toBeGreaterThan(0);
      expect(vencidas.every((i: any) => i.overdue === true)).toBe(true);
    });

    it('los contadores no se ven afectados por el filtro de estado', () => {
      const todas = lista().body.counts;
      expect(lista('status=VERIFICADA').body.counts).toEqual(todas);
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
      const fila = primeraEn('ENVIADA');
      const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion }, aprobador);
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_REVIEWER');
    });

    it('SECURITY_ADMIN solo no puede tomarla: sin rol implícito', () => {
      const fila = primeraEn('ENVIADA');
      expect(llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion }, soloSeguridad).status).toBe(403);
    });

    it('queda en revisión, asignada y con un evento', () => {
      const d = tomar();
      expect(d.status.code).toBe('EN_REVISION');
      expect(d.assignedTo.id).toBe(revisor.id);
      expect(d.events.at(-1).type).toBe('CLAIMED');
      expect(d.rowVersion).toBeGreaterThan(1);
    });

    it('al tomarla se materializa la revisión de cada ficha, con su propia versión', () => {
      const antes = detalle(primeraEn('ENVIADA').id).body;
      expect(antes.requirements.flatMap((r: any) => r.items).every((f: any) => f.id === null && f.rowVersion === null)).toBe(true);
      const d = tomar();
      const fichas = d.requirements.flatMap((r: any) => r.items);
      expect(fichas.length).toBeGreaterThan(0);
      expect(fichas.every((f: any) => typeof f.id === 'string' && f.rowVersion === 1)).toBe(true);
    });

    it('con una versión vieja responde 409 ADMISSION_STALE', () => {
      const fila = primeraEn('ENVIADA');
      const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion - 1 });
      expect(r.status).toBe(409);
      expect(r.body.reason).toBe('ADMISSION_STALE');
      expect(r.body.details.currentRowVersion).toBe(fila.rowVersion);
    });

    it('sin versión esperada responde 412', () => {
      const fila = primeraEn('ENVIADA');
      expect(llamar('POST', `/admissions/${fila.id}/claim`, {}).status).toBe(412);
    });

    it('una admisión que no está enviada responde 412 de transición inválida', () => {
      const fila = primeraEn('VERIFICADA');
      const r = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion });
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_INVALID_TRANSITION');
    });

    it('un id que no existe es 404', () => {
      expect(llamar('GET', '/admissions/no-existe').status).toBe(404);
    });
  });

  describe('revisar una ficha', () => {
    it('verificar una ficha que exige fuente sin el tipo de fuente: 412', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const r = revisar(d, ficha, { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256 });
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_ITEM_REQUIRES_SOURCE');
    });

    it('un requisito que no exige fuente (la cédula) se verifica sin declararla', () => {
      const d = tomar();
      const ficha = fichaDe(d, 'CI');
      expect(d.requirements.find((r: any) => r.code === 'CI').requiresSource).toBe(false);
      const r = revisar(d, ficha, { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256 });
      expect(r.status).toBe(200);
      expect(fichaDe(r.body, 'CI').state).toBe('VERIFIED');
    });

    it('la referencia es opcional salvo en «Otra fuente»', () => {
      const d = tomar();
      const a = fichaDe(d, MATRICULA);
      const b = fichaDe(d, 'TITULO_UNIVERSITARIO');
      const sinRef = revisar(d, a, { decision: 'VERIFIED', evidenceSha256: a.evidenceSha256, sourceType: 'SEDES' });
      expect(sinRef.status).toBe(200);
      expect(fichaDe(sinRef.body, MATRICULA).sourceType).toBe('SEDES');
      expect(fichaDe(sinRef.body, MATRICULA).sourceRef).toBeNull();
      const otra = revisar(sinRef.body, b, { decision: 'VERIFIED', evidenceSha256: b.evidenceSha256, sourceType: 'OTRO' });
      expect(otra.status).toBe(412);
      expect(otra.body.reason).toBe('ADMISSION_ITEM_REQUIRES_SOURCE');
    });

    it('no obliga a una dirección web: un número de comprobante alcanza', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const r = revisar(d, ficha, { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256, ...FUENTE });
      expect(r.status).toBe(200);
      expect(fichaDe(r.body, MATRICULA).sourceRef).toBe('Comprobante 4512');
      expect(fichaDe(r.body, MATRICULA).sourceType).toBe('REGISTRO_MINSALUD');
    });

    it('rechazar exige el texto; el código es opcional y, sin él, queda «OTRO»', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const sinTexto = revisar(d, ficha, { decision: 'REJECTED', reasonCode: 'ILEGIBLE' });
      expect(sinTexto.status).toBe(412);
      expect(sinTexto.body.reason).toBe('ADMISSION_REASON_REQUIRED');
      const sinCodigo = revisar(d, ficha, { decision: 'REJECTED', reason: 'No se lee el número.' });
      expect(sinCodigo.status).toBe(200);
      expect(fichaDe(sinCodigo.body, MATRICULA).reasonCode).toBe('OTRO');
    });

    it('el motivo acepta 500 caracteres y rechaza 501', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const en501 = revisar(d, ficha, { decision: 'REJECTED', reasonCode: 'OTRO', reason: 'a'.repeat(501) });
      expect(en501.status).toBe(412);
      const en500 = revisar(d, ficha, { decision: 'REJECTED', reasonCode: 'OTRO', reason: 'a'.repeat(500) });
      expect(en500.status).toBe(200);
      expect(fichaDe(en500.body, MATRICULA).reasonText).toHaveLength(500);
    });

    it('el contrato no fija un largo mínimo del motivo: uno corto alcanza, uno en blanco no', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      expect(revisar(d, ficha, { decision: 'REJECTED', reasonCode: 'OTRO', reason: '   ' }).status).toBe(412);
      const corto = revisar(d, ficha, { decision: 'REJECTED', reasonCode: 'OTRO', reason: 'abcd' });
      expect(corto.status).toBe(200);
    });

    it('guarda código, texto y nota interna, y el avance se actualiza', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const r = revisar(d, ficha, { decision: 'INFO_REQUIRED', ...MOTIVO, internalNote: 'Coincide con otro expediente.' });
      const guardada = fichaDe(r.body, MATRICULA);
      expect(guardada.state).toBe('INFO_REQUIRED');
      expect(guardada.reasonCode).toBe('ILEGIBLE');
      expect(guardada.internalNote).toBe('Coincide con otro expediente.');
      expect(r.body.requirementsSummary.pending).toBeGreaterThan(0);
      expect(r.body.documents.filter((x: any) => x.requirementCode === MATRICULA).every((x: any) => x.reviewState === 'INFO_REQUIRED')).toBe(true);
    });

    it('la revisión de una ficha sube la versión de LA FICHA, no la de la admisión', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const r = revisar(d, ficha, { decision: 'REJECTED', ...MOTIVO });
      expect(r.body.rowVersion).toBe(d.rowVersion);
      expect(fichaDe(r.body, MATRICULA).rowVersion).toBe(ficha.rowVersion + 1);
    });

    it('repetir la misma revisión no escribe nada ni duplica el evento', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const cuerpo = { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256, ...FUENTE };
      const primera = revisar(d, ficha, cuerpo);
      const repetida = revisar(d, ficha, cuerpo);
      expect(repetida.status).toBe(200);
      expect(repetida.body.events).toHaveLength(primera.body.events.length);
      expect(fichaDe(repetida.body, MATRICULA).rowVersion).toBe(fichaDe(primera.body, MATRICULA).rowVersion);
    });

    it('solo quien tomó la revisión puede revisar: otro revisor recibe 403', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const otro = { ...revisor, id: 'otro-revisor' };
      const r = revisar(d, ficha, { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256, ...FUENTE }, otro);
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe('ADMISSION_NOT_ASSIGNED_TO_ACTOR');
    });

    it('una ficha inexistente es 404 y una versión vieja de la ficha, 409', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      expect(llamar('POST', `/admissions/${d.id}/items/no-existe/review`, { decision: 'VERIFIED', ...FUENTE, expectedRowVersion: ficha.rowVersion }).status).toBe(404);
      const vieja = revisar(d, ficha, { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256, ...FUENTE, expectedRowVersion: ficha.rowVersion - 1 });
      expect(vieja.status).toBe(409);
      expect(vieja.body.reason).toBe('ADMISSION_STALE');
    });

    it('no se puede revisar una admisión que no está en revisión', () => {
      const d = detalle(primeraEn('VERIFICADA').id).body;
      const ficha = fichaDe(d, MATRICULA);
      const r = revisar(d, ficha, { decision: 'REJECTED', ...MOTIVO });
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_INVALID_TRANSITION');
    });
  });

  describe('la huella de la evidencia', () => {
    it('cada ficha y cada documento traen su huella de 64 caracteres', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      for (const r of d.requirements) for (const f of r.items) expect(f.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
      for (const doc of d.documents) expect(doc.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('verificar sin huella es 412: no se decide sin saber qué se miró', () => {
      const d = tomar();
      const r = revisar(d, fichaDe(d, MATRICULA), { decision: 'VERIFIED', ...FUENTE });
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_EVIDENCE_REQUIRED');
    });

    it('si el médico reemplazó el archivo mientras se lo miraba, 409 ADMISSION_EVIDENCE_CHANGED y no se verifica', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      expect(reemplazarEvidencia(d.id, MATRICULA)).toBe(true);
      const r = revisar(d, ficha, { decision: 'VERIFIED', ...FUENTE, evidenceSha256: ficha.evidenceSha256 });
      expect(r.status).toBe(409);
      expect(r.body.reason).toBe('ADMISSION_EVIDENCE_CHANGED');
      const despues = detalle(d.id).body;
      expect(fichaDe(despues, MATRICULA).state).toBe('PENDING');
      expect(fichaDe(despues, MATRICULA).evidenceSha256).not.toBe(ficha.evidenceSha256);
      // Con la huella nueva —tras volver a mirar— sí se puede decidir.
      const nueva = fichaDe(despues, MATRICULA);
      const ok = revisar(despues, nueva, { decision: 'VERIFIED', ...FUENTE, evidenceSha256: nueva.evidenceSha256 });
      expect(ok.status).toBe(200);
    });

    it('al rechazar la huella es opcional, pero si viene y no coincide también es 409', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      const rechazada = revisar(d, ficha, { decision: 'REJECTED', ...MOTIVO });
      expect(rechazada.status).toBe(200);
      const d2 = detalle(d.id).body;
      reemplazarEvidencia(d.id, MATRICULA);
      const r = revisar(d2, fichaDe(d2, MATRICULA), { decision: 'INFO_REQUIRED', ...MOTIVO, evidenceSha256: ficha.evidenceSha256 });
      expect(r.status).toBe(409);
      expect(r.body.reason).toBe('ADMISSION_EVIDENCE_CHANGED');
    });

    it('una ficha ya revisada cuyo archivo cambia vuelve a pendiente y lo avisa (evidenceChanged)', () => {
      const d = tomar();
      const ficha = fichaDe(d, MATRICULA);
      expect(revisar(d, ficha, { decision: 'VERIFIED', evidenceSha256: ficha.evidenceSha256, ...FUENTE }).status).toBe(200);
      reemplazarEvidencia(d.id, MATRICULA);
      const despues = fichaDe(detalle(d.id).body, MATRICULA);
      expect(despues.evidenceChanged).toBe(true);
      expect(despues.state).toBe('PENDING');
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
      expect(r.body.reason).toBe('ADMISSION_SELF_ACCESS');
      expect(r.body.message).toContain('No puede revisar su propia solicitud');
      const accion = llamar('POST', `/admissions/${suya.id}/claim`, { expectedRowVersion: suya.rowVersion }, comoMedico());
      expect(accion.body.reason).toBe('ADMISSION_SELF_ACCESS');
    });
  });

  describe('la decisión final', () => {
    it('solo la toma un aprobador', () => {
      const d = verificarTodo(tomar());
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, revisor);
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_APPROVER');
    });

    it('con un obligatorio sin verificar responde 412 ADMISSION_CHECKLIST_INCOMPLETE y trae los bloqueos', () => {
      const d = tomar();
      expect(d.canVerify).toBe(false);
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_CHECKLIST_INCOMPLETE');
      expect(r.body.details.blockers.length).toBeGreaterThan(0);
      expect(r.body.details.blockers.map((b: any) => b.requirementCode)).toContain(MATRICULA);
    });

    it('con todo verificado el servidor lo dice (canVerify) y otra persona verifica al profesional', () => {
      const d = verificarTodo(tomar());
      expect(d.canVerify).toBe(true);
      expect(d.blockers).toEqual([]);
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('VERIFICADA');
      expect(r.body.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Y queda en la lista, con el estado nuevo.
      expect(lista('status=VERIFICADA').body.items.map((i: any) => i.id)).toContain(d.id);
    });

    it('mientras queden fichas pendientes el detalle nombra los bloqueos y el servidor no deja verificar', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      expect(d.canVerify).toBe(false);
      expect(d.fourEyesRequired).toBe(true);
      expect(d.blockers.length).toBeGreaterThan(0);
      expect(d.blockers.every((b: any) => ['MISSING', 'REJECTED', 'PENDING', 'INFO_REQUIRED', 'BELOW_MINIMUM'].includes(b.reason))).toBe(true);
    });

    it('la decisión no lleva ítems: el servidor deriva el estado de las revisiones y rechaza los que lleguen (412)', () => {
      const d = verificarTodo(tomar());
      const conItems = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', items: [{ type: 'LICENSE', id: 'x', decision: 'VERIFIED' }], expectedRowVersion: d.rowVersion }, aprobador);
      expect(conItems.status).toBe(412);
      expect(conItems.body.reason).toBe('ADMISSION_DECISION_ITEMS_NOT_ACCEPTED');
      const sinItems = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(sinItems.status).toBe(200);
    });

    it('cuatro ojos: quien revisó no puede decidir aunque tenga el rol de aprobador', () => {
      const d = verificarTodo(tomar());
      const ambos = { ...revisor, roles: [...revisor.roles, 'ADMISSIONS_APPROVER'] };
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'VERIFIED', expectedRowVersion: d.rowVersion }, ambos);
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe('ADMISSION_FOUR_EYES_REQUIRED');
      expect(r.body.message).toContain('Otra persona debe aprobar');
    });

    it('el propio profesional no puede aprobar su admisión aunque tenga el rol', () => {
      const suya = lista().body.items.find((i: any) => i.practitioner.fullName.includes('Ramiro'));
      const d = detalle(suya.id).body;
      const comoMedico = { ...aprobador, id: medicoNuevo.id };
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', ...MOTIVO, expectedRowVersion: d.rowVersion }, comoMedico);
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe('ADMISSION_SELF_ACCESS');
    });

    it('rechazar exige motivo; guarda código y texto para el médico', () => {
      const d = tomar();
      const sin = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', expectedRowVersion: d.rowVersion }, aprobador);
      expect(sin.status).toBe(412);
      expect(sin.body.reason).toBe('ADMISSION_REASON_REQUIRED');
      const con = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', reasonCode: 'NO_FIGURA_EN_REGISTRO', reason: 'La matrícula no figura.', internalNote: 'Revisar con el colegio.', expectedRowVersion: d.rowVersion }, aprobador);
      expect(con.status).toBe(200);
      expect(con.body.status.code).toBe('RECHAZADA');
      expect(con.body.decisionReasonText).toBe('La matrícula no figura.');
      expect(con.body.decisionReasonCode).toBe('NO_FIGURA_EN_REGISTRO');
    });
  });

  describe('quién puede qué lo decide la API en cada petición (ya no hay allowedActions)', () => {
    it('el detalle no trae listas de acciones permitidas ni de a quién reasignar', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      expect(d.allowedActions).toBeUndefined();
      expect(d.assignableReviewers).toBeUndefined();
    });

    it('un revisor toma una enviada y no decide: la decisión le responde 403 con el rol que falta', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/decision`, { decision: 'REJECTED', ...MOTIVO, expectedRowVersion: d.rowVersion }, revisor);
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_APPROVER');
    });

    it('un aprobador distinto sí decide y reasigna', () => {
      const d = tomar();
      expect(llamar('POST', `/admissions/${d.id}/reassign`, { toUserId: OTRO_REVISOR.id, expectedRowVersion: d.rowVersion }, aprobador).status).toBe(200);
    });
  });

  describe('pedir información, liberar, reasignar, suspender y reponer', () => {
    it('pedir información da un plazo al médico y el estado deja de correr el SLA', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/request-info`, { ...MOTIVO, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('INFORMACION_REQUERIDA');
      expect(r.body.infoRequestedText).toBe('La imagen está cortada.');
      expect(Date.parse(r.body.infoDueAt)).toBeGreaterThan(Date.now() + 25 * 86_400_000);
    });

    it('sin texto, 412; sin código, queda «OTRO»', () => {
      const d = tomar();
      const sinTexto = llamar('POST', `/admissions/${d.id}/request-info`, { reasonCode: 'OTRO', expectedRowVersion: d.rowVersion });
      expect(sinTexto.status).toBe(412);
      expect(sinTexto.body.reason).toBe('ADMISSION_REASON_REQUIRED');
      const sinCodigo = llamar('POST', `/admissions/${d.id}/request-info`, { reason: 'Falta el reverso.', expectedRowVersion: d.rowVersion });
      expect(sinCodigo.status).toBe(200);
      expect(sinCodigo.body.events.at(-1).reasonCode).toBe('OTRO');
    });

    it('liberar devuelve la revisión a la cola', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/release`, { expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('ENVIADA');
      expect(r.body.assignedTo).toBeNull();
    });

    it('reasignar la pasa a otra cuenta de revisión; un destino inválido es 412', () => {
      const d = tomar();
      const malo = llamar('POST', `/admissions/${d.id}/reassign`, { toUserId: 'nadie', expectedRowVersion: d.rowVersion }, aprobador);
      expect(malo.status).toBe(412);
      expect(malo.body.reason).toBe('ADMISSION_ASSIGNEE_INVALID');
      const r = llamar('POST', `/admissions/${d.id}/reassign`, { toUserId: OTRO_REVISOR.id, expectedRowVersion: d.rowVersion }, aprobador);
      expect(r.status).toBe(200);
      expect(r.body.assignedTo.id).toBe(OTRO_REVISOR.id);
    });

    it('un revisor no puede reasignar', () => {
      const d = tomar();
      const r = llamar('POST', `/admissions/${d.id}/reassign`, { toUserId: OTRO_REVISOR.id, expectedRowVersion: d.rowVersion });
      expect(r.status).toBe(403);
      expect(r.body.details.requiredRole).toBe('ADMISSIONS_APPROVER');
    });

    it('suspender una verificada y reponerla, ambas con motivo', () => {
      const fila = primeraEn('VERIFICADA');
      const sinMotivo = llamar('POST', `/admissions/${fila.id}/suspend`, { expectedRowVersion: fila.rowVersion }, aprobador);
      expect(sinMotivo.status).toBe(412);
      const susp = llamar('POST', `/admissions/${fila.id}/suspend`, { ...MOTIVO, expectedRowVersion: fila.rowVersion }, aprobador);
      expect(susp.status).toBe(200);
      expect(susp.body.status.code).toBe('SUSPENDIDA');
      const rep = llamar('POST', `/admissions/${fila.id}/reinstate`, { reason: 'Se resolvió la denuncia.', expectedRowVersion: susp.body.rowVersion }, aprobador);
      expect(rep.body.status.code).toBe('VERIFICADA');
    });

    it('no se suspende una admisión que no está verificada', () => {
      const fila = primeraEn('ENVIADA');
      expect(llamar('POST', `/admissions/${fila.id}/suspend`, { ...MOTIVO, expectedRowVersion: fila.rowVersion }, aprobador).status).toBe(412);
    });
  });

  describe('los documentos', () => {
    const pedirAcceso = (d: any, fileId: string, user = revisor): Resp => llamar('POST', `/admissions/${d.id}/documents/${fileId}/download-url`, {}, user);

    it('la dirección se pide por POST, dura dos minutos y no cambia la versión ni el historial de la admisión', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      const doc = d.documents[0];
      const acceso = pedirAcceso(d, doc.fileId);
      expect(acceso.status).toBe(201);
      expect(acceso.body.url).toContain(doc.fileId);
      expect(acceso.body.name).toBe(doc.name);
      expect(acceso.body.mimeType).toBe(doc.mimeType);
      const vida = Date.parse(acceso.body.expiresAt) - Date.now();
      expect(vida).toBeGreaterThan(60_000);
      expect(vida).toBeLessThanOrEqual(120_000);
      const despues = detalle(d.id).body;
      expect(despues.events).toHaveLength(d.events.length);
      expect(despues.rowVersion).toBe(d.rowVersion);
    });

    it('un archivo que no es de la admisión es 404 y sin rol, 403', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      expect(pedirAcceso(d, 'otro-archivo').status).toBe(404);
      expect(pedirAcceso(d, d.documents[0].fileId, paciente).status).toBe(403);
    });

    it('la dirección firmada sirve el contenido con nosniff y sin caché; una firma alterada es 403 y una vencida, 410', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      const doc = d.documents[0];
      const [ruta, consulta] = (pedirAcceso(d, doc.fileId).body.url as string).split('?') as [string, string];
      const m = router.match('GET', ruta)!;
      const ok = m.handler({
        method: 'GET', path: ruta, params: m.params, query: new URLSearchParams(consulta), body: undefined, headers: new HttpHeaders(), user: revisor,
      } satisfies MockRequest) as any;
      expect(ok.status).toBe(200);
      expect(ok.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(ok.headers['Cache-Control']).toContain('no-store');
      const alterada = llamar('GET', ruta, undefined, revisor, consulta.replace(/signature=.*/, 'signature=falsa'));
      expect(alterada.status).toBe(403);
      expect(alterada.body.reason).toBe('ADMISSION_DOCUMENT_URL_INVALID');
      // La firma está atada a quien la pidió.
      expect(llamar('GET', ruta, undefined, aprobador, consulta).status).toBe(403);
      vencerEnlaces(true);
      const vencida = (pedirAcceso(d, doc.fileId).body.url as string).split('?') as [string, string];
      const gone = llamar('GET', vencida[0], undefined, revisor, vencida[1]);
      expect(gone.status).toBe(410);
      expect(gone.body.reason).toBe('ADMISSION_DOCUMENT_URL_INVALID');
    });

    it('el contenido es un PNG o un PDF de verdad y lo lee quien revisa, no un paciente', async () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
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

    it('la semilla trae un caso con decenas de documentos (uno de 6 MB) y otro con nombres larguísimos', () => {
      const todas = lista().body.items.map((i: any) => detalle(i.id).body);
      const grande = todas.find((d: any) => d.documents.length >= 50);
      expect(grande).toBeDefined();
      expect(grande.documents.some((x: any) => x.sizeBytes >= 5_000_000)).toBe(true);
      const largos = todas.find((d: any) => d.documents.some((x: any) => x.name.length > 100));
      expect(largos).toBeDefined();
    });
  });

  describe('el formulario llenado', () => {
    const SECCIONES = ['personal', 'contact', 'addresses', 'licenses', 'education', 'specialties', 'practices'];

    it('trae el formulario por secciones y no inventa lo que el médico no declaró', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      expect(Object.keys(d.submittedForm)).toEqual(expect.arrayContaining(SECCIONES));
      expect(d.submittedFormSource).toBe('SNAPSHOT');
      const incompleta = lista().body.items
        .map((i: any) => detalle(i.id).body)
        .find((x: any) => x.submittedForm.personal.birthDate === null);
      expect(incompleta).toBeDefined();
      expect(incompleta.submittedForm.personal.age).toBeNull();
      expect(incompleta.submittedForm.contact.personalMobile).toBeNull();
    });

    it('los campos enlazan a un requisito que existe', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      const codigos = new Set(d.requirements.map((r: any) => r.code));
      const f = d.submittedForm;
      const enlaces = [f.personal.requirementCode, ...f.licenses, ...f.education, ...f.specialties, ...f.practices]
        .map((x: any) => (typeof x === 'string' ? x : x.requirementCode));
      expect(enlaces.length).toBeGreaterThan(1);
      for (const codigo of enlaces) expect(codigos.has(codigo), String(codigo)).toBe(true);
    });
  });

  describe('el vocabulario', () => {
    it('no promete consultas a entidades ni trae direcciones inventadas', () => {
      const texto = JSON.stringify(lista().body.items.map((i: any) => detalle(i.id).body.requirements));
      expect(texto).not.toMatch(/SEGIP/i);
      expect(texto).not.toMatch(/https?:\/\//);
    });

    it('la firma no es un requisito de verificación y el SEDES es opcional', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      expect(d.requirements.some((r: any) => r.code === 'SIGNATURE_SEAL')).toBe(false);
      expect(d.requirements.find((r: any) => r.code === 'REGISTRO_SEDES').required).toBe(false);
    });

    it('el catálogo del médico exige cédula, matrícula, título y Colegio Médico; lo demás es opcional', () => {
      const d = detalle(primeraEn('ENVIADA').id).body;
      const obligatorios = d.requirements.filter((r: any) => r.required).map((r: any) => r.code).sort();
      expect(obligatorios).toEqual(['CI', 'MATRICULA_MSALUD', 'REGISTRO_COLEGIO_MEDICO', 'TITULO_UNIVERSITARIO']);
    });

    it('el plazo es de tres días hábiles', () => {
      const fila = lista().body.items.find((i: any) => i.status.code === 'ENVIADA');
      const dias = (Date.parse(fila.dueAt) - Date.parse(fila.submittedAt)) / 86_400_000;
      expect(dias).toBeGreaterThanOrEqual(3);
      expect(dias).toBeLessThanOrEqual(5);
    });
  });

  describe('lo que ve el propio médico', () => {
    const mia = (user: any) => llamar('GET', '/profiles/practitioners/me/admission', undefined, user);
    const reenviar = (user: any, cuerpo: unknown = { attested: true, attestationVersion: '2026-10' }) =>
      llamar('POST', '/profiles/practitioners/me/admission/resubmit', cuerpo, user);

    it('quien no tiene admisión recibe 404', () => {
      expect(mia(paciente).status).toBe(404);
    });

    it('la médica con la que se entra está verificada', () => {
      const r = mia(medica);
      expect(r.body.status.code).toBe('VERIFICADA');
      expect(r.body.canResubmit).toBe(false);
    });

    it('el médico nuevo ve qué se le pidió, sin notas internas', () => {
      const r = mia(medicoNuevo);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('INFORMACION_REQUERIDA');
      expect(r.body.infoRequestedText).toContain('Falta');
      expect(r.body.canResubmit).toBe(true);
      expect(r.body.resubmissionCount).toBe(0);
      expect(JSON.stringify(r.body)).not.toMatch(/internalNote|Nota interna/);
      expect(r.body.items.find((i: any) => i.state === 'INFO_REQUIRED').reasonText).toBeTruthy();
      // Lo verificado no arrastra motivo.
      expect(r.body.items.filter((i: any) => i.state === 'VERIFIED').every((i: any) => i.reasonText === null && i.reasonCode === null)).toBe(true);
    });

    it('la sospecha de fraude es del personal: al médico se le muestra «OTRO»', () => {
      crearAdmisionDeAltaDeDoctor({ userId: 'u-fraude', profileId: 'p-fraude', displayName: 'Prueba Sintética Nueve', nationalId: '9990001' });
      const fila = lista('status=ENVIADA').body.items.find((i: any) => i.practitioner.fullName === 'Prueba Sintética Nueve');
      const tomada = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion }).body;
      const ficha = fichaDe(tomada, MATRICULA);
      expect(revisar(tomada, ficha, { decision: 'REJECTED', reasonCode: 'SOSPECHA_DE_FRAUDE', reason: 'El número no corresponde.', internalNote: 'Mismo sello que otro expediente.' }).status).toBe(200);
      const r = mia({ ...paciente, id: 'u-fraude' });
      expect(r.status).toBe(200);
      const observada = r.body.items.find((i: any) => i.state === 'REJECTED');
      expect(observada.reasonCode).toBe('OTRO');
      expect(JSON.stringify(r.body)).not.toMatch(/SOSPECHA_DE_FRAUDE|Mismo sello/);
    });

    it('reenviar exige la atestación', () => {
      const r = reenviar(medicoNuevo, {});
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_ATTESTATION_REQUIRED');
    });

    it('reenviar con atestación vuelve a ENVIADA, reinicia lo observado y cuenta el reenvío', () => {
      const r = reenviar(medicoNuevo);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('ENVIADA');
      expect(r.body.resubmissionCount).toBe(1);
      expect(r.body.canResubmit).toBe(false);
      expect(r.body.items.some((i: any) => i.state === 'INFO_REQUIRED')).toBe(false);
      // La bandeja la ve de nuevo como enviada, con plazo corriendo.
      const fila = lista('status=ENVIADA', revisor).body.items.find((i: any) => i.practitioner.fullName.includes('Ramiro'));
      expect(Date.parse(fila.dueAt)).toBeGreaterThan(Date.now());
    });

    it('no se puede reenviar lo que no está observado', () => {
      const r = reenviar(medica);
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_INVALID_TRANSITION');
    });

    it('hay un tope de reenvíos', () => {
      for (let i = 0; i < MAX_REENVIOS; i++) {
        expect(reenviar(medicoNuevo).status).toBe(200);
        // El equipo vuelve a pedir información para que el médico pueda reenviar otra vez.
        const fila = lista('status=ENVIADA').body.items.find((x: any) => x.practitioner.fullName.includes('Ramiro'));
        const tomada = llamar('POST', `/admissions/${fila.id}/claim`, { expectedRowVersion: fila.rowVersion });
        llamar('POST', `/admissions/${fila.id}/request-info`, { ...MOTIVO, expectedRowVersion: tomada.body.rowVersion });
      }
      expect(mia(medicoNuevo).body.canResubmit).toBe(false);
      const r = reenviar(medicoNuevo);
      expect(r.status).toBe(412);
      expect(r.body.reason).toBe('ADMISSION_RESUBMISSION_LIMIT');
    });

    it('retirar la solicitud: solo si está enviada o con información pedida', () => {
      expect(mia(medicoNuevo).body.canWithdraw).toBe(true);
      const r = llamar('POST', '/profiles/practitioners/me/admission/withdraw', {}, medicoNuevo);
      expect(r.status).toBe(200);
      expect(r.body.status.code).toBe('RETIRADA');
      expect(r.body.canWithdraw).toBe(false);
      const ya = llamar('POST', '/profiles/practitioners/me/admission/withdraw', {}, medica);
      expect(ya.status).toBe(412);
      expect(ya.body.reason).toBe('ADMISSION_INVALID_TRANSITION');
    });
  });

  describe('el alta de un médico', () => {
    it('crea una admisión enviada, con todos sus requisitos pendientes y el plazo corriendo', () => {
      const antes = lista().body.counts['ENVIADA'] as number;
      crearAdmisionDeAltaDeDoctor({ userId: 'u-nuevo', profileId: 'p-nuevo', displayName: 'Lucía Torrez Aramayo', nationalId: '7771234' });
      const despues = lista().body;
      expect(despues.counts['ENVIADA']).toBe(antes + 1);
      const fila = despues.items.find((i: any) => i.practitioner.fullName === 'Lucía Torrez Aramayo');
      expect(fila.status.code).toBe('ENVIADA');
      expect(Date.parse(fila.dueAt)).toBeGreaterThan(Date.now());
      expect(fila.requirementsSummary.verified).toBe(0);
      expect(fila.practitioner.maskedNationalId).toBe('****234');
    });
  });
});
