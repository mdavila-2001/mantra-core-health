import { ordenes } from '../fixtures/clinica';
import { vitrinas } from '../fixtures/comunidad';
import { ESTADO, ESTUDIO, PRIORIDAD, displayDe } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES } from '../fixtures/personas';
import { forbidden, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO } from '../mock-session';
import { ahora, Coleccion, contiene, cuerpo, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Diagnóstico: órdenes e informes del circuito clínico, la cola de trabajo
    del laboratorio, los resultados que ve la persona y los centros de
    diagnóstico (directorio, buscador, ficha y consola de administración).
    ========================================================================== */

function c(code: string, display: string) {
  return { code, display };
}

const ROL_CONTENIDO = uuid('concept-result-content-role-report');
const FORMATO_PDF = uuid('concept-presentation-format-pdf');

interface InformeSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly serviceRequestId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly lifecycleStatusConceptId: string;
  readonly currentVersionId: string;
  readonly released: boolean;
  readonly conclusionText: string;
  readonly issuedAt: string;
  readonly releasedAt: string | null;
  readonly createdAt: string;
  readonly custodianTenantId: string;
}

const CONCLUSIONES: Readonly<Record<string, string>> = {
  'Hemograma completo': 'Hemoglobina 13,8 g/dL, leucocitos 6.400/µL, plaquetas 245.000/µL. Sin alteraciones.',
  'Perfil lipídico': 'Colesterol total 212 mg/dL, LDL 138 mg/dL, HDL 48 mg/dL, triglicéridos 160 mg/dL. LDL por encima de la meta.',
  Electrocardiograma: 'Ritmo sinusal a 72 lpm, eje normal, sin alteraciones de la repolarización.',
  'Glucosa en ayunas': 'Glucemia 96 mg/dL. Normal.',
  TSH: 'TSH 3,1 mUI/L. Normal.',
  'Ecografía abdominal': 'Hígado de tamaño y ecogenicidad conservados. Vesícula sin litiasis. Riñones normales.',
};

const informes = new Coleccion<InformeSimulado>(
  ordenes
    .filtrar((o) => o.statusConceptId === ESTADO['ST-COMPLETED'])
    .map((o, i) => ({
      id: uuid(`report-${o.id}`),
      patientProfileId: o.patientProfileId,
      serviceRequestId: o.id,
      codeConceptId: o.codeConceptId,
      categoryConceptId: o.categoryConceptId,
      lifecycleStatusConceptId: ESTADO['ST-COMPLETED']!,
      currentVersionId: uuid(`report-version-${o.id}`),
      released: i % 4 !== 3,
      conclusionText: CONCLUSIONES[displayDe(o.codeConceptId)] ?? 'Sin hallazgos de significación clínica.',
      issuedAt: iso(-3 - (i % 5), 14),
      releasedAt: i % 4 !== 3 ? iso(-2 - (i % 5), 9) : null,
      createdAt: iso(-3 - (i % 5), 13),
      custodianTenantId: i % 2 === 0 ? TENANT_LABORATORIO : TENANT_CLINICA,
    })),
);

interface CompartidoSimulado {
  readonly id: string;
  readonly reportId: string;
  readonly practitionerUserId: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly active: boolean;
}

const compartidos = new Coleccion<CompartidoSimulado>(
  informes.filtrar((r) => r.patientProfileId === PACIENTE.id && r.released).slice(0, 1).map((r) => ({ id: uuid(`share-${r.id}`), reportId: r.id, practitionerUserId: MEDICA.userId, validFrom: iso(-2), validTo: iso(28), active: true })),
);

const ordenesDeTrabajo = new Coleccion<{ id: string; workOrderNumber: string; laboratoryAccessionId: string; statusConceptId: string; priorityConceptId: string; assignedProfileId: string | null; scheduledAt: string; completedAt: string | null }>(
  ordenes.todos().slice(0, 12).map((o, i) => ({
    id: uuid(`work-order-${o.id}`),
    workOrderNumber: `OT-2026-${String(400 + i).padStart(4, '0')}`,
    laboratoryAccessionId: `ACC-${String(9000 + i)}`,
    statusConceptId: o.statusConceptId,
    priorityConceptId: o.priorityConceptId,
    assignedProfileId: i % 3 === 0 ? null : PROFESIONALES[12]!.id,
    scheduledAt: iso(-2 + (i % 4), 8 + (i % 6)),
    completedAt: o.statusConceptId === ESTADO['ST-COMPLETED'] ? iso(-1 + (i % 3), 15) : null,
  })),
);

