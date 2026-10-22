import { HttpErrorResponse } from '@angular/common/http';

import { readApiError, type ApiErrorBody } from '../../../core/http/api-error';
import { offline, unexpectedError, validation } from '../../../core/view-state/view-state';
import type { ViewState, ViewStateIssue } from '../../../core/view-state/view-state.types';

/**
 * Catálogo de errores de las altas públicas (03/10/2026).
 *
 * ## Por qué existe
 *
 * Las seis pantallas de alta mostraban el error tal como lo manda la API, y la
 * API le habla a un programador, no a quien se está registrando:
 * `organization.legalRepresentative.idNumber must be longer than or equal to 4
 * characters`, «Un tenant de tipo PHARMACY exige país y jurisdicción»,
 * «ThrottlerException: Too Many Requests». Encima se veía sólo el primero.
 *
 * Este catálogo traduce **cada** respuesta que el backend puede dar en
 * `register-patient`, `register-practitioner` y `register-organization` a un
 * mensaje que dice tres cosas: **qué pasó, en qué dato, y qué hacer**. Lo que no
 * es culpa de la persona —una regla de configuración, un servicio caído— lo dice
 * así, y le da el código para que soporte lo encuentre.
 *
 * ## Cómo se ramifica
 *
 * Por `code` del contrato de errores, como `errorToViewState`. Dentro de un
 * mismo código, por `details` cuando el backend lo manda (`document`, `field`)
 * y, sólo cuando no lo manda, por el texto del mensaje: los mensajes de las altas
 * están escritos en castellano y fijados por sus pruebas, pero si alguno cambia
 * de redacción el catálogo **no se rompe**: cae en el genérico de su código, que
 * igual explica qué hacer.
 */

/** Qué alta falló: cambia qué dato puede estar repetido. */
export type RegistrationKind = 'patient' | 'practitioner' | 'organization';

/** Para que un mismo campo se lea igual en todos los mensajes. */
const FIELDS: Readonly<Record<string, string>> = {
  nationalId: 'Número de documento',
  issuerAdministrativeAreaConceptId: 'Departamento donde se emitió el documento',
  residenceMunicipalityConceptId: 'Ciudad donde vive',
  workMunicipalityConceptId: 'Ciudad donde trabaja',
  password: 'Contraseña',
  name: 'Primer nombre',
  middleName: 'Segundo nombre',
  lastName: 'Apellido paterno',
  motherLastName: 'Apellido materno',
  displayName: 'Nombre',
  fullName: 'Nombre completo',
  email: 'Correo electrónico',
  personalEmail: 'Correo personal',
  workEmail: 'Correo del trabajo',
  birthDate: 'Fecha de nacimiento',
  phone: 'Celular',
  mobilePhone: 'Celular',
  workMobilePhone: 'Celular del trabajo',
  workLandline: 'Teléfono fijo del trabajo',
  sexAtBirth: 'Sexo',
  gender: 'Género',
  licenseNumber: 'Matrícula profesional',
  credentialNumber: 'Registro del SEDES',
  sedesLicenseNumber: 'Registro del SEDES',
  licenseIssueDate: 'Fecha de inscripción de la matrícula',
  homeAddressLines: 'Dirección de su domicilio',
  workAddressLines: 'Dirección de su trabajo',
  guardianName: 'Nombre del contacto de emergencia',
  guardianPhone: 'Celular del contacto de emergencia',
  occupationFreeText: 'Ocupación',
  workEmployerFreeText: 'Lugar de trabajo',
  code: 'Sigla de la organización',
  legalName: 'Razón social',
  legalEntityType: 'Tipo de sociedad',
  taxIdentifier: 'NIT',
  idNumber: 'Documento de identidad',
  powerOfAttorneyFileId: 'Poder notariado',
  constitutionFileId: 'Escritura de constitución',
  taxIdentifierFileId: 'Documento del NIT',
  commerceRegistryFileId: 'Matrícula de comercio (SEPREC)',
  operatingLicenseFileId: 'Licencia de funcionamiento',
  healthAuthorityCertificateFileId: 'Certificado del SEDES',
  lines: 'Dirección',
  latitude: 'Ubicación en el mapa',
  longitude: 'Ubicación en el mapa',
};

