import { ROLE_ASSIGNMENT_STATUS } from '../../data-access/practice-sites/role-assignment-concepts';
import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS, PRACTICE_SANLUCAS, SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from '../fixtures/agenda';
import { CARGO, SPECIALTY, STATUS, PROCEDIMIENTO, displayOf } from '../fixtures/concepts';
import { DENTAL_FEE_SCHEDULE, MEDICAL_FEE_SCHEDULE } from '../fixtures/fee-schedules.generated';
import { MEDICAL, PROFESSIONALS, professionalById } from '../fixtures/people';
import { hospitalRoleAssignmentsOf, myAffiliations, requestAffiliation, CM_PRACTICES } from '../fixtures/role-assignments';
import { noContent, notFound, type MockRouter } from '../mock-router';
import { infraestructuraDeLaConsola, tenantDePractica } from './infrastructure.handlers';
import { TENANT_CLINICA, TENANT_HOSPITAL } from '../mock-session';
import { ahora, avatarSvg, Coleccion, contiene, cuerpo, iso, isoDia, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Prácticas, consultorios, catálogo de servicios y la consola de la
    organización médica.
    ========================================================================== */

const TIPO_PRACTICA = { CLINIC: uuid('concept-practice-type-clinic'), HOSPITAL: uuid('concept-practice-type-hospital'), OFFICE: uuid('concept-practice-type-office') } as const;

/** La práctica sirve a tres clientes con formas distintas: se devuelven todos los campos que alguno espera. */
export const PRACTICAS = [
  { id: PRACTICE_OLIVOS, code: 'OLIVOS', name: 'Clínica Los Olivos', status: 'ACTIVE', typeConceptId: TIPO_PRACTICA.CLINIC, statusConceptId: STATUS['ST-ACTIVE']!, currencyConceptId: uuid('concept-currency-bob'), timeZone: 'America/La_Paz' },
  { id: PRACTICE_SANLUCAS, code: 'SANLUCAS', name: 'Hospital San Lucas', status: 'ACTIVE', typeConceptId: TIPO_PRACTICA.HOSPITAL, statusConceptId: STATUS['ST-ACTIVE']!, currencyConceptId: uuid('concept-currency-bob'), timeZone: 'America/La_Paz' },
  { id: PRACTICE_CONSULTORIO, code: 'ROJAS', name: 'Consultorio Dra. Rojas', status: 'ACTIVE', typeConceptId: TIPO_PRACTICA.OFFICE, statusConceptId: STATUS['ST-ACTIVE']!, currencyConceptId: uuid('concept-currency-bob'), timeZone: 'America/La_Paz' },
];

export { servicios, asegurarCitaMedica, type ServicioSimulado } from './practice-services.mock';
import { servicios, asegurarCitaMedica, MONEDA_BOB, type ServicioSimulado } from './practice-services.mock';

/* El nomenclador son los dos aranceles reales que entregó el propietario: el
   de honorarios médicos del Colegio Médico de Santa Cruz (en UMA) y el
   odontológico 2026 (en dólares). Antes eran veinte prestaciones inventadas en
   bolivianos, con un `ocrSuspect` repartido cada nueve filas. Ver
   `fee-schedules.generated.ts`. */
const NOMENCLADOR = [...MEDICAL_FEE_SCHEDULE, ...DENTAL_FEE_SCHEDULE].map((item) => ({
  conceptId: uuid(`nomenclador-${item.code}`),
  code: item.code,
  display: item.display,
  specialty: item.specialty,
  group: item.specialty,
  referencePrice: item.referencePrice,
  priceUnit: item.priceUnit,
  ocrSuspect: item.ocrSuspect,
}));

/**
 * La entrada del arancel que corresponde a un concepto.
 *
 * La usa la maqueta de seguros para resolver el nombre del servicio de una
 * cláusula: la cláusula guarda el mismo `conceptId` que el servicio del médico
 * importado del arancel, y ese es el único id que los dos comparten.
 */
export function procedimientoPorConceptId(conceptId: string) {
  return NOMENCLADOR.find((item) => item.conceptId === conceptId);
}

/* ---- el catálogo que una organización publica en su ficha ---------------- */

/**
 * Un servicio tal como lo lee alguien de afuera: sin práctica, sin cuenta de
 * ingresos y sin código impositivo. Es el espejo de `PublicOfferedService`.
 */
export interface ServicioPublicado {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: string | null;
  readonly currency: string | null;
  readonly isActive: boolean;
}

/**
 * Qué práctica está detrás de la ficha pública de una organización.
 *
 * Sólo las dos que el simulador modela de verdad. Con esto, la ficha de
 * «Clínica Los Olivos» muestra **el mismo catálogo** que la Dra. Rojas edita en
 * «Mis servicios»: un demo donde la clínica publica una lista y su médica ve
 * otra se lee como dos productos distintos.
 */
const PRACTICA_POR_SLUG: Readonly<Record<string, string>> = {
  'clinica-los-olivos': PRACTICE_OLIVOS,
  'hospital-san-lucas': PRACTICE_SANLUCAS,
};

/** Un entero estable por slug: el mismo catálogo en cada recarga y en cada máquina. */
function semilla(slug: string): number {
  return parseInt(uuid(`catalogo-${slug}`).slice(0, 8), 16);
}

/**
 * El catálogo que publica una organización.
 *
 * Las que tienen práctica modelada publican **sus** servicios. Las demás —los
 * hospitales y clínicas del resto del país— publican un tramo del nomenclador,
 * elegido por el slug y por eso siempre el mismo: son procedimientos reales del
 * catálogo del simulador con su precio de referencia, no importes inventados
 * tarjeta por tarjeta.
 */
export function serviciosPublicadosDe(slug: string): readonly ServicioPublicado[] {
  const practiceId = PRACTICA_POR_SLUG[slug];
  const propios =
    practiceId === undefined
      ? []
      : servicios.filtrar((s) => s.practiceId === practiceId).map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          description: s.descriptionText ?? null,
          // Un cero es «nadie declaró el arancel», no «es gratis»: viaja como
          // `null` y la ficha lo dice con palabras.
          price: Number(s.defaultPrice) === 0 ? null : s.defaultPrice,
          currency: Number(s.defaultPrice) === 0 ? null : s.currencyCode,
          isActive: s.isActive,
        }));
  if (propios.length > 0) {
    return propios;
  }

  const base = semilla(slug);
  const cuantos = 6 + (base % 7);
  return Array.from({ length: cuantos }, (_, i) => {
    const n = NOMENCLADOR[(base + i * 3) % NOMENCLADOR.length]!;
    return {
      id: uuid(`public-service-${slug}-${n.code}`),
      code: n.code,
      name: n.display,
      description: `${n.specialty} · prestación del nomenclador.`,
      price: n.referencePrice,
      currency: n.priceUnit,
      isActive: true,
    };
  });
}

