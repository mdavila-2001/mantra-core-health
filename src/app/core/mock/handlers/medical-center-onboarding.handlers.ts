import { conflict, forbidden, notFound, reply, unauthorized, type MockRouter } from '../mock-router';
import { TENANT_NAMES } from '../mock-session';
import { Coleccion, cuerpo, uuid } from '../mock-store';

/* ============================================================================
    Alta de la práctica y la primera sede de una organización verificada
    (`POST /tenants/:tenantId/practices`, CM-11).

    Responde con las reglas de la API real: 401 sin sesión, 403 si la sesión no
    administra **esa** organización, 404 si no existe, 422 si todavía no está
    verificada, 409 si ya tiene una práctica con ese nombre y 400 con
    coordenadas fuera de rango.
    ========================================================================== */

/** La clínica del fixture del directorio que sigue pendiente de verificación. */
export const UNVERIFIED_TENANT_ID = uuid('tenant-clinica-nueva');

interface MockPractice {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
}

const practicas = new Coleccion<MockPractice>([]);

/** Mismo criterio que la API para derivar el código de la práctica del nombre. */
function practiceCodeFromName(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return base || 'CENTRO-MEDICO';
}

function invalido(mensajes: readonly string[]) {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    error: 'Bad Request',
    details: { messages: mensajes },
  });
}

/** Registra la ruta nueva en el router del simulador. */
export function registerOrganizationPracticeHandlers(router: MockRouter): void {
  router.post('/tenants/:tenantId/practices', (request) => {
    const tenantId = request.params['tenantId']!;
    const user = request.user;
    if (user === null) return unauthorized('No autenticado');

    const esPlataforma = user.roles.includes('SECURITY_ADMIN') || user.roles.includes('SUPERADMIN');
    if (!esPlataforma && !user.tenants.includes(tenantId)) {
      return forbidden('Se requiere ser OWNER o ADMIN de la organización, o administrador de la plataforma');
    }

    const conocida = tenantId in TENANT_NAMES || tenantId === UNVERIFIED_TENANT_ID;
    if (!conocida) return notFound('Organización no encontrada');

    const datos = cuerpo<{
      name?: string;
      site?: {
        name?: string;
        addressText?: string;
        latitude?: number;
        longitude?: number;
        cityText?: string;
      };
    }>(request);

    const mensajes: string[] = [];
    if (!datos.name || datos.name.length < 2) mensajes.push('name must be longer than or equal to 2 characters');
    const site = datos.site;
    if (site === undefined) {
      mensajes.push('site should not be null or undefined');
    } else {
      if (!site.name || site.name.length < 2) mensajes.push('site.name must be longer than or equal to 2 characters');
      if (!site.addressText || site.addressText.length < 2) {
        mensajes.push('site.addressText must be longer than or equal to 2 characters');
      }
      if (typeof site.latitude !== 'number') {
        mensajes.push('site.latitude must be a number');
      } else if (site.latitude < -90 || site.latitude > 90) {
        mensajes.push('site.latitude must not be greater than 90');
      }
      if (typeof site.longitude !== 'number') {
        mensajes.push('site.longitude must be a number');
      } else if (site.longitude < -180 || site.longitude > 180) {
        mensajes.push('site.longitude must not be greater than 180');
      }
    }
    if (mensajes.length > 0) return invalido(mensajes);

    if (tenantId === UNVERIFIED_TENANT_ID) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'La organización todavía no fue verificada',
        error: 'Unprocessable Entity',
        details: { tenantId },
      });
    }

    const code = practiceCodeFromName(datos.name!);
    if (practicas.filtrar((p) => p.tenantId === tenantId && p.code === code).length > 0) {
      return conflict('La organización ya tiene una práctica con ese nombre', { tenantId });
    }

    const practiceId = uuid(`practica-${tenantId}-${code}`);
    practicas.agregar({ id: practiceId, tenantId, code });
    return reply(201, {
      practiceId,
      practiceSiteId: uuid(`sede-${tenantId}-${code}-${practiceCodeFromName(site!.name!)}`),
    });
  });
}
