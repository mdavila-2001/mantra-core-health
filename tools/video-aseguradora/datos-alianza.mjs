/* ============================================================================
    Los datos del video de la aseguradora, presentada como Alianza Seguros.

    Viven SOLO acá, no en la maqueta del repo: `grabar.mjs` los siembra en el
    `sessionStorage` de la pestaña que graba, con la misma forma que guardan
    las colecciones del simulador (`Coleccion.persistirEn`).

    Qué es exacto y qué es referencial:
      - Emisión Rápida (Planes 1 a 4): cuota mensual, capital por muerte o
        invalidez, beneficio educacional o canasta, telemedicina sin costo y
        copago de Bs 20 por consulta presencial: valores publicados por la
        aseguradora (alianza.com.bo, Quote360). `fuente: 'oficial'`.
      - Silver, Salud Mundial Plus y Asistencia Familiar Integral: la
        aseguradora no publica la cuota. La cuota, los porcentajes y los topes
        son **referenciales, inventados para la demo** (`fuente: 'referencial'`);
        sólo la maternidad de Salud Mundial Plus (Bs 700.000) sale de la fuente.
      - Las personas, médicos, consultorios, pólizas y montos de las solicitudes
        son ficticios.
    ========================================================================== */

/** El mismo uuid determinístico que `uuid()` de `src/app/core/mock/mock-store.ts`. */
export function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

export const ASEGURADORA = {
  nombre: 'Alianza Seguros',
  razonSocial: 'Alianza Seguros y Reaseguros S.A.',
  codigo: 'ALIANZA',
  sigla: 'ASR',
  registro: 'APS-0015',
  direccion: 'Av. Camacho N.º 1400, La Paz',
};

const c = (code, display) => ({ code, display });
const BOB = c('BOB', 'Boliviano');
const money = (amount) => ({ amount, currency: BOB });

/* ---- fechas relativas a hoy (La Paz) -------------------------------------- */

const DIA = 86_400_000;
function iso(diasAtras, hora = 9, minutos = 0) {
  const d = new Date(Date.now() - diasAtras * DIA);
  d.setUTCHours(hora + 4, minutos, 0, 0); // La Paz es UTC-4
  return d.toISOString();
}
const isoDia = (diasAtras) => iso(diasAtras).slice(0, 10);

/* ---- catálogo: productos y planes ----------------------------------------- */

function beneficio(id, category, datos) {
  return {
    id: uuid(`alz-benefit-${id}`),
    category,
    service: null,
    coveragePercent: null,
    copayAmount: null,
    deductibleAmount: null,
    annualLimitAmount: null,
    requiresPriorAuthorization: false,
    approvalRules: { requiredDocuments: [], exclusionNotes: null },
    effectiveFrom: isoDia(365),
    effectiveTo: null,
    ...datos,
  };
}

function plan(code, name, cuota, premium, fuente, beneficios) {
  return {
    id: uuid(`alz-plan-${code}`),
    planCode: code,
    name,
    planType: premium ? c('PREMIUM', 'Premium') : c('STANDARD', 'Estándar'),
    currency: BOB,
    monthlyPremiumAmount: cuota,
    effectiveFrom: isoDia(365),
    effectiveTo: null,
    status: c('ACTIVE', 'Vigente'),
    policyDocumentFileId: null,
    benefits: beneficios,
    // Lo ignora la pantalla; queda para el README y el reporte.
    fuente,
  };
}

