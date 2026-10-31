import { Coleccion, ahora, uuid } from '../mock-store';
import type { MockUser } from '../mock-session';

/* ============================================================================
    Los factores de segundo paso del simulador.

    Viven aparte de las rutas para que el inicio de sesión (que decide si pide el
    código o avisa `mfaEnrollmentRequired`) y las rutas de la propia cuenta
    (`/iam/me/mfa`) lean lo mismo sin importarse entre sí. El estado sobrevive a
    F5: lo que una persona activa lo ve el siguiente inicio de sesión.
   ========================================================================== */

export interface FilaFactor {
  readonly id: string;
  readonly userId: string;
  readonly type: 'TOTP';
  readonly state: 'PENDING' | 'VERIFIED' | 'REVOKED';
  readonly label: string;
  /** El secreto en base32. La API lo cifra y solo lo devuelve al crear el factor. */
  readonly secret: string;
  readonly verifiedAt?: string;
  readonly createdAt: string;
}

/** El código que el simulador da por bueno: no hay una aplicación autenticadora de verdad. */
export const CODIGO_DE_PRUEBA = '123456';

/** Cuentas demo que ya traen el segundo paso activado. El resto lo puede activar en «Verificación en dos pasos». */
const CON_DOS_PASOS: readonly string[] = ['ana', 'lucia', 'perez', 'hospital_piloto'];

export const factores = new Coleccion<FilaFactor>([]).persistirEn('mock.iam.factores');

/** Las cuentas demo con dos pasos arrancan con su factor, una sola vez. */
function sembrar(user: MockUser): void {
  if (!CON_DOS_PASOS.includes(user.key)) return;
  const id = uuid(`factor-${user.key}`);
  if (factores.has(id) || factores.filtrar((f) => f.userId === user.id).length > 0) return;
  factores.agregar({
    id,
    userId: user.id,
    type: 'TOTP',
    state: 'VERIFIED',
    label: 'Teléfono personal',
    secret: 'JBSWY3DPEHPK3PXP',
    verifiedAt: ahora(),
    createdAt: ahora(),
  });
}

/** Los factores de la cuenta que no se retiraron. */
export function factoresDe(user: MockUser): FilaFactor[] {
  sembrar(user);
  return factores
    .filtrar((f) => f.userId === user.id && f.state !== 'REVOKED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** ¿Tiene al menos un factor confirmado? */
export function tieneFactorConfirmado(user: MockUser): boolean {
  return factoresDe(user).some((f) => f.state === 'VERIFIED');
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Un secreto como el de la API: 160 bits en base32 (32 caracteres). */
export function secretoNuevo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let secreto = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) secreto += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return secreto;
}
