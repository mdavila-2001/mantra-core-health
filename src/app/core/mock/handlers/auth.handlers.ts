import {
  MAX_ASEGURADORAS_POR_ENVIO,
  pedirAseguradoras,
} from './practitioner-insurer-requests.handlers';
import { STATUS, CORPORATE_TYPE, conceptById } from '../fixtures/concepts';
import { patientList, type PacienteSimulado } from '../fixtures/people';
import { crearAdmisionDeAltaDeDoctor } from './admissions.handlers';
import { sumarSucursalesDelAlta } from './directory.handlers';
import { guardarImagenDeDataUrl } from './files.handlers';
import { signatureSaveAssets } from './signature-and-seal.handlers';
import { conflict, forbidden, notFound, preconditionFailed, reply, unauthorized, validation, type MockRequest, type MockRouter } from '../mock-router';
import type { MockUser as CuentaSimulada } from '../mock-session';
import {
  buscarUsuario,
  emitirAccessToken,
  emitirRefreshToken,
  expiracion,
  MOCK_USERS,
  resolverCuentasDePacientes,
  resolverCuentasRegistradas,
  TENANT_FARMACIA,
  TENANT_LABORATORIO,
  TENANT_NAMES,
  TENANT_PLATAFORMA,
  usuarioDeRefreshToken,
  type MockUser,
} from '../mock-session';
import { medicalFacilityRejection } from './medical-facility.validation';
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
  statusConceptId: ultimo === null ? STATUS['ST-PENDING']! : STATUS['ST-ACTIVE']!,
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

/* ---- las organizaciones que se registran durante el recorrido -------------

   Antes el alta respondía «Tu cuenta está lista» y el login rechazaba ese
   mismo correo: nada se guardaba. Ahora la cuenta queda (en la pestaña, como
   el resto de la maqueta) y entra con el correo del representante legal.
   Vale para la farmacia (3.1) y el laboratorio (4.1).

   Límite del doble, a propósito: la cuenta entra a la organización de
   demostración de su tipo —Farmacia Vida o Laboratorio Central, con su
   catálogo, sus sedes y su bandeja sembrados— rotulada con la razón social
   que se registró. Una organización vacía de verdad exigiría un tenant nuevo
   en todo el simulador. */

interface CuentaRegistrada {
  readonly id: string;
  readonly email: string;
  readonly razonSocial: string;
  /** El tenant de demostración al que entra. Ausente en las guardadas antes: farmacia. */
  readonly tenantId?: string;
}

/** A qué organización de demostración entra cada tipo de alta. */
const TENANT_DE_DEMOSTRACION: Readonly<Record<string, string>> = {
  PHARMACY: TENANT_FARMACIA,
  // Sólo el alta de laboratorio sale a la red con este tipo (la de
  // imagenología todavía no envía nada): es el Laboratorio Central.
  DIAGNOSTIC_CENTER: TENANT_LABORATORIO,
};

const cuentasRegistradas = new Coleccion<CuentaRegistrada>([]).persistirEn(
  'mock.auth.cuentas-de-farmacia',
);

function cuentaRegistrada(c: CuentaRegistrada): MockUser {
  const tenant = c.tenantId ?? TENANT_FARMACIA;
  return {
    key: `alta-${c.id}`,
    id: c.id,
    email: c.email,
    nationalId: '',
    displayName: c.razonSocial,
    roles: ['USER'],
    tenants: [tenant],
    tenantNames: { ...TENANT_NAMES, [tenant]: c.razonSocial },
    personId: uuid(`person-${c.id}`),
    accountKind: 'ORGANIZATION',
  };
}

resolverCuentasRegistradas(({ identificador, id, key }) => {
  const c = cuentasRegistradas
    .todos()
    .find(
      (cuenta) =>
        (identificador !== undefined && cuenta.email === identificador) ||
        (id !== undefined && cuenta.id === id) ||
        (key !== undefined && `alta-${cuenta.id}` === key),
    );
  return c === undefined ? undefined : cuentaRegistrada(c);
});

