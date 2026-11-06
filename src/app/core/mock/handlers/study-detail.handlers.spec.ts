import { HttpHeaders } from '@angular/common/http';

import { LATERALITY, SPECIMEN_TYPE, ESTUDIO } from '../fixtures/concepts';
import { IMAGING_BODY_STRUCTURE, IMAGING_BONE_TYPE, IMAGING_MODALITY } from '../fixtures/study-detail-concepts';
import { PACIENTE } from '../fixtures/people';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registrarVarios } from './misc.handlers';
import { regionOfPart, type BodyRegionsData } from '../../data-access/anatomy-atlas/anatomy-atlas.logic';
import { BODY_REGIONS, MESH_TO_REGION, STRUCTURE_TO_REGION } from '../../data-access/anatomy-atlas/body-regions.data';
import { realCodeOfStudy, registrarDetalleDeEstudio, resetStudyDetailMock } from './study-detail.handlers';

/**
 * EL DOBLE del detalle de la orden de estudios (muestra / parte del cuerpo).
 * No es la API real: reproduce las reglas de `service-request-detail.service.ts`
 * y los `details.reason` del trabajo en curso de la API para poder ejercitar la
 * pantalla. Se prueba en los tres niveles del contrato (regla 65):
 * correcto, límite e inválido.
 */
const DATOS: BodyRegionsData = { regions: BODY_REGIONS, meshToRegion: MESH_TO_REGION, structureToRegion: STRUCTURE_TO_REGION };

