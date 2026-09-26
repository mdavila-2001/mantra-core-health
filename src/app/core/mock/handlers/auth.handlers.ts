import { ESTADO, TIPO_SOCIETARIO } from '../fixtures/conceptos';
import { pacientes, type PacienteSimulado } from '../fixtures/personas';
import { conflict, notFound, preconditionFailed, reply, unauthorized, type MockRouter } from '../mock-router';
import type { MockUser as CuentaSimulada } from '../mock-session';
import {
  buscarUsuario,
  emitirAccessToken,
  emitirRefreshToken,
  expiracion,
  MOCK_USERS,
  resolverCuentasDePacientes,
  TENANT_NAMES,
  TENANT_PLATAFORMA,
  usuarioDeRefreshToken,
  type MockUser,
} from '../mock-session';
import { ahora, contiene, cuerpo, iso, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    IAM: sesión, altas y usuarios.
    ========================================================================== */

/**
 * Los cinco campos del bloque `legalDocuments` (subtarea 1.2), en el mismo
 * orden que el registro de procesos: Constitución · NIT · SEPREC · licencia
 * · SEDES.
 */
const LEGAL_DOCUMENT_FIELDS = [
  'constitutionFileId',
  'taxIdentifierFileId',
  'commerceRegistryFileId',
  'operatingLicenseFileId',
  'healthAuthorityCertificateFileId',
] as const;

/** Espejo de `FILE_STORAGE_MAX_SIZE_BYTES` de la API (10 MiB por archivo). */
const MAX_REGISTRATION_DOCUMENT_BYTES = 10 * 1024 * 1024;

interface LoginBody {
  email?: string;
  nationalId?: string;
  password?: string;
}

function sesionDe(user: NonNullable<ReturnType<typeof buscarUsuario>>) {
  return {
    accessToken: emitirAccessToken(user),
    refreshToken: emitirRefreshToken(user),
    expiresAt: expiracion(),
  };
}

interface UsuarioListado {
  readonly id: string;
  readonly displayName: string;
  readonly statusConceptId: string;
  readonly emailVerified: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

const usuariosAdicionales: UsuarioListado[] = [
  ['Jorge Luis Mamani Choque', -300, -1],
  ['Patricia Vargas Salinas', -220, -3],
  ['Rodrigo Suárez Paz', -180, -7],
  ['Daniela Quispe Flores', -95, -2],
  ['Luis Fernando Arce Roca', -60, null],
  ['Gabriela Montaño Rivera', -30, -1],
  ['Sergio Pinto Guzmán', -12, null],
].map(([nombre, creado, ultimo], i) => ({
  id: uuid(`user-extra-${i}`),
  displayName: nombre as string,
  statusConceptId: ultimo === null ? ESTADO['ST-PENDING']! : ESTADO['ST-ACTIVE']!,
  emailVerified: ultimo !== null,
  lastLoginAt: ultimo === null ? null : iso(ultimo as number, 10),
  createdAt: iso(creado as number, 8),
}));

/**
 * La cuenta de un paciente del padrón: entra con su CI, como las de prueba.
 *
 * Sin esto la única cuenta de paciente era la de demostración, y una solicitud
 * de dependiente no tenía quién la aceptara. Un paciente sin correo es un
 * dependiente dado de alta sin cuenta: no entra.
 */
function cuentaDe(p: PacienteSimulado): MockUser {
  return {
    key: `paciente-${p.nationalId}`,
    id: p.userId,
    email: p.email,
    nationalId: p.nationalId,
    displayName: p.displayName,
    roles: ['PATIENT'],
    tenants: [TENANT_PLATAFORMA],
    tenantNames: TENANT_NAMES,
    patientProfileId: p.id,
    personId: p.personId,
  };
}

resolverCuentasDePacientes(({ identificador, id, key }) => {
  const p = pacientes
    .todos()
    .find(
      (c) =>
        c.email !== '' &&
        !c.deceased &&
        ((identificador !== undefined && c.nationalId === identificador) ||
          (id !== undefined && c.userId === id) ||
          (key !== undefined && `paciente-${c.nationalId}` === key)),
    );
  return p === undefined ? undefined : cuentaDe(p);
});

/* ---- seguridad de la propia cuenta (ID-24) --------------------------------- */

interface SesionSimulada {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ip: string;
  current: boolean;
}

/**
 * Con qué contraseña entró cada cuenta en esta sesión del simulador: el login
 * acepta cualquiera, así que «la actual» es la última con la que se entró. Sin
 * registro (sesión restaurada por refresh) se acepta la que se escriba.
 */
const contrasenaVigente = new Map<string, string>();

const sesionesPorUsuario = new Map<string, SesionSimulada[]>();

/** Las sesiones abiertas de una cuenta: la actual y otra desde otro equipo. */
function sesionesDe(user: CuentaSimulada): SesionSimulada[] {
  const existentes = sesionesPorUsuario.get(user.id);
  if (existentes !== undefined) return existentes;
  const nuevas: SesionSimulada[] = [
    { id: uuid(`sesion-${user.key}-actual`), createdAt: iso(0, 9), expiresAt: iso(30, 9), ip: '190.129.10.4', current: true },
    { id: uuid(`sesion-${user.key}-otra`), createdAt: iso(-2, 18), expiresAt: iso(28, 18), ip: '181.115.22.87', current: false },
  ];
  sesionesPorUsuario.set(user.id, nuevas);
  return nuevas;
}

function unprocessable(message: string, reason: string) {
  return reply(422, {
    statusCode: 422,
    code: 'PRECONDITION_FAILED',
    message,
    error: 'Unprocessable Entity',
    details: { reason },
  });
}

export function registrarAuth(router: MockRouter): void {
  router.post('/iam/auth/change-password', ({ body, user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const datos = cuerpo<{ currentPassword?: string; newPassword?: string }>({ body });
    const vigente = contrasenaVigente.get(user.id);
    if ((datos.currentPassword ?? '') === '' || (vigente !== undefined && datos.currentPassword !== vigente)) {
      return unprocessable('La contraseña actual no coincide', 'CURRENT_PASSWORD_INVALID');
    }
    if (datos.currentPassword === datos.newPassword) {
      return unprocessable('La contraseña nueva tiene que ser distinta de la actual', 'PASSWORD_UNCHANGED');
    }
    const sesiones = sesionesDe(user);
    const otras = sesiones.filter((s) => !s.current);
    sesionesPorUsuario.set(user.id, sesiones.filter((s) => s.current));
    contrasenaVigente.set(user.id, datos.newPassword ?? '');
    return { revokedSessions: otras.length };
  });

  router.get('/iam/me/sessions', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    return sesionesDe(user);
  });

  router.post('/iam/me/sessions/:id/revoke', ({ params, user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const sesiones = sesionesDe(user);
    if (!sesiones.some((s) => s.id === params['id'])) {
      return notFound('Sesión no encontrada');
    }
    sesionesPorUsuario.set(user.id, sesiones.filter((s) => s.id !== params['id']));
    return { revoked: true };
  });

  router.post('/iam/auth/logout-all', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const cantidad = sesionesDe(user).length;
    sesionesPorUsuario.set(user.id, []);
    return { revokedSessions: cantidad };
  });

  router.post('/iam/auth/login', ({ body }) => {
    const datos = cuerpo<LoginBody>({ body });
    const identificador = datos.email ?? datos.nationalId ?? '';
    const user = buscarUsuario(identificador);
    if (user === undefined || (datos.password ?? '') === '') {
      return unauthorized('Credenciales inválidas. Probá con una de las cuentas de prueba.');
    }
    contrasenaVigente.set(user.id, datos.password ?? '');
    return sesionDe(user);
  });

  router.post('/iam/auth/token/refresh', ({ body }) => {
    const datos = cuerpo<{ refreshToken?: string }>({ body });
    const user = usuarioDeRefreshToken(datos.refreshToken ?? '');
    if (user === undefined) return unauthorized('La sesión venció');
    return sesionDe(user);
  });

  router.post('/iam/auth/logout', () => ({ ok: true }));

  router.post('/iam/auth/register-patient', ({ body }) => {
    const datos = cuerpo<{ email?: string; name?: string; lastName?: string }>({ body });
    if (datos.email !== undefined && MOCK_USERS.some((u) => u.email === datos.email)) {
      return conflict('Ya existe una cuenta con ese correo', { email: datos.email });
    }
    const id = nuevoId('paciente-nuevo');
    return {
      userId: id,
      personId: uuid(`person-${id}`),
      patientProfileId: uuid(`pid-${id}`),
      patientCode: `PAC-${Math.floor(Math.random() * 90000 + 10000)}`,
      status: 'PENDING_VERIFICATION',
      emailVerificationSent: true,
    };
  });

  router.post('/iam/auth/register-practitioner', ({ body }) => {
    const datos = cuerpo<{ email?: string; photoFileId?: string }>({ body });
    if (datos.email !== undefined && MOCK_USERS.some((u) => u.email === datos.email)) {
      return conflict('Ya existe una cuenta con ese correo', { email: datos.email });
    }
    const id = nuevoId('profesional-nuevo');
    return {
      userId: id,
      personId: uuid(`person-${id}`),
      practitionerProfileId: uuid(`hpid-${id}`),
      practitionerCode: `MED-${Math.floor(Math.random() * 9000 + 1000)}`,
      ...(datos.photoFileId === undefined ? {} : { photoFileId: datos.photoFileId }),
    };
  });

  router.post('/iam/auth/register-organization', ({ body }) => {
    const datos = cuerpo<{
      organization?: {
        code?: string;
        legalEntityType?: string;
        tenantType?: string;
        countryConceptId?: string;
        jurisdictionConceptId?: string;
        diagnosticUnit?: { diagnosticUnitTypeConceptId?: string; modalityConceptIds?: readonly string[] };
        legalDocuments?: Partial<Record<(typeof LEGAL_DOCUMENT_FIELDS)[number], string | undefined>>;
        payer?: { latitude?: number; longitude?: number };
        // Representante legal y gerencias (subtarea 1.4). El mock NO prueba
        // que la API real acepte estas claves: eso lo hace el int-spec de la
        // API. Esto sólo espeja el `ValidationPipe` para que el formulario
        // no pase en falso contra un backend simulado.
        legalRepresentative?: {
          fullName?: string;
          idNumber?: string;
          email?: string;
          phone?: string;
          powerOfAttorneyFileId?: string;
        };
        executives?: Record<
          'generalManager' | 'commercialManager' | 'marketingManager',
          { fullName?: string; phone?: string; email?: string } | undefined
        >;
      };
    }>({ body });
    const legalEntityType = datos.organization?.legalEntityType;
    // Mismo contrato que el `ValidationPipe` real: un código fuera del
    // diccionario es 400, no un 422 de negocio (subtarea 1.1).
    if (legalEntityType !== undefined && !(legalEntityType in TIPO_SOCIETARIO)) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: {
          messages: [
            `organization.legalEntityType must be one of the following values: ${Object.keys(TIPO_SOCIETARIO).join(', ')}`,
          ],
        },
      });
    }
    const payer = datos.organization?.payer;
    if (payer?.latitude !== undefined || payer?.longitude !== undefined) {
      // Mismo contrato que el `ValidationPipe` real: la casa matriz
      // georreferenciada (subtarea 1.3) es ambas coordenadas o ninguna, y
      // cada una dentro de su rango.
      const mensajes: string[] = [];
      if (payer?.latitude === undefined) {
        mensajes.push('organization.payer.latitude must be a number');
      } else if (payer.latitude < -90 || payer.latitude > 90) {
        mensajes.push('organization.payer.latitude must not be greater than 90');
      }
      if (payer?.longitude === undefined) {
        mensajes.push('organization.payer.longitude must be a number');
      } else if (payer.longitude < -180 || payer.longitude > 180) {
        mensajes.push('organization.payer.longitude must not be greater than 180');
      }
      if (mensajes.length > 0) {
        return reply(400, {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          error: 'Bad Request',
          details: { messages: mensajes },
        });
      }
    }

    // La constitución y el poder del representante son opcionales en el DTO y
    // la regla vive en el servicio: sólo una UNIPERSONAL puede omitirlos, y
    // el resto responde 422 nombrando el documento (CL-43). Es lo que hace la
    // API, y el simulador no puede exigir más ni menos que ella.
    const esUnipersonal = legalEntityType === 'UNIPERSONAL';
    const legalDocuments = datos.organization?.legalDocuments;
    const tipoDeOrganizacion = datos.organization?.tenantType ?? 'PAYER';
    if (tipoDeOrganizacion !== 'PAYER' && tipoDeOrganizacion !== 'DIAGNOSTIC_CENTER' && tipoDeOrganizacion !== 'HOSPITAL') {
      return preconditionFailed('El tipo de organización no admite alta pública', {
        tenantType: tipoDeOrganizacion,
      });
    }
    if (tipoDeOrganizacion !== 'PAYER') {
      // Los tipos territoriales exigen país y jurisdicción: 422 `missing`.
      const faltantesTerritoriales = [
        ...(datos.organization?.countryConceptId ? [] : ['countryConceptId']),
        ...(datos.organization?.jurisdictionConceptId ? [] : ['jurisdictionConceptId']),
      ];
      if (faltantesTerritoriales.length > 0) {
        return preconditionFailed('Faltan datos territoriales de la organización', {
          missing: faltantesTerritoriales,
        });
      }
    }
    if (legalDocuments !== undefined) {
      const obligatorios = LEGAL_DOCUMENT_FIELDS.filter((campo) => campo !== 'constitutionFileId');
      const faltantes = obligatorios.filter((campo) => !legalDocuments[campo]);
      if (faltantes.length > 0) {
        // Mismo contrato que el `ValidationPipe` real: el bloque es todo o
        // nada (subtarea 1.2).
        return reply(400, {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          error: 'Bad Request',
          details: {
            messages: faltantes.map(
              (campo) => `organization.legalDocuments.${campo} must be a UUID`,
            ),
          },
        });
      }
    }

    // Representante legal y gerencias (subtarea 1.4): mismo contrato que el
    // `ValidationPipe` real. `legalRepresentative` no trae bloque
    // todo-o-nada propio —cada campo se valida por separado, como hace el
    // DTO real con sus propios decoradores—; `executives` sí es todo-o-nada
    // por gerencia, con `@IsNotEmptyObject` cubriendo la ausencia total.
    const mensajesRepresentacion: string[] = [];
    const legalRepresentative = datos.organization?.legalRepresentative;
    if (legalRepresentative !== undefined) {
      if (!legalRepresentative.fullName) {
        mensajesRepresentacion.push('organization.legalRepresentative.fullName should not be empty');
      }
      if (!legalRepresentative.idNumber) {
        mensajesRepresentacion.push('organization.legalRepresentative.idNumber should not be empty');
      }
      if (!legalRepresentative.email || !legalRepresentative.email.includes('@')) {
        mensajesRepresentacion.push('organization.legalRepresentative.email must be an email');
      }
    }
    const executives = datos.organization?.executives;
    if (!esUnipersonal) {
      if (legalDocuments !== undefined && !legalDocuments.constitutionFileId) {
        return preconditionFailed(
          'Falta la escritura de constitución: sólo una empresa unipersonal puede omitirla',
          { document: 'constitutionFileId' },
        );
      }
      if (legalRepresentative !== undefined && !legalRepresentative.powerOfAttorneyFileId) {
        return preconditionFailed(
          'Falta el poder notariado del representante legal: sólo una empresa unipersonal puede omitirlo',
          { document: 'powerOfAttorneyFileId' },
        );
      }
    }
    if (executives !== undefined) {
      for (const rol of ['generalManager', 'commercialManager', 'marketingManager'] as const) {
        const gerencia = executives[rol];
        if (!gerencia) {
          mensajesRepresentacion.push(`organization.executives.${rol} should not be empty`);
          continue;
        }
        if (!gerencia.fullName) {
          mensajesRepresentacion.push(`organization.executives.${rol}.fullName should not be empty`);
        }
        if (!gerencia.email || !gerencia.email.includes('@')) {
          mensajesRepresentacion.push(`organization.executives.${rol}.email must be an email`);
        }
        if (!gerencia.phone || gerencia.phone.length < 7) {
          mensajesRepresentacion.push(
            `organization.executives.${rol}.phone must be longer than or equal to 7 characters`,
          );
        }
      }
    }
    if (mensajesRepresentacion.length > 0) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: { messages: mensajesRepresentacion },
      });
    }
    const representativesRegistered =
      legalRepresentative === undefined && executives === undefined
        ? undefined
        : (legalRepresentative === undefined ? 0 : 1) + (executives === undefined ? 0 : 3);

    return {
      tenantId: nuevoId('tenant-nuevo'),
      code: datos.organization?.code ?? 'ORG-NUEVA',
      ownerUserId: nuevoId('owner'),
      status: 'PENDING_VERIFICATION',
      verificationStatus: 'PENDING',
      emailVerificationSent: true,
      ...(tipoDeOrganizacion === 'DIAGNOSTIC_CENTER' ? { diagnosticUnitId: nuevoId('unidad-diagnostica') } : {}),
      ...(legalDocuments === undefined
        ? {}
        : { legalDocumentsRegistered: Object.values(legalDocuments).filter(Boolean).length }),
      ...(representativesRegistered === undefined ? {} : { representativesRegistered }),
    };
  });

  router.post('/iam/auth/upload-registration-document', ({ body }) => {
    // Pre-carga pública de un documento legal (subtarea 1.2). Sin
    // `File.arrayBuffer()`: el manejador es síncrono y no puede esperar la
    // lectura asíncrona de los bytes, así que se declara por tipo/nombre —
    // el sniff por firma binaria real sólo lo hace la API.
    if (!(typeof FormData !== 'undefined' && body instanceof FormData)) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'No se recibió contenido en el campo "file"',
        error: 'Unprocessable Entity',
      });
    }
    const archivo = body.get('file');
    if (!(archivo instanceof File)) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'No se recibió contenido en el campo "file"',
        error: 'Unprocessable Entity',
      });
    }
    if (archivo.size > MAX_REGISTRATION_DOCUMENT_BYTES) {
      return reply(413, {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'El archivo excede el tamaño máximo permitido',
        error: 'Payload Too Large',
      });
    }
    const esPdf = archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name);
    if (!esPdf) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'Solo se admiten documentos PDF',
        error: 'Unprocessable Entity',
        details: { detectedMimeType: archivo.type || null },
      });
    }
    return reply(201, {
      fileId: nuevoId('registro-doc'),
      originalName: archivo.name,
      sizeBytes: archivo.size,
      mimeType: 'application/pdf',
    });
  });

  router.post('/iam/auth/verify-email', ({ body }) => {
    const datos = cuerpo<{ token?: string }>({ body });
    if ((datos.token ?? '') === 'vencido') return unauthorized('El enlace venció');
    return { userId: MOCK_USERS[1]!.id, emailVerified: true };
  });

  router.post('/iam/auth/activate', ({ body }) => {
    const datos = cuerpo<{ activationToken?: string }>({ body });
    if ((datos.activationToken ?? '') === '') return unauthorized('Token de activación inválido');
    return { userId: nuevoId('activado'), status: 'ACTIVE', activated: true };
  });

  router.post('/iam/auth/resend-verification', () => ({
    message: 'Si la cuenta existe, te reenviamos el correo de verificación.',
  }));

  router.post('/iam/auth/forgot-password', () => ({
    message: 'Si la cuenta existe, te enviamos un enlace para restablecer la contraseña.',
  }));

  router.post('/iam/auth/reset-password', ({ body }) => {
    const datos = cuerpo<{ token?: string }>({ body });
    if ((datos.token ?? '') === 'vencido') return unauthorized('El enlace venció');
    return { userId: MOCK_USERS[1]!.id, passwordChanged: true, revokedSessions: 2 };
  });

  /* ---- usuarios (administración) ---------------------------------------- */

  router.get('/iam/users', ({ query }) => {
    const q = texto(query, 'query');
    const status = texto(query, 'statusConceptId');
    const base: UsuarioListado[] = MOCK_USERS.map((u, i) => ({
      id: u.id,
      displayName: u.displayName,
      statusConceptId: ESTADO['ST-ACTIVE']!,
      emailVerified: true,
      lastLoginAt: iso(-i, 9),
      createdAt: iso(-400 + i * 7, 8),
    }));
    const todos = [...base, ...usuariosAdicionales]
      .filter((u) => contiene(u.displayName, q))
      .filter((u) => status === null || u.statusConceptId === status);
    return paginar(todos, query, 25);
  });

  router.post('/iam/users', ({ body }) => {
    const datos = cuerpo<{ displayName?: string; email?: string }>({ body });
    const nuevo: UsuarioListado = {
      id: nuevoId('user'),
      displayName: datos.displayName ?? 'Usuario nuevo',
      statusConceptId: ESTADO['ST-PENDING']!,
      emailVerified: false,
      lastLoginAt: null,
      createdAt: ahora(),
    };
    usuariosAdicionales.unshift(nuevo);
    return { status: 201, body: { id: nuevo.id, displayName: nuevo.displayName, status: nuevo.statusConceptId, createdAt: nuevo.createdAt } };
  });

  router.post('/iam/users/assisted-registration', ({ body }) => {
    const datos = cuerpo<{ name?: string; lastName?: string }>({ body });
    const id = nuevoId('asistido');
    usuariosAdicionales.unshift({
      id,
      displayName: `${datos.name ?? 'Paciente'} ${datos.lastName ?? 'Asistido'}`.trim(),
      statusConceptId: ESTADO['ST-PENDING']!,
      emailVerified: false,
      lastLoginAt: null,
      createdAt: ahora(),
    });
    return {
      status: 201,
      body: {
        userId: id,
        activationToken: `act-${id.slice(0, 8)}`,
        activationExpiresAt: iso(7, 23, 59),
        status: 'PENDING_ACTIVATION',
      },
    };
  });

  /* ---- tenants que administra IAM ---------------------------------------- */

  // `GET /admin/tenants` vive en `directory.handlers.ts`, sobre la colección
  // persistida: el duplicado que había acá —seis filas fijas con `name` y
  // `status` en texto— ganaba por orden de registro y dejaba la lista de
  // organizaciones sin nombre, con «—» en tipo y estado, sin búsqueda y sin
  // la organización recién creada.

  router.post('/admin/tenants/:id/verification', ({ params, body }) => {
    const datos = cuerpo<{ decision?: string }>({ body });
    if (params['id'] === undefined) return notFound();
    return { tenantId: params['id'], verificationStatus: datos.decision === 'REJECT' ? 'REJECTED' : 'VERIFIED', decidedAt: ahora() };
  });
}
