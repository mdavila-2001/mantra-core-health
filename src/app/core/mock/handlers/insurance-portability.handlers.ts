import type {
  PortabilityExportFormat,
  PortabilityExportInput,
} from '../../data-access/insurance/insurance-portability.types';
import { PACIENTE } from '../fixtures/personas';
import { forbidden, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { sha256Hex } from '../sha256';
import { pdfMinimo } from './files.handlers';
import { nombreDeAseguradora, reclamosDePaciente } from './insurance.handlers';
import { perfilPropioDe } from './profiles.handlers';

/* ============================================================================
    Portabilidad de póliza e historial de siniestralidad a 1 clic (subtarea
    3.3): POST /insurance/portability/export arma un certificado —pólizas,
    reclamos, diagnósticos, resumen actuarial—, lo sella con SHA-256 REAL
    (`sha256Hex`, no una cadena con forma de hash) y lo guarda; las descargas
    y la verificación pública leen ese mismo certificado guardado, así que el
    hash impreso siempre es el que corresponde a los bytes servidos.

    Los 3 reclamos reales de PACIENTE (`reclamosDePaciente`) sólo suman
    Bs 1 250 cubiertos: se completan acá con 11 reclamos históricos del «Plan
    anterior» 2025 —sólo dentro de ESTE informe, sin tocar `insurance-claims`—
    para llegar a los 14 reclamos / Bs 12 450 que pide la demostración.
    ========================================================================== */

interface ReclamoHistorico {
  readonly claimIdentifier: string;
  readonly billed: number;
  readonly diasAtras: number;
}

/** Suman exactamente Bs 11 200 — con los 3 reclamos reales (Bs 1 250 cubiertos) da Bs 12 450. */
const RECLAMOS_HISTORICOS: readonly ReclamoHistorico[] = [
  { claimIdentifier: 'CLM-2025-0301', billed: 900, diasAtras: 620 },
  { claimIdentifier: 'CLM-2025-0308', billed: 950, diasAtras: 590 },
  { claimIdentifier: 'CLM-2025-0315', billed: 1000, diasAtras: 560 },
  { claimIdentifier: 'CLM-2025-0322', billed: 1050, diasAtras: 530 },
  { claimIdentifier: 'CLM-2025-0329', billed: 1100, diasAtras: 500 },
  { claimIdentifier: 'CLM-2025-0336', billed: 1000, diasAtras: 470 },
  { claimIdentifier: 'CLM-2025-0343', billed: 950, diasAtras: 440 },
  { claimIdentifier: 'CLM-2025-0350', billed: 900, diasAtras: 410 },
  { claimIdentifier: 'CLM-2025-0357', billed: 1100, diasAtras: 380 },
  { claimIdentifier: 'CLM-2025-0364', billed: 1050, diasAtras: 350 },
  { claimIdentifier: 'CLM-2025-0371', billed: 1200, diasAtras: 320 },
] as const;

const DIAGNOSTICOS = [
  {
    code: 'I10',
    codeSystem: 'ICD-10-CM',
    display: 'Hipertensión esencial (primaria)',
    clinicalStatus: 'ACTIVE',
    onsetAt: iso(-400),
  },
  {
    code: 'E11',
    codeSystem: 'ICD-10-CM',
    display: 'Diabetes mellitus tipo 2',
    clinicalStatus: 'ACTIVE',
    onsetAt: iso(-620),
  },
] as const;

interface ReclamoDelInforme {
  readonly claimIdentifier: string;
  readonly carrierName: string;
  readonly submittedAt: string;
  readonly billedAmount: string;
  readonly approvedAmount: string | null;
  readonly status: string;
}

function dosDecimales(valor: number): string {
  return (Math.round(valor * 100) / 100).toFixed(2);
}

function reclamosDelInforme(patientProfileId: string): readonly ReclamoDelInforme[] {
  const reales = reclamosDePaciente(patientProfileId).map(
    (s): ReclamoDelInforme => ({
      claimIdentifier: s.claimIdentifier,
      carrierName: nombreDeAseguradora(s.carrierIndex),
      submittedAt: s.submittedAt,
      billedAmount: s.billed,
      approvedAmount: s.approved,
      status: s.status.code,
    }),
  );
  const historicos = RECLAMOS_HISTORICOS.map(
    (h): ReclamoDelInforme => ({
      claimIdentifier: h.claimIdentifier,
      carrierName: 'Plan anterior',
      submittedAt: iso(-h.diasAtras, 10),
      billedAmount: dosDecimales(h.billed),
      approvedAmount: dosDecimales(h.billed),
      status: 'PAID',
    }),
  );
  return [...reales, ...historicos].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

function periodo(reclamos: readonly ReclamoDelInforme[]) {
  const billedAmount = reclamos.reduce((s, r) => s + Number(r.billedAmount), 0);
  const coveredAmount = reclamos.reduce((s, r) => s + Number(r.approvedAmount ?? 0), 0);
  const approvedCount = reclamos.filter((r) => r.approvedAmount !== null).length;
  const pendingCount = reclamos.length - approvedCount;
  const fechas = reclamos.map((r) => r.submittedAt).sort();
  return {
    claimsCount: reclamos.length,
    approvedCount,
    deniedCount: 0,
    pendingCount,
    billedAmount: dosDecimales(billedAmount),
    coveredAmount: dosDecimales(coveredAmount),
    patientCopayAmount: dosDecimales(billedAmount - coveredAmount),
    deniedAmount: '0.00',
    firstClaimAt: fechas[0],
    lastClaimAt: fechas.at(-1),
    // Meses entre el primer reclamo del período y hoy — derivado, no inventado.
    coveredMonths:
      fechas[0] === undefined
        ? '0.00'
        : dosDecimales((Date.now() - Date.parse(fechas[0])) / (1000 * 60 * 60 * 24 * 30.44)),
  };
}

function porAnio(reclamos: readonly ReclamoDelInforme[]) {
  const anios = new Map<number, { claimsCount: number; billed: number; covered: number }>();
  for (const r of reclamos) {
    const anio = new Date(r.submittedAt).getUTCFullYear();
    const acumulado = anios.get(anio) ?? { claimsCount: 0, billed: 0, covered: 0 };
    acumulado.claimsCount += 1;
    acumulado.billed += Number(r.billedAmount);
    acumulado.covered += Number(r.approvedAmount ?? 0);
    anios.set(anio, acumulado);
  }
  return [...anios.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, a]) => ({
      year,
      claimsCount: a.claimsCount,
      billedAmount: dosDecimales(a.billed),
      coveredAmount: dosDecimales(a.covered),
    }));
}

