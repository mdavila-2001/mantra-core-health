/* ============================================================================
    El odontograma, en datos.

    Notación FDI de dos dígitos: el primero es el cuadrante (1 superior derecho,
    2 superior izquierdo, 3 inferior izquierdo, 4 inferior derecho) y el segundo
    la pieza contando desde el centro. Sólo dentición permanente — la temporal
    (51-85) tiene su propia numeración y queda fuera a propósito, igual que en
    el catálogo dental de la API.

    Los códigos de estado son los del formulario de evaluación bucodental de la
    OMS (Oral health surveys: basic methods, 5.ª ed.). Son valores de un
    formulario, no conceptos de terminología: viven acá y no en `*_concept_id`.
   ========================================================================= */

/** Un cuadrante, con sus piezas en el orden en que se dibujan. */
export interface CuadranteFdi {
  readonly nombre: string;
  /** Las 8 piezas, ya ordenadas para pintar (del molar al incisivo o al revés). */
  readonly piezas: readonly string[];
}

/**
 * Las cuatro filas del odontograma, en el orden visual de una boca vista de
 * frente: arriba derecha del paciente (a la izquierda de quien mira) primero.
 */
export const CUADRANTES_FDI: readonly CuadranteFdi[] = [
  {
    nombre: 'Superior derecho',
    piezas: ['18', '17', '16', '15', '14', '13', '12', '11'],
  },
  {
    nombre: 'Superior izquierdo',
    piezas: ['21', '22', '23', '24', '25', '26', '27', '28'],
  },
  {
    nombre: 'Inferior derecho',
    piezas: ['48', '47', '46', '45', '44', '43', '42', '41'],
  },
  {
    nombre: 'Inferior izquierdo',
    piezas: ['31', '32', '33', '34', '35', '36', '37', '38'],
  },
];

/** Las 32 piezas permanentes, en orden de cuadrante. */
export const PIEZAS_FDI: readonly string[] = CUADRANTES_FDI.flatMap(
  (cuadrante) => cuadrante.piezas,
);

/** Un estado posible de una pieza, con el tono con que se pinta. */
export interface EstadoDental {
  /** Código de la OMS. Es lo que se guarda. */
  readonly codigo: string;
  readonly etiqueta: string;
  /**
   * El tono del sistema con que se pinta la pieza.
   *
   * `neutral` es «sin registrar» y `success` es «sana»: el color nunca va
   * solo —la pieza muestra también el código— porque un odontograma que se
   * lee sólo por color no lo lee quien no distingue esos colores.
   */
  readonly tono: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}

/**
 * Los estados del formulario de la OMS para dentición permanente.
 *
 * Los códigos 0-9 son los de la tabla de la 5.ª edición; `T` es el de trauma,
 * que la misma tabla agrega como columna aparte.
 */
export const ESTADOS_DENTALES: readonly EstadoDental[] = [
  { codigo: '0', etiqueta: 'Sana', tono: 'success' },
  { codigo: '1', etiqueta: 'Cariada', tono: 'error' },
  { codigo: '2', etiqueta: 'Obturada con caries', tono: 'error' },
  { codigo: '3', etiqueta: 'Obturada sin caries', tono: 'info' },
  { codigo: '4', etiqueta: 'Perdida por caries', tono: 'warning' },
  { codigo: '5', etiqueta: 'Perdida por otra causa', tono: 'warning' },
  { codigo: '6', etiqueta: 'Sellante', tono: 'info' },
  { codigo: '7', etiqueta: 'Prótesis o corona', tono: 'info' },
  { codigo: '8', etiqueta: 'Sin erupcionar', tono: 'neutral' },
  { codigo: '9', etiqueta: 'No registrada', tono: 'neutral' },
  { codigo: 'T', etiqueta: 'Traumatismo', tono: 'warning' },
];

/** El estado de cada pieza, por código FDI. Lo que viaja en `value_json`. */
export type MapaDental = Readonly<Record<string, string>>;

/** Un estado por su código, o `undefined` si el código no es de la tabla. */
export function estadoPorCodigo(codigo: string): EstadoDental | undefined {
  return ESTADOS_DENTALES.find((estado) => estado.codigo === codigo);
}

/* ---- Los índices CPO-D --------------------------------------------------- */

/** Códigos que cuentan como pieza cariada (C). */
const CODIGOS_CARIADOS = ['1', '2'];
/** Códigos que cuentan como pieza perdida (P). */
const CODIGOS_PERDIDOS = ['4', '5'];
/** Códigos que cuentan como pieza obturada (O). */
const CODIGOS_OBTURADOS = ['3'];

/** El recuento CPO-D de un mapa: cariadas, perdidas, obturadas y su suma. */
export interface RecuentoCpod {
  readonly cariados: number;
  readonly perdidos: number;
  readonly obturados: number;
  /** El índice CPO-D es la suma de los tres. */
  readonly cpod: number;
}

/**
 * Cuenta las piezas de cada grupo del índice CPO-D.
 *
 * La obturada CON caries (código 2) cuenta como cariada y no como obturada:
 * así lo define la OMS —lo que el índice mide es enfermedad presente— y es la
 * clase de detalle que hace que valga la pena calcularlo en vez de pedirlo.
 */
export function recuentoCpod(mapa: MapaDental): RecuentoCpod {
  const codigos = Object.values(mapa);
  const contar = (grupo: readonly string[]): number =>
    codigos.filter((codigo) => grupo.includes(codigo)).length;

  const cariados = contar(CODIGOS_CARIADOS);
  const perdidos = contar(CODIGOS_PERDIDOS);
  const obturados = contar(CODIGOS_OBTURADOS);
  return { cariados, perdidos, obturados, cpod: cariados + perdidos + obturados };
}
