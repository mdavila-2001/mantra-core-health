import {
  listaDeTextos,
  valorDeTexto,
  type GlossaryTermDetail,
} from '../../core/data-access/terminology/terminology.types';

/**
 * Ficha de medicamento (TAREA-25, «el más importante» según el propietario):
 * principios activos, forma farmacéutica, vía y fabricante.
 *
 * ## Lo que NO está acá, y por qué
 *
 * **Posología, dosis y contraindicaciones no aparecen en este tipo, a
 * propósito.** `.claude/rules/00-non-negotiables.md` §7/§8 y
 * `.claude/rules/70-data-seeders.md` prohíben mostrar un dato clínico
 * generado o sin fuente verificada — hoy no existe ninguna fuente importada
 * para esos tres campos (P-25-1, ficha TAREA-25 §9). Un campo ausente es
 * correcto; uno inventado es un daño clínico. Cuando la fuente exista, se
 * agrega acá **con su procedencia** (AC-25-7), no antes.
 */
export interface GlossaryDrugFacts {
  readonly activeIngredients: readonly string[];
  readonly dosageForm: string | null;
  readonly route: readonly string[];
  readonly manufacturer: string | null;
}

/**
 * Lee una propiedad como texto simple, o `null` si no tiene esa forma.
 *
 * Mismo criterio que {@link listaDeTextos}: una forma inesperada es un dato
 * del catálogo que este consumidor no sabe mostrar, no una falla de la
 * pantalla.
 */
