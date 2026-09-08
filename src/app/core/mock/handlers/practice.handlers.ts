import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS, PRACTICE_SANLUCAS, SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from '../fixtures/agenda';
import { CARGO, ESPECIALIDAD, ESTABLECIMIENTO, ESTADO, PROCEDIMIENTO, displayDe } from '../fixtures/conceptos';
import { MEDICA, PROFESIONALES, profesionalPorId } from '../fixtures/personas';
import { noContent, notFound, type MockRouter } from '../mock-router';
import { ahora, avatarSvg, Coleccion, contiene, cuerpo, iso, isoDia, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Prácticas, consultorios, catálogo de servicios y la consola de la
    organización médica.
    ========================================================================== */

const TIPO_PRACTICA = { CLINIC: uuid('concept-practice-type-clinic'), HOSPITAL: uuid('concept-practice-type-hospital'), OFFICE: uuid('concept-practice-type-office') } as const;

/** La práctica sirve a tres clientes con formas distintas: se devuelven todos los campos que alguno espera. */
export const PRACTICAS = [
  { id: PRACTICE_OLIVOS, code: 'OLIVOS', name: 'Clínica Los Olivos', status: 'ACTIVE', typeConceptId: TIPO_PRACTICA.CLINIC, statusConceptId: ESTADO['ST-ACTIVE']!, currencyConceptId: uuid('concept-currency-bob'), timeZone: 'America/La_Paz' },
  { id: PRACTICE_SANLUCAS, code: 'SANLUCAS', name: 'Hospital San Lucas', status: 'ACTIVE', typeConceptId: TIPO_PRACTICA.HOSPITAL, statusConceptId: ESTADO['ST-ACTIVE']!, currencyConceptId: uuid('concept-currency-bob'), timeZone: 'America/La_Paz' },
  { id: PRACTICE_CONSULTORIO, code: 'ROJAS', name: 'Consultorio Dra. Rojas', status: 'ACTIVE', typeConceptId: TIPO_PRACTICA.OFFICE, statusConceptId: ESTADO['ST-ACTIVE']!, currencyConceptId: uuid('concept-currency-bob'), timeZone: 'America/La_Paz' },
];

interface ServicioSimulado {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly serviceConceptId?: string;
  readonly defaultPrice: string;
  readonly currencyConceptId: string;
  readonly currencyCode: string;
  readonly taxCodeId?: string;
  readonly incomeAccountId?: string;
  readonly isActive: boolean;
  readonly descriptionText?: string;
  readonly imageFileId?: string;
}

const MONEDA_BOB = uuid('concept-currency-bob');

export const servicios = new Coleccion<ServicioSimulado>([
  ['CONS-CARDIO', 'Consulta cardiológica', '250.00', 'Consulta de primera vez o control con la Dra. Rojas. Incluye electrocardiograma de reposo.'],
  ['CONS-CONTROL', 'Control cardiológico', '180.00', 'Control de seguimiento de pacientes en tratamiento.'],
  ['ECG', 'Electrocardiograma', '120.00', 'Registro de la actividad eléctrica del corazón, 12 derivaciones.'],
  ['ECO-DOPPLER', 'Ecocardiograma Doppler', '480.00', 'Ecografía cardíaca con Doppler color.'],
  ['HOLTER', 'Holter de 24 horas', '350.00', 'Registro continuo del ritmo cardíaco durante un día.'],
  ['MAPA', 'Monitoreo ambulatorio de presión (MAPA)', '320.00', 'Presión arterial medida cada 20 minutos durante 24 horas.'],
  ['TELE-CARDIO', 'Teleconsulta cardiológica', '200.00', 'Consulta por videollamada para controles y lectura de resultados.'],
  ['CERT-APTITUD', 'Certificado de aptitud cardiovascular', '150.00', 'Evaluación para actividad deportiva o laboral.'],
  ['ERGO', 'Prueba de esfuerzo', '520.00', 'Ergometría en cinta con monitoreo continuo.'],
  ['PAQ-PREV', 'Paquete de prevención cardiovascular', '890.00', 'Consulta + ECG + perfil lipídico + ecocardiograma. Se paga en cuotas.'],
].map(([code, name, defaultPrice, descriptionText], i) => ({
  id: uuid(`service-${code}`),
  practiceId: i < 8 ? PRACTICE_OLIVOS : PRACTICE_CONSULTORIO,
  code: code!,
  name: name!,
  serviceConceptId: i === 2 ? PROCEDIMIENTO['PROC-ENDOSCOPIA'] : undefined,
  defaultPrice: defaultPrice!,
  currencyConceptId: MONEDA_BOB,
  currencyCode: 'BOB',
  isActive: i !== 7,
  descriptionText: descriptionText!,
  ...(i % 3 === 0 ? { imageFileId: uuid(`service-image-${code}`) } : {}),
})));

const NOMENCLADOR = [
  ['Cardiología', 'CAR-001', 'Consulta cardiológica', '220.00'],
  ['Cardiología', 'CAR-002', 'Electrocardiograma de 12 derivaciones', '110.00'],
  ['Cardiología', 'CAR-003', 'Ecocardiograma bidimensional con Doppler', '450.00'],
  ['Cardiología', 'CAR-004', 'Prueba de esfuerzo', '500.00'],
  ['Cardiología', 'CAR-005', 'Holter 24 h', '330.00'],
  ['Pediatría', 'PED-001', 'Consulta pediátrica', '180.00'],
  ['Pediatría', 'PED-002', 'Control de niño sano', '150.00'],
  ['Ginecología', 'GIN-001', 'Consulta ginecológica', '200.00'],
  ['Ginecología', 'GIN-002', 'Papanicolaou', '120.00'],
  ['Ginecología', 'GIN-003', 'Ecografía obstétrica', '280.00'],
  ['Traumatología', 'TRA-001', 'Consulta traumatológica', '200.00'],
  ['Traumatología', 'TRA-002', 'Infiltración articular', '350.00'],
  ['Traumatología', 'TRA-003', 'Artroscopia de rodilla', '6500.00'],
  ['Dermatología', 'DER-001', 'Consulta dermatológica', '190.00'],
  ['Dermatología', 'DER-002', 'Crioterapia de lesiones', '260.00'],
  ['Laboratorio', 'LAB-001', 'Hemograma completo', '60.00'],
  ['Laboratorio', 'LAB-002', 'Perfil lipídico', '90.00'],
  ['Laboratorio', 'LAB-003', 'Glucemia en ayunas', '35.00'],
  ['Imagenología', 'IMG-001', 'Radiografía de tórax', '120.00'],
  ['Imagenología', 'IMG-002', 'Tomografía de cráneo sin contraste', '850.00'],
].map(([specialty, code, display, referencePrice], i) => ({
  conceptId: uuid(`nomenclador-${code}`),
  code: code!,
  display: display!,
  specialty: specialty!,
  group: specialty!,
  referencePrice: referencePrice!,
  priceUnit: 'BOB',
  ocrSuspect: i % 9 === 8,
}));

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
}

