import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { registrationErrorToViewState, type RegistrationKind } from './registration-errors';

/** Una respuesta de error con la forma del contrato de la API. */
function respuesta(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    headers: new HttpHeaders(headers ?? {}),
    error: {
      code,
      message,
      correlationId: 'corr-123',
      timestamp: '2026-10-03T19:32:27.666Z',
      ...(details === undefined ? {} : { details }),
    },
  });
}

/** El texto que la pantalla muestra: el primer problema, o el del estado. */
function textoDe(estado: ViewState<null>): string {
  if (estado.status === 'validation') return estado.issues[0]?.message ?? '';
  if (estado.status === 'error') return estado.message ?? '';
  return estado.status;
}

function traducir(error: unknown, kind: RegistrationKind = 'organization'): ViewState<null> {
  return registrationErrorToViewState(error, kind);
}

describe('registrationErrorToViewState — catálogo de errores del alta', () => {
  describe('400 · datos inválidos', () => {
    it('traduce la ruta técnica al nombre del campo y junta las tres reglas de un mismo campo', () => {
      // Respuesta real de la API de test del 03/10/2026, alta de farmacia sin CI.
      const estado = traducir(
        respuesta(400, 'VALIDATION_FAILED', 'Error de validación', {
          violations: [
            'organization.legalRepresentative.idNumber must be shorter than or equal to 50 characters',
            'organization.legalRepresentative.idNumber must be longer than or equal to 4 characters',
            'organization.legalRepresentative.idNumber must be a string',
          ],
        }),
      );

      expect(estado.status).toBe('validation');
      expect(textoDe(estado)).toBe(
        'Revisá este dato y volvé a enviar. Documento de identidad del representante legal: falta completarlo (entre 4 y 50 caracteres).',
      );
      expect(textoDe(estado)).not.toMatch(/must|organization\.|idNumber/);
    });

    it('lista todos los campos con problemas en un solo mensaje, no sólo el primero', () => {
      const estado = traducir(
        respuesta(400, 'VALIDATION_FAILED', 'Error de validación', {
          violations: [
            'email must be an email',
            'password must be longer than or equal to 8 characters',
          ],
        }),
        'patient',
      );

      const texto = textoDe(estado);
      expect(texto).toContain('Revisá estos 2 datos');
      expect(texto).toContain('Correo electrónico: no es un correo válido');
      expect(texto).toContain('Contraseña: tiene que tener al menos 8 caracteres');
      if (estado.status === 'validation') {
        expect(estado.issues.map((i) => i.field)).toEqual([undefined, 'email', 'password']);
      }
    });

    it('nombra la sucursal por su número y al dueño del dato por su cargo', () => {
      const texto = textoDe(
        traducir(
          respuesta(400, 'VALIDATION_FAILED', 'Error de validación', {
            violations: [
              'organization.diagnosticUnit.branches.1.name should not be empty',
              'organization.executives.generalManager.email must be an email',
            ],
          }),
        ),
      );
      expect(texto).toContain('Primer nombre de la sucursal 2');
      expect(texto).toContain('Correo electrónico de la gerencia general');
    });

    it('un mensaje propio del DTO, ya en castellano, se muestra tal cual', () => {
      const texto = textoDe(
        traducir(
          respuesta(400, 'VALIDATION_FAILED', 'Error de validación', {
            violations: ['El celular tiene que tener 8 dígitos'],
          }),
          'patient',
        ),
      );
      expect(texto).toContain('El celular tiene que tener 8 dígitos');
    });
  });

  describe('409 · dato repetido', () => {
    it('correo repetido de una organización: dice de quién es el correo y qué hacer', () => {
      const texto = textoDe(
        traducir(respuesta(409, 'CONFLICT', 'Ya existe una cuenta con ese correo')),
      );
      expect(texto).toContain('correo del representante legal');
      expect(texto).toContain('¿Olvidaste tu contraseña?');
    });

    it('documento repetido del paciente: ofrece entrar con el documento', () => {
      const estado = traducir(
        respuesta(409, 'CONFLICT', 'Ya existe una cuenta con ese documento de identidad'),
        'patient',
      );
      expect(textoDe(estado)).toContain(
        'Ya hay una cuenta registrada con este número de documento',
      );
      if (estado.status === 'validation') expect(estado.issues[0].field).toBe('nationalId');
    });

    it('sigla repetida de una organización: ancla al campo `code`', () => {
      const estado = traducir(
        respuesta(409, 'CONFLICT', 'El código de organización ya existe', { code: 'FARM-1' }),
      );
      expect(textoDe(estado)).toContain('sigla o este NIT');
      if (estado.status === 'validation') expect(estado.issues[0].field).toBe('code');
    });

    it('el genérico de la base, en el alta de paciente, ofrece entrar con el documento', () => {
      const texto = textoDe(
        traducir(
          respuesta(409, 'CONFLICT', 'El valor ya está en uso por otro registro'),
          'patient',
        ),
      );
      expect(texto).toContain('iniciá sesión con tu número de documento');
    });
  });

  describe('422 · reglas de negocio', () => {
    it('poder notariado faltante: dice qué falta, quién puede omitirlo y en qué paso cargarlo', () => {
      // Respuesta real de la API de test del 03/10/2026.
      const estado = traducir(
        respuesta(
          422,
          'PRECONDITION_FAILED',
          'Falta el poder notariado del representante legal: sólo una empresa unipersonal puede omitirlo',
          { document: 'powerOfAttorneyFileId' },
        ),
      );
      expect(textoDe(estado)).toBe(
        'Falta el poder notariado del representante legal. Sólo una empresa unipersonal puede registrarse sin él. Adjuntalo en el paso «Representante legal» (PDF, hasta 10 MB) y volvé a enviar.',
      );
    });

    it('escritura de constitución faltante', () => {
      const texto = textoDe(
        traducir(
          respuesta(422, 'PRECONDITION_FAILED', 'Falta la escritura de constitución', {
            document: 'constitutionFileId',
          }),
        ),
      );
      expect(texto).toContain('Falta la escritura de constitución de la empresa');
    });

    it('departamento emisor del médico', () => {
      const texto = textoDe(
        traducir(
          respuesta(
            422,
            'PRECONDITION_FAILED',
            'El departamento emisor es obligatorio para el alta del profesional',
            {
              field: 'issuerAdministrativeAreaConceptId',
            },
          ),
          'practitioner',
        ),
      );
      expect(texto).toContain('departamento donde se emitió tu carnet');
    });

    it('una regla que la pantalla debía cumplir sola se presenta como error nuestro, con código para soporte', () => {
      // Respuesta real: el 422 que tenía la farmacia antes de #908.
      const estado = traducir(
        respuesta(
          422,
          'PRECONDITION_FAILED',
          'Un tenant de tipo PHARMACY exige país y jurisdicción',
          {
            tenantType: 'PHARMACY',
            missing: ['countryConceptId', 'jurisdictionConceptId'],
          },
        ),
      );
      expect(estado.status).toBe('error');
      expect(textoDe(estado)).toContain('no es un error en tus datos');
      expect(textoDe(estado)).not.toContain('tenant');
      if (estado.status === 'error') expect(estado.requestId).toBe('corr-123');
    });

    it('archivo rechazado por formato', () => {
      const texto = textoDe(
        traducir(
          respuesta(
            422,
            'PRECONDITION_FAILED',
            'El documento no es de un formato admitido para este uso',
          ),
        ),
      );
      expect(texto).toContain('Subí el documento en PDF');
    });
  });

  describe('demás estados', () => {
    it('429: dice cuánto esperar y que los datos siguen cargados', () => {
      const estado = traducir(
        respuesta(429, 'RATE_LIMITED', 'ThrottlerException: Too Many Requests', undefined, {
          'retry-after': '60',
        }),
      );
      expect(textoDe(estado)).toBe(
        'Hubo demasiados intentos seguidos desde tu conexión. Por seguridad, esperá 60 segundos y volvé a enviar: tus datos siguen cargados.',
      );
      if (estado.status === 'validation') expect(estado.retryAfterSeconds).toBe(60);
    });

    it('413: archivo demasiado grande', () => {
      expect(textoDe(traducir(respuesta(413, 'PAYLOAD_TOO_LARGE', 'Payload Too Large')))).toContain(
        'el máximo es 10 MB',
      );
    });

    it('sin conexión', () => {
      expect(traducir(new HttpErrorResponse({ status: 0 })).status).toBe('offline');
    });

    it('500 o respuesta sin contrato: no culpa a la persona y da el código para soporte', () => {
      const estado = traducir(respuesta(500, 'INTERNAL', 'Error interno del servidor'));
      expect(estado.status).toBe('error');
      expect(textoDe(estado)).toContain('no es un error en tus datos');
      expect(textoDe(estado)).not.toContain('Error interno del servidor');

      const sinContrato = traducir(
        new HttpErrorResponse({ status: 502, error: '<html>Bad Gateway</html>' }),
      );
      expect(sinContrato.status).toBe('error');
    });

    it('un error que no es HTTP tampoco se muestra crudo', () => {
      const estado = traducir(new TypeError('x is undefined'));
      expect(textoDe(estado)).toContain('Tus datos siguen cargados');
      expect(textoDe(estado)).not.toContain('undefined');
    });
  });
});
