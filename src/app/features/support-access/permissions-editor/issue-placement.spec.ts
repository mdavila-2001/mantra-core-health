import { placeIssue, placeIssues, issueFromFailure } from './issue-placement';

describe('placeIssue', () => {
  it('una acción del permiso: el error va a esa acción', () => {
    const p = placeIssue(
      {
        code: 'GUARDRAIL_CEILING_EXCEEDED',
        path: 'grants[1].actions[3]',
        message: 'No cabe en el techo.',
      },
      'error',
    );
    expect(p).toMatchObject({
      writeIndex: 1,
      actionIndex: 3,
      severity: 'error',
      message: 'No cabe en el techo.',
    });
  });

  it('una clave de la condición del permiso va a su sección', () => {
    const p = placeIssue(
      {
        code: 'CONDITION_TIME_EMPTY_WINDOW',
        path: 'grants[0].condition.time.windows[0]',
        message: 'Franja vacía.',
      },
      'error',
    );
    expect(p).toMatchObject({
      writeIndex: 0,
      wholePermission: true,
      conditionKey: 'time',
      section: 'when',
    });
  });

  it('la condición de un átomo se lee aunque el átomo lleve puntos', () => {
    const p = placeIssue(
      {
        code: 'CONDITION_NOT_APPLICABLE_TO_ATOM',
        path: 'grants[0].actionConditions.agenda.appointment.cancel.appointment.leadTime',
        message: 'No aplica.',
      },
      'error',
    );
    expect(p).toMatchObject({
      writeIndex: 0,
      atom: 'agenda.appointment.cancel',
      conditionKey: 'appointment',
      section: 'appointment',
    });
  });

  it('en una fila Denegar «patients» es la sección «deny»', () => {
    const p = placeIssue(
      {
        code: 'CONDITION_NOT_ALLOWED_ON_DENY',
        path: 'grants[0].condition.patients.exclude',
        message: 'No.',
      },
      'error',
      () => true,
    );
    expect(p.section).toBe('deny');
  });

  it('una ruta sin permiso no se pega a ninguna fila; sin mensaje usa el texto de la tabla de motivos', () => {
    const p = placeIssue({ code: 'SIMULATION_STALE', path: '', message: '' }, 'warning');
    expect(p.writeIndex).toBeNull();
    expect(p.message).toContain('Algo cambió mientras editaba');
    expect(p.severity).toBe('warning');
  });

  it('un conflicto de funciones apunta al permiso entero', () => {
    const p = placeIssue(
      { code: 'SOD_CONFLICT_BLOCKED', path: 'grants[0]', message: 'No se permite.' },
      'error',
    );
    expect(p).toMatchObject({ writeIndex: 0, severity: 'error' });
    expect(p.actionIndex).toBeUndefined();
    expect(p.section).toBeUndefined();
  });

  it('placeIssues junta errores y avisos', () => {
    const lista = placeIssues({
      errors: [{ code: 'A', path: 'grants[0]', message: 'a' }],
      warnings: [{ code: 'B', path: 'grants[0]', message: 'b' }],
    });
    expect(lista.map((i) => i.severity)).toEqual(['error', 'warning']);
  });
});

describe('issueFromFailure', () => {
  it('un 422 al guardar se vuelve un error del mismo estilo para marcarlo en el mismo sitio', () => {
    const issue = issueFromFailure(
      2,
      'CONDITION_LIMIT_INVALID',
      'Un límite no es válido.',
      'condition.limits[0]',
    );
    expect(issue).toEqual({
      code: 'CONDITION_LIMIT_INVALID',
      path: 'grants[2].condition.limits[0]',
      message: 'Un límite no es válido.',
    });
    expect(placeIssue(issue, 'error')).toMatchObject({ writeIndex: 2, section: 'limits' });
  });

  it('sin ruta queda sobre el permiso entero', () => {
    expect(issueFromFailure(0, 'GUARDRAIL_NOT_DELEGABLE', 'No.', undefined).path).toBe('grants[0]');
  });
});

/**
 * Ronda 2 de la API: dos 422 nuevos al escribir condiciones. Los dos hablan de la condición del permiso (no de una casilla),
 * así que el mensaje va en la zona de condiciones y no solo en la lista general.
 */
describe('422 de condiciones de la ronda 2', () => {
  it('CONDITION_TOO_LARGE (la condición, o las claves de actionConditions) va a la condición del permiso', () => {
    const entera = placeIssue({ code: 'CONDITION_TOO_LARGE', path: 'grants[0]', message: 'x' }, 'error');
    expect(entera).toMatchObject({ writeIndex: 0, wholePermission: true });
    const porClaves = placeIssue(issueFromFailure(0, 'CONDITION_TOO_LARGE', 'x', 'actionConditions'), 'error');
    expect(porClaves).toMatchObject({ writeIndex: 0, wholePermission: true });
  });

  it('CONDITION_NOT_APPLICABLE_TO_ATOM sin ruta (permiso con códigos antiguos) va a la condición del permiso', () => {
    const issue = issueFromFailure(1, 'CONDITION_NOT_APPLICABLE_TO_ATOM', 'x', '');
    expect(placeIssue(issue, 'error')).toMatchObject({ writeIndex: 1, wholePermission: true });
  });

  it('CONDITION_NOT_APPLICABLE_TO_ATOM con la clave (condition.time) sigue yendo a su sección', () => {
    const issue = issueFromFailure(0, 'CONDITION_NOT_APPLICABLE_TO_ATOM', 'x', 'condition.time');
    expect(placeIssue(issue, 'error')).toMatchObject({ writeIndex: 0, wholePermission: true, conditionKey: 'time', section: 'when' });
  });

  it('un permiso entero que falla por otra razón (conflicto de funciones) NO se mueve a las condiciones', () => {
    const p = placeIssue({ code: 'SOD_CONFLICT_BLOCKED', path: 'grants[0]', message: 'x' }, 'error');
    expect(p.wholePermission).toBeUndefined();
  });
});
