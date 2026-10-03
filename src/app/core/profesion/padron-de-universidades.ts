import { Injectable, computed, signal } from '@angular/core';

import {
  INSTITUCION_FUERA_DE_CATALOGO,
  UNIVERSIDADES_DEL_SISTEMA,
  UNIVERSIDADES_PRIVADAS,
  type OpcionDeInstitucion,
} from './instituciones-educativas';
import type { PaisGenerado } from './universidades-por-pais.generated';

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
 * Qué ciudad de estudio queda al cambiar de universidad en el desplegable.
 *
 * La ciudad **sigue a la universidad** mientras nadie la haya escrito a mano:
 * vacía, o todavía la que se propuso con la universidad anterior, se reemplaza
 * por la de la nueva —que es vacía si la nueva no tiene una sola sede—. Lo que
 * la persona tecleó se respeta: quien cursó en una subsede sabe más que el
 * padrón, y pisárselo al tocar el desplegable sería perderle el dato.
 *
 * @param actual - Lo que hoy dice el campo de ciudad.
 * @param propuestaAnterior - La ciudad de la universidad que estaba elegida.
 * @param propuestaNueva - La ciudad de la universidad que se acaba de elegir.
 */
export function ciudadAlCambiarDeUniversidad(
  actual: string,
  propuestaAnterior: string,
  propuestaNueva: string,
): string {
  const escrita = actual.trim();
  const sigueALaUniversidad = escrita === '' || escrita === propuestaAnterior;
  return sigueALaUniversidad ? propuestaNueva : actual;
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
      universidades: pais.universidades.map((nombre) => ({ value: nombre, label: nombre })),
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
    this.carga = import('./universidades-por-pais.generated').then(
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
   * Las listas ya armadas por país, para devolver la misma referencia mientras
   * el padrón no cambie: las plantillas piden esto en cada detección de
   * cambios y un arreglo nuevo cada vez repintaría el desplegable entero.
   */
  private readonly opcionesPorPais = computed(() => {
    this.paises();
    return new Map<string, readonly OpcionDeInstitucion[]>();
  });

  /**
   * Las opciones del desplegable de universidad para un país, con «Otra
   * institución…» siempre al final: con «Otro país…» elegido es la única.
   */
  opcionesDeUniversidad(pais: string): readonly OpcionDeInstitucion[] {
    const armadas = this.opcionesPorPais();
    const previa = armadas.get(pais);
    if (previa !== undefined) return previa;
    const opciones = [...this.universidadesDe(pais), OPCION_OTRA_INSTITUCION];
    armadas.set(pais, opciones);
    return opciones;
  }

  /** Si la universidad figura en la lista de ese país. */
  esUniversidadDe(pais: string, universidad: string): boolean {
    return this.universidadesDe(pais).some((opcion) => opcion.value === universidad);
  }

  /**
   * La ciudad que se propone como «Ciudad de estudio» para esa universidad, o
   * vacío si no hay una que proponer.
   *
   * Sólo la lista curada de Bolivia la trae, y sólo para las de sede única. El
   * padrón importado no tiene ciudad —la fuente no la publica—, así que para
   * el resto de los países el campo se sigue escribiendo a mano.
   */
  ciudadDe(pais: string, universidad: string): string {
    return this.universidadesDe(pais).find((opcion) => opcion.value === universidad)?.ciudad ?? '';
  }
}
