import {
  DEFAULT_HOURS,
  dayBands,
  describeHours,
  effectiveRules,
  explainPolicy,
  isAllowedAt,
  newPolicy,
  policyKey,
  previewEffect,
  removePolicy,
  samePolicies,
  upsertPolicy,
  validatePolicies,
  weekdayAndMinutes,
} from './session-policy';
import type { AllowedHours, SessionPolicy } from './support-access.types';

const OFICINA: AllowedHours = { days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' };
const NOCHE: AllowedHours = { days: [5], from: '22:00', to: '06:00' };

const todas: SessionPolicy = { ...newPolicy('ALL_ACCOUNTS'), idleTimeoutMinutes: 30 };
const personal: SessionPolicy = { ...newPolicy('ORG_STAFF'), idleTimeoutMinutes: 10, requireMfa: true, allowedHours: OFICINA };
const medico: SessionPolicy = { ...newPolicy('ROLE', 'PRACTITIONER'), idleTimeoutMinutes: 20, enforceIpRules: true };

describe('el horario laboral', () => {
  it('lo dice en frases: días seguidos agrupados y la franja', () => {
    expect(describeHours(OFICINA)).toBe('Lunes a viernes, de 08:00 a 18:00');
    expect(describeHours({ from: '00:00', to: '23:30' })).toBe('Todos los días, de 00:00 a 23:30');
    expect(describeHours({ days: [1, 3], from: '08:00', to: '12:00' })).toBe('Lunes, miércoles, de 08:00 a 12:00');
    expect(describeHours({ days: [6, 0], from: '09:00', to: '13:00' })).toBe('Sábado y domingo, de 09:00 a 13:00');
    expect(describeHours(undefined)).toContain('Sin restricción');
  });

  it('una franja que termina antes de empezar cruza la medianoche y lo dice', () => {
    expect(describeHours(NOCHE)).toBe('Viernes, de 22:00 a 06:00 (cruza la medianoche)');
  });

  it('deja entrar dentro de la franja y de los días, y no fuera: el fin no se incluye', () => {
    expect(isAllowedAt(OFICINA, 1, 8 * 60)).toBe(true);
    expect(isAllowedAt(OFICINA, 1, 18 * 60 - 1)).toBe(true);
    expect(isAllowedAt(OFICINA, 1, 18 * 60)).toBe(false);
    expect(isAllowedAt(OFICINA, 6, 10 * 60)).toBe(false);
    expect(isAllowedAt(undefined, 0, 3 * 60)).toBe(true);
  });

  it('pasada la medianoche la franja pertenece al día en que empezó, como en la API', () => {
    // Viernes 23:00: dentro. Sábado 03:00: sigue siendo la franja del viernes. Sábado 23:00: no.
    expect(isAllowedAt(NOCHE, 5, 23 * 60)).toBe(true);
    expect(isAllowedAt(NOCHE, 6, 3 * 60)).toBe(true);
    expect(isAllowedAt(NOCHE, 6, 23 * 60)).toBe(false);
    expect(isAllowedAt(NOCHE, 5, 3 * 60)).toBe(false);
  });

  it('dibuja cada día con su tramo; la franja de noche se parte entre dos días', () => {
    const oficina = dayBands(OFICINA);
    expect(oficina.find((d) => d.day === 1)!.bands).toEqual([{ from: 480, to: 1080 }]);
    expect(oficina.find((d) => d.day === 6)!.bands).toEqual([]);
    const noche = dayBands(NOCHE);
    expect(noche.find((d) => d.day === 5)!.bands).toEqual([{ from: 1320, to: 1440 }]);
    expect(noche.find((d) => d.day === 6)!.bands).toEqual([{ from: 0, to: 360 }]);
  });

  it('el reloj de la organización decide el día y la hora, no el del navegador', () => {
    // 2026-11-02 02:30 UTC es domingo 1.º a las 22:30 en La Paz (UTC-4).
    expect(weekdayAndMinutes(new Date('2026-11-02T02:30:00Z'), 'America/La_Paz')).toEqual({ day: 0, minutes: 22 * 60 + 30 });
    expect(weekdayAndMinutes(new Date('2026-11-02T02:30:00Z'), 'zona-que-no-existe')).toEqual({ day: 0, minutes: 22 * 60 + 30 });
  });

  it('el horario de arranque es el de oficina', () => {
    expect(DEFAULT_HOURS.days).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('qué reglas rigen', () => {
  const reglas = [todas, personal, medico];

  it('a una cuenta cualquiera solo le rige «todas las cuentas»', () => {
    expect(effectiveRules(reglas, { kind: 'ACCOUNT' })).toEqual({ idleTimeoutMinutes: 30, newDeviceAlert: true, enforceIpRules: false, requireMfa: false, allowedHours: [] });
  });

  it('al personal le rigen las dos y se queda con lo más estricto', () => {
    const r = effectiveRules(reglas, { kind: 'STAFF' });
    expect(r.idleTimeoutMinutes).toBe(10);
    expect(r.requireMfa).toBe(true);
    expect(r.allowedHours).toEqual([OFICINA]);
  });

  it('a quien tiene un rol le rige además la de su rol; a otro rol no', () => {
    expect(effectiveRules(reglas, { kind: 'ROLE', roleCode: 'PRACTITIONER' }).enforceIpRules).toBe(true);
    expect(effectiveRules(reglas, { kind: 'ROLE', roleCode: 'CASHIER' }).enforceIpRules).toBe(false);
    expect(effectiveRules(reglas, { kind: 'ROLE', roleCode: 'PRACTITIONER' }).idleTimeoutMinutes).toBe(10);
  });

  it('todas las franjas se tienen que cumplir a la vez', () => {
    const noche: SessionPolicy = { ...newPolicy('ROLE', 'CASHIER'), allowedHours: NOCHE };
    const r = effectiveRules([personal, noche], { kind: 'ROLE', roleCode: 'CASHIER' });
    expect(r.allowedHours).toEqual([OFICINA, NOCHE]);
    expect(previewEffect(r, 1, 10 * 60).allowed).toBe(false);
  });

  it('sin ninguna regla, no hay plazo de inactividad', () => {
    expect(effectiveRules([], { kind: 'ACCOUNT' }).idleTimeoutMinutes).toBeUndefined();
  });
});

describe('editar la lista de reglas', () => {
  it('agrega, cambia y quita sin tocar las demás', () => {
    const base = [todas];
    const con = upsertPolicy(base, personal);
    expect(con).toHaveLength(2);
    expect(upsertPolicy(con, { ...personal, idleTimeoutMinutes: 45 }).find((p) => p.scope === 'ORG_STAFF')!.idleTimeoutMinutes).toBe(45);
    expect(removePolicy(con, 'ORG_STAFF')).toEqual([todas]);
    expect(policyKey(medico)).toBe('ROLE:PRACTITIONER');
  });

  it('compara reglas por contenido, sin importar el orden ni el horario escrito distinto', () => {
    expect(samePolicies([todas, personal], [personal, todas])).toBe(true);
    expect(samePolicies([todas], [{ ...todas, requireMfa: true }])).toBe(false);
    const a: SessionPolicy = { ...todas, allowedHours: { days: [3, 1, 2], from: '08:00', to: '12:00' } };
    const b: SessionPolicy = { ...todas, allowedHours: { days: [1, 2, 3], from: '08:00', to: '12:00', timeZone: 'America/La_Paz' } };
    expect(samePolicies([a], [b])).toBe(true);
  });
});

describe('validar antes de guardar', () => {
  it('una lista sana no tiene problemas', () => {
    expect(validatePolicies([todas, personal, medico])).toEqual([]);
  });

  it('dice qué está mal en palabras de quien edita', () => {
    expect(validatePolicies([{ ...todas, idleTimeoutMinutes: 2 }]).join(' ')).toContain('de 5 a 120 minutos');
    expect(validatePolicies([{ ...newPolicy('ROLE') }]).join(' ')).toContain('elegir el rol');
    expect(validatePolicies([todas, todas]).join(' ')).toContain('dos reglas iguales');
    expect(validatePolicies([{ ...todas, allowedHours: { from: '08:00', to: '08:00' } }]).join(' ')).toContain('no admite a nadie');
    // La franja mínima que la API acepta: 4 horas (la que cruza la medianoche suma los dos tramos).
    expect(validatePolicies([{ ...todas, allowedHours: { from: '09:00', to: '12:30' } }]).join(' ')).toContain('menos de 4 horas');
    expect(validatePolicies([{ ...todas, allowedHours: { from: '09:00', to: '13:00' } }])).toEqual([]);
    expect(validatePolicies([{ ...todas, allowedHours: { from: '22:00', to: '02:00' } }])).toEqual([]);
    expect(validatePolicies([{ ...todas, allowedHours: { from: '23:00', to: '01:00' } }]).join(' ')).toContain('menos de 4 horas');
  });
});

describe('decirlo en lenguaje simple', () => {
  it('cada control trae qué significa y qué pasa ahora, sin jerga', () => {
    const e = explainPolicy(personal);
    expect(e.map((x) => x.id)).toEqual(['idle', 'device', 'hours', 'network', 'mfa']);
    expect(e.find((x) => x.id === 'idle')!.effect).toBe('La sesión se cierra tras 10 minutos sin actividad.');
    expect(e.find((x) => x.id === 'mfa')!.effect).toContain('Obligatoria');
    expect(e.find((x) => x.id === 'hours')!.effect).toContain('Lunes a viernes');
    for (const x of e) expect(x.meaning).not.toMatch(/\b(MFA|IP|TOTP|idle|policy)\b/i);
  });

  it('la vista previa dice si alguien podría entrar y qué le pasaría', () => {
    const rige = effectiveRules([personal], { kind: 'STAFF' });
    const sabado = previewEffect(rige, 6, 21 * 60);
    expect(sabado.allowed).toBe(false);
    expect(sabado.lines[0]).toContain('sábado a las 21:00 no podría iniciar sesión');
    const lunes = previewEffect(rige, 1, 10 * 60);
    expect(lunes.allowed).toBe(true);
    expect(lunes.lines.join(' ')).toContain('código de verificación');
    expect(lunes.lines.join(' ')).toContain('10 minutos');
  });
});
