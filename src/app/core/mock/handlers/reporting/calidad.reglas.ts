import {
  ETIQUETA_PESTANA,
  FRESCURA_OBJETIVO_MIN,
  PESTANAS_CATALOGADAS,
  filaCompleta,
  type FilaCatalogo,
  type PestanaCatalogada,
} from './calidad.catalogo';
import { redondear } from './reporting-dataset.util';

/* ============================================================================
    Reglas de calidad del dato.

    Dos orígenes, y la tabla lo dice en una columna:
      · `catalogo` — se CALCULAN al armar la pestaña, sobre los indicadores que
        las otras pestañas publican de verdad (¿tiene fórmula? ¿la tasa trae
        denominador? ¿el dato llega dentro del objetivo?).
      · `simulada` — su resultado es un número de EJEMPLO escrito a mano: no hay
        todavía ninguna corrida real de reglas contra una base.

    Una celda es `null` cuando la regla no aplica a esa pestaña o la pestaña no
    tiene indicadores en el ámbito: no se evaluó, no «pasó con 100».
    ========================================================================== */

/** Cumplimiento mínimo (%) para que una regla se dé por pasada. */
export const UMBRAL_REGLA_PCT = 95;

export type ResultadoRegla = 'pasa' | 'falla' | 'sin-evaluar';

export const ETIQUETA_RESULTADO: Readonly<Record<ResultadoRegla, string>> = {
  pasa: 'Pasa',
  falla: 'Falla',
  'sin-evaluar': 'Sin evaluar',
};

type Porcentajes = Readonly<Partial<Record<PestanaCatalogada, number>>>;

interface DefRegla {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly origen: 'catalogo' | 'simulada';
  readonly ultimaCorrida: string;
  /** Solo en las `catalogo`: cumplimiento (%) de las filas de UNA pestaña (`todas` = todo el ámbito); `null` si no aplica. */
  readonly calcular?: (
    filas: readonly FilaCatalogo[],
    pestana: PestanaCatalogada,
    todas: readonly FilaCatalogo[],
  ) => number | null;
  /** Solo en las `simulada`: cumplimiento (%) de EJEMPLO por pestaña; lo que falta, no aplica. */
  readonly simulado?: Porcentajes;
}

const pct = (parte: number, total: number): number | null => (total === 0 ? null : redondear((parte / total) * 100, 1));

const AL_ARMAR = 'Al abrir esta pestaña';