function armarInforme(patientProfileId: string, certificateId: string, generatedAt: string) {
  const perfil = perfilPropioDe(PACIENTE);
  const reclamos = reclamosDelInforme(patientProfileId);
  const hace36Meses = new Date(Date.now() - 36 * 30.44 * 24 * 60 * 60 * 1000).toISOString();
  const ultimos36 = reclamos.filter((r) => r.submittedAt >= hace36Meses);

  return {
    schemaVersion: 1,
    certificateId,
    generatedAt,
    issuer: 'AloVida',
    patient: {
      fullName: perfil.displayName,
      nationalId: perfil.nationalId,
      birthDate: perfil.birthDate,
    },
    policies: perfil.coverages.map((c) => ({
      coverageId: c.id,
      carrierName: c.carrierName,
      planName: c.planName,
      policyIdentifier: c.policyIdentifier ?? null,
      memberIdentifier: c.memberIdentifier ?? null,
      status: c.status,
      verified: c.verified,
      currencyCode: c.currencyCode ?? null,
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
    })),
    claims: reclamos,
    conditions: DIAGNOSTICOS,
    summary: {
      currencyCode: 'BOB',
      allTime: periodo(reclamos),
      last36Months: periodo(ultimos36),
      byYear: porAnio(reclamos),
      claimsOver2000Count: reclamos.filter((r) => Number(r.billedAmount) > 2000).length,
      // Sin prima de lista enganchada en la maqueta: `null`, nunca inventada.
      estimatedLossRatioPercent: null,
    },
  };
}

interface CertificadoSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly manifestHash: string;
  readonly generatedAt: string;
  readonly format: PortabilityExportFormat;
  readonly recordCount: number;
  readonly policiesCount: number;
  readonly canonicalJson: string;
}

/**
 * Certificado de demostración: la página pública de verificación tiene qué
 * mostrar tras un F5 sin haber exportado antes.
 *
 * El id sale de `uuid()` con semilla, no de `nuevoId()` —que lleva `Date.now()`
 * adentro—, así que es el mismo en cada arranque. El **hash** no lo es entre un
 * día y otro, y no puede serlo: los reclamos del fixture se fechan en relación
 * a hoy (`iso(-N)`), igual que todo el resto de la maqueta. Dentro de una
 * sesión es estable, que es lo que la verificación por QR necesita.
 */
