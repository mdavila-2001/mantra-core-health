import { forbidden, notFound, type MockRouter } from '../mock-router';
import { texto } from '../mock-store';
import { catalogoAdministrable, localizarPlan, perteneceALaAseguradora } from './insurance.handlers';

/* ============================================================================
    Tablero de siniestralidad, gasto per cápita y métricas de salud de la
    aseguradora (subtarea 3.1, v4.2.14) — GET /insurance/analytics/loss-ratio.

    Igual que la API real: nada de esto se recalcula del lado del cliente, así
    que acá se arma la respuesta entera (KPIs, tendencia, medicamentos,
    especialidades, CIE-10, inmunización) ya redondeada a dos decimales, en
    bolivianos. Es una demostración declarada: doce meses base con forma
    realista, RECORTADOS al rango pedido y con los KPIs DERIVADOS de ese
    recorte — así el filtro de período cambia de verdad las cifras, como en la
    API real. Con `planId` escala por plan (los planes más chicos del catálogo
    tienen menos afiliados y menos reclamos, no la misma cifra repartida).
    ========================================================================== */

/** Doce meses de siniestros, el más antiguo primero. Bs, literal. */
const BASE_MESES: readonly { billed: number; approved: number; claims: number }[] = [
  { billed: 22000, approved: 17800, claims: 4 },
  { billed: 24500, approved: 19200, claims: 5 },
  { billed: 21000, approved: 16500, claims: 3 },
  { billed: 27800, approved: 21600, claims: 6 },
  { billed: 25200, approved: 20100, claims: 5 },
  { billed: 29900, approved: 23400, claims: 7 },
  { billed: 26400, approved: 20800, claims: 5 },
  { billed: 31200, approved: 24900, claims: 6 },
  { billed: 28700, approved: 22300, claims: 6 },
  { billed: 33500, approved: 26800, claims: 8 },
  { billed: 30100, approved: 23700, claims: 6 },
  { billed: 35000, approved: 28000, claims: 7 },
];

/** Los tres planes administrables del mock (`ANDINA-*`): a menor plan, menor cohorte. */
const FACTOR_POR_PLAN: Readonly<Record<string, number>> = {
  'ANDINA-INT': 1,
  'ANDINA-FAM': 0.55,
  'ANDINA-ORO': 0.25,
};

const BOB = { code: 'BOB', display: 'Boliviano' };

const MEDICAMENTOS = [
  { code: 'RXN-LOSARTAN-50', name: 'Losartán potásico 50 mg', peso: 22 },
  { code: 'RXN-METFORMINA-850', name: 'Metformina 850 mg', peso: 18 },
  { code: 'RXN-PARACETAMOL-500', name: 'Paracetamol 500 mg', peso: 14 },
  { code: 'RXN-AMOXICILINA-500', name: 'Amoxicilina 500 mg', peso: 11 },
  { code: 'RXN-OMEPRAZOL-20', name: 'Omeprazol 20 mg', peso: 9 },
  { code: 'RXN-ENALAPRIL-10', name: 'Enalapril 10 mg', peso: 8 },
  { code: 'RXN-ATORVASTATINA-20', name: 'Atorvastatina 20 mg', peso: 7 },
  { code: 'RXN-IBUPROFENO-400', name: 'Ibuprofeno 400 mg', peso: 5 },
  { code: 'RXN-SALBUTAMOL', name: 'Salbutamol inhalador', peso: 3 },
  { code: 'RXN-LEVOTIROXINA', name: 'Levotiroxina 50 mcg', peso: 3 },
] as const;

const ESPECIALIDADES = [
  { code: 'MED_GEN', name: 'Medicina General', peso: 38 },
  { code: 'PEDIATRIA', name: 'Pediatría', peso: 21 },
  { code: 'GINECOLOGIA', name: 'Ginecología', peso: 16 },
  { code: 'CARDIOLOGIA', name: 'Cardiología', peso: 14 },
  { code: 'TRAUMATOLOGIA', name: 'Traumatología', peso: 11 },
] as const;

