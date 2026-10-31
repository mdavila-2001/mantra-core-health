import { HttpErrorResponse } from '@angular/common/http';

import { explainTeamFailure } from './team-failure';

const failure = (
  status: number,
  reason: string,
  details: Record<string, unknown> = {},
): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code: status === 403 ? 'FORBIDDEN' : 'PRECONDITION_FAILED',
      message: 'texto técnico',
      reason,
      details: { ...details, reason },
      timestamp: '',
      path: '/x',
    },
  });

describe('explainTeamFailure', () => {
  it('ADMIN_CEILING_EXCEEDED: dice que pasa de lo que puede dar y a quién pedirlo, sin ofrecer una aprobación que no existe', () => {
    const f = explainTeamFailure(failure(403, 'ADMIN_CEILING_EXCEEDED'));
    expect(f.title).toBe('Eso pasa de lo que usted puede dar');
    expect(f.message).toBe(
      'Eso excede lo que usted puede dar. Pídaselo al administrador de seguridad.',
    );
    expect(f.help).toContain('administrador de seguridad');
    expect(f.help).not.toContain('aprobación de');
  });

  it('ADMIN_SCOPE_EXCEEDED: explica el alcance y propone quitarle solo lo suyo; con la cantidad si la API la manda', () => {
    const plain = explainTeamFailure(failure(403, 'ADMIN_SCOPE_EXCEEDED'));
    expect(plain.title).toBe('Fuera de lo que usted administra');
    expect(plain.help).toContain('«Quitar»');
    const counted = explainTeamFailure(failure(403, 'ADMIN_SCOPE_EXCEEDED', { outsideCount: 2 }));
    expect(counted.help).toContain('2 permisos fuera de lo que usted administra');
    expect(
      explainTeamFailure(failure(403, 'ADMIN_SCOPE_EXCEEDED', { outsideCount: 1 })).help,
    ).toContain('1 permiso fuera');
  });

  it('un permiso crítico sin vencimiento, lo que no se delega y el paso extra tienen su propia ayuda', () => {
    expect(explainTeamFailure(failure(422, 'GUARDRAIL_CRITICAL_REQUIRES_EXPIRY')).help).toBe(
      'Elija hasta qué día vale el permiso.',
    );
    expect(explainTeamFailure(failure(403, 'GUARDRAIL_PEER_ADMIN')).title).toBe(
      'Eso no se puede delegar',
    );
    expect(explainTeamFailure(failure(403, 'STEP_UP_REQUIRED')).title).toBe(
      'Falta confirmar su identidad',
    );
  });

  it('lo que no es un error de la API se explica con un texto genérico', () => {
    expect(explainTeamFailure(new Error('x')).message).toContain('Vuelva a intentarlo');
  });
});
