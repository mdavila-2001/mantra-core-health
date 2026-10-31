import { activeRules, evaluateIpRules, isRuleActive, isValidCidr, matchesCidr, parseCidr, parseIp, validateIpRules } from './ip-rules';

describe('leer direcciones', () => {
  it('IPv4: cuatro octetos de 0 a 255, sin ceros a la izquierda', () => {
    expect(parseIp('190.129.10.4')).toMatchObject({ family: 'ipv4' });
    for (const mala of ['190.129.10', '190.129.10.256', '190.129.10.04', '190.129.10.4.5', 'a.b.c.d', '', ' ']) {
      expect(parseIp(mala), mala).toBeNull();
    }
  });

  it('IPv6: abreviatura, mayúsculas y una IPv4 incrustada', () => {
    expect(parseIp('2001:db8::1')).toMatchObject({ family: 'ipv6' });
    expect(parseIp('::1')).toMatchObject({ family: 'ipv6' });
    expect(parseIp('::')).toMatchObject({ family: 'ipv6' });
    expect(parseIp('2001:DB8:0:0:0:0:0:1')).toMatchObject({ family: 'ipv6' });
    expect(parseIp('64:ff9b::192.0.2.33')).toMatchObject({ family: 'ipv6' });
    for (const mala of ['2001:db8:::1', '2001::db8::1', '2001:db8', '12345::1', 'g::1', '1:2:3:4:5:6:7:8:9']) {
      expect(parseIp(mala), mala).toBeNull();
    }
  });

  it('una IPv4 mapeada en IPv6 se lee como IPv4, y se ignoran los corchetes y la zona', () => {
    expect(parseIp('::ffff:190.129.10.4')).toMatchObject({ family: 'ipv4' });
    expect(parseIp('[2001:db8::1]')).toMatchObject({ family: 'ipv6' });
    expect(parseIp('fe80::1%eth0')).toMatchObject({ family: 'ipv6' });
  });
});