/** De quién es el dato, según el bloque del cuerpo en el que viene. */
const OWNERS: Readonly<Record<string, string>> = {
  legalRepresentative: 'del representante legal',
  owner: 'de la cuenta',
  generalManager: 'de la gerencia general',
  commercialManager: 'de la gerencia comercial',
  marketingManager: 'de la gerencia de marketing',
  primarySite: 'de la casa central',
  address: '',
};

const SUPPORT = 'Si el problema sigue, escríbanos a soporte con este código:';

/**
 * El estado que la pantalla de alta muestra para un fallo del envío.
 *
 * @param error - Lo que llegó del `subscribe`.
 * @param kind - Qué alta se intentó: decide cómo leer un dato repetido.
 */
export function registrationErrorToViewState(
  error: unknown,
  kind: RegistrationKind,
): ViewState<null> {
  if (!(error instanceof HttpErrorResponse)) {
    return unexpectedError(
      'sin-id',
      'No pudimos enviar su registro por un error inesperado. Sus datos siguen cargados: vuelva a intentar.',
    );
  }
  if (error.status === 0) {
    return offline();
  }

  const body = readApiError(error);
  const codigo = body?.correlationId ?? error.headers.get('x-request-id') ?? 'sin-id';
  if (body === null) {
    return unexpectedError(codigo, downServer());
  }

  switch (body.code) {
    case 'VALIDATION_FAILED':
      return validation(invalidData(body));
    case 'CONFLICT':
      return validation([repeatedData(body, kind)]);
    case 'PRECONDITION_FAILED':
      return businessRule(body, codigo);
    case 'PAYLOAD_TOO_LARGE':
      return validation([
        {
          code: body.code,
          message:
            'Uno de los archivos es demasiado grande: el máximo es 10 MB. Comprimí el PDF o escanealo con menos resolución, subilo de nuevo y vuelva a enviar.',
        },
      ]);
    case 'RATE_LIMITED':
      return validation(
        [{ code: body.code, message: attemptsTooMany(error) }],
        waitingSeconds(error),
      );
    default:
      return unexpectedError(codigo, downServer());
  }
}

/* ---------------------------------------------------------------- 400 */

/**
 * Todos los campos mal, juntos, cada uno con su nombre y su regla.
 *
 * El primer `issue` lleva el mensaje completo —las pantallas muestran el
 * primero— y los siguientes, uno por campo, para quien los quiera anclar.
 */
function invalidData(body: ApiErrorBody): readonly ViewStateIssue[] {
  const crudas = body.details?.['violations'] ?? body.details?.['messages'];
  const violaciones = Array.isArray(crudas)
    ? crudas.filter((v): v is string => typeof v === 'string')
    : [];

  const porCampo = new Map<string, { etiqueta: string; reglas: Set<Rule>; libres: string[] }>();
  const sueltas: string[] = [];
  for (const violacion of violaciones) {
    const leida = readViolation(violacion);
    if (leida === null) {
      // Un mensaje propio del DTO, ya escrito en castellano: va tal cual.
      sueltas.push(violacion);
      continue;
    }
    const entrada = porCampo.get(leida.ruta) ?? {
      etiqueta: leida.etiqueta,
      reglas: new Set(),
      libres: [],
    };
    if (leida.regla === null) entrada.libres.push(leida.resto);
    else entrada.reglas.add(leida.regla);
    porCampo.set(leida.ruta, entrada);
  }

  const problemas: { field?: string; texto: string }[] = [];
  for (const [ruta, { etiqueta, reglas, libres }] of porCampo) {
    problemas.push({ field: ruta, texto: `${etiqueta}: ${explainRules(reglas, libres)}` });
  }
  for (const suelta of sueltas) problemas.push({ texto: suelta });

  if (problemas.length === 0) {
    return [
      {
        code: body.code,
        message:
          'Algunos datos no tienen el formato que esperamos. Revise los pasos del formulario y vuelva a enviar.',
      },
    ];
  }

  const resumen =
    problemas.length === 1
      ? `Revise este dato y vuelva a enviar. ${problemas[0].texto}.`
      : `Revise estos ${problemas.length} datos y vuelva a enviar: ${problemas.map((p) => p.texto).join('; ')}.`;

  return [
    { code: body.code, message: resumen },
    ...problemas.map((p) => ({
      ...(p.field === undefined ? {} : { field: p.field }),
      code: body.code,
      message: p.texto,
    })),
  ];
}

