import { HttpRequest } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { mockBackendInterceptor } from '../mock-backend.interceptor';
import { buscarUsuario, emitirAccessToken } from '../mock-session';
import { contractViolations, UNKNOWN_PROPERTY, validationFailedBody } from './contract-validator';
import { CONTRACT_ROUTES } from './api-contract.generated';
import { SIMULATOR_EXTENSIONS } from './simulator-extensions';

/**
 * La maqueta emula `forbidNonWhitelisted` (informe B de deriva de contratos,
 * §7.5). Los casos son roturas reales del informe: con este validador habrían
 * fallado en `mockup` y no recién contra la API.
 */
describe('validador de contrato de la maqueta', () => {
  const REPORT = '00000000-0000-4000-8000-000000000001';

  it('C4 · la forma vieja de compartir un resultado es un 400 con el campo nombrado', () => {
    const rechazo = contractViolations('POST', `/diagnostic-results/me/${REPORT}/shares`, {
      practitionerUserId: 'u',
      validUntil: '2026-12-31T23:59:59.000Z',
      reason: 'control',
    });
    expect(rechazo?.map((v) => v.field).sort()).toEqual([
      'practitionerProfileId',
      'practitionerUserId',
      'reason',
    ]);
    expect(rechazo?.find((v) => v.field === 'reason')?.constraints).toEqual([UNKNOWN_PROPERTY]);
  });

  it('C4 · la forma del DTO pasa', () => {
    expect(
      contractViolations('POST', `/diagnostic-results/me/${REPORT}/shares`, {
        practitionerProfileId: REPORT,
        validUntil: '2026-12-31T23:59:59.000Z',
      }),
    ).toEqual([]);
  });

  it('C5 · firmar una nota sin firmante es un 400', () => {
    expect(
      contractViolations('POST', `/charts/notes/${REPORT}/versions/${REPORT}/sign`, {})?.map(
        (v) => v.field,
      ),
    ).toEqual(['signerProfileId']);
  });

  it('C3 · el base64 de la firma en el alta de médico es un 400', () => {
    const rechazo = contractViolations('POST', '/iam/auth/register-practitioner', {
      email: 'a@b.c',
      password: 'x',
      licenseNumber: '1',
      nationalId: '1',
      issuerAdministrativeAreaConceptId: REPORT,
      signatureImageBase64: 'data:image/png;base64,AA==',
    });
    expect(rechazo?.map((v) => v.field)).toEqual(['signatureImageBase64']);
  });

  it('una extensión registrada pasa; la misma clave en otra ruta, no', () => {
    expect(
      contractViolations('POST', `/tenants/${REPORT}/branches`, {
        code: 'S1',
        name: 'Centro',
        description: 'Planta baja',
      }),
    ).toEqual([]);
    expect(
      contractViolations('POST', `/charts/notes/${REPORT}/versions/${REPORT}/sign`, {
        signerProfileId: REPORT,
        description: 'x',
      })?.map((v) => v.field),
    ).toEqual(['description']);
  });

  it('valida lo anidado con su ruta completa', () => {
    const rechazo = contractViolations('POST', '/accounting/clearing-documents', {
      tenantId: REPORT,
      practiceId: REPORT,
      bankAccountId: REPORT,
      clearingDate: '2026-10-09',
      items: [{ openItemId: REPORT, clearedAmount: '10.00', note: 'x' }],
    });
    expect(rechazo?.map((v) => v.field)).toEqual(['items.0.note']);
    expect(validationFailedBody(rechazo ?? [])).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: { violations: ['items.0.property note should not exist'] },
    });
  });

  it('una ruta que la API no publica no se valida: no hay contrato', () => {
    expect(
      contractViolations('POST', '/diagnostics/lab/services', { cualquier: 'cosa' }),
    ).toBeNull();
  });

  it('cada extensión registrada cuelga de una ruta que existe en el contrato', () => {
    const rutas = new Set(CONTRACT_ROUTES.map(([method, pattern]) => `${method} ${pattern}`));
    expect(Object.keys(SIMULATOR_EXTENSIONS).filter((clave) => !rutas.has(clave))).toEqual([]);
  });

  it('el interceptor contesta 400 antes de llegar al manejador', async () => {
    const token = emitirAccessToken(buscarUsuario('paciente')!);
    const request = new HttpRequest('POST', `/diagnostic-results/me/${REPORT}/shares`, {
      practitionerUserId: 'u',
      validUntil: '2026-12-31T23:59:59.000Z',
    }).clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    const siguiente = () => {
      throw new Error('no debería salir a la red');
    };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = await firstValueFrom(mockBackendInterceptor(request, siguiente as any)).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ status: 400, error: { code: 'VALIDATION_FAILED' } });
  }, 30_000);
});