interface VinculacionSimulada {
  readonly id: string;
  readonly practiceId: string;
  readonly practiceName: string;
  readonly practiceType: string | null;
  readonly practiceSiteId: string | null;
  readonly roleConceptId: string;
  readonly specialtyConceptId: string | null;
  readonly status: string;
  readonly isPrimary: boolean;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly createdAt: string;
  readonly avatarUrl: string | null;
  readonly practitionerProfileId: string;
  /**
   * La organización (tenant) de la práctica, como la devuelve la vinculación.
   * Solo la traen las prácticas que son organizaciones de la sesión de la médica
   * (`mock-session.ts`): con las demás no hay dónde publicar, y no se ofrecen.
   */
  readonly tenantId?: string;
}

/**
 * El estado de una vinculación, **como concepto**.
 *
 * El backend real emite el identificador del concepto —`PRAC.RA_STATUS_*`— y la
 * interfaz lo traduce con `roleAssignmentStatusLabel`, que compara contra los
 * cinco UUID de `role-assignment-concepts.ts`. El simulador mandaba el enum
 * corto en texto plano, así que ninguno casaba y la tabla de «Mis
 * vinculaciones» mostraba **«Estado desconocido» en las cuatro filas** — el
 * mismo defecto que tenían los trámites de identidad, con otra tabla.
 *
 * Se sigue escribiendo el enum corto en los datos, que es lo que se lee al
 * mantenerlos, y se traduce al salir.
 */
const CONCEPTO_DE_VINCULACION: Readonly<Record<string, string>> = {
  PENDING: ROLE_ASSIGNMENT_STATUS.PENDING,
  ACTIVE: ROLE_ASSIGNMENT_STATUS.ACTIVE,
  SUSPENDED: ROLE_ASSIGNMENT_STATUS.SUSPENDED,
  REJECTED: ROLE_ASSIGNMENT_STATUS.REJECTED,
  ENDED: ROLE_ASSIGNMENT_STATUS.ENDED,
};