function certificadoDeDemostracion(): CertificadoSimulado {
  const id = uuid('portability-demo-certificate');
  const generatedAt = iso(-1, 12);
  const informe = armarInforme(PACIENTE.id, id, generatedAt);
  const canonicalJson = JSON.stringify(informe);
  return {
    id,
    patientProfileId: PACIENTE.id,
    manifestHash: sha256Hex(canonicalJson),
    generatedAt,
    format: 'BUNDLE',
    recordCount: informe.claims.length,
    policiesCount: informe.policies.length,
    canonicalJson,
  };
}

const certificados = new Coleccion<CertificadoSimulado>(
  [certificadoDeDemostracion()],
  'portability-certificates',
);

function esTitularOPlataforma(request: MockRequest, patientProfileId: string): boolean {
  const user = request.user;
  if (user === null) return false;
  if (user.patientProfileId === patientProfileId) return true;
  return user.roles.includes('SUPERADMIN') || user.roles.includes('SECURITY_ADMIN');
}

export function registrarPortabilidadDeSeguros(router: MockRouter): void {
  router.post('/insurance/portability/export', (request) => {
    const datos = cuerpo<PortabilityExportInput>(request);
    const patientProfileId = datos.patientProfileId;
    if (patientProfileId === undefined) {
      return forbidden('Falta el perfil de paciente a exportar.');
    }
    if (!esTitularOPlataforma(request, patientProfileId)) {
      return forbidden('No podés exportar el historial de otra persona.');
    }

    const format: PortabilityExportFormat = datos.format ?? 'BUNDLE';
    const id = nuevoId('portability-certificate');
    const generatedAt = ahora();
    const informe = armarInforme(patientProfileId, id, generatedAt);
    const canonicalJson = JSON.stringify(informe);
    const manifestHash = sha256Hex(canonicalJson);

    const certificado = certificados.agregar({
      id,
      patientProfileId,
      manifestHash,
      generatedAt,
      format,
      recordCount: informe.claims.length,
      policiesCount: informe.policies.length,
      canonicalJson,
    });

    return {
      certificateId: certificado.id,
      manifestHash: certificado.manifestHash,
      generatedAt: certificado.generatedAt,
      format: certificado.format,
      recordCount: certificado.recordCount,
      policiesCount: certificado.policiesCount,
      pdfDownloadUrl: `/insurance/portability/certificates/${certificado.id}/pdf`,
      jsonDownloadUrl: `/insurance/portability/certificates/${certificado.id}/json`,
      verificationUrl: `/verify/portability/${certificado.manifestHash}`,
      summary: informe.summary,
    };
  });

  router.get('/insurance/portability/certificates/:certificateId/pdf', (request) => {
    const certificado = certificados.get(request.params['certificateId']!);
    if (certificado === undefined) return notFound('Certificado no encontrado');
    if (!esTitularOPlataforma(request, certificado.patientProfileId)) return forbidden();

    return {
      status: 200,
      body: new Blob(
        [pdfMinimo(`Certificado de portabilidad ${certificado.id} - sello ${certificado.manifestHash}`)],
        { type: 'application/pdf' },
      ),
      headers: {
        'Content-Disposition': `attachment; filename*=UTF-8''portabilidad-${certificado.id}.pdf`,
        'Cache-Control': 'private, no-store',
      },
    };
  });

  router.get('/insurance/portability/certificates/:certificateId/json', (request) => {
    const certificado = certificados.get(request.params['certificateId']!);
    if (certificado === undefined) return notFound('Certificado no encontrado');
    if (!esTitularOPlataforma(request, certificado.patientProfileId)) return forbidden();

    return {
      status: 200,
      body: new Blob([certificado.canonicalJson], { type: 'application/json' }),
      headers: {
        'Content-Disposition': `attachment; filename*=UTF-8''portabilidad-${certificado.id}.json`,
        'Cache-Control': 'private, no-store',
      },
    };
  });

  // Pública: sin sesión, sin PHI — sólo confirma que el sello existe.
  router.get('/public/portability/verify/:manifestHash', ({ params }) => {
    const hash = params['manifestHash']!;
    const certificado = certificados.todos().find((c) => c.manifestHash === hash);
    if (certificado === undefined) return notFound('Certificado no encontrado');

    return {
      status: 'VALID',
      certificateId: certificado.id,
      manifestHash: certificado.manifestHash,
      generatedAt: certificado.generatedAt,
      recordCount: certificado.recordCount,
      algorithm: 'SHA-256',
      issuer: 'AloVida',
    };
  });
}
