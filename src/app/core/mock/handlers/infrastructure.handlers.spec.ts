import { HttpHeaders } from '@angular/common/http';

import type {
  CareSpaceDetail,
  ImportResult,
  RetireCheck,
  SiteCapacity,
  SiteStructure,
} from '../../data-access/infrastructure/infrastructure.types';
import { ESPACIO_OTRO_TENANT, SITIO_NORTE, SITIO_OTRO_TENANT } from '../fixtures/infrastructure.data';
import { SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from '../fixtures/agenda';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerInfrastructure } from './infrastructure.handlers';
import { registrarProcedimientos } from './procedures.handlers';

/**
 * El simulador tiene que contestar lo que dice el §3 del contrato, con sus
 * errores, y derivar cada recuento de lo que hay en el árbol.
 */
describe('simulador de infraestructura', () => {
  const router = new MockRouter();
  registerInfrastructure(router);
  registrarProcedimientos(router);
  const admin = buscarUsuario('superadmin')!;
  const medica = buscarUsuario('medica')!;

  function llamar(
    method: MockMethod,
    path: string,
    opciones: { body?: unknown; query?: string; ifMatch?: number; user?: typeof admin } = {},
  ): MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const headers = new HttpHeaders(opciones.ifMatch === undefined ? {} : { 'If-Match': String(opciones.ifMatch) });
    const r = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(opciones.query ?? ''),
      body: opciones.body ?? null,
      headers,
      user: opciones.user ?? admin,
    });
    return typeof r === 'object' && r !== null && 'status' in r && 'body' in r ? (r as MockReply) : { status: 200, body: r };
  }

  const cuerpo = <T>(r: MockReply): T => r.body as T;
  const estructura = (siteId = SITIO_SANLUCAS.id): SiteStructure => cuerpo(llamar('GET', `/sites/${siteId}/structure`));
  const porCodigo = (codigo: string) => estructura().spaces.find((s) => s.code === codigo)!;
  const detalle = (id: string): CareSpaceDetail => cuerpo(llamar('GET', `/care-spaces/${id}`));
  const razon = (r: MockReply): unknown => (r.body as { details?: { reason?: string } }).details?.reason;

  it('el catálogo trae formas, perfiles y las reglas padre→hijo con la raíz', () => {
    const cat = cuerpo<{ forms: unknown[]; functions: { forms: string[] }[]; parentRules: { parent: string | null }[] }>(
      llamar('GET', '/practice/infrastructure-catalog'),
    );
    expect(cat.forms.length).toBe(10);
    expect(cat.functions.every((f) => f.forms.length > 0)).toBe(true);
    expect(cat.parentRules.some((r) => r.parent === null)).toBe(true);
  });

  describe('lecturas', () => {
    it('la estructura trae nodos planos con parentId y la hora de la lectura', () => {
      const e = estructura();
      expect(e.spaces.length).toBeGreaterThan(20);
      expect(e.spaces.some((s) => s.parentId === null)).toBe(true);
      expect(new Date(e.asOf).getTime()).not.toBeNaN();
    });

    it('un establecimiento de otro tenant da 404, igual que uno inexistente', () => {
      const ajeno = llamar('GET', `/sites/${SITIO_OTRO_TENANT}/structure`);
      const inexistente = llamar('GET', '/sites/00000000-0000-4000-8000-000000000000/structure');
      expect(ajeno.status).toBe(404);
      expect(ajeno.body).toEqual({ ...(inexistente.body as object), message: (ajeno.body as { message: string }).message });
      expect(llamar('GET', `/care-spaces/${ESPACIO_OTRO_TENANT}`).status).toBe(404);
    });

    it('el consultorio de la doctora arranca sin estructura (estado vacío)', () => {
      expect(estructura(SITIO_CONSULTORIO.id).spaces).toEqual([]);
    });

    it('los recuentos de la ficha se derivan del árbol, no están escritos', () => {
      const hab = detalle(porCodigo('HAB-301').id);
      expect(hab.derived).toEqual({ beds: 2, censableBeds: 2, activeChildren: 2 });
      expect(hab.path.map((p) => p.code)).toEqual(['ED-A', 'ED-A-P3', 'SALA-3B']);
      const edificio = detalle(porCodigo('ED-A').id);
      expect(edificio.derived.beds).toBeGreaterThanOrEqual(6);
    });

    it('los ids de los quirófanos son los de las cirugías de procedures.handlers', () => {
      const casos = cuerpo<{ items: { id: string; operatingRoomId: string }[] }>(llamar('GET', '/procedure-cases', { query: 'limit=50' })).items;
      const ids = new Set(estructura().spaces.map((s) => s.id));
      expect(casos.length).toBeGreaterThan(0);
      for (const caso of casos) expect(ids.has(caso.operatingRoomId)).toBe(true);
    });
  });

  describe('permisos que decide el servidor', () => {
    it('quien no administra lee, pero no escribe (403)', () => {
      expect(estructura().site.viewer?.canWriteStructure).toBe(true);
      const lectura = llamar('GET', `/sites/${SITIO_SANLUCAS.id}/structure`, { user: medica });
      expect((lectura.body as SiteStructure).site.viewer?.canWriteStructure).toBe(false);
      const escritura = llamar('POST', `/sites/${SITIO_SANLUCAS.id}/care-spaces`, {
        user: medica,
        body: { code: 'ZZ-1', name: 'Z', formCode: 'LOC_FORM_BUILDING', functionCode: 'SPACE_FN_BUILDING_GENERIC' },
      });
      expect(escritura.status).toBe(403);
    });
  });

  describe('alta', () => {
    const alta = (body: object, siteId = SITIO_SANLUCAS.id) => llamar('POST', `/sites/${siteId}/care-spaces`, { body });

    it('crea un edificio → piso → consultorio y nace planificado', () => {
      const ed = alta({ code: 'T-ED', name: 'Edificio T', formCode: 'LOC_FORM_BUILDING', functionCode: 'SPACE_FN_BUILDING_GENERIC' });
      expect(ed.status).toBe(201);
      const edificio = cuerpo<CareSpaceDetail>(ed);
      expect(edificio.status.code).toBe('SPACE_PLANNED');
      const piso = alta({ code: 'T-P1', name: 'Piso T1', formCode: 'LOC_FORM_LEVEL', functionCode: 'SPACE_FN_LEVEL_GENERIC', parentSpaceId: edificio.id });
      expect(piso.status).toBe(201);
      expect(detalle(edificio.id).children.map((h) => h.code)).toEqual(['T-P1']);
    });

    it('un código repetido (incluso de un clausurado) da 409 SPACE_CODE_TAKEN', () => {
      const r = alta({ code: 'HAB-399', name: 'Otra', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_INPATIENT_ROOM' });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('SPACE_CODE_TAKEN');
    });

    it('una cama directamente bajo un piso da 422 y no escribe nada', () => {
      const antes = estructura().spaces.length;
      const r = alta({ code: 'T-CAMA', name: 'Cama', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', parentSpaceId: porCodigo('ED-A-P3').id });
      expect(r.status).toBe(422);
      expect(razon(r)).toBe('SPACE_PARENT_RULE');
      expect(estructura().spaces.length).toBe(antes);
    });

    it('la tipología del establecimiento restringe la función (quirófano en un centro ambulatorio)', () => {
      const r = alta({ code: 'N-QX', name: 'Quirófano', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_OPERATING_ROOM' }, SITIO_NORTE.id);
      expect(r.status).toBe(422);
      expect(razon(r)).toBe('TYPOLOGY_NOT_ALLOWED');
    });

    it('una forma que la función no admite da 422', () => {
      const r = alta({ code: 'T-X', name: 'X', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_OPERATING_ROOM', parentSpaceId: porCodigo('HAB-301').id });
      expect(r.status).toBe(422);
    });

    it('un padre de otro establecimiento o de otro tenant da 404 (no revela que existe)', () => {
      const delNorte = estructura(SITIO_NORTE.id).spaces[0]!;
      const fila = { code: 'T-Y', name: 'Y', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_CONSULTING_ROOM' };
      expect(alta({ ...fila, parentSpaceId: delNorte.id }).status).toBe(404);
      expect(alta({ ...fila, parentSpaceId: ESPACIO_OTRO_TENANT }).status).toBe(404);
    });
  });

  describe('alta masiva', () => {
    const masiva = (body: object) => llamar('POST', `/sites/${SITIO_SANLUCAS.id}/care-spaces/bulk`, { body });
    const base = () => ({
      parentSpaceId: porCodigo('HAB-302').id,
      formCode: 'LOC_FORM_BED',
      functionCode: 'SPACE_FN_BED_STANDARD',
      namePattern: 'Cama 302-{C..F}',
    });

    it('crea las cuatro camas del patrón en una respuesta', () => {
      const r = masiva({ ...base(), codePattern: '302-{C..F}' });
      expect(r.status).toBe(201);
      expect(cuerpo<{ created: CareSpaceDetail[] }>(r).created.map((x) => x.code)).toEqual(['302-C', '302-D', '302-E', '302-F']);
    });

    it('todo o nada: si un código choca, no se crea ninguno', () => {
      const antes = estructura().spaces.length;
      const r = masiva({ ...base(), codePattern: '302-{A..H}', namePattern: 'Cama 302-{A..H}' });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('SPACE_CODE_TAKEN');
      expect(estructura().spaces.length).toBe(antes);
    });

    it('rechaza más de 200', () => {
      const r = masiva({ ...base(), codePattern: 'X-{1..201}', namePattern: 'X {1..201}' });
      expect(r.status).toBe(422);
    });
  });

  describe('importación CSV', () => {
    const importar = (rows: object[], dryRun: boolean) =>
      llamar('POST', `/sites/${SITIO_SANLUCAS.id}/care-spaces/import`, { body: { rows }, query: `dryRun=${dryRun}` });
    const fila = (code: string, extra: object = {}) => ({
      code,
      name: code,
      formCode: 'LOC_FORM_ROOM',
      functionCode: 'SPACE_FN_CONSULTING_ROOM',
      parentCode: 'ED-B-P1',
      ...extra,
    });

    it('en seco devuelve exactamente las líneas con error, con campo y motivo, y no escribe', () => {
      const antes = estructura().spaces.length;
      const r = cuerpo<ImportResult>(
        importar([fila('IMP-1'), fila('CONS-B01'), fila('IMP-3', { formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD' }), fila('IMP-4', { parentCode: 'NO-EXISTE' })], true),
      );
      expect(r.ok).toBe(false);
      expect(r.rows.filter((x) => x.status === 'error').map((x) => x.line)).toEqual([3, 4, 5]);
      expect(r.rows[1].errors[0].field).toBe('code');
      expect(estructura().spaces.length).toBe(antes);
    });

    it('con el archivo corregido crea todas las filas y el padre puede ser una fila anterior', () => {
      const r = cuerpo<ImportResult>(
        importar([fila('IMP-A', { parentCode: 'ED-B-P1' }), fila('IMP-B', { parentCode: 'ED-B-P1' })], false),
      );
      expect(r.ok).toBe(true);
      expect(r.created).toBe(2);
      expect(estructura().spaces.some((s) => s.code === 'IMP-B')).toBe(true);
    });

    it('no crea nada si al revalidar alguna fila falla', () => {
      const antes = estructura().spaces.length;
      const r = cuerpo<ImportResult>(importar([fila('IMP-OK'), fila('CONS-B01')], false));
      expect(r.ok).toBe(false);
      expect(r.created).toBeUndefined();
      expect(estructura().spaces.length).toBe(antes);
    });
  });

  describe('edición, versión y movimiento', () => {
    it('PATCH con If-Match viejo da 412; con el vigente sube rowVersion', () => {
      const e = porCodigo('CONS-102');
      expect(llamar('PATCH', `/care-spaces/${e.id}`, { body: { name: 'X' }, ifMatch: e.rowVersion + 7 }).status).toBe(412);
      const ok = llamar('PATCH', `/care-spaces/${e.id}`, { body: { name: 'Consultorio 102 (pediatría)' }, ifMatch: e.rowVersion });
      expect(ok.status).toBe(200);
      expect(cuerpo<CareSpaceDetail>(ok).rowVersion).toBe(e.rowVersion + 1);
    });

    it('sin If-Match tampoco se edita', () => {
      expect(llamar('PATCH', `/care-spaces/${porCodigo('CONS-102').id}`, { body: { name: 'Y' } }).status).toBe(412);
    });

    it('cambiar el código de un espacio activo da 422 SPACE_IMMUTABLE_FIELD', () => {
      const e = porCodigo('CONS-101');
      const r = llamar('PATCH', `/care-spaces/${e.id}`, { body: { code: 'NUEVO' }, ifMatch: e.rowVersion });
      expect(r.status).toBe(422);
      expect(razon(r)).toBe('SPACE_IMMUTABLE_FIELD');
    });

    it('mover un nodo bajo su propio hijo da 422 SPACE_CYCLE', () => {
      const piso = porCodigo('ED-A-P3');
      const hijo = porCodigo('SALA-3B');
      const r = llamar('POST', `/care-spaces/${piso.id}/move`, { body: { parentSpaceId: hijo.id }, ifMatch: piso.rowVersion });
      expect(r.status).toBe(422);
      expect(razon(r)).toBe('SPACE_CYCLE');
    });
  });

  describe('ciclo de vida', () => {
    const ciclo = (id: string, v: number, body: object) => llamar('POST', `/care-spaces/${id}/lifecycle`, { body, ifMatch: v });

    it('clausurar sin motivo da 422; suspender también lo exige', () => {
      const e = porCodigo('UTI-1');
      expect(ciclo(e.id, e.rowVersion, { action: 'retire' }).status).toBe(422);
      expect(ciclo(e.id, e.rowVersion, { action: 'suspend' }).status).toBe(422);
    });

    it('clausurar una habitación con camas activas da 409 con ACTIVE_CHILDREN, count y nextAction', () => {
      const e = porCodigo('HAB-302');
      const r = ciclo(e.id, e.rowVersion, { action: 'retire', reason: 'Remodelación' });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('SPACE_RETIRE_BLOCKED');
      const b = (r.body as { details: { blockers: RetireCheck['blockers'][number][] } }).details.blockers;
      expect(b[0]).toMatchObject({ kind: 'ACTIVE_CHILDREN', count: expect.any(Number) });
      expect(b[0].nextAction.length).toBeGreaterThan(10);
    });

    it('un quirófano con cirugías futuras lista los ids de las cirugías (los de procedures.handlers)', () => {
      const q1 = porCodigo('QX-1');
      const check = cuerpo<RetireCheck>(llamar('GET', `/care-spaces/${q1.id}/retire-check`));
      const cirugia = check.blockers.find((b) => b.kind === 'FUTURE_PROCEDURE')!;
      expect(cirugia.count).toBe(cirugia.sampleIds.length);
      const casos = cuerpo<{ items: { id: string; operatingRoomId: string }[] }>(
        llamar('GET', '/procedure-cases', { query: `operatingRoomId=${q1.id}` }),
      ).items;
      for (const id of cirugia.sampleIds) expect(casos.map((x) => x.id)).toContain(id);
    });

    it('el bloqueo se levanta al resolverlo y el retire-check lo refleja; luego se clausura y el código sigue reservado', () => {
      const habitacion = porCodigo('HAB-302');
      const camas = detalle(habitacion.id).children;
      for (const cama of camas) {
        const vigente = porCodigo(cama.code);
        expect(ciclo(vigente.id, vigente.rowVersion, { action: 'retire', reason: 'Baja' }).status).toBe(200);
      }
      expect(cuerpo<RetireCheck>(llamar('GET', `/care-spaces/${habitacion.id}/retire-check`)).blockers).toEqual([]);
      const actual = porCodigo('HAB-302');
      const r = ciclo(actual.id, actual.rowVersion, { action: 'retire', reason: 'Remodelación' });
      expect(r.status).toBe(200);
      expect(cuerpo<CareSpaceDetail>(r).status.code).toBe('SPACE_RETIRED');
      expect(cuerpo<CareSpaceDetail>(r).validTo).not.toBeNull();
      const otra = llamar('POST', `/sites/${SITIO_SANLUCAS.id}/care-spaces`, {
        body: { code: 'HAB-302', name: 'Otra', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_INPATIENT_ROOM' },
      });
      expect(razon(otra)).toBe('SPACE_CODE_TAKEN');
    });

    it('activar un hijo con el padre suspendido da 422 PARENT_NOT_ACTIVE', () => {
      const nuevo = cuerpo<CareSpaceDetail>(
        llamar('POST', `/sites/${SITIO_SANLUCAS.id}/care-spaces`, {
          body: { code: 'T-SUSP', name: 'Bajo suspendido', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_ICU', parentSpaceId: porCodigo('UTI').id },
        }),
      );
      const uti = porCodigo('UTI');
      expect(ciclo(uti.id, uti.rowVersion, { action: 'suspend', reason: 'Fumigación' }).status).toBe(200);
      const r = ciclo(nuevo.id, nuevo.rowVersion, { action: 'activate' });
      expect(r.status).toBe(422);
      expect(razon(r)).toBe('PARENT_NOT_ACTIVE');
    });
  });

  describe('regulatorio, habilitaciones y capacidad', () => {
    it('la capacidad real se deriva: activar una cama censable sube derived en 1 sin tocar la declarada', () => {
      const antes = cuerpo<SiteCapacity>(llamar('GET', `/sites/${SITIO_SANLUCAS.id}/capacity`));
      const censables = (c: SiteCapacity) => c.derived.find((d) => d.kindCode === 'CAP_BEDS_CENSABLE')!.quantity;
      const cama = cuerpo<CareSpaceDetail>(
        llamar('POST', `/sites/${SITIO_SANLUCAS.id}/care-spaces`, {
          body: { code: 'T-CAP', name: 'Cama T', formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', parentSpaceId: porCodigo('HAB-301').id, censable: true, bedCategoryCode: 'BED_CAT_PRIVATE' },
        }),
      );
      expect(censables(cuerpo(llamar('GET', `/sites/${SITIO_SANLUCAS.id}/capacity`)))).toBe(censables(antes));
      llamar('POST', `/care-spaces/${cama.id}/lifecycle`, { body: { action: 'activate' }, ifMatch: cama.rowVersion });
      const despues = cuerpo<SiteCapacity>(llamar('GET', `/sites/${SITIO_SANLUCAS.id}/capacity`));
      expect(censables(despues)).toBe(censables(antes) + 1);
      expect(despues.declared).toEqual(antes.declared);
    });

    it('las brechas sólo listan lo que difiere', () => {
      const cap = cuerpo<SiteCapacity>(llamar('GET', `/sites/${SITIO_SANLUCAS.id}/capacity`));
      expect(cap.gaps.every((g) => g.declared !== g.derived)).toBe(true);
      expect(cap.gaps.map((g) => g.kindCode)).toContain('CAP_BEDS_CENSABLE');
    });

    it('una habilitación guardada como vigente que venció ayer se lee como vencida', () => {
      const lista = cuerpo<{ status: { code: string }; resolutionNumber: string | null }[]>(llamar('GET', `/sites/${SITIO_SANLUCAS.id}/licenses`));
      expect(lista.find((l) => l.resolutionNumber === 'RA-0112/2024')!.status.code).toBe('LIC_EXPIRED');
    });

    it('cambiar a una tipología que incumplen los espacios da 409 TYPOLOGY_CONFLICT con la lista', () => {
      const sitio = estructura().site;
      const r = llamar('PATCH', `/sites/${SITIO_SANLUCAS.id}/regulatory`, { body: { typologyCode: 'TYPOLOGY_HEALTH_POST' }, ifMatch: sitio.rowVersion });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('TYPOLOGY_CONFLICT');
      expect((r.body as { details: { conflicts: unknown[] } }).details.conflicts.length).toBeGreaterThan(0);
    });

    it('un SNIS verificado de otro establecimiento da un error genérico que no dice de quién es', () => {
      const olivos = estructura(SITIO_OLIVOS.id).site;
      const r = llamar('PATCH', `/sites/${olivos.id}/regulatory`, { body: { snisCode: 'DEMO-SNIS-0001' }, ifMatch: olivos.rowVersion });
      expect(r.status).toBe(409);
      expect(razon(r)).toBe('SNIS_CODE_UNAVAILABLE');
      expect(JSON.stringify(r.body)).not.toMatch(/San Lucas/);
    });
  });
});