/** Emisión Rápida: los cuatro planes publicados, con sus valores exactos. */
const EMISION_RAPIDA = [
  ['ALZ-ER-1', 'Emisión Rápida Plan 1', '90.00', '3000.00', '3600.00'],
  ['ALZ-ER-2', 'Emisión Rápida Plan 2', '120.00', '5000.00', '6000.00'],
  ['ALZ-ER-3', 'Emisión Rápida Plan 3', '180.00', '10000.00', '12000.00'],
  ['ALZ-ER-4', 'Emisión Rápida Plan 4', '250.00', '15000.00', '18000.00'],
].map(([code, name, cuota, capital, canasta], k) =>
  plan(code, name, cuota, k === 3, 'oficial', [
    beneficio(`${code}-muerte`, c('ACCIDENTAL_DEATH', 'Muerte o invalidez'), {
      coveragePercent: '100',
      annualLimitAmount: capital,
    }),
    beneficio(`${code}-canasta`, c('EDUCATION_BENEFIT', 'Beneficio educacional o canasta'), {
      coveragePercent: '100',
      annualLimitAmount: canasta,
    }),
    beneficio(`${code}-tele`, c('TELEMEDICINE', 'Telemedicina ilimitada'), {
      coveragePercent: '100',
      copayAmount: '0.00',
    }),
    beneficio(`${code}-consulta`, c('CONSULTATION', 'Consulta presencial: general, especialidades, pediatría y odontología'), {
      coveragePercent: '100',
      copayAmount: '20.00',
    }),
  ]),
);

/** Silver: cuota y topes referenciales; las coberturas, de la fuente. */
const SILVER = plan('ALZ-SILVER', 'Plan Silver', '380.00', false, 'referencial', [
  beneficio('silver-cirugia', c('SURGERY', 'Cirugías'), {
    coveragePercent: '90',
    deductibleAmount: '300.00',
    annualLimitAmount: '120000.00',
    requiresPriorAuthorization: true,
    approvalRules: { requiredDocuments: ['ORDEN_MEDICA'], exclusionNotes: null },
  }),
  beneficio('silver-onco', c('ONCOLOGY', 'Tratamiento oncológico y quimioterapia'), {
    coveragePercent: '90',
    annualLimitAmount: '150000.00',
    requiresPriorAuthorization: true,
    approvalRules: { requiredDocuments: ['INFORME_CLINICO'], exclusionNotes: null },
  }),
  beneficio('silver-maternidad', c('MATERNITY', 'Maternidad'), {
    coveragePercent: '80',
    annualLimitAmount: '15000.00',
  }),
  beneficio('silver-estudios', c('LAB', 'Estudios de alta complejidad'), {
    coveragePercent: '80',
    annualLimitAmount: '20000.00',
  }),
  beneficio('silver-farmacia', c('PHARMACY', 'Medicamentos en Farmacias Chávez'), {
    coveragePercent: '70',
    annualLimitAmount: '10000.00',
  }),
  beneficio('silver-24', c('EMERGENCY', 'Atención de urgencias 24/7'), {
    coveragePercent: '100',
    copayAmount: '0.00',
  }),
]);

/** Salud Mundial Plus: maternidad de la fuente; cuota y el resto, referenciales. */
const MUNDIAL = plan('ALZ-MUNDI', 'Salud Mundial Plus', '1250.00', true, 'referencial', [
  beneficio('mundi-libre', c('CONSULTATION', 'Libre elección de clínicas y especialistas, nacional e internacional'), {
    coveragePercent: '100',
    copayAmount: '0.00',
  }),
  beneficio('mundi-internacion', c('HOSPITALIZATION', 'Internación en Bolivia y en el exterior'), {
    coveragePercent: '100',
    deductibleAmount: '1000.00',
    annualLimitAmount: '7000000.00',
    requiresPriorAuthorization: true,
    approvalRules: { requiredDocuments: ['ORDEN_MEDICA'], exclusionNotes: null },
  }),
  beneficio('mundi-maternidad', c('MATERNITY', 'Maternidad'), {
    coveragePercent: '100',
    annualLimitAmount: '700000.00',
  }),
  beneficio('mundi-recien', c('NEWBORN', 'Recién nacido'), {
    coveragePercent: '100',
    annualLimitAmount: '70000.00',
  }),
  beneficio('mundi-aerea', c('AIR_AMBULANCE', 'Ambulancia aérea'), {
    coveragePercent: '100',
    requiresPriorAuthorization: true,
    approvalRules: { requiredDocuments: ['INFORME_CLINICO'], exclusionNotes: null },
  }),
]);