const vinculaciones = new Coleccion<VinculacionSimulada>([
  { id: uuid('ra-olivos'), practiceId: PRACTICE_OLIVOS, practiceName: 'Clínica Los Olivos', practiceType: 'Clínica', practiceSiteId: SITIO_OLIVOS.id, roleConceptId: CARGO['ROLE-JEFE']!, specialtyConceptId: ESPECIALIDAD['SP-CARDIO']!, status: 'ACTIVE', isPrimary: true, validFrom: isoDia(-900), validTo: null, createdAt: iso(-900), avatarUrl: avatarSvg('Clínica Los Olivos', '#0f766e'), practitionerProfileId: MEDICA.id },
  { id: uuid('ra-sanlucas'), practiceId: PRACTICE_SANLUCAS, practiceName: 'Hospital San Lucas', practiceType: 'Hospital', practiceSiteId: SITIO_SANLUCAS.id, roleConceptId: CARGO['ROLE-MEDICO']!, specialtyConceptId: ESPECIALIDAD['SP-CARDIO']!, status: 'PENDING', isPrimary: false, validFrom: null, validTo: null, createdAt: iso(-4), avatarUrl: avatarSvg('Hospital San Lucas', '#7c3aed'), practitionerProfileId: MEDICA.id },
  { id: uuid('ra-japones'), practiceId: uuid('practice-japones'), practiceName: 'Hospital Japonés', practiceType: 'Hospital', practiceSiteId: null, roleConceptId: CARGO['ROLE-RESIDENTE']!, specialtyConceptId: null, status: 'ENDED', isPrimary: false, validFrom: isoDia(-3000), validTo: isoDia(-1500), createdAt: iso(-3000), avatarUrl: null, practitionerProfileId: MEDICA.id },
  { id: uuid('ra-foianini'), practiceId: uuid('practice-foianini'), practiceName: 'Clínica Foianini', practiceType: 'Clínica', practiceSiteId: null, roleConceptId: CARGO['ROLE-MEDICO']!, specialtyConceptId: ESPECIALIDAD['SP-MEDINT']!, status: 'REJECTED', isPrimary: false, validFrom: null, validTo: null, createdAt: iso(-40), avatarUrl: avatarSvg('Clínica Foianini', '#b45309'), practitionerProfileId: MEDICA.id },
]);

