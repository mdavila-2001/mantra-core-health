import type { IpAccessRule } from './support-access.types';

/**
 * Lógica pura de las **reglas de red de la organización** (`/org/ip-access-rules`):
 * leer un CIDR, decidir si una dirección cae en un rango y evaluar un conjunto de
 * reglas igual que la API (`iam/domain/network-rules.ts`).
 *
 * La API es la autoridad: guarda, rechaza (`IP_RULE_CIDR_INVALID`,
 * `IP_RULE_VALIDITY_INVALID`, `IP_RULES_WOULD_LOCK_OUT_ACTOR`) y hace cumplir en
 * cada ingreso. Esto existe para **explicar antes de guardar**: validar el rango
 * mientras se escribe y mostrar, en una vista previa, qué pasaría con una
 * dirección. Sin dependencias ni Angular: usa `bigint`, que cubre IPv4 e IPv6.
 */

/** Cuántas reglas admite la API como máximo (`PutIpAccessRulesDto`). */
export const MAX_IP_RULES = 50;
/** Largo máximo del rango y de la descripción, como el DTO de la API. */
export const MAX_CIDR_LENGTH = 64;
export const MAX_RULE_DESCRIPTION = 200;

type Family = 'ipv4' | 'ipv6';

interface ParsedAddress {
  readonly family: Family;
  readonly value: bigint;
}

const MAPEADA = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

function parseIpv4(texto: string): bigint | null {
  const partes = texto.split('.');
  if (partes.length !== 4) return null;
  let valor = 0n;
  for (const parte of partes) {
    // Sin ceros a la izquierda: `010` es ambiguo (¿octal?) y la API tampoco lo acepta.
    if (!/^(0|[1-9]\d{0,2})$/.test(parte)) return null;
    const octeto = Number(parte);
    if (octeto > 255) return null;
    valor = (valor << 8n) | BigInt(octeto);
  }
  return valor;
}