/** Asistencia Familiar Integral: todo referencial. */
const ASISTENCIA = plan('ALZ-AFI', 'Asistencia Familiar Integral', '65.00', false, 'referencial', [
  beneficio('afi-consulta', c('CONSULTATION', 'Consultas médicas generales'), {
    coveragePercent: '100',
    copayAmount: '30.00',
  }),
  beneficio('afi-especialidad', c('SPECIALTY', 'Consultas de especialidad'), {
    coveragePercent: '80',
    copayAmount: '50.00',
  }),
  beneficio('afi-lab', c('LAB', 'Laboratorio básico'), {
    coveragePercent: '70',
    annualLimitAmount: '1500.00',
  }),
]);

function producto(code, name, tipo, segmento, planes) {
  return {
    id: uuid(`alz-product-${code}`),
    productCode: code,
    name,
    productType: tipo,
    marketSegment: segmento,
    status: c('ACTIVE', 'Activo'),
    plans: planes,
  };
}

const PRODUCTOS = [
  producto('ALZ-ER', 'Emisión Rápida (digital por QR)', c('PERSONAL_ACCIDENT', 'Vida y accidentes'), c('INDIVIDUAL', 'Individual'), EMISION_RAPIDA),
  producto('ALZ-SALUD', 'Salud Integral', c('HEALTH', 'Salud'), c('FAMILY', 'Familiar'), [SILVER]),
  producto('ALZ-MUNDI', 'Mundisalud', c('HEALTH', 'Salud'), c('INDIVIDUAL', 'Individual y familiar'), [MUNDIAL]),
  producto('ALZ-AFI', 'Asistencia Familiar Integral', c('HEALTH', 'Salud'), c('FAMILY', 'Familiar'), [ASISTENCIA]),
];

export const PLANES = PRODUCTOS.flatMap((p) => p.plans);

export const CATALOGO = [
  {
    id: uuid('carrier-alianza'),
    carrierCode: ASEGURADORA.codigo,
    legalName: ASEGURADORA.razonSocial,
    regulatorIdentifier: ASEGURADORA.registro,
    whatsappNumber: '+59170000103',
    callCenterPhone: '800-10-0103',
    supportEmail: 'siniestros@mail.com',
    jurisdiction: c('BO', 'Bolivia'),
    status: c('ACTIVE', 'Activa'),
    verification: c('VERIFIED', 'Verificada'),
    productCount: PRODUCTOS.length,
    planCount: PLANES.length,
    networkCount: 1,
    createdAt: iso(600),
    canAdminister: false,
    products: PRODUCTOS,
    networks: [
      {
        id: uuid('alz-network'),
        networkCode: 'ALIANZA-RED',
        name: 'Red de prestadores Alianza Seguros',
        networkType: c('PREFERRED', 'Preferente'),
        status: c('ACTIVE', 'Activa'),
        effectiveFrom: isoDia(365),
        effectiveTo: null,
        memberCount: 185,
      },
    ],
  },
];

/* ---- personas ficticias ---------------------------------------------------- */

/**
 * `[nombre, apellidos, nacimiento, sexo, profesión, plan, siniestralidad]`.
 * La siniestralidad es la meta de aprobado ÷ prima del año (el período por
 * omisión de «Siniestralidad»): da filas en verde (< 75 %), ámbar (75–85 %) y
 * rojo (> 85 %). `plan: null` = sin seguro con Alianza.
 */
