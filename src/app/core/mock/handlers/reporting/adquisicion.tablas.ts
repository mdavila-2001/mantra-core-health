import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ContextoReporte, TablaReporte } from '../../../data-access/reporting/reporting.types';
import { PLANES } from './adquisicion.cuentas';
import { infoCalculo, monedaDe } from './adquisicion.graficos';
import type { ModeloAdquisicion } from './adquisicion.modelo';
import { convertir, redondear } from './reporting-dataset.util';

/* ============================================================================
    Tablas de detalle. Los importes van ya formateados con su moneda porque
    `TablaReporte` no declara unidad por columna; `null` queda `null` (la
    pantalla lo dice «Sin dato») y nunca se vuelve 0.
    ========================================================================== */

export function tablaCampanas(ctx: ContextoReporte, m: ModeloAdquisicion): TablaReporte {
  const u = monedaDe(ctx);
  const dinero = (bob: number | null): string | null =>
    bob === null || m.inversionBob === null ? null : formatearValor(redondear(convertir(bob, ctx.moneda)), u);
  return {
    id: 'adq-tabla-campanas',
    titulo: 'Campañas de marketing',
    columnas: [
      { clave: 'campana', etiqueta: 'Campaña' },
      { clave: 'canal', etiqueta: 'Canal' },
      { clave: 'inversion', etiqueta: `Inversión (${ctx.moneda})`, alinear: 'der' },
      { clave: 'leads', etiqueta: 'Leads', alinear: 'der' },
      { clave: 'registros', etiqueta: 'Registros', alinear: 'der' },
      { clave: 'clientes', etiqueta: 'Clientes nuevos', alinear: 'der' },
      { clave: 'cac', etiqueta: `CAC (${ctx.moneda})`, alinear: 'der' },
    ],
    filas: m.campanas.map((c) => ({
      campana: c.def.nombre,
      canal: c.def.canal,
      inversion: dinero(c.inversionBob),
      leads: c.leads,
      registros: c.registros,
      clientes: c.pagantes,
      cac: c.inversionBob === null || c.pagantes === 0 ? null : dinero(c.inversionBob / c.pagantes),
    })),
    info: infoCalculo(
      {
        definicion: 'Rendimiento de cada campaña: lo que se invirtió, lo que trajo y cuánto costó cada cliente nuevo.',
        formula: 'CAC = inversión de la campaña ÷ clientes pagantes nuevos de la campaña.',
        fuente: 'marketing.marketing_campaigns · marketing.attribution_touches',
      },
      ['Las campañas sin inversión atribuible (contenido y buscadores) muestran «Sin dato» en inversión y CAC.'],
    ),
  };
}

interface CuentaRiesgo {
  readonly cuenta: string;
  readonly plan: (typeof PLANES)[number];
  readonly nivel: 'Alto' | 'Crítico';
  readonly diasSinUso: number;
  readonly deudaBob: number;
  /** `null` = el contador de tickets no está integrado para esta cuenta. */
  readonly tickets: number | null;
}

// Nombres comerciales INVENTADOS; ninguna es una organización real.
const CUENTAS_EN_RIESGO: readonly CuentaRiesgo[] = [
  { cuenta: 'Clínica Mirador Andino', plan: 'Clínica', nivel: 'Crítico', diasSinUso: 74, deudaBob: 3480, tickets: 3 },
  { cuenta: 'Centro Integral Ceibo', plan: 'Premium', nivel: 'Crítico', diasSinUso: 66, deudaBob: 1740, tickets: 2 },
  { cuenta: 'Policlínico Cerro Alto', plan: 'Profesional', nivel: 'Crítico', diasSinUso: 58, deudaBob: 870, tickets: null },
  { cuenta: 'Consultorio Sol Naciente', plan: 'Inicial', nivel: 'Alto', diasSinUso: 52, deudaBob: 580, tickets: 1 },
  { cuenta: 'Clínica Lago Dorado', plan: 'Clínica', nivel: 'Alto', diasSinUso: 47, deudaBob: 0, tickets: 4 },
  { cuenta: 'Centro Médico Tres Puentes', plan: 'Profesional', nivel: 'Alto', diasSinUso: 44, deudaBob: 290, tickets: 0 },
  { cuenta: 'Consultorio Aurora del Valle', plan: 'Inicial', nivel: 'Alto', diasSinUso: 39, deudaBob: 290, tickets: 1 },
  { cuenta: 'Policlínico Brisa Norte', plan: 'Premium', nivel: 'Alto', diasSinUso: 35, deudaBob: 0, tickets: 2 },
  { cuenta: 'Consultorio Luna Nueva', plan: 'Inicial', nivel: 'Alto', diasSinUso: 33, deudaBob: 145, tickets: 0 },
  { cuenta: 'Centro Salud Integral Alerce', plan: 'Profesional', nivel: 'Alto', diasSinUso: 31, deudaBob: 0, tickets: 1 },
];

export function tablaCuentasEnRiesgo(ctx: ContextoReporte): TablaReporte {
  const u = monedaDe(ctx);
  // Un clic en el mapa de salud filtra por plan; un valor que no es un plan no filtra nada.
  const plan = ctx.filtros.find((f) => f.dimension === 'plan')?.valor;
  const filas = CUENTAS_EN_RIESGO.filter((c) => plan === undefined || !(PLANES as readonly string[]).includes(plan) || c.plan === plan);
  return {
    id: 'adq-tabla-cuentas-riesgo',
    titulo: 'Cuentas en riesgo (sin uso en 30 días)',
    columnas: [
      { clave: 'cuenta', etiqueta: 'Cuenta' },
      { clave: 'plan', etiqueta: 'Plan' },
      { clave: 'nivel', etiqueta: 'Riesgo' },
      { clave: 'diasSinUso', etiqueta: 'Días sin uso', alinear: 'der' },
      { clave: 'deuda', etiqueta: `Deuda vencida (${ctx.moneda})`, alinear: 'der' },
      { clave: 'tickets', etiqueta: 'Tickets abiertos', alinear: 'der' },
    ],
    filas: filas.map((c) => ({
      cuenta: c.cuenta,
      plan: c.plan,
      nivel: c.nivel,
      diasSinUso: c.diasSinUso,
      deuda: formatearValor(redondear(convertir(c.deudaBob, ctx.moneda)), u),
      tickets: c.tickets,
    })),
    info: infoCalculo(
      {
        definicion: 'Cuentas activas que llevan más de 30 días sin usar la plataforma, de mayor a menor inactividad.',
        formula: 'Días desde el último uso > 30; el riesgo sube con la deuda vencida y los tickets abiertos.',
        fuente: 'subscription_usage_counters · payment_debts · feedback_tickets',
      },
      ['Los nombres son comerciales y de EJEMPLO.', '«Sin dato» en tickets: el contador de tickets de esa cuenta no está integrado.'],
    ),
  };
}
