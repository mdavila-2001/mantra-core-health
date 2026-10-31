import { describe, expect, it } from 'vitest';

import { isInternalAddress, networkWarning, ruleForMyIp } from './my-network';

describe('ruleForMyIp', () => {
  it('IPv4 propone un /32 y IPv6 un /128, siempre para permitir', () => {
    expect(ruleForMyIp({ ip: '190.129.10.4', family: 'ipv4', trustProxyHops: 1 })).toEqual({ type: 'ALLOW', cidr: '190.129.10.4/32', description: 'Mi conexión actual' });
    expect(ruleForMyIp({ ip: '2001:db8::7', family: 'ipv6', trustProxyHops: 1 })).toEqual({ type: 'ALLOW', cidr: '2001:db8::7/128', description: 'Mi conexión actual' });
  });

  it('sin dirección legible no propone nada', () => {
    expect(ruleForMyIp({ ip: null, family: null, trustProxyHops: 1 })).toBeNull();
  });
});

describe('networkWarning', () => {
  it('con una dirección pública y proxy configurado no avisa', () => {
    expect(networkWarning({ ip: '190.129.10.4', family: 'ipv4', trustProxyHops: 1 })).toBeNull();
  });

  it('con 0 saltos de proxy avisa que puede estar viendo el proxy', () => {
    expect(networkWarning({ ip: '190.129.10.4', family: 'ipv4', trustProxyHops: 0 })).toContain('0 saltos');
  });

  it('una dirección interna parece un proxy mal configurado, aunque haya saltos', () => {
    for (const ip of ['10.0.0.5', '192.168.1.20', '172.20.1.1', '127.0.0.1', '::1', 'fd00::1', 'fe80::1']) {
      expect(isInternalAddress(ip), ip).toBe(true);
      expect(networkWarning({ ip, family: ip.includes(':') ? 'ipv6' : 'ipv4', trustProxyHops: 2 }), ip).toContain('dirección interna');
    }
    expect(isInternalAddress('172.32.0.1')).toBe(false);
  });

  it('sin dirección legible avisa que no se puede comparar', () => {
    expect(networkWarning({ ip: null, family: null, trustProxyHops: 1 })).toContain('no pudo leer');
  });
});
