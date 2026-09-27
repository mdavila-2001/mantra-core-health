import { HttpHeaders } from '@angular/common/http';

import {
  ACCESSION_STATUS,
  CONTAINER_STATUS,
  CUSTODY_EVENT_TYPE,
  SPECIMEN_CONTAINER_TYPE,
  SPECIMEN_REJECTION_REASON,
  SPECIMEN_STATUS,
  SPECIMEN_TYPE,
} from '../fixtures/conceptos';
import { PACIENTE } from '../fixtures/personas';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO, buscarUsuario } from '../mock-session';
import { registrarDiagnostico } from './diagnostics.handlers';

/**
 * El circuito de especímenes del laboratorio (BR-17, CL-47): alta del
 * espécimen, acesión, contenedor, custodia, rechazo y las dos lecturas.
 *
 * Tres niveles, como pide el contrato del doble:
 *
 * - **correcto**: el recorrido completo deja la acesión legible con su
 *   espécimen recibido, su contenedor y la custodia firmada;
 * - **límite**: la cola apunta a acesiones que existen, y la lectura se acota
 *   al tenant del contexto;
 * - **inválido**: datos faltantes (400), recursos inexistentes (404) y un
 *   espécimen rechazado que se quiere acesionar o volver a rechazar (422).
 */