function parseIpv6(texto: string): bigint | null {
  if (texto === '' || texto.includes(':::') || (texto.match(/::/g) ?? []).length > 1) return null;
  let cuerpo = texto;
  // Una IPv4 incrustada al final ocupa los dos últimos grupos (`::ffff:1.2.3.4`, `64:ff9b::1.2.3.4`).
  const corte = cuerpo.lastIndexOf(':');
  const ultimo = cuerpo.slice(corte + 1);
  if (ultimo.includes('.')) {
    const v4 = parseIpv4(ultimo);
    if (v4 === null) return null;
    cuerpo = `${cuerpo.slice(0, corte + 1)}${((v4 >> 16n) & 0xffffn).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }
  const hayAbreviatura = cuerpo.includes('::');
  const [izquierda, derecha] = hayAbreviatura ? (cuerpo.split('::') as [string, string]) : [cuerpo, ''];
  const grupos = (parte: string): string[] | null => {
    if (parte === '') return [];
    const lista = parte.split(':');
    return lista.every((g) => /^[0-9a-f]{1,4}$/i.test(g)) ? lista : null;
  };
  const antes = grupos(izquierda);
  const despues = grupos(derecha);
  if (antes === null || despues === null) return null;
  const total = antes.length + despues.length;
  if (hayAbreviatura ? total > 7 : total !== 8) return null;
  const todos = [...antes, ...Array<string>(8 - total).fill('0'), ...despues];
  let valor = 0n;
  for (const g of todos) valor = (valor << 16n) | BigInt(parseInt(g, 16));
  return valor;
}

/**
 * Deja una dirección en su forma comparable: sin corchetes ni zona, y una IPv4
 * mapeada en IPv6 (`::ffff:1.2.3.4`) como IPv4. `null` si no es una IP válida.
 */
export function parseIp(raw: string | null | undefined): ParsedAddress | null {
  if (raw === null || raw === undefined) return null;
  let ip = raw.trim();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  const zona = ip.indexOf('%');
  if (zona >= 0) ip = ip.slice(0, zona);
  const mapeada = MAPEADA.exec(ip);
  if (mapeada?.[1] !== undefined) ip = mapeada[1];
  if (ip.includes(':')) {
    const valor = parseIpv6(ip);
    return valor === null ? null : { family: 'ipv6', value: valor };
  }
  const valor = parseIpv4(ip);
  return valor === null ? null : { family: 'ipv4', value: valor };
}

export interface ParsedCidr extends ParsedAddress {
  readonly prefix: number;
}

/**
 * Descompone `dirección/prefijo`. El prefijo es obligatorio —`190.129.0.0` solo es
 * inválido; para una máquina se escribe `/32`— y va de 0 a 32 (IPv4) o 0 a 128 (IPv6).
 */
export function parseCidr(texto: string): ParsedCidr | null {
  if (texto.length > MAX_CIDR_LENGTH) return null;
  const partes = texto.trim().split('/');
  if (partes.length !== 2) return null;
  const [direccion, prefijoTexto] = partes as [string, string];
  if (direccion === '' || !/^\d{1,3}$/.test(prefijoTexto)) return null;
  const analizada = parseIp(direccion);
  if (analizada === null) return null;
  const prefix = Number(prefijoTexto);
  if (prefix > (analizada.family === 'ipv4' ? 32 : 128)) return null;
  return { ...analizada, prefix };
}

export function isValidCidr(texto: string): boolean {
  return parseCidr(texto) !== null;
}

/** ¿Cae la dirección en el rango? Un rango o una dirección inválidos no coinciden. */
export function matchesCidr(ip: string, cidr: string): boolean {
  const direccion = parseIp(ip);
  const rango = parseCidr(cidr);
  if (direccion === null || rango === null || direccion.family !== rango.family) return false;
  const bits = rango.family === 'ipv4' ? 32 : 128;
  const sobrantes = BigInt(bits - rango.prefix);
  return direccion.value >> sobrantes === rango.value >> sobrantes;
}

/** Veredicto de las reglas sobre un origen. */
export type NetworkVerdict = 'ALLOWED' | 'DENIED' | 'NO_RULES';

/** Lo que la evaluación necesita de una regla. */
export type IpRuleFacts = Pick<IpAccessRule, 'type' | 'cidr'>;

/**
 * Una regla `DENY` que coincide niega siempre; si hay reglas `ALLOW`, el origen
 * debe caer en alguna; sin reglas no hay restricción. Un origen que no se puede
 * leer se niega cuando hay reglas: ante la duda, se niega. Es la regla de la API.
 */
export function evaluateIpRules(ip: string | null | undefined, rules: readonly IpRuleFacts[]): NetworkVerdict {
  if (rules.length === 0) return 'NO_RULES';
  if (parseIp(ip) === null) return 'DENIED';
  const origen = ip as string;
  if (rules.some((r) => r.type === 'DENY' && matchesCidr(origen, r.cidr))) return 'DENIED';
  const permitidas = rules.filter((r) => r.type === 'ALLOW');
  if (permitidas.length === 0) return 'ALLOWED';
  return permitidas.some((r) => matchesCidr(origen, r.cidr)) ? 'ALLOWED' : 'DENIED';
}

/** ¿Rige la regla en este instante? Sin fechas rige siempre. */
export function isRuleActive(rule: Pick<IpAccessRule, 'validFrom' | 'validTo'>, now: Date = new Date()): boolean {
  const desde = rule.validFrom === undefined || rule.validFrom === '' ? null : new Date(rule.validFrom);
  const hasta = rule.validTo === undefined || rule.validTo === '' ? null : new Date(rule.validTo);
  return (desde === null || desde.getTime() <= now.getTime()) && (hasta === null || hasta.getTime() > now.getTime());
}

/** Lo que rige ahora de un conjunto de reglas: las vigentes, sin las que aún no empiezan o ya vencieron. */
export function activeRules(rules: readonly IpAccessRule[], now: Date = new Date()): readonly IpAccessRule[] {
  return rules.filter((r) => isRuleActive(r, now));
}

/** Un problema de una regla, atado al renglón y al campo para pintarlo donde corresponde. */
export interface IpRuleProblem {
  readonly index: number;
  readonly field: 'cidr' | 'validity' | 'description';
  readonly message: string;
}

/**
 * Valida las reglas **antes** de mandarlas, con las mismas condiciones que la API
 * (`IP_RULE_CIDR_INVALID`, `IP_RULE_VALIDITY_INVALID`) y sus topes. Quien decide es
 * la API; esto evita el viaje y dice el problema junto al renglón.
 */
export function validateIpRules(rules: readonly IpAccessRule[]): readonly IpRuleProblem[] {
  const problemas: IpRuleProblem[] = [];
  rules.forEach((regla, index) => {
    const cidr = regla.cidr.trim();
    if (cidr === '') {
      problemas.push({ index, field: 'cidr', message: 'Escriba el rango de red.' });
    } else if (!isValidCidr(cidr)) {
      problemas.push({
        index,
        field: 'cidr',
        message: cidr.includes('/')
          ? 'Ese rango no es válido. Ejemplos: 190.129.0.0/16 o 203.0.113.7/32.'
          : 'Falta la barra y el número del final. Para una sola dirección use /32, por ejemplo 203.0.113.7/32.',
      });
    }
    const desde = regla.validFrom === undefined || regla.validFrom === '' ? null : new Date(regla.validFrom);
    const hasta = regla.validTo === undefined || regla.validTo === '' ? null : new Date(regla.validTo);
    if (desde !== null && hasta !== null && hasta.getTime() <= desde.getTime()) {
      problemas.push({ index, field: 'validity', message: 'La regla termina antes de empezar: la fecha final tiene que ser posterior.' });
    }
    if ((regla.description ?? '').length > MAX_RULE_DESCRIPTION) {
      problemas.push({ index, field: 'description', message: `La descripción admite hasta ${MAX_RULE_DESCRIPTION} caracteres.` });
    }
  });
  return problemas;
}