/** El concepto del estado, o el enum tal cual si no está en la tabla. */
function conceptoDeVinculacion(estado: string): string {
  return CONCEPTO_DE_VINCULACION[estado] ?? estado;
}

const vinculaciones = new Coleccion<VinculacionSimulada>([
  { id: uuid('ra-olivos'), practiceId: PRACTICE_OLIVOS, practiceName: 'Clínica Los Olivos', practiceType: 'Clínica', practiceSiteId: SITIO_OLIVOS.id, roleConceptId: CARGO['ROLE-JEFE']!, specialtyConceptId: SPECIALTY['CARDIOLOGIA']!, status: 'ACTIVE', isPrimary: true, validFrom: isoDia(-900), validTo: null, createdAt: iso(-900), avatarUrl: avatarSvg('Clínica Los Olivos', '#0f766e'), practitionerProfileId: MEDICAL.id, tenantId: TENANT_CLINICA },
  { id: uuid('ra-sanlucas'), practiceId: PRACTICE_SANLUCAS, practiceName: 'Hospital San Lucas', practiceType: 'Hospital', practiceSiteId: SITIO_SANLUCAS.id, roleConceptId: CARGO['ROLE-MEDICO']!, specialtyConceptId: SPECIALTY['CARDIOLOGIA']!, status: 'PENDING', isPrimary: false, validFrom: null, validTo: null, createdAt: iso(-4), avatarUrl: avatarSvg('Hospital San Lucas', '#7c3aed'), practitionerProfileId: MEDICAL.id, tenantId: TENANT_HOSPITAL },
  { id: uuid('ra-japones'), practiceId: uuid('practice-japones'), practiceName: 'Hospital Japonés', practiceType: 'Hospital', practiceSiteId: null, roleConceptId: CARGO['ROLE-RESIDENTE']!, specialtyConceptId: null, status: 'ENDED', isPrimary: false, validFrom: isoDia(-3000), validTo: isoDia(-1500), createdAt: iso(-3000), avatarUrl: null, practitionerProfileId: MEDICAL.id },
  { id: uuid('ra-foianini'), practiceId: uuid('practice-foianini'), practiceName: 'Clínica Foianini', practiceType: 'Clínica', practiceSiteId: null, roleConceptId: CARGO['ROLE-MEDICO']!, specialtyConceptId: SPECIALTY['MEDICINA_INTERNA']!, status: 'REJECTED', isPrimary: false, validFrom: null, validTo: null, createdAt: iso(-40), avatarUrl: avatarSvg('Clínica Foianini', '#b45309'), practitionerProfileId: MEDICAL.id },
]);

const sitiosPropios = new Coleccion<{ id: string; practiceId: string; code: string; name: string; timeZone: string | null; addressText: string | null; latitude: number | null; longitude: number | null; status: string; practitionerProfileId: string; contactPhone: string | null; bankQrFileId: string | null; logoFileId: string | null }>([
  // Sólo el consultorio propio arranca con QR bancario cargado: las otras tres
  // sedes quedan sin él para que el aviso en ámbar —«todavía no configuraste
  // ninguno»— se vea en la misma lista que el estado ya resuelto.
  { ...SITIO_CONSULTORIO, practiceId: PRACTICE_CONSULTORIO, latitude: -17.7863, longitude: -63.1812, status: 'ACTIVE', practitionerProfileId: MEDICAL.id, contactPhone: '+591 72123456', bankQrFileId: uuid('file-qr-consultorio'), logoFileId: uuid('file-logo-consultorio') },
  { ...SITIO_OLIVOS, practiceId: PRACTICE_OLIVOS, latitude: -17.7712, longitude: -63.1955, status: 'ACTIVE', practitionerProfileId: MEDICAL.id, contactPhone: '+591 33445566', bankQrFileId: null, logoFileId: null },
  // Dos sedes más para la médica: con cuatro, «Dónde atiende» de su ficha
  // pública pasa de una página y se puede ver el paginado funcionando.
  { ...SITIO_SANLUCAS, practiceId: PRACTICE_SANLUCAS, latitude: -17.762, longitude: -63.19, status: 'ACTIVE', practitionerProfileId: MEDICAL.id, contactPhone: null, bankQrFileId: null, logoFileId: null },
  { id: uuid('site-equipetrol-rojas'), name: 'Centro Médico Equipetrol', code: 'EQUIPETROL', addressText: 'Calle Las Palmas N.º 55, Equipetrol, Santa Cruz de la Sierra', timeZone: 'America/La_Paz', practiceId: PRACTICE_OLIVOS, latitude: -17.7648, longitude: -63.1978, status: 'ACTIVE', practitionerProfileId: MEDICAL.id, contactPhone: null, bankQrFileId: null, logoFileId: null },
]);

