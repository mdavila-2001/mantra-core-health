import { iniciarSesion } from '../../support/helpers/auth';
import { SideNav } from '../../support/components/side-nav.component';
import { Tabla } from '../../support/components/data-table.component';

/**
 * El glosario reconstruido: diccionario médico por categorías en grilla, con
 * ícono y conteo, y tabla de resultados al buscar o al entrar a una categoría.
 *
 * ## Por qué acá la API va interceptada desde el navegador, y no por el arnés
 *
 * El arnés de Node (`cypress/harness/api-simulada.ts`) simula sólo lo que la
 * suite funcional ya necesitaba — autenticación y el directorio público — y
 * hace bien en no simular más. La terminología es un endpoint nuevo para esta
 * suite: agregarlo al arnés significaría escribir un servidor de mentira con
 * filtro por texto y por categoría para un solo spec. `cy.intercept` cubre
 * exactamente esa superficie sin tocar el arnés compartido — el mismo criterio
 * que ya documenta `support/recorrido/api-total.ts` para el recorrido visual.
 *
 * La sesión, en cambio, sí pasa por el arnés y por `iniciarSesion()`: es la
 * mecánica de siempre y no tiene nada propio que este spec necesite fingir.
 */

const CATEGORIA_ENFERMEDADES = {
  id: 'vs-disease',
  internalCode: 'glossary-category-disease',
  name: 'Enfermedades',
  description: 'Diagnósticos y condiciones clínicas.',
  defaultVersionId: 'ver-disease',
  memberCount: 2,
};

const CATEGORIA_ANATOMIA = {
  id: 'vs-anatomy',
  internalCode: 'glossary-category-anatomy',
  name: 'Anatomía',
  description: 'Estructuras del cuerpo humano.',
  defaultVersionId: 'ver-anatomy',
  memberCount: 1,
};

const HIPERTENSION_ID = 'c-hipertension';
const INSUFICIENCIA_ID = 'c-insuficiencia';
const ARTERIA_ID = 'c-arteria';

/** Filas de la tabla — la forma que trae `GET /terminology/concepts`. */
const TERMINOS = [
  {
    conceptId: HIPERTENSION_ID,
    code: 'I10',
    display: 'Hipertensión esencial',
    slug: 'hipertension-esencial',
    translated: true,
    category: { internalCode: 'glossary-category-disease', name: 'Enfermedades' },
    shortDefinition: 'Presión arterial persistentemente alta.',
    tags: ['Cardiovascular', 'Crónico'],
    relationsCount: 2,
    status: 'active',
    // Sólo para filtrar en este simulador de prueba — no forma parte del contrato.
    valueSetId: 'vs-disease',
  },
  {
    conceptId: INSUFICIENCIA_ID,
    code: 'I50',
    display: 'Insuficiencia cardíaca',
    slug: 'insuficiencia-cardiaca',
    translated: true,
    category: { internalCode: 'glossary-category-disease', name: 'Enfermedades' },
    shortDefinition: 'El corazón no bombea la sangre con la fuerza necesaria.',
    tags: ['Cardiovascular'],
    relationsCount: 1,
    status: 'active',
    valueSetId: 'vs-disease',
  },
  {
    conceptId: ARTERIA_ID,
    code: 'ARTERIA',
    display: 'Arteria',
    slug: 'arteria',
    translated: true,
    category: { internalCode: 'glossary-category-anatomy', name: 'Anatomía' },
    shortDefinition: 'Vaso sanguíneo que lleva la sangre desde el corazón.',
    tags: [],
    relationsCount: 1,
    status: 'active',
    valueSetId: 'vs-anatomy',
  },
];