/* ---- centros de diagnóstico ------------------------------------------------ */

interface UnidadSimulada {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'LABORATORY' | 'IMAGING';
  readonly rating: number;
  readonly ratingCount: number;
  readonly walkIn: boolean;
  readonly home: boolean;
  readonly external: boolean;
  readonly publiclyListed: boolean;
  readonly verified: boolean;
  readonly lat: number;
  readonly lng: number;
}

const UNIDADES: readonly UnidadSimulada[] = [
  { id: uuid('unit-lab-central'), tenantId: TENANT_LABORATORIO, code: 'LABCEN', name: 'Laboratorio Central', kind: 'LABORATORY', rating: 4.8, ratingCount: 210, walkIn: true, home: true, external: true, publiclyListed: true, verified: true, lat: -17.784, lng: -63.1815 },
  { id: uuid('unit-lab-olivos'), tenantId: TENANT_CLINICA, code: 'LAB-OLIVOS', name: 'Laboratorio Clínica Los Olivos', kind: 'LABORATORY', rating: 4.5, ratingCount: 88, walkIn: true, home: false, external: false, publiclyListed: true, verified: true, lat: -17.7712, lng: -63.1955 },
  { id: uuid('unit-imagen-sur'), tenantId: uuid('tenant-imagen-sur'), code: 'IMG-SUR', name: 'Centro de Imagen Sur', kind: 'IMAGING', rating: 4.4, ratingCount: 64, walkIn: false, home: false, external: true, publiclyListed: true, verified: true, lat: -17.74, lng: -63.175 },
  { id: uuid('unit-imagen-olivos'), tenantId: TENANT_CLINICA, code: 'IMG-OLIVOS', name: 'Imagenología Clínica Los Olivos', kind: 'IMAGING', rating: 4.6, ratingCount: 120, walkIn: false, home: false, external: true, publiclyListed: true, verified: true, lat: -17.7712, lng: -63.1955 },
  { id: uuid('unit-lab-nuevo'), tenantId: TENANT_CLINICA, code: 'LAB-NORTE', name: 'Laboratorio Norte (en habilitación)', kind: 'LABORATORY', rating: 0, ratingCount: 0, walkIn: true, home: false, external: false, publiclyListed: false, verified: false, lat: -17.75, lng: -63.2 },
];

const ESTUDIOS_POR_TIPO: Readonly<Record<'LABORATORY' | 'IMAGING', readonly (keyof typeof ESTUDIO)[]>> = {
  LABORATORY: ['STUDY-HEMOGRAMA', 'STUDY-GLUCOSA', 'STUDY-PERFIL-LIPIDICO', 'STUDY-TSH', 'STUDY-ORINA', 'STUDY-CREATININA', 'STUDY-UREA', 'STUDY-HBA1C', 'STUDY-COAGULACION', 'STUDY-HEPATICO', 'STUDY-COPROLOGICO', 'STUDY-CULTIVO', 'STUDY-VITAMINA-D'],
  IMAGING: ['STUDY-RX-TORAX', 'STUDY-ECO-ABD', 'STUDY-ECG', 'STUDY-RMN-RODILLA', 'STUDY-TAC-CRANEO', 'STUDY-MAMOGRAFIA', 'STUDY-ECO-OBSTETRICA', 'STUDY-RX-COLUMNA', 'STUDY-TAC-ABDOMEN', 'STUDY-RMN-CEREBRO', 'STUDY-DENSITOMETRIA'],
};

