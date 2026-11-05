import type {
  ContextoReporte,
  InfoCalculo,
  KpiSpec,
  PestanaReporte,
  VerticalReporte,
} from '@core/data-access/reporting/reporting.types';

/* Montaje de prueba del asistente: depende SOLO del contrato (`PestanaReporte`),
   no de los datos de ejemplo que escriben las pestañas. Solo lo importan specs. */

export const CONTEXTO_BASE: ContextoReporte = {
  periodo: '30d',
  comparar: 'periodo-anterior',
  moneda: 'BOB',
  alcance: 'plataforma',
  filtros: [],
};

export const info = (definicion: string): InfoCalculo => ({
  definicion,
  formula: 'f',
  fuente: 'fuente de ejemplo',
  frescura: 'cada hora',
});

export const kpi = (
  id: string,
  titulo: string,
  definicion: string,
  extra: Partial<KpiSpec> = {},
): KpiSpec => ({
  id,
  titulo,
  valor: 10,
  unidad: { tipo: 'numero' },
  variacionPct: null,
  info: info(definicion),
  ...extra,
});

export const pestana = (nombre: VerticalReporte, kpis: KpiSpec[]): PestanaReporte => ({
  pestana: nombre,
  generadoEn: '2026-10-30T09:00:00-04:00',
  origen: 'ejemplo',
  kpis,
  graficos: [],
  tablas: [],
});

export const PESTANAS: PestanaReporte[] = [
  pestana('resumen', [
    // Repite lo que ya vive en «suscripciones»: no debe competir con él.
    kpi('mrr', 'MRR', 'Ingreso recurrente mensual de las suscripciones activas.'),
    kpi('ingresos-totales', 'Ingresos totales', 'Suma de lo facturado en el periodo por todas las verticales.'),
  ]),
  pestana('suscripciones', [
    kpi('mrr', 'Ingreso recurrente mensual (MRR)', 'Ingreso recurrente mensual de las suscripciones activas.'),
    kpi('activos', 'Doctores suscritos activos', 'Doctores con una suscripción vigente al cierre del periodo.'),
    kpi('churn', 'Tasa de cancelación (churn)', 'Suscripciones que se dieron de baja sobre las activas al inicio.'),
    kpi('arpu', 'Ingreso medio por doctor (ARPU)', 'MRR dividido entre los doctores suscritos.'),
  ]),
  pestana('publicidad', [
    kpi('gasto', 'Gasto publicitario', 'Lo invertido en campañas de publicidad push y pauteo.'),
    kpi('roas', 'ROAS', 'Ingresos atribuidos a la campaña por cada boliviano invertido.'),
    kpi('ctr', 'CTR', 'Clics sobre impresiones de los anuncios.'),
    kpi('cpm', 'CPM', 'Costo por mil impresiones.'),
    kpi('conv', 'Tasa de conversión', 'Clics del anuncio que terminaron en una compra.'),
  ]),
  pestana('comisiones', [
    kpi('take', 'Comisión de plataforma (take rate)', 'Porcentaje del cobro que retiene la plataforma.'),
    kpi('pendiente', 'Pendiente de pago a actores', 'Comisiones devengadas que aún no se pagaron.'),
    kpi('pagado', 'Pagado a actores', 'Comisiones liquidadas en el periodo.'),
  ]),
  pestana('cobros', [
    kpi('cobrado', 'Cobros del periodo', 'Importe cobrado en el periodo.'),
    kpi('mora', 'Cartera vencida (mora)', 'Saldo con más de 30 días de atraso sobre el total por cobrar.'),
  ]),
  pestana('adquisicion', [
    kpi('registros', 'Registros nuevos', 'Cuentas creadas en el periodo.'),
    kpi('cac', 'Costo de adquisición (CAC)', 'Gasto de adquisición dividido entre las altas.'),
    kpi('conv', 'Tasa de conversión', 'Visitas que terminaron en un registro.'),
  ]),
  pestana('calidad', [
    kpi('completitud', 'Completitud de datos', 'Campos obligatorios completos sobre el total de registros.'),
  ]),
];