function textoDe(propiedades: Readonly<Record<string, unknown>>, codigo: string): string | null {
  const valor = propiedades[codigo];
  if (typeof valor !== 'string') {
    return null;
  }
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Resuelve la ficha de medicamento de un término, o `null` si no tiene
 * ninguno de los cuatro datos — es el patrón *Null Object*: quien llama no
 * necesita preguntar «¿tiene ficha de medicamento?» antes de usarla, sólo
 * comprobar que no sea `null`.
 *
 * Desde FND-25-02 los 6 términos de `pharmacology` traen estos 4 datos
 * —copiados verbatim de un producto real del FDA NDC Directory, ver
 * `glossary-terms.catalog.ts` en el backend—, así que esta función devuelve
 * una ficha real para ellos. Para los demás términos curados sigue
 * devolviendo `null` y el bloque de medicamento se omite entero en la
 * plantilla — eso sigue siendo el criterio de AC-25-6/AC-25-8, no una falla.
 *
 * @param termino - La ficha ya leída del glosario.
 * @returns Los datos disponibles, o `null` si no hay ninguno.
 */
export function drugFactsFrom(termino: GlossaryTermDetail): GlossaryDrugFacts | null {
  // El contrato dice `properties` obligatorio (lo que hoy siempre manda el
  // backend); el `?? {}` es sólo una segunda barrera para que un cambio de
  // contrato no tumbe la ficha entera del término por un dato accesorio.
  const propiedades = termino.properties ?? {};
  const facts: GlossaryDrugFacts = {
    activeIngredients: listaDeTextos(propiedades, 'active_ingredients'),
    dosageForm: textoDe(propiedades, 'dosage_form'),
    route: listaDeTextos(propiedades, 'route'),
    manufacturer: textoDe(propiedades, 'manufacturer'),
  };

  const sinDatos =
    facts.activeIngredients.length === 0 &&
    facts.dosageForm === null &&
    facts.route.length === 0 &&
    facts.manufacturer === null;

  return sinDatos ? null : facts;
}

/* ---------------------------------------------------------------------------
   Ficha de medicamento de CIMA (AEMPS) — glosario en castellano, 2026-09-30.

   A diferencia del NDC de arriba, CIMA publica la **ficha técnica** del
   medicamento autorizado en España: indicaciones, posología, contraindicaciones,
   advertencias y reacciones adversas. La regla que prohibía mostrar esos
   campos (00 §7/§8, 70) prohíbe **inferirlos o generarlos**, no citarlos: acá
   se muestran **verbatim** de la ficha técnica, con su número de registro y la
   fecha de consulta — «Fuente: CIMA (AEMPS), ficha técnica nº …, consultado el
   …» —. Sin número de registro no hay cita posible, y sin cita no se muestra
   ninguna sección.

   Forma de la propiedad (`drug_facts`, esquema 2 de
   `glossary-data-build/SCHEMA.md`): un término por principio activo (VTM), con
   `products[]` (todos los medicamentos autorizados, sus presentaciones y fotos)
   y `sections[]` de la ficha técnica de **un** producto de referencia
   (`referenceProduct`). El parser acepta también la forma plana (`nregistro`,
   `presentations`, `photos` en la raíz) y los nombres `glossary-drug-facts` y
   `drugFacts` de la propiedad, para no acoplar la lectura a un solo nombre.
   --------------------------------------------------------------------------- */

/** Una presentación comercial: su nombre y, si lo trae, el código nacional. */
export interface CimaPresentation {
  readonly name: string;
  readonly nationalCode: string | null;
}

/** Un medicamento autorizado con ese principio activo. */
export interface CimaProduct {
  readonly name: string;
  readonly registrationNumber: string | null;
  readonly holder: string | null;
  /** Ficha del medicamento en CIMA. */
  readonly url: string | null;
  readonly presentations: readonly CimaPresentation[];
}

/** Una foto del medicamento publicada por CIMA (envase o forma farmacéutica). */
export interface CimaPhoto {
  readonly url: string;
  /** La miniatura oficial, si la hay: es lo que se baja para la galería. */
  readonly thumbUrl: string;
  /** «Envase», «Forma farmacéutica», o el tipo tal como vino. */
  readonly caption: string;
  /** De qué medicamento es la foto. */
  readonly productName: string | null;
}

/** Un código ATC con su nombre. */
export interface CimaAtc {
  readonly code: string;
  readonly name: string | null;
}

/** Una sección de la ficha técnica, verbatim. */
export interface CimaSection {
  /** Epígrafe de la ficha técnica: «4.1», «4.2», «4.3», «4.4», «4.8», «5.1». */
  readonly number: string;
  readonly title: string;
  readonly text: string;
}

/** La ficha de CIMA ya leída, lista para pintarse. */
export interface CimaDrugFacts {
  /** Número de registro de la ficha técnica citada (la del producto de referencia). */
  readonly registrationNumber: string;
  /** Medicamento cuya ficha técnica se cita. */
  readonly referenceName: string | null;
  readonly activeIngredients: readonly string[];
  readonly dosageForms: readonly string[];
  readonly routes: readonly string[];
  readonly atc: readonly CimaAtc[];
  readonly products: readonly CimaProduct[];
  readonly photos: readonly CimaPhoto[];
  readonly sections: readonly CimaSection[];
  /** Fecha de consulta a CIMA, `YYYY-MM-DD`, o `null` si no vino. */
  readonly retrievedAt: string | null;
  /** Versión de la ficha técnica citada, `YYYY-MM-DD`, o `null`. */
  readonly documentDate: string | null;
  /** Enlace a la ficha técnica citada. */
  readonly sourceUrl: string | null;
}

/**
 * Las secciones de la ficha técnica que el glosario muestra, en su orden y con
 * el título oficial del epígrafe (el de la fila manda si viene). Las claves son
 * las formas en que puede venir cada una en un mapa.
 */
const SECCIONES_DE_FICHA: readonly {
  readonly number: string;
  readonly title: string;
  readonly keys: readonly string[];
}[] = [
  { number: '4.1', title: 'Indicaciones terapéuticas', keys: ['indications', 'indicaciones'] },
  {
    number: '4.2',
    title: 'Posología y forma de administración',
    keys: ['posology', 'posologia', 'dosage'],
  },
  { number: '4.3', title: 'Contraindicaciones', keys: ['contraindications', 'contraindicaciones'] },
  {
    number: '4.4',
    title: 'Advertencias y precauciones especiales de empleo',
    keys: ['warnings', 'advertencias', 'precautions'],
  },
  {
    number: '4.8',
    title: 'Reacciones adversas',
    keys: ['adverseReactions', 'adverse_reactions', 'reaccionesAdversas'],
  },
  {
    number: '5.1',
    title: 'Propiedades farmacodinámicas',
    keys: ['pharmacodynamics', 'propiedadesFarmacodinamicas'],
  },
];

const CODIGOS_DE_FICHA_CIMA = ['drug_facts', 'glossary-drug-facts', 'drugFacts'] as const;

/** Tope de fotos en la galería: un principio activo puede tener decenas de medicamentos. */
export const MAX_FOTOS_CIMA = 8;

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** El primer campo de texto no vacío entre varias grafías, o `null`. */
function campo(fuente: Readonly<Record<string, unknown>>, ...claves: string[]): string | null {
  for (const clave of claves) {
    const valor = fuente[clave];
    if (typeof valor === 'string' && valor.trim() !== '') return valor.trim();
    if (typeof valor === 'number') return String(valor);
  }
  return null;
}

/** Una lista de textos, aceptando también objetos con `name`/`nombre`. */
function textos(fuente: Readonly<Record<string, unknown>>, ...claves: string[]): string[] {
  for (const clave of claves) {
    const valor = fuente[clave];
    if (typeof valor === 'string' && valor.trim() !== '') return [valor.trim()];
    if (!Array.isArray(valor)) continue;
    const lista = valor
      .map((item) => (esObjeto(item) ? campo(item, 'name', 'nombre') : item))
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.trim());
    if (lista.length > 0) return [...new Set(lista)];
  }
  return [];
}