/**
 * Los lugares donde atiende alguien, con el propio primero.
 *
 * Vive acá —al lado de la colección— y se exporta porque **dos superficies
 * preguntan lo mismo**: `GET /practitioners/:id/sites`, que exige sesión, y la
 * ficha pública, que es anónima. Antes sólo existía la primera, y por eso la
 * ficha no sabía decir dónde atiende nadie (P16).
 *
 * El propio va primero a propósito: es el único que no depende de que una
 * organización lo haya aceptado, así que es el que un profesional recién
 * registrado tiene para ofrecer.
 */
export function sedesDe(practitionerProfileId: string): readonly SedeDeProfesional[] {
  const own = sitiosPropios
    .filtrar((s) => s.practitionerProfileId === practitionerProfileId)
    .map(({ practitionerProfileId: _p, ...s }) => ({
      ...s,
      isOwnSite: s.practiceId === PRACTICE_CONSULTORIO,
    }));
  if (own.length > 0) {
    return [...own].sort((a, b) => Number(b.isOwnSite) - Number(a.isOwnSite));
  }

  // Quien no cargó ninguna atiende donde su organización: es lo que el padrón
  // sabe de él, y decir «no atiende en ningún lado» sería falso.
  const p = professionalById(practitionerProfileId);
  if (p === undefined) return [];
  const deLaOrganizacion = p.organizacion === 'Hospital San Lucas' ? SITIO_SANLUCAS : SITIO_OLIVOS;
  return [
    {
      ...deLaOrganizacion,
      practiceId: p.organizacion === 'Hospital San Lucas' ? PRACTICE_SANLUCAS : PRACTICE_OLIVOS,
      latitude: p.lat,
      longitude: p.lng,
      status: 'ACTIVE',
      isOwnSite: false,
      contactPhone: null,
      // Una sede deducida de la organización no es una fila de nadie, así que
      // no hay dónde guardarle un QR: se responde «sin configurar».
      bankQrFileId: null,
      logoFileId: null,
    },
  ];
}

/** Una sede tal como la devuelve {@link sedesDe}. */
export interface SedeDeProfesional {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly timeZone: string | null;
  readonly addressText: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: string;
  /** Si es el consultorio propio y no una sede de una organización. */
  readonly isOwnSite: boolean;
  readonly contactPhone: string | null;
  /** El QR bancario con el que el profesional cobra acá, o `null`. */
  readonly bankQrFileId: string | null;
  /** El logo del consultorio, o `null`. Sólo simulador: ver `LogoDelConsultorioClient`. */
  readonly logoFileId: string | null;
}

function concepto(code: string, display: string) {
  return { code, display };
}