describe('CIDR', () => {
  it('exige la barra y un prefijo dentro del rango de su familia', () => {
    expect(isValidCidr('190.129.0.0/16')).toBe(true);
    expect(isValidCidr('203.0.113.7/32')).toBe(true);
    expect(isValidCidr('0.0.0.0/0')).toBe(true);
    expect(isValidCidr('2001:db8::/32')).toBe(true);
    for (const malo of ['190.129.0.0', '190.129.0.0/33', '2001:db8::/129', '190.129.0.0/', '/16', '190.129.0.0/16/1', '190.129.0.0/-1', '190.129.0/16', 'sede central', '']) {
      expect(isValidCidr(malo), malo).toBe(false);
    }
  });

  it('un rango demasiado largo no es un CIDR (la API admite 64 caracteres)', () => {
    expect(parseCidr(`${'1'.repeat(70)}/8`)).toBeNull();
  });

  it('decide si una dirección cae en el rango, en las dos familias', () => {
    expect(matchesCidr('190.129.77.12', '190.129.0.0/16')).toBe(true);
    expect(matchesCidr('190.130.0.1', '190.129.0.0/16')).toBe(false);
    expect(matchesCidr('203.0.113.7', '203.0.113.7/32')).toBe(true);
    expect(matchesCidr('203.0.113.8', '203.0.113.7/32')).toBe(false);
    expect(matchesCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
    expect(matchesCidr('2001:db8:1::5', '2001:db8::/32')).toBe(true);
    expect(matchesCidr('2001:db9::5', '2001:db8::/32')).toBe(false);
  });

  it('una IPv4 nunca cae en un rango IPv6, y una IPv4 mapeada sí en uno IPv4', () => {
    expect(matchesCidr('190.129.10.4', '2001:db8::/32')).toBe(false);
    expect(matchesCidr('::ffff:190.129.10.4', '190.129.0.0/16')).toBe(true);
  });

  it('un rango o una dirección inválidos no coinciden con nada', () => {
    expect(matchesCidr('190.129.10.4', 'basura')).toBe(false);
    expect(matchesCidr('basura', '0.0.0.0/0')).toBe(false);
  });
});

describe('evaluar un conjunto de reglas, como la API', () => {
  const sede = { type: 'ALLOW', cidr: '190.129.0.0/16' } as const;
  const bloqueada = { type: 'DENY', cidr: '190.129.99.0/24' } as const;

  it('sin reglas no hay restricción', () => {
    expect(evaluateIpRules('1.2.3.4', [])).toBe('NO_RULES');
  });

  it('con reglas permitidas solo se entra desde ellas', () => {
    expect(evaluateIpRules('190.129.1.1', [sede])).toBe('ALLOWED');
    expect(evaluateIpRules('8.8.8.8', [sede])).toBe('DENIED');
  });

  it('una regla que niega gana siempre, aunque la dirección también esté permitida', () => {
    expect(evaluateIpRules('190.129.99.5', [sede, bloqueada])).toBe('DENIED');
    expect(evaluateIpRules('190.129.1.1', [sede, bloqueada])).toBe('ALLOWED');
  });

  it('con solo reglas que niegan, el resto puede entrar', () => {
    expect(evaluateIpRules('8.8.8.8', [bloqueada])).toBe('ALLOWED');
    expect(evaluateIpRules('190.129.99.5', [bloqueada])).toBe('DENIED');
  });

  it('un origen que no se puede leer se niega cuando hay reglas', () => {
    expect(evaluateIpRules(undefined, [sede])).toBe('DENIED');
    expect(evaluateIpRules('no-es-ip', [bloqueada])).toBe('DENIED');
  });
});

describe('vigencia', () => {
  const ahora = new Date('2026-11-10T12:00:00Z');

  it('sin fechas rige siempre; con fechas, dentro del intervalo y con el final exclusivo', () => {
    expect(isRuleActive({}, ahora)).toBe(true);
    expect(isRuleActive({ validFrom: '2026-11-10T12:00:00Z' }, ahora)).toBe(true);
    expect(isRuleActive({ validFrom: '2026-11-11T00:00:00Z' }, ahora)).toBe(false);
    expect(isRuleActive({ validTo: '2026-11-10T12:00:00Z' }, ahora)).toBe(false);
    expect(isRuleActive({ validTo: '2026-11-11T00:00:00Z' }, ahora)).toBe(true);
  });

  it('solo cuentan las reglas que rigen ahora', () => {
    const reglas = [
      { type: 'ALLOW', cidr: '10.0.0.0/8' },
      { type: 'ALLOW', cidr: '11.0.0.0/8', validFrom: '2027-01-01T00:00:00Z' },
      { type: 'DENY', cidr: '12.0.0.0/8', validTo: '2026-01-01T00:00:00Z' },
    ] as const;
    expect(activeRules(reglas, ahora).map((r) => r.cidr)).toEqual(['10.0.0.0/8']);
  });
});

describe('validar antes de guardar', () => {
  it('un conjunto bueno no tiene problemas', () => {
    expect(validateIpRules([{ type: 'ALLOW', cidr: '190.129.0.0/16', description: 'Sede' }])).toEqual([]);
    expect(validateIpRules([])).toEqual([]);
  });

  it('dice el problema junto al renglón y al campo', () => {
    const problemas = validateIpRules([
      { type: 'ALLOW', cidr: '' },
      { type: 'ALLOW', cidr: '190.129.0.0' },
      { type: 'DENY', cidr: '190.129.0.0/40' },
      { type: 'ALLOW', cidr: '10.0.0.0/8', validFrom: '2026-12-01T00:00:00Z', validTo: '2026-11-01T00:00:00Z' },
      { type: 'ALLOW', cidr: '10.0.0.0/8', description: 'x'.repeat(201) },
    ]);
    expect(problemas.map((p) => [p.index, p.field])).toEqual([
      [0, 'cidr'],
      [1, 'cidr'],
      [2, 'cidr'],
      [3, 'validity'],
      [4, 'description'],
    ]);
    // Sin la barra se explica cómo escribir una sola dirección; con barra, que el rango no sirve.
    expect(problemas[1]!.message).toContain('/32');
    expect(problemas[2]!.message).toContain('no es válido');
  });

  it('una regla que termina el mismo instante en que empieza ya es una vigencia al revés', () => {
    expect(validateIpRules([{ type: 'ALLOW', cidr: '10.0.0.0/8', validFrom: '2026-11-01T00:00:00Z', validTo: '2026-11-01T00:00:00Z' }])).toHaveLength(1);
  });

  it('ninguna advertencia deja ver códigos de sistema', () => {
    for (const p of validateIpRules([{ type: 'ALLOW', cidr: 'x' }, { type: 'ALLOW', cidr: '1.1.1.1' }])) {
      expect(p.message).not.toMatch(/IP_RULE|[A-Z]{3,}_[A-Z_]+/);
    }
  });
});
