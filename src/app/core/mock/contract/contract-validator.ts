import { CONTRACT_ROUTES, CONTRACT_SCHEMAS } from './api-contract.generated';
import type { ContractSchema, ContractViolation } from './contract.types';
import { SIMULATOR_EXTENSIONS } from './simulator-extensions';

/* ============================================================================
    La maqueta valida el cuerpo como la API: `forbidNonWhitelisted`.

    Una clave que el DTO no declara, o un obligatorio que falta, es un 400 con
    el mismo cuerpo que arma `validationFailed` en la API
    (`src/common/http/validation-pipe.ts`). Sin esto, una pantalla que manda de
    más pasaba verde en `mockup` y fallaba recién contra la API real —el
    informe B de deriva de contratos contó 15 roturas así—.

    Lo que no valida, a propósito:
    - Rutas que la API no publica: no hay contrato contra el cual comparar.
      Esas las declara `simulatorOnly()` en el cliente.
    - Tipos y formatos (`IsUUID`, `MaxLength`…): el `openapi.json` los trae a
      medias y adivinarlos daría 400 falsos. Sólo claves y obligatorios.
    - Cuerpos que no son un objeto (`FormData`, `null`, un arreglo suelto).
    ========================================================================== */

/** La restricción que la API usa para una clave no declarada. */
export const UNKNOWN_PROPERTY = 'whitelistValidation';

interface CompiledRoute {
  readonly segments: readonly string[];
  readonly schema: string;
  readonly literals: number;
  readonly key: string;
}

const byMethod = new Map<string, CompiledRoute[]>();
for (const [method, pattern, schema] of CONTRACT_ROUTES) {
  const segments = pattern.split('/').filter((s) => s !== '');
  const list = byMethod.get(method) ?? [];
  list.push({
    segments,
    schema,
    literals: segments.filter((s) => !s.startsWith(':')).length,
    key: `${method} ${pattern}`,
  });
  byMethod.set(method, list);
}

function routeFor(method: string, path: string): CompiledRoute | null {
  const actual = path
    .split('?')[0]!
    .split('/')
    .filter((s) => s !== '');
  let best: CompiledRoute | null = null;
  for (const route of byMethod.get(method) ?? []) {
    if (route.segments.length !== actual.length) continue;
    const fits = route.segments.every((s, i) => s.startsWith(':') || s === actual[i]);
    if (fits && (best === null || route.literals > best.literals)) best = route;
  }
  return best;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function check(
  body: Record<string, unknown>,
  schema: ContractSchema,
  prefix: string,
  extensions: readonly string[],
  out: ContractViolation[],
): void {
  if (schema.open) return;
  for (const [key, value] of Object.entries(body)) {
    // `undefined` no viaja en el JSON: no es una clave para la API.
    if (value === undefined) continue;
    if (!schema.keys.includes(key)) {
      if (!extensions.includes(key)) {
        out.push({
          field: prefix + key,
          constraints: [UNKNOWN_PROPERTY],
          messages: [`property ${key} should not exist`],
        });
      }
      continue;
    }
    const nestedName = schema.nested?.[key];
    const nested = nestedName === undefined ? undefined : CONTRACT_SCHEMAS[nestedName];
    if (nested === undefined) continue;
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item, i) => {
      if (isPlainObject(item)) {
        check(item, nested, `${prefix}${key}${Array.isArray(value) ? `.${i}` : ''}.`, [], out);
      }
    });
  }
  for (const key of schema.required) {
    if (body[key] === undefined) {
      out.push({
        field: prefix + key,
        constraints: ['isDefined'],
        messages: [`${key} should not be null or undefined`],
      });
    }
  }
}

/**
 * Lo que la API rechazaría de este cuerpo, o una lista vacía si lo acepta.
 *
 * @returns `null` si la ruta no está en el contrato (sólo existe en el
 *   simulador) o el cuerpo no es un objeto: no hay nada contra qué validar.
 */
export function contractViolations(
  method: string,
  path: string,
  body: unknown,
): ContractViolation[] | null {
  const route = routeFor(method, path);
  if (route === null || !isPlainObject(body)) return null;
  const schema = CONTRACT_SCHEMAS[route.schema];
  if (schema === undefined) return null;
  const out: ContractViolation[] = [];
  check(body, schema, '', SIMULATOR_EXTENSIONS[route.key] ?? [], out);
  return out;
}

/** El 400 que contesta la API, con `details.violations` y `details.fields`. */
export function validationFailedBody(violations: readonly ContractViolation[]): unknown {
  return {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Error de validación',
    details: {
      violations: violations.flatMap(({ field, messages }) => {
        const parent = field.includes('.') ? field.slice(0, field.lastIndexOf('.')) : '';
        return messages.map((m) => (parent ? `${parent}.${m}` : m));
      }),
      fields: violations,
    },
  };
}
