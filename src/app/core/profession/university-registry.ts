import { Injectable, computed, signal } from '@angular/core';

import {
  CATALOG_OUTSIDE_INSTITUTION,
  SYSTEM_UNIVERSITIES,
  PRIVATE_UNIVERSITIES,
  type HealthArea,
  type InstitutionOption,
} from './educational-institutions';
import type { PaisGenerado } from './universities-by-country.generated';

/**
 * Un país del árbol «país → universidades» que alimenta los desplegables de
 * dónde se estudió un título.
 */
export interface StudyCountry {
  /** ISO 3166-1 alpha-2. */
  readonly iso: string;
  /** El nombre en español, que es también el valor que guarda el formulario. */
  readonly nombre: string;
  /** Sus universidades, ya como opciones de `app-select`, ordenadas. */
  readonly universidades: readonly InstitutionOption[];
}

/**
 * El valor centinela de «mi país no está en la lista».
 *
 * Mismo criterio que {@link CATALOG_OUTSIDE_INSTITUTION}: no es un país, es
 * la puerta al campo escrito a mano. La fuente trae 200 países, así que es un
 * caso raro, pero una lista cerrada que no se puede esquivar le niega el alta a
 * quien se formó en el que falta.
 */
export const CATALOG_OUTSIDE_COUNTRY = '__otro-pais__';

/** La opción que abre el campo escrito a mano del país. */
export const COUNTRY_OTHER_OPTION: InstitutionOption = {
  value: CATALOG_OUTSIDE_COUNTRY,
  label: 'Otro país…',
};

/** La opción que abre el campo escrito a mano de la universidad. */
export const INSTITUTION_OTHER_OPTION: InstitutionOption = {
  value: CATALOG_OUTSIDE_INSTITUTION,
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
export const BOLIVIA: StudyCountry = {
  iso: 'BO',
  nombre: 'Bolivia',
  universidades: [...SYSTEM_UNIVERSITIES, ...PRIVATE_UNIVERSITIES],
};

/** En qué está la carga del padrón importado. Bolivia está siempre, sin pedir. */
export type RegistryStatus = 'sin-pedir' | 'cargando' | 'listo' | 'fallo';

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
export function choiceFromText(
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
 * - un {@link HealthArea}: las que dictan esa carrera («Odontólogo» →
 *   las que tienen Odontología).
 *
 * El filtro sólo se aplica donde hay dato: la lista curada de Bolivia. El
 * padrón del exterior no trae carreras —Wikidata las enlaza para 2 de 179
 * universidades argentinas, medido el 04/10/2026—, así que ahí se ofrece
 * entero en vez de vaciarlo.
 */
export type HealthFilter = null | 'salud' | HealthArea;

/** Si la universidad pasa el filtro. Sin dato de carreras, pasa. */
export function filterPasses(opcion: InstitutionOption, filtro: HealthFilter): boolean {
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
export function cityToChooseUniversity(actual: string, sedes: readonly string[]): string {
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
export class UniversitiesRegistry {
  private readonly generated = signal<readonly PaisGenerado[]>([]);
  private readonly internalStatus = signal<RegistryStatus>('sin-pedir');
  private load: Promise<void> | null = null;

  readonly status = this.internalStatus.asReadonly();

  /** Bolivia primero —es el caso mayoritario—, y el resto por nombre. */
  readonly countries = computed<readonly StudyCountry[]>(() => [
    BOLIVIA,
    ...this.generated().map((pais) => ({
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

  private readonly byName = computed(
    () => new Map(this.countries().map((pais) => [pais.nombre, pais] as const)),
  );

  /** Las opciones del desplegable de país, con «Otro país…» al final. */
  readonly countryOptions = computed<readonly InstitutionOption[]>(() => [
    ...this.countries().map((pais) => ({ value: pais.nombre, label: pais.nombre })),
    COUNTRY_OTHER_OPTION,
  ]);

  /**
   * Pide el padrón importado, una sola vez. Un fallo deja volver a intentar.
   */
  cargar(): Promise<void> {
    if (this.load !== null) return this.load;
    this.internalStatus.set('cargando');
    this.load = import('./universities-by-country.generated').then(
      (modulo) => {
        this.generated.set(modulo.PAISES_GENERADOS);
        this.internalStatus.set('listo');
      },
      () => {
        this.internalStatus.set('fallo');
        this.load = null;
      },
    );
    return this.load;
  }

  /** Si el nombre es uno de los países del árbol. */
  isCatalogCountry(nombre: string): boolean {
    return this.byName().has(nombre);
  }

  /** Las universidades de un país; vacío si el país no está o no se eligió. */
  universitiesOf(pais: string): readonly InstitutionOption[] {
    return this.byName().get(pais)?.universidades ?? [];
  }

  /**
   * Las listas ya armadas por país y filtro, para devolver la misma referencia
   * mientras el padrón no cambie: las plantillas piden esto en cada detección
   * de cambios y un arreglo nuevo cada vez repintaría el desplegable entero.
   */
  private readonly assembledOptions = computed(() => {
    this.countries();
    return new Map<string, readonly InstitutionOption[]>();
  });

  /**
   * Las opciones del desplegable de universidad para un país, acotadas por
   * {@link HealthFilter}, con «Otra institución…» siempre al final: con
   * «Otro país…» elegido es la única.
   */
  universityOptions(pais: string, filtro: HealthFilter = null): readonly InstitutionOption[] {
    const clave = `${pais}\u0000${filtro ?? ''}`;
    const armadas = this.assembledOptions();
    const previa = armadas.get(clave);
    if (previa !== undefined) return previa;
    const opciones = [
      ...this.universitiesOf(pais).filter((opcion) => filterPasses(opcion, filtro)),
      INSTITUTION_OTHER_OPTION,
    ];
    armadas.set(clave, opciones);
    return opciones;
  }

  /** Si la universidad figura en la lista de ese país. */
  isUniversityOf(pais: string, universidad: string): boolean {
    return this.universitiesOf(pais).some((opcion) => opcion.value === universidad);
  }

  /**
   * Las ciudades que el desplegable «Ciudad de estudio» ofrece para esa
   * universidad: sus sedes, la principal primero. Vacío si el padrón no las
   * conoce (universidad escrita a mano o sin ciudad en Wikidata).
   */
  citiesOf(pais: string, universidad: string): readonly string[] {
    return (
      this.universitiesOf(pais).find((opcion) => opcion.value === universidad)?.sedes ?? WITHOUT_CITIES
    );
  }
}

/** Una sola referencia para «sin ciudades», por lo mismo que las opciones armadas. */
const WITHOUT_CITIES: readonly string[] = [];
