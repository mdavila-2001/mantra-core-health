import { reply, type MockReply } from '../mock-router';
import { resolverCuentasDeApoyo, TENANT_NAMES, type MockUser } from '../mock-session';
import { Coleccion } from '../mock-store';

/* ============================================================================
    Las cuentas de las secretarias dadas de alta en la maqueta. Las rutas viven en
    `support-staff.handlers.ts`; los vínculos con hospitales y doctores, en los
    manejadores de `support-access`.
    ========================================================================== */

export const SUPPORT_STAFF = 'SUPPORT_STAFF';

export interface Cuenta {
  readonly id: string;
  readonly key: string;
  readonly email: string;
  readonly nationalId: string;
  readonly displayName: string;
  readonly personId: string;
}

/** Un error con su motivo, como lo devuelve la API: en `reason` y en `code`. */
export function fallo(status: number, message: string, reason: string): MockReply {
  return reply(status, { statusCode: status, code: reason, reason, message, details: { reason } });
}

export const cuentas = new Coleccion<Cuenta>([], 'mock:apoyo:cuentas');

/** La cuenta de una secretaria: `SUPPORT_STAFF` desde el alta, sin organizaciones. */
export function cuentaSimulada(cuenta: Cuenta): MockUser {
  return {
    key: cuenta.key,
    id: cuenta.id,
    email: cuenta.email,
    nationalId: cuenta.nationalId,
    displayName: cuenta.displayName,
    roles: ['USER', SUPPORT_STAFF],
    tenants: [],
    tenantNames: TENANT_NAMES,
    personId: cuenta.personId,
    accountKind: 'PERSON',
  };
}

resolverCuentasDeApoyo(({ identificador, id, key }) => {
  const cuenta = cuentas
    .todos()
    .find(
      (c) =>
        (identificador !== undefined &&
          (c.email === identificador || c.nationalId === identificador || c.key === identificador.replace(/@.*$/, ''))) ||
        (id !== undefined && c.id === id) ||
        (key !== undefined && c.key === key),
    );
  return cuenta === undefined ? undefined : cuentaSimulada(cuenta);
});
