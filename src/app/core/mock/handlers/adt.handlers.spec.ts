import { HttpHeaders } from '@angular/common/http';

import type {
  AdmissionResult,
  BedBoard,
  BedCompatibility,
  CensusResponse,
  InpatientIndicators,
  InpatientsPage,
  StayView,
  TransferResult,
} from '../../data-access/adt/adt.types';
import { SITIO_ADT } from '../fixtures/adt.data';
import { PATIENTS } from '../fixtures/people';
import { SITIO_OLIVOS } from '../fixtures/agenda';
import { SITIO_OTRO_TENANT } from '../fixtures/infrastructure.data';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registerAdt, registerAdtBedBoardDouble } from './adt.handlers';
import {
  calcularCifras,
  censosCerrados,
  completarLimpieza,
  edadEnAnios,
  eventos,
  fechaLocal,
  GuardaDeInmutabilidad,
  hoyLocal,
  inyeccion,
  paciente,
  reiniciarAdt,
  retirarAdt,
  sumarDias,
  ubicaciones,
} from './adt.store';
import { registerInfrastructure } from './infrastructure.handlers';

/**
 * El simulador de ADT tiene que contestar lo que dice `§F3.3`, con sus errores,
 * y derivar el censo y los indicadores de las ubicaciones. Las pruebas corren en
 * orden y comparten el estado (como una sesión): ingreso → traslado →
 * intercambio → egreso → censo.
 */
