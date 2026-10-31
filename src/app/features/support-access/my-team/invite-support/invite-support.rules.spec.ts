import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import {
  claveDeInvitacion,
  documentoParaEnviar,
  enviadaEl,
  errorDelDocumento,
  ESPERA_POR_DEFECTO_SEGUNDOS,
  esInvitacionSinResponder,
  opcionesDeVinculacion,
  rechazoDeLaInvitacion,
  vinculacionesInvitables,
} from './invite-support.rules';

function vinculacion(extra: Partial<MyRoleAssignment> = {}): MyRoleAssignment {
  return {
    id: 'ra-1',
    practiceId: 'p-1',
    practiceName: 'Hospital Piloto Mantra',
    roleConceptId: 'rol-medico',
    status: 'concepto-activo',
    statusCode: 'ROLE_ASG_ACTIVE',
    isPrimary: false,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    avatarUrl: null,
    tenantId: 't-1',
    ...extra,
  };
}

function falla(status: number, cuerpo: unknown, headers?: Record<string, string>): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo, statusText: 'x', ...(headers === undefined ? {} : { headers: new HttpHeaders(headers) }) });
}

describe('errorDelDocumento', () => {
  it('un documento vacío o de espacios pide escribirlo', () => {
    expect(errorDelDocumento('')).toContain('Escriba el documento');
    expect(errorDelDocumento('   ')).toContain('Escriba el documento');
  });

  it('acepta letras, dígitos, punto y guion de 4 a 40 caracteres', () => {
    expect(errorDelDocumento('7005002')).toBeNull();
    expect(errorDelDocumento(' 1.234-567A ')).toBeNull();
    expect(errorDelDocumento('1234')).toBeNull();
    expect(errorDelDocumento('1'.repeat(40))).toBeNull();
  });

  it('rechaza lo que la API rechazaría: caracteres, largo y contenido', () => {
    expect(errorDelDocumento('12 345 678')).toContain('solo admite letras, dígitos, punto y guion');
    expect(errorDelDocumento('12345_')).toContain('solo admite');
    expect(errorDelDocumento('123')).toContain('al menos 4');
    expect(errorDelDocumento('1'.repeat(41))).toContain('como máximo 40');
  });

  it('no juzga el contenido: lo que el DTO acepta (00012, 000000, ....) pasa, y la API dirá si hay una secretaria con él', () => {
    expect(errorDelDocumento('00012')).toBeNull();
    expect(errorDelDocumento('000000')).toBeNull();
    expect(errorDelDocumento('....')).toBeNull();
  });

  it('el documento viaja sin espacios a los lados y nada más', () => {
    expect(documentoParaEnviar('  7005002 ')).toBe('7005002');
    // Ni puntos, ni guiones, ni ceros: la API busca por el texto recibido, tal cual.
    expect(documentoParaEnviar('01.234-567')).toBe('01.234-567');
  });
});

describe('vinculaciones del doctor', () => {
  it('solo ofrece las activas: pendiente, rechazada, finalizada o sin estado conocido no sirven', () => {
    const activa = vinculacion({ id: 'a' });
    const lista = [
      activa,
      vinculacion({ id: 'b', statusCode: 'ROLE_ASG_PENDING' }),
      vinculacion({ id: 'c', statusCode: 'ROLE_ASG_ENDED' }),
      vinculacion({ id: 'd', statusCode: 'ROLE_ASG_REJECTED' }),
      vinculacion({ id: 'e', statusCode: 'ROLE_ASG_INVITED' }),
      vinculacion({ id: 'f', statusCode: 'raro' }),
      { ...vinculacion({ id: 'g' }), statusCode: undefined },
    ];
    expect(vinculacionesInvitables(lista).map((v) => v.id)).toEqual(['a']);
  });

  it('acepta el código con el prefijo del módulo', () => {
    expect(vinculacionesInvitables([vinculacion({ statusCode: 'practice:ROLE_ASG_ACTIVE' })])).toHaveLength(1);
  });

  it('nombra la opción por el hospital y, si es por procedimiento, cuál', () => {
    const opciones = opcionesDeVinculacion([
      vinculacion({ id: 'a', practiceType: 'Hospital' }),
      vinculacion({ id: 'b', serviceDisplay: 'Colonoscopia' }),
    ]);
    expect(opciones).toEqual([
      { value: 'a', label: 'Hospital Piloto Mantra', description: 'Hospital' },
      { value: 'b', label: 'Hospital Piloto Mantra · Colonoscopia' },
    ]);
  });
});

