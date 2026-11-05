import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { TablaReporte } from '../../../data-access/reporting/reporting.types';
import { enMoneda, info, unidadMoneda } from './cobros.comun';
import { CAUSAS_DESCUADRE, type Metodo, type ModeloCobros } from './cobros.modelo';
import { suma } from './reporting-dataset.util';

/* Solo ids de operación enmascarados: ninguna tabla lleva datos del pagador, de cuentas ni de tarjetas. */

const ATIPICAS: readonly {
  readonly id: string;
  readonly metodo: Metodo;
  readonly estado: string;
  readonly importeBob: number;
  readonly alerta: string;
}[] = [
  { id: 'TX-••4821', metodo: 'Tarjeta', estado: 'Capturada', importeBob: 4850, alerta: 'Importe muy superior al habitual' },
  { id: 'TX-••8013', metodo: 'Tarjeta', estado: 'Capturada', importeBob: 5400, alerta: 'Importe muy superior al habitual' },
  { id: 'TX-••1307', metodo: 'Tarjeta', estado: 'En disputa', importeBob: 1290, alerta: 'Contracargo abierto' },
  { id: 'TX-••7742', metodo: 'QR', estado: 'Capturada', importeBob: 310, alerta: 'Cuatro intentos seguidos antes de pagar' },
  { id: 'TX-••2594', metodo: 'QR', estado: 'Rechazada', importeBob: 95, alerta: 'Rechazos repetidos por tiempo de espera' },
  { id: 'TX-••0958', metodo: 'Transferencia', estado: 'Reembolsada', importeBob: 2200, alerta: 'Reembolso total a las pocas horas' },
  { id: 'TX-••6120', metodo: 'Transferencia', estado: 'Autorizada', importeBob: 760, alerta: 'Más de 6 días sin liquidar' },
  { id: 'TX-••3365', metodo: 'Efectivo en caja', estado: 'Capturada', importeBob: 3900, alerta: 'Efectivo por encima del límite de caja' },
];

/** Ordenadas de la más antigua a la más nueva: si hay pocas, se muestran las más viejas. */
const EXCEPCIONES: readonly {
  readonly id: string;
  readonly causa: (typeof CAUSAS_DESCUADRE)[number];
  readonly dias: number;
  readonly importeBob: number;
  readonly estado: string;
}[] = [
  { id: 'EX-••1042', causa: 'Monto distinto', dias: 47, importeBob: 85.5, estado: 'En revisión' },
  { id: 'EX-••1198', causa: 'Sin registro en el proveedor', dias: 36, importeBob: 240, estado: 'Abierta' },
  { id: 'EX-••1377', causa: 'Duplicado', dias: 28, importeBob: 150, estado: 'En revisión' },
  { id: 'EX-••1410', causa: 'Sin registro propio', dias: 19, importeBob: 320, estado: 'Abierta' },
  { id: 'EX-••1526', causa: 'Monto distinto', dias: 12, importeBob: 12.8, estado: 'Abierta' },
  { id: 'EX-••1604', causa: 'Sin registro en el proveedor', dias: 9, importeBob: 180, estado: 'Abierta' },
  { id: 'EX-••1689', causa: 'Monto distinto', dias: 4, importeBob: 64, estado: 'Abierta' },
  { id: 'EX-••1733', causa: 'Sin registro propio', dias: 1, importeBob: 210, estado: 'Abierta' },
];

export function tablaAtipicas(m: ModeloCobros): TablaReporte {
  const u = unidadMoneda(m);
  return {
    id: 'transacciones-atipicas',
    titulo: 'Transacciones atípicas',
    columnas: [
      { clave: 'operacion', etiqueta: 'Operación' },
      { clave: 'metodo', etiqueta: 'Método' },
      { clave: 'estado', etiqueta: 'Estado' },
      { clave: 'importe', etiqueta: 'Importe', alinear: 'der' },
      { clave: 'alerta', etiqueta: 'Por qué se marcó' },
    ],
    filas: ATIPICAS.filter((t) => m.activos.includes(t.metodo)).map((t) => ({
      operacion: t.id,
      metodo: t.metodo,
      estado: t.estado,
      importe: formatearValor(enMoneda(m, t.importeBob), u),
      alerta: t.alerta,
    })),
    info: info({
      definicion: 'Operaciones que el monitoreo marcó como fuera de lo normal para que una persona las revise.',
      formula: 'Operaciones con alguna regla de alerta activa (importe, reintentos, reembolso o disputa), de mayor a menor gravedad.',
      fuente: 'payments.payment_transactions · risk_assessments · payment_disputes',
      salvedades: ['Solo muestra el id de la operación enmascarado; nunca datos de quien pagó.'],
    }),
  };
}

export function tablaExcepciones(m: ModeloCobros): TablaReporte {
  const u = unidadMoneda(m);
  const abiertas = suma(m.descuadres.map((f) => suma(f)));
  return {
    id: 'excepciones-conciliacion',
    titulo: 'Excepciones de conciliación',
    columnas: [
      { clave: 'excepcion', etiqueta: 'Excepción' },
      { clave: 'causa', etiqueta: 'Causa' },
      { clave: 'dias', etiqueta: 'Días abierta', alinear: 'der' },
      { clave: 'importe', etiqueta: 'Diferencia', alinear: 'der' },
      { clave: 'estado', etiqueta: 'Estado' },
    ],
    filas: EXCEPCIONES.slice(0, Math.min(EXCEPCIONES.length, abiertas)).map((e) => ({
      excepcion: e.id,
      causa: e.causa,
      dias: e.dias,
      importe: formatearValor(enMoneda(m, e.importeBob), u),
      estado: e.estado,
    })),
    info: info({
      definicion: 'Las diferencias abiertas más antiguas entre el gateway y la contabilidad.',
      formula: 'Excepciones de conciliación sin cerrar, ordenadas de la más antigua a la más reciente (hasta 8).',
      fuente: 'payments.reconciliation_exceptions · reconciliation_runs',
      salvedades: ['Es una foto de hoy; la lista completa vive en el módulo de conciliación.'],
    }),
  };
}
