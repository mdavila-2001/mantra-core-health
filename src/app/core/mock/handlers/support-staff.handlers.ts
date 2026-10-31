import { validation, type MockRouter } from '../mock-router';
import { MOCK_USERS } from '../mock-session';
import { cuerpo, nuevoId, uuid } from '../mock-store';
import { cuentas, fallo, SUPPORT_STAFF } from './support-staff.store';

/* ============================================================================
    El alta de la secretaria (personal de apoyo): `POST /iam/auth/register-support-staff`.

    Pedir y aceptar vínculos con hospitales y doctores lo resuelven los
    manejadores de `support-access`. Mismas formas que el contrato de la API.
    ========================================================================== */

export function registrarPersonalDeApoyo(router: MockRouter): void {
  router.post('/iam/auth/register-support-staff', ({ body }) => {
    const datos = cuerpo<{ email?: string; nationalId?: string; name?: string; middleName?: string; lastName?: string; motherLastName?: string; password?: string }>({ body });
    if (!datos.email || !datos.nationalId || !datos.name || !datos.lastName || !datos.password) {
      return validation('Faltan datos obligatorios', [{ field: 'nationalId', message: 'Complete los datos obligatorios.' }]);
    }
    const email = datos.email.trim().toLocaleLowerCase('es');
    const nationalId = datos.nationalId.trim();
    const repetida = MOCK_USERS.some((u) => u.nationalId === nationalId) || cuentas.todos().some((c) => c.nationalId === nationalId);
    if (repetida) return fallo(409, 'Ya existe una cuenta con ese documento', 'NATIONAL_ID_ALREADY_REGISTERED');
    const id = nuevoId('user-apoyo');
    const nombre = [datos.name, datos.middleName, datos.lastName, datos.motherLastName].filter((p) => p !== undefined && p.trim() !== '').join(' ');
    const personId = uuid(`person-${id}`);
    cuentas.agregar({ id, key: `apoyo-${nationalId}`, email, nationalId, displayName: nombre, personId });
    return { status: 201, body: { userId: id, personId, supportProfileId: uuid(`apoyo-perfil-${id}`), role: SUPPORT_STAFF, emailVerificationSent: true } };
  });
}
