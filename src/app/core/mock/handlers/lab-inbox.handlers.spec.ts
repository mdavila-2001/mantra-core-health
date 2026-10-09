import { HttpHeaders } from '@angular/common/http';

import { SPECIMEN_CONTAINER_TYPE, SPECIMEN_STATUS, SPECIMEN_TYPE } from '../fixtures/concepts';
import { pacientePorId } from '../fixtures/people';
import { MockRouter, isMockReply, validation, type MockMethod } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO, TENANT_TYPES, buscarUsuario, type MockUser } from '../mock-session';
import { registrarDiagnostico } from './diagnostics.handlers';

/** La familia «validación» sale del ayudante del simulador, no de un número a mano. */
const INVALID = validation('').status;

/**
 * La bandeja de recepción del laboratorio (`POST /diagnostics/service-requests/inbox`)
 * contra el contrato de la API, en tres niveles:
 *
 * - **correcto**: el personal del laboratorio ve sus órdenes pendientes, de la
 *   más vieja a la más nueva, con las muestras recibidas adentro; y una orden
 *   acesionada sale de la bandeja;
 * - **límite**: el cursor recorre sin repetir ni saltear, la búsqueda por
 *   paciente no distingue tildes ni mayúsculas, y otro tenant ve lo suyo;
 * - **inválido**: quien no es personal del laboratorio recibe 403, y un tope,
 *   una búsqueda o un cursor fuera de contrato, 400.
 */
