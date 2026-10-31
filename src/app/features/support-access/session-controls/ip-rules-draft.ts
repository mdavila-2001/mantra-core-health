import type { IpAccessRule, IpRuleType } from '../../../core/data-access/support-access/support-access.types';

/**
 * El borrador de las reglas de red mientras se edita: lógica pura con su spec.
 *
 * Cada renglón lleva un `uid` propio (la API identifica las reglas al leerlas pero
 * `PUT` las **reemplaza** todas, así que el id no sirve para seguir un renglón que
 * todavía no se guardó) y las fechas como instantes ISO, que es lo que habla la
 * API. La pantalla las muestra como días; el instante original **no se toca**
 * hasta que la persona cambia el día, para que guardar no reescriba una vigencia
 * que se definió con otra hora desde fuera de esta pantalla.
 */
export interface RuleDraft {
  readonly uid: string;
  readonly type: IpRuleType;
  readonly cidr: string;
  readonly description: string;
  readonly validFrom?: string;
  readonly validTo?: string;
}

let contador = 0;

export function nextUid(): string {
  contador += 1;
  return `regla-${contador}`;
}

export function draftsOf(reglas: readonly IpAccessRule[]): readonly RuleDraft[] {
  return reglas.map((r) => ({
    uid: nextUid(),
    type: r.type,
    cidr: r.cidr,
    description: r.description ?? '',
    ...(r.validFrom === undefined || r.validFrom === null || r.validFrom === '' ? {} : { validFrom: r.validFrom }),
    ...(r.validTo === undefined || r.validTo === null || r.validTo === '' ? {} : { validTo: r.validTo }),
  }));
}

/** Lo que se manda a la API: sin espacios sobrantes y sin campos vacíos (el DTO rechaza una fecha vacía). */
export function rulesOf(borrador: readonly RuleDraft[]): readonly IpAccessRule[] {
  return borrador.map((r) => ({
    type: r.type,
    cidr: r.cidr.trim(),
    ...(r.description.trim() === '' ? {} : { description: r.description.trim() }),
    ...(r.validFrom === undefined ? {} : { validFrom: r.validFrom }),
    ...(r.validTo === undefined ? {} : { validTo: r.validTo }),
  }));
}

function normalizada(r: IpAccessRule): string {
  return JSON.stringify([r.type, r.cidr.trim(), (r.description ?? '').trim(), r.validFrom ?? '', r.validTo ?? '']);
}

/** ¿Es el mismo conjunto, en el mismo orden? La API devuelve las reglas en el orden en que se guardaron. */
export function sameRules(a: readonly IpAccessRule[], b: readonly IpAccessRule[]): boolean {
  return a.length === b.length && a.every((regla, i) => normalizada(regla) === normalizada(b[i] as IpAccessRule));
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` de un instante, en la hora local (la que ve la persona). */
function localDay(fecha: Date): string {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/** El día en que empieza la vigencia (`validFrom`), para mostrarlo en el selector. */
export function startDayOf(iso: string | undefined): string {
  if (iso === undefined) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : localDay(fecha);
}

/**
 * El último día en que rige (`validTo` es exclusivo: «hasta el 30» se guarda como
 * el 31 a las 00:00), para mostrarlo en el selector.
 */
export function endDayOf(iso: string | undefined): string {
  if (iso === undefined) return '';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : localDay(new Date(fecha.getTime() - 1));
}

/** El instante en que empieza ese día (medianoche local), o `undefined` si se vació el campo. */
export function startIsoOf(dia: string): string | undefined {
  if (!DIA.test(dia)) return undefined;
  return new Date(`${dia}T00:00:00`).toISOString();
}

/** El instante en que termina ese día: la medianoche siguiente, para que el día elegido rija completo. */
export function endIsoOf(dia: string): string | undefined {
  if (!DIA.test(dia)) return undefined;
  const fecha = new Date(`${dia}T00:00:00`);
  fecha.setDate(fecha.getDate() + 1);
  return fecha.toISOString();
}