describe('el doble del detalle de la orden de estudios', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;
  registrarDiagnostico(router);
  registrarVarios(router);
  registrarDetalleDeEstudio(router);

  function call<T>(method: MockMethod, path: string, body: unknown, query = ''): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({ method, path, params: match.params, query: new URLSearchParams(query), body, headers: new HttpHeaders(), user: medica }) as T;
  }

  const lab = (extra: object = {}) => ({ patientProfileId: PACIENTE.id, codeConceptId: ESTUDIO['STUDY-ORINA'], category: 'LAB', encounterId: 'enc-1', ...extra });
  const img = (extra: object = {}) => ({ patientProfileId: PACIENTE.id, codeConceptId: ESTUDIO['STUDY-ECO-ABD'], category: 'IMAGING', encounterId: 'enc-1', ...extra });
  const razon = (r: MockReply): string | undefined => (r.body as { details?: { reason?: string } }).details?.reason;

  beforeEach(() => resetStudyDetailMock());

  describe('correcto', () => {
    it('laboratorio con muestra: se guarda y vuelve en la lectura del paciente con su nombre', () => {
      const r = call<MockReply>('POST', '/clinical/service-requests', lab({ specimenTypeConceptId: SPECIMEN_TYPE['UR'] }));
      expect(r.status).toBe(201);
      const { id } = r.body as { id: string };
      const orden = call<{ orders: Record<string, unknown>[] }>('GET', `/diagnostics/patients/${PACIENTE.id}/orders`, null).orders.find((o) => o['id'] === id)!;
      expect(orden['specimenTypeConceptId']).toBe(SPECIMEN_TYPE['UR']);
      expect(orden['specimenTypeDisplay']).toBe('Orina');
    });

    it('imagen con región, lado, modalidad, estructura, malla y hueso (anidado en `imaging`): todo se conserva al releer', () => {
      const r = call<MockReply>('POST', '/clinical/service-requests', img({
        imaging: {
          bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'],
          lateralityConceptId: LATERALITY['COND_LAT_LEFT'],
          modalityConceptId: IMAGING_MODALITY['IMG_MODALITY_RX'],
          bodyStructureUberon: 'UBERON:0002398',
          bodyMeshId: 'FMA23888',
          boneTypeConceptId: IMAGING_BONE_TYPE['IMG_BONE_LONG'],
        },
      }));
      expect(r.status).toBe(201);
      const { id } = r.body as { id: string };
      const orden = call<{ orders: Record<string, unknown>[] }>('GET', `/diagnostics/patients/${PACIENTE.id}/orders`, null).orders.find((o) => o['id'] === id)!;
      expect(orden).toMatchObject({
        bodySiteDisplay: 'Mano',
        lateralityDisplay: 'Izquierda',
        modalityDisplay: 'Radiografía simple',
        bodyStructureUberon: 'UBERON:0002398',
        bodyMeshId: 'FMA23888',
        boneTypeDisplay: 'Hueso largo',
      });
      const propias = call<{ items: Record<string, unknown>[] }>('GET', '/diagnostic-results/me/orders', null).items;
      expect(Array.isArray(propias)).toBe(true);
    });

    it('una orden sin detalle (anterior) no trae nada del detalle', () => {
      const r = call<MockReply>('POST', '/clinical/service-requests', lab());
      const { id } = r.body as { id: string };
      const orden = call<{ orders: Record<string, unknown>[] }>('GET', `/diagnostics/patients/${PACIENTE.id}/orders`, null).orders.find((o) => o['id'] === id)!;
      expect('specimenTypeConceptId' in orden).toBe(false);
    });

    it('el catálogo de regiones es el de la API: 156 regiones con sus códigos, y el cruce pieza → región lo resuelve', () => {
      const regiones = call<{ options: { code: string }[] }>('GET', '/system-context/dynamic-enums', null, 'target=clinical.service_requests.body_site_concept_id').options;
      expect(regiones).toHaveLength(156);
      expect(regiones.map((r) => r.code)).toContain('IMG_REGION_FEMUR');
      expect(regionOfPart({ meshId: 'BP24', structureId: 'X' }, DATOS)).toBe('COSTILLAS');
      expect(regionOfPart({ meshId: 'SIN_MALLA', structureId: 'X' }, DATOS)).toBeNull();
    });

    it('los catálogos del detalle se sirven por sus destinos', () => {
      const opciones = (target: string) => call<{ options: { display: string }[] }>('GET', '/system-context/dynamic-enums', null, `target=${target}`).options.map((o) => o.display);
      expect(opciones('clinical.service_requests.specimen_type_concept_id')).toContain('Orina');
      expect(opciones('clinical.service_requests.bone_type_concept_id')).toEqual(['Hueso largo', 'Hueso corto', 'Hueso plano', 'Hueso irregular', 'Hueso sesamoideo']);
      expect(opciones('clinical.service_requests.laterality_concept_id')).toEqual(['Izquierda', 'Derecha', 'Bilateral']);
      expect(opciones('clinical.service_requests.body_site_concept_id')).toContain('Mano');
    });
  });

  describe('el catálogo de estudios, con los prefijos del catálogo real', () => {
    it('laboratorio, imagen y cardiología salen del prefijo del código (LAB_, IMG_, CAR_)', () => {
      expect(realCodeOfStudy('STUDY-HEMOGRAMA')).toBe('LAB_HEMOGRAMA');
      expect(realCodeOfStudy('STUDY-RX-TORAX')).toBe('IMG_RX_TORAX');
      expect(realCodeOfStudy('STUDY-ECG')).toBe('CAR_ECG');
      expect(realCodeOfStudy('OTRO')).toBe('OTRO');
    });

    it('sólo el selector de la orden ve los códigos con prefijo', () => {
      const codes = call<{ options: { code: string }[] }>('GET', '/system-context/dynamic-enums', null, 'target=clinical.service_requests.code_concept_id').options.map((o) => o.code);
      expect(codes).toContain('IMG_RX_TORAX');
      expect(codes.some((c) => c.startsWith('STUDY-'))).toBe(false);
    });
  });

  describe('límite', () => {
    it('la estructura UBERON y FMA válidas pasan; la malla con guion bajo y 64 caracteres pasa', () => {
      const site = IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'];
      expect(call<MockReply>('POST', '/clinical/service-requests', img({ imaging: { bodySiteConceptId: site, bodyStructureUberon: 'FMA:1', bodyMeshId: 'a'.repeat(64) } })).status).toBe(201);
    });

    it('una región única no admite lado, una par sí', () => {
      const r = call<MockReply>('POST', '/clinical/service-requests', img({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_TORAX'], lateralityConceptId: LATERALITY['COND_LAT_LEFT'] } }));
      expect(razon(r)).toBe('LATERALITY_NOT_APPLICABLE');
    });

    it('el tipo de hueso con sólo la estructura (sin región) cumple el contrato de hueso, pero imagen sigue pidiendo región', () => {
      const r = call<MockReply>('POST', '/clinical/service-requests', img({ imaging: { bodyStructureUberon: 'UBERON:1', boneTypeConceptId: IMAGING_BONE_TYPE['IMG_BONE_FLAT'] } }));
      expect(razon(r)).toBe('BODY_SITE_REQUIRED');
    });
  });

  describe('inválido', () => {
    const casos: [string, () => object, string][] = [
      ['muestra fuera del catálogo', () => lab({ specimenTypeConceptId: 'no-existe' }), 'SPECIMEN_TYPE_NOT_IN_CATALOG'],
      ['muestra en un estudio de imagen', () => img({ specimenTypeConceptId: SPECIMEN_TYPE['UR'] }), 'SPECIMEN_NOT_ALLOWED_FOR_CATEGORY'],
      ['muestra y datos de imagen a la vez', () => lab({ specimenTypeConceptId: SPECIMEN_TYPE['UR'], imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'] } }), 'SPECIMEN_AND_IMAGING_FIELDS_EXCLUSIVE'],
      ['datos de imagen en laboratorio', () => lab({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'] } }), 'IMAGING_FIELDS_NOT_ALLOWED'],
      ['imagen sin región', () => img(), 'BODY_SITE_REQUIRED'],
      ['región fuera del catálogo', () => img({ imaging: { bodySiteConceptId: 'x' } }), 'BODY_SITE_NOT_IN_CATALOG'],
      ['modalidad fuera del catálogo', () => img({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'], modalityConceptId: 'x' } }), 'MODALITY_NOT_IN_CATALOG'],
      ['lado sin región (la estructura del 3D no basta)', () => img({ imaging: { lateralityConceptId: LATERALITY['COND_LAT_LEFT'], bodyStructureUberon: 'UBERON:1' } }), 'BODY_SITE_REQUIRED'],
      ['lado fuera del catálogo', () => img({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'], lateralityConceptId: 'x' } }), 'LATERALITY_NOT_IN_CATALOG'],
      ['estructura con forma inválida', () => img({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'], bodyStructureUberon: 'hand' } }), 'BODY_STRUCTURE_FORMAT_INVALID'],
      ['malla con forma inválida', () => img({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'], bodyMeshId: 'a b' } }), 'BODY_MESH_ID_FORMAT_INVALID'],
      ['tipo de hueso sin región ni estructura UBERON, sólo con malla (orden sin categoría declarada)', () => ({ patientProfileId: PACIENTE.id, codeConceptId: ESTUDIO['STUDY-ECO-ABD'], imaging: { bodyMeshId: 'FMA23888', boneTypeConceptId: IMAGING_BONE_TYPE['IMG_BONE_LONG'] } }), 'BONE_TYPE_REQUIRES_BODY_STRUCTURE'],
      ['tipo de hueso fuera del catálogo', () => img({ imaging: { bodySiteConceptId: IMAGING_BODY_STRUCTURE['IMG_REGION_MANO'], boneTypeConceptId: 'x' } }), 'BONE_TYPE_NOT_IN_CATALOG'],
    ];
    it.each(casos)('%s → 422 con su details.reason', (_nombre, cuerpo, reason) => {
      const r = call<MockReply>('POST', '/clinical/service-requests', cuerpo());
      expect(r.status).toBe(422);
      expect(razon(r)).toBe(reason);
      expect((r.body as { details: { field?: string } }).details.field).toBeDefined();
    });

    it('un rechazo no crea la orden', () => {
      const antes = call<{ orders: unknown[] }>('GET', `/diagnostics/patients/${PACIENTE.id}/orders`, null).orders.length;
      call('POST', '/clinical/service-requests', lab({ specimenTypeConceptId: 'no-existe' }));
      expect(call<{ orders: unknown[] }>('GET', `/diagnostics/patients/${PACIENTE.id}/orders`, null).orders.length).toBe(antes);
    });
  });
});