function sitioDe(u: UnidadSimulada) {
  return { id: uuid(`unit-site-${u.id}`), code: `${u.code}-1`, name: `${u.name} · Sede principal`, role: c('MAIN', 'Sede principal'), sampleCollectionAvailable: u.kind === 'LABORATORY', imagingAvailable: u.kind === 'IMAGING' };
}

function estudiosDe(u: UnidadSimulada) {
  return ESTUDIOS_POR_TIPO[u.kind].map((code, i) => {
    const conceptId = ESTUDIO[code]!;
    const precio = u.kind === 'LABORATORY' ? 40 + i * 25 : 120 + i * 180;
    return {
      id: uuid(`offering-${u.id}-${code}`),
      code: code.replace('STUDY-', ''),
      name: displayDe(conceptId),
      description: `${displayDe(conceptId)} realizado en ${u.name}.`,
      siteId: sitioDe(u).id,
      modality: u.kind === 'IMAGING' ? c(['XR', 'US', 'ECG', 'MR', 'CT'][i]!, ['Radiografía', 'Ecografía', 'Electrocardiografía', 'Resonancia', 'Tomografía'][i]!) : null,
      preparationInstructions: i === 1 ? 'Ayuno de 8 horas.' : i === 4 && u.kind === 'IMAGING' ? 'Retirar objetos metálicos.' : null,
      expectedDurationMinutes: u.kind === 'LABORATORY' ? 10 : 20 + i * 10,
      expectedTurnaroundMinutes: u.kind === 'LABORATORY' ? 240 : 60 * 24,
      requiresMedicalOrder: i > 1,
      prices: [{ amount: precio.toFixed(2), currency: c('BOB', 'Boliviano'), scheduleCode: 'PUBLICO', siteId: sitioDe(u).id }],
      conceptId,
    };
  });
}

function itemDeDirectorio(u: UnidadSimulada) {
  return {
    id: u.id,
    code: u.code,
    name: u.name,
    // El código del **concepto** (`DU_TYPE_*`), que no es el mismo vocabulario
    // que el del filtro `kind` (`LABORATORY`/`IMAGING`). Emitir el del filtro
    // acá dejaba a `categoryName` sin reconocer ninguno de los dos tipos, así
    // que el directorio rotulaba los grupos con el `display` crudo y la portada
    // no encontraba su ícono.
    type: c(
      u.kind === 'LABORATORY' ? 'DU_TYPE_LAB' : 'DU_TYPE_IMAGING',
      u.kind === 'LABORATORY' ? 'Laboratorio clínico' : 'Centro de imagenología',
    ),
    siteCount: 1,
    equipmentCount: u.kind === 'IMAGING' ? 8 : 9,
    studyCount: ESTUDIOS_POR_TIPO[u.kind].length,
    acceptsExternalOrders: u.external,
    walkInAvailable: u.walkIn,
    homeCollectionAvailable: u.home,
  };
}