type Rule =
  | { readonly tipo: 'obligatorio' }
  | { readonly tipo: 'minimo'; readonly n: number }
  | { readonly tipo: 'maximo'; readonly n: number }
  | { readonly tipo: 'correo' }
  | { readonly tipo: 'lista' }
  | { readonly tipo: 'fecha' }
  | { readonly tipo: 'opciones' }
  | { readonly tipo: 'formato' }
  | { readonly tipo: 'rango' };

/**
 * `class-validator` empieza cada mensaje por la ruta de la propiedad:
 * `organization.legalRepresentative.idNumber must be …`. Si no empieza así, es
 * un mensaje propio del DTO y no se toca.
 */
function readViolation(
  violacion: string,
): { ruta: string; etiqueta: string; regla: Rule | null; resto: string } | null {
  const m = /^([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)\s+((?:must|should|each)\b.*)$/.exec(violacion);
  if (m === null) return null;
  const ruta = m[1];
  const resto = m[2];
  return { ruta, etiqueta: labelOf(ruta), regla: ruleOf(resto), resto };
}

function ruleOf(texto: string): Rule | null {
  const min = /longer than or equal to (\d+)/.exec(texto);
  if (min) return { tipo: 'minimo', n: Number(min[1]) };
  const max = /shorter than or equal to (\d+)/.exec(texto);
  if (max) return { tipo: 'maximo', n: Number(max[1]) };
  if (/must be an email/.test(texto)) return { tipo: 'correo' };
  if (
    /should not be empty|must be a string|must be defined|must be a number|must be an array/.test(
      texto,
    )
  )
    return { tipo: 'obligatorio' };
  if (/must be a UUID/.test(texto)) return { tipo: 'lista' };
  if (/ISO 8601|must be a Date/.test(texto)) return { tipo: 'fecha' };
  if (/one of the following values/.test(texto)) return { tipo: 'opciones' };
  if (/must match .* regular expression/.test(texto)) return { tipo: 'formato' };
  if (/must not be (greater|less) than/.test(texto)) return { tipo: 'rango' };
  return null;
}

function explainRules(reglas: ReadonlySet<Rule>, libres: readonly string[]): string {
  const lista = [...reglas];
  const min = lista.find((r): r is Extract<Rule, { tipo: 'minimo' }> => r.tipo === 'minimo')?.n;
  const max = lista.find((r): r is Extract<Rule, { tipo: 'maximo' }> => r.tipo === 'maximo')?.n;
  const tiene = (tipo: Rule['tipo']) => lista.some((r) => r.tipo === tipo);

  const largo =
    min !== undefined && max !== undefined
      ? `entre ${min} y ${max} caracteres`
      : min !== undefined
        ? `al menos ${min} caracteres`
        : max !== undefined
          ? `como máximo ${max} caracteres`
          : null;

  const partes: string[] = [];
  if (tiene('obligatorio'))
    partes.push(largo === null ? 'falta completarlo' : `falta completarlo (${largo})`);
  else if (largo !== null) partes.push(`tiene que tener ${largo}`);
  if (tiene('correo'))
    partes.push('no es un correo válido; revise que tenga @ y un dominio, como nombre@correo.com');
  if (tiene('lista')) partes.push('no se eligió de la lista; vuelva a elegir una opción');
  if (tiene('fecha')) partes.push('no es una fecha válida; escríbala como DD/MM/AAAA');
  if (tiene('opciones')) partes.push('tiene un valor que no está entre las opciones permitidas');
  if (tiene('formato')) partes.push('tiene caracteres que no están permitidos');
  if (tiene('rango')) partes.push('está fuera del rango permitido');
  if (partes.length === 0 && libres.length > 0) partes.push('tiene un valor que no es válido');
  return partes.join('; ');
}

/** «organization.legalRepresentative.idNumber» → «Documento de identidad del representante legal». */
function labelOf(ruta: string): string {
  const segmentos = ruta.split('.');
  const hoja = segmentos[segmentos.length - 1];
  const base = FIELDS[hoja] ?? 'Uno de los datos';
  const dueno = [...segmentos.slice(0, -1)]
    .reverse()
    .find((s) => OWNERS[s] !== undefined && OWNERS[s] !== '');
  const sucursal = /branches\.(\d+)/.exec(ruta);
  if (sucursal) return `${base} de la sucursal ${Number(sucursal[1]) + 1}`;
  return dueno === undefined ? base : `${base} ${OWNERS[dueno]}`;
}

/* ---------------------------------------------------------------- 409 */

function repeatedData(body: ApiErrorBody, kind: RegistrationKind): ViewStateIssue {
  const texto = body.message;
  if (/correo/i.test(texto)) {
    return {
      field: 'email',
      code: body.code,
      message:
        kind === 'organization'
          ? 'Ya hay una cuenta registrada con el correo del representante legal. Si la organización ya tiene cuenta, inicie sesión con ese correo o use «¿Olvidó su contraseña?». Si no, use otro correo.'
          : 'Ya hay una cuenta registrada con este correo electrónico. Si es suya, inicie sesión o use «¿Olvidó su contraseña?». Si no, escriba otro correo en el paso «Su acceso».',
    };
  }
  if (/documento/i.test(texto)) {
    return {
      field: 'nationalId',
      code: body.code,
      message:
        'Ya hay una cuenta registrada con este número de documento. Si es suya, inicie sesión con su documento y su contraseña, o use «¿Olvidó su contraseña?». Si cree que es un error, escríbanos a soporte.',
    };
  }
  if (/c[oó]digo de organizaci[oó]n|organizaci[oó]n con ese c[oó]digo/i.test(texto)) {
    return {
      field: 'code',
      code: body.code,
      message:
        'Ya hay una organización registrada con esta sigla o este NIT. Revise si su organización ya tiene cuenta (inicie sesión con el correo del representante) o cambie la sigla en el primer paso.',
    };
  }
  if (/practitioner_code/i.test(texto)) {
    return {
      code: body.code,
      message:
        'Tuvimos un choque momentáneo al crear su cuenta. No es un error en sus datos: vuelva a enviar.',
    };
  }
  // El genérico de la base: un índice único sin control propio en el servicio.
  return {
    code: body.code,
    message:
      kind === 'patient'
        ? 'Alguno de sus datos ya está registrado en otra cuenta. Si ya tiene cuenta, inicie sesión con su número de documento o use «¿Olvidó su contraseña?». Si no, escríbanos a soporte.'
        : 'Alguno de los datos ya está registrado en otra cuenta, casi siempre el correo. Pruebe con otro correo, o inicie sesión si la cuenta es suya.',
  };
}

/* ---------------------------------------------------------------- 422 */

function businessRule(body: ApiErrorBody, codigo: string): ViewState<null> {
  const texto = body.message;
  const documento =
    typeof body.details?.['document'] === 'string' ? body.details['document'] : null;
  const campo = typeof body.details?.['field'] === 'string' ? body.details['field'] : null;
  const pide = (field: string, message: string) =>
    validation([{ field, code: body.code, message }]);

  if (documento === 'powerOfAttorneyFileId' || /poder notariado/i.test(texto)) {
    return pide(
      'powerOfAttorneyFileId',
      'Falta el poder notariado del representante legal. Sólo una empresa unipersonal puede registrarse sin él. Adjúntelo en el paso «Representante legal» (PDF, hasta 10 MB) y vuelva a enviar.',
    );
  }
  if (documento === 'constitutionFileId' || /escritura de constitución/i.test(texto)) {
    return pide(
      'constitutionFileId',
      'Falta la escritura de constitución de la empresa. Sólo una empresa unipersonal puede omitirla. Adjúntela en el paso de documentos (PDF, hasta 10 MB) y vuelva a enviar.',
    );
  }
  if (campo === 'issuerAdministrativeAreaConceptId' || /departamento emisor/i.test(texto)) {
    return pide(
      'issuerAdministrativeAreaConceptId',
      'Elija el departamento donde se emitió su carnet de identidad, en el paso «Su documento de identidad», y vuelva a enviar.',
    );
  }
  if (/tipo societario pertenece/i.test(texto)) {
    return pide(
      'legalEntityType',
      'El tipo de sociedad elegido no corresponde al país de la empresa. Vuelva al primer paso, elija el país correcto y un tipo de sociedad de su lista.',
    );
  }
  if (/título|credentials/i.test(texto)) {
    return pide(
      'credentials',
      'Revise sus títulos profesionales: cada título que agregue tiene que tener su número. Si no lo tiene a mano, quite ese título y agréguelo después desde su perfil.',
    );
  }
  if (/infectado/i.test(texto)) {
    return validation([
      {
        code: body.code,
        message:
          'Uno de los archivos fue rechazado por el antivirus. Suba una copia limpia del documento y vuelva a enviar.',
      },
    ]);
  }
  if (/formato admitido/i.test(texto)) {
    return validation([
      {
        code: body.code,
        message:
          'Uno de los archivos no tiene un formato admitido. Suba el documento en PDF y vuelva a enviar.',
      },
    ]);
  }
  if (/archivo subido|versión vigente|está borrado/i.test(texto)) {
    return validation([
      {
        code: body.code,
        message:
          'No pudimos validar uno de los documentos adjuntos. Quitalo, vuelva a subirlo y enviá de nuevo.',
      },
    ]);
  }
  // País, jurisdicción, bloques por tipo, conceptos del catálogo: reglas que la
  // pantalla debería cumplir sola. Si llegan acá, el error es nuestro.
  return unexpectedError(
    codigo,
    `No pudimos completar el registro por un problema de configuración de nuestra parte; no es un error en sus datos. ${SUPPORT}`,
  );
}

/* ---------------------------------------------------------- 429 · 5xx */

function attemptsTooMany(error: HttpErrorResponse): string {
  const segundos = waitingSeconds(error);
  const espera =
    segundos === undefined ? 'un minuto' : segundos === 1 ? '1 segundo' : `${segundos} segundos`;
  return `Hubo demasiados intentos seguidos desde su conexión. Por seguridad, espere ${espera} y vuelva a enviar: sus datos siguen cargados.`;
}

function waitingSeconds(error: HttpErrorResponse): number | undefined {
  const header = error.headers.get('retry-after');
  const segundos = header === null ? NaN : Number(header);
  return Number.isFinite(segundos) && segundos > 0 ? segundos : undefined;
}

function downServer(): string {
  return `No pudimos crear su cuenta por un problema en nuestros servidores; no es un error en sus datos. Sus datos siguen cargados: vuelva a intentar en unos minutos. ${SUPPORT}`;
}