const PERSONAS = [
  ['María Fernanda', 'Quispe Mamani', '1988-03-14', 'F', 'Contadora', 'ALZ-ER-2', 0.42],
  ['José Luis', 'Choque Rojas', '1979-11-02', 'M', 'Ingeniero civil', 'ALZ-SILVER', 0.81],
  ['Gabriela', 'Rodríguez Vaca', '1992-06-27', 'F', 'Docente', 'ALZ-ER-1', 1.18],
  ['Carlos Andrés', 'Gutiérrez Flores', '1985-01-19', 'M', 'Comerciante', 'ALZ-ER-3', 0.55],
  ['Ana Lucía', 'Mamani Condori', '1995-09-08', 'F', 'Enfermera', 'ALZ-MUNDI', 0.36],
  ['Roberto', 'Vargas Paz', '1968-12-30', 'M', 'Abogado', 'ALZ-SILVER', 1.07],
  ['Paola', 'Torrico Salazar', '1990-04-22', 'F', 'Arquitecta', 'ALZ-ER-4', 0.77],
  ['Luis Fernando', 'Aguilar Copa', '1983-07-11', 'M', 'Chofer', 'ALZ-ER-1', 0.63],
  ['Daniela', 'Céspedes Rocha', '1998-02-05', 'F', 'Estudiante', 'ALZ-AFI', 0.48],
  ['Marco Antonio', 'Limachi Huanca', '1975-05-16', 'M', 'Mecánico', 'ALZ-ER-2', 0.84],
  ['Verónica', 'Suárez Ortiz', '1987-10-03', 'F', 'Odontóloga', 'ALZ-MUNDI', 0.58],
  ['Jorge', 'Apaza Ticona', '1972-08-25', 'M', 'Agricultor', 'ALZ-ER-3', 0.92],
  ['Claudia', 'Montaño Ribera', '1993-12-12', 'F', 'Diseñadora gráfica', 'ALZ-AFI', 0.27],
  ['Ricardo', 'Lazarte Peña', '1981-03-29', 'M', 'Policía', 'ALZ-ER-4', 0.51],
  ['Silvia', 'Calle Zeballos', '1966-06-18', 'F', 'Ama de casa', 'ALZ-SILVER', 0.69],
  ['Fernando', 'Ríos Arancibia', '1989-09-21', 'M', 'Contador', 'ALZ-ER-1', 0.33],
  ['Lorena', 'Patiño Cruz', '1996-01-07', 'F', 'Cajera', 'ALZ-ER-2', 0.79],
  ['Hugo', 'Villca Medina', '1977-04-10', 'M', 'Electricista', 'ALZ-AFI', 1.32],
  ['Valeria', 'Soliz Antezana', '1999-11-28', 'F', 'Estudiante', null, null],
  ['Sergio', 'Cuéllar Justiniano', '1984-02-15', 'M', 'Veterinario', null, null],
  ['Rosa', 'Nina Poma', '1970-07-04', 'F', 'Comerciante', null, null],
];

function quitarTildes(s) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export const PERSONAS_DEL_VIDEO = PERSONAS.map(([nombre, apellidos, nacimiento, sexo, profesion, planCode, meta], i) => {
  const id = uuid(`alz-person-${i}`);
  const [primerNombre] = nombre.split(' ');
  const [paterno] = apellidos.split(' ');
  return {
    id,
    fullName: `${nombre} ${apellidos}`,
    birthDate: nacimiento,
    phone: `+591 7${String(1_200_000 + i * 37_119).slice(0, 3)} ${String(4_000 + i * 263).slice(0, 4)}`,
    email: `${quitarTildes(primerNombre)}.${quitarTildes(paterno)}@mail.com`,
    genderCode: sexo === 'F' ? 'GENDER_FEMALE' : 'GENDER_MALE',
    occupationDisplay: profesion,
    plan: planCode === null ? null : PLANES.find((p) => p.planCode === planCode),
    meta,
    patientCode: `PAC-${String(52_000 + i * 17).padStart(6, '0')}`,
  };
});

/* ---- directorio de pacientes (`mock.insurance.patients`) ------------------ */

const INSURER_DEL_DIRECTORIO = { id: uuid('directory-insurer-Alianza Seguros'), name: ASEGURADORA.nombre };

export const DIRECTORIO = PERSONAS_DEL_VIDEO.map((p, i) => ({
  id: p.id,
  patientProfileId: p.id,
  fullName: p.fullName,
  birthDate: p.birthDate,
  phone: p.phone,
  email: p.email,
  genderConceptId: null,
  genderCode: p.genderCode,
  occupationDisplay: p.occupationDisplay,
  insurers: p.plan === null ? [] : [INSURER_DEL_DIRECTORIO],
  createdAt: new Date(Date.UTC(2025, 1, 1 + i * 9)).toISOString(),
}));

