import { HttpHeaders } from '@angular/common/http';

import { SPECIMEN_CONTAINER_TYPE, SPECIMEN_STATUS, SPECIMEN_TYPE } from '../fixtures/concepts';
import { PACIENTE } from '../fixtures/people';
import { MockRouter, isMockReply, preconditionFailed, type MockMethod } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO, buscarUsuario, type MockUser } from '../mock-session';
import { registrarDiagnostico } from './diagnostics.handlers';

/** La familia «precondición» sale del ayudante del simulador (422 en test, 412 en mockup). */
const PRECONDITION = preconditionFailed('').status;

/**
 * Dos reglas que la API agregó a la recepción (PR del API #504):
 *
 * - la **cola de trabajo** (`GET /diagnostics/work-orders`) la autoriza
 *   `LabStaffGuard`, igual que la bandeja;
 * - el alta de espécimen y de contenedor **valida el tipo contra su catálogo**
 *   y responde `PRECONDITION_FAILED` con `details.reason` estable.
 *
 * Tres niveles en cada una: correcto, límite y no autorizado / inválido.
 */
describe('cola del laboratorio y catálogos de muestra (mock alineado a la API)', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);
  const laboratorio = buscarUsuario('laboratorio')!;
  const patient = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;

  function call(
    method: MockMethod,
    path: string,
    body: unknown,
    user: MockUser | null,
    headers: HttpHeaders,
  ): { status: number; body: unknown } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers,
      user,
    });
    return isMockReply(result)
      ? { status: result.status, body: result.body }
      : { status: 200, body: result };
  }

  const queue = (user: MockUser | null, tenantId: string | null) =>
    call(
      'GET',
      '/diagnostics/work-orders',
      {},
      user,
      tenantId === null ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': tenantId }),
    );

  describe('cola de trabajo', () => {
    it('correcto: el personal del laboratorio (sólo USER) la lee', () => {
      const { status, body } = queue(laboratorio, TENANT_LABORATORIO);
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it('límite: la médica (PRACTITIONER, regla de ámbito de siempre) la sigue leyendo', () => {
      expect(queue(medica, TENANT_CLINICA).status).toBe(200);
    });

    it('no autorizado: el paciente, miembro del tenant por defecto, recibe 403', () => {
      expect(queue(patient, null).status).toBe(403);
      expect(queue(laboratorio, TENANT_CLINICA).status).toBe(403);
    });
  });

  describe('catálogos de tipo de espécimen y de contenedor', () => {
    const headers = new HttpHeaders({ 'X-Tenant-Id': TENANT_LABORATORIO });
    const specimen = (specimenTypeConceptId: string | undefined) =>
      call(
        'POST',
        '/diagnostics/specimens',
        {
          patientProfileId: PACIENTE.id,
          custodianTenantId: TENANT_LABORATORIO,
          specimenTypeConceptId,
        },
        laboratorio,
        headers,
      );

    it('correcto: tipo y contenedor del catálogo', () => {
      const created = specimen(SPECIMEN_TYPE['BLDV']);
      expect(created.status).toBe(201);
      const id = (created.body as { id: string }).id;
      const container = call(
        'POST',
        `/diagnostics/specimens/${id}/containers`,
        {
          containerIdentifier: 'TUBO-1',
          containerTypeConceptId: SPECIMEN_CONTAINER_TYPE['TUBE_LAVENDER_EDTA'],
        },
        laboratorio,
        headers,
      );
      expect(container.status).toBe(201);
    });

    it('límite: todos los tipos publicados se aceptan', () => {
      for (const type of Object.values(SPECIMEN_TYPE)) {
        expect(specimen(type).status).toBe(201);
      }
    });

    it('inválido: un concepto que no es tipo de espécimen, con motivo estable', () => {
      const { status, body } = specimen(SPECIMEN_STATUS['SPEC_COLLECTED']);
      expect(status).toBe(PRECONDITION);
      expect(body).toMatchObject({
        code: 'PRECONDITION_FAILED',
        details: { reason: 'SPECIMEN_TYPE_NOT_IN_CATALOG', field: 'specimenTypeConceptId' },
      });
    });

    it('inválido: un tipo de espécimen usado como contenedor', () => {
      const id = (specimen(SPECIMEN_TYPE['SER']).body as { id: string }).id;
      const { status, body } = call(
        'POST',
        `/diagnostics/specimens/${id}/containers`,
        { containerIdentifier: 'TUBO-2', containerTypeConceptId: SPECIMEN_TYPE['SER'] },
        laboratorio,
        headers,
      );
      expect(status).toBe(PRECONDITION);
      expect(body).toMatchObject({ details: { reason: 'CONTAINER_TYPE_NOT_IN_CATALOG' } });
    });
  });
});