const DEFINICIONES: readonly DefRegla[] = [
  {
    id: 'definicion-completa',
    nombre: 'Definición completa',
    descripcion: 'Cada indicador trae definición, fórmula, fuente y frescura.',
    origen: 'catalogo',
    ultimaCorrida: AL_ARMAR,
    calcular: (filas) => pct(filas.filter(filaCompleta).length, filas.length),
  },
  {
    id: 'tasas-con-numerador-y-denominador',
    nombre: 'Tasas con numerador y denominador',
    descripcion: 'Todo porcentaje o razón declara de qué sale cada parte.',
    origen: 'catalogo',
    ultimaCorrida: AL_ARMAR,
    calcular: (filas) => {
      const tasas = filas.filter((f) => f.tasa);
      return pct(tasas.filter((f) => !f.faltan.includes('numerador') && !f.faltan.includes('denominador')).length, tasas.length);
    },
  },
  {
    id: 'fuente-declarada',
    nombre: 'Fuente declarada',
    descripcion: 'Cada indicador dice de qué tabla o módulo sale.',
    origen: 'catalogo',
    ultimaCorrida: AL_ARMAR,
    calcular: (filas) => pct(filas.filter((f) => f.fuente !== null).length, filas.length),
  },
  {
    id: 'frescura-en-objetivo',
    nombre: 'Frescura dentro del objetivo',
    descripcion: 'El dato llega en menos minutos que el objetivo de su pestaña.',
    origen: 'catalogo',
    ultimaCorrida: AL_ARMAR,
    calcular: (filas, pestana) => pct(filas.filter((f) => f.frescuraMin <= FRESCURA_OBJETIVO_MIN[pestana]).length, filas.length),
  },
  {
    id: 'codigos-unicos',
    nombre: 'Códigos únicos (pestaña.id)',
    descripcion:
      'El código completo de un indicador es «pestaña.id» y no se define dos veces. Un mismo id en pestañas distintas (p. ej. ingreso-periodo) es legítimo: cada pestaña lo define para su vertical.',
    origen: 'catalogo',
    ultimaCorrida: AL_ARMAR,
    calcular: (filas, _pestana, todas) =>
      pct(
        filas.filter(
          (f) => todas.filter((o) => o.pestana === f.pestana && o.tipo === f.tipo && o.id === f.id).length === 1,
        ).length,
        filas.length,
      ),
  },
  {
    id: 'importes-con-moneda',
    nombre: 'Importes con su moneda',
    descripcion: 'Ningún importe viaja sin moneda ni se suman monedas distintas.',
    origen: 'simulada',
    ultimaCorrida: '30/10/2026 08:15',
    simulado: { suscripciones: 100, publicidad: 99.4, comisiones: 98.7, cobros: 100 },
  },
  {
    id: 'cuadre-con-el-mayor',
    nombre: 'Cuadre con el mayor',
    descripcion: 'Los totales de dinero coinciden con lo que dice la contabilidad.',
    origen: 'simulada',
    ultimaCorrida: '30/10/2026 06:00',
    simulado: { comisiones: 91.5, cobros: 98.2 },
  },
  {
    id: 'ids-sin-duplicados',
    nombre: 'Identificadores sin duplicados',
    descripcion: 'Una transacción o suscripción aparece una sola vez.',
    origen: 'simulada',
    ultimaCorrida: '30/10/2026 07:30',
    simulado: { suscripciones: 99.9, publicidad: 100, comisiones: 99.6, cobros: 99.8, adquisicion: 98.9 },
  },
  {
    id: 'muestra-minima',
    nombre: 'Muestra mínima en cortes finos',
    descripcion: 'Un corte por especialidad o ciudad no se muestra con muy pocos casos.',
    origen: 'simulada',
    ultimaCorrida: '30/10/2026 07:30',
    simulado: { suscripciones: 97, publicidad: 93.8, adquisicion: 98 },
  },
  {
    id: 'conciliacion-con-pasarela',
    nombre: 'Conciliación con la pasarela de pago',
    descripcion: 'Lo cobrado en la plataforma coincide con lo que liquida la pasarela.',
    origen: 'simulada',
    ultimaCorrida: '30/10/2026 06:00',
    simulado: { comisiones: 96.2, cobros: 99.1 },
  },
];

export interface ReglaEvaluada {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly origen: DefRegla['origen'];
  readonly ultimaCorrida: string;
  /** Cumplimiento (%) por pestaña, en el orden de `PESTANAS_CATALOGADAS`; `null` = no aplica. */
  readonly celdas: readonly (number | null)[];
  readonly alcance: string;
  readonly minimo: number | null;
  readonly resultado: ResultadoRegla;
}

export function evaluarReglas(filas: readonly FilaCatalogo[]): ReglaEvaluada[] {
  return DEFINICIONES.map((def) => {
    const celdas = PESTANAS_CATALOGADAS.map((p) => {
      const tabRows = filas.filter((f) => f.pestana === p);
      if (tabRows.length === 0) {
        return null;
      }
      return def.calcular !== undefined ? def.calcular(tabRows, p, filas) : (def.simulado?.[p] ?? null);
    });
    const evaluadas = celdas.filter((c): c is number => c !== null);
    const minimo = evaluadas.length === 0 ? null : Math.min(...evaluadas);
    const aplica = PESTANAS_CATALOGADAS.filter((p) => (def.calcular !== undefined ? true : def.simulado?.[p] !== undefined));
    return {
      id: def.id,
      nombre: def.nombre,
      descripcion: def.descripcion,
      origen: def.origen,
      ultimaCorrida: def.ultimaCorrida,
      celdas,
      alcance: aplica.length === PESTANAS_CATALOGADAS.length ? 'Todas las pestañas' : aplica.map((p) => ETIQUETA_PESTANA[p]).join(', '),
      minimo,
      resultado: minimo === null ? 'sin-evaluar' : minimo < UMBRAL_REGLA_PCT ? 'falla' : 'pasa',
    };
  });
}
