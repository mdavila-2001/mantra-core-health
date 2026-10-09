import { Injectable, computed, signal } from '@angular/core';

import {
  INSTITUCION_FUERA_DE_CATALOGO,
  UNIVERSIDADES_DEL_SISTEMA,
  UNIVERSIDADES_PRIVADAS,
  type AreaDeSalud,
  type OpcionDeInstitucion,
} from './educational-institutions';
import type { PaisGenerado } from './universities-by-country.generated';

/**
 * Un país del árbol «país → universidades» que alimenta los desplegables de
 * dónde se estudió un título.
 */
export interface PaisDeEstudio {
  /** ISO 3166-1 alpha-2. */
  readonly iso: string;
  /** El nombre en español, que es también el valor que guarda el formulario. */
  readonly nombre: string;
  /** Sus universidades, ya como opciones de `app-select`, ordenadas. */
  readonly universidades: readonly OpcionDeInstitucion[];
}

/**
 * El valor centinela de «mi país no está en la lista».
 *
 * Mismo criterio que {@link INSTITUCION_FUERA_DE_CATALOGO}: no es un país, es
 * la puerta al campo escrito a mano. La fuente trae 200 países, así que es un
 * caso raro, pero una lista cerrada que no se puede esquivar le niega el alta a
 * quien se formó en el que falta.
 */
export const PAIS_FUERA_DE_CATALOGO = '__otro-pais__';

/** La opción que abre el campo escrito a mano del país. */
export const OPCION_OTRO_PAIS: OpcionDeInstitucion = {
  value: PAIS_FUERA_DE_CATALOGO,
  label: 'Otro país…',
};

/** La opción que abre el campo escrito a mano de la universidad. */
export const OPCION_OTRA_INSTITUCION: OpcionDeInstitucion = {
  value: INSTITUCION_FUERA_DE_CATALOGO,
  label: 'Otra institución…',
};

/**
 * Bolivia, con la lista **curada** y no la importada.
 *
 * Es la regla del propietario del 13/09/2026 —universidades «catalogadas como
 * autorizadas»—, y además la fuente externa trae la misma casa de estudios
 * repetida por sede («Universidad Católica Boliviana, La Paz», «…, Cochabamba»).
 * Las etiquetas curadas traen sigla y ciudad; el valor sigue siendo el nombre.
 */
export const BOLIVIA: PaisDeEstudio = {
  iso: 'BO',
  nombre: 'Bolivia',
  universidades: [...UNIVERSIDADES_DEL_SISTEMA, ...UNIVERSIDADES_PRIVADAS],
};

/** En qué está la carga del padrón importado. Bolivia está siempre, sin pedir. */
export type EstadoDelPadron = 'sin-pedir' | 'cargando' | 'listo' | 'fallo';

/**
 * Qué opción del desplegable corresponde a un texto ya guardado.
 *
 * Es la regla compartida por el país y la universidad, en el alta y en las
 * filas de títulos: vacío es «sin elegir», un nombre del catálogo es esa
 * opción, y cualquier otro texto es la opción «Otro…» con el texto a la vista
 * en la casilla escrita a mano. Así lo que las pruebas y el formulario escriben
 * como texto se refleja en el desplegable sin que nadie lo mapee dos veces.
 *
 * @param texto - Lo guardado en el campo.
 * @param enCatalogo - Si ese texto es una opción del desplegable.
 * @param centinela - El valor de la opción «Otro…» de ese desplegable.
 */
export function eleccionDesdeTexto(
  texto: string,
  enCatalogo: (texto: string) => boolean,
  centinela: string,
): string | null {
  const limpio = texto.trim();
  if (limpio === '') return null;
  return enCatalogo(limpio) ? limpio : centinela;
}

/**
 * Qué universidades se ofrecen según el título que se está cargando.
 *
 * - `null`: todas (la «Otra profesión» puede ser Derecho o Ingeniería).
 * - `'salud'`: las que dictan alguna carrera de salud.
 * - un {@link AreaDeSalud}: las que dictan esa carrera («Odontólogo» →
 *   las que tienen Odontología).
 *
 * El filtro sólo se aplica donde hay dato: la lista curada de Bolivia. El
 * padrón del exterior no trae carreras —Wikidata las enlaza para 2 de 179
 * universidades argentinas, medido el 04/10/2026—, así que ahí se ofrece
 * entero en vez de vaciarlo.
 */
export type FiltroDeSalud = null | 'salud' | AreaDeSalud;

/** Si la universidad pasa el filtro. Sin dato de carreras, pasa. */
export function pasaElFiltro(opcion: OpcionDeInstitucion, filtro: FiltroDeSalud): boolean {
  if (filtro === null || opcion.areasDeSalud === undefined) return true;
  return filtro === 'salud'
    ? opcion.areasDeSalud.length > 0
    : opcion.areasDeSalud.includes(filtro);
}

/**
 * Qué ciudad queda al elegir una universidad.
 *
 * La ciudad **sale de la universidad** (propietario, 04/10/2026): nunca se
 * escribe. Si la que estaba sigue siendo una de sus sedes se conserva —quien
 * estudió en la sede de Montero no vuelve a Santa Cruz por tocar el
 * desplegable—; si no, la sede principal, o vacío si el padrón no la conoce.
 *
 * @param actual - La ciudad elegida hasta ahora.
 * @param sedes - Las ciudades de la universidad recién elegida.
 */
export function ciudadAlElegirUniversidad(actual: string, sedes: readonly string[]): string {
  return sedes.includes(actual) ? actual : (sedes[0] ?? '');
}