describe('integrantes de «Mi equipo»', () => {
  const base = { delegateId: 'd-1', personName: 'Lucía Paz', status: 'PENDING_ACCEPTANCE' } as unknown as DoctorTeamMember;
  /** Un vínculo con la forma real de la API (`SupportLinkViewDto`): `id`, sin `delegateId`. */
  const deLaApi = {
    id: 'link-1',
    kind: 'PRACTITIONER',
    status: 'PENDING',
    personName: 'Lucía Paz',
    organizationName: 'Hospital Piloto Mantra',
    initiatedBy: 'PRACTITIONER',
    awaiting: 'SUPPORT_STAFF',
    createdAt: '2026-10-31T10:00:00Z',
  } as unknown as DoctorTeamMember;

  it('es una invitación sin responder solo si la inició el doctor y espera a la secretaria', () => {
    expect(esInvitacionSinResponder({ ...base, initiatedBy: 'PRACTITIONER', awaiting: 'SUPPORT_STAFF' } as DoctorTeamMember)).toBe(true);
    // Lo que pidió la secretaria y espera al doctor es otra cosa: el doctor lo acepta.
    expect(esInvitacionSinResponder({ ...base, initiatedBy: 'SUPPORT_STAFF', awaiting: 'PRACTITIONER' } as DoctorTeamMember)).toBe(false);
    expect(esInvitacionSinResponder({ ...base, initiatedBy: 'PRACTITIONER', awaiting: null } as DoctorTeamMember)).toBe(false);
    expect(esInvitacionSinResponder(base)).toBe(false);
  });

  it('reconoce el vínculo con la forma real de la API (status PENDING, sin delegateId)', () => {
    expect(esInvitacionSinResponder(deLaApi)).toBe(true);
  });

  it('un vínculo sin iniciador (initiatedBy null) no es una invitación: nadie lo decide', () => {
    expect(esInvitacionSinResponder({ ...deLaApi, initiatedBy: null, awaiting: null } as unknown as DoctorTeamMember)).toBe(false);
    expect(esInvitacionSinResponder({ ...deLaApi, initiatedBy: null } as unknown as DoctorTeamMember)).toBe(false);
  });

  it('una vez activo o terminado deja de ser una invitación sin responder, aunque conserve a quién esperó', () => {
    expect(esInvitacionSinResponder({ ...deLaApi, status: 'ACTIVE' } as unknown as DoctorTeamMember)).toBe(false);
    expect(esInvitacionSinResponder({ ...deLaApi, status: 'ENDED' } as unknown as DoctorTeamMember)).toBe(false);
  });

  it('la clave es delegateId si lo trae y el id del vínculo si no; nunca undefined', () => {
    expect(claveDeInvitacion(base)).toBe('d-1');
    expect(claveDeInvitacion(deLaApi)).toBe('link-1');
  });

  it('lee cuándo se envió, si lo trae', () => {
    expect(enviadaEl({ ...base, createdAt: '2026-10-31T10:00:00Z' } as DoctorTeamMember)).toBe('2026-10-31T10:00:00Z');
    expect(enviadaEl(base)).toBeUndefined();
  });
});

