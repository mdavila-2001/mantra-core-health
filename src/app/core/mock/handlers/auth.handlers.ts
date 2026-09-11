import { ESTADO, TIPO_SOCIETARIO } from '../fixtures/conceptos';
import { conflict, notFound, reply, unauthorized, type MockRouter } from '../mock-router';
import {
  buscarUsuario,
  emitirAccessToken,
  emitirRefreshToken,
  expiracion,
  MOCK_USERS,
  TENANT_CLINICA,
  usuarioDeRefreshToken,
} from '../mock-session';
import { ahora, contiene, cuerpo, iso, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    IAM: sesión, altas y usuarios.
    ========================================================================== */

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

export function registrarAuth(router: MockRouter): void {
  router.post('/iam/auth/login', ({ body }) => {
    const datos = cuerpo<LoginBody>({ body });
    const identificador = datos.email ?? datos.nationalId ?? '';
    const user = buscarUsuario(identificador);
    if (user === undefined || (datos.password ?? '') === '') {
      return unauthorized('Credenciales inválidas. Probá con una de las cuentas de prueba.');
    }
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
      organization?: { code?: string; legalEntityType?: string };
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
    return {
      tenantId: nuevoId('tenant-nuevo'),
      code: datos.organization?.code ?? 'ORG-NUEVA',
      ownerUserId: nuevoId('owner'),
      status: 'PENDING_VERIFICATION',
      verificationStatus: 'PENDING',
      emailVerificationSent: true,
    };
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

  router.get('/admin/tenants', ({ query }) =>
    paginar(
      [
        { id: TENANT_CLINICA, code: 'OLIVOS', name: 'Clínica Los Olivos', status: 'ACTIVE', verificationStatus: 'VERIFIED', createdAt: iso(-400) },
        { id: uuid('tenant-hospital-san-lucas'), code: 'SANLUCAS', name: 'Hospital San Lucas', status: 'ACTIVE', verificationStatus: 'VERIFIED', createdAt: iso(-380) },
        { id: uuid('tenant-farmacia-vida'), code: 'FARVIDA', name: 'Farmacia Vida', status: 'ACTIVE', verificationStatus: 'VERIFIED', createdAt: iso(-200) },
        { id: uuid('tenant-laboratorio-central'), code: 'LABCEN', name: 'Laboratorio Central', status: 'ACTIVE', verificationStatus: 'VERIFIED', createdAt: iso(-150) },
        { id: uuid('tenant-seguros-andina'), code: 'ANDINA', name: 'Seguros Andina', status: 'ACTIVE', verificationStatus: 'VERIFIED', createdAt: iso(-120) },
        { id: uuid('tenant-clinica-nueva'), code: 'CLINUEVA', name: 'Clínica Nueva Esperanza', status: 'PENDING', verificationStatus: 'PENDING', createdAt: iso(-3) },
      ],
      query,
      25,
    ),
  );

  router.post('/admin/tenants/:id/verification', ({ params, body }) => {
    const datos = cuerpo<{ decision?: string }>({ body });
    if (params['id'] === undefined) return notFound();
    return { tenantId: params['id'], verificationStatus: datos.decision === 'REJECT' ? 'REJECTED' : 'VERIFIED', decidedAt: ahora() };
  });
}