/**
 * El padrón de universidades por país, como árbol: se elige el país y la
 * lista de universidades se acota a él.
 *
 * ## Por qué un servicio y no una constante
 *
 * El padrón importado pesa unos 90 KB comprimidos (10 200 universidades de 199
 * países). Cargarlo con la pantalla del alta encarecería un paso que la mayoría
 * contesta con «Bolivia» y una de treinta universidades. Por eso Bolivia está
 * **siempre**, sin pedir, y el resto llega por un `import()` diferido que
 * esbuild separa en su propio trozo; {@link cargar} lo pide una sola vez y el
 * estado dice en qué va. Si el trozo no llega —sin red—, la pantalla sigue
 * sirviendo: Bolivia, «Otro país…» y el texto escrito a mano.
 *
 * ## Qué guarda el formulario
 *
 * El **nombre**, no un id, para el país y para la universidad: es lo que el
 * contrato recibe hoy (`issuingInstitutionText`), y el país todavía no viaja.
 * El día que `VS_COUNTRY` tenga miembros y el DTO exponga
 * `issuingCountryConceptId`, esto pasa a ser un mapeo ISO → concepto sin tocar
 * la pantalla.
 *
 * De dónde sale cada lista: `scripts/gen-universidades-por-pais.mjs`.
 */
@Injectable({ providedIn: 'root' })
export class PadronDeUniversidades {
  private readonly generados = signal<readonly PaisGenerado[]>([]);
  private readonly estadoInterno = signal<EstadoDelPadron>('sin-pedir');
  private carga: Promise<void> | null = null;

  readonly estado = this.estadoInterno.asReadonly();

  /** Bolivia primero —es el caso mayoritario—, y el resto por nombre. */
  readonly paises = computed<readonly PaisDeEstudio[]>(() => [
    BOLIVIA,
    ...this.generados().map((pais) => ({
      iso: pais.iso,
      nombre: pais.nombre,
      universidades: pais.universidades.map((nombre) => {
        const sedes = pais.ciudades?.[nombre];
        return sedes === undefined
          ? { value: nombre, label: nombre }
          : { value: nombre, label: nombre, sedes };
      }),
    })),
  ]);

  private readonly porNombre = computed(
    () => new Map(this.paises().map((pais) => [pais.nombre, pais] as const)),
  );

  /** Las opciones del desplegable de país, con «Otro país…» al final. */
  readonly opcionesDePais = computed<readonly OpcionDeInstitucion[]>(() => [
    ...this.paises().map((pais) => ({ value: pais.nombre, label: pais.nombre })),
    OPCION_OTRO_PAIS,
  ]);

  /**
   * Pide el padrón importado, una sola vez. Un fallo deja volver a intentar.
   */
  cargar(): Promise<void> {
    if (this.carga !== null) return this.carga;
    this.estadoInterno.set('cargando');
    this.carga = import('./universities-by-country.generated').then(
      (modulo) => {
        this.generados.set(modulo.PAISES_GENERADOS);
        this.estadoInterno.set('listo');
      },
      () => {
        this.estadoInterno.set('fallo');
        this.carga = null;
      },
    );
    return this.carga;
  }

  /** Si el nombre es uno de los países del árbol. */
  esPaisDelCatalogo(nombre: string): boolean {
    return this.porNombre().has(nombre);
  }

  /** Las universidades de un país; vacío si el país no está o no se eligió. */
  universidadesDe(pais: string): readonly OpcionDeInstitucion[] {
    return this.porNombre().get(pais)?.universidades ?? [];
  }

  /**
   * Las listas ya armadas por país y filtro, para devolver la misma referencia
   * mientras el padrón no cambie: las plantillas piden esto en cada detección
   * de cambios y un arreglo nuevo cada vez repintaría el desplegable entero.
   */
  private readonly opcionesArmadas = computed(() => {
    this.paises();
    return new Map<string, readonly OpcionDeInstitucion[]>();
  });

  /**
   * Las opciones del desplegable de universidad para un país, acotadas por
   * {@link FiltroDeSalud}, con «Otra institución…» siempre al final: con
   * «Otro país…» elegido es la única.
   */
  opcionesDeUniversidad(pais: string, filtro: FiltroDeSalud = null): readonly OpcionDeInstitucion[] {
    const clave = `${pais}\u0000${filtro ?? ''}`;
    const armadas = this.opcionesArmadas();
    const previa = armadas.get(clave);
    if (previa !== undefined) return previa;
    const opciones = [
      ...this.universidadesDe(pais).filter((opcion) => pasaElFiltro(opcion, filtro)),
      OPCION_OTRA_INSTITUCION,
    ];
    armadas.set(clave, opciones);
    return opciones;
  }

  /** Si la universidad figura en la lista de ese país. */
  esUniversidadDe(pais: string, universidad: string): boolean {
    return this.universidadesDe(pais).some((opcion) => opcion.value === universidad);
  }

  /**
   * Las ciudades que el desplegable «Ciudad de estudio» ofrece para esa
   * universidad: sus sedes, la principal primero. Vacío si el padrón no las
   * conoce (universidad escrita a mano o sin ciudad en Wikidata).
   */
  ciudadesDe(pais: string, universidad: string): readonly string[] {
    return (
      this.universidadesDe(pais).find((opcion) => opcion.value === universidad)?.sedes ?? SIN_CIUDADES
    );
  }
}

/** Una sola referencia para «sin ciudades», por lo mismo que las opciones armadas. */
const SIN_CIUDADES: readonly string[] = [];
