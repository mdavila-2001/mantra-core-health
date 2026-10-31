import { HttpHeaders } from '@angular/common/http';

import type { CostCenter, InfrastructureItem } from '../../data-access/accounting/infrastructure-items.types';
import type { SampleCollectionPoint } from '../../data-access/diagnostics/sample-collection.types';
import type { EncounterCharges } from '../../data-access/space-billing/space-billing.types';
import { recursos, SITIO_SANLUCAS } from '../fixtures/agenda';
import { ESTUDIO, ORDER_CATEGORY } from '../fixtures/concepts';
import { idDeEspacio, idDeUnidad, SITIOS_INFRA } from '../fixtures/infraestructura';
import { PATIENTS, PROFESSIONALS } from '../fixtures/people';
import { isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL, type MockUser } from '../mock-session';
import { fecha } from '../mock-store';
import { crearRouterSimulado } from './index';
import { espacios } from './infrastructure.handlers';

/**
 * Integración F5b/F5d/F5f y el cierre del caso (F4 → F5e) contra la maqueta
 * completa: las reglas que la API aplica y la pantalla refleja.
 */
describe('maqueta de integración F5b · F5d · F5f · quirófano por tiempo', () => {
  const router = crearRouterSimulado();
  const SAN_LUCAS = SITIOS_INFRA[0]!;
  const superadmin = buscarUsuario('superadmin')!;
  const jefe = buscarUsuario('quirofano')!;
  const facturacion = buscarUsuario('facturacion')!;
  const medica = buscarUsuario('medica')!;

  function call(method: MockMethod, path: string, options: { body?: unknown; user?: MockUser; tenant?: string | null; query?: Record<string, string>; ifMatch?: string } = {}): { status: number; body: unknown } {
    const url = new URL(path, 'http://x');
    const match = router.match(method, url.pathname);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    let headers = new HttpHeaders();
    const tenant = options.tenant === undefined ? TENANT_HOSPITAL : options.tenant;
    if (tenant !== null) headers = headers.set('X-Tenant-Id', tenant);
    if (options.ifMatch !== undefined) headers = headers.set('If-Match', options.ifMatch);
    const query = new URLSearchParams(options.query ?? {});
    const reply = match.handler({ method, path: url.pathname, params: match.params, query, body: options.body ?? null, headers, user: options.user ?? superadmin });
    return isMockReply(reply) ? (reply as MockReply) : { status: 200, body: reply };
  }
  const reason = (r: { body: unknown }): unknown => (r.body as { reason?: unknown }).reason;

  describe('F5b · puntos de toma', () => {
    it('ofrece sólo los puntos activos y disponibles de la sede; uno en mantenimiento no aparece', () => {
      const points = call('GET', `/sites/${SAN_LUCAS.id}/sample-collection-points`).body as SampleCollectionPoint[];
      expect(points.map((p) => p.careSpace.code)).toEqual(['LAB-TM1', 'LAB-TM2']);
      expect(points[0]!.unit?.name).toBe('Laboratorio clínico');
      const tm2 = idDeEspacio(SAN_LUCAS, 'LAB-TM2');
      espacios.actualizar(tm2, { operationalStatusCode: 'SPACE_OP_MAINTENANCE' });
      expect((call('GET', `/sites/${SAN_LUCAS.id}/sample-collection-points`).body as SampleCollectionPoint[]).map((p) => p.careSpace.code)).toEqual(['LAB-TM1']);
      espacios.actualizar(tm2, { operationalStatusCode: 'SPACE_OP_AVAILABLE' });
    });

    it('una sede de otro tenant responde 404', () => {
      expect(call('GET', `/sites/${SAN_LUCAS.id}/sample-collection-points`, { tenant: TENANT_CLINICA }).status).toBe(404);
    });

    const order = (extra: Record<string, unknown>) =>
      call('POST', '/clinical/service-requests', {
        user: medica,
        body: { custodianTenantId: TENANT_HOSPITAL, patientProfileId: PATIENTS[70]!.id, codeConceptId: ESTUDIO['STUDY-GLUCOSA'], categoryConceptId: ORDER_CATEGORY['SRQ-LAB'], ...extra },
      });

    it('un punto que no es de toma (o de otra sede) → 422 COLLECTION_POINT_INVALID', () => {
      expect(reason(order({ suggestedCareSpaceId: idDeEspacio(SAN_LUCAS, 'CE-01') }))).toBe('COLLECTION_POINT_INVALID');
      expect(reason(order({ suggestedPracticeSiteId: SITIOS_INFRA[1]!.id, suggestedCareSpaceId: idDeEspacio(SAN_LUCAS, 'LAB-TM1') }))).toBe('COLLECTION_POINT_INVALID');
    });

    it('la orden guarda el punto y el expediente lo muestra; sin punto, el primero de la sede', () => {
      expect(order({ suggestedCareSpaceId: idDeEspacio(SAN_LUCAS, 'LAB-TM2') }).status).toBe(201);
      expect(order({ suggestedPracticeSiteId: SAN_LUCAS.id }).status).toBe(201);
      const orders = (call('GET', `/diagnostics/patients/${PATIENTS[70]!.id}/orders`).body as { orders: { suggestedCareSpace: { code: string } | null }[] }).orders;
      const codes = orders.map((o) => o.suggestedCareSpace?.code).filter(Boolean);
      expect(codes).toContain('LAB-TM2');
      expect(codes).toContain('LAB-TM1');
    });

    it('la cola trae el punto donde se tomó cada muestra y filtra por él; otro tenant no lo ve', () => {
      const queue = call('GET', '/diagnostics/work-orders', { user: medica }).body as { collectionPoint: { careSpaceId: string; code: string } | null }[];
      const withPoint = queue.filter((w) => w.collectionPoint !== null);
      expect(withPoint.length).toBeGreaterThan(0);
      const tm1 = idDeEspacio(SAN_LUCAS, 'LAB-TM1');
      const filtered = call('GET', '/diagnostics/work-orders', { user: medica, query: { collectionCareSpaceId: tm1 } }).body as { collectionPoint: { careSpaceId: string } }[];
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((w) => w.collectionPoint.careSpaceId === tm1)).toBe(true);
      const clinic = call('GET', '/diagnostics/work-orders', { user: medica, tenant: TENANT_CLINICA }).body as { collectionPoint: unknown }[];
      expect(clinic.every((w) => w.collectionPoint === null)).toBe(true);
    });
  });

  describe('F5d · agenda con consultorio', () => {
    const hospitalResources = recursos.todos().filter((r) => r.site?.id === SITIO_SANLUCAS.id);
    const [first, second] = hospitalResources;
    const saturday = (() => {
      let d = 9;
      while (fecha(d).getDay() !== 6) d += 1;
      return d;
    })();
    const rules = [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00', slotMinutes: 30 }];
    const template = (resourceId: string, careSpaceId: string, r = rules) => call('POST', `/scheduling/resources/${resourceId}/templates`, { body: { name: 'Sábados', rules: r, slotMinutes: 30, careSpaceId } });

    it('hay dos agendas en San Lucas para probar el cruce', () => {
      expect(first).toBeDefined();
      expect(second).toBeDefined();
    });

    it('un espacio que no se agenda → 422; de otro tenant → 404', () => {
      expect(reason(template(first!.id, idDeEspacio(SAN_LUCAS, 'ESP')))).toBe('TEMPLATE_CARE_SPACE_INVALID_FUNCTION');
      expect(reason(template(first!.id, idDeEspacio(SAN_LUCAS, '301-A')))).toBe('TEMPLATE_CARE_SPACE_INVALID_FUNCTION');
      expect(template(first!.id, idDeEspacio(SITIOS_INFRA[2]!, 'OL-C1')).status).toBe(404);
    });

    it('otra agenda en el mismo consultorio a la misma hora → 422 TEMPLATE_RULE_OVERLAP_CARE_SPACE', () => {
      expect(template(first!.id, idDeEspacio(SAN_LUCAS, 'CE-02')).status).toBe(201);
      expect(reason(template(second!.id, idDeEspacio(SAN_LUCAS, 'CE-02')))).toBe('TEMPLATE_RULE_OVERLAP_CARE_SPACE');
      expect(template(second!.id, idDeEspacio(SAN_LUCAS, 'CE-02'), [{ dayOfWeek: 6, startTime: '16:00', endTime: '18:00', slotMinutes: 30 }]).status).toBe(201);
    });

    it('dos médicos, mismo consultorio, agendas distintas: 15:45–16:15 y 16:00–16:30 → el segundo 409 CARE_SPACE_DOUBLE_BOOKED', () => {
      // El primero atiende 14–16 y el segundo 16–18 en CE-02 (las plantillas no se cruzan);
      // una cita del primero que se estira pasadas las 16 sí choca con la del segundo.
      const book = (resourceId: string, hh: number, mm: number, patient: string) =>
        call('POST', '/scheduling/appointments/direct', { body: { patientProfileId: patient, resourceId, startAt: fecha(saturday, hh, mm).toISOString(), durationMinutes: 30 } });
      const a = book(first!.id, 15, 45, PATIENTS[50]!.id);
      expect(a.status).toBe(201);
      const b = book(second!.id, 16, 0, PATIENTS[51]!.id);
      expect(b.status).toBe(409);
      expect(reason(b)).toBe('CARE_SPACE_DOUBLE_BOOKED');
      expect(book(second!.id, 16, 30, PATIENTS[52]!.id).status).toBe(201);
      const bookingId = (a.body as { bookingId: string }).bookingId;
      const list = call('GET', '/scheduling/bookings', { query: { resourceId: first!.id } }).body as { items: { id: string; careSpace: { code: string } | null }[] };
      expect(list.items.find((x) => x.id === bookingId)?.careSpace?.code).toBe('CE-02');
    });
  });

  describe('F5f · activos y centros de costo', () => {
    const practiceId = SAN_LUCAS.practiceId;

    it('lista los activos con la ruta de su espacio y el dato heredado', () => {
      const items = call('GET', '/accounting/infrastructure-items', { query: { practiceId } }).body as InfrastructureItem[];
      expect(items.find((i) => i.code === 'AF-0101')?.careSpace?.path).toContain('Quirófano 1');
      expect(items.find((i) => i.code === 'AF-0103')?.locationText).toContain('Quirófano 2');
    });

    it('ubicar: otra sede de la misma práctica se acepta; otro tenant → 404; facturación no ubica (403)', () => {
      const id = (call('GET', '/accounting/infrastructure-items', { query: { practiceId } }).body as InfrastructureItem[])[2]!.id;
      expect(reason(call('PATCH', `/accounting/infrastructure-items/${id}`, { body: { careSpaceId: idDeEspacio(SITIOS_INFRA[1]!, 'CN-01') } }))).toBeUndefined();
      expect(call('PATCH', `/accounting/infrastructure-items/${id}`, { body: { careSpaceId: idDeEspacio(SITIOS_INFRA[2]!, 'OL-C1') } }).status).toBe(404);
      expect(call('PATCH', `/accounting/infrastructure-items/${id}`, { user: facturacion, body: { careSpaceId: idDeEspacio(SAN_LUCAS, 'QX-02') } }).status).toBe(403);
      const located = call('PATCH', `/accounting/infrastructure-items/${id}`, { body: { careSpaceId: idDeEspacio(SAN_LUCAS, 'QX-02') } }).body as InfrastructureItem;
      expect(located.careSpace?.code).toBe('QX-02');
    });

    it('una unidad tiene un solo centro de costo: el segundo → 409 UNIT_ALREADY_HAS_COST_CENTER', () => {
      const centers = call('GET', '/accounting/cost-centers', { query: { practiceId } }).body as CostCenter[];
      const free = centers.find((c) => c.clinicalUnit === null && c.code === 'CC-900')!;
      expect(reason(call('POST', `/accounting/cost-centers/${free.id}/unit-link`, { body: { clinicalUnitId: idDeUnidad(SAN_LUCAS, 'MEDINT') } }))).toBe('UNIT_ALREADY_HAS_COST_CENTER');
      const qx = centers.find((c) => c.code === 'CC-120')!;
      expect((call('POST', `/accounting/cost-centers/${qx.id}/unit-link`, { body: { clinicalUnitId: idDeUnidad(SAN_LUCAS, 'QX') } }).body as CostCenter).clinicalUnit?.name).toBe('Bloque quirúrgico');
    });
  });

  describe('F4 → F5e · cierre del caso, cargo de quirófano y recambio', () => {
    it('con la Salida hecha, la salida de sala cierra el caso, devenga el uso por tiempo y abre el recambio', () => {
      let d = 15;
      while (fecha(d).getDay() !== 0) d += 1;
      const start = fecha(d, 9);
      const created = call('POST', '/procedure-cases', {
        user: jefe,
        body: { custodianTenantId: TENANT_HOSPITAL, patientProfileId: PATIENTS[60]!.id, caseType: 'ELECTIVE', priority: 'ROUTINE', primarySurgeonProfileId: PROFESSIONALS[4]!.id, operatingRoomId: idDeEspacio(SAN_LUCAS, 'QX-02'), scheduledStartAt: start.toISOString(), scheduledEndAt: new Date(start.getTime() + 3_600_000).toISOString() },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const id = (created.body as { id: string }).id;
      const opened = call('POST', `/procedure-cases/${id}/safety-checklists`, { user: jefe });
      expect(opened.status, JSON.stringify(opened.body)).toBe(201);
      const checklist = opened.body as { id: string; phases: { items: { id: string }[] }[] };
      const sign = (phase: string, i: number) =>
        call('POST', `/procedure-cases/${id}/safety-checklists/${checklist.id}/responses`, { user: jefe, body: { phase, respondedByProfileId: jefe.practitionerProfileId, responses: checklist.phases[i]!.items.map((it) => ({ itemId: it.id, status: 'CONFIRMED' })) } });
      const base = Date.now() - 95 * 60_000;
      const event = (eventCode: string, minutes: number) => call('POST', `/procedure-cases/${id}/room-events`, { user: jefe, body: { eventCode, occurredAt: new Date(base + minutes * 60_000).toISOString() } });
      sign('SIGN_IN', 0);
      expect(event('PATIENT_IN_ROOM', 0).status).toBe(201);
      expect(event('ANESTHESIA_START', 10).status).toBe(201);
      sign('TIME_OUT', 1);
      expect(event('INCISION', 25).status).toBe(201);
      expect(event('CLOSURE', 80).status).toBe(201);
      sign('SIGN_OUT', 2);
      expect(event('PATIENT_OUT_OF_ROOM', 95).status).toBe(201);

      const detail = call('GET', `/procedure-cases/${id}`, { user: jefe }).body as { case: { encounterId: string }; turnoverCleaning: { id: string; status: string; rowVersion: number } };
      expect(detail.turnoverCleaning.status).toBe('CLN_PENDING');
      const charges = call('GET', `/billing/encounters/${detail.case.encounterId}/pending-charges`, { user: facturacion }).body as EncounterCharges;
      const or = charges.charges.find((c) => c.sourceKind.code === 'CHG_SRC_OR_TIME')!;
      // 95 min con fracción de 30 y mínimo 2 → 4 fracciones (criterio de §F5e).
      expect(or.quantity).toBe('4');
      expect(or.minutes).toBe(95);
      expect(or.idempotencyKey).toBe(`ORTIME:${id}`);

      // El recambio: iniciar → terminar → inspeccionar; cada paso deja su evento.
      let t = detail.turnoverCleaning;
      expect(reason(call('POST', `/cleaning-orders/${t.id}/finish`, { user: jefe }))).toBe('CLEANING_ORDER_INVALID_TRANSITION');
      // Aislamiento, permiso y concurrencia: la API decide, la pantalla sólo refleja.
      expect(call('POST', `/cleaning-orders/${t.id}/start`, { user: jefe, tenant: TENANT_CLINICA }).status).toBe(404);
      expect(call('POST', `/cleaning-orders/${t.id}/start`, { user: facturacion }).status).toBe(403);
      const stale = call('POST', `/cleaning-orders/${t.id}/start`, { user: jefe, ifMatch: `"${t.rowVersion + 1}"` });
      expect(stale.status).toBe(412);
      expect(reason(stale)).toBe('ROW_VERSION_MISMATCH');
      for (const step of ['start', 'finish', 'inspect']) {
        if (step === 'inspect') expect(reason(call('POST', `/cleaning-orders/${t.id}/inspect`, { user: jefe, body: { result: 'FAIL' } }))).toBe('INSPECTION_REASON_REQUIRED');
        const r = call('POST', `/cleaning-orders/${t.id}/${step}`, { user: jefe, ifMatch: `"${t.rowVersion}"`, body: step === 'inspect' ? { result: 'PASS' } : {} });
        expect(r.status).toBe(200);
        t = r.body as typeof t;
      }
      expect(t.status).toBe('CLN_INSPECTED');
      // El cargo es idempotente: volver a pedir los pendientes no lo duplica.
      const again = call('GET', `/billing/encounters/${detail.case.encounterId}/pending-charges`, { user: facturacion }).body as EncounterCharges;
      expect(again.charges.filter((c) => c.sourceKind.code === 'CHG_SRC_OR_TIME')).toHaveLength(1);
      const after = call('GET', `/procedure-cases/${id}`, { user: jefe }).body as { roomEvents: { eventCode: string }[] };
      expect(after.roomEvents.map((e) => e.eventCode).slice(-3)).toEqual(['CLEANUP_START', 'CLEANUP_END', 'ROOM_READY']);
    });
  });
});