describe('simulador de internación / ADT', () => {
  const router = new MockRouter();
  registerInfrastructure(router);
  registerAdt(router);
  registerAdtBedBoardDouble(router);
  const medica = buscarUsuario('medica')!;
  const admin = buscarUsuario('superadmin')!;

  /*
   * Con `isolate: false` los archivos de prueba comparten módulos en memoria: lo que
   * este archivo deje (una internación, un censo cerrado, una falla inyectada, un
   * perfil de sesión) lo hereda el siguiente, y al revés. Se parte de las semillas
   * y se devuelve todo al terminar.
   */
  beforeAll(() => {
    reiniciarAdt();
    sessionStorage.removeItem('mock:adt-perfil');
    sessionStorage.removeItem('mock:adt-carrera');
  });
  afterEach(() => {
    inyeccion.fallarEn = null;
    sessionStorage.removeItem('mock:adt-perfil');
    sessionStorage.removeItem('mock:adt-carrera');
  });
  afterAll(() => {
    retirarAdt();
  });

  function llamar(
    method: MockMethod,
    path: string,
    o: { body?: unknown; query?: string; ifMatch?: number; user?: typeof medica } = {},
  ): MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const headers = new HttpHeaders(o.ifMatch === undefined ? {} : { 'If-Match': String(o.ifMatch) });
    const r = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(o.query ?? ''),
      body: o.body ?? null,
      headers,
      user: o.user ?? medica,
    });
    return typeof r === 'object' && r !== null && 'status' in r && 'body' in r ? (r as MockReply) : { status: 200, body: r };
  }

  const cuerpo = <T>(r: MockReply): T => r.body as T;
  const razon = (r: MockReply): unknown => (r.body as { details?: { reason?: string } }).details?.reason;
  const camaId = (codigo: string): string => uuid(`infra-sanlucas-${codigo}`);
  const tablero = (user = medica): BedBoard => cuerpo(llamar('GET', `/sites/${SITIO_ADT}/bed-board`, { user }));
  const celdas = (user = medica) => tablero(user).units.flatMap((u) => u.cells);
  const celdaDe = (codigo: string, user = medica) => celdas(user).find((c) => c.code === codigo)!;
  const estancia = (id: string): StayView => cuerpo(llamar('GET', `/clinical/encounters/${id}/stay`));
  /** Adultos que la semilla no internó: pacientes generados de 20 a 60 años. */
  const adulto = (n: number): string =>
    PATIENTS.filter((p, i) => i >= 20 && edadEnAnios(p.birthDate) >= 20 && edadEnAnios(p.birthDate) <= 60)[n]!.id;
  const ingreso = (quien: string, extra: Record<string, unknown> = {}): MockReply =>
    llamar('POST', '/clinical/admissions', {
      body: {
        patientProfileId: quien.includes('-') ? quien : paciente(quien).id,
        practiceSiteId: SITIO_ADT,
        attendingPractitionerId: uuid('profesional-atiende'),
        levelOfCareCode: 'LOC_CARE_GENERAL',
        admissionSourceCode: 'ADM_SRC_EMERGENCY',
        reasonText: 'Dolor abdominal agudo',
        ...extra,
      },
    });

  describe('el hospital y el tablero doble', () => {
    it('trae las camas de F1 más las de ADT, con la ocupación derivada de las ubicaciones', () => {
      const codigos = celdas().map((c) => c.code);
      expect(codigos).toEqual(expect.arrayContaining(['301-A', '301-B', '302-A', 'UTI-1', '323-A', '324-A', '421-A']));
      const mamani = celdaDe('301-B');
      expect(mamani.occupancy.code).toBe('OCC_OCCUPIED');
      expect(mamani.v2Code).toBe('O');
      expect(mamani.occupancy.encounterId).toBe(uuid('encounter-301-B'));
    });

    it('a quien no opera camas no le llega ni la sombra de un paciente', () => {
      for (const perfil of ['LIMPIEZA', 'ADMIN_ORG', 'SIN_ROL']) {
        sessionStorage.setItem('mock:adt-perfil', perfil);
        const ocupadas = celdas().filter((c) => c.occupancy.code === 'OCC_OCCUPIED');
        expect(ocupadas.length).toBeGreaterThan(0);
        expect(ocupadas.every((c) => c.occupancy.patient === undefined && c.occupancy.encounterId === undefined)).toBe(true);
      }
      sessionStorage.removeItem('mock:adt-perfil');
      expect(celdaDe('301-B').occupancy.patient?.initials).toBe('JM');
    });

    it('asignable = activa, disponible, libre y limpia; la sucia, la ocupada y la que está en mantenimiento no', () => {
      expect(celdaDe('323-B').assignable).toBe(true);
      expect(celdaDe('301-A')).toMatchObject({ assignable: false, v2Code: 'H' });
      expect(celdaDe('301-B').assignable).toBe(false);
      expect(celdaDe('UTI-6')).toMatchObject({ assignable: false, v2Code: 'C' });
      expect(celdaDe('UTI-2').assignable).toBe(false);
    });

    it('un establecimiento de otro tenant da 404 como uno inexistente', () => {
      expect(llamar('GET', `/sites/${SITIO_OTRO_TENANT}/bed-board`).status).toBe(404);
      expect(llamar('GET', `/sites/${SITIO_OTRO_TENANT}/inpatients`).status).toBe(404);
      expect(llamar('GET', `/sites/${SITIO_OTRO_TENANT}/census`, { query: 'date=2026-10-01' }).status).toBe(404);
      expect(llamar('GET', `/sites/${SITIO_OLIVOS.id}/inpatient-indicators`, { query: 'from=2026-10-01&to=2026-10-02' }).status).toBe(200);
    });
  });

  describe('compatibilidad (§F3.2)', () => {
    it('hombre a la habitación de mujeres: una violación SEX que se puede forzar', () => {
      const r = cuerpo<BedCompatibility>(
        llamar('POST', '/clinical/admissions/bed-compatibility', {
          body: { patientProfileId: paciente('Solíz').id, careSpaceId: camaId('323-B'), levelOfCareCode: 'LOC_CARE_GENERAL' },
        }),
      );
      expect(r.assignable).toBe(false);
      expect(r.violations.map((v) => [v.rule, v.severity])).toEqual([['SEX', 'OVERRIDABLE']]);
    });

    it('aislamiento aéreo fuera de un AIIR: bloqueante, sin opción de forzar', () => {
      const r = cuerpo<BedCompatibility>(
        llamar('POST', '/clinical/admissions/bed-compatibility', {
          body: { patientProfileId: paciente('Solíz').id, careSpaceId: camaId('302-B'), levelOfCareCode: 'LOC_CARE_GENERAL', isolationPrecautionCode: 'ISO_AIRBORNE' },
        }),
      );
      expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'ISOLATION_AIRBORNE', severity: 'BLOCKING' }));
      expect(cuerpo<BedCompatibility>(llamar('POST', '/clinical/admissions/bed-compatibility', {
        body: { patientProfileId: paciente('Solíz').id, careSpaceId: camaId('324-A'), levelOfCareCode: 'LOC_CARE_GENERAL', isolationPrecautionCode: 'ISO_AIRBORNE' },
      })).assignable).toBe(true);
    });

    it('un niño a la habitación de adultos y un general a terapia: AGE y LEVEL_OF_CARE', () => {
      const niño = cuerpo<BedCompatibility>(llamar('POST', '/clinical/admissions/bed-compatibility', {
        body: { patientProfileId: paciente('Rocha').id, careSpaceId: camaId('325-B'), levelOfCareCode: 'LOC_CARE_GENERAL' },
      }));
      expect(niño.violations.map((v) => v.rule)).toEqual(['AGE']);
      const nivel = cuerpo<BedCompatibility>(llamar('POST', '/clinical/admissions/bed-compatibility', {
        body: { patientProfileId: paciente('Solíz').id, careSpaceId: camaId('UTI-5'), levelOfCareCode: 'LOC_CARE_GENERAL' },
      }));
      expect(nivel.violations.map((v) => v.rule)).toEqual(['LEVEL_OF_CARE']);
    });

    it('una cama ocupada o sucia es bloqueante (nunca se fuerza)', () => {
      const r = cuerpo<BedCompatibility>(llamar('POST', `/clinical/encounters/${uuid('encounter-301-B')}/bed-compatibility`, { body: { careSpaceId: camaId('301-A') } }));
      expect(r.violations.map((v) => v.rule)).toContain('HYGIENE');
      expect(r.violations.every((v) => v.severity === 'BLOCKING')).toBe(true);
    });
  });

  describe('ingreso', () => {
    let ana: AdmissionResult;

    it('con cama asignable: 201, ubicación activa, celda ocupada y evento A01 + A20', () => {
      const r = ingreso('Pérez', { bed: { careSpaceId: camaId('302-B'), mode: 'ASSIGN' } });
      expect(r.status).toBe(201);
      ana = cuerpo<AdmissionResult>(r);
      expect(ana.cell?.occupancy.code).toBe('OCC_OCCUPIED');
      const tipos = eventos.todos().map((e) => e.eventType);
      expect(tipos).toEqual(expect.arrayContaining(['clinical.adt.admitted', 'practice.care_space.status_changed']));
      expect(celdaDe('302-B').occupancy.patient?.initials).toBe('AP');
      expect(estancia(ana.encounterId).currentBed?.code).toBe('302-B');
    });

    it('la misma persona dos veces: 409 PATIENT_ALREADY_ADMITTED', () => {
      const r = ingreso('Pérez', { bed: { careSpaceId: camaId('323-B'), mode: 'ASSIGN' } });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('PATIENT_ALREADY_ADMITTED');
    });

    it('cama ocupada: 409 BED_NOT_ASSIGNABLE con las violaciones, y en base una sola fila activa', () => {
      const r = ingreso('Solíz', { bed: { careSpaceId: camaId('302-B'), mode: 'ASSIGN' } });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('BED_NOT_ASSIGNABLE');
      expect((r.body as { details: { violations: { rule: string }[] } }).details.violations.map((v) => v.rule)).toContain('OCCUPANCY');
      expect(ubicaciones.filtrar((u) => u.careSpaceId === camaId('302-B') && u.status === 'LOCATION_ACTIVE')).toHaveLength(1);
    });

    it('carrera: otra persona ocupa la cama justo antes → 409 BED_DOUBLE_OCCUPANCY y nada queda a medias', () => {
      sessionStorage.setItem('mock:adt-carrera', '1');
      const antes = ubicaciones.filtrar((u) => u.careSpaceId === camaId('421-B')).length;
      const r = ingreso('Rocha', { bed: { careSpaceId: camaId('421-B'), mode: 'ASSIGN' } });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('BED_DOUBLE_OCCUPANCY');
      expect(ubicaciones.filtrar((u) => u.careSpaceId === camaId('421-B') && u.status === 'LOCATION_ACTIVE')).toHaveLength(1);
      expect(ubicaciones.filtrar((u) => u.careSpaceId === camaId('421-B')).length).toBe(antes + 1);
      expect(celdaDe('421-B').occupancy.code).toBe('OCC_OCCUPIED');
      expect(sessionStorage.getItem('mock:adt-carrera')).toBeNull();
    });

    it('incompatibilidad forzable sin override: 422; con override corto: 422; de Enfermería: 403', () => {
      const bed = { careSpaceId: camaId('323-B'), mode: 'ASSIGN' };
      const sin = ingreso('Solíz', { bed });
      expect(sin.status).toBe(422);
      expect(razon(sin)).toBe('BED_COMPATIBILITY_OVERRIDE_REQUIRED');
      const corto = ingreso('Solíz', { bed, override: { justification: '  muy corta  ', ruleCodes: ['SEX'] } });
      expect(razon(corto)).toBe('OVERRIDE_JUSTIFICATION_TOO_SHORT');
      sessionStorage.setItem('mock:adt-perfil', 'ENFERMERIA');
      const enfermeria = ingreso('Solíz', { bed, override: { justification: 'No hay otra cama de hombres disponible hoy', ruleCodes: ['SEX'] } });
      expect(enfermeria.status).toBe(403);
      expect(razon(enfermeria)).toBe('INFRA_ACTION_NOT_ALLOWED');
      sessionStorage.removeItem('mock:adt-perfil');
    });

    it('la justificación cuenta sin los espacios de borde: 19 + espacios no alcanza, 20 sí', () => {
      const bed = { careSpaceId: camaId('323-B'), mode: 'ASSIGN' };
      const diecinueve = '1234567890123456 ab';
      expect(diecinueve.trim().length).toBe(19);
      const corto = ingreso('Solíz', { bed, override: { justification: `   ${diecinueve}   `, ruleCodes: ['SEX'] } });
      expect(razon(corto)).toBe('OVERRIDE_JUSTIFICATION_TOO_SHORT');
    });

    it('con override de supervisión: 201 y un incidente ABIERTO que queda en la ficha', () => {
      const r = ingreso('Solíz', {
        bed: { careSpaceId: camaId('323-B'), mode: 'ASSIGN' },
        override: { justification: 'No hay otra cama de hombres disponible hoy', ruleCodes: ['SEX'] },
      });
      expect(r.status).toBe(201);
      const res = cuerpo<AdmissionResult>(r);
      expect(res.incidentId).toBeTruthy();
      const ficha = estancia(res.encounterId);
      expect(ficha.incidents).toHaveLength(1);
      expect(ficha.incidents[0]).toMatchObject({ status: { code: 'PLC_INC_OPEN' }, justificationText: 'No hay otra cama de hombres disponible hoy' });
      expect(eventos.todos().some((e) => e.eventType === 'clinical.adt.placement_override')).toBe(true);
    });

    it('sin cama queda «pendiente de cama» y el censo vivo lo lista sin cama', () => {
      const r = ingreso('Quispe');
      expect(r.status).toBe(201);
      const res = cuerpo<AdmissionResult>(r);
      expect(res.encounterLocationId).toBeUndefined();
      expect(estancia(res.encounterId).currentBed).toBeNull();
      const vivo = cuerpo<InpatientsPage>(llamar('GET', `/sites/${SITIO_ADT}/inpatients`));
      expect(vivo.items.find((f) => f.encounterId === res.encounterId)?.bed).toBeNull();
    });

    it('faltan datos: 400 con los campos; paciente inexistente: 404', () => {
      expect(llamar('POST', '/clinical/admissions', { body: { patientProfileId: paciente('Rocha').id } }).status).toBe(400);
      expect(ingreso('Rocha', { patientProfileId: uuid('no-existe') }).status).toBe(404);
    });

    it('quien no opera camas recibe 403 INFRA_ACTION_NOT_ALLOWED con los roles que lo permiten', () => {
      for (const perfil of ['LIMPIEZA', 'ADMIN_ORG', 'FACTURACION', 'SIN_ROL']) {
        sessionStorage.setItem('mock:adt-perfil', perfil);
        const r = ingreso('Rocha');
        expect(r.status).toBe(403);
        expect(razon(r)).toBe('INFRA_ACTION_NOT_ALLOWED');
        expect((r.body as { details: { requiredRoles: string[] } }).details.requiredRoles.length).toBeGreaterThan(0);
      }
      sessionStorage.removeItem('mock:adt-perfil');
      expect(llamar('POST', '/clinical/admissions', { user: admin, body: {} }).status).toBe(403);
    });

    it('un ingreso que falla a mitad no deja nada hecho', () => {
      const antes = { ingresos: llamar('GET', `/sites/${SITIO_ADT}/inpatients`).body as InpatientsPage, locs: ubicaciones.tamano };
      inyeccion.fallarEn = 'admision:tras-encuentro';
      expect(() => ingreso('Rocha', { bed: { careSpaceId: camaId('421-A'), mode: 'ASSIGN' } })).toThrow('Falla inyectada');
      const despues = llamar('GET', `/sites/${SITIO_ADT}/inpatients`).body as InpatientsPage;
      expect(despues.items.length).toBe(antes.ingresos.items.length);
      expect(ubicaciones.tamano).toBe(antes.locs);
      expect(celdaDe('421-A').assignable).toBe(true);
    });
  });

  describe('traslado, intercambio y egreso', () => {
    const mamani = uuid('encounter-301-B');
    let orden = '';

    it('el traslado es atómico: cierra el origen, abre el destino, ensucia el origen y crea la orden', () => {
      const v = estancia(mamani).encounter.rowVersion;
      const r = llamar('POST', `/clinical/encounters/${mamani}/transfer`, {
        ifMatch: v,
        body: { toCareSpaceId: camaId('324-A'), reasonCode: 'ADT_RSN_CLINICAL' },
      });
      expect(r.status).toBe(200);
      const t = cuerpo<TransferResult>(r);
      orden = t.cleaningOrderId;
      const ficha = estancia(mamani);
      expect(ficha.currentBed?.code).toBe('324-A');
      const mov = ficha.movements.filter((m) => m.status.code !== 'LOCATION_CANCELLED');
      expect(mov.at(-2)).toMatchObject({ status: { code: 'LOCATION_COMPLETED' }, endReason: { code: 'ADT_END_TRANSFER_OUT' } });
      expect(mov.at(-1)).toMatchObject({ status: { code: 'LOCATION_ACTIVE' }, previousLocationId: t.fromLocationId });
      expect(celdaDe('301-B')).toMatchObject({ v2Code: 'H', assignable: false, openCleaningOrderId: orden });
      expect(celdaDe('324-A').occupancy.code).toBe('OCC_OCCUPIED');
      expect(eventos.todos().some((e) => e.eventType === 'clinical.adt.transferred' && e.hl7 === 'ADT^A02')).toBe(true);
      expect(eventos.todos().some((e) => e.eventType === 'practice.cleaning_order.created')).toBe(true);
    });

    it('con la versión vieja: 412; sin cama: 409; a la misma cama: 422; a futuro: 422', () => {
      const viejo = llamar('POST', `/clinical/encounters/${mamani}/transfer`, { ifMatch: 1, body: { toCareSpaceId: camaId('325-B'), reasonCode: 'ADT_RSN_CLINICAL' } });
      expect(viejo.status).toBe(412);
      const v = estancia(mamani).encounter.rowVersion;
      expect(razon(llamar('POST', `/clinical/encounters/${mamani}/transfer`, { ifMatch: v, body: { toCareSpaceId: camaId('324-A'), reasonCode: 'ADT_RSN_CLINICAL' } }))).toBe('TRANSFER_TO_SAME_BED');
      const manana = new Date(Date.now() + 86_400_000).toISOString();
      expect(razon(llamar('POST', `/clinical/encounters/${mamani}/transfer`, { ifMatch: v, body: { toCareSpaceId: camaId('325-B'), reasonCode: 'ADT_RSN_CLINICAL', occurredAt: manana } }))).toBe('OCCURRED_AT_IN_FUTURE');
      const pendiente = cuerpo<AdmissionResult>(ingreso(adulto(0))).encounterId;
      expect(razon(llamar('POST', `/clinical/encounters/${pendiente}/transfer`, { body: { toCareSpaceId: camaId('325-B'), reasonCode: 'ADT_RSN_CLINICAL' } }))).toBe('ENCOUNTER_HAS_NO_BED');
    });

    it('un traslado que falla a mitad no cambia nada', () => {
      const antes = JSON.stringify(estancia(mamani).movements);
      const v = estancia(mamani).encounter.rowVersion;
      inyeccion.fallarEn = 'traslado:tras-cerrar-origen';
      expect(() =>
        llamar('POST', `/clinical/encounters/${mamani}/transfer`, { ifMatch: v, body: { toCareSpaceId: camaId('325-B'), reasonCode: 'ADT_RSN_CLINICAL' } }),
      ).toThrow('Falla inyectada');
      expect(JSON.stringify(estancia(mamani).movements)).toBe(antes);
      expect(celdaDe('324-A').occupancy.encounterId).toBe(mamani);
      expect(estancia(mamani).encounter.rowVersion).toBe(v);
    });

    it('la cama sucia vuelve a ser asignable cuando termina el ciclo de limpieza', () => {
      expect(celdaDe('301-B').assignable).toBe(false);
      expect(completarLimpieza('301-B')).toBe(true);
      expect(celdaDe('301-B')).toMatchObject({ assignable: true, v2Code: 'U', openCleaningOrderId: null });
    });

    it('el intercambio A17 deja a cada paciente en la cama del otro, con cuatro filas coherentes', () => {
      const torrez = uuid('adt-encounter-V5');
      const camaA = estancia(mamani).currentBed!.code;
      const camaB = estancia(torrez).currentBed!.code;
      const r = llamar('POST', '/clinical/bed-swaps', { body: { encounterAId: mamani, encounterBId: torrez, reasonText: 'Cambio por vecindad' } });
      expect(r.status).toBe(200);
      const filas = cuerpo<{ locations: { id: string; status: { code: string } }[] }>(r).locations;
      expect(filas).toHaveLength(4);
      expect(filas.map((f) => f.status.code)).toEqual(['LOCATION_COMPLETED', 'LOCATION_COMPLETED', 'LOCATION_ACTIVE', 'LOCATION_ACTIVE']);
      expect(estancia(mamani).currentBed?.code).toBe(camaB);
      expect(estancia(torrez).currentBed?.code).toBe(camaA);
      expect(celdas().filter((c) => c.occupancy.code === 'OCC_OCCUPIED' && c.code === camaA)).toHaveLength(1);
      expect(celdaDe(camaA).hygiene.code).toBe('HYG_INSPECTED');
      expect(eventos.todos().some((e) => e.eventType === 'clinical.adt.swapped' && e.hl7 === 'ADT^A17')).toBe(true);
    });

    it('el intercambio rechaza al mismo paciente y a quien no tiene cama', () => {
      const torrez = uuid('adt-encounter-V5');
      expect(razon(llamar('POST', '/clinical/bed-swaps', { body: { encounterAId: torrez, encounterBId: torrez, reasonText: 'x' } }))).toBe('SWAP_SAME_ENCOUNTER');
      const sinCama = cuerpo<AdmissionResult>(ingreso('Vaca')).encounterId;
      expect(razon(llamar('POST', '/clinical/bed-swaps', { body: { encounterAId: torrez, encounterBId: sinCama, reasonText: 'x' } }))).toBe('SWAP_REQUIRES_TWO_OCCUPIED_BEDS');
    });

    it('un intercambio que falla a mitad no deja ni una fila cambiada', () => {
      const torrez = uuid('adt-encounter-V5');
      const antes = [estancia(mamani).currentBed?.code, estancia(torrez).currentBed?.code];
      inyeccion.fallarEn = 'intercambio:tras-cerrar';
      expect(() => llamar('POST', '/clinical/bed-swaps', { body: { encounterAId: mamani, encounterBId: torrez, reasonText: 'Otra vez' } })).toThrow('Falla inyectada');
      expect([estancia(mamani).currentBed?.code, estancia(torrez).currentBed?.code]).toEqual(antes);
    });

    it('egreso: exige disposición, cierra, deja la cama sucia con su orden y se ve en el expediente', () => {
      const v = estancia(mamani).encounter.rowVersion;
      const sin = llamar('POST', `/clinical/encounters/${mamani}/discharge`, { ifMatch: v, body: { occurredAt: new Date().toISOString() } });
      expect(razon(sin)).toBe('DISCHARGE_DISPOSITION_REQUIRED');
      const cama = estancia(mamani).currentBed!.code;
      const r = llamar('POST', `/clinical/encounters/${mamani}/discharge`, {
        ifMatch: v,
        body: { dischargeDispositionCode: 'DISP_HOME', occurredAt: new Date().toISOString() },
      });
      expect(r.status).toBe(200);
      const res = cuerpo<{ cleaningOrderId: string }>(r);
      expect(celdaDe(cama)).toMatchObject({ v2Code: 'H', openCleaningOrderId: res.cleaningOrderId, occupancy: { code: 'OCC_FREE' } });
      const ficha = estancia(mamani);
      expect(ficha.encounter.status.code).toBe('FINISHED');
      expect(ficha.currentBed).toBeNull();
      expect(razon(llamar('POST', `/clinical/encounters/${mamani}/discharge`, { body: { dischargeDispositionCode: 'DISP_HOME', occurredAt: new Date().toISOString() } }))).toBe('ENCOUNTER_NOT_IN_PROGRESS');
      expect(eventos.todos().some((e) => e.eventType === 'clinical.adt.discharged' && e.hl7 === 'ADT^A03')).toBe(true);
    });

    it('con aislamiento el egreso pide limpieza terminal y la cama no es asignable hasta inspeccionar', () => {
      const id = cuerpo<AdmissionResult>(
        ingreso(adulto(2), { levelOfCareCode: 'LOC_CARE_ICU', isolationPrecautionCode: 'ISO_CONTACT', isolationOrganismText: 'SARM', bed: { careSpaceId: camaId('UTI-5'), mode: 'ASSIGN' } }),
      ).encounterId;
      const v = estancia(id).encounter.rowVersion;
      expect(llamar('POST', `/clinical/encounters/${id}/discharge`, { ifMatch: v, body: { dischargeDispositionCode: 'DISP_HOME', occurredAt: new Date().toISOString() } }).status).toBe(200);
      expect(celdaDe('UTI-5')).toMatchObject({ v2Code: 'K', assignable: false, hygiene: { code: 'HYG_CONTAMINATED', terminalRequired: true } });
      expect(completarLimpieza('UTI-5')).toBe(true);
      expect(celdaDe('UTI-5')).toMatchObject({ assignable: true, hygiene: { terminalRequired: false } });
    });

    it('cancelar un traslado reciente devuelve a la cama anterior si sigue libre', () => {
      const id = cuerpo<AdmissionResult>(ingreso(adulto(1), { bed: { careSpaceId: camaId('301-B'), mode: 'ASSIGN' } })).encounterId;
      const v = estancia(id).encounter.rowVersion;
      const t = cuerpo<TransferResult>(llamar('POST', `/clinical/encounters/${id}/transfer`, { ifMatch: v, body: { toCareSpaceId: camaId('325-B'), reasonCode: 'ADT_RSN_BED_MANAGEMENT' } }));
      expect(celdaDe('301-B').assignable).toBe(false);
      const c = llamar('POST', `/clinical/encounter-locations/${t.toLocationId}/cancel`, { body: { reasonText: 'Error de carga' } });
      expect(c.status).toBe(204);
      expect(estancia(id).currentBed?.code).toBe('301-B');
      expect(celdaDe('325-B').occupancy.code).toBe('OCC_FREE');
      expect(celdaDe('301-B').occupancy.code).toBe('OCC_OCCUPIED');
      // Ya no es el último movimiento: no se puede cancelar de nuevo.
      expect(razon(llamar('POST', `/clinical/encounter-locations/${t.toLocationId}/cancel`, { body: { reasonText: 'otra vez' } }))).toBe('LOCATION_NOT_CANCELLABLE');
    });

    it('reservar deja la cama en R; cancelar la reserva la libera; asignar la convierte en ocupación', () => {
      const id = cuerpo<AdmissionResult>(ingreso(adulto(3), { bed: { careSpaceId: camaId('325-B'), mode: 'RESERVE' } }));
      expect(celdaDe('325-B')).toMatchObject({ v2Code: 'R', assignable: false });
      const reserva = estancia(id.encounterId).movements.at(-1)!;
      expect(reserva.status.code).toBe('LOCATION_RESERVED');
      expect(llamar('POST', `/clinical/encounter-locations/${reserva.id}/cancel`, { body: { reasonText: 'No llegó' } }).status).toBe(204);
      expect(celdaDe('325-B').assignable).toBe(true);
      const v = estancia(id.encounterId).encounter.rowVersion;
      expect(llamar('POST', `/clinical/encounters/${id.encounterId}/bed-assignment`, { ifMatch: v + 5, body: { careSpaceId: camaId('325-B'), mode: 'ASSIGN' } }).status).toBe(412);
      const ok = llamar('POST', `/clinical/encounters/${id.encounterId}/bed-assignment`, { ifMatch: v, body: { careSpaceId: camaId('325-B'), mode: 'ASSIGN' } });
      expect(ok.status).toBe(200);
      expect(celdaDe('325-B').v2Code).toBe('O');
      expect(razon(llamar('POST', `/clinical/encounters/${id.encounterId}/bed-assignment`, { body: { careSpaceId: camaId('421-A'), mode: 'ASSIGN' } }))).toBe('ENCOUNTER_ALREADY_HAS_BED');
    });
  });

  describe('censo diario (§F3.3)', () => {
    const ayer = sumarDias(hoyLocal(), -1);
    const unidad = () => cuerpo<CensusResponse>(llamar('GET', `/sites/${SITIO_ADT}/census`, { query: `date=${ayer}` })).units;

    it('la vista previa del día abierto se calcula y no se persiste', () => {
      const antes = censosCerrados.tamano;
      const u = unidad();
      expect(u.length).toBeGreaterThanOrEqual(2);
      expect(u.every((x) => x.day.status === 'OPEN' && x.day.id === null && x.adjustedTotals === null)).toBe(true);
      expect(censosCerrados.tamano).toBe(antes);
    });

    it('patient_days = pacientes al corte + estancias del mismo día, y las cifras salen de las ubicaciones', () => {
      const d = unidad().find((x) => x.day.unit.code === 'MEDINT')!.day;
      expect(d.patientDays).toBe(d.patientsAtCutoff + d.sameDayStays);
      expect(d.bedsAvailable + d.bedsBlocked).toBe(d.bedsCensable);
      expect(d.bedsBlocked).toBe(1); // UTI-6 en mantenimiento desde ayer
      expect(d.discharges).toBeGreaterThanOrEqual(1);
      expect(d).toMatchObject({ patientsAtCutoff: expect.any(Number) });
    });

    it('antes de que termine el día no se cierra: 422 CENSUS_DATE_NOT_ENDED', () => {
      const r = llamar('POST', `/sites/${SITIO_ADT}/census/${hoyLocal()}/close`);
      expect(r.status).toBe(422);
      expect(razon(r)).toBe('CENSUS_DATE_NOT_ENDED');
    });

    it('quien no puede cerrar recibe 403', () => {
      sessionStorage.setItem('mock:adt-perfil', 'ENFERMERIA');
      expect(llamar('POST', `/sites/${SITIO_ADT}/census/${ayer}/close`).status).toBe(403);
      sessionStorage.removeItem('mock:adt-perfil');
    });

    it('cerrar congela el snapshot; cerrar otra vez es 409; el UPDATE directo falla', () => {
      const previa = unidad().find((x) => x.day.unit.code === 'MEDINT')!.day;
      const r = llamar('POST', `/sites/${SITIO_ADT}/census/${ayer}/close`);
      expect(r.status).toBe(200);
      const cerrados = cuerpo<{ closed: { id: string; status: string; contentHash: string }[] }>(r).closed;
      expect(cerrados.every((c) => c.status === 'CLOSED' && c.contentHash.length === 8)).toBe(true);
      expect(razon(llamar('POST', `/sites/${SITIO_ADT}/census/${ayer}/close`))).toBe('CENSUS_ALREADY_CLOSED');
      const id = cerrados[0]!.id;
      expect(() => censosCerrados.actualizar(id, { admissions: 99 })).toThrow(GuardaDeInmutabilidad);
      expect(() => censosCerrados.borrar(id)).toThrow(GuardaDeInmutabilidad);
      const ahora = unidad().find((x) => x.day.unit.code === 'MEDINT')!.day;
      expect(ahora.status).toBe('CLOSED');
      expect(ahora.patientDays).toBe(previa.patientDays);
    });

    it('un ajuste agrega una fila, el snapshot no cambia y los totales ajustados sí', () => {
      const u = unidad().find((x) => x.day.unit.code === 'MEDINT')!;
      const antes = u.day.patientDays;
      const sin = llamar('POST', `/census-days/${u.day.id}/adjustments`, { body: { fieldCode: 'patient_days', newValue: antes + 1, reasonText: '  ' } });
      expect(razon(sin)).toBe('ADJUSTMENT_REASON_REQUIRED');
      expect(razon(llamar('POST', `/census-days/${u.day.id}/adjustments`, { body: { fieldCode: 'camas', newValue: 1, reasonText: 'x' } }))).toBe('ADJUSTMENT_FIELD_INVALID');
      const r = llamar('POST', `/census-days/${u.day.id}/adjustments`, { body: { fieldCode: 'patient_days', newValue: antes + 1, reasonText: 'Un ingreso de madrugada quedó sin registrar' } });
      expect(r.status).toBe(201);
      const despues = unidad().find((x) => x.day.unit.code === 'MEDINT')!;
      expect(despues.day.patientDays).toBe(antes);
      expect(despues.adjustedTotals!.patient_days).toBe(antes + 1);
      expect(despues.adjustments).toHaveLength(1);
      expect(despues.adjustments[0]).toMatchObject({ previousValue: antes, newValue: antes + 1 });
    });

    it('un día abierto no admite ajustes (el id no existe aún) y sin permiso es 403', () => {
      expect(llamar('POST', `/census-days/${uuid('no-cerrado')}/adjustments`, { body: { fieldCode: 'patient_days', newValue: 1, reasonText: 'x' } }).status).toBe(404);
      sessionStorage.setItem('mock:adt-perfil', 'ADMISION');
      const id = unidad()[0]!.day.id;
      expect(llamar('POST', `/census-days/${id}/adjustments`, { body: { fieldCode: 'patient_days', newValue: 1, reasonText: 'x' } }).status).toBe(403);
      sessionStorage.removeItem('mock:adt-perfil');
    });

    it('Limpieza no ve el censo', () => {
      sessionStorage.setItem('mock:adt-perfil', 'LIMPIEZA');
      expect(llamar('GET', `/sites/${SITIO_ADT}/census`, { query: `date=${ayer}` }).status).toBe(403);
      expect(llamar('GET', `/sites/${SITIO_ADT}/inpatient-indicators`, { query: `from=${ayer}&to=${ayer}` }).status).toBe(403);
      sessionStorage.removeItem('mock:adt-perfil');
    });
  });

  describe('indicadores', () => {
    const hoy = hoyLocal();
    const indicadores = (desde: string, hasta: string, extra = ''): InpatientIndicators =>
      cuerpo(llamar('GET', `/sites/${SITIO_ADT}/inpatient-indicators`, { query: `from=${desde}&to=${hasta}${extra}` }));

    it('con seis días cerrados las fórmulas coinciden al decimal con los totales del censo', () => {
      const desde = sumarDias(hoy, -7);
      const hasta = sumarDias(hoy, -2);
      const i = indicadores(desde, hasta);
      expect(i.coverage).toEqual({ daysClosed: 6, daysMissing: [] });
      const filas = censosCerrados.filtrar((c) => c.censusDate >= desde && c.censusDate <= hasta);
      const dcd = filas.reduce((s, c) => s + c.bedsAvailable, 0);
      const dp = filas.reduce((s, c) => s + c.patientDays, 0);
      const egr = filas.reduce((s, c) => s + c.discharges, 0);
      const est = filas.reduce((s, c) => s + c.dischargeStayDays, 0);
      const r2 = (n: number): number => Math.round(n * 100) / 100;
      expect(i.bedDaysAvailable).toBe(dcd);
      expect(i.patientDays).toBe(dp);
      expect(i.occupancyPct).toBe(r2((dp / dcd) * 100));
      expect(i.alos).toBe(r2(est / egr));
      expect(i.avgBeds).toBe(r2(dcd / 6));
      expect(i.bedTurnover).toBe(r2(egr / (dcd / 6)));
      expect(i.turnoverInterval).toBe(r2((dcd - dp) / egr));
      expect(i.crossCheck.occupancyFromAlos).not.toBeNull();
      expect(i.byUnit!.length).toBeGreaterThanOrEqual(2);
    });

    it('un día sin cerrar se declara en coverage y no se cuenta', () => {
      const i = indicadores(sumarDias(hoy, -7), sumarDias(hoy, -1));
      expect(i.days).toBe(7);
      expect(i.coverage.daysClosed).toBeLessThanOrEqual(7);
      expect(i.coverage.daysClosed + i.coverage.daysMissing.length).toBe(7);
    });

    it('sin ningún día cerrado no hay razones: nulos, no ceros', () => {
      const i = indicadores(sumarDias(hoy, -400), sumarDias(hoy, -399));
      expect(i.coverage.daysClosed).toBe(0);
      expect(i.occupancyPct).toBeNull();
      expect(i.alos).toBeNull();
    });

    it('la rotación (p50/p90) sale de las órdenes ya inspeccionadas', () => {
      const i = indicadores(sumarDias(hoy, -7), sumarDias(hoy, -2));
      expect(i.bedTurnaroundMinutes.p50).not.toBeNull();
      expect(i.bedTurnaroundMinutes.p90!).toBeGreaterThanOrEqual(i.bedTurnaroundMinutes.p50!);
    });

    it('un período de más de 366 días es 422', () => {
      const r = llamar('GET', `/sites/${SITIO_ADT}/inpatient-indicators`, { query: `from=${sumarDias(hoy, -400)}&to=${hoy}` });
      expect(razon(r)).toBe('INDICATOR_RANGE_TOO_LONG');
    });

    it('calcularCifras es la misma función para la vista previa y para el cierre', () => {
      const fecha = sumarDias(hoy, -3);
      const medint = censosCerrados.filtrar((c) => c.censusDate === fecha && c.unit.code === 'MEDINT')[0]!;
      expect(calcularCifras(SITIO_ADT, medint.unit.id, fecha).patient_days).toBe(medint.patientDays);
      expect(fechaLocal(medint.cutoffAt)).toBe(sumarDias(fecha, 1));
    });
  });

  describe('incidentes', () => {
    it('solo la supervisión los revisa; la revisión queda en el incidente', () => {
      const ficha = cuerpo<InpatientsPage>(llamar('GET', `/sites/${SITIO_ADT}/inpatients`)).items.find((f) => f.bed?.code === '323-B')!;
      const inc = estancia(ficha.encounterId).incidents[0]!;
      sessionStorage.setItem('mock:adt-perfil', 'ENFERMERIA');
      expect(llamar('PATCH', `/clinical/placement-incidents/${inc.id}`, { body: { status: 'REVIEWED', reviewNote: 'ok' } }).status).toBe(403);
      sessionStorage.removeItem('mock:adt-perfil');
      const r = llamar('PATCH', `/clinical/placement-incidents/${inc.id}`, { body: { status: 'REVIEWED', reviewNote: 'Se verificó la razón clínica.' } });
      expect(r.status).toBe(200);
      expect(estancia(ficha.encounterId).incidents[0]).toMatchObject({ status: { code: 'PLC_INC_REVIEWED' }, reviewNote: 'Se verificó la razón clínica.' });
    });
  });
});
