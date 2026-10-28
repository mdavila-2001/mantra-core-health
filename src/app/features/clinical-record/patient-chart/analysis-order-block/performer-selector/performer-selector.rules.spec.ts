import {
  DEFAULT_PERFORMER_CHOICE,
  DEFAULT_PERFORMER_SELECTION,
  isPerformerChoiceComplete,
  isProcedureCategoryCode,
  ownSiteOptions,
  performerFieldsOf,
  performerModeOfCode,
  performerSelectionConceptsOf,
  type OwnAssignment,
  type PerformerSelectionConcepts,
  type PerformerSite,
} from './performer-selector.rules';

const CONCEPTOS: PerformerSelectionConcepts = {
  SELF: 'c-self',
  ORGANIZATION: 'c-org',
  PATIENT_CHOICE: 'c-patient',
};

const sede = (id: string): PerformerSite => ({ practiceSiteId: id, name: `Sede ${id}`, addressText: null });
const vinculacion = (
  practiceSiteId: string | null,
  serviceConceptId: string | null,
  statusCode = 'ROLE_ASG_ACTIVE',
): OwnAssignment => ({ practiceSiteId, serviceConceptId, statusCode });

describe('performer-selector.rules', () => {
  describe('valor por defecto', () => {
    it('es PATIENT_CHOICE', () => {
      expect(DEFAULT_PERFORMER_SELECTION).toBe('PATIENT_CHOICE');
      expect(DEFAULT_PERFORMER_CHOICE).toEqual({ mode: 'PATIENT_CHOICE', siteId: null });
    });
  });

  describe('performerFieldsOf', () => {
    it('PATIENT_CHOICE no lleva médico ni sede', () => {
      const campos = performerFieldsOf(DEFAULT_PERFORMER_CHOICE, 'doc-1', CONCEPTOS);
      expect(campos).toEqual({ performerSelectionConceptId: 'c-patient' });
      expect(campos).not.toHaveProperty('performerPractitionerProfileId');
      expect(campos).not.toHaveProperty('suggestedPracticeSiteId');
    });

    it('PATIENT_CHOICE ignora una sede que haya quedado de otro modo', () => {
      const campos = performerFieldsOf({ mode: 'PATIENT_CHOICE', siteId: 's-1' }, 'doc-1', CONCEPTOS);
      expect(campos).toEqual({ performerSelectionConceptId: 'c-patient' });
    });

    it('PATIENT_CHOICE sin conjunto leído omite todo (la API lo toma como PATIENT_CHOICE)', () => {
      expect(performerFieldsOf(DEFAULT_PERFORMER_CHOICE, 'doc-1', null)).toEqual({});
    });

    it('SELF lleva el concepto SELF, el solicitante y la sede', () => {
      expect(performerFieldsOf({ mode: 'SELF', siteId: 's-1' }, 'doc-1', CONCEPTOS)).toEqual({
        performerSelectionConceptId: 'c-self',
        performerPractitionerProfileId: 'doc-1',
        suggestedPracticeSiteId: 's-1',
      });
    });

    it('ORGANIZATION lleva la sede y no el médico', () => {
      const campos = performerFieldsOf({ mode: 'ORGANIZATION', siteId: 's-2' }, 'doc-1', CONCEPTOS);
      expect(campos).toEqual({
        performerSelectionConceptId: 'c-org',
        suggestedPracticeSiteId: 's-2',
      });
      expect(campos).not.toHaveProperty('performerPractitionerProfileId');
    });

    it('SELF y ORGANIZATION sin sede no se pueden enviar', () => {
      expect(performerFieldsOf({ mode: 'SELF', siteId: null }, 'doc-1', CONCEPTOS)).toBeNull();
      expect(performerFieldsOf({ mode: 'ORGANIZATION', siteId: null }, 'doc-1', CONCEPTOS)).toBeNull();
    });

    it('SELF sin médico que pide, o cualquier recomendación sin conjunto, no se puede enviar', () => {
      expect(performerFieldsOf({ mode: 'SELF', siteId: 's-1' }, null, CONCEPTOS)).toBeNull();
      expect(performerFieldsOf({ mode: 'ORGANIZATION', siteId: 's-1' }, 'doc-1', null)).toBeNull();
    });

    it('ningún modo produce performerTenantId', () => {
      const elecciones = [
        DEFAULT_PERFORMER_CHOICE,
        { mode: 'SELF', siteId: 's-1' },
        { mode: 'ORGANIZATION', siteId: 's-1' },
      ] as const;
      for (const eleccion of elecciones) {
        expect(performerFieldsOf(eleccion, 'doc-1', CONCEPTOS)).not.toHaveProperty('performerTenantId');
      }
    });
  });

  describe('ownSiteOptions', () => {
    const busqueda = [sede('s-3'), sede('s-1'), sede('s-2')];

    it('cruza vinculaciones ACTIVE del procedimiento con la búsqueda, en el orden de la búsqueda', () => {
      const filas = [vinculacion('s-1', 'p-1'), vinculacion('s-3', 'p-1'), vinculacion('s-2', 'p-1', 'ROLE_ASG_PENDING')];
      expect(ownSiteOptions(filas, busqueda, 'p-1').map((s) => s.practiceSiteId)).toEqual(['s-3', 's-1']);
    });

    it('una fila ACTIVE de otro procedimiento no cuenta', () => {
      const filas = [vinculacion('s-1', 'p-otro')];
      expect(ownSiteOptions(filas, busqueda, 'p-1')).toEqual([]);
    });

    it('una sede propia que la búsqueda no publica no aparece', () => {
      const filas = [vinculacion('s-9', 'p-1')];
      expect(ownSiteOptions(filas, busqueda, 'p-1')).toEqual([]);
    });

    it('acepta el estado con o sin prefijo de módulo y descarta filas sin sede', () => {
      const filas = [
        vinculacion('s-1', 'p-1', 'ROLE_ASG_ACTIVE'),
        vinculacion('s-2', 'p-1', 'practice:ROLE_ASG_ACTIVE'),
        vinculacion(null, 'p-1'),
      ];
      expect(ownSiteOptions(filas, busqueda, 'p-1').map((s) => s.practiceSiteId)).toEqual(['s-1', 's-2']);
    });

    it('una afiliación antigua, sin estado ni procedimiento, no cuenta', () => {
      expect(ownSiteOptions([vinculacion('s-1', null, '')], busqueda, 'p-1')).toEqual([]);
    });

    it('sin intersección devuelve vacío, para deshabilitar la opción', () => {
      expect(ownSiteOptions([], busqueda, 'p-1')).toEqual([]);
      expect(ownSiteOptions([vinculacion('s-1', 'p-1', 'ROLE_ASG_ENDED')], busqueda, 'p-1')).toEqual([]);
    });

    it('no repite una sede con dos vinculaciones', () => {
      const filas = [vinculacion('s-1', 'p-1'), vinculacion('s-1', 'p-1')];
      expect(ownSiteOptions(filas, busqueda, 'p-1')).toHaveLength(1);
    });
  });

  describe('categoría procedimiento', () => {
    it.each(['SRQ-PROCEDURE', 'SR_PROCEDURE', 'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE'])(
      'reconoce %s',
      (codigo) => expect(isProcedureCategoryCode(codigo)).toBe(true),
    );

    it('reconoce el código simple aunque venga con otro prefijo de módulo', () => {
      expect(isProcedureCategoryCode('clinical:SR_PROCEDURE')).toBe(true);
      expect(isProcedureCategoryCode('diagnostics:SERVICE_REQUEST_CATEGORY_PROCEDURE')).toBe(true);
    });

    it.each(['SR_LAB', 'SRQ-IMAGING', 'diagnostics:SERVICE_REQUEST_CATEGORY_IMAGING', '', null, undefined])(
      'no reconoce %s',
      (codigo) => expect(isProcedureCategoryCode(codigo)).toBe(false),
    );
  });

  describe('conceptos del conjunto expandido', () => {
    it.each([
      ['SR_PERF_SELF', 'SELF'],
      ['clinical:SERVICE_REQUEST_PERFORMER_SELF', 'SELF'],
      ['clinical:SERVICE_REQUEST_PERFORMER_ORGANIZATION', 'ORGANIZATION'],
      ['clinical:SERVICE_REQUEST_PERFORMER_PATIENT_CHOICE', 'PATIENT_CHOICE'],
      ['clinical:SR_PERF_ORGANIZATION', 'ORGANIZATION'],
      ['SR_PERF_PATIENT_CHOICE', 'PATIENT_CHOICE'],
      ['PATIENT_CHOICE', 'PATIENT_CHOICE'],
      ['SR_PERF_OTHER', null],
    ])('%s → %s', (codigo, modo) => expect(performerModeOfCode(codigo)).toBe(modo));

    it('arma los tres uuids con los códigos literales que devuelve la API', () => {
      expect(
        performerSelectionConceptsOf([
          { conceptId: 'u-3', code: 'clinical:SERVICE_REQUEST_PERFORMER_PATIENT_CHOICE' },
          { conceptId: 'u-1', code: 'clinical:SERVICE_REQUEST_PERFORMER_SELF' },
          { conceptId: 'u-2', code: 'clinical:SERVICE_REQUEST_PERFORMER_ORGANIZATION' },
        ]),
      ).toEqual({ SELF: 'u-1', ORGANIZATION: 'u-2', PATIENT_CHOICE: 'u-3' });
    });

    it('arma los tres uuids o devuelve null si falta alguno', () => {
      const opciones = [
        { conceptId: 'u-1', code: 'SR_PERF_SELF' },
        { conceptId: 'u-2', code: 'clinical:SR_PERF_ORGANIZATION' },
        { conceptId: 'u-3', code: 'SR_PERF_PATIENT_CHOICE' },
      ];
      expect(performerSelectionConceptsOf(opciones)).toEqual({
        SELF: 'u-1',
        ORGANIZATION: 'u-2',
        PATIENT_CHOICE: 'u-3',
      });
      expect(performerSelectionConceptsOf(opciones.slice(0, 2))).toBeNull();
    });
  });

  describe('isPerformerChoiceComplete', () => {
    it('los modos con sede la exigen', () => {
      expect(isPerformerChoiceComplete(DEFAULT_PERFORMER_CHOICE)).toBe(true);
      expect(isPerformerChoiceComplete({ mode: 'SELF', siteId: null })).toBe(false);
      expect(isPerformerChoiceComplete({ mode: 'ORGANIZATION', siteId: 's-1' })).toBe(true);
    });
  });
});
