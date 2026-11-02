import '@angular/compiler';
import { HttpHeaders } from '@angular/common/http';
import { beforeAll, describe, expect, it } from 'vitest';

import type { CreatedSupportStaffResponse } from '../../data-access/support-access/support-provisioning.types';
import { PEREZ } from '../fixtures/support-hospital';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';

let router: MockRouter;
const perez = buscarUsuario('perez')!;
const ana = buscarUsuario('ana')!; // Secretaria (no doctor)

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(
  user: MockUser | null,
  method: MockMethod,
  path: string,
  body?: unknown,
): Respuesta<T> {
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(),
    body: body ?? null,
    headers: new HttpHeaders(),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

describe('provisión directa de secretarias (simulador)', () => {
  beforeAll(() => {
    router = crearRouterSimulado();
  });

  describe('POST /me/practitioner/support-staff', () => {
    it('rechaza 401 si no hay usuario autenticado', () => {
      const res = llamar(null, 'POST', '/me/practitioner/support-staff', {});
      expect(res.status).toBe(401);
    });

    it('rechaza 403 si el actor no tiene rol de médico', () => {
      const res = llamar(ana, 'POST', '/me/practitioner/support-staff', {});
      expect(res.status).toBe(403);
    });

    it('crea la cuenta y el vínculo activo inmediatamente para el doctor', () => {
      const res = llamar<CreatedSupportStaffResponse>(
        perez,
        'POST',
        '/me/practitioner/support-staff',
        {
          nationalId: '9876543',
          issuerAdministrativeAreaConceptId: 'cbba-uuid',
          name: 'Beatriz',
          lastName: 'Molina',
          email: 'beatriz.molina@example.com',
          phone: '+59171234567',
          birthDate: '1995-04-12',
          practitionerRoleAssignmentId: PEREZ.id,
        },
      );

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.userId).toBeDefined();
      expect(res.body.linkId).toBeDefined();
    });
  });

  describe('POST /org/support-staff', () => {
    it('crea la cuenta y el vínculo activo para la organización', () => {
      const adminOrg = buscarUsuario('admin') ?? {
        id: 'user-admin-org',
        displayName: 'Administrador Hospital',
        email: 'admin@hospital.bo',
        roles: ['USER', 'ORGANIZATION_ADMIN'],
        organizationAccess: ['tenant-hospital'],
      };

      const res = llamar<CreatedSupportStaffResponse>(
        adminOrg,
        'POST',
        '/org/support-staff',
        {
          nationalId: '8765432',
          issuerAdministrativeAreaConceptId: 'lp-uuid',
          name: 'Carolina',
          lastName: 'Mendoza',
          email: 'carolina.mendoza@hospital.bo',
          phone: '+59178901234',
          birthDate: '1992-08-20',
          practiceSiteId: 'site-central',
        },
      );

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.userId).toBeDefined();
      expect(res.body.linkId).toBeDefined();
    });
  });
});
