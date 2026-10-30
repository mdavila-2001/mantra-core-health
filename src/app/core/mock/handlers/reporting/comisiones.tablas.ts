import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ContextoReporte, TablaReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { FUENTE_COMISIONES, FUENTE_PAYOUTS, info } from './comisiones.info';
import { type FilaActor, type ModeloComisiones, porcentaje } from './comisiones.modelo';
import { dateLabel, hashTexto, rng } from './reporting-dataset.util';

/* Los importes viajan ya formateados con su moneda (`formatearValor`): una tabla de
   dinero sin moneda es la clase de error que esta pestaña existe para impedir.
   Un valor sin dato es `null`, nunca «0». */

const MAX_FILAS_FALLIDOS = 10;
const MOTIVOS = [
  'Cuenta bancaria del beneficiario sin verificar',
  'Cuenta cambiada hace poco: en periodo de enfriamiento',
  'El banco receptor rechazó la transferencia',
  'Los datos del beneficiario no coinciden con la cuenta',
  'Disputa abierta sobre el cobro de origen',
];

function dinero(centimos: number | null, unidad: UnidadValor): string | null {
  return centimos === null ? null : formatearValor(centimos / 100, unidad);
}

/** Ingreso neto atribuible al canal del actor ÷ el volumen que trajo. `null` si su comisión no existe. */
function takeDelActor(f: FilaActor, m: ModeloComisiones): number | null {
  if (f.devengadaC === null) {
    return null;
  }
  const volumenFilas = m.filas.reduce((acum, x) => acum + x.volumenC, 0) || 1;
  // Fees y gateway del canal = su proporción del volumen; la comisión es la suya.
  const fees = Math.round((m.alcance.feesC * f.volumenC) / volumenFilas);
  const gateway = Math.round((m.alcance.gatewayC * f.volumenC) / volumenFilas);
  return porcentaje(fees - gateway - (f.actor.interno ? 0 : f.devengadaC), f.volumenC);
}

export function tablaRanking(ctx: ContextoReporte, m: ModeloComisiones): TablaReporte {
  const unidad: UnidadValor = { tipo: 'moneda', moneda: ctx.moneda };
  const orden = [...m.filas].sort((a, b) => (b.devengadaC ?? -1) - (a.devengadaC ?? -1));
  return {
    id: 'ranking-actores',
    titulo: 'Ranking de actores por comisión devengada',
    columnas: [
      { clave: 'actor', etiqueta: 'Actor' },
      { clave: 'devengada', etiqueta: 'Devengada', alinear: 'der' },
      { clave: 'liquidada', etiqueta: 'Liquidada', alinear: 'der' },
      { clave: 'pendiente', etiqueta: 'Pendiente', alinear: 'der' },
      { clave: 'take', etiqueta: 'Take rate del canal', alinear: 'der' },
      { clave: 'esquema', etiqueta: 'Esquema de comisión' },
    ],
    filas: orden.map((f) => {
      const take = takeDelActor(f, m);
      return {
        actor: f.actor.nombre,
        devengada: dinero(f.devengadaC, unidad),
        liquidada: dinero(f.liquidadaC, unidad),
        pendiente: dinero(f.pendienteC, unidad),
        take: take === null ? null : formatearValor(take, { tipo: 'porcentaje' }),
        esquema:
          f.devengadaC === null ? 'Sin definir (decisión de negocio pendiente)' : f.actor.interno ? 'Retenido al cobrar' : 'Definido (EJEMPLO)',
      };
    }),
    info: info({
      definicion: 'Cada actor con lo que devenga, lo que ya se le pagó y lo que se le debe, más cuánto deja su canal a la plataforma.',
      formula: 'take del canal = (fees − gateway − comisión del actor) ÷ volumen que trajo el actor',
      fuente: FUENTE_COMISIONES,
      salvedades: ['La Plataforma retiene su parte al cobrar, por eso no resta comisión en su take.'],
    }),
  };
}

export function tablaPayoutsFallidos(ctx: ContextoReporte, m: ModeloComisiones): TablaReporte {
  const unidad: UnidadValor = { tipo: 'moneda', moneda: ctx.moneda };
  const total = m.alcance.payouts?.fallidos ?? 0;
  const pagables = (m.seleccion === null ? m.filas : [m.seleccion]).filter((f) => !f.actor.interno && f.pendienteC !== null);
  const filas =
    m.alcance.payouts === null || pagables.length === 0
      ? []
      : Array.from({ length: Math.min(total, MAX_FILAS_FALLIDOS) }, (_, i) => {
          const r = rng(hashTexto(`comisiones:fallido:${ctx.periodo}:${i}`));
          const f = pagables[Math.floor(r() * pagables.length)]!;
          // Cada pago fallido es una fracción chica de lo pendiente de ese actor: nunca lo supera.
          const centimos = Math.floor((f.pendienteC ?? 0) * (0.02 + r() * 0.04));
          return {
            payout: `PO-${String(i + 1).padStart(4, '0')}`,
            actor: f.actor.nombre,
            fecha: dateLabel(Math.floor(r() * Math.min(m.dias, 30))),
            monto: dinero(centimos, unidad),
            motivo: MOTIVOS[Math.floor(r() * MOTIVOS.length)]!,
            intentos: 1 + Math.floor(r() * 3),
          };
        });
  return {
    id: 'payouts-fallidos',
    titulo: 'Payouts fallidos y su motivo',
    columnas: [
      { clave: 'payout', etiqueta: 'Payout' },
      { clave: 'actor', etiqueta: 'Actor' },
      { clave: 'fecha', etiqueta: 'Fecha' },
      { clave: 'monto', etiqueta: 'Importe', alinear: 'der' },
      { clave: 'motivo', etiqueta: 'Motivo' },
      { clave: 'intentos', etiqueta: 'Intentos', alinear: 'der' },
    ],
    filas,
    info: info({
      definicion: 'Pagos a actores que fallaron, con la razón para poder corregirlos y reintentar.',
      formula: 'payouts en estado fallido, con su motivo y número de intentos',
      fuente: FUENTE_PAYOUTS,
      salvedades: [
        `Se muestran hasta ${MAX_FILAS_FALLIDOS} filas; el total de fallidos del periodo es el del gráfico de estado.`,
        'Los identificadores y los motivos son inventados.',
      ],
    }),
  };
}
