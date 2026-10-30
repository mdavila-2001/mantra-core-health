import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { KpiSpec, PestanaReporte, TablaReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { redondear } from './reporting-dataset.util';
import { buscarKpi, infoEjemplo, type BaseResumen } from './resumen.base';

/* La severidad va escrita: el color solo no se lee con daltonismo ni en blanco y negro. */
type Severidad = 'Crítica' | 'Atención' | 'Normal' | 'Sin evaluar';
const PESO: Readonly<Record<Severidad, number>> = { Crítica: 0, Atención: 1, 'Sin evaluar': 2, Normal: 3 };

interface Regla {
  readonly indicador: string;
  readonly valor: number | null;
  readonly unidad: UnidadValor;
  readonly atencion: number;
  readonly critico: number;
  /** `alto`: es malo que suba; `bajo`: es malo que baje. */
  readonly malo: 'alto' | 'bajo';
  readonly umbral: string;
  readonly sinDato: string;
  readonly accion: string;
}

function severidad(r: Regla): Severidad {
  if (r.valor === null) return 'Sin evaluar';
  const peor = r.malo === 'alto' ? (u: number) => r.valor! >= u : (u: number) => r.valor! <= u;
  return peor(r.critico) ? 'Crítica' : peor(r.atencion) ? 'Atención' : 'Normal';
}

function churnKpi(p: PestanaReporte): KpiSpec | undefined {
  return buscarKpi(p, 'churn-cuentas', 'churn', 'churn-ingresos') ?? p.kpis.find((k) => k.id.startsWith('churn'));
}

function reconciliationKpi(p: PestanaReporte): KpiSpec | undefined {
  return p.kpis.find((k) => k.id.includes('concilia'));
}

function pctOf(k: KpiSpec | undefined): number | null {
  return k !== undefined && k.valor !== null && k.unidad.tipo === 'porcentaje' ? k.valor : null;
}

export function construirAlertas(base: BaseResumen, concentracionPct: number | null): TablaReporte {
  const pct: UnidadValor = { tipo: 'porcentaje' };
  const { total, anterior } = base;
  const pendiente = buscarKpi(base.lecturas.comisiones.pestana, 'comision-pendiente');
  const pesoPendiente =
    total !== null && total > 0 && pendiente?.valor != null && pendiente.unidad.tipo === 'moneda' && pendiente.unidad.moneda === base.ctx.moneda
      ? redondear((pendiente.valor / total) * 100, 1)
      : null;
  const cambio = total !== null && anterior !== null && anterior > 0 ? redondear(((total - anterior) / anterior) * 100, 1) : null;

  const reglas: Regla[] = [
    { indicador: 'Bajas de suscriptores (churn)', valor: pctOf(churnKpi(base.lecturas.suscripciones.pestana)), unidad: pct, atencion: 5, critico: 8, malo: 'alto', umbral: 'Atención desde 5 %, crítica desde 8 %', sinDato: 'La pestaña de Suscripciones no entregó el churn.', accion: 'Revisar los planes con más bajas en Suscripciones.' },
    { indicador: 'Comisión pendiente sobre el ingreso total', valor: pesoPendiente, unidad: pct, atencion: 25, critico: 40, malo: 'alto', umbral: 'Atención desde 25 %, crítica desde 40 %', sinDato: 'Falta la comisión pendiente o el ingreso total.', accion: 'Revisar el aging de lo pendiente en Comisiones.' },
    { indicador: 'Conciliación con el gateway', valor: pctOf(reconciliationKpi(base.lecturas.comisiones.pestana)), unidad: pct, atencion: 98, critico: 95, malo: 'bajo', umbral: 'Atención bajo 98 %, crítica bajo 95 %', sinDato: 'La pestaña de Comisiones no entregó un indicador de conciliación.', accion: 'Revisar los descuadres abiertos en Comisiones.' },
    { indicador: 'Concentración en los 10 mayores', valor: concentracionPct, unidad: pct, atencion: 40, critico: 55, malo: 'alto', umbral: 'Atención desde 40 %, crítica desde 55 %', sinDato: 'Falta el ingreso total.', accion: 'Revisar la dependencia de los mayores clientes.' },
    { indicador: 'Cambio del ingreso total', valor: cambio, unidad: pct, atencion: -5, critico: -15, malo: 'bajo', umbral: 'Atención bajo −5 %, crítica bajo −15 %', sinDato: base.ctx.comparar === 'ninguna' ? 'Elija comparar con otro periodo.' : 'Falta el comparativo.', accion: 'Ver qué vertical lo explica en la cascada.' },
  ];

  const filas = reglas
    .map((r) => ({ r, s: severidad(r) }))
    .sort((a, b) => PESO[a.s] - PESO[b.s])
    .map(({ r, s }) => ({
      severidad: s,
      indicador: r.indicador,
      valor: r.valor === null ? null : formatearValor(r.valor, r.unidad),
      umbral: r.umbral,
      lectura: r.valor === null ? `Sin dato. ${r.sinDato}` : s === 'Normal' ? 'Dentro del umbral.' : r.accion,
    }));

  return {
    id: 'alertas',
    titulo: 'Alertas: indicadores fuera de umbral',
    columnas: [
      { clave: 'severidad', etiqueta: 'Severidad' },
      { clave: 'indicador', etiqueta: 'Indicador' },
      { clave: 'valor', etiqueta: 'Valor', alinear: 'der' },
      { clave: 'umbral', etiqueta: 'Umbral' },
      { clave: 'lectura', etiqueta: 'Qué mirar' },
    ],
    filas,
    info: infoEjemplo({
      definicion: 'Indicadores del negocio que cruzaron un umbral, de la más grave a la menos grave.',
      formula: 'Cada indicador se compara con un umbral de atención y otro crítico',
      fuente: 'KPI de las pestañas Suscripciones y Comisiones y del propio Resumen; umbrales en report_schedules (por crear).',
      salvedades: [
        'Los umbrales son de EJEMPLO: aún no hay un lugar donde Alovida los registre.',
        '«Sin evaluar» significa que falta el dato; no es lo mismo que «Normal».',
      ],
    }),
  };
}