describe('rechazoDeLaInvitacion', () => {
  it('«no hay una secretaria con ese documento» se ancla al documento y se lee completo', () => {
    const r = rechazoDeLaInvitacion(
      falla(404, { code: 'NOT_FOUND', reason: 'SUPPORT_STAFF_NOT_FOUND', message: 'No hay una secretaria registrada con ese documento' }),
    );
    expect(r.campo).toBe('documento');
    expect(r.mensaje).toContain('No hay una secretaria registrada con ese documento');
    expect(r.reintentable).toBe(false);
  });

  it('el reason también se lee dentro de details', () => {
    const r = rechazoDeLaInvitacion(falla(404, { code: 'NOT_FOUND', message: 'x', details: { reason: 'SUPPORT_TARGET_NOT_FOUND' } }));
    expect(r.campo).toBe('vinculacion');
  });

  it('un vínculo repetido (409) se ancla al documento y no se ofrece reintentar', () => {
    const r = rechazoDeLaInvitacion(falla(409, { code: 'CONFLICT', reason: 'SUPPORT_LINK_DUPLICATE', message: 'Ya hay un vínculo vivo' }));
    expect(r.campo).toBe('documento');
    expect(r.mensaje).toContain('Ya hay un vínculo');
    expect(r.reintentable).toBe(false);
  });

  it('sin conexión se puede reintentar y dice que no se envió nada', () => {
    const r = rechazoDeLaInvitacion(falla(0, null));
    expect(r.campo).toBeNull();
    expect(r.reintentable).toBe(true);
    // No se puede garantizar que no llegó: se manda a mirar las invitaciones enviadas antes de reintentar.
    expect(r.mensaje).toContain('Puede que la invitación no se haya enviado');
    expect(r.mensaje).toContain('Invitaciones enviadas');
    expect(r.mensaje).not.toContain('no se envió nada');
  });

  it('un 404 sin reason no se reintenta: no hay nada que repetir', () => {
    const r = rechazoDeLaInvitacion(falla(404, { code: 'NOT_FOUND', message: 'No encontrado' }));
    expect(r).toMatchObject({ campo: null, reintentable: false });
    expect(r.mensaje).toContain('Revise el documento y la vinculación');
  });

  it('un 429 con Retry-After espera lo que dice el servidor y se puede reintentar', () => {
    const r = rechazoDeLaInvitacion(falla(429, { code: 'RATE_LIMITED', message: 'Demasiadas' }, { 'retry-after': '12' }));
    expect(r).toMatchObject({ campo: null, reintentable: true, esperarSegundos: 12 });
  });

  it('un 429 sin Retry-After se puede reintentar tras una espera razonable por defecto', () => {
    const r = rechazoDeLaInvitacion(falla(429, { code: 'RATE_LIMITED', message: 'Demasiadas' }));
    expect(r).toMatchObject({ campo: null, reintentable: true, esperarSegundos: ESPERA_POR_DEFECTO_SEGUNDOS });
  });

  it('un 500 conserva el código de soporte y se puede reintentar', () => {
    const r = rechazoDeLaInvitacion(falla(500, { code: 'INTERNAL', message: 'Falló', correlationId: 'req-9' }));
    expect(r).toMatchObject({ campo: null, reintentable: true, requestId: 'req-9' });
  });

  it('un 500 sin código de la API no inventa uno', () => {
    expect(rechazoDeLaInvitacion(falla(502, '<html>')).requestId).toBeUndefined();
  });

  it('un 403 dice lo que la API dijo y no se reintenta', () => {
    const r = rechazoDeLaInvitacion(falla(403, { code: 'FORBIDDEN', message: 'No tiene permiso' }));
    expect(r.campo).toBeNull();
    expect(r.reintentable).toBe(false);
  });

  it('la validación de la API (400) se muestra sin anclarla', () => {
    const r = rechazoDeLaInvitacion(
      falla(400, { code: 'VALIDATION_FAILED', message: 'Error de validación', details: { violations: ['nationalId must be a string'] } }),
    );
    expect(r.campo).toBeNull();
    expect(r.mensaje).toContain('nationalId must be a string');
  });
});
