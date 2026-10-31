import { HttpHeaders } from '@angular/common/http';

import type {
  CareSpaceDetail,
  ImportResult,
  SiteCapacity,
  SiteStructure,
} from '../../data-access/infrastructure/infrastructure.types';
import { QUIROFANO_1, SITIOS_INFRA } from '../fixtures/infraestructura';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL } from '../mock-session';
import { registrarInfraestructura } from './infrastructure.handlers';
import { registrarProcedimientos } from './procedures.handlers';

/**
 * El simulador de F1 tiene que comportarse como el contrato: si no, la
 * pantalla se ve bien contra la maqueta y mal contra la API, o al revés.
 */
describe('handlers de infraestructura (F1)', () => {
  const router = new MockRouter();
  registrarProcedimientos(router);
  registrarInfraestructura(router);
  const superadmin = buscarUsuario('superadmin')!;
  const medica = buscarUsuario('medica')!;
  const SITIO = SITIOS_INFRA[0]!.id;

  interface Opciones {
    readonly body?: unknown;
    readonly tenant?: string | null;
    readonly ifMatch?: number;
    readonly usuario?: typeof superadmin;
    readonly query?: URLSearchParams;
  }

  function call(method: MockMethod, path: string, opciones: Opciones = {}): { status: number; body: unknown } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    let headers = new HttpHeaders();
    const tenant = opciones.tenant === undefined ? TENANT_HOSPITAL : opciones.tenant;
    if (tenant !== null) headers = headers.set('X-Tenant-Id', tenant);
    if (opciones.ifMatch !== undefined) headers = headers.set('If-Match', String(opciones.ifMatch));
    const respuesta = match.handler({
      method,
      path,
      params: match.params,
      query: opciones.query ?? new URLSearchParams(),
      body: opciones.body ?? null,
      headers,
      user: opciones.usuario ?? superadmin,
    });
    return isMockReply(respuesta) ? (respuesta as MockReply) : { status: 200, body: respuesta };
  }

  function estructura(): SiteStructure {
    return call('GET', `/sites/${SITIO}/structure`).body as SiteStructure;
  }

  function porCodigo(code: string) {
    return estructura().spaces.find((e) => e.code === code)!;
  }

  function razon(r: { body: unknown }): unknown {
    return (r.body as { reason?: unknown }).reason;
  }

  it('siembra Edificio A > Pabellón Norte > Piso 3 > Sala > Hab. 301 > Camas', () => {
    const cama = call('GET', `/care-spaces/${porCodigo('301-A').id}`).body as CareSpaceDetail;
    expect(cama.path.map((p) => p.code)).toEqual(['BLD-A', 'A-PN', 'A-PN-P3', 'A-PN-P3-SI', '301', '301-A']);
    expect(cama.form.code).toBe('LOC_FORM_BED');
  });

  it('los quirófanos tienen los ids que usa Intervenciones', () => {
    expect(porCodigo('QX-01').id).toBe(QUIROFANO_1);
    expect(porCodigo('QX-01').function.code).toBe('SPACE_FN_OPERATING_ROOM');
  });

  it('deriva camas y recuentos en vez de escribirlos', () => {
    const sala = call('GET', `/care-spaces/${porCodigo('A-PN-P3-SI').id}`).body as CareSpaceDetail;
    // 301-A, 301-B, 302-A y 303-A activas; 302-B suspendida no cuenta.
    expect(sala.derived.beds).toBe(4);
    expect(sala.derived.censableBeds).toBe(4);
    expect(porCodigo('301').childCount).toBe(2);
  });

  it('aísla por tenant: otro tenant recibe 404, no 403', () => {
    expect(call('GET', `/sites/${SITIO}/structure`, { tenant: TENANT_CLINICA }).status).toBe(404);
    expect(call('GET', `/care-spaces/${QUIROFANO_1}`, { tenant: TENANT_CLINICA }).status).toBe(404);
  });

  it('sólo quien administra escribe: una médica sin ser dueña recibe 403', () => {
    const r = call('POST', `/sites/${SITIO}/care-spaces`, {
      usuario: medica,
      body: { code: 'X-1', name: 'X', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_GENERIC' },
    });
    expect(r.status).toBe(403);
  });

  it('crea un espacio planificado y lo persiste', () => {
    const padre = porCodigo('A-PN-P3-SI');
    const r = call('POST', `/sites/${SITIO}/care-spaces`, {
      body: { code: '305', name: 'Habitación 305', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_INPATIENT_ROOM', parentSpaceId: padre.id, areaM2: 19 },
    });
    expect(r.status).toBe(201);
    const creado = r.body as CareSpaceDetail;
    expect(creado.status.code).toBe('SPACE_PLANNED');
    expect(creado.areaM2).toBe(19);
    expect(call('GET', `/care-spaces/${creado.id}`).body).toMatchObject({ code: '305' });
  });

  it('código repetido es 409 SPACE_CODE_TAKEN; regla de padre es 422', () => {
    const repetido = call('POST', `/sites/${SITIO}/care-spaces`, {
      body: { code: '301', name: 'Otra', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_GENERIC', parentSpaceId: porCodigo('A-PN-P3-SI').id },
    });
    expect(repetido.status).toBe(409);
    expect(razon(repetido)).toBe('SPACE_CODE_TAKEN');

    const camaEnEdificio = call('POST', `/sites/${SITIO}/care-spaces`, {
      body: { code: 'CAMA-X', name: 'Cama', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', parentSpaceId: porCodigo('BLD-A').id },
    });
    expect(camaEnEdificio.status).toBe(422);
    expect(razon(camaEnEdificio)).toBe('SPACE_PARENT_RULE');
  });

  it('PATCH exige If-Match vigente: 412 con versión vieja', () => {
    const consultorio = porCodigo('CE-02');
    expect(call('PATCH', `/care-spaces/${consultorio.id}`, { body: { name: 'X' }, ifMatch: consultorio.rowVersion + 7 }).status).toBe(412);
    const ok = call('PATCH', `/care-spaces/${consultorio.id}`, { body: { name: 'Consultorio 2 (renovado)' }, ifMatch: consultorio.rowVersion });
    expect(ok.status).toBe(200);
    expect((ok.body as CareSpaceDetail).rowVersion).toBe(consultorio.rowVersion + 1);
  });

  it('código inmutable una vez activo: 422 SPACE_IMMUTABLE_FIELD', () => {
    const activo = porCodigo('CE-03');
    const r = call('PATCH', `/care-spaces/${activo.id}`, { body: { code: 'CE-99' }, ifMatch: activo.rowVersion });
    expect(r.status).toBe(422);
    expect(razon(r)).toBe('SPACE_IMMUTABLE_FIELD');
  });

  it('mover adentro de un hijo es un ciclo: 422 SPACE_CYCLE', () => {
    const piso = porCodigo('A-PN-P3');
    const sala = porCodigo('A-PN-P3-SI');
    const r = call('POST', `/care-spaces/${piso.id}/move`, { body: { parentSpaceId: sala.id }, ifMatch: piso.rowVersion });
    expect(r.status).toBe(422);
    expect(razon(r)).toBe('SPACE_CYCLE');
  });

  it('retirar con dependencias es 409 SPACE_RETIRE_BLOCKED con la lista y su próxima acción', () => {
    const tomografia = porCodigo('IMG-TC');
    const chequeo = call('GET', `/care-spaces/${tomografia.id}/retire-check`).body as { blockers: { kind: string; nextAction: { label: string } }[] };
    expect(chequeo.blockers.map((b) => b.kind)).toEqual(['FUTURE_BOOKING', 'SCHEDULABLE_RESOURCE', 'EQUIPMENT']);
    expect(chequeo.blockers.every((b) => b.nextAction.label.length > 0)).toBe(true);
    const r = call('POST', `/care-spaces/${tomografia.id}/lifecycle`, { body: { action: 'retire', reason: 'Cierre' }, ifMatch: tomografia.rowVersion });
    expect(r.status).toBe(409);
    expect(razon(r)).toBe('SPACE_RETIRE_BLOCKED');
  });

  it('una cama ocupada bloquea su retiro por internación activa', () => {
    const cama = porCodigo('301-A');
    const chequeo = call('GET', `/care-spaces/${cama.id}/retire-check`).body as { blockers: { kind: string }[] };
    expect(chequeo.blockers.map((b) => b.kind)).toEqual(['ACTIVE_ENCOUNTER']);
  });

  it('suspender y retirar exigen motivo; activar con padre no activo es 422', () => {
    const espera = porCodigo('ESP');
    expect(call('POST', `/care-spaces/${espera.id}/lifecycle`, { body: { action: 'suspend' }, ifMatch: espera.rowVersion }).status).toBe(422);
    const planificada = call('POST', `/sites/${SITIO}/care-spaces`, {
      body: { code: '304-A', name: 'Cama 304-A', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', parentSpaceId: porCodigo('304').id },
    }).body as CareSpaceDetail;
    const r = call('POST', `/care-spaces/${planificada.id}/lifecycle`, { body: { action: 'activate' }, ifMatch: planificada.rowVersion });
    expect(r.status).toBe(422);
    expect(razon(r)).toBe('PARENT_NOT_ACTIVE');
  });

  it('alta masiva: todo o nada con el patrón', () => {
    const hab = porCodigo('302');
    const bien = call('POST', `/sites/${SITIO}/care-spaces/bulk`, {
      body: { parentSpaceId: hab.id, formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', codePattern: '302-{C..D}', namePattern: 'Cama 302-{C..D}' },
    });
    expect(bien.status).toBe(201);
    expect((bien.body as { created: CareSpaceDetail[] }).created.map((c) => c.code)).toEqual(['302-C', '302-D']);
    const antes = estructura().spaces.length;
    const choca = call('POST', `/sites/${SITIO}/care-spaces/bulk`, {
      body: { parentSpaceId: hab.id, formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', codePattern: '302-{D..F}', namePattern: 'Cama' },
    });
    expect(choca.status).toBe(409);
    expect(estructura().spaces.length).toBe(antes);
  });

  it('importación: dry-run informa por línea y no escribe; con dryRun=false crea', () => {
    const filas = [
      { line: 2, code: 'IMP-A', name: 'Área importada', formCode: 'LOC_FORM_AREA', functionCode: 'SPACE_FN_AREA_GENERIC', parentCode: 'A-PB' },
      { line: 3, code: 'IMP-A1', name: 'Local importado', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_STORAGE', parentCode: 'IMP-A' },
      { line: 4, code: '301', name: 'Repetido', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_GENERIC', parentCode: 'NO-EXISTE' },
    ];
    const seco = call('POST', `/sites/${SITIO}/care-spaces/import`, { body: { rows: filas }, query: new URLSearchParams('dryRun=true') }).body as ImportResult;
    expect(seco.ok).toBe(false);
    expect(seco.rows.map((r) => r.status)).toEqual(['ok', 'ok', 'error']);
    expect(seco.rows[2]!.errors.map((e) => e.field)).toEqual(['code', 'parentCode']);
    expect(estructura().spaces.some((e) => e.code === 'IMP-A')).toBe(false);

    const real = call('POST', `/sites/${SITIO}/care-spaces/import`, { body: { rows: filas.slice(0, 2) }, query: new URLSearchParams('dryRun=false') }).body as ImportResult;
    expect(real).toMatchObject({ ok: true, created: 2 });
    const local = porCodigo('IMP-A1');
    expect(local.parentId).toBe(porCodigo('IMP-A').id);
  });

  it('capacidad: declarada vs. derivada con brechas', () => {
    const capacidad = call('GET', `/sites/${SITIO}/capacity`).body as SiteCapacity;
    const brecha = capacidad.gaps.find((g) => g.kindCode === 'CAP_DELIVERY_ROOMS');
    expect(brecha).toEqual({ kindCode: 'CAP_DELIVERY_ROOMS', declared: 1, derived: 0 });
    expect(capacidad.derived.find((d) => d.kindCode === 'CAP_OPERATING_ROOMS')?.quantity).toBe(2);
    expect(capacidad.gaps.some((g) => g.kindCode === 'CAP_OPERATING_ROOMS')).toBe(false);
  });

  it('una habilitación vencida se calcula al leer', () => {
    const lista = call('GET', `/sites/${SITIO}/licenses`).body as { resolutionNumber: string; status: { code: string } }[];
    expect(lista.find((l) => l.resolutionNumber.startsWith('CODELAB'))?.status.code).toBe('LIC_EXPIRED');
  });

  it('cambiar a una tipología que no admite los espacios es 409 TYPOLOGY_CONFLICT con lista', () => {
    const r = call('PATCH', `/sites/${SITIO}/regulatory`, { body: { typologyCode: 'TYPOLOGY_HEALTH_POST' } });
    expect(r.status).toBe(409);
    expect(razon(r)).toBe('TYPOLOGY_CONFLICT');
    expect(((r.body as { details: { conflicts: unknown[] } }).details.conflicts).length).toBeGreaterThan(0);
  });

  it('un solo propietario vigente por espacio', () => {
    const tomografia = porCodigo('IMG-TC');
    const lab = estructura().units.find((u) => u.code === 'LAB')!;
    const r = call('POST', `/care-spaces/${tomografia.id}/unit-assignments`, { body: { clinicalUnitId: lab.id, roleCode: 'SPACE_UNIT_ROLE_OWNER' } });
    expect(r.status).toBe(409);
    expect(razon(r)).toBe('SPACE_OWNER_TAKEN');
  });
});