function equipoDe(u: UnidadSimulada) {
  // Nueve y ocho, no cuatro: con cuatro equipos la sección nunca cruzaba el
  // umbral del buscador ni el de la paginación, así que esos controles no se
  // podían ver funcionando. Un laboratorio de segundo nivel tiene esta cantidad.
  const base = u.kind === 'IMAGING' ? [['XR', 'Radiografía digital', 'Siemens', 'Ysio Max'], ['US', 'Ecógrafo', 'GE', 'Logiq E10'], ['MR', 'Resonador 1.5T', 'Philips', 'Ingenia'], ['CT', 'Tomógrafo 64 cortes', 'Siemens', 'Somatom go.Up'], ['XR', 'Arco en C', 'Ziehm', 'Vision RFD'], ['US', 'Ecógrafo portátil', 'Mindray', 'DP-10'], ['MG', 'Mamógrafo digital', 'Hologic', 'Selenia'], ['DX', 'Densitómetro óseo', 'GE', 'Lunar iDXA']] : [['ANALYZER', 'Analizador hematológico', 'Sysmex', 'XN-550'], ['ANALYZER', 'Analizador bioquímico', 'Roche', 'cobas c311'], ['CENTRIFUGE', 'Centrífuga', 'Hettich', 'Rotina 380'], ['MICROSCOPE', 'Microscopio', 'Olympus', 'CX23'], ['ANALYZER', 'Analizador de coagulación', 'Stago', 'STart 4'], ['ANALYZER', 'Analizador de inmunoensayo', 'Abbott', 'Architect i1000'], ['INCUBATOR', 'Incubadora de cultivos', 'Memmert', 'IN55'], ['CENTRIFUGE', 'Centrífuga refrigerada', 'Eppendorf', '5810 R'], ['MICROSCOPE', 'Microscopio de fluorescencia', 'Leica', 'DM2000']];
  return base.map(([code, display, manufacturer, model], i) => ({
    id: uuid(`equipment-${u.id}-${i}`),
    siteId: sitioDe(u).id,
    type: c(code!, display!),
    manufacturer: manufacturer!,
    model: model!,
    serialNumber: `SN-${1000 + i}`,
    modality: u.kind === 'IMAGING' ? c(code!, display!) : null,
    // Tres estados y no dos: con «en mantenimiento» como única excepción, el
    // filtro por estado de la ficha tenía dos chips y uno de ellos con un solo
    // equipo detrás. Un parque de nueve equipos tiene alguno fuera de servicio.
    operationalStatus:
      i === 2 || i === 7
        ? c('MAINTENANCE', 'En mantenimiento')
        : i === 5
          ? c('OUT_OF_SERVICE', 'Fuera de servicio')
          : c('OPERATIONAL', 'Operativo'),
    lastCalibrationAt: isoDia(-90 - i * 20),
    nextCalibrationDueAt: isoDia(275 - i * 20),
    daysToCalibration: 275 - i * 20,
  }));
}

function acreditacionesDe(u: UnidadSimulada) {
  return [
    { id: uuid(`accr-1-${u.id}`), siteId: sitioDe(u).id, type: c('SEDES', 'Habilitación SEDES'), number: `HAB-${u.code}-2024`, evidenceFileId: uuid(`file-accr-${u.id}`), validFrom: isoDia(-400), validTo: isoDia(330), daysToExpiry: 330, verificationStatus: c('VERIFIED', 'Verificada') },
    { id: uuid(`accr-2-${u.id}`), siteId: null, type: c('ISO15189', 'ISO 15189'), number: `ISO-${u.code}`, evidenceFileId: null, validFrom: isoDia(-700), validTo: isoDia(u.verified ? 20 : -10), daysToExpiry: u.verified ? 20 : -10, verificationStatus: c(u.verified ? 'VERIFIED' : 'PENDING', u.verified ? 'Verificada' : 'Pendiente') },
  ];
}

function resultadoPropio(r: InformeSimulado) {
  return {
    reportId: r.id,
    versionId: r.currentVersionId,
    versionNumber: 1,
    serviceRequestId: r.serviceRequestId,
    codeConceptId: r.codeConceptId,
    categoryConceptId: r.categoryConceptId,
    custodianTenantId: r.custodianTenantId,
    conclusionText: r.conclusionText,
    issuedAt: r.issuedAt,
    releasedAt: r.releasedAt ?? r.issuedAt,
    clinicalStatusConceptId: ESTADO['ST-COMPLETED']!,
    observationIds: [uuid(`obs-result-${r.id}-1`), uuid(`obs-result-${r.id}-2`)],
    files: [{ id: uuid(`result-file-${r.id}`), fileId: uuid(`file-lab-${r.patientProfileId}`), contentRoleConceptId: ROL_CONTENIDO, presentationFormatConceptId: FORMATO_PDF, ordinal: 1 }],
  };
}

function pacienteDeSesion(request: MockRequest): string {
  return request.user?.patientProfileId ?? (request.user?.key === 'medica' ? PACIENTE.id : '');
}