function objetos(
  fuente: Readonly<Record<string, unknown>>,
  ...claves: string[]
): Readonly<Record<string, unknown>>[] {
  for (const clave of claves) {
    const valor = fuente[clave];
    if (Array.isArray(valor)) return valor.filter(esObjeto);
  }
  return [];
}

function fecha(valor: string | null): string | null {
  return valor === null ? null : valor.slice(0, 10);
}

const ROTULO_DE_FOTO: Readonly<Record<string, string>> = {
  materialas: 'Envase',
  formafarmac: 'Forma farmacéutica',
  packaging: 'Envase',
  'dosage-form': 'Forma farmacéutica',
};

function seccionesDe(fuente: Readonly<Record<string, unknown>>): CimaSection[] {
  const crudas = fuente['sections'] ?? fuente['secciones'];
  const porNumero = new Map<string, { texto: string; titulo: string | null }>();
  if (Array.isArray(crudas)) {
    for (const item of crudas.filter(esObjeto)) {
      const numero = campo(item, 'section', 'number', 'seccion', 'epigrafe');
      const texto = campo(item, 'text', 'texto', 'content', 'contenido');
      if (numero !== null && texto !== null) {
        porNumero.set(numero, { texto, titulo: campo(item, 'title', 'titulo') });
      }
    }
  } else if (esObjeto(crudas)) {
    for (const seccion of SECCIONES_DE_FICHA) {
      const texto = campo(crudas, seccion.number, ...seccion.keys);
      if (texto !== null) porNumero.set(seccion.number, { texto, titulo: null });
    }
  }
  return SECCIONES_DE_FICHA.flatMap((seccion) => {
    const hallada = porNumero.get(seccion.number);
    return hallada === undefined
      ? []
      : [{ number: seccion.number, title: hallada.titulo ?? seccion.title, text: hallada.texto }];
  });
}

function presentacionesDe(fuente: Readonly<Record<string, unknown>>): CimaPresentation[] {
  return objetos(fuente, 'presentations', 'presentaciones').flatMap((item) => {
    const nombre = campo(item, 'name', 'nombre');
    return nombre === null
      ? []
      : [{ name: nombre, nationalCode: campo(item, 'cn', 'nationalCode', 'codigoNacional') }];
  });
}

function fotosDe(
  fuente: Readonly<Record<string, unknown>>,
  productName: string | null,
): CimaPhoto[] {
  return objetos(fuente, 'photos', 'fotos').flatMap((item) => {
    const url = campo(item, 'url');
    if (url === null) return [];
    const tipo = campo(item, 'kind', 'type', 'tipo') ?? '';
    return [
      {
        url,
        thumbUrl: campo(item, 'thumbUrl', 'thumbnailUrl') ?? url,
        caption: campo(item, 'caption') ?? ROTULO_DE_FOTO[tipo] ?? 'Foto',
        productName,
      },
    ];
  });
}

/**
 * La ficha de CIMA de un término, o `null` si no la tiene — o si le falta el
 * número de registro, sin el cual no hay cita posible y nada se muestra.
 *
 * @param termino - La ficha ya leída del glosario.
 * @returns La ficha de CIMA, o `null`.
 */
