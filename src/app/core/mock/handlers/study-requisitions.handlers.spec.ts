import { HttpHeaders } from '@angular/common/http';

import { LATERALITY, ESTUDIO, ORDER_CATEGORY } from '../fixtures/concepts';
import { PATIENTS } from '../fixtures/people';
import { CONTRASTE, ESTUDIOS_DEL_CATALOGO, familiaDeEstudio } from '../fixtures/study-catalog';
import { crearRouterSimulado } from './index';
import { isMockReply, type MockMethod } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO, buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { repiteElDetalle, detallesDeOrden } from './service-request-detail.mock';
import type { StudyCatalogDetail, StudyCatalogItem } from '../../data-access/study-catalog/study-catalog.types';

/**
 * El catálogo de estudios, la requisición y la bandeja del ejecutor del
 * simulador (H3). Tres niveles: lo correcto (pedir y verlo llegar al centro),
 * los límites (idempotencia, paginación, otro centro) y lo inválido (cada
 * regla V1-V9 con su `details.reason` e `itemIndex`).
 */
describe('catálogo de estudios, requisiciones y bandeja del ejecutor (simulador)', () => {
  const router = crearRouterSimulado();
  const medica = buscarUsuario('medica')!;
  const laboratorio = buscarUsuario('laboratorio')!;
  const paciente = PATIENTS[1]!.id;

  interface Result<T = any> {
    readonly status: number;
    readonly body: T;
  }

  function call<T = any>(
    method: MockMethod,
    path: string,
    opciones: { body?: unknown; query?: string; key?: string; tenant?: string; user?: typeof medica } = {},
  ): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const headers = {
      ...(opciones.key === undefined ? {} : { 'Idempotency-Key': opciones.key }),
      ...(opciones.tenant === undefined ? {} : { 'X-Tenant-Id': opciones.tenant }),
    };
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(opciones.query ?? ''),
      body: opciones.body ?? {},
      headers: new HttpHeaders(headers),
      user: opciones.user ?? medica,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  const porCodigo = (code: string): StudyCatalogItem =>
    ESTUDIOS_DEL_CATALOGO.find((e) => e.item.code === code)!.item;
  const detalle = (code: string): StudyCatalogDetail =>
    call<StudyCatalogDetail>('GET', `/clinical/study-catalog/${porCodigo(code).conceptId}`).body;

  let clave = 0;
  const nuevaClave = (): string => `rq-${(clave += 1)}`;

  const rxMano = () => detalle('RX_MANO_PA_OBL');
  const mano = () => rxMano().allowedBodySites.find((r) => r.code === 'MANO')!;
  const hemograma = () => detalle('HEMOGRAMA');

  function pedir(items: unknown[], extra: Record<string, unknown> = {}, key = nuevaClave()) {
    return call('POST', '/clinical/requisitions', {
      key,
      body: { custodianTenantId: TENANT_CLINICA, patientProfileId: paciente, items, ...extra },
    });
  }

  describe('GET /clinical/study-catalog', () => {
    it('lista por familia, ordenado y sin mezclar', () => {
      const lab = call('GET', '/clinical/study-catalog', { query: 'family=LAB&limit=100' }).body;
      const img = call('GET', '/clinical/study-catalog', { query: 'family=IMAGING&limit=100' }).body;
      expect(lab.items.length).toBeGreaterThan(40);
      expect(lab.items.every((i: StudyCatalogItem) => i.family === 'LAB')).toBe(true);
      expect(img.items.every((i: StudyCatalogItem) => i.family === 'IMAGING')).toBe(true);
      const nombres = lab.items.map((i: StudyCatalogItem) => i.display);
      expect(nombres).toEqual([...nombres].sort((a, b) => a.normalize('NFD').localeCompare(b.normalize('NFD'))));
    });

    it('trae los estudios que pide el plan: hemograma, EGO, perfil lipídico, ionograma, Chagas, RX mano y tórax, TC abdomen, RM rodilla, eco abdominal', () => {
      for (const code of ['HEMOGRAMA', 'EGO', 'PERFIL_LIPIDICO', 'ELECTROLITOS', 'CHAGAS_ELISA', 'RX_MANO_PA_OBL', 'RX_TORAX_PA', 'TC_ABDOMEN_SIN', 'RM_RODILLA', 'ECO_ABDOMEN_COMPLETO']) {
        expect(ESTUDIOS_DEL_CATALOGO.some((e) => e.item.code === code), code).toBe(true);
      }
    });

    it('busca sin tildes ni mayúsculas, por nombre, sinónimo y componente', () => {
      const porNombre = call('GET', '/clinical/study-catalog', { query: 'q=LIPIDICO' }).body.items;
      expect(porNombre.some((i: StudyCatalogItem) => i.code === 'PERFIL_LIPIDICO')).toBe(true);
      const porSinonimo = call('GET', '/clinical/study-catalog', { query: 'q=ionograma' }).body.items;
      expect(porSinonimo.some((i: StudyCatalogItem) => i.code === 'ELECTROLITOS')).toBe(true);
      const porComponente = call('GET', '/clinical/study-catalog', { query: 'q=plaquetas&family=LAB' }).body.items;
      expect(porComponente.some((i: StudyCatalogItem) => i.code === 'HEMOGRAMA')).toBe(true);
    });

    it('pagina por cursor sin repetir ni saltear', () => {
      const vistos: string[] = [];
      let cursor: string | null = null;
      let paginas = 0;
      do {
        const pagina: Result = call('GET', '/clinical/study-catalog', {
          query: `limit=10${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`,
        });
        vistos.push(...pagina.body.items.map((i: StudyCatalogItem) => i.conceptId));
        cursor = pagina.body.nextCursor;
        paginas += 1;
      } while (cursor !== null && paginas < 100);
      expect(new Set(vistos).size).toBe(vistos.length);
      expect(vistos.length).toBe(ESTUDIOS_DEL_CATALOGO.length);
    });

    it('rechaza una familia, un tope o un cursor fuera de contrato con 400', () => {
      expect(call('GET', '/clinical/study-catalog', { query: 'family=X' }).status).toBe(400);
      expect(call('GET', '/clinical/study-catalog', { query: 'limit=101' }).status).toBe(400);
      expect(call('GET', '/clinical/study-catalog', { query: 'cursor=%%%' }).status).toBe(400);
    });

    it('el detalle de un análisis trae el árbol de componentes, la muestra sugerida y la atribución LOINC', () => {
      const h = hemograma();
      expect(h.components.length).toBeGreaterThanOrEqual(20);
      expect(h.componentsSelectable).toBe(true);
      expect(h.components.some((c) => c.display.includes('Hemoglobina'))).toBe(true);
      expect(h.suggestedSpecimen?.isDefault).toBe(true);
      expect(h.allowedSpecimenTypes.length).toBeGreaterThan(10);
      expect(h.lab).not.toBeNull();
      expect(h.attribution.some((a) => a.source === 'LOINC')).toBe(true);
    });

    it('el detalle de un estudio de imagen trae modalidad, regiones (la suya por defecto), lateralidad y contraste', () => {
      const d = rxMano();
      expect(d.allowedModalities).toHaveLength(1);
      expect(d.allowedBodySites.find((r) => r.isDefault)?.code).toBe('MANO');
      expect(mano().admitsLaterality).toBe(true);
      expect(d.lateralityOptions.map((l) => l.code)).toEqual(['IZQ', 'DER', 'BIL']);
      expect(d.imaging?.requiresLaterality).toBe(true);
      expect(d.contrastOptions.find((c) => c.isDefault)?.conceptId).toBe(CONTRASTE.sin);
      const tc = detalle('TC_ABDOMEN_SIN');
      expect(tc.contrastOptions).toHaveLength(3);
    });

    it('un concepto que no es un estudio es 404', () => {
      expect(call('GET', `/clinical/study-catalog/${uuid('no-existe')}`).status).toBe(404);
    });

    it('la familia de los estudios heredados es explícita (B1), no sale del prefijo STUDY-', () => {
      expect(familiaDeEstudio(ESTUDIO['STUDY-HEMOGRAMA']!)).toBe('LAB');
      expect(familiaDeEstudio(ESTUDIO['STUDY-RX-TORAX']!)).toBe('IMAGING');
      expect(familiaDeEstudio(ESTUDIO['STUDY-ECG']!)).toBe('CARDIO');
      expect(familiaDeEstudio(uuid('nada'))).toBeNull();
    });
  });

  describe('POST /clinical/requisitions', () => {
    it('pide un hemograma de 3 componentes y una RX de mano izquierda, y los lee de vuelta', () => {
      const h = hemograma();
      const marcados = h.components.filter((c) => /Hemoglobina|Hematocrito|Plaquetas/.test(c.display)).slice(0, 3);
      expect(marcados).toHaveLength(3);
      const r = pedir([
        { codeConceptId: h.conceptId, category: 'LAB', specimenTypeConceptId: h.suggestedSpecimen!.conceptId, componentConceptIds: marcados.map((c) => c.conceptId) },
        {
          codeConceptId: rxMano().conceptId,
          category: 'IMAGING',
          imaging: { bodySiteConceptId: mano().conceptId, lateralityConceptId: LATERALITY['COND_LAT_LEFT'], contrastConceptId: CONTRASTE.sin },
        },
      ]);
      expect(r.status).toBe(201);
      expect(r.body.replayed).toBe(false);
      expect(r.body.items).toHaveLength(2);
      const [lab, img] = r.body.items;
      expect(lab.requisitionId).toBe(r.body.requisitionId);
      expect(img.requisitionId).toBe(r.body.requisitionId);
      expect(lab.componentsSpecified).toBe(true);
      expect(lab.components.map((c: { ordinal: number }) => c.ordinal)).toEqual([1, 2, 3]);
      expect(lab.specimenTypeDisplay).toBeTruthy();
      expect(img.imaging).toMatchObject({ bodySiteDisplay: 'Mano', lateralityDisplay: 'Izquierda', contrastDisplay: 'Sin contraste' });
      expect(img.imaging.modalityDisplay).toBeTruthy();

      // «Recargar»: la orden vuelve con su detalle.
      const leido = call('GET', `/clinical/service-requests/${lab.id}`);
      expect(leido.status).toBe(200);
      expect(leido.body.components).toHaveLength(3);
      const historico = call('GET', `/diagnostics/patients/${paciente}/orders`).body.orders;
      const volvio = historico.find((o: { id: string }) => o.id === img.id);
      expect(volvio.imaging.lateralityDisplay).toBe('Izquierda');
      expect(volvio.requisitionId).toBe(r.body.requisitionId);
    });

    it('es idempotente: la misma clave devuelve la misma requisición con replayed, otro cuerpo es 409', () => {
      const h = hemograma();
      const cuerpo = [{ codeConceptId: h.conceptId, componentConceptIds: [h.components[0]!.conceptId] }];
      const primera = pedir(cuerpo, {}, 'clave-fija');
      const otra = pedir(cuerpo, {}, 'clave-fija');
      expect(otra.status).toBe(201);
      expect(otra.body.replayed).toBe(true);
      expect(otra.body.requisitionId).toBe(primera.body.requisitionId);
      const conflicto = pedir([{ codeConceptId: h.conceptId, componentConceptIds: [h.components[1]!.conceptId] }], {}, 'clave-fija');
      expect(conflicto.status).toBe(409);
      expect(conflicto.body.details.reason).toBe('REQUISITION_IDEMPOTENCY_KEY_CONFLICT');
    });

    it('exige Idempotency-Key y de 1 a 30 estudios', () => {
      expect(call('POST', '/clinical/requisitions', { body: { patientProfileId: paciente, items: [{ codeConceptId: hemograma().conceptId }] } }).status).toBe(400);
      expect(pedir([]).status).toBe(400);
      expect(pedir(Array.from({ length: 31 }, () => ({ codeConceptId: porCodigo('CHAGAS_ELISA').conceptId }))).status).toBe(400);
    });

    it('no es atómico a medias: si el segundo renglón falla no se crea el primero', () => {
      const antes = call('GET', `/diagnostics/patients/${paciente}/orders`).body.orders.length;
      const r = pedir([
        { codeConceptId: porCodigo('CHAGAS_ELISA').conceptId },
        { codeConceptId: rxMano().conceptId },
      ]);
      expect(r.status).toBe(422);
      expect(call('GET', `/diagnostics/patients/${paciente}/orders`).body.orders.length).toBe(antes);
    });

    it('un usuario sin rol clínico recibe 403', () => {
      const r = call('POST', '/clinical/requisitions', {
        key: nuevaClave(),
        user: laboratorio,
        body: { patientProfileId: paciente, items: [{ codeConceptId: porCodigo('CHAGAS_ELISA').conceptId }] },
      });
      expect(r.status).toBe(403);
    });

    const h = (): StudyCatalogDetail => hemograma();
    const casos: readonly [string, string, () => unknown, string][] = [
      ['STUDY_NOT_IN_CATALOG', 'codeConceptId', () => ({ codeConceptId: uuid('inexistente') }), 'codeConceptId'],
      ['SERVICE_REQUEST_CATEGORY_STUDY_MISMATCH', 'category', () => ({ codeConceptId: h().conceptId, category: 'IMAGING', componentConceptIds: [h().components[0]!.conceptId] }), 'category'],
      ['SPECIMEN_NOT_ALLOWED_FOR_CATEGORY', 'specimen', () => ({ codeConceptId: rxMano().conceptId, specimenTypeConceptId: h().suggestedSpecimen!.conceptId, imaging: { bodySiteConceptId: mano().conceptId } }), 'specimenTypeConceptId'],
      ['SPECIMEN_TYPE_NOT_IN_CATALOG', 'specimen', () => ({ codeConceptId: h().conceptId, specimenTypeConceptId: uuid('no-es-muestra'), componentConceptIds: [h().components[0]!.conceptId] }), 'specimenTypeConceptId'],
      ['COMPONENTS_EMPTY', 'components', () => ({ codeConceptId: h().conceptId, componentConceptIds: [] }), 'componentConceptIds'],
      ['COMPONENTS_NOT_SELECTABLE', 'components', () => ({ codeConceptId: porCodigo('CHAGAS_ELISA').conceptId, componentConceptIds: [h().components[0]!.conceptId] }), 'componentConceptIds'],
      ['COMPONENT_NOT_IN_PANEL', 'components', () => ({ codeConceptId: h().conceptId, componentConceptIds: [uuid('ajeno')] }), 'componentConceptIds'],
      ['IMAGING_FIELDS_NOT_ALLOWED', 'imaging', () => ({ codeConceptId: h().conceptId, componentConceptIds: [h().components[0]!.conceptId], imaging: { bodySiteConceptId: mano().conceptId } }), 'imaging'],
      ['MODALITY_NOT_IN_CATALOG', 'modality', () => ({ codeConceptId: rxMano().conceptId, imaging: { modalityConceptId: uuid('x'), bodySiteConceptId: mano().conceptId } }), 'imaging.modalityConceptId'],
      ['MODALITY_STUDY_MISMATCH', 'modality', () => ({ codeConceptId: rxMano().conceptId, imaging: { modalityConceptId: porCodigo('TC_MANO').modalityConceptId, bodySiteConceptId: mano().conceptId } }), 'imaging.modalityConceptId'],
      ['BODY_SITE_REQUIRED', 'body', () => ({ codeConceptId: rxMano().conceptId }), 'imaging.bodySiteConceptId'],
      ['BODY_SITE_NOT_IN_CATALOG', 'body', () => ({ codeConceptId: rxMano().conceptId, imaging: { bodySiteConceptId: uuid('x') } }), 'imaging.bodySiteConceptId'],
      ['LATERALITY_NOT_IN_CATALOG', 'lat', () => ({ codeConceptId: rxMano().conceptId, imaging: { bodySiteConceptId: mano().conceptId, lateralityConceptId: uuid('x') } }), 'imaging.lateralityConceptId'],
      ['LATERALITY_REQUIRES_BODY_SITE', 'lat', () => ({ codeConceptId: ESTUDIO['STUDY-RX-TORAX'], category: 'IMAGING', imaging: { lateralityConceptId: LATERALITY['COND_LAT_LEFT'] } }), 'imaging.lateralityConceptId'],
      ['LATERALITY_NOT_APPLICABLE', 'lat', () => ({ codeConceptId: porCodigo('RX_TORAX_PA').conceptId, imaging: { bodySiteConceptId: detalle('RX_TORAX_PA').allowedBodySites.find((r) => !r.admitsLaterality)!.conceptId, lateralityConceptId: LATERALITY['COND_LAT_LEFT'] } }), 'imaging.lateralityConceptId'],
      ['CONTRAST_NOT_IN_CATALOG', 'ctr', () => ({ codeConceptId: rxMano().conceptId, imaging: { bodySiteConceptId: mano().conceptId, contrastConceptId: uuid('x') } }), 'imaging.contrastConceptId'],
      ['CONTRAST_REQUIRES_MODALITY', 'ctr', () => ({ codeConceptId: ESTUDIO['STUDY-ECO-ABD'], category: 'IMAGING', imaging: { contrastConceptId: CONTRASTE.con } }), 'imaging.contrastConceptId'],
    ];
    it.each(casos)('%s: 422 con details.reason, field e itemIndex', (reason, _t, renglon, field) => {
      // El renglón malo va segundo: itemIndex es 1.
      const r = pedir([{ codeConceptId: porCodigo('CHAGAS_ELISA').conceptId }, renglon()]);
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('PRECONDITION_FAILED');
      expect(r.body.details).toMatchObject({ reason, field, itemIndex: 1 });
      expect(r.body.reason).toBeUndefined();
    });

    it('el alta suelta aplica las mismas reglas, sin itemIndex', () => {
      const r = call('POST', '/clinical/service-requests', {
        body: { custodianTenantId: TENANT_CLINICA, patientProfileId: paciente, codeConceptId: hemograma().conceptId, componentConceptIds: [] },
      });
      expect(r.status).toBe(422);
      expect(r.body.details.reason).toBe('COMPONENTS_EMPTY');
      expect('itemIndex' in r.body.details).toBe(false);
    });

    it('un estudio heredado (STUDY-*) se sigue pidiendo sin detalle', () => {
      const r = call('POST', '/clinical/service-requests', {
        body: { custodianTenantId: TENANT_CLINICA, patientProfileId: paciente, codeConceptId: ESTUDIO['STUDY-ECO-ABD'], category: 'IMAGING' },
      });
      expect(r.status).toBe(201);
      const leida = call('GET', `/clinical/service-requests/${r.body.id}`).body;
      expect(leida.componentsSpecified).toBe(false);
      expect(leida.imaging).toBeNull();
      expect(leida.codeDisplay).toBeTruthy();
    });

    it('rechaza el mismo estudio dos veces en la requisición, apuntando al primero', () => {
      const h2 = hemograma();
      const r = pedir([
        { codeConceptId: h2.conceptId, componentConceptIds: [h2.components[0]!.conceptId] },
        { codeConceptId: h2.conceptId, componentConceptIds: [h2.components[0]!.conceptId] },
      ]);
      expect(r.status).toBe(422);
      expect(r.body.details).toMatchObject({ reason: 'DUPLICATE_STUDY_DETECTED', itemIndex: 1, duplicateOfItemIndex: 0 });
    });

    it('mano izquierda y mano derecha no son el mismo estudio', () => {
      const lado = (l: string) => ({
        codeConceptId: rxMano().conceptId,
        imaging: { bodySiteConceptId: mano().conceptId, lateralityConceptId: LATERALITY[l] },
      });
      expect(pedir([lado('COND_LAT_LEFT'), lado('COND_LAT_RIGHT')]).status).toBe(201);
    });

    it('un informe previo con otra región o componentes no cubiertos no repite el pedido (D10)', () => {
      detallesDeOrden.agregar({
        id: 'sr-previa',
        requisitionId: null,
        family: 'IMAGING',
        specimenTypeConceptId: null,
        components: [],
        componentsSpecified: false,
        imaging: { modalityConceptId: null, bodySiteConceptId: 'b-1', lateralityConceptId: 'l-izq', contrastConceptId: null },
      });
      expect(repiteElDetalle('sr-previa', { bodySiteConceptId: 'b-1', lateralityConceptId: 'l-izq' })).toBe(true);
      expect(repiteElDetalle('sr-previa', { bodySiteConceptId: 'b-1', lateralityConceptId: 'l-der' })).toBe(false);
      detallesDeOrden.agregar({
        id: 'sr-lab',
        requisitionId: null,
        family: 'LAB',
        specimenTypeConceptId: null,
        components: [{ conceptId: 'c-1', ordinal: 1 }, { conceptId: 'c-2', ordinal: 2 }],
        componentsSpecified: true,
        imaging: null,
      });
      expect(repiteElDetalle('sr-lab', { componentConceptIds: ['c-2'] })).toBe(true);
      expect(repiteElDetalle('sr-lab', { componentConceptIds: ['c-2', 'c-9'] })).toBe(false);
      expect(repiteElDetalle(undefined, { componentConceptIds: ['c-9'] })).toBe(true);
    });
  });

  describe('puente a la bandeja del ejecutor (B2) y POST /diagnostics/service-requests/worklist', () => {
    const enElCentro = (scope: string, extra: Record<string, unknown> = {}) =>
      call('POST', '/diagnostics/service-requests/worklist', {
        user: laboratorio,
        tenant: TENANT_LABORATORIO,
        body: { scope, limit: 100, ...extra },
      });

    it('lo que el médico pide con performerTenantId aparece en la bandeja con su resumen y detalle', () => {
      const h2 = hemograma();
      const marcados = h2.components.slice(0, 3).map((c) => c.conceptId);
      const r = pedir(
        [
          { codeConceptId: h2.conceptId, category: 'LAB', specimenTypeConceptId: h2.suggestedSpecimen!.conceptId, componentConceptIds: marcados },
          { codeConceptId: rxMano().conceptId, category: 'IMAGING', imaging: { bodySiteConceptId: mano().conceptId, lateralityConceptId: LATERALITY['COND_LAT_LEFT'], contrastConceptId: CONTRASTE.sin } },
        ],
        { performerTenantId: TENANT_LABORATORIO },
      );
      expect(r.status).toBe(201);
      const [idLab, idImg] = r.body.items.map((i: { id: string }) => i.id);

      const lab = enElCentro('LAB').body.items.find((i: { serviceRequestId: string }) => i.serviceRequestId === idLab);
      expect(lab).toBeDefined();
      expect(lab.state).toBe('PENDING');
      expect(lab.scope).toBe('LAB');
      expect(lab.summary).toBe(`${h2.display} · 3 componentes`);
      expect(lab.components).toHaveLength(3);
      expect(lab.componentsSpecified).toBe(true);
      expect(lab.requisitionId).toBe(r.body.requisitionId);
      expect(lab.specimenTypeDisplay).toBeTruthy();

      const img = enElCentro('IMAGING').body.items.find((i: { serviceRequestId: string }) => i.serviceRequestId === idImg);
      expect(img.scope).toBe('IMAGING');
      expect(img.summary).toBe(`${rxMano().display} · Mano · Izquierda · Sin contraste`);
      expect(img.imaging.bodySiteDisplay).toBe('Mano');
      // No se mezclan las bandejas.
      expect(enElCentro('LAB').body.items.some((i: { serviceRequestId: string }) => i.serviceRequestId === idImg)).toBe(false);

      const uno = call('GET', `/diagnostics/service-requests/${idImg}`, { user: laboratorio, tenant: TENANT_LABORATORIO });
      expect(uno.status).toBe(200);
      expect(uno.body.summary).toBe(img.summary);
    });

    it('las transiciones del simulador siguen funcionando sobre la orden pedida', () => {
      const r = pedir([{ codeConceptId: porCodigo('CHAGAS_ELISA').conceptId }], { performerTenantId: TENANT_LABORATORIO });
      const id = r.body.items[0].id;
      const paso = (action: string) =>
        call('POST', `/diagnostics/lab/orders/${id}/transitions`, { user: laboratorio, tenant: TENANT_LABORATORIO, body: { action } });
      expect(paso('RECEIVE').status).toBe(200);
      expect(enElCentro('LAB', { states: ['RECEIVED'] }).body.items.some((i: { serviceRequestId: string }) => i.serviceRequestId === id)).toBe(true);
      expect(paso('PROCESS').status).toBe(200);
      const item = enElCentro('LAB').body.items.find((i: { serviceRequestId: string }) => i.serviceRequestId === id);
      expect(item.state).toBe('IN_PROCESS');
    });

    it('una orden sin ejecutor no llega a ninguna bandeja (D9)', () => {
      const r = pedir([{ codeConceptId: porCodigo('CHAGAS_RAPIDA').conceptId }]);
      const id = r.body.items[0].id;
      expect(enElCentro('LAB').body.items.some((i: { serviceRequestId: string }) => i.serviceRequestId === id)).toBe(false);
    });

    it('otro centro no ve la orden: la lista no la trae y el detalle es 404', () => {
      const r = pedir([{ codeConceptId: porCodigo('CHAGAS_IFI').conceptId }], { performerTenantId: TENANT_LABORATORIO });
      const id = r.body.items[0].id;
      const otro = buscarUsuario('medica')!;
      const ajeno = call('GET', `/diagnostics/service-requests/${id}`, { user: otro, tenant: TENANT_CLINICA });
      expect([403, 404]).toContain(ajeno.status);
      const sinSesion = call('POST', '/diagnostics/service-requests/worklist', { user: otro, tenant: TENANT_CLINICA, body: { scope: 'LAB' } });
      expect(sinSesion.status).toBe(403);
    });

    it('las órdenes sembradas del laboratorio siguen apareciendo y el estado se deriva del camino', () => {
      const todas = enElCentro('LAB').body.items;
      const estados = new Set(todas.map((i: { state: string }) => i.state));
      expect(estados.has('IN_PROCESS') || estados.has('REPORTED')).toBe(true);
      expect(todas.every((i: { scope: string }) => i.scope === 'LAB')).toBe(true);
    });

    it('filtra por estado y por paciente sin tildes, y pagina por cursor', () => {
      const solo = enElCentro('LAB', { states: ['PENDING'] }).body.items;
      expect(solo.every((i: { state: string }) => i.state === 'PENDING')).toBe(true);
      const todas = enElCentro('LAB').body.items;
      const nombre: string = todas[0].patientDisplayName;
      const porNombre = enElCentro('LAB', { patientQuery: nombre.toUpperCase().slice(0, 4) }).body.items;
      expect(porNombre.length).toBeGreaterThan(0);

      const vistas: string[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 100; i++) {
        const pagina = enElCentro('LAB', { limit: 2, ...(cursor === undefined ? {} : { cursor }) }).body;
        vistas.push(...pagina.items.map((x: { serviceRequestId: string }) => x.serviceRequestId));
        if (pagina.nextCursor === null) break;
        cursor = pagina.nextCursor;
      }
      expect(new Set(vistas).size).toBe(vistas.length);
      expect(vistas.length).toBe(todas.length);
    });

    it('rechaza un scope, un tope, un estado o un cursor fuera de contrato con 400', () => {
      expect(enElCentro('OTRO').status).toBe(400);
      expect(enElCentro('LAB', { limit: 101 }).status).toBe(400);
      expect(enElCentro('LAB', { states: ['NOPE'] }).status).toBe(400);
      expect(enElCentro('LAB', { cursor: 'basura' }).status).toBe(400);
    });
  });

  it('el catálogo no deja sin categoría a un estudio nuevo: la deduce de su familia', () => {
    const r = pedir([{ codeConceptId: porCodigo('CHAGAS_HAI').conceptId }]);
    expect(r.body.items[0].category).toBe('LAB');
    expect(ORDER_CATEGORY['SRQ-LAB']).toBeDefined();
  });
});