/** Fichas — la forma que trae `GET /terminology/concepts/:id`. */
const FICHAS: Record<string, unknown> = {
  [HIPERTENSION_ID]: {
    conceptId: HIPERTENSION_ID,
    code: 'I10',
    display: 'Hipertensión esencial',
    slug: 'hipertension-esencial',
    translated: true,
    codeSystemVersionId: 'csv-icd10',
    valueSets: [{ id: 'vs-disease', internalCode: 'glossary-category-disease', name: 'Enfermedades' }],
    synonyms: [{ value: 'Hypertensive disorder', language: 'EN', preferred: true }],
    category: { valueSetId: 'vs-disease', internalCode: 'glossary-category-disease', name: 'Enfermedades' },
    tags: [{ valueSetId: 'vs-tag-cv', internalCode: 'glossary-tag-cardiovascular', name: 'Cardiovascular' }],
    clinicalDefinition: {
      text: 'Presión arterial persistentemente alta, sin una causa identificable detrás.',
      translated: true,
    },
    plainSummary: {
      text: 'La presión de la sangre está más alta de lo normal, casi siempre sin síntomas.',
      translated: true,
    },
    relations: [
      {
        type: 'DISEASE',
        conceptId: INSUFICIENCIA_ID,
        slug: 'insuficiencia-cardiaca',
        display: 'Insuficiencia cardíaca',
      },
      { type: 'ANATOMY', conceptId: ARTERIA_ID, slug: 'arteria', display: 'Arteria' },
    ],
  },
  [INSUFICIENCIA_ID]: {
    conceptId: INSUFICIENCIA_ID,
    code: 'I50',
    display: 'Insuficiencia cardíaca',
    slug: 'insuficiencia-cardiaca',
    translated: true,
    codeSystemVersionId: 'csv-icd10',
    valueSets: [{ id: 'vs-disease', internalCode: 'glossary-category-disease', name: 'Enfermedades' }],
    synonyms: [],
    category: { valueSetId: 'vs-disease', internalCode: 'glossary-category-disease', name: 'Enfermedades' },
    tags: [{ valueSetId: 'vs-tag-cv', internalCode: 'glossary-tag-cardiovascular', name: 'Cardiovascular' }],
    clinicalDefinition: {
      text: 'El corazón no bombea la sangre con la fuerza necesaria para cubrir las necesidades del cuerpo.',
      translated: true,
    },
    plainSummary: { text: 'Al corazón le cuesta bombear toda la sangre que hace falta.', translated: true },
    relations: [
      { type: 'DISEASE', conceptId: HIPERTENSION_ID, slug: 'hipertension-esencial', display: 'Hipertensión esencial' },
    ],
  },
  [ARTERIA_ID]: {
    conceptId: ARTERIA_ID,
    code: 'ARTERIA',
    display: 'Arteria',
    slug: 'arteria',
    translated: true,
    codeSystemVersionId: 'csv-anatomy',
    valueSets: [{ id: 'vs-anatomy', internalCode: 'glossary-category-anatomy', name: 'Anatomía' }],
    synonyms: [],
    category: { valueSetId: 'vs-anatomy', internalCode: 'glossary-category-anatomy', name: 'Anatomía' },
    tags: [],
    clinicalDefinition: { text: 'Vaso sanguíneo que lleva la sangre desde el corazón hacia los tejidos.', translated: true },
    plainSummary: { text: 'Un conducto por el que viaja la sangre que sale del corazón.', translated: true },
    relations: [
      {
        type: 'RELATED_TERM',
        conceptId: HIPERTENSION_ID,
        slug: 'hipertension-esencial',
        display: 'Hipertensión esencial',
      },
    ],
  },
};