describe('bandeja de recepción del laboratorio (diagnostics inbox)', () => {
  const router = new MockRouter();
  registrarDiagnostico(router);
  const laboratorio = buscarUsuario('laboratorio')!;
  const patient = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;
  const inTheLab = new HttpHeaders({ 'X-Tenant-Id': TENANT_LABORATORIO });

  interface Result<T> {
    readonly status: number;
    readonly body: T;
  }

  interface InboxSpecimen {
    readonly id: string;
    readonly statusConceptId: string;
    readonly containers: readonly { readonly containerIdentifier: string }[];
  }

  interface InboxItem {
    readonly serviceRequestId: string;
    readonly patientProfileId: string;
    readonly patientDisplayName: string | null;
    readonly patientCode: string | null;
    readonly codeDisplay: string | null;
    readonly requestingTenantName: string | null;
    readonly requestedAt: string;
    readonly specimens: readonly InboxSpecimen[];
  }

  interface InboxPage {
    readonly items: readonly InboxItem[];
    readonly count: number;
    readonly limit: number;
    readonly nextCursor: string | null;
  }

  function call<T>(
    method: MockMethod,
    path: string,
    body: unknown,
    user: MockUser | null,
    headers = inTheLab,
  ): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({ method, path, params: match.params, query: new URLSearchParams(), body, headers, user });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  const inbox = (body: unknown = {}, user: MockUser | null = laboratorio, headers = inTheLab) =>
    call<InboxPage>('POST', '/diagnostics/service-requests/inbox', body, user, headers);

  it('la cuenta de la maqueta es personal de un centro de diagnóstico, sin rol propio', () => {
    expect(laboratorio.roles).toEqual(['USER']);
    expect(TENANT_TYPES[TENANT_LABORATORIO]).toBe('DIAGNOSTIC_CENTER');
  });

  describe('correcto', () => {
    it('lista las órdenes pendientes, de la más vieja a la más nueva, con el paciente y el estudio', () => {
      const { status, body } = inbox();
      expect(status).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(3);
      expect(body.count).toBe(body.items.length);
      expect(body.limit).toBe(25);
      expect(body.nextCursor).toBeNull();

      const fechas = body.items.map((i) => i.requestedAt);
      expect([...fechas].sort()).toEqual(fechas);

      const first = body.items[0]!;
      expect(first.patientDisplayName).toBe(pacientePorId(first.patientProfileId)?.displayName);
      expect(first.patientCode).not.toBeNull();
      expect(first.codeDisplay).not.toBeNull();
      expect(first.requestingTenantName).not.toBeNull();
    });

    it('trae adentro las muestras ya recibidas, rechazadas incluidas, con su contenedor', () => {
      const { body } = inbox();
      const withSpecimen = body.items.filter((i) => i.specimens.length > 0);
      const statuses = withSpecimen.flatMap((i) => i.specimens.map((s) => s.statusConceptId));
      expect(statuses).toContain(SPECIMEN_STATUS['SPEC_COLLECTED']);
      expect(statuses).toContain(SPECIMEN_STATUS['SPEC_REJECTED']);
      expect(withSpecimen[0]!.specimens[0]!.containers[0]!.containerIdentifier).toMatch(/^TUBO-/);
    });

    it('recibir la muestra y acesionarla saca la orden de la bandeja', () => {
      const antes = inbox().body.items;
      const orden = antes.find((i) => i.specimens.length === 0)!;

      const specimen = call<{ id: string }>(
        'POST',
        '/diagnostics/specimens',
        {
          patientProfileId: orden.patientProfileId,
          custodianTenantId: TENANT_LABORATORIO,
          specimenTypeConceptId: SPECIMEN_TYPE['SER'],
          serviceRequestId: orden.serviceRequestId,
        },
        laboratorio,
      );
      expect(specimen.status).toBe(201);
      call('POST', `/diagnostics/specimens/${specimen.body.id}/containers`, {
        containerIdentifier: 'TUBO-9101',
        containerTypeConceptId: SPECIMEN_CONTAINER_TYPE['TUBE_GOLD_SST'],
      }, laboratorio);

      const recibida = inbox().body.items.find((i) => i.serviceRequestId === orden.serviceRequestId)!;
      expect(recibida.specimens.map((s) => s.id)).toEqual([specimen.body.id]);
      expect(recibida.specimens[0]!.containers[0]!.containerIdentifier).toBe('TUBO-9101');

      const acesion = call<{ id: string }>(
        'POST',
        '/diagnostics/accessions',
        {
          patientProfileId: orden.patientProfileId,
          specimenIds: [specimen.body.id],
          serviceRequestId: orden.serviceRequestId,
        },
        laboratorio,
      );
      expect(acesion.status).toBe(201);

      const despues = inbox().body.items.map((i) => i.serviceRequestId);
      expect(despues).not.toContain(orden.serviceRequestId);
      expect(despues).toHaveLength(antes.length - 1);
    });
  });

  describe('límite', () => {
    it('el cursor recorre la bandeja entera sin repetir ni saltear', () => {
      const todas = inbox().body.items.map((i) => i.serviceRequestId);
      const vistas: string[] = [];
      let cursor: string | undefined;
      let vueltas = 0;
      do {
        const { status, body } = inbox(cursor === undefined ? { limit: 2 } : { limit: 2, cursor });
        expect(status).toBe(200);
        expect(body.items.length).toBeLessThanOrEqual(2);
        vistas.push(...body.items.map((i) => i.serviceRequestId));
        cursor = body.nextCursor ?? undefined;
        vueltas += 1;
      } while (cursor !== undefined && vueltas < 20);

      expect(vistas).toEqual(todas);
    });

    it('la búsqueda por paciente no distingue tildes ni mayúsculas, y también busca por código', () => {
      const first = inbox().body.items[0]!;
      const fullName = first.patientDisplayName!;
      const surname = fullName.split(' ').at(-1)!;
      const withoutAccents = surname.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

      const byName = inbox({ patientQuery: `  ${withoutAccents}  ` }).body.items;
      expect(byName.map((i) => i.serviceRequestId)).toContain(first.serviceRequestId);
      expect(byName.every((i) => i.patientDisplayName !== null)).toBe(true);

      const byCode = inbox({ patientQuery: first.patientCode! }).body.items;
      expect(byCode.map((i) => i.patientProfileId)).toContain(first.patientProfileId);

      expect(inbox({ patientQuery: 'zzzz-nadie' }).body.items).toEqual([]);
    });

    it('otro tenant ve sólo lo que le derivaron a él: la clínica, nada', () => {
      const { status, body } = inbox({}, medica, new HttpHeaders({ 'X-Tenant-Id': TENANT_CLINICA }));
      expect(status).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.nextCursor).toBeNull();
    });
  });

  describe('inválido', () => {
    it('el paciente no es personal del laboratorio: 403', () => {
      const { status, body } = inbox({}, patient, new HttpHeaders());
      expect(status).toBe(403);
      expect((body as unknown as { message: string }).message).toBe(
        'Se requiere ser personal del laboratorio de la organización activa',
      );
    });

    it('sin sesión, 403; y el personal del laboratorio con otra organización activa, también', () => {
      expect(inbox({}, null).status).toBe(403);
      expect(inbox({}, laboratorio, new HttpHeaders({ 'X-Tenant-Id': TENANT_CLINICA })).status).toBe(403);
    });

    it('tope, búsqueda o cursor fuera de contrato: 400', () => {
      expect(inbox({ limit: 0 }).status).toBe(INVALID);
      expect(inbox({ limit: 101 }).status).toBe(INVALID);
      expect(inbox({ patientQuery: 'a' }).status).toBe(INVALID);
      expect(inbox({ patientQuery: 'x'.repeat(81) }).status).toBe(INVALID);
      expect(inbox({ cursor: 'no-es-un-cursor' }).status).toBe(INVALID);
    });
  });
});