export function cimaFactsFrom(termino: GlossaryTermDetail): CimaDrugFacts | null {
  const propiedades = termino.properties ?? {};
  const cruda = CODIGOS_DE_FICHA_CIMA.map((codigo) => propiedades[codigo]).find(esObjeto);
  if (cruda === undefined) return null;

  const referencia = esObjeto(cruda['referenceProduct']) ? cruda['referenceProduct'] : null;
  const secciones = objetos(cruda, 'sections', 'secciones');
  const primeraSeccion = secciones[0] ?? null;
  const registro =
    (referencia === null ? null : campo(referencia, 'nregistro')) ??
    (primeraSeccion === null ? null : campo(primeraSeccion, 'nregistro')) ??
    campo(cruda, 'nregistro', 'registrationNumber', 'registration_number');
  if (registro === null) return null;

  const productosCrudos = objetos(cruda, 'products', 'productos');
  const products: CimaProduct[] =
    productosCrudos.length > 0
      ? productosCrudos.flatMap((item) => {
          const nombre = campo(item, 'name', 'nombre');
          return nombre === null
            ? []
            : [
                {
                  name: nombre,
                  registrationNumber: campo(item, 'nregistro'),
                  holder: campo(item, 'holder', 'labtitular', 'titular'),
                  url: campo(item, 'cimaUrl', 'url'),
                  presentations: presentacionesDe(item),
                },
              ];
        })
      : presentacionesDe(cruda).length > 0
        ? [
            {
              name: campo(cruda, 'name', 'nombre') ?? termino.display,
              registrationNumber: registro,
              holder: campo(cruda, 'labHolder', 'holder', 'titular'),
              url: null,
              presentations: presentacionesDe(cruda),
            },
          ]
        : [];

  const productoDeReferencia = productosCrudos.find((item) => campo(item, 'nregistro') === registro);
  const photos = [
    ...fotosDe(cruda, campo(cruda, 'name', 'nombre')),
    ...productosCrudos.flatMap((item) => fotosDe(item, campo(item, 'name', 'nombre'))),
  ].slice(0, MAX_FOTOS_CIMA);

  const activeIngredients = [
    ...new Set([
      ...textos(cruda, 'activeIngredients', 'principiosActivos', 'active_ingredients'),
      ...productosCrudos.flatMap((item) => textos(item, 'activeIngredients')),
    ]),
  ];

  return {
    registrationNumber: registro,
    referenceName:
      (referencia === null ? null : campo(referencia, 'name')) ??
      (primeraSeccion === null ? null : campo(primeraSeccion, 'productName')) ??
      campo(cruda, 'name', 'nombre'),
    activeIngredients,
    dosageForms: textos(cruda, 'dosageForms', 'pharmaceuticalForms', 'formas', 'dosageForm'),
    routes: textos(cruda, 'routes', 'vias', 'route'),
    atc: objetos(cruda, 'atc', 'atcs').flatMap((item) => {
      const codigo = campo(item, 'code', 'codigo');
      return codigo === null ? [] : [{ code: codigo, name: campo(item, 'name', 'nombre') }];
    }),
    products,
    photos,
    sections: seccionesDe(cruda),
    retrievedAt: fecha(
      (primeraSeccion === null ? null : campo(primeraSeccion, 'retrievedAt')) ??
        campo(cruda, 'retrievedAt', 'sourceRetrievedAt') ??
        valorDeTexto(propiedades, 'source_retrieved_at') ??
        null,
    ),
    documentDate: fecha(
      (primeraSeccion === null ? null : campo(primeraSeccion, 'documentDate')) ??
        (productoDeReferencia === undefined
          ? null
          : campo(productoDeReferencia, 'fichaTecnicaDate')),
    ),
    sourceUrl:
      (primeraSeccion === null ? null : campo(primeraSeccion, 'documentUrl')) ??
      (productoDeReferencia === undefined
        ? null
        : campo(productoDeReferencia, 'fichaTecnicaUrl')) ??
      campo(cruda, 'fichaTecnicaUrl', 'sourceUrl') ??
      valorDeTexto(propiedades, 'source_url') ??
      null,
  };
}
