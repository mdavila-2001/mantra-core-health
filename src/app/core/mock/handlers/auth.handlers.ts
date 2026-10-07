import { ESTADO, TIPO_SOCIETARIO } from '../fixtures/conceptos';
import { pacientes, type PacienteSimulado } from '../fixtures/personas';
import { guardarImagenDeDataUrl } from './files.handlers';
import { sumarSucursalesDelAlta } from './directory.handlers';
import { guardarActivosDeFirma } from './firma-y-sello.handlers';
import { conflict, notFound, reply, unauthorized, type MockRouter } from '../mock-router';
import {
  buscarUsuario,
  emitirAccessToken,
  emitirRefreshToken,
  expiracion,
  MOCK_USERS,
  resolverCuentasDePacientes,
  resolverCuentasRegistradas,
  TENANT_FARMACIA,
  TENANT_NAMES,
  TENANT_PLATAFORMA,
  usuarioDeRefreshToken,
  type MockUser,
} from '../mock-session';
import { ahora, bodyAsQuery, Coleccion, contiene, cuerpo, iso, nuevoId, paginar, texto, uuid } from '../mock-store';

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

/**
 * Los mensajes del `ValidationPipe` para un punto georreferenciado: ambas
 * coordenadas o ninguna, cada una en su rango. Vacío si el punto es válido o
 * no trae ninguna de las dos.
 */
function mensajesDeCoordenadas(
  prefijo: string,
  punto: { latitude?: number; longitude?: number },
): string[] {
  if (punto.latitude === undefined && punto.longitude === undefined) return [];
  const mensajes: string[] = [];
  if (punto.latitude === undefined) {
    mensajes.push(`${prefijo}.latitude must be a number`);
  } else if (punto.latitude < -90 || punto.latitude > 90) {
    mensajes.push(`${prefijo}.latitude must not be greater than 90`);
  }
  if (punto.longitude === undefined) {
    mensajes.push(`${prefijo}.longitude must be a number`);
  } else if (punto.longitude < -180 || punto.longitude > 180) {
    mensajes.push(`${prefijo}.longitude must not be greater than 180`);
  }
  return mensajes;
}

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

/* ---- las farmacias que se registran durante el recorrido -------------------

   Antes el alta respondía «Tu cuenta está lista» y el login rechazaba ese
   mismo correo: nada se guardaba. Ahora la cuenta queda (en la pestaña, como
   el resto de la maqueta) y entra con el correo del representante legal.

   Límite del doble, a propósito: la cuenta entra a la farmacia de
   demostración —el tenant de Farmacia Vida, con su catálogo, sus sedes y su
   bandeja sembrados— rotulada con la razón social que se registró. Una
   farmacia vacía de verdad exigiría un tenant nuevo en todo el simulador. */

interface CuentaDeFarmaciaRegistrada {
  readonly id: string;
  readonly email: string;
  readonly razonSocial: string;
}

const cuentasDeFarmacia = new Coleccion<CuentaDeFarmaciaRegistrada>([]).persistirEn(
  'mock.auth.cuentas-de-farmacia',
);

function cuentaDeFarmacia(c: CuentaDeFarmaciaRegistrada): MockUser {
  return {
    key: `alta-${c.id}`,
    id: c.id,
    email: c.email,
    nationalId: '',
    displayName: c.razonSocial,
    roles: ['USER'],
    tenants: [TENANT_FARMACIA],
    tenantNames: { ...TENANT_NAMES, [TENANT_FARMACIA]: c.razonSocial },
    personId: uuid(`person-${c.id}`),
    accountKind: 'ORGANIZATION',
  };
}

