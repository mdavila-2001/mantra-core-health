import type { MyNetwork } from '../../../core/data-access/iam/iam-new-device';
import type { IpAccessRule } from '../../../core/data-access/support-access/support-access.types';

/**
 * Lo que la pestaña de redes hace con `GET /iam/me/network`: la regla que propone «Usar mi IP» y los avisos sobre cómo
 * está configurado el servidor. Lógica pura, con su spec.
 */

/** La regla que deja pasar **solo esta conexión**: `/32` para IPv4 y `/128` para IPv6. `null` si la API no la pudo leer. */
export function ruleForMyIp(network: MyNetwork): IpAccessRule | null {
  if (network.ip === null) return null;
  const longitud = network.family === 'ipv6' ? 128 : 32;
  return { type: 'ALLOW', cidr: `${network.ip}/${longitud}`, description: 'Mi conexión actual' };
}

/** ¿Es una dirección interna (loopback, privada, de enlace local)? Detrás de un proxy sin configurar, es la que se ve. */
export function isInternalAddress(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (v4 !== null) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  const bajo = ip.toLowerCase();
  return bajo === '::1' || bajo === '::' || bajo.startsWith('fc') || bajo.startsWith('fd') || bajo.startsWith('fe80');
}

/**
 * El aviso sobre la configuración del servidor, o `null` si todo parece en orden:
 *
 * - **0 saltos de proxy**: el servidor no confía en ningún proxy. Si está detrás de uno (casi siempre en producción), ve la
 *   dirección del proxy en lugar de la de quien entra, y una regla de red hecha con la de la sede no coincidiría nunca.
 * - **dirección interna** (privada o local): es lo que se ve cuando el proxy no está configurado, no una red de sede.
 * - **sin dirección legible**: no hay con qué comparar y toda regla de red dejaría afuera.
 */
export function networkWarning(network: MyNetwork): string | null {
  if (network.ip === null) {
    return 'El servidor no pudo leer la dirección de esta conexión, así que no podría comparar ninguna regla de red. No exija la red hasta que quien administra el servidor lo revise.';
  }
  if (isInternalAddress(network.ip)) {
    return `El servidor ve esta conexión como ${network.ip}, una dirección interna: lo normal cuando está detrás de un proxy que no tiene configurado. Una regla con la red de su sede no coincidiría nunca. Pida a quien administra el servidor que configure los saltos de proxy de confianza.`;
  }
  if (network.trustProxyHops === 0) {
    return 'El servidor no tiene configurado ningún proxy de confianza (0 saltos). Si está detrás de un proxy o balanceador, ve la dirección de ese equipo y no la de quien entra: antes de exigir la red, confirme que la dirección de arriba es la de su sede.';
  }
  return null;
}