/* ---- solicitudes recibidas (`mock.insurerReceivedClaims`) ----------------- */

const MEDICOS = [
  ['Dra. Carla Méndez Arze', 'Medicina general', 'Consultorio Méndez · Sopocachi'],
  ['Dr. Javier Rosales Ugarte', 'Pediatría', 'Centro Pediátrico Los Andes'],
  ['Dra. Mónica Terrazas Lima', 'Ginecología y obstetricia', 'Clínica Materno Infantil Illimani'],
  ['Dr. Óscar Pinto Saavedra', 'Traumatología', 'Centro Médico Miraflores'],
  ['Dra. Lucía Arce Bustillos', 'Odontología', 'Clínica Dental Sonrisa'],
  ['Dr. Raúl Guzmán Ferrufino', 'Cardiología', 'Instituto del Corazón Calacoto'],
  ['Dra. Elena Vidaurre Soto', 'Oncología', 'Centro Oncológico del Sur'],
].map(([displayName, specialty, providerName], i) => ({
  id: uuid(`alz-practitioner-${i}`),
  displayName,
  specialty,
  providerName,
}));

/** Servicio, precio base y qué médicos lo prestan, por tipo de plan. */
const SERVICIOS_SIMPLES = [
  ['SVC_CONSULTA_GENERAL', 'Consulta general', 150, [0]],
  ['SVC_CONSULTA_ESPECIALIDAD', 'Consulta de especialidad', 250, [1, 3, 5]],
  ['SVC_ODONTOLOGIA', 'Consulta odontológica', 180, [4]],
  ['SVC_HEMOGRAMA', 'Hemograma completo', 80, [0]],
  ['SVC_ECOGRAFIA', 'Ecografía', 320, [2]],
];
const SERVICIOS_MAYORES = [
  ['SVC_CIRUGIA_MENOR', 'Cirugía menor', 1800, [3]],
  ['SVC_INTERNACION_DIA', 'Internación (día)', 1400, [5]],
  ['SVC_QUIMIOTERAPIA', 'Sesión de quimioterapia', 3500, [6]],
  ['SVC_TOMOGRAFIA', 'Tomografía computarizada', 1100, [5]],
];

/** Generador congruencial: la misma semilla da siempre el mismo video. */
function azar(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1_664_525) + 1_013_904_223) >>> 0;
    return estado / 0x1_0000_0000;
  };
}
const elegir = (lista, r) => lista[Math.floor(r() * lista.length)];
const fijo2 = (n) => n.toFixed(2);

let correlativo = 0;
let factura = 0;

function solicitud(persona, servicio, total, aprobado, estado, diasAtras, r) {
  correlativo += 1;
  const [code, display, , medicos] = servicio;
  const medico = MEDICOS[elegir(medicos, r)];
  const decidida = aprobado !== null;
  const decididaEn = iso(Math.max(0, diasAtras - 2), 11, (correlativo * 13) % 60);
  const outcome = { APPROVED: 'APPROVED', PAID: 'APPROVED', PARTIAL: 'PARTIAL', REJECTED: 'REJECTED' }[estado[0]];
  const motivo = {
    PARTIAL: 'El plan cubre una parte de este servicio; el resto corre por copago.',
    REJECTED: 'El servicio no está cubierto por el plan de la póliza.',
  }[estado[0]] ?? null;
  const conFactura = decidida && estado[0] !== 'REJECTED';
  if (conFactura) factura += 1;
  return {
    id: uuid(`alz-claim-${correlativo}`),
    claimIdentifier: `CLM-2026-${String(2000 + correlativo).padStart(4, '0')}`,
    patient: {
      id: persona.id,
      displayName: persona.fullName,
      patientCode: persona.patientCode,
      memberIdentifier: `AF-${persona.patientCode.slice(4)}`,
    },
    practitioner: { id: medico.id, displayName: medico.displayName, specialty: medico.specialty },
    providerName: medico.providerName,
    service: { code, display },
    additionalServiceCount: 0,
    billedTotal: money(fijo2(total)),
    approvedTotal: aprobado === null ? null : money(fijo2(aprobado)),
    submittedAt: iso(diasAtras, 8 + (correlativo % 9), (correlativo * 7) % 60),
    serviceDate: isoDia(diasAtras + 1 + (correlativo % 4)),
    policyIdentifier: `POL-ALZ-${String(710_000 + persona.patientCode.slice(-3) * 7).padStart(6, '0')}`,
    planName: `${ASEGURADORA.nombre} · ${persona.plan.name}`,
    status: { code: estado[0], display: estado[1] },
    lines: [
      {
        sequence: 1,
        code,
        display,
        quantity: 1,
        unitPrice: money(fijo2(total)),
        billedAmount: money(fijo2(total)),
      },
    ],
    decision: decidida
      ? { outcome, decidedAt: decididaEn, decidedBy: 'Patricia Rojas', reason: motivo }
      : null,
    invoice: conFactura
      ? {
          id: uuid(`alz-invoice-${correlativo}`),
          invoiceNumber: `FAC-${String(8_200 + factura).padStart(6, '0')}`,
          amount: money(fijo2(aprobado)),
          status: 'ISSUED',
          issuedAt: decididaEn,
          annulledAt: null,
          annulmentReason: null,
          previous: [],
        }
      : null,
  };
}