const PATOLOGIAS = [
  { code: 'I10', description: 'Hipertensión esencial (primaria)', peso: 27 },
  { code: 'E11', description: 'Diabetes mellitus tipo 2', peso: 22 },
  { code: 'J00', description: 'Rinofaringitis aguda (resfriado común)', peso: 18 },
  { code: 'K29', description: 'Gastritis y duodenitis', peso: 15 },
  { code: 'N39.0', description: 'Infección de vías urinarias, sitio no especificado', peso: 11 },
  { code: 'J45', description: 'Asma', peso: 7 },
] as const;

/** Meses del período: recorta la serie base a lo que pidió el filtro. */
function mesesEnRango(startDate: string, endDate: string): number {
  const dias = Math.round(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
  );
  if (dias <= 31) return 1;
  if (dias <= 95) return 3;
  if (dias <= 185) return 6;
  return 12;
}

/** `'YYYY-MM'` de `mesesAtras` meses antes del mes actual (0 = mes actual). */
function etiquetaDeMes(mesesAtras: number): string {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - mesesAtras, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dosDecimales(valor: number): string {
  return (Math.round(valor * 100) / 100).toFixed(2);
}

/** Reparte un total según pesos relativos, con `sharePercent`/`percentage` derivado. */
function repartir<T extends { readonly peso: number }>(
  items: readonly T[],
  totalUnidades: number,
  totalMonto: number | null,
): readonly (T & { unidades: number; monto: string | null; porcentaje: string })[] {
  const sumaPesos = items.reduce((s, i) => s + i.peso, 0);
  return items.map((item) => {
    const proporcion = item.peso / sumaPesos;
    return {
      ...item,
      unidades: Math.max(1, Math.round(totalUnidades * proporcion)),
      monto: totalMonto === null ? null : dosDecimales(totalMonto * proporcion),
      porcentaje: dosDecimales(proporcion * 100),
    };
  });
}

export function registrarAnaliticaDeSeguros(router: MockRouter): void {
  router.get('/insurance/analytics/loss-ratio', (request) => {
    if (!perteneceALaAseguradora(request)) return forbidden();

    const carrier = catalogoAdministrable.todos()[0];
    if (carrier === undefined) return notFound('Aseguradora no encontrada');

    const planId = texto(request.query, 'planId');
    let factor = 1;
    if (planId !== null) {
      const match = localizarPlan(planId);
      if (match === undefined || match.carrier.id !== carrier.id) {
        return notFound('Plan no encontrado');
      }
      factor = FACTOR_POR_PLAN[match.plan.planCode] ?? 0.5;
    }

    const startDate = texto(request.query, 'startDate') ?? isoHaceUnAnio();
    const endDate = texto(request.query, 'endDate') ?? isoHoy();
    const meses = mesesEnRango(startDate, endDate);

    const ventana = BASE_MESES.slice(-meses);
    const monthlyTrends = ventana.map((mes, indice) => {
      const mesesAtras = meses - 1 - indice;
      return {
        period: etiquetaDeMes(mesesAtras),
        billedAmount: dosDecimales(mes.billed * factor),
        approvedAmount: dosDecimales(mes.approved * factor),
        claimsCount: Math.max(1, Math.round(mes.claims * factor)),
      };
    });

    const totalBilled = monthlyTrends.reduce((s, m) => s + Number(m.billedAmount), 0);
    const totalApproved = monthlyTrends.reduce((s, m) => s + Number(m.approvedAmount), 0);
    const totalCopay = totalApproved * 0.05;
    const totalDenied = Math.max(0, totalBilled - totalApproved - totalCopay);
    const totalClaimsCount = monthlyTrends.reduce((s, m) => s + m.claimsCount, 0);
    const pendingClaimsCount = Math.max(0, Math.round(totalClaimsCount * 0.15));
    const adjudicatedClaimsCount = totalClaimsCount - pendingClaimsCount;

    // Primas de lista: sólo los planes con `monthlyPremiumAmount` declarado
    // (vía la consola, `PUT .../premium`) aportan al denominador — igual que
    // la API real, así que el semáforo empieza en «Sin prima registrada»
    // hasta que alguien declara al menos una.
    const activeAffiliatesCount = Math.max(1, Math.round(47 * factor));

    // Primas devengadas ≈ Σ coberturas vigentes × prima del plan × meses —
    // mismo criterio que el servicio real (`InsuranceAnalyticsService`, T-25):
    // la prima es de LISTA por plan, así que la paga cada afiliado que está
    // en ese plan, no el plan una sola vez. Sin el factor de afiliados, tres
    // primas de unos cientos de bolivianos contra un total facturado de
    // decenas de miles daban un loss ratio de cuatro dígitos.
    const planesAdministrables = carrier.products.flatMap((producto) => producto.plans);
    const planesRelevantes =
      planId === null ? planesAdministrables : planesAdministrables.filter((p) => p.id === planId);
    const conPrima = planesRelevantes.filter((p) => p.monthlyPremiumAmount !== null);
    const coveragesWithoutPremiumCount = planesRelevantes.length - conPrima.length;
    const primaMensualPorAfiliado = conPrima.reduce((s, p) => s + Number(p.monthlyPremiumAmount), 0);
    const primaMensualTotal = primaMensualPorAfiliado * activeAffiliatesCount;
    const estimatedPremiumsTotal = dosDecimales(primaMensualTotal * meses);

    const averageMonthlyPerCapitaExpense =
      activeAffiliatesCount > 0 && meses > 0
        ? dosDecimales(totalApproved / activeAffiliatesCount / meses)
        : null;
    const averageAnnualPerCapitaExpense =
      averageMonthlyPerCapitaExpense === null
        ? null
        : dosDecimales(Number(averageMonthlyPerCapitaExpense) * 12);

    const approvalRatePercent = totalBilled > 0 ? dosDecimales((totalApproved / totalBilled) * 100) : null;
    const lossRatioPercent =
      primaMensualTotal > 0 ? dosDecimales((totalApproved / (primaMensualTotal * meses)) * 100) : null;

    const medicamentos = repartir(MEDICAMENTOS, Math.round(120 * factor), totalApproved * 0.32);
    const especialidades = repartir(ESPECIALIDADES, Math.round(90 * factor), null);
    const patologias = repartir(PATOLOGIAS, Math.round(64 * factor), null);

    const vaccinatedCount = Math.max(0, Math.round(activeAffiliatesCount * 0.784));
    const unvaccinatedCount = Math.max(0, activeAffiliatesCount - vaccinatedCount);

    return {
      carrierId: carrier.id,
      carrierLegalName: carrier.legalName,
      startDate,
      endDate,
      currency: BOB,
      kpis: {
        totalClaimsCount,
        adjudicatedClaimsCount,
        pendingClaimsCount,
        otherCurrencyClaimsCount: 0,
        totalBilledAmount: dosDecimales(totalBilled),
        totalApprovedAmount: dosDecimales(totalApproved),
        totalPatientCopayAmount: dosDecimales(totalCopay),
        totalDeniedAmount: dosDecimales(totalDenied),
        approvalRatePercent,
        activeAffiliatesCount,
        periodMonths: dosDecimales(meses),
        averageMonthlyPerCapitaExpense,
        averageAnnualPerCapitaExpense,
        estimatedPremiumsTotal,
        coveragesWithoutPremiumCount,
        lossRatioPercent,
      },
      monthlyTrends,
      topMedications: medicamentos
        .map((m) => ({
          medicationCode: m.code,
          medicationName: m.name,
          dispensationsCount: String(m.unidades),
          totalExpenseAmount: m.monto ?? '0.00',
          sharePercent: m.porcentaje,
        }))
        .sort((a, b) => Number(b.totalExpenseAmount) - Number(a.totalExpenseAmount))
        .slice(0, 10),
      specialties: especialidades.map((e) => ({
        specialtyCode: e.code,
        specialtyName: e.name,
        consultationsCount: e.unidades,
        totalExpenseAmount: null,
      })),
      prevalentPathologies: patologias.map((p) => ({
        code: p.code,
        description: p.description,
        casesCount: p.unidades,
        percentage: p.porcentaje,
      })),
      immunization: {
        vaccinatedCount,
        unvaccinatedCount,
        vaccinationRatePercent:
          activeAffiliatesCount > 0 ? dosDecimales((vaccinatedCount / activeAffiliatesCount) * 100) : null,
      },
    };
  });
}

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoHaceUnAnio(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
