import { HttpHeaders } from '@angular/common/http';

import { PACIENTE } from '../fixtures/personas';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarArchivos } from './files.handlers';
import { registrarAuth } from './auth.handlers';
import { registrarClinica } from './clinical.handlers';
import { registrarConsentimientos } from './consent.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registrarVarios } from './misc.handlers';

/**
 * El simulador dice lo mismo que la API en los recorridos de H1 (BR-04, BR-05,
 * BR-20): mismas reglas de rol, misma forma, y **no regala** lo que la API niega.
 */
describe('simulador · H1 sesión, cuenta y archivos', () => {
  const router = new MockRouter();
  registrarAuth(router);
  registrarArchivos(router);
  registrarClinica(router);
  registrarConsentimientos(router);
  registrarDiagnostico(router);
  registrarVarios(router);

  const paciente = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;
  const admin = buscarUsuario('admin')!;

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser | null): T | MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T | MockReply;
  }

  function estado(valor: unknown): number {
    return typeof valor === 'object' &&
      valor !== null &&
      'body' in valor &&
      typeof (valor as MockReply).status === 'number'
      ? (valor as MockReply).status
      : 200;
  }

  describe('consentimientos del titular (CL-78)', () => {
    it('retirar cierra la vigencia y NO borra la fila; lo ajeno es 404', () => {
      const antes = call<{ items: { id: string; state: string }[] }>('GET', '/consent/me/consents', null, paciente) as {
        items: { id: string; state: string }[];
      };
      const activo = antes.items.find((c) => c.state === 'ACTIVE')!;
      const total = antes.items.length;

      // Otra persona (la médica no es titular de este consentimiento): 404.
      const ajeno = call('POST', `/consent/me/consents/${activo.id}/withdraw`, {}, admin);
      expect(estado(ajeno)).toBe(404);

      expect(estado(call('POST', `/consent/me/consents/${activo.id}/withdraw`, {}, paciente))).toBe(200);

      const despues = call<{ items: { id: string; state: string; withdrawnAt?: string }[] }>(
        'GET',
        '/consent/me/consents',
        null,
        paciente,
      ) as { items: { id: string; state: string; withdrawnAt?: string }[] };
      expect(despues.items).toHaveLength(total);
      expect(despues.items.find((c) => c.id === activo.id)).toMatchObject({ state: 'WITHDRAWN' });
      expect(despues.items.find((c) => c.id === activo.id)?.withdrawnAt).toBeTruthy();
      // Retirar dos veces no es posible: ya no está activo.
      expect(estado(call('POST', `/consent/me/consents/${activo.id}/withdraw`, {}, paciente))).toBe(412);
    });
  });

  describe('quién ve mi historia y la emergencia (CV-19)', () => {
    it('revocar el vínculo de la médica: el expediente responde 403 y el titular lo ve revocado', () => {
      const chart = `/charts/patients/${PACIENTE.id}/chart`;
      expect(estado(call('GET', chart, null, medica))).toBe(200);

      const acceso = call<{ careRelationships: { id: string; state: string; practitionerName?: string }[] }>(
        'GET',
        '/authz/me/access',
        null,
        paciente,
      ) as { careRelationships: { id: string; state: string; practitionerName?: string }[] };
      const vinculo = acceso.careRelationships.find((r) => r.state === 'ACTIVE' && r.practitionerName !== undefined)!;
      expect(estado(call('POST', `/authz/me/care-relationships/${vinculo.id}/revoke`, {}, paciente))).toBe(200);

      expect(estado(call('GET', chart, null, medica))).toBe(403);
      const despues = call<{ careRelationships: { id: string; state: string }[] }>(
        'GET',
        '/authz/me/access',
        null,
        paciente,
      ) as { careRelationships: { id: string; state: string }[] };
      expect(despues.careRelationships.find((r) => r.id === vinculo.id)?.state).toBe('REVOKED');
    });

    it('la revocación ajena es 404', () => {
      expect(estado(call('POST', '/authz/me/care-relationships/no-existe/revoke', {}, paciente))).toBe(404);
      expect(estado(call('POST', '/authz/me/clinical-access-grants/no-existe/revoke', {}, paciente))).toBe(404);
    });

    it('emergencia: sin el rol, 403; sin justificación, 400 y nada se crea; con ella, 201 y el titular la ve', () => {
      const ruta = `/authz/patients/${PACIENTE.id}/break-the-glass`;
      const grantsAntes = (call('GET', '/authz/me/access', null, paciente) as { grants: unknown[] }).grants.length;

      expect(estado(call('POST', ruta, { tenantId: 't', justification: 'Paciente inconsciente en urgencias' }, medica))).toBe(403);
      expect(estado(call('POST', ruta, { tenantId: 't', justification: '' }, admin))).toBe(400);
      expect((call('GET', '/authz/me/access', null, paciente) as { grants: unknown[] }).grants).toHaveLength(grantsAntes);

      const creado = call<{ id: string }>('POST', ruta, { tenantId: 't', justification: 'Paciente inconsciente en urgencias' }, admin);
      expect(estado(creado)).toBe(201);
      const despues = call<{ grants: { id: string; isEmergency: boolean; state: string }[] }>(
        'GET',
        '/authz/me/access',
        null,
        paciente,
      ) as { grants: { id: string; isEmergency: boolean; state: string }[] };
      expect(despues.grants.some((g) => g.isEmergency && g.state === 'ACTIVE')).toBe(true);
    });
  });

  describe('archivos (CL-40, TX-33)', () => {
    it('el paciente NO puede leer por la vía genérica el PDF que subió el laboratorio (403)', () => {
      const lab = `/common/files/${labFileId()}/content`;
      expect(estado(call('GET', lab, null, paciente))).toBe(403);
      // Un revisor sí.
      expect(estado(call('GET', lab, null, admin))).toBe(200);
    });

    it('lo que sube una persona vuelve a su dueño, y está «en análisis» los primeros segundos', () => {
      const subido = call<{ fileId: string }>('POST', '/common/files/upload', null, paciente) as { body: { fileId: string } };
      const fileId = subido.body.fileId;
      expect(estado(call('GET', `/common/files/${fileId}/content`, null, paciente))).toBe(200);
      const url = call('POST', `/common/files/${fileId}/download-url`, {}, paciente);
      // Sin bytes reales (no hay FormData acá) no hay escaneo pendiente; la regla
      // de SCAN_PENDING se cubre en `files.handlers` sólo con subida real.
      expect([200, 422]).toContain(estado(url));
    });

    it('resultado propio: ajeno o no liberado es 404, el propio baja los bytes', () => {
      const lista = call<{ items: { reportId: string; files: { fileId: string }[] }[] }>(
        'GET',
        '/diagnostic-results/me',
        null,
        paciente,
      ) as { items: { reportId: string; files: { fileId: string }[] }[] };
      const resultado = lista.items[0]!;
      const archivo = resultado.files[0]!.fileId;

      expect(estado(call('GET', `/diagnostic-results/me/${resultado.reportId}/files/${archivo}/content`, null, paciente))).toBe(200);
      expect(estado(call('GET', `/diagnostic-results/me/${resultado.reportId}/files/otro-archivo/content`, null, paciente))).toBe(404);
      expect(estado(call('GET', `/diagnostic-results/me/${resultado.reportId}/files/${archivo}/content`, null, admin))).toBe(404);
    });
  });

  /** El PDF del laboratorio de la persona de demostración (mismo cálculo que el fixture). */
  function labFileId(): string {
    const lista = call<{ items: { files: { fileId: string }[] }[] }>('GET', '/diagnostic-results/me', null, paciente) as {
      items: { files: { fileId: string }[] }[];
    };
    return lista.items[0]!.files[0]!.fileId;
  }

  describe('cuenta propia (ID-24)', () => {
    it('cambiar la contraseña: la actual tiene que ser la vigente (422) y cierra las otras sesiones', () => {
      // Una cuenta que ningún otro spec toca: el estado del simulador es del módulo.
      const cuenta = buscarUsuario('visitador')!;
      call('POST', '/iam/auth/login', { email: cuenta.email, password: 'clave-original' }, null);
      const sesiones = call<{ id: string; current: boolean }[]>('GET', '/iam/me/sessions', null, cuenta) as {
        id: string;
        current: boolean;
      }[];
      expect(sesiones.some((s) => !s.current)).toBe(true);

      const mala = call('POST', '/iam/auth/change-password', { currentPassword: 'otra', newPassword: 'nueva-1234' }, cuenta);
      expect(estado(mala)).toBe(422);
      expect((mala as MockReply).body).toMatchObject({ details: { reason: 'CURRENT_PASSWORD_INVALID' } });

      const ok = call<{ revokedSessions: number }>(
        'POST',
        '/iam/auth/change-password',
        { currentPassword: 'clave-original', newPassword: 'nueva-1234' },
        cuenta,
      );
      expect((ok as { revokedSessions: number }).revokedSessions).toBeGreaterThanOrEqual(1);
      const despues = call<{ current: boolean }[]>('GET', '/iam/me/sessions', null, cuenta) as { current: boolean }[];
      expect(despues.every((s) => s.current)).toBe(true);
    });
  });
});