const sitiosPropios = new Coleccion<{ id: string; practiceId: string; code: string; name: string; timeZone: string | null; addressText: string | null; latitude: number | null; longitude: number | null; status: string; practitionerProfileId: string }>([
  { ...SITIO_CONSULTORIO, practiceId: PRACTICE_CONSULTORIO, latitude: -17.7863, longitude: -63.1812, status: 'ACTIVE', practitionerProfileId: MEDICA.id },
  { ...SITIO_OLIVOS, practiceId: PRACTICE_OLIVOS, latitude: -17.7712, longitude: -63.1955, status: 'ACTIVE', practitionerProfileId: MEDICA.id },
]);

function concepto(code: string, display: string) {
  return { code, display };
}

export function registrarPracticas(router: MockRouter): void {
  router.get('/practices', () => PRACTICAS);

  router.get('/billing/service-catalog', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
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
    return [...conteo.entries()].map(([specialty, count]) => ({ specialty, count }));
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
    return vinculaciones.filtrar((v) => v.practitionerProfileId === hpid).map(({ practitionerProfileId: _p, ...v }) => v);
  });

  router.post('/practices/:id/role-assignments/self-request', (request) => {
    const practica = PRACTICAS.find((p) => p.id === request.params['id']);
    const datos = cuerpo<{ practiceSiteId?: string; roleConceptId?: string; specialtyConceptId?: string; validFrom?: string }>(request);
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
      practitionerProfileId: request.user?.practitionerProfileId ?? MEDICA.id,
    });
    return { status: 201, body: { id: nueva.id, practiceId: nueva.practiceId, practitionerProfileId: nueva.practitionerProfileId, status: nueva.status, createdAt: nueva.createdAt } };
  });

  router.get('/practitioners/me/sites', (request) => {
    const items = sitiosPropios.filtrar((s) => s.practitionerProfileId === request.user?.practitionerProfileId).map(({ practitionerProfileId: _p, ...s }) => s);
    return { items, count: items.length };
  });

  router.get('/practitioners/:id/sites', ({ params }) => {
    const p = profesionalPorId(params['id']!);
    if (p === undefined) return { items: [], count: 0 };
    const items = p.id === MEDICA.id
      ? sitiosPropios.todos().map(({ practitionerProfileId: _p, ...s }) => s)
      : [{ ...(p.organizacion === 'Hospital San Lucas' ? SITIO_SANLUCAS : SITIO_OLIVOS), practiceId: p.organizacion === 'Hospital San Lucas' ? PRACTICE_SANLUCAS : PRACTICE_OLIVOS, latitude: p.lat, longitude: p.lng, status: 'ACTIVE' }];
    return { items, count: items.length };
  });

  router.post('/practitioners/me/sites', (request) => {
    const datos = cuerpo<{ name: string; timeZone?: string; address?: { lines: string[]; city?: string; latitude?: number; longitude?: number } }>(request);
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
      practitionerProfileId: request.user?.practitionerProfileId ?? MEDICA.id,
    });
    const { practitionerProfileId: _p, ...resto } = nuevo;
    return { status: 201, body: resto };
  });

  router.delete('/practitioners/me/sites/:id', ({ params }) => {
    sitiosPropios.borrar(params['id']!);
    return noContent();
  });

  /* ---- consola de la organización ----------------------------------------- */

  router.get('/practices/:id/organization', ({ params }) => {
    const practica = PRACTICAS.find((p) => p.id === params['id']);
    if (practica === undefined) return notFound('Práctica no encontrada');
    const esHospital = practica.id === PRACTICE_SANLUCAS;
    const sitio = esHospital ? SITIO_SANLUCAS : practica.id === PRACTICE_CONSULTORIO ? SITIO_CONSULTORIO : SITIO_OLIVOS;
    const sitios = [
      { id: sitio.id, code: sitio.code, name: sitio.name, type: concepto('MAIN', 'Sede principal'), physicalType: concepto('BUILDING', 'Edificio'), operationalStatus: concepto('OPERATIONAL', 'Operativa'), status: concepto('ACTIVE', 'Activa'), timeZone: 'America/La_Paz', branchId: null, clinicalUnitCount: esHospital ? 6 : 3, careSpaceCount: esHospital ? 24 : 8 },
      ...(esHospital ? [{ id: uuid('site-sanlucas-norte'), code: 'SANLUCAS-N', name: 'Hospital San Lucas · Anexo Norte', type: concepto('BRANCH', 'Sucursal'), physicalType: concepto('BUILDING', 'Edificio'), operationalStatus: concepto('OPERATIONAL', 'Operativa'), status: concepto('ACTIVE', 'Activa'), timeZone: 'America/La_Paz', branchId: null, clinicalUnitCount: 2, careSpaceCount: 6 }] : []),
    ];
    const unidades = [
      { code: 'CARDIO', name: 'Cardiología', esp: ESPECIALIDAD['SP-CARDIO']! },
      { code: 'MEDINT', name: 'Medicina interna', esp: ESPECIALIDAD['SP-MEDINT']! },
      { code: 'PEDIA', name: 'Pediatría', esp: ESPECIALIDAD['SP-PEDIA']! },
      ...(esHospital ? [{ code: 'URG', name: 'Urgencias', esp: ESPECIALIDAD['SP-MEDGEN']! }, { code: 'QX', name: 'Quirófanos', esp: ESPECIALIDAD['SP-ANEST']! }, { code: 'GINE', name: 'Maternidad', esp: ESPECIALIDAD['SP-GINE']! }] : []),
    ].map((u, i) => ({
      id: uuid(`unit-${practica.code}-${u.code}`),
      siteId: sitio.id,
      parentUnitId: null,
      code: u.code,
      name: u.name,
      type: concepto('DEPARTMENT', 'Departamento'),
      specialty: concepto(u.code, displayDe(u.esp)),
      serviceMode: concepto(i % 2 === 0 ? 'OUTPATIENT' : 'INPATIENT', i % 2 === 0 ? 'Ambulatorio' : 'Internación'),
      status: concepto('ACTIVE', 'Activa'),
    }));
    const espacios = unidades.flatMap((u, i) => [
      { id: uuid(`space-${u.id}-1`), siteId: sitio.id, clinicalUnitId: u.id, parentSpaceId: null, code: `${u.code}-C1`, name: `Consultorio ${i + 1}`, type: concepto('ROOM', 'Consultorio'), capacity: 1, operationalStatus: concepto('OPERATIONAL', 'Operativo'), status: concepto('ACTIVE', 'Activo') },
      { id: uuid(`space-${u.id}-2`), siteId: sitio.id, clinicalUnitId: u.id, parentSpaceId: null, code: `${u.code}-C2`, name: `Consultorio ${i + 1}B`, type: concepto('ROOM', 'Consultorio'), capacity: 1, operationalStatus: concepto(i === 2 ? 'MAINTENANCE' : 'OPERATIONAL', i === 2 ? 'En mantenimiento' : 'Operativo'), status: concepto('ACTIVE', 'Activo') },
    ]);
    const personal = PROFESIONALES.filter((p) => (esHospital ? p.organizacion === 'Hospital San Lucas' : p.organizacion === 'Clínica Los Olivos')).map((p, i) => ({
      id: uuid(`staff-${practica.code}-${p.id}`),
      practitionerProfileId: p.id,
      practitionerName: p.displayName,
      siteId: sitio.id,
      clinicalUnitId: unidades[i % unidades.length]!.id,
      healthcareServiceId: null,
      role: concepto(i === 0 ? 'HEAD' : 'STAFF', i === 0 ? 'Jefe/a de servicio' : 'Médico/a de planta'),
      specialty: p.especialidades[0] === undefined ? null : concepto('SP', displayDe(p.especialidades[0])),
      isPrimary: i === 0,
      validFrom: isoDia(-900 + i * 30),
      validTo: null,
      status: concepto('ACTIVE', 'Activo'),
    }));
    return {
      organization: {
        id: practica.id,
        code: practica.code,
        name: practica.name,
        type: concepto(esHospital ? 'HOSPITAL' : 'CLINIC', esHospital ? 'Hospital' : 'Clínica'),
        status: concepto('ACTIVE', 'Activa'),
        timeZone: 'America/La_Paz',
        currency: concepto('BOB', 'Boliviano'),
      },
      sites: sitios,
      clinicalUnits: unidades,
      careSpaces: espacios,
      healthcareServices: servicios.todos().slice(0, 6).map((s, i) => ({
        id: uuid(`hs-${s.id}`),
        siteId: sitio.id,
        clinicalUnitId: unidades[i % unidades.length]!.id,
        service: concepto(s.code, s.name),
        specialty: concepto('CARDIO', 'Cardiología'),
        referralRequired: i % 3 === 0,
        appointmentRequired: true,
        telehealthAvailable: s.code === 'TELE-CARDIO',
        status: concepto('ACTIVE', 'Activo'),
      })),
      staff: personal,
      legalDocuments: [
        { id: uuid(`doc-lic-${practica.code}`), siteId: sitio.id, type: concepto('LICENSE', 'Licencia de funcionamiento'), number: `LF-${practica.code}-2024`, issuerName: 'SEDES Santa Cruz', evidenceFileId: uuid('file-licencia'), validFrom: isoDia(-400), validTo: isoDia(330), daysToExpiry: 330, verificationStatus: concepto('VERIFIED', 'Verificado') },
        { id: uuid(`doc-nit-${practica.code}`), siteId: null, type: concepto('TAX_ID', 'NIT'), number: '1023456019', issuerName: 'Impuestos Nacionales', evidenceFileId: null, validFrom: isoDia(-2000), validTo: null, daysToExpiry: null, verificationStatus: concepto('VERIFIED', 'Verificado') },
        { id: uuid(`doc-bio-${practica.code}`), siteId: sitio.id, type: concepto('BIOSAFETY', 'Certificado de bioseguridad'), number: `BIO-${practica.code}`, issuerName: 'Gobierno Autónomo Municipal', evidenceFileId: null, validFrom: isoDia(-350), validTo: isoDia(15), daysToExpiry: 15, verificationStatus: concepto('PENDING', 'Por renovar') },
      ],
      inventory: [
        { id: uuid(`inv-1-${practica.code}`), name: 'Guantes de nitrilo (caja x100)', lotNumber: 'L-2409', expiryDate: isoDia(400), quantityOnHand: '48', unit: concepto('BOX', 'Caja'), reorderLevel: '20', belowReorderLevel: false, status: concepto('ACTIVE', 'Disponible') },
        { id: uuid(`inv-2-${practica.code}`), name: 'Electrodos para ECG', lotNumber: 'E-1102', expiryDate: isoDia(120), quantityOnHand: '12', unit: concepto('PACK', 'Paquete'), reorderLevel: '15', belowReorderLevel: true, status: concepto('ACTIVE', 'Disponible') },
        { id: uuid(`inv-3-${practica.code}`), name: 'Alcohol en gel 500 ml', lotNumber: 'A-0871', expiryDate: isoDia(25), quantityOnHand: '30', unit: concepto('UNIT', 'Unidad'), reorderLevel: '10', belowReorderLevel: false, status: concepto('ACTIVE', 'Disponible') },
        { id: uuid(`inv-4-${practica.code}`), name: 'Jeringas 5 ml', lotNumber: 'J-3340', expiryDate: isoDia(700), quantityOnHand: '4', unit: concepto('BOX', 'Caja'), reorderLevel: '8', belowReorderLevel: true, status: concepto('ACTIVE', 'Disponible') },
      ],
    };
  });

  // Establecimientos vinculables usan el padrón: mismo catálogo que `linkable-organizations`.
  void ESTABLECIMIENTO;
}