resolverCuentasRegistradas(({ identificador, id, key }) => {
  const c = cuentasDeFarmacia
    .todos()
    .find(
      (cuenta) =>
        (identificador !== undefined && cuenta.email === identificador) ||
        (id !== undefined && cuenta.id === id) ||
        (key !== undefined && `alta-${cuenta.id}` === key),
    );
  return c === undefined ? undefined : cuentaDeFarmacia(c);
});

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
    const datos = cuerpo<{
      email?: string;
      photoFileId?: string;
      // Sólo simulador (el DTO real no los declara): la firma y el sello del alta,
      // como imágenes en base64 igual que `profilePhotoBase64`.
      signatureImageBase64?: string;
      sealImageBase64?: string;
    }>({ body });
    if (datos.email !== undefined && MOCK_USERS.some((u) => u.email === datos.email)) {
      return conflict('Ya existe una cuenta con ese correo', { email: datos.email });
    }
    const id = nuevoId('profesional-nuevo');
    const practitionerProfileId = uuid(`hpid-${id}`);
    if (datos.signatureImageBase64 !== undefined || datos.sealImageBase64 !== undefined) {
      guardarActivosDeFirma(practitionerProfileId, {
        ...(datos.signatureImageBase64 === undefined
          ? {}
          : { signatureFileId: guardarImagenDeDataUrl(datos.signatureImageBase64, 'firma.png') }),
        ...(datos.sealImageBase64 === undefined
          ? {}
          : { sealFileId: guardarImagenDeDataUrl(datos.sealImageBase64, 'sello.png') }),
      });
    }
    return {
      userId: id,
      personId: uuid(`person-${id}`),
      practitionerProfileId,
      practitionerCode: `MED-${Math.floor(Math.random() * 9000 + 1000)}`,
      ...(datos.photoFileId === undefined ? {} : { photoFileId: datos.photoFileId }),
    };
  });

  router.post('/iam/auth/register-organization', ({ body }) => {
    const datos = cuerpo<{
      organization?: {
        code?: string;
        legalName?: string;
        legalEntityType?: string;
        // `tenantType` (carril de farmacia, 2026-09-29): el mock aceptaba
        // cualquier valor en silencio porque no lo leía. Se valida contra
        // `TENANT_TYPE_CODES` recién cuando hace falta distinguir el bloque
        // `pharmacy`, más abajo — los demás tipos (`PAYER` incluido) siguen
        // sin exigir nada nuevo acá.
        tenantType?: string;
        legalDocuments?: Record<(typeof LEGAL_DOCUMENT_FIELDS)[number], string | undefined>;
        payer?: { latitude?: number; longitude?: number };
        // Bloque de farmacia (carril de farmacia, 2026-09-29): clave que el
        // DTO real todavía no declara (ver `PENDIENTES-BACKEND.md`, P49). El
        // simulador la valida igual, con la misma forma que `payer` —ambas
        // coordenadas o ninguna, cada una en rango—, para que el alta
        // pública de farmacia tenga contra qué ejercitarse.
        pharmacy?: {
          latitude?: number;
          longitude?: number;
          branches?: readonly {
            name?: string;
            description?: string;
            latitude?: number;
            longitude?: number;
            locationUrl?: string;
          }[];
        };
        // Bloque del centro de diagnóstico (carril A de la cuenta de
        // laboratorio, 2026-09-30): éste SÍ lo declara el DTO real
        // (`DiagnosticUnitProfileDto`), con la sede primaria y su dirección.
        // `branches` es lo único que el cliente le suma y el DTO no tiene
        // (ver `PENDIENTES-BACKEND.md`, P51).
        diagnosticUnit?: {
          name?: string;
          primarySite?: {
            name?: string;
            address?: { lines?: readonly string[]; latitude?: number; longitude?: number };
          };
          branches?: readonly {
            name?: string;
            addressLines?: readonly string[];
            latitude?: number;
            longitude?: number;
          }[];
        };
        // Representante legal y gerencias (subtarea 1.4). El mock NO prueba
        // que la API real acepte estas claves: eso lo hace el int-spec de la
        // API. Esto sólo espeja el `ValidationPipe` para que el formulario
        // no pase en falso contra un backend simulado.
        //
        // `idNumber` y `powerOfAttorneyFileId` NO son obligatorios acá —a
        // diferencia de `RegisterOrganizationLegalRepresentativeDto` del
        // backend real, que los exige siempre que el bloque viaja—: el
        // registro de procesos de farmacia (Módulo Farmacia §1) no pide la
        // cédula del representante como dato de alta, y esta relajación es
        // deliberada del simulador (ver P49). No afecta al alta de
        // aseguradora: su formulario siempre completa los dos.
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
      owner?: { email?: string };
    }>({ body });
    if (datos.owner?.email !== undefined && buscarUsuario(datos.owner.email) !== undefined) {
      return conflict('Ya existe una cuenta con ese correo', { email: datos.owner.email });
    }
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

    const pharmacy = datos.organization?.pharmacy;
    if (pharmacy !== undefined) {
      // Mismo contrato que `payer` arriba: coordenadas ambas o ninguna, cada
      // una en rango. Se valida la central y cada sucursal declarada (1.7 y
      // 1.18 del registro de procesos).
      const mensajes: string[] = [];
      const coordenadas = (
        prefijo: string,
        punto: { latitude?: number; longitude?: number },
      ): void => {
        if (punto.latitude === undefined && punto.longitude === undefined) return;
        if (punto.latitude === undefined) {
          mensajes.push(`${prefijo}.latitude must be a number`);
        } else if (punto.latitude < -90 || punto.latitude > 90) {
          mensajes.push(`${prefijo}.latitude must not be greater than 90`);
        }
        if (punto.longitude === undefined) {
          mensajes.push(`${prefijo}.longitude must be a number`);
        } else if (punto.longitude < -180 || punto.longitude > 180) {
          mensajes.push(`${prefijo}.longitude must not be greater than 180`);
        }
      };
      coordenadas('organization.pharmacy', pharmacy);
      pharmacy.branches?.forEach((sucursal, indice) => {
        if (!sucursal.name) {
          mensajes.push(`organization.pharmacy.branches.${indice}.name should not be empty`);
        }
        coordenadas(`organization.pharmacy.branches.${indice}`, sucursal);
      });
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

    const diagnosticUnit = datos.organization?.diagnosticUnit;
    if (diagnosticUnit !== undefined) {
      // Mismo contrato que la API real: `diagnosticUnit` sólo corresponde a
      // `DIAGNOSTIC_CENTER`, y con cualquier otro tipo es un 422 de negocio,
      // no un 400 de forma.
      if (datos.organization?.tenantType !== 'DIAGNOSTIC_CENTER') {
        // 422 y no el 412 de `preconditionFailed`: la `PreconditionFailedException`
        // de la API responde 422.
        return reply(422, {
          statusCode: 422,
          code: 'PRECONDITION_FAILED',
          message: 'El bloque diagnosticUnit sólo corresponde a DIAGNOSTIC_CENTER',
          error: 'Unprocessable Entity',
          details: { tenantType: datos.organization?.tenantType ?? null },
        });
      }
      // La forma, como el `ValidationPipe`: coordenadas ambas o ninguna y en
      // rango, en la central (4.1.7) y en cada sucursal (4.1.18), y cada
      // sucursal con nombre.
      const mensajes = mensajesDeCoordenadas(
        'organization.diagnosticUnit.primarySite.address',
        diagnosticUnit.primarySite?.address ?? {},
      );
      diagnosticUnit.branches?.forEach((sucursal, indice) => {
        const prefijo = `organization.diagnosticUnit.branches.${indice}`;
        if (!sucursal.name) mensajes.push(`${prefijo}.name should not be empty`);
        mensajes.push(...mensajesDeCoordenadas(prefijo, sucursal));
      });
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

    const legalDocuments = datos.organization?.legalDocuments;
    if (legalDocuments !== undefined) {
      const faltantes = LEGAL_DOCUMENT_FIELDS.filter((campo) => !legalDocuments[campo]);
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
      if (!legalRepresentative.email || !legalRepresentative.email.includes('@')) {
        mensajesRepresentacion.push('organization.legalRepresentative.email must be an email');
      }
      // `idNumber` y `powerOfAttorneyFileId`: ver el comentario del tipo de
      // `legalRepresentative` más arriba — deliberadamente no obligatorios.
    }
    const executives = datos.organization?.executives;
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

    const ownerUserId = nuevoId('owner');
    if (datos.organization?.tenantType === 'PHARMACY' && datos.owner?.email !== undefined) {
      cuentasDeFarmacia.agregar({
        id: ownerUserId,
        email: datos.owner.email.trim().toLocaleLowerCase('es'),
        razonSocial: datos.organization.legalName?.trim() || 'Mi farmacia',
      });
      sumarSucursalesDelAlta(
        TENANT_FARMACIA,
        (pharmacy?.branches ?? []).flatMap((b) => (b.name ? [{ ...b, name: b.name }] : [])),
      );
    }

    return {
      tenantId: nuevoId('tenant-nuevo'),
      code: datos.organization?.code ?? 'ORG-NUEVA',
      ownerUserId,
      status: 'PENDING_VERIFICATION',
      verificationStatus: 'PENDING',
      emailVerificationSent: true,
      ...(legalDocuments === undefined ? {} : { legalDocumentsRegistered: 5 }),
      ...(representativesRegistered === undefined ? {} : { representativesRegistered }),
      // Como la API: la unidad sólo nace si el alta declaró el bloque.
      ...(diagnosticUnit === undefined ? {} : { diagnosticUnitId: nuevoId('unidad-diagnostica') }),
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

  /**
   * La búsqueda de usuarios, común al `GET` obsoleto y al `POST …/search` que
   * usa `IamClient.searchUsers`. Lee `q` y `status`, que son las claves del
   * contrato: antes leía `query` y `statusConceptId`, que el cliente nunca
   * mandó, así que el filtro no filtraba.
   */
  function searchUsers(query: URLSearchParams) {
    const q = texto(query, 'q');
    const status = texto(query, 'status');
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
  }

  router.get('/iam/users', ({ query }) => searchUsers(query));
  router.post('/iam/users/search', (request) => searchUsers(bodyAsQuery(request)));

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
