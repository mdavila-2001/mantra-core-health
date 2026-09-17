import { ESTABLECIMIENTO, ESTADO, PARENTESCO, TIPO_VINCULO, displayDe } from '../fixtures/conceptos';
import {
  afiliaciones,
  CATEGORIA_MEDICO,
  credencialesDe,
  especialidadesDe,
  idiomasDe,
  licenciasDe,
  MEDICA,
  PACIENTE,
  PACIENTES,
  pacientePorId,
  pacientes,
  personasRelacionadasDe,
  PROFESIONALES,
  profesionalPorId,
  type AfiliacionSimulada,
  type PacienteSimulado,
  type ProfesionalSimulado,
} from '../fixtures/personas';
import { conflict, forbidden, noContent, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, contiene, cuerpo, iso, isoDia, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Perfiles: pacientes, profesionales, guía y afiliaciones.
    ========================================================================== */

function pacienteDeSesion(request: MockRequest): PacienteSimulado | undefined {
  const pid = request.user?.patientProfileId;
  if (pid !== undefined) return pacientePorId(pid);
  // Un profesional también puede tener su propio perfil de paciente.
  if (request.user?.key === 'medica') return PACIENTE;
  return undefined;
}

function profesionalDeSesion(request: MockRequest): ProfesionalSimulado | undefined {
  const hpid = request.user?.practitionerProfileId;
  return hpid === undefined ? undefined : profesionalPorId(hpid);
}

function itemDeLista(p: PacienteSimulado) {
  return {
    profileId: p.id,
    personId: p.personId,
    patientCode: p.patientCode,
    displayName: p.displayName,
    birthDate: p.birthDate,
    personStatusConceptId: p.deceased ? ESTADO['ST-INACTIVE']! : ESTADO['ST-ACTIVE']!,
    deceased: p.deceased,
  };
}

function fichaDe(p: PacienteSimulado) {
  return {
    profileId: p.id,
    personId: p.personId,
    patientCode: p.patientCode,
    masterPatientIndexCode: `MPI-${p.patientCode.slice(4)}`,
    displayName: p.displayName,
    birthDate: p.birthDate,
    ...(p.generoId === undefined ? {} : { administrativeGenderConceptId: p.generoId }),
    ...(p.sexoId === undefined ? {} : { sexAtBirthConceptId: p.sexoId }),
    genderIdentityConceptId: null,
    nationalityConceptId: null,
    preferredLanguageConceptId: null,
    personStatusConceptId: p.deceased ? ESTADO['ST-INACTIVE']! : ESTADO['ST-ACTIVE']!,
    vitalStatusConceptId: p.deceased ? ESTADO['ST-DECEASED']! : ESTADO['ST-ALIVE']!,
    deceasedAt: p.deceased ? iso(-40) : null,
    aboGroupConceptId: null,
    rhFactorConceptId: null,
    insuranceStatusConceptId: p.aseguradora === undefined ? null : ESTADO['ST-ACTIVE']!,
    clinicalLanguageConceptId: null,
    recordLinkageStatusConceptId: ESTADO['ST-LINKED']!,
    relatedPersons: personasRelacionadasDe(p),
    createdAt: iso(-400),
    updatedAt: iso(-3),
  };
}

function perfilPropioDe(p: PacienteSimulado) {
  return {
    personId: p.personId,
    patientProfileId: p.id,
    name: p.name,
    ...(p.middleName === undefined ? {} : { middleName: p.middleName }),
    lastName: p.lastName,
    motherLastName: p.motherLastName,
    displayName: p.displayName,
    birthDate: p.birthDate,
    ...(p.sexAtBirth === undefined ? {} : { sexAtBirth: p.sexAtBirth }),
    occupationConceptId: p.ocupacionId,
    phone: p.phone,
    residenceMunicipalityConceptId: p.municipioId,
    identityVerified: p.identityVerified,
    patientCode: p.patientCode,
    nationalId: p.nationalId,
    issuerAdministrativeAreaConceptId: p.departamentoId,
    taxId: `${p.nationalId}011`,
    taxHolderName: p.displayName,
    email: p.email,
    ...(p.photoFileId === undefined ? {} : { photoFileId: p.photoFileId }),
    // El punto guardado manda sobre el de ejemplo: si no, editar la ubicación
    // «funcionaba» y al recargar volvía el de la plaza principal.
    //
    // `null` en los dos extremos es «lo quitaron» (subtarea B.2): a
    // diferencia de `undefined` —«nunca se tocó», que en la casa cae al
    // punto de ejemplo—, un punto quitado no vuelve a aparecer. Sin esta
    // distinción, `PATCH` con `null`/`null` y el `mock-store.actualizar`
    // (`{ ...actual, ...cambios }`) dejaban la columna en `undefined`, que es
    // exactamente «nunca se tocó»: quitar el pin de la casa lo devolvía al
    // punto de la plaza principal en el siguiente `GET`.
    homeAddress: {
      lines: p.direccion,
      city: displayDe(p.municipioId),
      municipalityConceptId: p.municipioId,
      ...(p.homeLat === null && p.homeLng === null
        ? {}
        : p.homeLat === undefined || p.homeLng === undefined
          ? { latitude: -17.78, longitude: -63.18 }
          : { latitude: p.homeLat, longitude: p.homeLng }),
    },
    workAddress: {
      lines: p.direccionTrabajo ?? 'Av. Cañoto esq. Landívar, piso 3',
      city: displayDe(p.municipioId),
      municipalityConceptId: p.municipioId,
      ...(p.workLat === null || p.workLat === undefined || p.workLng === null || p.workLng === undefined
        ? {}
        : { latitude: p.workLat, longitude: p.workLng }),
    },
    coverages:
      p.aseguradora === undefined
        ? []
        : [{ id: `coverage-${p.id}`,
            carrierName: p.aseguradora,
            planName: p.plan,
            isPublic: false,
            policyIdentifier: `POL-${p.patientCode.slice(4)}`,
            memberIdentifier: `AF-${p.patientCode.slice(4)}`,
            verified: true,
            status: 'Cobertura activa',
            statusCode: 'COVERAGE_ACTIVE',
            validityStatus: 'CURRENT',
            referenceDate: isoDia(0),
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-12-31',
            currencyCode: 'BOB',
            carrierWhatsappNumber: '+59170011223',
            carrierCallCenterPhone: '800-10-6060',
            benefits: [
              { id: `benefit-general-${p.id}`, categoryName: 'Atención ambulatoria', coveragePercent: '80.50', copayAmount: '20.00', deductibleAmount: null, effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', validityStatus: 'CURRENT' },
              { id: `benefit-service-${p.id}`, categoryName: 'Atención ambulatoria', serviceConceptId: uuid('benefit-consultation'), serviceName: 'Consulta de seguimiento', coveragePercent: '100', copayAmount: '0.00', deductibleAmount: '150.00', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', validityStatus: 'CURRENT' },
            ] },
            { id: `coverage-expired-${p.id}`, carrierName: p.aseguradora, planName: 'Plan anterior', isPublic: false,
              policyIdentifier: `POL-ANT-${p.patientCode.slice(4)}`, verified: true, status: 'Cobertura activa',
              statusCode: 'COVERAGE_ACTIVE', validityStatus: 'EXPIRED', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31',
              carrierWhatsappNumber: '+59170011223', benefits: [],
            },
            { id: `coverage-future-${p.id}`, carrierName: p.aseguradora, planName: 'Plan próxima renovación', isPublic: false,
              memberIdentifier: `DECL-${p.patientCode.slice(4)}`, verified: false, status: 'Cobertura activa',
              statusCode: 'COVERAGE_ACTIVE', validityStatus: 'UPCOMING', effectiveFrom: '2027-01-01', effectiveTo: '2027-12-31',
              currencyCode: 'USD', carrierCallCenterPhone: '800-10-6060', benefits: [],
            }],
    guardians: personasRelacionadasDe(p).map((r) => ({
      displayName: r.displayName,
      relationshipConceptId: r.relationshipConceptId,
      isEmergencyContact: r.isEmergencyContact,
      isLegalGuardian: r.isLegalGuardian,
      phone: '+591 70011223',
    })),
  };
}

export function perfilProfesionalDe(p: ProfesionalSimulado) {
  return {
    profileId: p.id,
    personId: p.personId,
    practitionerCode: p.practitionerCode,
    displayName: p.displayName,
    professionalTitle: p.professionalTitle,
    professionalBio: p.professionalBio,
    photoFileId: p.photoFileId,
    email: p.email,
    phone: p.phone,
    workEmail: p.email,
    personalEmail: `${p.slug}@gmail.mock`,
    mobilePhone: p.phone,
    workMobilePhone: p.phone.replace(/\d$/, '9'),
    workLandline: '+591 3 3456789',
    name: p.name,
    lastName: p.lastName,
    motherLastName: p.motherLastName,
    birthDate: p.birthDate,
    nationalId: p.nationalId,
    issuerAdministrativeAreaConceptId: p.departamentoId,
    residenceMunicipalityConceptId: p.municipioId,
    homeAddress: { lines: p.direccion, city: p.ciudad, municipalityConceptId: p.municipioId, latitude: p.lat, longitude: p.lng },
    practitionerCategoryConceptId: CATEGORIA_MEDICO,
    verificationStatusConceptId: p.verified ? ESTADO['ST-VERIFIED']! : ESTADO['ST-PENDING']!,
    practiceStatusConceptId: ESTADO['ST-ACTIVE']!,
    acceptsNewPatients: p.acceptsNewPatients,
    telehealthAvailable: p.telehealthAvailable,
    specialties: especialidadesDe(p),
    credentials: credencialesDe(p),
    licenses: licenciasDe(p),
    languages: idiomasDe(p),
    affiliations: afiliaciones.filtrar((a) => a.practitionerProfileId === p.id),
    activity: { encounters: 312, medicationRequests: 208, clinicalNotes: 275, documents: 41 },
    createdAt: iso(-500),
  };
}

function itemDeGuia(p: ProfesionalSimulado) {
  return {
    profileId: p.id,
    practitionerCode: p.practitionerCode,
    displayName: p.displayName,
    professionalTitle: p.professionalTitle,
    photoFileId: p.photoFileId,
    verificationStatusConceptId: p.verified ? ESTADO['ST-VERIFIED']! : ESTADO['ST-PENDING']!,
    verified: p.verified,
    acceptsNewPatients: p.acceptsNewPatients,
    telehealthAvailable: p.telehealthAvailable,
    specialties: p.especialidades.map((specialtyConceptId, i) => ({ specialtyConceptId, isPrimary: i === 0 })),
    workplaces: [p.organizacion, `Consultorio ${p.lastName}`],
  };
}


/* ---- dependientes (B.1) ---------------------------------------------------
   El apoderamiento vive acá y no en los fixtures porque nace en la sesión: no
   hay dependientes de ejemplo, los crea quien los registra. */

/** Un apoderamiento vigente, tal como lo guarda la maqueta. */
interface ApoderamientoSimulado {
  readonly id: string;
  readonly titularId: string;
  readonly dependienteId: string;
  readonly relationshipConceptId: string;
}

const apoderamientos: ApoderamientoSimulado[] = [];

/** Los apoderamientos de un titular. */
function dependientesDe(titularId: string): readonly ApoderamientoSimulado[] {
  return apoderamientos.filter((a) => a.titularId === titularId);
}

/**
 * Si esa sesión puede actuar por ese paciente.
 *
 * Lo exportan los otros manejadores —agenda, clínica— para no repetir el
 * criterio: es la misma pregunta que la API resuelve contra
 * `patient_portal_proxies`.
 */
export function representaA(titularId: string | undefined, pacienteId: string): boolean {
  if (titularId === undefined) return false;
  return apoderamientos.some(
    (a) => a.titularId === titularId && a.dependienteId === pacienteId,
  );
}

/**
 * Qué es el dependiente para quien lo representa, ya dado vuelta.
 *
 * Espeja `describeDependentRelationship` de la API: la maqueta tiene que decir
 * lo mismo que el servidor, o la pantalla se vería distinta según contra qué
 * corra.
 */
function parentescoInvertido(conceptId: string): { code: string; display: string } {
  const codigo = Object.entries(PARENTESCO).find(([, id]) => id === conceptId)?.[0];
  if (codigo === 'RELATIONSHIP_MOTHER' || codigo === 'RELATIONSHIP_FATHER') {
    return { code: 'CHILD', display: 'Hijo/a' };
  }
  if (codigo === 'RELATIONSHIP_CHILD') return { code: 'PARENT', display: 'Padre/Madre' };
  if (codigo === 'RELATIONSHIP_SPOUSE') return { code: 'SPOUSE', display: 'Cónyuge' };
  if (codigo === 'RELATIONSHIP_GUARDIAN') return { code: 'WARD', display: 'Tutelado/a' };
  return { code: 'OTHER', display: 'Otro/a' };
}

/** El resumen que devuelve la API para cada dependiente. */
function resumenDeDependiente(apoderamiento: ApoderamientoSimulado) {
  const p = pacientePorId(apoderamiento.dependienteId);
  const relacion = parentescoInvertido(apoderamiento.relationshipConceptId);
  return {
    id: apoderamiento.id,
    patientProfileId: apoderamiento.dependienteId,
    personId: p?.personId ?? apoderamiento.dependienteId,
    fullName: p?.displayName ?? '',
    ...(p?.name === undefined || p.name === '' ? {} : { name: p.name }),
    ...(p?.lastName === undefined || p.lastName === '' ? {} : { lastName: p.lastName }),
    ...(p?.birthDate === undefined || p.birthDate === ''
      ? {}
      : { birthDate: p.birthDate, ageYears: edadEnAnios(p.birthDate) }),
    ...(p?.nationalId === undefined || p.nationalId === ''
      ? {}
      : { nationalId: p.nationalId }),
    relationshipCode: relacion.code,
    relationshipDisplay: relacion.display,
    isLegalGuardian: true,
  };
}

/** Edad cumplida, con la misma cuenta que hace el servidor. */
function edadEnAnios(fecha: string): number {
  const nacimiento = new Date(fecha);
  const hoy = new Date();
  let anios = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) anios -= 1;
  return Math.max(anios, 0);
}

export function registrarPerfiles(router: MockRouter): void {
  /* ---- pacientes ---------------------------------------------------------- */

  router.get('/profiles/patients', ({ query }) => {
    // `q`, no `query`: es como lo manda `ProfilesClient.searchPatients`. Leyendo
    // la clave equivocada el filtro nunca se aplicaba —`contiene(x, null)` es
    // `true`— y el buscador de pacientes devolvía la lista entera escribiera lo
    // que escribiera quien buscaba.
    const q = texto(query, 'q');
    const nationalId = texto(query, 'nationalId');
    const todos = pacientes
      .todos()
      .filter((p) => contiene(p.displayName, q) || contiene(p.patientCode, q) || contiene(p.nationalId, q))
      .filter((p) => nationalId === null || p.nationalId === nationalId)
      .map(itemDeLista);
    return paginar(todos, query, 25);
  });

  router.get('/profiles/patients/me/summary', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tenés perfil de paciente');
    return {
      personId: p.personId,
      patientProfileId: p.id,
      patientCode: p.patientCode,
      displayName: p.displayName,
      birthDate: p.birthDate,
      personStatus: 'ACTIVE',
      identityVerified: p.identityVerified,
    };
  });

  router.get('/profiles/patients/me', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tenés perfil de paciente');
    return perfilPropioDe(p);
  });

  /**
   * Las coordenadas de una dirección, tal como llegan en el PATCH.
   *
   * Los dos extremos viajan juntos o no viajan: media coordenada no ubica nada,
   * así que un cuerpo con sólo la latitud se ignora entero en vez de guardar un
   * punto imposible. `null` en los dos **quita** el punto, que es distinto de no
   * mandarlos —eso es «no lo toqué»— y por eso se distingue acá.
   *
   * **Devuelve `null`, no `undefined`, al quitar** (subtarea B.2). El
   * docstring de arriba ya prometía la distinción y la implementación no la
   * cumplía: `mock-store.actualizar` funde con `{ ...actual, ...cambios }`,
   * y un `cambios.homeLat` en `undefined` pisa el valor guardado con
   * `undefined` — que es EXACTAMENTE «no lo toqué» para quien lee
   * `perfilPropioDe` después. El síntoma: quitar el pin de la casa y guardar
   * hacía volver el punto de la plaza principal en el siguiente `GET`, en vez
   * de dejar la dirección sin GPS.
   */
  function coordenadasDelCuerpo(
    cambios: Record<string, unknown>,
    cual: 'home' | 'work',
  ): Record<string, number | null | undefined> {
    const lat = cambios[`${cual}Latitude`];
    const lng = cambios[`${cual}Longitude`];
    if (lat === null && lng === null) {
      return { [`${cual}Lat`]: null, [`${cual}Lng`]: null };
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') return {};
    return { [`${cual}Lat`]: lat, [`${cual}Lng`]: lng };
  }

  router.patch('/profiles/patients/me', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tenés perfil de paciente');
    const cambios = cuerpo<Record<string, unknown>>(request);
    const actualizado = pacientes.actualizar(p.id, {
      ...(typeof cambios['name'] === 'string' ? { name: cambios['name'] } : {}),
      ...(typeof cambios['lastName'] === 'string' ? { lastName: cambios['lastName'] } : {}),
      ...(typeof cambios['motherLastName'] === 'string' ? { motherLastName: cambios['motherLastName'] } : {}),
      ...(typeof cambios['phone'] === 'string' ? { phone: cambios['phone'] } : {}),
      ...(typeof cambios['birthDate'] === 'string' ? { birthDate: cambios['birthDate'].slice(0, 10) } : {}),
      ...(typeof cambios['residenceMunicipalityConceptId'] === 'string' ? { municipioId: cambios['residenceMunicipalityConceptId'] } : {}),
      ...(typeof cambios['occupationConceptId'] === 'string' ? { ocupacionId: cambios['occupationConceptId'] } : {}),
      ...(typeof cambios['homeAddressLines'] === 'string' ? { direccion: cambios['homeAddressLines'] } : {}),
      // La dirección de trabajo no se guardaba: el contrato la declaraba, la
      // pantalla la mandaba y la maqueta la tiraba, así que editarla parecía
      // funcionar hasta recargar.
      ...(typeof cambios['workAddressLines'] === 'string'
        ? { direccionTrabajo: cambios['workAddressLines'] }
        : {}),
      ...coordenadasDelCuerpo(cambios, 'home'),
      ...coordenadasDelCuerpo(cambios, 'work'),
    });
    const conNombre = actualizado!;
    pacientes.actualizar(p.id, { displayName: `${conNombre.name}${conNombre.middleName ? ` ${conNombre.middleName}` : ''} ${conNombre.lastName} ${conNombre.motherLastName}` });
    return perfilPropioDe(pacientes.get(p.id)!);
  });

  router.put('/profiles/patients/me/photo', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound();
    const { fileId } = cuerpo<{ fileId: string }>(request);
    pacientes.actualizar(p.id, { photoFileId: fileId ?? uuid('foto-nueva') });
    return perfilPropioDe(pacientes.get(p.id)!);
  });

  router.delete('/profiles/patients/me/photo', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound();
    const { photoFileId: _quitada, ...resto } = pacientes.get(p.id)!;
    pacientes.agregar(resto as PacienteSimulado);
    return perfilPropioDe(pacientes.get(p.id)!);
  });

  router.get('/profiles/patients/merge-events', ({ query }) =>
    paginar(
      [
        {
          id: uuid('merge-1'),
          survivingPatientProfileId: PACIENTES[2]!.id,
          mergedPatientProfileId: uuid('pid-duplicado-1'),
          decisionStatus: 'MERGED',
          recordedAt: iso(-20),
        },
        {
          id: uuid('merge-2'),
          survivingPatientProfileId: PACIENTES[5]!.id,
          mergedPatientProfileId: uuid('pid-duplicado-2'),
          decisionStatus: 'REVERSED',
          reversalOfEventId: uuid('merge-1'),
          recordedAt: iso(-8),
        },
      ],
      query,
      25,
    ),
  );

  router.post('/profiles/patients/merge', (request) => {
    const datos = cuerpo<{ survivingPatientProfileId: string; mergedPatientProfileId: string }>(request);
    return {
      status: 201,
      body: {
        id: nuevoId('merge'),
        survivingPatientProfileId: datos.survivingPatientProfileId,
        mergedPatientProfileId: datos.mergedPatientProfileId,
        decisionStatus: 'MERGED',
        recordedAt: ahora(),
      },
    };
  });

  router.post('/profiles/patients/merge/:id/reverse', ({ params }) => ({
    id: nuevoId('merge-reverso'),
    survivingPatientProfileId: PACIENTES[2]!.id,
    mergedPatientProfileId: uuid('pid-duplicado-1'),
    decisionStatus: 'REVERSED',
    reversalOfEventId: params['id'],
    recordedAt: ahora(),
  }));

  router.get('/profiles/patients/:id', ({ params }) => {
    const p = pacientePorId(params['id']!);
    return p === undefined ? notFound('Paciente no encontrado') : fichaDe(p);
  });

  /* ---- dependientes (B.1) ------------------------------------------------- */

  /**
   * A quiénes representa la sesión.
   *
   * Se declara **antes** que `/profiles/patients/:id` a propósito: el router
   * elige por número de segmentos literales y gana el más específico, pero
   * dejarlo escrito en orden evita que un cambio futuro lo invierta sin que se
   * note.
   */
  router.get('/profiles/patients/me/dependents', (request) => {
    const titular = pacienteDeSesion(request);
    if (titular === undefined) return [];
    return dependientesDe(titular.id).map((d) => resumenDeDependiente(d));
  });

  /**
   * Alta de un dependiente.
   *
   * **La fila se guarda de verdad**, igual que el alta de mostrador: el
   * dependiente entra en la colección de pacientes, así que el conmutador lo
   * ofrece, las reservas lo encuentran y su historia se puede abrir. Devolver un
   * id inventado dejaría una tarjeta que no lleva a ninguna parte.
   */
  router.post('/profiles/patients/me/dependents', (request) => {
    const titular = pacienteDeSesion(request);
    if (titular === undefined) {
      return forbidden('Esta cuenta no tiene perfil de paciente');
    }
    const datos = cuerpo<{
      name?: string;
      middleName?: string;
      lastName?: string;
      motherLastName?: string;
      birthDate?: string;
      nationalId?: string;
      issuerAdministrativeAreaConceptId?: string;
      relationshipConceptId?: string;
    }>(request);

    const documento = datos.nationalId ?? '';
    if (documento !== '' && pacientes.todos().some((p) => p.nationalId === documento)) {
      return conflict('Ese documento ya está registrado en la plataforma', {
        nationalId: documento,
      });
    }

    const id = nuevoId('dependiente');
    const nombre = datos.name ?? '';
    const apellido = datos.lastName ?? '';
    const materno = datos.motherLastName ?? '';
    const nuevo: PacienteSimulado = {
      id,
      personId: uuid(`person-${id}`),
      userId: uuid(`user-${id}`),
      patientCode: `PAT-${Date.now() % 100000}`,
      displayName: [nombre, datos.middleName ?? '', apellido, materno]
        .filter((parte) => parte !== '')
        .join(' '),
      name: nombre,
      ...(datos.middleName === undefined ? {} : { middleName: datos.middleName }),
      lastName: apellido,
      motherLastName: materno,
      birthDate: datos.birthDate ?? '',
      nationalId: documento,
      email: '',
      phone: '',
      municipioId: '',
      departamentoId: datos.issuerAdministrativeAreaConceptId ?? '',
      ocupacionId: '',
      direccion: '',
      deceased: false,
      identityVerified: false,
    };
    pacientes.agregar(nuevo);
    apoderamientos.push({
      id: nuevoId('proxy'),
      titularId: titular.id,
      dependienteId: id,
      relationshipConceptId: datos.relationshipConceptId ?? '',
    });

    return { status: 201, body: resumenDeDependiente(apoderamientos.at(-1)!) };
  });

  router.post('/profiles/patients/:id/related-persons', ({ params }) => ({
    status: 201,
    body: { id: nuevoId('related'), patientProfileId: params['id'], personId: nuevoId('person'), status: 'ACTIVE', createdAt: ahora() },
  }));

  /**
   * Alta de un paciente hecha por personal.
   *
   * **La fila se guarda de verdad.** Antes se devolvía un `profileId` inventado
   * que no quedaba en ninguna parte: el `GET /profiles/patients/:id` siguiente
   * respondía 404, el paciente recién creado no aparecía al buscarlo y una cita
   * agendada con él salía sin nombre en la agenda. Ahora entra en la colección,
   * que es lo que hace utilizable el alta desde el mostrador.
   *
   * Lo que el mostrador no pregunta —sexo, domicilio, correo— **no se
   * inventa**: queda vacío, y la ficha ya sabe mostrarse sin eso.
   */
  router.post('/profiles/patients', (request) => {
    const datos = cuerpo<{
      patientCode?: string;
      displayName?: string;
      name?: string;
      middleName?: string;
      lastName?: string;
      motherLastName?: string;
      birthDate?: string;
      nationalId?: string;
      phone?: string;
      occupationConceptId?: string;
      issuerAdministrativeAreaConceptId?: string;
    }>(request);
    const id = nuevoId('paciente');
    const nombre = datos.name ?? '';
    const apellido = datos.lastName ?? '';
    const materno = datos.motherLastName ?? '';
    const nuevo: PacienteSimulado = {
      id,
      personId: uuid(`person-${id}`),
      userId: uuid(`user-${id}`),
      patientCode: datos.patientCode ?? `PAC-${Date.now() % 100000}`,
      displayName: datos.displayName ?? [nombre, apellido, materno].filter((p) => p !== '').join(' '),
      name: nombre,
      ...(datos.middleName === undefined ? {} : { middleName: datos.middleName }),
      lastName: apellido,
      motherLastName: materno,
      birthDate: datos.birthDate ?? '',
      nationalId: datos.nationalId ?? '',
      email: '',
      phone: datos.phone ?? '',
      municipioId: '',
      departamentoId: datos.issuerAdministrativeAreaConceptId ?? '',
      ocupacionId: datos.occupationConceptId ?? '',
      direccion: '',
      deceased: false,
      // Nace sin identidad probada: nadie verificó nada en el mostrador.
      identityVerified: false,
    };
    pacientes.agregar(nuevo);
    return {
      status: 201,
      body: { profileId: nuevo.id, personId: nuevo.personId, patientCode: nuevo.patientCode, recordLinkageStatus: 'UNLINKED', createdAt: ahora() },
    };
  });

  /* ---- profesionales ------------------------------------------------------ */

  router.get('/profiles/practitioners/me/summary', (request) => {
    const p = profesionalDeSesion(request);
    return p === undefined ? notFound('No tenés perfil profesional') : perfilProfesionalDe(p);
  });

  router.get('/profiles/practitioners/me/onboarding', (request) => {
    const p = profesionalDeSesion(request);
    if (p === undefined) return notFound('No tenés perfil profesional');
    const completo = p.id === MEDICA.id;
    return {
      practitionerProfileId: p.id,
      steps: [
        { key: 'professional-data', complete: true, missing: [] },
        { key: 'photo', complete: true, missing: [] },
        { key: 'organizations', complete: completo, missing: completo ? [] : ['Vinculá al menos una organización'] },
        { key: 'schedule', complete: completo, missing: completo ? [] : ['Publicá un horario de atención'] },
        { key: 'review', complete: completo, missing: completo ? [] : ['Revisión pendiente'] },
      ],
      firstIncomplete: completo ? 'done' : 'organizations',
    };
  });

  router.patch('/profiles/practitioners/me', (request) => {
    const p = profesionalDeSesion(request);
    if (p === undefined) return notFound();
    const cambios = cuerpo<Record<string, unknown>>(request);
    return { ...perfilProfesionalDe(p), ...soloTextos(cambios) };
  });

  router.get('/profiles/practitioners/specialty-counts', () => {
    const conteo = new Map<string, number>();
    for (const p of PROFESIONALES) {
      for (const e of p.especialidades) conteo.set(e, (conteo.get(e) ?? 0) + 1);
    }
    return {
      items: [...conteo.entries()].map(([specialtyConceptId, practitionerCount]) => ({ specialtyConceptId, practitionerCount })),
      practitionerTotal: PROFESIONALES.length,
      withoutSpecialtyCount: PROFESIONALES.filter((p) => p.especialidades.length === 0).length,
    };
  });

  router.get('/profiles/practitioners', ({ query }) => {
    const q = texto(query, 'query') ?? texto(query, 'q');
    const especialidad = texto(query, 'specialtyConceptId');
    const sinEspecialidad = query.get('withoutSpecialty') === 'true';
    const soloVerificados = query.get('verified') === 'true';
    const todos = PROFESIONALES.filter((p) => contiene(p.displayName, q) || contiene(p.professionalTitle, q))
      .filter((p) => especialidad === null || p.especialidades.includes(especialidad))
      .filter((p) => !sinEspecialidad || p.especialidades.length === 0)
      .filter((p) => !soloVerificados || p.verified)
      .map(itemDeGuia);
    return paginar(todos, query, 20);
  });

  router.get('/profiles/practitioners/me/affiliations', (request) => {
    const p = profesionalDeSesion(request);
    const items = p === undefined ? [] : afiliaciones.filtrar((a) => a.practitionerProfileId === p.id);
    return { items, count: items.length };
  });

  router.post('/profiles/practitioners/me/affiliations', (request) => {
    const p = profesionalDeSesion(request);
    if (p === undefined) return forbidden();
    const datos = cuerpo<{ organizationName: string; roleTitle?: string; startDate: string; endDate?: string; practiceSiteId?: string; affiliationTypeConceptId?: string }>(request);
    if (afiliaciones.filtrar((a) => a.practitionerProfileId === p.id && a.organizationName === datos.organizationName && a.startDate === datos.startDate).length > 0) {
      return conflict('Ese vínculo ya está en el historial laboral');
    }
    const nueva: AfiliacionSimulada = {
      id: nuevoId('aff'),
      practitionerProfileId: p.id,
      organizationName: datos.organizationName ?? 'Organización',
      roleTitle: datos.roleTitle ?? null,
      practiceSiteId: datos.practiceSiteId ?? null,
      affiliationTypeConceptId: datos.affiliationTypeConceptId ?? TIPO_VINCULO['AFF-PLANTA']!,
      startDate: datos.startDate ?? isoDia(0),
      endDate: datos.endDate ?? null,
      current: datos.endDate === undefined,
      status: datos.practiceSiteId === undefined ? 'DECLARED' : 'PENDING',
      statusKind: datos.practiceSiteId === undefined ? 'declarado' : 'pendiente',
      decisionReasonText: null,
      createdAt: ahora(),
    };
    afiliaciones.agregar(nueva);
    return { status: 201, body: nueva };
  });

  router.patch('/profiles/practitioners/me/affiliations/:id', (request) => {
    const actual = afiliaciones.get(request.params['id']!);
    if (actual === undefined) return notFound();
    const datos = cuerpo<Partial<AfiliacionSimulada>>(request);
    return afiliaciones.actualizar(actual.id, { ...datos, current: (datos.endDate ?? actual.endDate) === null });
  });

  router.delete('/profiles/practitioners/me/affiliations/:id', ({ params }) => {
    afiliaciones.borrar(params['id']!);
    return noContent();
  });

  router.post('/profiles/practitioners/me/credentials', () => ({ status: 201, body: { id: nuevoId('cred') } }));
  router.delete('/profiles/practitioners/me/credentials/:id', () => noContent());

  router.get('/profiles/practitioners/me/linkable-organizations', ({ query }) => {
    const q = texto(query, 'query') ?? texto(query, 'q');
    const items = Object.entries(ESTABLECIMIENTO)
      .map(([code, facilityConceptId], i) => ({
        facilityConceptId,
        code,
        name: displayDe(facilityConceptId),
        municipality: ['Santa Cruz de la Sierra', 'La Paz', 'Cochabamba'][i % 3]!,
        type: ['Clínica', 'Hospital', 'Hospital', 'Clínica', 'Laboratorio', 'Centro de imagen'][i]!,
        address: `Av. Principal N.º ${100 + i * 40}`,
      }))
      .filter((o) => contiene(o.name, q));
    return { items, count: items.length, limit: 20 };
  });

  router.get('/profiles/practitioners/:id/summary', ({ params }) => {
    const p = profesionalPorId(params['id']!);
    return p === undefined ? notFound('Profesional no encontrado') : perfilProfesionalDe(p);
  });

  router.put('/profiles/practitioners/:id/photo', ({ params }) => {
    const p = profesionalPorId(params['id']!);
    return p === undefined ? notFound() : perfilProfesionalDe(p);
  });

  router.post('/profiles/practitioners/:id/specialties', () => ({ status: 201, body: { id: nuevoId('spec') } }));
  router.post('/profiles/practitioners/:id/jurisdiction-authorizations', () => ({ status: 201, body: { id: nuevoId('jur') } }));

  router.post('/profiles/practitioners', (request) => {
    const datos = cuerpo<{ practitionerCode: string }>(request);
    const id = nuevoId('hpid');
    return {
      status: 201,
      body: {
        profileId: id,
        personId: uuid(`person-${id}`),
        practitionerCode: datos.practitionerCode ?? 'MED-NUEVO',
        verificationStatus: 'PENDING',
        practiceStatus: 'ACTIVE',
        licenseId: uuid(`lic-${id}`),
        credentialId: uuid(`cred-${id}`),
        createdAt: ahora(),
      },
    };
  });

  router.post('/profiles/persons/:personId/account-links', ({ params }) => ({
    status: 201,
    body: { id: nuevoId('link'), personId: params['personId'], userId: nuevoId('user'), status: 'ACTIVE', validFrom: ahora() },
  }));
}

function soloTextos(cambios: Record<string, unknown>): Record<string, string | boolean> {
  return Object.fromEntries(
    Object.entries(cambios).filter(([, v]) => typeof v === 'string' || typeof v === 'boolean'),
  ) as Record<string, string | boolean>;
}
