import { HttpHeaders } from '@angular/common/http';

import type { AdtResult, BedCompatibility, CensusDayView, InpatientIndicators, InpatientStay } from '../../data-access/adt/adt.types';
import type { BedBoard, BedBoardCell, CleaningOrder, CleaningOrderPage } from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { SITIOS_INFRA } from '../fixtures/infraestructura';
import { shiftDate, siteDate } from '../fixtures/inpatient';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registerAdt } from './adt.handlers';
import { registrarInfraestructura } from './infrastructure.handlers';
import { registerInfrastructureOps } from './infrastructure-ops.handlers';
import { reiniciarLaInfraestructuraDelSimulador } from './mock-reset';
import { registrarProcedimientos } from './procedures.handlers';

/** El simulador de F3 contra los criterios de aceptación de §F3.5. */
describe('handlers de internación / ADT (F3)', () => {
  const router = new MockRouter();
  registrarProcedimientos(router);
  registrarInfraestructura(router);
  registerInfrastructureOps(router);
  registerAdt(router);
  // El corredor no aísla los módulos entre archivos de un mismo worker: camas y estancias parten de las de fábrica.
  beforeAll(() => reiniciarLaInfraestructuraDelSimulador());
  const SITIO = SITIOS_INFRA[0]!.id;
  const u = (k: string): MockUser => buscarUsuario(k)!;
  const enfermeria = u('enfermeria');
  const supervision = u('supervision');
  const admision = u('admision');
  const limpieza = u('limpieza');
  const supervisoraLimpieza = u('supervisora.limpieza@alovida.mock');
  const ATTENDING = uuid('hpid-medica');
  const patientId = (clave: string) => uuid(`pid-${clave}`);

  interface Opciones {
    readonly body?: unknown;
    readonly tenant?: string | null;
    readonly ifMatch?: number;
    readonly usuario?: MockUser;
    readonly query?: string;
  }

  function call(method: MockMethod, path: string, o: Opciones = {}): { status: number; body: unknown } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    let headers = new HttpHeaders();
    const tenant = o.tenant === undefined ? TENANT_HOSPITAL : o.tenant;
    if (tenant !== null) headers = headers.set('X-Tenant-Id', tenant);
    if (o.ifMatch !== undefined) headers = headers.set('If-Match', String(o.ifMatch));
    const r = match.handler({ method, path, params: match.params, query: new URLSearchParams(o.query ?? ''), body: o.body ?? null, headers, user: o.usuario ?? enfermeria });
    return isMockReply(r) ? (r as MockReply) : { status: 200, body: r };
  }

  const reasonOf = (r: { body: unknown }) => (r.body as { reason?: string }).reason;
  const celda = (code: string, usuario = enfermeria): BedBoardCell =>
    (call('GET', `/sites/${SITIO}/bed-board`, { usuario }).body as BedBoard).units.flatMap((x) => x.cells).find((c) => c.code === code)!;
  const estancia = (id: string) => call('GET', `/clinical/encounters/${id}/stay`).body as InpatientStay;
  const ingreso = (extra: object) => ({
    patientProfileId: patientId('p-torrez'), practiceSiteId: SITIO, attendingPractitionerId: ATTENDING, levelOfCareCode: 'LOC_CARE_GENERAL',
    admissionSourceCode: 'ADM_SRC_EMERGENCY', reasonText: 'Apendicitis operada, posoperatorio', ...extra,
  });

  let torrez = '';

  it('ingreso con cama asignable → ocupada con iniciales, A20 de ocupación (F3.5 #1)', () => {
    const cama = celda('303-A');
    const r = call('POST', '/clinical/admissions', { usuario: admision, body: ingreso({ bed: { careSpaceId: cama.id, mode: 'ASSIGN' } }) });
    expect(r.status).toBe(201);
    const res = r.body as AdtResult;
    torrez = res.encounterId!;
    // `cell` es el `CareSpaceOperationalState` del puerto (desvío API-F2F5), no la celda del tablero.
    expect(res.cell).toMatchObject({ careSpaceId: cama.id, v2Code: 'O', occupancy: 'OCC_OCCUPIED' });
    expect(res.requestId).toMatch(/^req-/);
    expect(celda('303-A').occupancy.patient?.initials).toBe('PTN');
    const eventos = (call('GET', `/care-spaces/${cama.id}/status-events`).body as { items: { axis: string; to: string; source: string }[] }).items;
    expect(eventos[0]).toMatchObject({ axis: 'OCCUPANCY', to: 'OCC_OCCUPIED', source: 'ADT' });
  });

  it('segunda internación del mismo paciente → 409; segundo ingreso a la misma cama → 409 (F3.5 #2)', () => {
    expect(reasonOf(call('POST', '/clinical/admissions', { body: ingreso({}) }))).toBe('PATIENT_ALREADY_ADMITTED');
    const r = call('POST', '/clinical/admissions', { body: ingreso({ patientProfileId: patientId('p-rocha'), bed: { careSpaceId: celda('303-A').id, mode: 'ASSIGN' } }) });
    expect(r.status).toBe(409);
    expect(reasonOf(r)).toBe('BED_NOT_ASSIGNABLE');
  });

  it('limpieza no ingresa (403) y otro tenant no ve la internación (404) (F3.5 #9)', () => {
    expect(call('POST', '/clinical/admissions', { usuario: limpieza, body: ingreso({ patientProfileId: patientId('p-rocha') }) }).status).toBe(403);
    expect(call('GET', `/clinical/encounters/${torrez}/stay`, { tenant: TENANT_CLINICA }).status).toBe(404);
    expect(call('GET', `/clinical/encounters/${torrez}/stay`, { usuario: limpieza }).status).toBe(403);
  });

  it('incompatible forzable → 422; enfermería sin supervisión → 403; supervisión → 201 + incidente (F3.5 #5)', () => {
    const cama = celda('301-B');
    expect(cama.assignable).toBe(true);
    // Una mujer en la 301, que comparte con un varón: regla de alojamiento del mismo sexo.
    const compat = call('POST', '/clinical/bed-compatibility', { body: { careSpaceId: cama.id, patientProfileId: patientId('p-guzman'), levelOfCareCode: 'LOC_CARE_GENERAL' } }).body as BedCompatibility;
    expect(compat.violations.map((v) => v.rule)).toEqual(['SEX']);
    expect(compat.rules).toEqual([expect.objectContaining({ code: 'SEX', severity: 'OVERRIDABLE', overridable: true })]);
    expect(compat.assignable).toBe(false);
    const varon = patientId('p-rocha');
    const forzable = call('POST', '/clinical/bed-compatibility', { body: { careSpaceId: cama.id, patientProfileId: varon, levelOfCareCode: 'LOC_CARE_GENERAL' } }).body as { violations: { rule: string; severity: string }[] };
    // Martín Rocha tiene 11 años: la sala es de adultos.
    expect(forzable.violations).toEqual([expect.objectContaining({ rule: 'AGE', severity: 'OVERRIDABLE' })]);
    const withoutOverride = call('POST', '/clinical/admissions', { body: ingreso({ patientProfileId: varon, bed: { careSpaceId: cama.id, mode: 'ASSIGN' } }) });
    expect(withoutOverride.status).toBe(422);
    expect(reasonOf(withoutOverride)).toBe('BED_COMPATIBILITY_OVERRIDE_REQUIRED');
    const override = { justification: 'Única cama libre; acompañante permanente autorizado', ruleCodes: ['AGE'] };
    const corta = call('POST', '/clinical/admissions', { usuario: supervision, body: ingreso({ patientProfileId: varon, bed: { careSpaceId: cama.id, mode: 'ASSIGN' }, override: { ...override, justification: 'corta' } }) });
    expect(reasonOf(corta)).toBe('OVERRIDE_JUSTIFICATION_TOO_SHORT');
    expect(call('POST', '/clinical/admissions', { usuario: enfermeria, body: ingreso({ patientProfileId: varon, bed: { careSpaceId: cama.id, mode: 'ASSIGN' }, override }) }).status).toBe(403);
    const ok = call('POST', '/clinical/admissions', { usuario: supervision, body: ingreso({ patientProfileId: varon, bed: { careSpaceId: cama.id, mode: 'ASSIGN' }, override }) });
    expect(ok.status).toBe(201);
    const res = ok.body as AdtResult;
    expect(res.incidentId).toBeTypeOf('string');
    const ficha = estancia(res.encounterId!);
    expect(ficha.incidents[0]).toMatchObject({ id: res.incidentId, status: 'PLC_INC_OPEN', careSpaceId: cama.id, violations: [expect.objectContaining({ rule: 'AGE' })] });
    // H4: la revisión es REVIEWED | CLOSED; los códigos PLC_INC_* son de la base, no del DTO.
    expect(call('PATCH', `/clinical/placement-incidents/${res.incidentId}`, { usuario: supervision, body: { status: 'PLC_INC_REVIEWED', reviewNote: 'Revisado' } }).status).toBe(422);
    const revisado = call('PATCH', `/clinical/placement-incidents/${res.incidentId}`, { usuario: supervision, body: { status: 'REVIEWED', reviewNote: 'Revisado con la familia' } });
    expect(revisado.body).toMatchObject({ id: res.incidentId, status: 'REVIEWED' });
    expect(estancia(res.encounterId!).incidents[0]!.status).toBe('PLC_INC_REVIEWED');
    // Se da de alta enseguida: la 301-B queda sucia para el caso del traslado.
    call('POST', `/clinical/encounters/${res.encounterId}/discharge`, { ifMatch: ficha.encounter.rowVersion, body: { dischargeDispositionCode: 'DISP_TRANSFER', occurredAt: new Date().toISOString() } });
  });

  it('aislamiento aéreo a cama no AIIR → 409 sin opción de forzar', () => {
    const r = call('POST', '/clinical/bed-compatibility', { body: { careSpaceId: celda('302-B').id, patientProfileId: patientId('p-guzman'), levelOfCareCode: 'LOC_CARE_GENERAL', isolationPrecautionCode: 'ISO_AIRBORNE' } }).body as { violations: { rule: string; severity: string }[] };
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'ISOLATION_AIRBORNE', severity: 'BLOCKING' }));
  });

  it('traslado atómico: origen COMPLETED, destino ACTIVE, origen sucio con orden visible para limpieza (F3.5 #3)', () => {
    // La 301-B quedó sucia del egreso anterior: se limpia e inspecciona primero.
    const sucia = celda('301-B');
    const orden = (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza }).body as CleaningOrderPage).items.find((o) => o.careSpaceId === sucia.id)!;
    expect(orden.triggerCode).toBe('CLN_TRG_DISCHARGE');
    const s1 = call('POST', `/cleaning-orders/${orden.id}/start`, { usuario: limpieza, ifMatch: orden.rowVersion }).body as CleaningOrder;
    const s2 = call('POST', `/cleaning-orders/${orden.id}/finish`, { usuario: limpieza, ifMatch: s1.rowVersion }).body as CleaningOrder;
    call('POST', `/cleaning-orders/${orden.id}/inspect`, { usuario: supervisoraLimpieza, ifMatch: s2.rowVersion, body: { result: 'PASS' } });
    expect(celda('301-B').assignable).toBe(true);

    const antes = estancia(torrez);
    const misma = call('POST', `/clinical/encounters/${torrez}/transfer`, { ifMatch: antes.encounter.rowVersion, body: { toCareSpaceId: celda('303-A').id, reasonCode: 'TRF_CLINICAL' } });
    expect(reasonOf(misma)).toBe('TRANSFER_TO_SAME_BED');
    expect(call('POST', `/clinical/encounters/${torrez}/transfer`, { ifMatch: antes.encounter.rowVersion - 1, body: { toCareSpaceId: celda('301-B').id, reasonCode: 'TRF_CLINICAL' } }).status).toBe(412);
    const r = call('POST', `/clinical/encounters/${torrez}/transfer`, { ifMatch: antes.encounter.rowVersion, body: { toCareSpaceId: celda('301-B').id, reasonCode: 'TRF_CLINICAL' } });
    expect(r.status).toBe(200);
    const despues = estancia(torrez);
    const origen = despues.movements.find((m) => m.careSpaceId === celda('303-A').id)!;
    const destino = despues.movements.find((m) => m.careSpaceId === celda('301-B').id)!;
    expect(origen).toMatchObject({ status: 'LOCATION_COMPLETED', endReason: 'ADT_END_TRANSFER_OUT' });
    expect(destino).toMatchObject({ status: 'LOCATION_ACTIVE', movement: 'ADT_TRANSFER', previousEncounterLocationId: origen.id });
    expect(r.body).toMatchObject({ fromLocationId: origen.id, toLocationId: destino.id, cleaningOrderId: expect.any(String) });
    expect(origen.periodEnd).toBe(destino.periodStart);
    expect(celda('303-A')).toMatchObject({ v2Code: 'H', hygiene: { code: 'HYG_DIRTY' } });
    const cola = (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza }).body as CleaningOrderPage).items;
    expect(cola.find((o) => o.careSpaceId === celda('303-A').id)?.triggerCode).toBe('CLN_TRG_TRANSFER');
  });

  it('intercambio A17 entre dos ocupadas exige compatibilidad cruzada (F3.5 #4)', () => {
    const mamani = celda('301-A').occupancy.encounterId!;
    const flores = celda('302-A').occupancy.encounterId!;
    const r = call('POST', '/clinical/bed-swaps', { body: { encounterAId: mamani, encounterBId: flores, reasonText: 'Pedido de la familia' } });
    expect(r.status).toBe(422);
    expect(reasonOf(r)).toBe('BED_COMPATIBILITY_OVERRIDE_REQUIRED');
    expect(reasonOf(call('POST', '/clinical/bed-swaps', { body: { encounterAId: mamani, encounterBId: mamani, reasonText: 'x' } }))).toBe('SWAP_SAME_ENCOUNTER');
    const ok = call('POST', '/clinical/bed-swaps', {
      usuario: supervision,
      body: { encounterAId: mamani, encounterBId: flores, reasonText: 'Pedido de la familia', override: { justification: 'Habitaciones individuales en la práctica, autorizado', ruleCodes: ['SEX'] } },
    });
    expect(ok.status).toBe(200);
    expect((ok.body as { locations: unknown[] }).locations).toHaveLength(4);
    const actual = (id: string) => estancia(id).movements.find((m) => m.status === 'LOCATION_ACTIVE' && m.periodEnd === null)?.careSpaceId;
    expect(actual(mamani)).toBe(celda('302-A').id);
    expect(actual(flores)).toBe(celda('301-A').id);
    expect(celda('301-A').hygiene.code).not.toBe('HYG_DIRTY');
  });

  it('egreso → cama H con orden DISCHARGE; el encuentro termina (F3.5 #6)', () => {
    const ficha = estancia(torrez);
    expect(reasonOf(call('POST', `/clinical/encounters/${torrez}/discharge`, { ifMatch: ficha.encounter.rowVersion, body: {} }))).toBe('DISCHARGE_DISPOSITION_REQUIRED');
    const r = call('POST', `/clinical/encounters/${torrez}/discharge`, { usuario: admision, ifMatch: ficha.encounter.rowVersion, body: { dischargeDispositionCode: 'DISP_HOME', occurredAt: new Date().toISOString() } });
    expect(r.status).toBe(200);
    expect(estancia(torrez).encounter).toMatchObject({ status: 'ENCOUNTER_FINISHED', dischargeDisposition: 'DISP_HOME' });
    expect(estancia(torrez).movements.every((m) => m.periodEnd !== null)).toBe(true);
    expect(celda('301-B')).toMatchObject({ v2Code: 'H', assignable: false });
    expect(call('POST', `/clinical/encounters/${torrez}/discharge`, { ifMatch: ficha.encounter.rowVersion + 1, body: { dischargeDispositionCode: 'DISP_HOME' } }).status).toBe(409);
  });

  it('censo: hoy no se cierra; ayer se cierra una vez, el ajuste no reescribe la foto (F3.5 #7)', () => {
    const hoy = siteDate(Date.now());
    const ayer = shiftDate(hoy, -1);
    expect(reasonOf(call('POST', `/sites/${SITIO}/census/${hoy}/close`, { usuario: supervision }))).toBe('CENSUS_DATE_NOT_ENDED');
    expect(call('POST', `/sites/${SITIO}/census/${ayer}/close`, { usuario: enfermeria }).status).toBe(403);
    const previa = call('GET', `/sites/${SITIO}/census`, { query: `date=${ayer}` }).body as CensusDayView[];
    expect(Array.isArray(previa)).toBe(true);
    expect(previa[0]).toMatchObject({ status: 'OPEN', id: null, date: ayer });
    expect(previa[0]!.counts.patientsAtCutoff).toBe(2);
    expect(previa[0]!.counts.bedsCensable).toBe(4);
    // M4: cerrar sólo las unidades pedidas; una ajena → 404.
    expect(call('POST', `/sites/${SITIO}/census/${ayer}/close`, { usuario: supervision, body: { unitIds: ['no-existe'] } }).status).toBe(404);
    const cerrado = call('POST', `/sites/${SITIO}/census/${ayer}/close`, { usuario: supervision, body: { unitIds: [previa[0]!.unitId] } });
    expect(cerrado.status).toBe(200);
    expect((cerrado.body as { closed: CensusDayView[] }).closed.map((d) => d.unitId)).toEqual([previa[0]!.unitId]);
    expect(reasonOf(call('POST', `/sites/${SITIO}/census/${ayer}/close`, { usuario: supervision }))).toBe('CENSUS_ALREADY_CLOSED');
    const dia = (call('GET', `/sites/${SITIO}/census`, { query: `date=${ayer}` }).body as CensusDayView[])[0]!;
    expect(dia.status).toBe('CLOSED');
    expect(reasonOf(call('POST', `/census-days/${dia.id}/adjustments`, { usuario: supervision, body: { fieldCode: 'admissions', newValue: 1 } }))).toBe('ADJUSTMENT_REASON_REQUIRED');
    expect(reasonOf(call('POST', `/census-days/${dia.id}/adjustments`, { usuario: supervision, body: { fieldCode: 'nope', newValue: 1, reasonText: 'x' } }))).toBe('ADJUSTMENT_FIELD_INVALID');
    expect(call('POST', `/census-days/${dia.id}/adjustments`, { usuario: supervision, body: { fieldCode: 'admissions', newValue: dia.counts.admissions + 1, reasonText: 'Ingreso de las 23:50 sin registrar' } }).status).toBe(201);
    const ajustado = (call('GET', `/sites/${SITIO}/census`, { query: `date=${ayer}` }).body as CensusDayView[])[0]!;
    expect(ajustado.counts.admissions).toBe(dia.counts.admissions);
    expect(ajustado.adjustedTotals.admissions).toBe(dia.counts.admissions + 1);
    expect(ajustado.adjustments[0]).toMatchObject({ previousValue: dia.counts.admissions, fieldCode: 'admissions' });
    // `patient_days` (snake_case, como el modelo) también se acepta y vuelve en snake_case.
    expect(call('POST', `/census-days/${dia.id}/adjustments`, { usuario: supervision, body: { fieldCode: 'patient_days', newValue: 9, reasonText: 'Recuento manual' } }).body).toMatchObject({ fieldCode: 'patient_days', newValue: 9 });
  });

  it('indicadores sobre los siete días sembrados coinciden con las fórmulas (F3.5 #8)', () => {
    const hoy = siteDate(Date.now());
    const r = call('GET', `/sites/${SITIO}/inpatient-indicators`, { query: `from=${shiftDate(hoy, -8)}&to=${shiftDate(hoy, -2)}` }).body as InpatientIndicators;
    // Tal como la API: sin redondear (la pantalla formatea).
    expect(r).toMatchObject({ days: 7, bedDaysAvailable: 27, patientDays: 21 });
    expect(r.occupancyPct).toBeCloseTo(77.78, 2);
    expect(r.alos).toBeCloseTo(5.25, 2);
    expect(r.turnoverInterval).toBeCloseTo(1.5, 2);
    expect(r.bedTurnover).toBeCloseTo(1.04, 2);
    expect(r.crossCheck.deltaPct).toBeCloseTo(0, 6);
    expect(r.coverage.daysMissing).toEqual([]);
    expect(Object.keys(r)).not.toContain('byUnit');
    expect(r.bedTurnaroundMinutes.p50).not.toBeNull();
    const withGap = call('GET', `/sites/${SITIO}/inpatient-indicators`, { query: `from=${shiftDate(hoy, -12)}&to=${shiftDate(hoy, -2)}` }).body as InpatientIndicators;
    expect(withGap.coverage.daysMissing).toHaveLength(4);
    expect(reasonOf(call('GET', `/sites/${SITIO}/inpatient-indicators`, { query: 'from=2024-01-01&to=2026-01-01' }))).toBe('INDICATOR_RANGE_TOO_LONG');
    expect(call('GET', `/sites/${SITIO}/inpatient-indicators`, { usuario: limpieza }).status).toBe(403);
  });

  it('el expediente ve la internación en curso del paciente', () => {
    const mamani = call('GET', `/clinical/patients/${patientId('p-mamani')}/inpatient-stay`).body as InpatientStay;
    expect(mamani.movements.find((m) => m.status === 'LOCATION_ACTIVE')?.careSpaceId).toBe(celda('302-A').id);
    // Sin internación en curso: el mismo 404 uniforme de la API («sin estancia visible»).
    expect(call('GET', `/clinical/patients/${patientId('p-torrez')}/inpatient-stay`).status).toBe(404);
    expect(call('GET', `/clinical/patients/${patientId('p-mamani')}/inpatient-stay`, { usuario: limpieza }).status).toBe(404);
  });
});
