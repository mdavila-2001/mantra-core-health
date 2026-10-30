import { formatearValor, formatearVariacion } from '../../../data-access/reporting/reporting-format';
import type { KpiSpec, TablaReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { redondear } from './reporting-dataset.util';
import { buscarKpi, infoEjemplo, ORDEN, type BaseResumen, type ClaveVertical } from './resumen.base';

/* ============================================================================
    «¿Cómo gana dinero Alovida?» — lo que necesita leer quien debe ENTENDER la
    monetización antes de mirar un solo gráfico.

    Nada de esto calcula un número nuevo: cada cifra sale de los mismos KPI de
    las pestañas de vertical (una definición, un lugar de cálculo) y cada texto
    explica una fuente de ingreso en palabras de quien no es del negocio.
    ========================================================================== */

/** Cómo se monetiza cada vertical, en palabras simples. Los supuestos de publicidad van declarados (A-2 del plan). */
const MODELO: Readonly<Record<ClaveVertical, { quienPaga: string; porQue: string; comoSeCobra: string }>> = {
  suscripciones: {
    quienPaga: 'Doctores y organizaciones de salud',
    porQue: 'Usan Alovida para atender pacientes y gestionar su consultorio.',
    comoSeCobra: 'Un plan mensual fijo (Esencial, Profesional o Clínica); más plan, más consultas incluidas.',
  },
  publicidad: {
    quienPaga: 'Anunciantes: clínicas, farmacias, laboratorios y aseguradoras',
    porQue: 'Quieren que sus avisos y notificaciones push lleguen a los pacientes indicados.',
    comoSeCobra: 'Por la entrega del aviso a un segmento (módulo en diseño: este cobro es un supuesto de la maqueta).',
  },
  comisiones: {
    quienPaga: 'Quien paga a través de Alovida; la plataforma retiene su parte',
    porQue: 'El pago pasa por Alovida, que lo procesa y reparte lo que corresponde a cada actor.',
    comoSeCobra: 'Un porcentaje de cada pago procesado (take rate); el resto se liquida a los actores.',
  },
};

function shareOfTotal(ingreso: number | null, total: number | null): number | null {
  return ingreso !== null && total !== null && total > 0 ? redondear((ingreso / total) * 100, 1) : null;
}

/** Quién paga, por qué y cómo se cobra cada fuente, con lo que aportó en el periodo. */
export function construirMapaMonetizacion(base: BaseResumen): TablaReporte {
  const dinero: UnidadValor = { tipo: 'moneda', moneda: base.ctx.moneda };
  const pct: UnidadValor = { tipo: 'porcentaje' };
  const filas = ORDEN.map((c) => {
    const l = base.lecturas[c];
    return {
      fuente: l.nombre,
      quienPaga: MODELO[c].quienPaga,
      porQue: MODELO[c].porQue,
      comoSeCobra: MODELO[c].comoSeCobra,
      ingreso: l.ingreso,
      parte: shareOfTotal(l.ingreso, base.total),
      cambio: l.variacionPct,
    };
  });
  return {
    id: 'mapa-monetizacion',
    titulo: 'Las tres fuentes de ingreso: quién paga, por qué y cuánto aporta',
    columnas: [
      { clave: 'fuente', etiqueta: 'Fuente' },
      { clave: 'quienPaga', etiqueta: 'Quién paga' },
      { clave: 'porQue', etiqueta: 'Por qué paga' },
      { clave: 'comoSeCobra', etiqueta: 'Cómo se cobra' },
      { clave: 'ingreso', etiqueta: 'Ingreso del periodo', alinear: 'der', unidad: dinero },
      { clave: 'parte', etiqueta: 'Parte del total', alinear: 'der', unidad: pct },
      { clave: 'cambio', etiqueta: 'Cambio', alinear: 'der', unidad: pct },
    ],
    filas: [
      ...filas,
      {
        fuente: 'Total',
        quienPaga: '',
        porQue: '',
        comoSeCobra: '',
        ingreso: base.total,
        parte: base.total === null ? null : 100,
        cambio: base.total !== null && base.anterior !== null && base.anterior > 0 ? redondear(((base.total - base.anterior) / base.anterior) * 100, 1) : null,
      },
    ],
    info: infoEjemplo({
      definicion: 'Las tres maneras en que Alovida gana dinero y cuánto aportó cada una en el periodo.',
      formula: 'Parte del total = ingreso de la fuente ÷ ingreso total; el total es la suma de las tres fuentes',
      fuente: 'KPI «Ingreso del periodo» de las pestañas Suscripciones, Publicidad y Comisiones.',
      salvedades: [
        'Quién paga y cómo se cobra describen el modelo en palabras; no son tarifas ni reglas de cálculo.',
        'Publicidad: el módulo todavía no está cerrado; el modelo de cobro es un supuesto de la maqueta (pregunta abierta A-2).',
        'Si falta el ingreso de una fuente no hay total ni parte: una suma parcial parecería completa.',
      ],
    }),
  };
}

function valorTexto(k: KpiSpec | undefined): string | null {
  return k === undefined || k.valor === null ? null : formatearValor(k.valor, k.unidad);
}

/** Variación escrita con su sentido: «sube 4,2 %» / «baja 1,0 %» (no un signo suelto). */
function cambioEnPalabras(pct: number | null): string | null {
  if (pct === null) {
    return null;
  }
  const abs = formatearVariacion(Math.abs(pct)).replace('+', '');
  return pct >= 0 ? `sube ${abs}` : `baja ${abs}`;
}

/**
 * Tres frases que dicen lo que muestra el número, para quien no va a leer veinte gráficos.
 * Si falta un dato la frase lo dice; no se rellena con otro.
 */
export function lecturaRapida(base: BaseResumen): string {
  const { total, anterior } = base;
  const dinero = (v: number): string => formatearValor(v, { tipo: 'moneda', moneda: base.ctx.moneda });
  if (total === null) {
    return base.motivoTotal ?? 'Falta el ingreso de alguna fuente, así que no hay un total para explicar.';
  }
  const frases: string[] = [];
  const cambio = anterior !== null && anterior > 0 ? redondear(((total - anterior) / anterior) * 100, 1) : null;
  const enPalabras = cambioEnPalabras(cambio);
  const frente = base.ctx.comparar === 'mismo-periodo-ano-anterior' ? 'frente al mismo periodo del año pasado' : 'frente al periodo anterior';
  frases.push(
    `En el periodo entraron ${dinero(total)}${enPalabras === null ? '' : ` y el ingreso ${enPalabras} ${frente}`}.`,
  );
  const ordenadas = ORDEN.map((c) => base.lecturas[c]).filter((l) => l.ingreso !== null).sort((a, b) => (b.ingreso ?? 0) - (a.ingreso ?? 0));
  const mayor = ordenadas[0];
  if (mayor !== undefined) {
    frases.push(`${mayor.nombre} es la fuente más grande: aporta ${formatearValor(shareOfTotal(mayor.ingreso, total) ?? 0, { tipo: 'porcentaje' })} del ingreso.`);
  }
  const conVariacion = ORDEN.map((c) => base.lecturas[c]).filter((l) => l.variacionPct !== null);
  const sube = [...conVariacion].sort((a, b) => (b.variacionPct ?? 0) - (a.variacionPct ?? 0))[0];
  const baja = [...conVariacion].sort((a, b) => (a.variacionPct ?? 0) - (b.variacionPct ?? 0))[0];
  if (sube !== undefined && sube.variacionPct !== null && baja !== undefined && baja.variacionPct !== null) {
    if (sube.variacionPct < 0) {
      // Si todas caen, «la que más cae» no es la que cae menos.
      frases.push(`Ninguna fuente crece; la que menos cae es ${sube.nombre} (${formatearVariacion(sube.variacionPct)}) y la que más cae, ${baja.nombre} (${formatearVariacion(baja.variacionPct)}).`);
    } else {
      frases.push(`La que más crece es ${sube.nombre} (${formatearVariacion(sube.variacionPct)})${baja.variacionPct < 0 ? ` y la que más cae, ${baja.nombre} (${formatearVariacion(baja.variacionPct)})` : ''}.`);
    }
  }
  return frases.join(' ');
}

interface FilaEconomia {
  readonly indicador: string;
  readonly valor: string | null;
  readonly responde: string;
  readonly lectura: string;
}

/** ¿Es un ingreso sano? Retención, valor de cada cuenta y retorno de la publicidad, con su lectura. */
export function construirEconomiaUnitaria(base: BaseResumen): TablaReporte {
  const susc = base.lecturas.suscripciones.pestana;
  const pub = base.lecturas.publicidad.pestana;
  const com = base.lecturas.comisiones.pestana;
  const churn = susc.kpis.find((k) => k.id.startsWith('churn'));
  const filas: FilaEconomia[] = [
    {
      indicador: 'Churn de cuentas',
      valor: valorTexto(churn),
      responde: '¿Cuántas cuentas se van? Cada una que se va es ingreso que hay que volver a conseguir.',
      lectura: 'Mientras más bajo, mejor. Si sube, mire primero qué plan pierde más cuentas en Suscripciones.',
    },
    {
      indicador: 'Ingreso por cuenta (ARPU)',
      valor: valorTexto(buscarKpi(susc, 'arpu')),
      responde: '¿Cuánto aporta cada cuenta al mes?',
      lectura: 'Si baja con más cuentas, están entrando cuentas de planes más baratos.',
    },
    {
      indicador: 'Valor de vida de la cuenta (LTV)',
      valor: valorTexto(buscarKpi(susc, 'ltv')),
      responde: '¿Cuánto deja una cuenta durante toda su vida con Alovida?',
      lectura: 'Se compara con lo que cuesta conseguir una cuenta (CAC, en Adquisición): conviene que el LTV sea varias veces el CAC.',
    },
    {
      indicador: 'Retorno de la publicidad (ROAS)',
      valor: valorTexto(pub.kpis.find((k) => k.id.includes('roas'))),
      responde: 'Por cada unidad de moneda que un anunciante gasta, ¿cuánto obtiene a cambio?',
      lectura: 'Si es bajo, es probable que el anunciante no renueve; la publicidad depende de que le funcione a él (supuesto de la maqueta).',
    },
    {
      indicador: 'Parte que se queda la plataforma (take rate)',
      valor: valorTexto(com.kpis.find((k) => k.id.includes('take'))),
      responde: 'De cada pago procesado, ¿qué parte es ingreso de Alovida?',
      lectura: 'El resto se liquida a los actores. Subirlo sin explicar el motivo puede hacer que algunos se vayan (supuesto de la maqueta).',
    },
  ];
  return {
    id: 'economia-unitaria',
    titulo: 'La salud del ingreso: ¿se queda, rinde y se sostiene?',
    columnas: [
      { clave: 'indicador', etiqueta: 'Indicador' },
      { clave: 'valor', etiqueta: 'Valor', alinear: 'der' },
      { clave: 'responde', etiqueta: 'Qué responde' },
      { clave: 'lectura', etiqueta: 'Cómo leerlo' },
    ],
    filas: filas.map((f) => ({ indicador: f.indicador, valor: f.valor, responde: f.responde, lectura: f.lectura })),
    info: infoEjemplo({
      definicion: 'Los pocos indicadores que dicen si el ingreso es sano, no solo si es grande.',
      formula: 'Cada valor es el KPI de su pestaña; aquí no se recalcula nada',
      fuente: 'KPI de las pestañas Suscripciones, Publicidad y Comisiones.',
      salvedades: ['Si un indicador no se pudo calcular sale «Sin dato»; no se reemplaza por otro.', 'El costo de conseguir una cuenta (CAC) vive en Adquisición y cuentas.'],
    }),
  };
}

interface Termino {
  readonly termino: string;
  readonly significado: string;
  readonly calculo: string;
  readonly donde: string;
}

/** Glosario en palabras simples. Donde el KPI ya declara su fórmula, se cita esa: una sola definición. */
export function construirGlosario(base: BaseResumen): TablaReporte {
  const susc = base.lecturas.suscripciones.pestana;
  const formulaOf = (id: string, respaldo: string): string => buscarKpi(susc, id)?.info?.formula ?? respaldo;
  const terminos: Termino[] = [
    { termino: 'Ingreso', significado: 'Lo que Alovida gana en el periodo, sumando sus tres fuentes.', calculo: 'Suscripciones + Publicidad + Comisiones', donde: 'Resumen ejecutivo' },
    { termino: 'MRR', significado: 'Lo que Alovida cobra cada mes, de forma recurrente, por los planes de los doctores.', calculo: formulaOf('mrr', 'Suma del precio mensual de las suscripciones activas'), donde: 'Suscripciones de doctores' },
    { termino: 'ARR', significado: 'El MRR llevado a un año: lo que se cobraría en doce meses si nada cambiara.', calculo: formulaOf('arr', 'MRR × 12'), donde: 'Suscripciones de doctores' },
    { termino: 'ARPU', significado: 'Cuánto aporta, en promedio, cada cuenta por mes.', calculo: formulaOf('arpu', 'MRR ÷ cuentas activas'), donde: 'Suscripciones de doctores' },
    { termino: 'Churn', significado: 'El porcentaje de cuentas que se va. Cuanto más alto, más ingreso se fuga.', calculo: formulaOf('churn-cuentas', 'Cuentas que se fueron ÷ cuentas al inicio'), donde: 'Suscripciones de doctores' },
    { termino: 'LTV', significado: 'Cuánto dinero deja una cuenta durante toda su vida con Alovida.', calculo: formulaOf('ltv', 'Ingreso por cuenta ÷ churn'), donde: 'Suscripciones de doctores' },
    { termino: 'CAC', significado: 'Cuánto cuesta conseguir una cuenta nueva.', calculo: 'Gasto de adquisición ÷ cuentas nuevas', donde: 'Adquisición y cuentas' },
    { termino: 'Take rate', significado: 'La parte de cada pago procesado que se queda Alovida.', calculo: buscarKpi(base.lecturas.comisiones.pestana, 'take-rate')?.info?.formula ?? 'Ingreso neto de la plataforma ÷ volumen transaccionado', donde: 'Comisiones y actores' },
    { termino: 'Comisión devengada, liquidada y pendiente', significado: 'Devengada: ya se ganó. Liquidada: ya se le pagó al actor. Pendiente: se ganó y falta pagarla.', calculo: 'Devengada = liquidada + pendiente', donde: 'Comisiones y actores' },
    { termino: 'ROAS', significado: 'Por cada unidad de moneda que un anunciante gasta, cuántas obtiene de resultado.', calculo: buscarKpi(base.lecturas.publicidad.pestana, 'roas')?.info?.formula ?? 'Resultado atribuido ÷ gasto del anunciante', donde: 'Publicidad push y pauteo' },
  ];
  return {
    id: 'glosario-monetizacion',
    titulo: 'Glosario: los términos de este tablero en palabras simples',
    columnas: [
      { clave: 'termino', etiqueta: 'Término' },
      { clave: 'significado', etiqueta: 'Qué significa' },
      { clave: 'calculo', etiqueta: 'Cómo se calcula' },
      { clave: 'donde', etiqueta: 'Dónde verlo' },
    ],
    filas: terminos.map((t) => ({ termino: t.termino, significado: t.significado, calculo: t.calculo, donde: t.donde })),
    info: infoEjemplo({
      definicion: 'Cada término del tablero explicado sin jerga y con su fórmula.',
      formula: 'Donde un KPI ya declara su fórmula, se cita la suya: la definición vive en un solo lugar',
      fuente: 'Definiciones de los KPI de cada pestaña.',
      salvedades: ['El glosario explica; no calcula.'],
    }),
  };
}