describe('circuito de especímenes del laboratorio (diagnostics-lab)', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);
  const medica = buscarUsuario('medica')!;

  interface Result<T> {
    readonly status: number;
    readonly body: T;
  }

  function call<T>(method: MockMethod, path: string, body: unknown = {}, headers = new HttpHeaders()): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers,
      user: medica,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  interface Created {
    readonly id: string;
    readonly status: string;
  }

  interface SpecimenWire {
    readonly id: string;
    readonly statusConceptId: string;
    readonly receivedAt?: string;
    readonly containers: readonly { id: string; containerIdentifier: string; statusConceptId: string }[];
    readonly custodyEvents: readonly { custodyEventTypeConceptId: string; specimenContainerId?: string; signedByUserId?: string; sealIdentifier?: string }[];
  }

  interface AccessionWire {
    readonly id: string;
    readonly accessionNumber: string;
    readonly statusConceptId: string;
    readonly specimens: readonly { accessionSpecimenId: string; sequenceNumber: number; specimen: SpecimenWire }[];
  }

  function newSpecimen(): string {
    const created = call<Created>('POST', '/diagnostics/specimens', {
      patientProfileId: PACIENTE.id,
      custodianTenantId: TENANT_CLINICA,
      specimenTypeConceptId: SPECIMEN_TYPE['SPECIMEN-TYPE-WHOLE-BLOOD'],
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe(SPECIMEN_STATUS['SPEC_COLLECTED']);
    return created.body.id;
  }

  it('correcto — recibir, acesionar, rotular y trasladar deja la acesión legible con su custodia', () => {
    const specimenId = newSpecimen();

    const accession = call<Created & { accessionSpecimenIds: string[] }>('POST', '/diagnostics/accessions', {
      patientProfileId: PACIENTE.id,
      specimenIds: [specimenId],
      accessionNumber: 'ACC-PRUEBA-1',
    });
    expect(accession.status).toBe(201);
    expect(accession.body.status).toBe(ACCESSION_STATUS['ACC_RECEIVED']);
    expect(accession.body.accessionSpecimenIds).toHaveLength(1);

    const container = call<Created>('POST', `/diagnostics/specimens/${specimenId}/containers`, {
      containerIdentifier: 'TUBO-PRUEBA-1',
      containerTypeConceptId: SPECIMEN_CONTAINER_TYPE['CONTAINER-TYPE-EDTA'],
    });
    expect(container.status).toBe(201);
    expect(container.body.status).toBe(CONTAINER_STATUS['CONTAINER_ACTIVE']);

    const custody = call<Created>('POST', `/diagnostics/containers/${container.body.id}/custody-events`, {
      specimenId,
      sealIdentifier: 'PRECINTO-77',
    });
    expect(custody.status).toBe(201);
    // Sin destino declarado, el contenedor queda almacenado, como en la API.
    expect(custody.body.status).toBe(CONTAINER_STATUS['CONTAINER_STORED']);

    const read = call<AccessionWire>('GET', `/diagnostics/accessions/${accession.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body.accessionNumber).toBe('ACC-PRUEBA-1');
    const [item] = read.body.specimens;
    expect(item!.sequenceNumber).toBe(1);
    expect(item!.specimen.statusConceptId).toBe(SPECIMEN_STATUS['SPEC_RECEIVED']);
    expect(item!.specimen.receivedAt).toBeDefined();
    expect(item!.specimen.containers).toEqual([
      expect.objectContaining({ containerIdentifier: 'TUBO-PRUEBA-1', statusConceptId: CONTAINER_STATUS['CONTAINER_STORED'] }),
    ]);
    expect(item!.specimen.custodyEvents.map((e) => e.custodyEventTypeConceptId)).toEqual([
      CUSTODY_EVENT_TYPE['CUSTODY_RECEPTION'],
      CUSTODY_EVENT_TYPE['CUSTODY_TRANSFER'],
    ]);
    expect(item!.specimen.custodyEvents[0]!.signedByUserId).toBe(medica.id);
    expect(item!.specimen.custodyEvents[1]!.sealIdentifier).toBe('PRECINTO-77');
  });

  it('correcto — el número de acesión lo genera el servidor si no viaja', () => {
    const accession = call<Created>('POST', '/diagnostics/accessions', { patientProfileId: PACIENTE.id, specimenIds: [newSpecimen()] });

    const read = call<AccessionWire>('GET', `/diagnostics/accessions/${accession.body.id}`);

    expect(read.body.accessionNumber).toMatch(/^ACC-\d+$/);
  });

  it('límite — cada orden de trabajo de la cola cuelga de una acesión que se puede abrir', () => {
    const queue = call<readonly { laboratoryAccessionId: string }[]>('GET', '/diagnostics/work-orders');
    expect(queue.body.length).toBeGreaterThan(0);

    for (const workOrder of queue.body) {
      const read = call<AccessionWire>('GET', `/diagnostics/accessions/${workOrder.laboratoryAccessionId}`);
      expect(read.status).toBe(200);
      expect(read.body.specimens.length).toBeGreaterThan(0);
    }
  });

  it('límite — la lectura se acota al tenant del contexto: otro laboratorio recibe 404', () => {
    const [workOrder] = call<readonly { laboratoryAccessionId: string }[]>('GET', '/diagnostics/work-orders').body;
    const path = `/diagnostics/accessions/${workOrder!.laboratoryAccessionId}`;

    expect(call('GET', path, {}, new HttpHeaders({ 'X-Tenant-Id': TENANT_CLINICA })).status).toBe(200);
    expect(call('GET', path, {}, new HttpHeaders({ 'X-Tenant-Id': TENANT_LABORATORIO })).status).toBe(404);
  });

  it('inválido — 422 al acesionar un espécimen rechazado, y 422 al rechazarlo dos veces', () => {
    const specimenId = newSpecimen();
    const rejection = { rejectionReasonConceptId: SPECIMEN_REJECTION_REASON['REJECTION_QUALITY'], recollectionRequired: true };

    const first = call<Created>('POST', `/diagnostics/specimens/${specimenId}/rejection`, rejection);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe(SPECIMEN_STATUS['SPEC_REJECTED']);

    expect(call('POST', `/diagnostics/specimens/${specimenId}/rejection`, rejection).status).toBe(422);
    expect(call('POST', '/diagnostics/accessions', { patientProfileId: PACIENTE.id, specimenIds: [specimenId] }).status).toBe(422);
    expect(call<SpecimenWire>('GET', `/diagnostics/specimens/${specimenId}`).body.statusConceptId).toBe(SPECIMEN_STATUS['SPEC_REJECTED']);
  });

  it('inválido — 400 por datos faltantes en cada escritura', () => {
    const specimenId = newSpecimen();

    expect(call('POST', '/diagnostics/specimens', { patientProfileId: PACIENTE.id }).status).toBe(400);
    expect(call('POST', '/diagnostics/accessions', { patientProfileId: PACIENTE.id, specimenIds: [] }).status).toBe(400);
    expect(call('POST', `/diagnostics/specimens/${specimenId}/rejection`, {}).status).toBe(400);
    expect(call('POST', `/diagnostics/specimens/${specimenId}/containers`, { containerIdentifier: '  ' }).status).toBe(400);
  });

  it('inválido — 404 por espécimen, acesión o contenedor inexistentes', () => {
    expect(call('POST', '/diagnostics/accessions', { patientProfileId: PACIENTE.id, specimenIds: ['no-existe'] }).status).toBe(404);
    expect(call('GET', '/diagnostics/accessions/no-existe').status).toBe(404);
    expect(call('GET', '/diagnostics/specimens/no-existe').status).toBe(404);
    expect(
      call('POST', '/diagnostics/specimens/no-existe/containers', {
        containerIdentifier: 'TUBO-X',
        containerTypeConceptId: SPECIMEN_CONTAINER_TYPE['CONTAINER-TYPE-SST'],
      }).status,
    ).toBe(404);
    expect(call('POST', '/diagnostics/containers/no-existe/custody-events', { specimenId: 'x' }).status).toBe(404);
  });
});