const APROBADA = ['APPROVED', 'Aprobada'];
const PAGADA = ['PAID', 'Pagada'];
const PARCIAL = ['PARTIAL', 'Aprobada parcialmente'];
const RECHAZADA = ['REJECTED', 'Rechazada'];
const ENVIADA = ['SUBMITTED', 'Enviada'];
const EN_REVISION = ['IN_REVIEW', 'En revisión'];

function solicitudesDe(persona, i) {
  const r = azar(20_261_005 + i * 101);
  const anual = Number(persona.plan.monthlyPremiumAmount) * 12;
  const meta = anual * persona.meta;
  const mayores = ['ALZ-SILVER', 'ALZ-MUNDI'].includes(persona.plan.planCode) || persona.meta > 1;
  const catalogo = mayores ? SERVICIOS_MAYORES : SERVICIOS_SIMPLES;
  const cuantas = 2 + Math.floor(r() * 3);
  const porSolicitud = meta / cuantas;
  const salida = [];
  for (let k = 0; k < cuantas; k++) {
    const servicio = elegir(catalogo, r);
    // Parcial: la mitad de lo facturado; el resto, todo lo facturado.
    const parcial = r() < 0.25;
    const total = parcial ? porSolicitud * 2 : porSolicitud;
    const estado = parcial ? PARCIAL : k % 2 === 0 ? PAGADA : APROBADA;
    salida.push(solicitud(persona, servicio, total, porSolicitud, estado, 40 + Math.floor(r() * 300), r));
  }
  // Una rechazada de vez en cuando y una abierta reciente: la bandeja tiene de todo.
  if (r() < 0.35) {
    const servicio = elegir(catalogo, r);
    salida.push(solicitud(persona, servicio, servicio[2] * (0.9 + r() * 0.3), 0, RECHAZADA, 20 + Math.floor(r() * 200), r));
  }
  if (r() < 0.6) {
    const servicio = elegir(SERVICIOS_SIMPLES, r);
    salida.push(solicitud(persona, servicio, servicio[2] * (0.9 + r() * 0.3), null, r() < 0.5 ? ENVIADA : EN_REVISION, 1 + Math.floor(r() * 12), r));
  }
  return salida;
}

export const SOLICITUDES = PERSONAS_DEL_VIDEO.filter((p) => p.plan !== null)
  .flatMap(solicitudesDe)
  .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

/** Lo que `grabar.mjs` siembra, por clave de `sessionStorage`. */
export const SIEMBRA = {
  'mock-insurance-administration': CATALOGO,
  'mock.insurerReceivedClaims': SOLICITUDES,
  'mock.insurance.patients': DIRECTORIO,
};
