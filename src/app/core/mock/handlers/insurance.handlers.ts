import { PACIENTES, PACIENTE } from '../fixtures/personas';
import { notFound, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, isoDia, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Seguros: catálogo de aseguradoras, fichas, corredores y solicitudes
    (claims) con sus líneas, adjudicaciones y disputas.
    ========================================================================== */

function c(code: string, display: string) {
  return { code, display };
}

const BOB = c('BOB', 'Boliviano');
const money = (amount: string) => ({ amount, currency: BOB });

const ASEGURADORAS = [
  { id: uuid('carrier-andina'), carrierCode: 'ANDINA', legalName: 'Seguros Andina S.A.', name: 'Seguros Andina', regulatorIdentifier: 'APS-0042', isPublic: false, planes: [['ANDINA-INT', 'Plan Integral'], ['ANDINA-FAM', 'Plan Familiar'], ['ANDINA-ORO', 'Plan Oro']] },
  { id: uuid('carrier-vitalicia'), carrierCode: 'VITALICIA', legalName: 'La Vitalicia Seguros y Reaseguros de Vida S.A.', name: 'La Vitalicia', regulatorIdentifier: 'APS-0007', isPublic: false, planes: [['VIT-SALUD', 'Salud Total'], ['VIT-BASICO', 'Salud Básica']] },
  { id: uuid('carrier-alianza'), carrierCode: 'ALIANZA', legalName: 'Alianza Seguros y Reaseguros S.A.', name: 'Alianza Seguros', regulatorIdentifier: 'APS-0015', isPublic: false, planes: [['ALZ-ORO', 'Plan Oro'], ['ALZ-PLATA', 'Plan Plata']] },
  // Las cuatro que siguen son las que `faker/bolivia.ts` reparte entre los
  // pacientes generados: sin ficha propia, «Mi seguro» de esos pacientes no
  // tendría catálogo que mostrar.
  { id: uuid('carrier-bisa'), carrierCode: 'BISA', legalName: 'BISA Seguros y Reaseguros S.A.', name: 'BISA Seguros', regulatorIdentifier: 'APS-0021', isPublic: false, planes: [['BISA-VIDA', 'Salud Vida'], ['BISA-FAM', 'Plan Familiar']] },
  { id: uuid('carrier-nacional'), carrierCode: 'NACIONAL', legalName: 'Nacional Seguros Vida y Salud S.A.', name: 'Nacional Seguros', regulatorIdentifier: 'APS-0033', isPublic: false, planes: [['NAC-PLUS', 'Salud Plus'], ['NAC-FAM', 'Plan Familiar']] },
  { id: uuid('carrier-credinform'), carrierCode: 'CREDINFORM', legalName: 'Credinform International S.A. de Seguros', name: 'Credinform', regulatorIdentifier: 'APS-0009', isPublic: false, planes: [['CRD-INT', 'Plan Integral'], ['CRD-FAM', 'Plan Familiar']] },
  { id: uuid('carrier-univida'), carrierCode: 'UNIVIDA', legalName: 'Univida S.A.', name: 'Univida', regulatorIdentifier: 'APS-0051', isPublic: false, planes: [['UNI-SALUD', 'Salud Total'], ['UNI-FAM', 'Plan Familiar']] },
  { id: uuid('carrier-cns'), carrierCode: 'CNS', legalName: 'Caja Nacional de Salud', name: 'Caja Nacional de Salud', regulatorIdentifier: 'ASUSS-001', isPublic: true, planes: [['CNS-GEN', 'Seguro social obligatorio']] },
  { id: uuid('carrier-cps'), carrierCode: 'CPS', legalName: 'Caja Petrolera de Salud', name: 'Caja Petrolera de Salud', regulatorIdentifier: 'ASUSS-002', isPublic: true, planes: [['CPS-GEN', 'Seguro social obligatorio']] },
];

/** La aseguradora del catálogo a la que apunta el nombre que guarda un paciente. */
export function aseguradoraPorNombre(nombre: string | undefined) {
  return nombre === undefined ? undefined : ASEGURADORAS.find((a) => a.name === nombre);
}

/**
 * El número de asegurado de un paciente simulado: `AF-` más los dígitos de su
 * código. Es el mismo que publica su perfil (`coverages[].memberIdentifier`)
 * y el que figura en las solicitudes, así que lo que se ve en una pantalla se
 * puede escribir en la otra.
 */
export function numeroDeAsegurado(p: { readonly patientCode: string }): string {
  return `AF-${p.patientCode.slice(4)}`;
}

/** El plan de la aseguradora que el paciente declara, con el comodín como salida. */
function planDeclarado(a: (typeof ASEGURADORAS)[number], nombre: string | undefined) {
  return a.planes.find(([, n]) => n === nombre) ?? a.planes[0]!;
}

function resumenDeAseguradora(a: (typeof ASEGURADORAS)[number], i: number) {
  return {
    id: a.id,
    carrierCode: a.carrierCode,
    legalName: a.legalName,
    regulatorIdentifier: a.regulatorIdentifier,
    jurisdiction: c('BO', 'Bolivia'),
    status: c('ACTIVE', 'Activa'),
    verification: c('VERIFIED', 'Verificada'),
    productCount: 1 + (i % 2),
    planCount: a.planes.length,
    networkCount: 1,
    createdAt: iso(-600 + i * 40),
  };
}

function detalleDeAseguradora(a: (typeof ASEGURADORAS)[number], i: number) {
  return {
    ...resumenDeAseguradora(a, i),
    products: [
      {
        id: uuid(`product-${a.id}`),
        productCode: `${a.carrierCode}-SALUD`,
        name: `${a.name} · Salud`,
        productType: c('HEALTH', 'Salud'),
        marketSegment: c(a.isPublic ? 'PUBLIC' : 'INDIVIDUAL', a.isPublic ? 'Seguro social' : 'Individual y familiar'),
        status: c('ACTIVE', 'Activo'),
        plans: a.planes.map(([code, name], k) => ({
          id: uuid(`plan-${code}`),
          planCode: code!,
          name: name!,
          planType: c(k === 0 ? 'PREMIUM' : 'STANDARD', k === 0 ? 'Premium' : 'Estándar'),
          currency: BOB,
          effectiveFrom: isoDia(-365),
          effectiveTo: null,
          status: c('ACTIVE', 'Vigente'),
          policyDocumentFileId: null,
          benefits: [
            { id: uuid(`benefit-${code}-1`), category: c('CONSULTATION', 'Consulta médica'), service: c('CONS', 'Consulta ambulatoria'), coveragePercent: k === 0 ? '100' : '80', copayAmount: k === 0 ? '0.00' : '30.00', deductibleAmount: null, annualLimitAmount: null, requiresPriorAuthorization: false, effectiveFrom: isoDia(-365), effectiveTo: null },
            { id: uuid(`benefit-${code}-2`), category: c('HOSPITALIZATION', 'Internación'), service: null, coveragePercent: k === 0 ? '90' : '70', copayAmount: null, deductibleAmount: '500.00', annualLimitAmount: '150000.00', requiresPriorAuthorization: true, effectiveFrom: isoDia(-365), effectiveTo: null },
            { id: uuid(`benefit-${code}-3`), category: c('LAB', 'Laboratorio e imagen'), service: null, coveragePercent: '80', copayAmount: null, deductibleAmount: null, annualLimitAmount: '20000.00', requiresPriorAuthorization: false, effectiveFrom: isoDia(-365), effectiveTo: null },
            { id: uuid(`benefit-${code}-4`), category: c('PHARMACY', 'Medicamentos'), service: null, coveragePercent: '60', copayAmount: null, deductibleAmount: null, annualLimitAmount: '8000.00', requiresPriorAuthorization: false, effectiveFrom: isoDia(-365), effectiveTo: null },
          ],
        })),
      },
    ],
    networks: [{ id: uuid(`network-${a.id}`), networkCode: `${a.carrierCode}-RED`, name: `Red de prestadores ${a.name}`, networkType: c('PREFERRED', 'Preferente'), status: c('ACTIVE', 'Activa'), effectiveFrom: isoDia(-365), effectiveTo: null, memberCount: 120 + i * 35 }],
  };
}

const CORREDORES = [
  { id: uuid('broker-1'), brokerCode: 'BRK-001', legalName: 'Consultores en Seguros Oriente S.R.L.', licenseNumber: 'CS-2210', independent: true, carriers: [0, 1] },
  { id: uuid('broker-2'), brokerCode: 'BRK-002', legalName: 'Mónica Aguirre · Agente de seguros', licenseNumber: 'CS-3388', independent: true, carriers: [2] },
  { id: uuid('broker-3'), brokerCode: 'BRK-003', legalName: 'Andina Corredores S.A.', licenseNumber: 'CS-0910', independent: false, carriers: [0] },
];

function resumenDeCorredor(b: (typeof CORREDORES)[number], i: number) {
  return {
    id: b.id,
    brokerCode: b.brokerCode,
    legalName: b.legalName,
    licenseNumber: b.licenseNumber,
    jurisdiction: c('BO', 'Bolivia'),
    status: c('ACTIVE', 'Activo'),
    verification: c(i === 1 ? 'PENDING' : 'VERIFIED', i === 1 ? 'Pendiente' : 'Verificado'),
    independent: b.independent,
    currentCarrierCount: b.carriers.length,
    createdAt: iso(-400 + i * 50),
  };
}

interface SolicitudSimulada {
  readonly id: string;
  readonly claimIdentifier: string;
  readonly patientProfileId: string;
  readonly carrierIndex: number;
  readonly policyIdentifier: string;
  readonly billed: string;
  readonly approved: string | null;
  readonly submittedAt: string;
  readonly status: { code: string; display: string };
  readonly hasOpenDispute: boolean;
  readonly lineas: readonly { service: string; billed: string; approved: string | null; decision: string }[];
}

const solicitudes = new Coleccion<SolicitudSimulada>(
  [
    ['CLM-2026-0142', 0, '1250.00', '1000.00', -20, 'APPROVED', 'Aprobada', false, [['Consulta cardiológica', '250.00', '200.00', 'APPROVED'], ['Ecocardiograma Doppler', '480.00', '384.00', 'APPROVED'], ['Perfil lipídico', '90.00', '72.00', 'APPROVED'], ['Holter 24 h', '350.00', '280.00', 'APPROVED'], ['Certificado', '80.00', '64.00', 'APPROVED']]],
    ['CLM-2026-0158', 0, '520.00', null, -6, 'IN_REVIEW', 'En revisión', false, [['Prueba de esfuerzo', '520.00', null, 'PENDING']]],
    ['CLM-2026-0163', 1, '890.00', '0.00', -12, 'REJECTED', 'Rechazada', true, [['Paquete de prevención', '890.00', '0.00', 'DENIED']]],
    ['CLM-2026-0171', 0, '250.00', '250.00', -2, 'PAID', 'Pagada', false, [['Consulta cardiológica', '250.00', '250.00', 'APPROVED']]],
    ['CLM-2026-0177', 2, '300.00', '150.00', -9, 'PARTIAL', 'Aprobada parcialmente', false, [['Control cardiológico', '180.00', '150.00', 'APPROVED'], ['ECG', '120.00', '0.00', 'DENIED']]],
    ['CLM-2026-0180', 0, '600.00', null, -1, 'SUBMITTED', 'Enviada', false, [['Ecocardiograma Doppler', '480.00', null, 'PENDING'], ['ECG', '120.00', null, 'PENDING']]],
  ].map(([claimIdentifier, carrierIndex, billed, approved, dias, code, display, disputa, lineas], i) => ({
    id: uuid(`claim-${claimIdentifier}`),
    claimIdentifier: claimIdentifier as string,
    patientProfileId: PACIENTES[[0, 5, 2, 0, 8, 0][i]!]!.id,
    carrierIndex: carrierIndex as number,
    policyIdentifier: `POL-${100200 + i * 17}`,
    billed: billed as string,
    approved: approved as string | null,
    submittedAt: iso(dias as number, 10),
    status: c(code as string, display as string),
    hasOpenDispute: disputa as boolean,
    lineas: (lineas as [string, string, string | null, string][]).map(([service, b, a, decision]) => ({ service, billed: b, approved: a, decision })),
  })),
);

function itemDeSolicitud(s: SolicitudSimulada) {
  const paciente = PACIENTES.find((p) => p.id === s.patientProfileId) ?? PACIENTE;
  const aseguradora = ASEGURADORAS[s.carrierIndex]!;
  return {
    id: s.id,
    claimIdentifier: s.claimIdentifier,
    patient: { id: paciente.id, displayName: paciente.displayName, patientCode: paciente.patientCode, memberIdentifier: `AF-${paciente.patientCode.slice(4)}` },
    carrierName: aseguradora.name,
    insuranceCarrierId: aseguradora.id,
    policyIdentifier: s.policyIdentifier,
    policyBrokerName: s.carrierIndex === 0 ? CORREDORES[0]!.legalName : null,
    billedTotal: money(s.billed),
    approvedTotal: s.approved === null ? null : money(s.approved),
    submittedAt: s.submittedAt,
    status: s.status,
    hasOpenDispute: s.hasOpenDispute,
  };
}

export function registrarSeguros(router: MockRouter): void {
  // El sobre `{ carriers }` no es decorativo: `InsuranceClient.listCarrierCatalog`
  // mapea `body.carriers`, y devolver el array pelado le dejaba `undefined`.
  // El `for...of` de `RegisterPatient.opcionesDeSeguro` lo recorría igual y
  // tiraba la pantalla entera de alta de paciente.
  router.get('/insurance-carrier-catalog', () => ({
    carriers: ASEGURADORAS.map((a) => ({ id: a.id, code: a.carrierCode, name: a.name, legalName: a.legalName, isPublic: a.isPublic, plans: a.planes.map(([code, name]) => ({ id: uuid(`plan-${code}`), code, name })) })),
  }));

  // Búsqueda por número de asegurado (alta de paciente). Va antes que `/:id`
  // por tener más segmentos literales; el router ya la prefiere igual.
  //
  // Contrato declarado acá y **no publicado por la API real**: la pantalla de
  // registro lo consume y el backend tiene que darlo de alta.
  router.get('/insurance-carrier-catalog/members/:memberIdentifier', ({ params }) => {
    const numero = decodeURIComponent(params['memberIdentifier'] ?? '').trim().toUpperCase();
    const p = PACIENTES.find((x) => x.aseguradora !== undefined && numeroDeAsegurado(x) === numero);
    const a = aseguradoraPorNombre(p?.aseguradora);
    if (p === undefined || a === undefined) return notFound('Ninguna aseguradora reconoce ese número de asegurado');
    const [planCode, planName] = planDeclarado(a, p.plan);
    return {
      memberIdentifier: numero,
      carrierId: a.id,
      carrierName: a.name,
      isPublic: a.isPublic,
      planId: uuid(`plan-${planCode}`),
      planName,
      person: {
        name: p.name,
        ...(p.middleName === undefined ? {} : { middleName: p.middleName }),
        lastName: p.lastName,
        motherLastName: p.motherLastName,
        nationalId: p.nationalId,
        birthDate: p.birthDate,
        sexAtBirth: p.sexAtBirth,
        phone: p.phone,
        email: p.email,
      },
    };
  });

  // La ficha pública de una aseguradora del catálogo, para «Mi seguro» del
  // paciente. `/insurance-carriers/:id` no sirve: acota al tenant activo.
  // Contrato declarado por el simulador, pendiente en la API real.
  router.get('/insurance-carrier-catalog/:id', ({ params }) => {
    const i = ASEGURADORAS.findIndex((a) => a.id === params['id']);
    return i < 0 ? notFound('Aseguradora no encontrada') : detalleDeAseguradora(ASEGURADORAS[i]!, i);
  });

  router.get('/insurance-carriers', () => ({ items: ASEGURADORAS.map(resumenDeAseguradora), count: ASEGURADORAS.length }));

  router.get('/insurance-carriers/:id', ({ params }) => {
    const i = ASEGURADORAS.findIndex((a) => a.id === params['id']);
    return i < 0 ? notFound('Aseguradora no encontrada') : detalleDeAseguradora(ASEGURADORAS[i]!, i);
  });

  router.get('/insurance-brokers', () => ({ items: CORREDORES.map(resumenDeCorredor), count: CORREDORES.length }));

  router.get('/insurance-brokers/:id', ({ params }) => {
    const i = CORREDORES.findIndex((b) => b.id === params['id']);
    if (i < 0) return notFound('Corredor no encontrado');
    const b = CORREDORES[i]!;
    return {
      ...resumenDeCorredor(b, i),
      publicProfileId: null,
      agreements: b.carriers.map((k, j) => ({
        id: uuid(`agreement-${b.id}-${k}`),
        insuranceCarrierId: ASEGURADORAS[k]!.id,
        carrierLegalName: ASEGURADORAS[k]!.legalName,
        agreementCode: `${b.brokerCode}-${ASEGURADORAS[k]!.carrierCode}`,
        commissionModel: c('PERCENT', 'Porcentaje de prima'),
        effectiveFrom: isoDia(-300 - j * 100),
        effectiveTo: null,
        status: c('ACTIVE', 'Vigente'),
        current: true,
        contractFileId: null,
      })),
    };
  });

  router.get('/insurance-brokers/:id/clients', ({ params }) => {
    const b = CORREDORES.find((x) => x.id === params['id']);
    if (b === undefined) return notFound('Corredor no encontrado');
    const items = PACIENTES.filter((p) => p.aseguradora !== undefined).slice(0, 4).map((p, i) => ({
      id: uuid(`broker-client-${b.id}-${p.id}`),
      patientProfileId: p.id,
      employerGroupId: null,
      clientType: c('INDIVIDUAL', 'Individual'),
      assignedBrokerUserId: uuid('user-broker-1'),
      effectiveFrom: isoDia(-200 - i * 20),
      effectiveTo: null,
      status: c('ACTIVE', 'Activo'),
    }));
    return { items, count: items.length };
  });

  router.get('/insurance-claims', ({ query }) => {
    const status = texto(query, 'statusConceptId');
    const carrier = texto(query, 'insuranceCarrierId');
    const items = solicitudes
      .todos()
      .filter((s) => status === null || s.status.code === status)
      .filter((s) => carrier === null || ASEGURADORAS[s.carrierIndex]!.id === carrier)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map(itemDeSolicitud);
    const pagina = paginar(items, query, 20);
    return { items: pagina.items, nextCursor: pagina.nextCursor };
  });

  router.post('/insurance-claims', (request) => {
    const datos = cuerpo<{ patientProfileId?: string; insuranceCarrierId?: string; policyIdentifier?: string; lines?: { service: string; billedAmount: string }[] }>(request);
    const carrierIndex = Math.max(0, ASEGURADORAS.findIndex((a) => a.id === datos.insuranceCarrierId));
    const lineas = (datos.lines ?? [{ service: 'Consulta', billedAmount: '250.00' }]).map((l) => ({ service: l.service, billed: l.billedAmount, approved: null, decision: 'PENDING' }));
    const nueva = solicitudes.agregar({
      id: nuevoId('claim'),
      claimIdentifier: `CLM-2026-${String(200 + solicitudes.tamano).padStart(4, '0')}`,
      patientProfileId: datos.patientProfileId ?? PACIENTE.id,
      carrierIndex,
      policyIdentifier: datos.policyIdentifier ?? 'POL-NUEVA',
      billed: lineas.reduce((s, l) => s + Number(l.billed), 0).toFixed(2),
      approved: null,
      submittedAt: ahora(),
      status: c('SUBMITTED', 'Enviada'),
      hasOpenDispute: false,
      lineas,
    });
    return { status: 201, body: itemDeSolicitud(nueva) };
  });

  router.get('/insurance-claims/:id', ({ params }) => {
    const s = solicitudes.get(params['id']!);
    if (s === undefined) return notFound('Solicitud no encontrada');
    const adjudicada = s.approved !== null;
    const adjudicacion = adjudicada
      ? {
          id: uuid(`adj-${s.id}`),
          adjudicationVersion: 1,
          outcome: s.status,
          dispositionText: s.status.code === 'REJECTED' ? 'Prestación no cubierta por el plan contratado.' : s.status.code === 'PARTIAL' ? 'El electrocardiograma requiere autorización previa.' : 'Aprobada según tarifario vigente.',
          totalApprovedAmount: money(s.approved!),
          totalPatientAmount: money((Number(s.billed) - Number(s.approved)).toFixed(2)),
          totalDeniedAmount: money(s.lineas.filter((l) => l.decision === 'DENIED').reduce((t, l) => t + Number(l.billed), 0).toFixed(2)),
          adjudicatedAt: iso(-1),
        }
      : null;
    return {
      header: itemDeSolicitud(s),
      lines: s.lineas.map((l, i) => ({
        id: uuid(`line-${s.id}-${i}`),
        lineSequence: i + 1,
        service: c(`SVC-${i}`, l.service),
        billedAmount: money(l.billed),
        patientResponsibilityAmount: l.approved === null ? null : money((Number(l.billed) - Number(l.approved)).toFixed(2)),
        approvedAmount: l.approved === null ? null : money(l.approved),
        deniedAmount: l.decision === 'DENIED' ? money(l.billed) : null,
        decision: c(l.decision, l.decision === 'APPROVED' ? 'Aprobada' : l.decision === 'DENIED' ? 'Denegada' : 'Pendiente'),
        denialReason: l.decision === 'DENIED' ? c('NOT_COVERED', 'No cubierto') : null,
        referenceType: null,
        reference: null,
      })),
      lineBilledTotal: money(s.billed),
      lineApprovedTotal: s.approved === null ? null : money(s.approved),
      adjudication: adjudicacion,
      adjudicationHistory: adjudicacion === null ? [] : [adjudicacion],
      disputes: s.hasOpenDispute ? [{ id: uuid(`dispute-${s.id}`), disputeType: c('APPEAL', 'Apelación'), disputeReason: c('COVERAGE', 'Discrepancia de cobertura'), status: c('OPEN', 'Abierta'), submittedAt: iso(-8), filingDeadline: iso(22) }] : [],
    };
  });

  router.post('/insurance-claims/:id/disputes', (request) => {
    const s = solicitudes.get(request.params['id']!);
    if (s === undefined) return notFound();
    solicitudes.actualizar(s.id, { hasOpenDispute: true });
    return { status: 201, body: { id: nuevoId('dispute'), disputeType: c('APPEAL', 'Apelación'), disputeReason: c('COVERAGE', 'Discrepancia de cobertura'), status: c('OPEN', 'Abierta'), submittedAt: ahora(), filingDeadline: iso(30) } };
  });
}