export function registrarDiagnostico(router: MockRouter): void {
  router.get('/diagnostics/patients/:id/orders', ({ params, query }) => {
    const id = params['id']!;
    const limit = Number(query.get('limit') ?? 50) || 50;
    return {
      patientProfileId: id,
      orders: ordenes.filtrar((o) => o.patientProfileId === id).map(({ patientProfileId: _p, reasonText: _r, ...o }) => ({ ...o, patientProfileId: id })),
      reports: informes.filtrar((r) => r.patientProfileId === id).map((r) => ({ id: r.id, patientProfileId: r.patientProfileId, serviceRequestId: r.serviceRequestId, codeConceptId: r.codeConceptId, categoryConceptId: r.categoryConceptId, lifecycleStatusConceptId: r.lifecycleStatusConceptId, currentVersionId: r.currentVersionId, currentReleasedVersionId: r.released ? r.currentVersionId : null, resultReleaseStatusConceptId: r.released ? ESTADO['ST-PUBLISHED']! : ESTADO['ST-PENDING']!, createdAt: r.createdAt })),
      limit,
      truncated: [],
    };
  });

  router.get('/diagnostics/patients/:id/imaging-studies', ({ params }) =>
    ordenes
      .filtrar((o) => o.patientProfileId === params['id'] && [ESTUDIO['STUDY-ECO-ABD'], ESTUDIO['STUDY-RX-TORAX'], ESTUDIO['STUDY-TAC-CRANEO'], ESTUDIO['STUDY-RMN-RODILLA']].includes(o.codeConceptId))
      .map((o) => ({ id: uuid(`imaging-${o.id}`), patientProfileId: o.patientProfileId, serviceRequestId: o.id, statusConceptId: o.statusConceptId, studyInstanceUid: `1.2.826.0.1.${Math.abs(o.id.charCodeAt(0) * 7919)}` })),
  );

  router.get('/diagnostics/work-orders', ({ query }) => {
    const status = texto(query, 'statusConceptId');
    const assigned = texto(query, 'assignedProfileId');
    return ordenesDeTrabajo
      .todos()
      .filter((w) => status === null || w.statusConceptId === status)
      .filter((w) => assigned === null || w.assignedProfileId === assigned)
      .slice(Number(query.get('offset') ?? 0), Number(query.get('offset') ?? 0) + (Number(query.get('limit') ?? 50) || 50));
  });

  /* ---- resultados de la persona ------------------------------------------- */

  router.get('/diagnostic-results/me', (request) => {
    const id = pacienteDeSesion(request);
    const items = informes.filtrar((r) => r.patientProfileId === id && r.released).map(resultadoPropio);
    return { patientProfileId: id, items, limit: Number(request.query.get('limit') ?? 50) || 50, truncated: false };
  });

  router.get('/diagnostic-results/me/orders', (request) => {
    const id = pacienteDeSesion(request);
    const items = ordenes.filtrar((o) => o.patientProfileId === id).map((o) => {
      const informe = informes.filtrar((r) => r.serviceRequestId === o.id)[0];
      return {
        id: o.id,
        encounterId: o.encounterId,
        codeConceptId: o.codeConceptId,
        categoryConceptId: o.categoryConceptId,
        statusConceptId: o.statusConceptId,
        priorityConceptId: o.priorityConceptId,
        createdAt: o.createdAt,
        preparationInstructions: o.codeConceptId === ESTUDIO['STUDY-GLUCOSA'] || o.codeConceptId === ESTUDIO['STUDY-PERFIL-LIPIDICO'] ? 'Ayuno de 8 a 12 horas. Podés tomar agua.' : undefined,
        hasReleasedResult: informe?.released ?? false,
        reportId: informe?.released ? informe.id : undefined,
      };
    });
    return { patientProfileId: id, items, limit: 50, truncated: false };
  });

  router.get('/diagnostic-results/me/:id', (request) => {
    const r = informes.get(request.params['id']!);
    if (r === undefined || !r.released) return notFound('Resultado no encontrado');
    if (r.patientProfileId !== pacienteDeSesion(request) && request.user?.practitionerProfileId === undefined) return forbidden();
    return resultadoPropio(r);
  });

  router.get('/diagnostic-results/me/:id/shares', ({ params }) => compartidos.filtrar((s) => s.reportId === params['id']));

  router.post('/diagnostic-results/me/:id/shares', (request) => {
    const datos = cuerpo<{ practitionerUserId: string; validUntil: string }>(request);
    const nuevo = compartidos.agregar({ id: nuevoId('share'), reportId: request.params['id']!, practitionerUserId: datos.practitionerUserId ?? MEDICA.userId, validFrom: ahora(), validTo: datos.validUntil ?? iso(30), active: true });
    return { status: 201, body: nuevo };
  });

  router.delete('/diagnostic-results/me/:id/shares/:shareId', ({ params }) => {
    const s = compartidos.get(params['shareId']!);
    if (s === undefined) return notFound('Acceso no encontrado');
    return compartidos.actualizar(s.id, { active: false, validTo: ahora() });
  });
  router.post('/diagnostic-results/me/:id/shares/:shareId/revoke', ({ params }) => {
    const s = compartidos.get(params['shareId']!);
    if (s === undefined) return notFound('Acceso no encontrado');
    return compartidos.actualizar(s.id, { active: false, validTo: ahora() });
  });

  /* ---- centros de diagnóstico ------------------------------------------- */

  router.get('/diagnostic-units', () => {
    const items = UNIDADES.filter((u) => u.tenantId === TENANT_CLINICA).map(itemDeDirectorio);
    return { items, count: items.length };
  });

  router.get('/diagnostic-units/search', ({ query }) => {
    const q = texto(query, 'q');
    const kind = texto(query, 'kind');
    const studyCode = texto(query, 'studyCode');
    const home = query.get('homeCollection') === 'true';
    const walkIn = query.get('walkIn') === 'true';
    const external = query.get('acceptsExternalOrders') === 'true';
    const maxAmount = Number(query.get('maxAmount') ?? Infinity);
    const minRating = Number(query.get('minRating') ?? 0);
    const offset = Number(query.get('offset') ?? 0);
    const limit = Number(query.get('limit') ?? 20) || 20;
    const todos = UNIDADES.filter((u) => u.publiclyListed)
      .filter((u) => contiene(u.name, q))
      .filter((u) => kind === null || u.kind === kind)
      .filter((u) => studyCode === null || estudiosDe(u).some((e) => e.code === studyCode || contiene(e.name, studyCode)))
      .filter((u) => (!home || u.home) && (!walkIn || u.walkIn) && (!external || u.external))
      .filter((u) => u.rating >= minRating)
      .map((u) => ({ ...itemDeDirectorio(u), tenantId: u.tenantId, rating: u.ratingCount === 0 ? null : u.rating, ratingCount: u.ratingCount, minAmount: Math.min(...estudiosDe(u).map((e) => Number(e.prices[0]!.amount))) }))
      .filter((u) => u.minAmount === null || u.minAmount <= maxAmount);
    return { items: todos.slice(offset, offset + limit), total: todos.length, limit, offset };
  });

  router.get('/diagnostic-units/administration', () => {
    const items = UNIDADES.filter((u) => u.tenantId === TENANT_CLINICA || u.tenantId === TENANT_LABORATORIO).map((u) => ({
      ...itemDeDirectorio(u),
      status: c(u.verified ? 'ACTIVE' : 'PENDING', u.verified ? 'Activa' : 'En habilitación'),
      verificationStatus: c(u.verified ? 'VERIFIED' : 'PENDING', u.verified ? 'Verificada' : 'Pendiente'),
      publiclyListed: u.publiclyListed,
    }));
    return { items, count: items.length };
  });

  router.get('/diagnostic-units/:id/administration', ({ params }) => {
    const u = UNIDADES.find((x) => x.id === params['id']);
    if (u === undefined) return notFound('Centro no encontrado');
    const sitio = sitioDe(u);
    return {
      ...itemDeDirectorio(u),
      status: c(u.verified ? 'ACTIVE' : 'PENDING', u.verified ? 'Activa' : 'En habilitación'),
      verificationStatus: c(u.verified ? 'VERIFIED' : 'PENDING', u.verified ? 'Verificada' : 'Pendiente'),
      publiclyListed: u.publiclyListed,
      sites: [{ ...sitio, practiceSiteId: uuid(`practice-site-${u.id}`), accessionPrefix: u.code.slice(0, 3), status: c('ACTIVE', 'Activa') }],
      equipment: equipoDe(u),
      studies: estudiosDe(u).map(({ conceptId: _c, prices, ...e }, i) => ({
        ...e,
        specimenType: u.kind === 'LABORATORY' ? c(i === 4 ? 'URINE' : 'BLOOD', i === 4 ? 'Orina' : 'Sangre') : null,
        requiresPriorAuthorization: i === 4,
        homeCollectionEligible: u.home && u.kind === 'LABORATORY',
        status: c('ACTIVE', 'Activo'),
        prices: prices.map((p, k) => ({ id: uuid(`price-${e.id}-${k}`), scheduleId: uuid(`schedule-${u.id}`), scheduleCode: p.scheduleCode, schedulePublic: true, versionNumber: 1, baseAmount: p.amount, patientAmount: p.amount, insurerAmount: (Number(p.amount) * 0.8).toFixed(2), currency: p.currency, effectiveFrom: isoDia(-100), effectiveTo: null, status: c('ACTIVE', 'Vigente') })),
      })),
      accreditations: acreditacionesDe(u),
      staff: PROFESIONALES.slice(9, 13).map((p, i) => ({ id: uuid(`unit-staff-${u.id}-${p.id}`), practitionerRoleAssignmentId: uuid(`ra-${p.id}`), practitionerProfileId: p.id, practitionerName: p.displayName, siteId: sitio.id, assignmentRole: c(i === 0 ? 'DIRECTOR' : 'ANALYST', i === 0 ? 'Director técnico' : 'Bioquímico/a'), specialty: null, mayValidateResults: i < 2, maySignReports: i === 0, validFrom: isoDia(-300), validTo: null, status: c('ACTIVE', 'Activo') })),
    };
  });

  router.get('/diagnostic-units/:id', ({ params }) => {
    const u = UNIDADES.find((x) => x.id === params['id']);
    if (u === undefined) return notFound('Centro no encontrado');
    return { ...itemDeDirectorio(u), sites: [sitioDe(u)], equipment: equipoDe(u).map(({ serialNumber: _s, daysToCalibration: _d, ...e }) => e), studies: estudiosDe(u).map(({ conceptId: _c, ...e }) => e), accreditations: acreditacionesDe(u).map(({ evidenceFileId: _f, daysToExpiry: _d, verificationStatus: _v, ...a }) => a) };
  });

  router.post('/diagnostic-units/:id/verify-and-publish', ({ params }) => {
    const u = UNIDADES.find((x) => x.id === params['id']);
    if (u === undefined) return notFound('Centro no encontrado');
    return { id: u.id, code: u.code, name: u.name, verificationStatus: 'VERIFIED', status: 'ACTIVE', publicProfileId: vitrinas.filtrar((v) => v.tenantId === u.tenantId)[0]?.id, siteCount: 1, accreditationCount: 2 };
  });
  router.post('/diagnostic-units/:id/study-offerings', (request) => {
    const datos = cuerpo<{ studyCode: string }>(request);
    return { status: 201, body: { id: nuevoId('offering'), studyCode: datos.studyCode ?? 'NUEVO', status: 'ACTIVE', componentCount: 0 } };
  });
  router.post('/diagnostic-units/:id/price-schedules', (request) => {
    const datos = cuerpo<{ code: string }>(request);
    return { status: 201, body: { id: nuevoId('schedule'), code: datos.code ?? 'TARIFA', status: 'ACTIVE' } };
  });
  router.post('/price-schedules/:id/study-prices', (request) => {
    const datos = cuerpo<{ effectiveFrom?: string }>(request);
    return { status: 201, body: { id: nuevoId('price'), versionNumber: 1, status: 'ACTIVE', effectiveFrom: datos.effectiveFrom ?? isoDia(0) } };
  });
  router.post('/study-prices/:id/close', () => ({ ok: true }));
  router.delete('/diagnostic-study-offerings/:id', () => ({ ok: true }));

  void PRIORIDAD;
  void PACIENTES;
}