export function registrarPracticas(router: MockRouter): void {
  /* Las prácticas **del tenant activo**, como la API (`GET /practices`
     responde «las prácticas activas del tenant»). Sin cabecera —las pruebas
     unitarias del simulador— se devuelven todas. Los centros médicos de CM-07
     (`CM_PRACTICES`) no tienen árbol de infraestructura ni tenant en la
     maqueta: se ofrecen siempre, como antes, para que el médico pueda pedir
     afiliarse a uno. */
  router.get('/practices', ({ headers }) => {
    const tenant = headers.get('X-Tenant-Id');
    if (tenant === null) return [...PRACTICAS, ...CM_PRACTICES];
    const propias = PRACTICAS.filter((p) => tenantDePractica(p.id) === tenant);
    return [...propias, ...CM_PRACTICES];
  });

  router.get('/billing/service-catalog', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    if (practiceId !== null) asegurarCitaMedica(practiceId);
    const q = texto(query, 'query') ?? texto(query, 'q');
    const isActive = query.get('isActive');
    const todos = servicios
      .todos()
      .filter((s) => practiceId === null || s.practiceId === practiceId)
      .filter((s) => contiene(s.name, q) || contiene(s.code, q))
      .filter((s) => isActive === null || String(s.isActive) === isActive);
    return paginar(todos, query, 25);
  });

  router.post('/billing/service-catalog', (request) => {
    const datos = cuerpo<ServicioSimulado>(request);
    const nuevo = servicios.agregar({
      id: nuevoId('service'),
      practiceId: datos.practiceId ?? PRACTICE_OLIVOS,
      code: datos.code ?? 'NUEVO',
      name: datos.name ?? 'Servicio nuevo',
      ...(datos.serviceConceptId === undefined ? {} : { serviceConceptId: datos.serviceConceptId }),
      defaultPrice: datos.defaultPrice ?? '0.00',
      currencyConceptId: datos.currencyConceptId ?? MONEDA_BOB,
      currencyCode: 'BOB',
      isActive: datos.isActive ?? true,
      ...(datos.descriptionText === undefined ? {} : { descriptionText: datos.descriptionText }),
    });
    return { status: 201, body: nuevo };
  });

  router.patch('/billing/service-catalog/:id', (request) => {
    const s = servicios.get(request.params['id']!);
    if (s === undefined) return notFound('Servicio no encontrado');
    return servicios.actualizar(s.id, cuerpo<Partial<ServicioSimulado>>(request));
  });

  router.get('/billing/service-catalog/procedure-specialties', () => {
    const conteo = new Map<string, number>();
    for (const n of NOMENCLADOR) conteo.set(n.specialty, (conteo.get(n.specialty) ?? 0) + 1);
    // Envuelto en `items`, como lo lee `listProcedureSpecialties()`: con el
    // arreglo pelado el importador leía `body.items` → `undefined.map` y la
    // pantalla del arancel se caía entera. Ordenado en español, como el servidor.
    const items = [...conteo.entries()]
      .map(([specialty, count]) => ({ specialty, count }))
      .sort((a, b) => a.specialty.localeCompare(b.specialty, 'es'));
    return { items };
  });

  router.get('/billing/service-catalog/procedures', ({ query }) => {
    const specialty = texto(query, 'specialty');
    const q = texto(query, 'query') ?? texto(query, 'q');
    const todos = NOMENCLADOR.filter((n) => specialty === null || n.specialty === specialty).filter((n) => contiene(n.display, q) || contiene(n.code, q));
    const pagina = paginar(todos, query, 25);
    return { items: pagina.items, nextCursor: pagina.nextCursor };
  });

  /* ---- consultorios y vinculaciones --------------------------------------- */

  router.get('/practitioners/me/role-assignments', (request) => {
    const hpid = request.user?.practitionerProfileId;
    const own = vinculaciones.filtrar((v) => v.practitionerProfileId === hpid).map(({ practitionerProfileId: _p, ...v }) => ({ ...v, status: conceptoDeVinculacion(v.status) }));
    return [...own, ...hospitalRoleAssignmentsOf(request.user?.id), ...myAffiliations(hpid ?? '')];
  });

  router.post('/practices/:id/role-assignments/self-request', (request) => {
    const practica = PRACTICAS.find((p) => p.id === request.params['id']);
    const datos = cuerpo<{ practiceSiteId?: string; roleConceptId?: string; specialtyConceptId?: string; healthcareServiceId?: string; validFrom?: string }>(request);
    if (datos.healthcareServiceId !== undefined) return requestAffiliation(request.params['id']!, datos.practiceSiteId, datos.healthcareServiceId, request.user?.practitionerProfileId ?? MEDICAL.id);
    const nueva = vinculaciones.agregar({
      id: nuevoId('ra'),
      practiceId: request.params['id']!,
      practiceName: practica?.name ?? 'Organización',
      practiceType: 'Clínica',
      practiceSiteId: datos.practiceSiteId ?? null,
      roleConceptId: datos.roleConceptId ?? CARGO['ROLE-MEDICO']!,
      specialtyConceptId: datos.specialtyConceptId ?? null,
      status: 'PENDING',
      isPrimary: false,
      validFrom: datos.validFrom ?? null,
      validTo: null,
      createdAt: ahora(),
      avatarUrl: null,
      practitionerProfileId: request.user?.practitionerProfileId ?? MEDICAL.id,
    });
    return { status: 201, body: { id: nueva.id, practiceId: nueva.practiceId, practitionerProfileId: nueva.practitionerProfileId, status: nueva.status, createdAt: nueva.createdAt } };
  });

  /* `isOwnSite` viaja: es lo que separa «mi consultorio» de «un hospital donde
     me aceptaron», y sin él las dos cosas se dibujaban idénticas, con el mismo
     botón «Retirar» al lado — cuando retirar lo propio y desvincularse de un
     hospital no son el mismo acto. La maqueta ya lo calculaba y lo tiraba justo
     antes de responder (P32). */
  router.get('/practitioners/:id/sites', ({ params }) => {
    // La misma regla que usa la ficha pública: una sola, y acá con sesión.
    const items = sedesDe(params['id']!);
    return { items, count: items.length };
  });

  router.post('/practitioners/me/sites', (request) => {
    asegurarCitaMedica(PRACTICE_CONSULTORIO);
    const datos = cuerpo<{ name: string; timeZone?: string; contactPhone?: string; address?: { lines: string[]; city?: string; latitude?: number; longitude?: number } }>(request);
    const nuevo = sitiosPropios.agregar({
      id: nuevoId('site'),
      practiceId: PRACTICE_CONSULTORIO,
      code: (datos.name ?? 'SITIO').slice(0, 8).toUpperCase().replace(/\s+/g, '-'),
      name: datos.name ?? 'Consultorio nuevo',
      timeZone: datos.timeZone ?? 'America/La_Paz',
      addressText: datos.address === undefined ? null : [...datos.address.lines, datos.address.city ?? ''].filter((l) => l !== '').join(', '),
      latitude: datos.address?.latitude ?? null,
      longitude: datos.address?.longitude ?? null,
      status: 'ACTIVE',
      practitionerProfileId: request.user?.practitionerProfileId ?? MEDICAL.id,
      contactPhone: datos.contactPhone ?? null,
      // Un consultorio recién creado no tiene con qué cobrar todavía: el QR se
      // carga después, desde su propia fila.
      bankQrFileId: null,
      logoFileId: null,
    });
    const { practitionerProfileId: _p, ...resto } = nuevo;
    return { status: 201, body: { ...resto, isOwnSite: resto.practiceId === PRACTICE_CONSULTORIO } };
  });

  /* Corregir el consultorio propio, como `PATCH /practitioners/me/sites/:id`
     de la API (P32). Sin esto un error de tipeo en el nombre o una mudanza
     obligaban a retirarlo y volver a crearlo, lo que cambia el id que la
     agenda referencia. */
  router.patch('/practitioners/me/sites/:id', (request) => {
    const sitio = sitiosPropios.get(request.params['id']!);
    if (sitio === undefined) return notFound('Consultorio no encontrado');
    const datos = cuerpo<{ name?: string; timeZone?: string; address?: { lines: string[]; city?: string; latitude?: number; longitude?: number } }>(request);
    const direccion =
      datos.address === undefined
        ? {}
        : {
            addressText: [...datos.address.lines, datos.address.city ?? ''].filter((l) => l !== '').join(', '),
            latitude: datos.address.latitude ?? null,
            longitude: datos.address.longitude ?? null,
          };
    const actualizado = sitiosPropios.actualizar(sitio.id, {
      ...(datos.name === undefined ? {} : { name: datos.name }),
      ...(datos.timeZone === undefined ? {} : { timeZone: datos.timeZone }),
      ...direccion,
    });
    if (actualizado === undefined) return notFound('Consultorio no encontrado');
    const { practitionerProfileId: _p, ...resto } = actualizado;
    return { ...resto, isOwnSite: resto.practiceId === PRACTICE_CONSULTORIO };
  });

  /* El QR bancario de una sede. Ruta propia y no parte del `PATCH` de arriba:
     aquél corrige el consultorio **propio** y esto se configura también en la
     clínica donde el profesional atiende sin ser dueño de la sede — lo que se
     guarda no es la sede, es con qué cobra él en ella (P33). */
  router.put('/practitioners/me/sites/:id/bank-qr', (request) => {
    const sitio = sitiosPropios.get(request.params['id']!);
    if (sitio === undefined) return notFound('Consultorio no encontrado');
    const { fileId } = cuerpo<{ fileId: string | null }>(request);
    const actualizado = sitiosPropios.actualizar(sitio.id, { bankQrFileId: fileId ?? null });
    if (actualizado === undefined) return notFound('Consultorio no encontrado');
    const { practitionerProfileId: _p, ...resto } = actualizado;
    return { ...resto, isOwnSite: resto.practiceId === PRACTICE_CONSULTORIO };
  });

  router.put('/practitioners/me/sites/:id/contact-phone', (request) => {
    const sitio = sitiosPropios.get(request.params['id']!);
    if (sitio === undefined || sitio.practitionerProfileId !== (request.user?.practitionerProfileId ?? MEDICAL.id)) {
      return notFound('Lugar de atención no encontrado');
    }
    const { contactPhone } = cuerpo<{ contactPhone: string | null }>(request);
    const actualizado = sitiosPropios.actualizar(sitio.id, { contactPhone: contactPhone?.trim() || null });
    if (actualizado === undefined) return notFound('Lugar de atención no encontrado');
    const { practitionerProfileId: _p, ...resto } = actualizado;
    return { ...resto, isOwnSite: resto.practiceId === PRACTICE_CONSULTORIO };
  });

  /* SIMULADOR: el logo del consultorio. La API real no tiene esta ruta ni este
     campo; las pantallas no la llaman directo sino por
     `LogoDelConsultorioClient`. Sólo el consultorio **propio** lleva logo: en
     una clínica ajena no es mío. */
  router.put('/practitioners/me/sites/:id/logo', (request) => {
    const sitio = sitiosPropios.get(request.params['id']!);
    if (sitio === undefined || sitio.practiceId !== PRACTICE_CONSULTORIO) {
      return notFound('Consultorio no encontrado');
    }
    const { fileId } = cuerpo<{ fileId: string | null }>(request);
    const actualizado = sitiosPropios.actualizar(sitio.id, { logoFileId: fileId ?? null });
    if (actualizado === undefined) return notFound('Consultorio no encontrado');
    const { practitionerProfileId: _p, ...resto } = actualizado;
    return { ...resto, isOwnSite: true };
  });

  router.delete('/practitioners/me/sites/:id', ({ params }) => {
    sitiosPropios.borrar(params['id']!);
    return noContent();
  });

  /* ---- consola de la organización ----------------------------------------- */

  router.get('/practices/:id/organization', ({ params, headers }) => {
    const practica = PRACTICAS.find((p) => p.id === params['id']);
    if (practica === undefined) return notFound('Práctica no encontrada');
    // Una práctica de otro tenant responde igual que una inexistente (S6).
    const tenant = headers.get('X-Tenant-Id');
    if (tenant !== null && tenantDePractica(practica.id) !== tenant) return notFound('Práctica no encontrada');
    const esHospital = practica.id === PRACTICE_SANLUCAS;
    const sitio = esHospital ? SITIO_SANLUCAS : practica.id === PRACTICE_CONSULTORIO ? SITIO_CONSULTORIO : SITIO_OLIVOS;
    /* Sedes, áreas y espacios salen del árbol de F1 (`infrastructure.handlers`):
       los recuentos se cuentan, `branchId` es la sucursal real y los estados
       usan los códigos que la consola sabe pintar. Antes eran números fijos
       (6 áreas y 24 espacios para 6 áreas y 12 espacios listados), todos los
       badges caían en `info` y los quirófanos de Intervenciones no existían. */
    const { sites: sitios, clinicalUnits: unidades, careSpaces: espacios } = infraestructuraDeLaConsola(practica.id);
    const personal = PROFESSIONALS.filter((p) => (esHospital ? p.organizacion === 'Hospital San Lucas' : p.organizacion === 'Clínica Los Olivos')).map((p, i) => ({
      id: uuid(`staff-${practica.code}-${p.id}`),
      practitionerProfileId: p.id,
      practitionerName: p.displayName,
      siteId: sitio.id,
      clinicalUnitId: unidades.length === 0 ? null : unidades[i % unidades.length]!.id,
      healthcareServiceId: null,
      role: concepto(i === 0 ? 'HEAD' : 'STAFF', i === 0 ? 'Jefe/a de servicio' : 'Médico/a de planta'),
      specialty: p.especialidades[0] === undefined ? null : concepto('SP', displayOf(p.especialidades[0])),
      isPrimary: i === 0,
      validFrom: isoDia(-900 + i * 30),
      validTo: null,
      status: concepto('ROLE_ASG_ACTIVE', 'Activo'),
    }));
    return {
      organization: {
        id: practica.id,
        code: practica.code,
        name: practica.name,
        type: concepto(esHospital ? 'HOSPITAL' : 'CLINIC', esHospital ? 'Hospital' : 'Clínica'),
        status: concepto('PR_ACTIVE', 'Activa'),
        timeZone: 'America/La_Paz',
        currency: concepto('BOB', 'Boliviano'),
      },
      sites: sitios,
      clinicalUnits: unidades,
      careSpaces: espacios,
      healthcareServices: servicios.todos().slice(0, 6).map((s, i) => ({
        id: uuid(`hs-${s.id}`),
        siteId: sitio.id,
        clinicalUnitId: unidades.length === 0 ? null : unidades[i % unidades.length]!.id,
        service: concepto(s.code, s.name),
        specialty: concepto('CARDIO', 'Cardiología'),
        referralRequired: i % 3 === 0,
        appointmentRequired: true,
        telehealthAvailable: s.code === 'TELE-CARDIO',
        status: concepto('SVC_ACTIVE', 'Activo'),
      })),
      staff: personal,
      legalDocuments: [
        { id: uuid(`doc-lic-${practica.code}`), siteId: sitio.id, type: concepto('LICENSE', 'Licencia de funcionamiento'), number: `LF-${practica.code}-2024`, issuerName: 'SEDES Santa Cruz', evidenceFileId: uuid('file-licencia'), validFrom: isoDia(-400), validTo: isoDia(330), daysToExpiry: 330, verificationStatus: concepto('ACCRED_VERIFIED', 'Verificado') },
        { id: uuid(`doc-nit-${practica.code}`), siteId: null, type: concepto('TAX_ID', 'NIT'), number: '1023456019', issuerName: 'Impuestos Nacionales', evidenceFileId: null, validFrom: isoDia(-2000), validTo: null, daysToExpiry: null, verificationStatus: concepto('ACCRED_VERIFIED', 'Verificado') },
        { id: uuid(`doc-bio-${practica.code}`), siteId: sitio.id, type: concepto('BIOSAFETY', 'Certificado de bioseguridad'), number: `BIO-${practica.code}`, issuerName: 'Gobierno Autónomo Municipal', evidenceFileId: null, validFrom: isoDia(-350), validTo: isoDia(15), daysToExpiry: 15, verificationStatus: concepto('ACCRED_PENDING', 'Por renovar') },
      ],
      inventory: [
        { id: uuid(`inv-1-${practica.code}`), name: 'Guantes de nitrilo (caja x100)', lotNumber: 'L-2409', expiryDate: isoDia(400), quantityOnHand: '48', unit: concepto('BOX', 'Caja'), reorderLevel: '20', belowReorderLevel: false, status: concepto('INV_ACTIVE', 'Disponible') },
        { id: uuid(`inv-2-${practica.code}`), name: 'Electrodos para ECG', lotNumber: 'E-1102', expiryDate: isoDia(120), quantityOnHand: '12', unit: concepto('PACK', 'Paquete'), reorderLevel: '15', belowReorderLevel: true, status: concepto('INV_ACTIVE', 'Disponible') },
        { id: uuid(`inv-3-${practica.code}`), name: 'Alcohol en gel 500 ml', lotNumber: 'A-0871', expiryDate: isoDia(25), quantityOnHand: '30', unit: concepto('UNIT', 'Unidad'), reorderLevel: '10', belowReorderLevel: false, status: concepto('INV_ACTIVE', 'Disponible') },
        { id: uuid(`inv-4-${practica.code}`), name: 'Jeringas 5 ml', lotNumber: 'J-3340', expiryDate: isoDia(700), quantityOnHand: '4', unit: concepto('BOX', 'Caja'), reorderLevel: '8', belowReorderLevel: true, status: concepto('INV_ACTIVE', 'Disponible') },
      ],
    };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
servicios.persistirEn('mock.practice.servicios');
vinculaciones.persistirEn('mock.practice.vinculaciones');
sitiosPropios.persistirEn('mock.practice.sitiosPropios');