function interceptarTerminologia(): void {
  cy.intercept('GET', '**/terminology/value-sets**', {
    statusCode: 200,
    body: {
      items: [CATEGORIA_ENFERMEDADES, CATEGORIA_ANATOMIA],
      count: 2,
      limit: 200,
      nextCursor: null,
    },
  }).as('categorias');

  cy.intercept('GET', '**/terminology/concepts**', (peticion) => {
    const url = new URL(peticion.url);
    const segmentos = url.pathname.split('/').filter(Boolean);
    const esFicha = segmentos.at(-1) !== 'concepts';

    if (esFicha) {
      const conceptId = segmentos.at(-1) ?? '';
      const ficha = FICHAS[conceptId];
      if (ficha === undefined) {
        peticion.reply({ statusCode: 404, body: { code: 'NOT_FOUND', message: 'Concepto no encontrado' } });
        return;
      }
      peticion.reply({ statusCode: 200, body: ficha });
      return;
    }

    const params = url.searchParams;
    const valueSetId = params.get('valueSetId');
    const texto = (params.get('q') ?? '').trim().toLowerCase();

    let items = TERMINOS;
    if (valueSetId !== null) {
      items = items.filter((t) => t.valueSetId === valueSetId);
    }
    if (texto !== '') {
      items = items.filter((t) => t.display.toLowerCase().includes(texto));
    }

    peticion.reply({ statusCode: 200, body: { items, count: items.length, limit: 200 } });
  }).as('conceptos');
}

describe('Regresión · glosario médico', () => {
  beforeEach(() => {
    interceptarTerminologia();
    iniciarSesion();
    SideNav.irA('/glossary');
  });

  it('grilla → categoría → término: se ven sus relaciones, etiquetas y definiciones', () => {
    cy.contains('h1', 'Glosario').should('be.visible');

    // La landing es la grilla, con ícono y conteo — no una tabla.
    cy.get('app-data-table').should('not.exist');
    cy.contains('.glosario__categoria', 'Enfermedades').within(() => {
      cy.get('app-glossary-category-icon').should('exist');
      cy.contains('2').should('be.visible');
    });

    cy.contains('.glosario__categoria', 'Enfermedades').click();

    // Entrar a una categoría cambia a tabla, con sus términos.
    Tabla.esperarCargada();
    Tabla.cantidadDeFilas().should('eq', 2);
    cy.contains('[data-testid="tabla-fila"]', 'Hipertensión esencial').should('be.visible');
    cy.contains('[data-testid="tabla-fila"]', 'Insuficiencia cardíaca').should('be.visible');
    // La categoría ajena no se coló en esta tabla.
    cy.contains('[data-testid="tabla-fila"]', 'Arteria').should('not.exist');

    cy.contains('[data-testid="tabla-fila"] a', 'Hipertensión esencial').click();

    // La ficha: definición clínica, resumen llano, etiquetas y relaciones
    // tipadas, cada una enlazando a su propio término.
    cy.contains('h1', 'Hipertensión esencial').should('be.visible');
    cy.contains('Presión arterial persistentemente alta').should('be.visible');
    cy.contains('La presión de la sangre está más alta de lo normal').should('be.visible');
    cy.contains('Cardiovascular').should('be.visible');
    cy.contains('Enfermedades relacionadas').should('be.visible');
    cy.contains('Anatomía relacionada').should('be.visible');

    cy.contains('a', 'Insuficiencia cardíaca').click();
    cy.contains('h1', 'Insuficiencia cardíaca').should('be.visible');
    cy.url().should('include', `/glossary/${INSUFICIENCIA_ID}`);
  });

  it('grilla → buscar → tabla de resultados → abrir un resultado', () => {
    cy.get('app-search-field input').type('hiper');

    Tabla.esperarCargada();
    Tabla.cantidadDeFilas().should('eq', 1);
    cy.contains('[data-testid="tabla-fila"]', 'Hipertensión esencial').should('be.visible');
    cy.url().should('include', 'q=hiper');

    // Volver a la grilla limpia la búsqueda.
    cy.contains('button', 'Volver a las categorías').click();
    cy.get('app-data-table').should('not.exist');
    cy.get('.glosario__categoria').should('have.length', 2);

    cy.get('app-search-field input').type('arteria');
    Tabla.esperarCargada();
    cy.contains('[data-testid="tabla-fila"] a', 'Arteria').click();

    cy.contains('h1', 'Arteria').should('be.visible');
    cy.contains('Un conducto por el que viaja la sangre').should('be.visible');
  });
});