resolverCuentasDePacientes(({ identificador, id, key }) => {
  const p = patientList
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

/**
 * Olvida las sesiones abiertas y las contraseñas vigentes: cada cuenta vuelve a tener la actual y otra desde otro equipo. Solo lo
 * usan las pruebas (`reiniciarLaSesionDelSimulador`): es memoria del módulo, y con `isolate: false` lo que un archivo cerró
 * («No fui yo», «cerrar todas», cambiar la contraseña) lo veía el siguiente archivo del mismo worker.
 */
export function olvidarLasSesionesDeCuenta(): void {
  sesionesPorUsuario.clear();
  contrasenaVigente.clear();
}

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

/**
 * «No fui yo»: cierra todas las sesiones de la cuenta menos la actual. Es lo que hace
 * `POST /iam/me/devices/:id/not-me` en una sola operación; devuelve cuántas cerró.
 */
export function cerrarOtrasSesiones(user: CuentaSimulada): number {
  const sesiones = sesionesDe(user);
  const otras = sesiones.filter((s) => !s.current);
  sesionesPorUsuario.set(user.id, sesiones.filter((s) => s.current));
  return otras.length;
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

/** El tope de `uploadSignatureImage` en la API. */
const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

function leerComoDataUrl(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer la imagen'));
    lector.readAsDataURL(archivo);
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
      return unauthorized('Credenciales inválidas. Pruebe con una de las cuentas de prueba.');
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

  // Contrato nuevo (31/10/2026): ¿ya existe una cuenta con este dato? Público y
  // sin detalle de quién es. Compara sin distinguir mayúsculas ni espacios.
  router.get('/iam/auth/identifier-exists', ({ query }) => {
    const kind = query.get('kind') ?? '';
    const value = (query.get('value') ?? '').trim().toLowerCase();
    if (value === '' || !['NATIONAL_ID', 'EMAIL', 'ORG_NAME'].includes(kind)) {
      return validation('Falta el tipo o el valor a verificar');
    }
    const igual = (otro: string | undefined): boolean =>
      otro !== undefined && otro.trim().toLowerCase() === value;
    const exists =
      kind === 'NATIONAL_ID'
        ? MOCK_USERS.some((u) => igual(u.nationalId))
        : kind === 'EMAIL'
          ? MOCK_USERS.some((u) => igual(u.email))
          : MOCK_USERS.some((u) => igual(u.displayName));
    return { exists };
  });

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
      name?: string;
      lastName?: string;
      motherLastName?: string;
      nationalId?: string;
      licenseNumber?: string;
      photoFileId?: string;
      // Sólo simulador (el DTO real no los declara): la firma y el sello del alta,
      // como imágenes en base64 igual que `profilePhotoBase64`.
      signatureImageBase64?: string;
      sealImageBase64?: string;
      // P29: los respaldos de la habilitación, como en la API.
      licenseFileId?: string;
      sedesLicenseNumber?: string;
      sedesLicenseFileId?: string;
      sedesLicenseIssueDate?: string;
      // El registro del colegio de la profesión, con su fecha y su respaldo.
      collegeLicenseNumber?: string;
      collegeName?: string;
      collegeLicenseIssueDate?: string;
      collegeLicenseFileId?: string;
      // Dónde dice trabajar (28/10/2026), como en la API.
      institutionSlugs?: string[];
      insurerCarrierIds?: string[];
      // Como `RegisterPractitionerDto`: la firma y el sello llegan como id de un
      // archivo ya pre-cargado en `upload-registration-signature-image`.
      signatureFileId?: string;
      sealFileId?: string;
    }>({ body });
    if (datos.email !== undefined && MOCK_USERS.some((u) => u.email === datos.email)) {
      return conflict('Ya existe una cuenta con ese correo', { email: datos.email });
    }
    // Mismas precondiciones que `IamPractitionerSelfRegistrationService`.
    if (datos.sedesLicenseFileId !== undefined && !datos.sedesLicenseNumber) {
      return preconditionFailed('El archivo del registro del SEDES necesita su número de registro', {
        field: 'sedesLicenseFileId',
      });
    }
    if (datos.licenseFileId !== undefined && datos.licenseFileId === datos.sedesLicenseFileId) {
      return preconditionFailed(
        'La matrícula y el registro del SEDES no pueden compartir el mismo archivo',
        { field: 'sedesLicenseFileId' },
      );
    }
    if (datos.sedesLicenseIssueDate !== undefined && !datos.sedesLicenseNumber) {
      return preconditionFailed('La fecha del registro del SEDES necesita su número de registro', {
        field: 'sedesLicenseIssueDate',
      });
    }
    if (!datos.collegeLicenseNumber) {
      const suelto = (
        ['collegeName', 'collegeLicenseIssueDate', 'collegeLicenseFileId'] as const
      ).find((campo) => datos[campo] !== undefined);
      if (suelto !== undefined) {
        return preconditionFailed(
          'Los datos del registro del colegio necesitan su número de registro',
          { field: suelto },
        );
      }
    }
    if (
      datos.collegeLicenseFileId !== undefined &&
      (datos.collegeLicenseFileId === datos.licenseFileId ||
        datos.collegeLicenseFileId === datos.sedesLicenseFileId)
    ) {
      return preconditionFailed(
        'El registro del colegio no puede compartir el archivo de otra habilitación',
        { field: 'collegeLicenseFileId' },
      );
    }
    const id = nuevoId('profesional-nuevo');
    const practitionerProfileId = uuid(`hpid-${id}`);
    // Las aseguradoras se validan contra el catálogo antes de dar el alta por
    // hecha, como la API: una inexistente deshace todo con 422.
    if ((datos.insurerCarrierIds ?? []).length > MAX_ASEGURADORAS_POR_ENVIO) {
      return validation(`Hasta ${MAX_ASEGURADORAS_POR_ENVIO} aseguradoras`, [
        { field: 'insurerCarrierIds', message: 'admite hasta 20' },
      ]);
    }
    const seguros = pedirAseguradoras(
      practitionerProfileId,
      datos.insurerCarrierIds ?? [],
      [datos.name, datos.lastName].filter(Boolean).join(' ') || undefined,
    );
    if (seguros === null) {
      return preconditionFailed('Alguna de las aseguradoras indicadas no existe o no está activa', {
        field: 'insurerCarrierIds',
      });
    }
    const institutionSlugs = [...new Set(datos.institutionSlugs ?? [])];
    const affiliationIds = institutionSlugs.map((slug) => uuid(`aff-alta-${practitionerProfileId}-${slug}`));
    if (
      datos.signatureImageBase64 !== undefined ||
      datos.sealImageBase64 !== undefined ||
      datos.signatureFileId !== undefined ||
      datos.sealFileId !== undefined
    ) {
      signatureSaveAssets(practitionerProfileId, {
        ...(datos.signatureFileId !== undefined
          ? { signatureFileId: datos.signatureFileId }
          : datos.signatureImageBase64 === undefined
            ? {}
            : { signatureFileId: guardarImagenDeDataUrl(datos.signatureImageBase64, 'firma.png') }),
        ...(datos.sealFileId !== undefined
          ? { sealFileId: datos.sealFileId }
          : datos.sealImageBase64 === undefined
            ? {}
            : { sealFileId: guardarImagenDeDataUrl(datos.sealImageBase64, 'sello.png') }),
      });
    }
    // Cada alta de médico nace como solicitud de admisión pendiente de revisión.
    crearAdmisionDeAltaDeDoctor({
      userId: id,
      profileId: practitionerProfileId,
      displayName: [datos.name, datos.lastName, datos.motherLastName].filter(Boolean).join(' ') || 'Médico recién registrado',
      ...(datos.nationalId === undefined ? {} : { nationalId: datos.nationalId }),
      ...(datos.email === undefined ? {} : { email: datos.email }),
      ...(datos.licenseNumber === undefined ? {} : { matricula: datos.licenseNumber }),
    });
    return {
      userId: id,
      personId: uuid(`person-${id}`),
      practitionerProfileId,
      practitionerCode: `MED-${Math.floor(Math.random() * 9000 + 1000)}`,
      ...(datos.photoFileId === undefined ? {} : { photoFileId: datos.photoFileId }),
      ...(affiliationIds.length === 0 ? {} : { affiliationIds }),
      ...(seguros.pedidas.length === 0
        ? {}
        : { insurerRequestIds: seguros.pedidas.map((s) => s.id) }),
    };
  });

  router.post('/iam/auth/register-organization', ({ body }) => {
    const datos = cuerpo<{
      organization?: {
        code?: string;
        legalName?: string;
        legalEntityType?: string;
        tenantType?: string;
        countryConceptId?: string;
        jurisdictionConceptId?: string;
        legalDocuments?: Partial<Record<(typeof LEGAL_DOCUMENT_FIELDS)[number], string | undefined>>;
        payer?: { latitude?: number; longitude?: number };
        // Bloque de farmacia (carril de farmacia, 2026-09-29;
        // `RegisterPharmacyBlockDto` en el DTO real, P49). El simulador lo
        // valida con la misma forma que `payer` —ambas coordenadas o
        // ninguna, cada una en rango—.
        pharmacy?: {
          address?: string;
          latitude?: number;
          longitude?: number;
          branches?: readonly { name?: string; latitude?: number; longitude?: number }[];
        };
        // Bloque del centro de diagnóstico (carril A de la cuenta de
        // laboratorio, 2026-09-30): éste SÍ lo declara el DTO real
        // (`DiagnosticUnitProfileDto`), con la sede primaria y su dirección.
        // `branches` lo declara el DTO real (`DiagnosticUnitBranchDto`, P51),
        // con `description` (≤ 1000) y `locationUrl` (sólo http/https).
        diagnosticUnit?: {
          diagnosticUnitTypeConceptId?: string;
          modalityConceptIds?: readonly string[];
          name?: string;
          primarySite?: {
            name?: string;
            address?: { lines?: readonly string[]; latitude?: number; longitude?: number };
          };
          branches?: readonly {
            name?: string;
            address?: { lines?: readonly string[]; latitude?: number; longitude?: number };
            description?: string;
            locationUrl?: string;
          }[];
        };
        // Representante legal y gerencias (subtarea 1.4). El mock NO prueba
        // que la API real acepte estas claves: eso lo hace el int-spec de la
        // API. Esto sólo espeja el `ValidationPipe` para que el formulario
        // no pase en falso contra un backend simulado.
        //
        // `idNumber` es obligatorio, como en
        // `RegisterOrganizationLegalRepresentativeDto` del backend real (P50:
        // se mantuvo la cédula en el alta de farmacia). El poder lo exige el
        // servicio salvo UNIPERSONAL, y salvo en la farmacia, que lo presenta
        // para operar y no para nacer (P50, D2).
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
        // Bloque propio de una organización médica (contrato del 28/10/2026):
        // se valida en `medicalFacilityRejection`.
        medicalFacility?: unknown;
      };
      owner?: { email?: string };
    }>({ body });
    const legalEntityType = datos.organization?.legalEntityType;
    // Mismo contrato que el `ValidationPipe` real: un código fuera del
    // diccionario es 400, no un 422 de negocio (subtarea 1.1).
    if (legalEntityType !== undefined && !(legalEntityType in CORPORATE_TYPE)) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        error: 'Bad Request',
        details: {
          messages: [
            `organization.legalEntityType must be one of the following values: ${Object.keys(CORPORATE_TYPE).join(', ')}`,
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

    // Mismo contrato que la API real (P50): `pharmacy` sólo corresponde a
    // `PHARMACY`; con cualquier otro tipo es un 422 de negocio.
    if (pharmacy !== undefined && datos.organization?.tenantType !== 'PHARMACY') {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'El bloque `pharmacy` sólo corresponde a un tenant de tipo PHARMACY',
        error: 'Unprocessable Entity',
        details: { tenantType: datos.organization?.tenantType ?? null },
      });
    }

    const rechazoMedico = medicalFacilityRejection(datos.organization ?? {});
    if (rechazoMedico !== null) return rechazoMedico;

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
        mensajes.push(...mensajesDeCoordenadas(`${prefijo}.address`, sucursal.address ?? {}));
        if (sucursal.description !== undefined && sucursal.description.length > 1000) {
          mensajes.push(`${prefijo}.description must be shorter than or equal to 1000 characters`);
        }
        if (sucursal.locationUrl !== undefined && !/^https?:\/\//i.test(sucursal.locationUrl)) {
          mensajes.push('locationUrl debe ser http o https');
        }
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
      // Como `TenantTypeProfileService`: las sucursales son sólo de una unidad
      // de laboratorio. Sin tipo declarado, la API lo infiere (P51, D-1): una
      // modalidad de imagen la hace de imágenes; si no, es de laboratorio.
      const tipoDeclarado = diagnosticUnit.diagnosticUnitTypeConceptId;
      const esDeImagenes =
        tipoDeclarado !== undefined && conceptById(tipoDeclarado)?.code === 'DU_TYPE_IMAGING';
      if ((diagnosticUnit.branches?.length ?? 0) > 0 && esDeImagenes) {
        return reply(422, {
          statusCode: 422,
          code: 'PRECONDITION_FAILED',
          message: 'Las sucursales sólo se declaran en una unidad de laboratorio clínico',
          error: 'Unprocessable Entity',
          details: { diagnosticUnitTypeConceptId: tipoDeclarado },
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
    // Compatibilidad declarada del simulador con D2/P50/P51. El alta anterior
    // CL43 conserva sus catalogos y validaciones; esto no certifica la API real.
    const demoPortalRegistration =
      datos.organization?.countryConceptId === undefined &&
      datos.organization?.jurisdictionConceptId === undefined &&
      (tipoDeOrganizacion === 'PHARMACY' ||
        (tipoDeOrganizacion === 'DIAGNOSTIC_CENTER' &&
          diagnosticUnit?.diagnosticUnitTypeConceptId === undefined &&
          diagnosticUnit?.modalityConceptIds === undefined));
    if (!['PAYER', 'PHARMACY', 'DIAGNOSTIC_CENTER', 'HOSPITAL', 'CLINIC', 'MEDICAL_OFFICE', 'NURSING', 'HEALTH_OTHER'].includes(tipoDeOrganizacion)) {
      return preconditionFailed('El tipo de organización no admite alta pública', {
        tenantType: tipoDeOrganizacion,
      });
    }
    if (tipoDeOrganizacion !== 'PAYER' && !demoPortalRegistration) {
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
    if (legalDocuments !== undefined && !demoPortalRegistration) {
      // Como `assertLegalDocumentsForEntityType`: la matrícula de comercio sólo
      // la omite un profesional independiente (decisión del 28/10/2026).
      const obligatorios = LEGAL_DOCUMENT_FIELDS.filter(
        (campo) =>
          campo !== 'constitutionFileId' &&
          !(campo === 'commerceRegistryFileId' && legalEntityType === 'PROFESIONAL_INDEPENDIENTE'),
      );
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
      if (!demoPortalRegistration && !legalRepresentative.idNumber) {
        mensajesRepresentacion.push('organization.legalRepresentative.idNumber should not be empty');
      }
      if (!legalRepresentative.fullName) {
        mensajesRepresentacion.push('organization.legalRepresentative.fullName should not be empty');
      }
      if (!legalRepresentative.email || !legalRepresentative.email.includes('@')) {
        mensajesRepresentacion.push('organization.legalRepresentative.email must be an email');
      }
    }
    const executives = datos.organization?.executives;
    if (!esUnipersonal && !demoPortalRegistration) {
      if (
        legalDocuments !== undefined &&
        !legalDocuments.constitutionFileId &&
        legalEntityType !== 'PROFESIONAL_INDEPENDIENTE'
      ) {
        return preconditionFailed(
          'Falta la escritura de constitución: sólo una empresa unipersonal puede omitirla',
          { document: 'constitutionFileId' },
        );
      }
      if (
        tipoDeOrganizacion !== 'PHARMACY' &&
        legalRepresentative !== undefined &&
        !legalRepresentative.powerOfAttorneyFileId
      ) {
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

    // Como el `ValidationPipe` va antes que el servicio, el conflicto de correo se
    // resuelve después de validar el cuerpo: un cuerpo inválido es 400/422, no 409.
    // Por correo exacto, no con `buscarUsuario`: aquél acepta `farmacia@…`
    // como atajo de la cuenta demo, y acá eso respondía «ya existe» a
    // cualquier farmacia que se registrara con `farmacia@su-dominio`.
    const correoDelOwner = datos.owner?.email?.trim().toLocaleLowerCase('es');
    if (
      correoDelOwner !== undefined &&
      (MOCK_USERS.some((u) => u.email === correoDelOwner) ||
        cuentasRegistradas.todos().some((c) => c.email === correoDelOwner))
    ) {
      return conflict('Ya existe una cuenta con ese correo', { email: correoDelOwner });
    }
    const ownerUserId = nuevoId('owner');
    const tenantDeDemostracion = TENANT_DE_DEMOSTRACION[datos.organization?.tenantType ?? ''];
    if (tenantDeDemostracion !== undefined && datos.owner?.email !== undefined) {
      cuentasRegistradas.agregar({
        id: ownerUserId,
        email: datos.owner.email.trim().toLocaleLowerCase('es'),
        razonSocial: datos.organization?.legalName?.trim() || TENANT_NAMES[tenantDeDemostracion] || 'Mi organización',
        tenantId: tenantDeDemostracion,
      });
      const declaradas =
        datos.organization?.tenantType === 'PHARMACY'
          ? (pharmacy?.branches ?? [])
          : (diagnosticUnit?.branches ?? []).map((b) => {
              // El formulario manda `addressLines` suelto; el contrato de la API, `address.lines`.
              const lineas = b.address?.lines ?? (b as { addressLines?: readonly string[] }).addressLines;
              return {
                ...b,
                ...(b.description === undefined && lineas?.length ? { description: lineas.join(', ') } : {}),
              };
            });
      sumarSucursalesDelAlta(
        tenantDeDemostracion,
        declaradas.flatMap((b) => (b.name ? [{ ...b, name: b.name }] : [])),
      );
    }

    return {
      tenantId: nuevoId('tenant-nuevo'),
      code: datos.organization?.code ?? 'ORG-NUEVA',
      ownerUserId,
      status: 'PENDING_VERIFICATION',
      verificationStatus: 'PENDING',
      emailVerificationSent: true,
      ...(legalDocuments === undefined
        ? {}
        : { legalDocumentsRegistered: Object.values(legalDocuments).filter(Boolean).length }),
      ...(representativesRegistered === undefined ? {} : { representativesRegistered }),
      // Como la API: la unidad sólo nace si el alta declaró el bloque.
      ...(diagnosticUnit === undefined ? {} : { diagnosticUnitId: nuevoId('unidad-diagnostica') }),
      // Como la API (P50): toda farmacia nace con su fila y su casa central.
      ...(tipoDeOrganizacion === 'PHARMACY' ? { pharmacyId: nuevoId('farmacia') } : {}),
      // Como la API: el bloque se persiste en la misma transacción del alta.
      ...(datos.organization?.medicalFacility === undefined ? {} : { medicalFacilityRegistered: true }),
    };
  });

  // La firma o el sello del alta de médico (`uploadSignatureImage` de la API):
  // sólo imagen, hasta 2 MB. Devuelve el `fileId` que el alta reclama.
  router.post('/iam/auth/upload-registration-signature-image', ({ body }) => {
    const archivo = typeof FormData !== 'undefined' && body instanceof FormData ? body.get('file') : null;
    if (!(archivo instanceof Blob)) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'No se recibió contenido en el campo "file"',
        error: 'Unprocessable Entity',
      });
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
      return reply(415, { statusCode: 415, code: 'VALIDATION_FAILED', message: 'La imagen debe ser PNG, JPEG o WebP' });
    }
    if (archivo.size > MAX_SIGNATURE_IMAGE_BYTES) {
      return reply(422, { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'La imagen supera el límite de 2 MB' });
    }
    return leerComoDataUrl(archivo).then((dataUrl) => ({
      status: 201,
      body: {
        fileId: guardarImagenDeDataUrl(dataUrl, archivo instanceof File ? archivo.name : 'firma.png'),
        originalName: archivo instanceof File ? archivo.name : 'firma.png',
        sizeBytes: archivo.size,
        mimeType: archivo.type,
      },
    }));
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

  const mockBorradoresOnboarding = new Map<string, unknown>();

  router.get('/iam/onboarding-drafts/:formType/:draftId', (req: MockRequest) => {
    const clave = `${req.params['formType']}_${req.params['draftId']}`;
    return mockBorradoresOnboarding.get(clave) ?? null;
  });

  router.put('/iam/onboarding-drafts/:formType/:draftId', ({ params, body }) => {
    const clave = `${params['formType']}_${params['draftId']}`;
    const nuevo = !mockBorradoresOnboarding.has(clave);
    mockBorradoresOnboarding.set(clave, body);
    // Como la API: el PUT que crea devuelve el secreto una sola vez.
    return nuevo
      ? { ok: true, savedAt: new Date().toISOString(), draftSecret: `mock-${params['draftId']}` }
      : { ok: true, savedAt: new Date().toISOString() };
  });

  router.delete('/iam/onboarding-drafts/:formType/:draftId', ({ params }) => {
    const clave = `${params['formType']}_${params['draftId']}`;
    mockBorradoresOnboarding.delete(clave);
    return { ok: true };
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
    message: 'Si la cuenta existe, le reenviamos el correo de verificación.',
  }));

  router.post('/iam/auth/forgot-password', () => ({
    message: 'Si la cuenta existe, le enviamos un enlace para restablecer la contraseña.',
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
      statusConceptId: STATUS['ST-ACTIVE']!,
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

  // Ficha de una cuenta. Igual que la API (`@Roles('SECURITY_ADMIN')`): sin
  // ese rol, 403 —así la plantilla de una organización tiene que saber
  // degradar a «nombre no disponible» también en la maqueta—.
  router.get('/iam/users/:id', ({ params, user }) => {
    const roles = user?.roles ?? [];
    if (!roles.includes('SECURITY_ADMIN') && !roles.includes('SUPERADMIN')) {
      return forbidden('Se requiere SECURITY_ADMIN para leer la ficha de una cuenta');
    }
    const i = MOCK_USERS.findIndex((u) => u.id === params['id']);
    const base = MOCK_USERS[i];
    if (base !== undefined) {
      return {
        id: base.id,
        displayName: base.displayName,
        statusConceptId: STATUS['ST-ACTIVE']!,
        emailVerified: true,
        lastLoginAt: iso(-i, 9),
        createdAt: iso(-400 + i * 7, 8),
      };
    }
    return (
      usuariosAdicionales.find((u) => u.id === params['id']) ?? notFound('Usuario no encontrado')
    );
  });

  router.post('/iam/users', ({ body }) => {
    const datos = cuerpo<{ displayName?: string; email?: string }>({ body });
    const nuevo: UsuarioListado = {
      id: nuevoId('user'),
      displayName: datos.displayName ?? 'Usuario nuevo',
      statusConceptId: STATUS['ST-PENDING']!,
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
      statusConceptId: STATUS['ST-PENDING']!,
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
