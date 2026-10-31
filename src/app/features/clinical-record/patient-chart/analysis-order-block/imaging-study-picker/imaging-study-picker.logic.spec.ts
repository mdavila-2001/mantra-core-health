import {
  allowedContrastKinds,
  allowedRegionsOf,
  buildStudyIndex,
  contrastConceptOf,
  contrastKindOf,
  defaultContrastConcept,
  describeSelection,
  filterStudies,
  findStudy,
  initialSelection,
  isSelectionValid,
  modalityControl,
  needsOwnLaterality,
  normalizeText,
  queryTokens,
  selectionIssues,
  serializeImaging,
  shortModalityCode,
  withContrast,
  withLaterality,
  withRegion,
  type ImagingLookups,
  type ImagingSelection,
} from './imaging-study-picker.logic';
import {
  bigStudies,
  CONTRAST,
  ECO_TORACOCENTESIS,
  LATERALITY_CONCEPTS,
  MODALITIES,
  REGION_CONCEPTS,
  REGIONS,
  RM_TORAX,
  RX_MANO,
  RX_TORAX,
  STUDIES,
  TC_CRANEO,
} from './imaging-study-picker.fixtures';

const LOOKUPS: ImagingLookups = {
  modalities: MODALITIES,
  regionConceptIds: REGION_CONCEPTS,
  lateralityConceptIds: LATERALITY_CONCEPTS,
};
const CTX = { regions: REGIONS, contrastOptions: CONTRAST };
const mano = (over: Partial<ImagingSelection> = {}): ImagingSelection => ({
  ...initialSelection(RX_MANO, CONTRAST),
  ...over,
});

describe('imaging-study-picker.logic', () => {
  describe('modalityControl', () => {
    it('segmentado hasta 6 opciones, select desde 7', () => {
      expect(modalityControl(1)).toBe('segmented');
      expect(modalityControl(6)).toBe('segmented');
      expect(modalityControl(7)).toBe('select');
      expect(modalityControl(14)).toBe('select');
    });
  });

  describe('búsqueda', () => {
    it('normaliza tildes y mayúsculas', () => {
      expect(normalizeText('  Tórax ÁÉÍ ')).toBe('torax aei');
      expect(queryTokens('  TC   cráneo ')).toEqual(['tc', 'craneo']);
      expect(queryTokens('   ')).toEqual([]);
    });

    const index = buildStudyIndex(STUDIES);

    it('sin búsqueda devuelve todos; con modalidad, sólo esa', () => {
      expect(filterStudies(STUDIES, index, '', null)).toHaveLength(STUDIES.length);
      expect(filterStudies(STUDIES, index, '', 'RX').map((s) => s.conceptId)).toEqual([
        's-rx-torax',
        's-rx-mano',
        's-eco-toraco',
      ]);
    });

    it('ignora tildes: «torax» encuentra «tórax»', () => {
      expect(filterStudies(STUDIES, index, 'torax', 'RX').map((s) => s.conceptId)).toContain('s-rx-torax');
    });

    it('busca en sinónimos («TAC»), proyecciones («oblicua») y código', () => {
      expect(filterStudies(STUDIES, index, 'tac', null).map((s) => s.conceptId)).toEqual(['s-tc-craneo']);
      expect(filterStudies(STUDIES, index, 'oblicua', null).map((s) => s.conceptId)).toEqual(['s-rx-mano']);
      expect(filterStudies(STUDIES, index, 'rx mano', null).map((s) => s.conceptId)).toEqual(['s-rx-mano']);
    });

    it('exige todas las palabras y combina con la modalidad', () => {
      expect(filterStudies(STUDIES, index, 'torax lateral', null).map((s) => s.conceptId)).toEqual(['s-rx-torax']);
      expect(filterStudies(STUDIES, index, 'craneo', 'RX')).toEqual([]);
    });

    it('pone primero los que coinciden por nombre', () => {
      const a = { ...RX_MANO, conceptId: 'a', nombre: 'Otro', sinonimos: ['placa de mano'] };
      const b = { ...RX_MANO, conceptId: 'b', nombre: 'Placa de mano' };
      const hits = filterStudies([a, b], buildStudyIndex([a, b]), 'placa', null);
      expect(hits.map((s) => s.conceptId)).toEqual(['b', 'a']);
    });

    it('con 475 estudios filtra por modalidad y no pierde ninguno', () => {
      const big = bigStudies();
      const idx = buildStudyIndex(big);
      expect(filterStudies(big, idx, '', null)).toHaveLength(475);
      expect(filterStudies(big, idx, '', 'RX')).toHaveLength(Math.ceil(475 / 3));
      expect(filterStudies(big, idx, 'numero 474', null).map((s) => s.conceptId)).toEqual(['s-474']);
    });
  });

  describe('findStudy', () => {
    it('encuentra por conceptId y devuelve null sin selección o desconocido', () => {
      expect(findStudy(STUDIES, mano())).toBe(RX_MANO);
      expect(findStudy(STUDIES, null)).toBeNull();
      expect(findStudy(STUDIES, mano({ studyConceptId: 'nada' }))).toBeNull();
    });
  });

  describe('regiones permitidas', () => {
    it('la del estudio más sus descendientes', () => {
      expect(allowedRegionsOf(RX_TORAX, REGIONS)).toEqual(['TORAX', 'PULMONES', 'COSTILLAS']);
      expect(allowedRegionsOf(RX_MANO, REGIONS)).toEqual(['MANO']);
    });
    it('regionesPermitidas del catálogo anula el árbol y siempre incluye la del estudio', () => {
      const s = { ...RX_TORAX, regionesPermitidas: ['COSTILLAS'] };
      expect(allowedRegionsOf(s, REGIONS)).toEqual(['TORAX', 'COSTILLAS']);
    });
    it('resiste ciclos y regiones fuera del catálogo', () => {
      const ciclo = [
        { codigo: 'A', nombre: 'A', padre: 'B', admite_lateralidad: false },
        { codigo: 'B', nombre: 'B', padre: 'A', admite_lateralidad: false },
      ];
      expect(allowedRegionsOf({ ...RX_TORAX, region: 'A' }, ciclo)).toEqual(['A', 'B']);
      expect(allowedRegionsOf({ ...RX_TORAX, region: 'X' }, REGIONS)).toEqual(['X']);
    });
  });

  describe('lateralidad propia', () => {
    it('sólo si el estudio la exige y la región no la ofrece', () => {
      expect(needsOwnLaterality(ECO_TORACOCENTESIS, 'PULMONES', REGIONS)).toBe(true);
      expect(needsOwnLaterality(RX_MANO, 'MANO', REGIONS)).toBe(false);
      expect(needsOwnLaterality(RX_TORAX, 'PULMONES', REGIONS)).toBe(false);
    });
  });

  describe('contraste', () => {
    it('deduce el tipo del rótulo', () => {
      expect(CONTRAST.map(contrastKindOf)).toEqual(['sin', 'con', 'sin_y_con']);
      expect(contrastKindOf({ conceptId: 'x', label: 'Con y sin contraste IV', isDefault: false })).toBe('sin_y_con');
      expect(contrastKindOf({ conceptId: 'x', label: 'Otra cosa', isDefault: false })).toBeNull();
      expect(contrastKindOf({ conceptId: 'x', label: 'Otra cosa', isDefault: false, kind: 'con' })).toBe('con');
    });
    it('un estudio fijo sólo admite el suyo; el opcional, los tres', () => {
      expect(allowedContrastKinds(RX_TORAX)).toEqual(['sin']);
      expect(allowedContrastKinds(TC_CRANEO)).toEqual(['sin_y_con']);
      expect(allowedContrastKinds(RM_TORAX)).toEqual(['sin', 'con', 'sin_y_con']);
    });
    it('el default es el del estudio; en el opcional, el marcado por el catálogo', () => {
      expect(defaultContrastConcept(TC_CRANEO, CONTRAST)).toBe('c-ambos');
      expect(defaultContrastConcept(RM_TORAX, CONTRAST)).toBe('c-sin');
      const otro = CONTRAST.map((o) => ({ ...o, isDefault: o.conceptId === 'c-con' }));
      expect(defaultContrastConcept(RM_TORAX, otro)).toBe('c-con');
      expect(defaultContrastConcept(RM_TORAX, [])).toBeNull();
      expect(contrastConceptOf('con', [])).toBeNull();
    });
  });

  describe('transiciones', () => {
    it('initialSelection fija modalidad, región por defecto y contraste del estudio', () => {
      expect(initialSelection(TC_CRANEO, CONTRAST)).toEqual({
        studyConceptId: 's-tc-craneo',
        modalityCode: 'TC',
        region: 'CRANEO',
        laterality: null,
        contrastConceptId: 'c-ambos',
      });
    });

    it('withRegion acepta una permitida y conserva el lado si la región lo admite', () => {
      const s = initialSelection(RX_TORAX, CONTRAST);
      const costillas = withRegion(s, { region: 'COSTILLAS', laterality: 'DER' }, RX_TORAX, REGIONS);
      expect(costillas).toMatchObject({ region: 'COSTILLAS', laterality: 'DER' });
    });
    it('withRegion descarta el lado si la región no lo admite y el estudio no lo exige', () => {
      const s = initialSelection(RX_TORAX, CONTRAST);
      expect(withRegion(s, { region: 'PULMONES', laterality: 'DER' }, RX_TORAX, REGIONS).laterality).toBeNull();
    });
    it('withRegion conserva el lado si el estudio lo exige aunque la región no lo ofrezca', () => {
      const s = initialSelection(ECO_TORACOCENTESIS, CONTRAST);
      expect(withRegion(s, { region: 'PULMONES', laterality: 'IZQ' }, ECO_TORACOCENTESIS, REGIONS).laterality).toBe('IZQ');
    });
    it('withRegion ignora una región no permitida y borra con null', () => {
      const s = initialSelection(RX_MANO, CONTRAST);
      expect(withRegion(s, { region: 'CRANEO', laterality: null }, RX_MANO, REGIONS)).toBe(s);
      expect(withRegion(mano({ laterality: 'IZQ' }), { region: null, laterality: 'IZQ' }, RX_MANO, REGIONS)).toMatchObject({
        region: null,
        laterality: null,
      });
    });
    it('withLaterality no toca lo demás', () => {
      const s = mano();
      expect(withLaterality(s, 'BIL')).toEqual({ ...s, laterality: 'BIL' });
    });
    it('withContrast sólo cambia a un tipo permitido y existente', () => {
      const s = initialSelection(RM_TORAX, CONTRAST);
      expect(withContrast(s, 'con', RM_TORAX, CONTRAST).contrastConceptId).toBe('c-con');
      const fijo = initialSelection(RX_TORAX, CONTRAST);
      expect(withContrast(fijo, 'con', RX_TORAX, CONTRAST)).toBe(fijo);
      expect(withContrast(s, 'con', RM_TORAX, [])).toBe(s);
    });
  });

  describe('validez', () => {
    it('una selección inicial de un estudio sin lado exigido es válida', () => {
      expect(isSelectionValid(initialSelection(RX_TORAX, CONTRAST), RX_TORAX, CTX)).toBe(true);
    });
    it('un estudio que exige lado no es válido sin lado, y sí con él', () => {
      expect(selectionIssues(mano(), RX_MANO, CTX)).toEqual(['laterality-required']);
      expect(isSelectionValid(mano({ laterality: 'IZQ' }), RX_MANO, CTX)).toBe(true);
      expect(isSelectionValid(mano({ laterality: 'BIL' }), RX_MANO, CTX)).toBe(true);
    });
    it('el lado exigido en una región sin lado se satisface con el control propio', () => {
      const s = initialSelection(ECO_TORACOCENTESIS, CONTRAST);
      expect(isSelectionValid(s, ECO_TORACOCENTESIS, CTX)).toBe(false);
      expect(isSelectionValid({ ...s, laterality: 'DER' }, ECO_TORACOCENTESIS, CTX)).toBe(true);
    });
    it('lado sin región es inválido (y la región es obligatoria)', () => {
      expect(selectionIssues(mano({ region: null, laterality: 'IZQ' }), RX_MANO, CTX)).toEqual([
        'region-required',
        'laterality-needs-region',
      ]);
    });
    it('lado en una región que no lo tiene es inválido salvo que el estudio lo exija', () => {
      const s = { ...initialSelection(RX_TORAX, CONTRAST), region: 'PULMONES', laterality: 'DER' as const };
      expect(selectionIssues(s, RX_TORAX, CTX)).toEqual(['laterality-not-applicable']);
    });
    it('región fuera de las permitidas es inválida', () => {
      expect(selectionIssues(mano({ region: 'CRANEO' }), RX_MANO, CTX)).toContain('region-not-allowed');
    });
    it('contraste sin modalidad es inválido', () => {
      expect(selectionIssues(mano({ laterality: 'IZQ', modalityCode: '' }), RX_MANO, CTX)).toEqual([
        'study-mismatch',
        'contrast-needs-modality',
      ]);
    });
    it('el contraste es obligatorio si hay catálogo y debe ser uno permitido', () => {
      expect(selectionIssues(mano({ laterality: 'IZQ', contrastConceptId: null }), RX_MANO, CTX)).toEqual(['contrast-missing']);
      expect(selectionIssues(mano({ laterality: 'IZQ', contrastConceptId: 'c-con' }), RX_MANO, CTX)).toEqual([
        'contrast-not-allowed',
      ]);
      expect(selectionIssues(mano({ laterality: 'IZQ', contrastConceptId: 'raro' }), RX_MANO, CTX)).toEqual([
        'contrast-not-allowed',
      ]);
      // sin catálogo de contraste no se exige
      expect(isSelectionValid(mano({ laterality: 'IZQ', contrastConceptId: null }), RX_MANO, { regions: REGIONS })).toBe(true);
    });
    it('sin selección o sin estudio no es válida; otro estudio desalinea', () => {
      expect(isSelectionValid(null, RX_MANO)).toBe(false);
      expect(isSelectionValid(mano(), null)).toBe(false);
      expect(selectionIssues(mano({ laterality: 'IZQ' }), RX_TORAX, CTX)).toContain('study-mismatch');
    });
    it('sin contexto sólo verifica lo propio de la selección', () => {
      expect(isSelectionValid(mano({ laterality: 'IZQ' }), RX_MANO)).toBe(true);
      expect(isSelectionValid(mano(), RX_MANO)).toBe(false);
    });
  });

  describe('serializeImaging', () => {
    it('arma el renglón completo con los conceptId del padre', () => {
      expect(serializeImaging(mano({ laterality: 'IZQ' }), LOOKUPS)).toEqual({
        studyConceptId: 's-rx-mano',
        imaging: {
          modalityConceptId: 'm-rx',
          bodySiteConceptId: 'r-mano',
          lateralityConceptId: 'l-izq',
          contrastConceptId: 'c-sin',
        },
      });
    });
    it('omite (no manda undefined ni null) lo que no tiene valor', () => {
      const line = serializeImaging(mano({ region: null, laterality: null, contrastConceptId: null }), LOOKUPS)!;
      expect(Object.keys(line.imaging)).toEqual(['modalityConceptId']);
    });
    it('el lado no viaja sin región, ni con una región que no se pudo traducir', () => {
      const sinRegion = serializeImaging(mano({ region: null, laterality: 'IZQ' }), LOOKUPS)!;
      expect(sinRegion.imaging).not.toHaveProperty('lateralityConceptId');
      const sinTabla = serializeImaging(mano({ laterality: 'IZQ' }), { ...LOOKUPS, regionConceptIds: {} })!;
      expect(sinTabla.imaging).not.toHaveProperty('bodySiteConceptId');
      expect(sinTabla.imaging).not.toHaveProperty('lateralityConceptId');
    });
    it('omite el lado si su tabla no lo traduce', () => {
      const line = serializeImaging(mano({ laterality: 'UNI' }), { ...LOOKUPS, lateralityConceptIds: {} })!;
      expect(line.imaging).not.toHaveProperty('lateralityConceptId');
    });
    it('sin modalidad con conceptId no hay renglón (el contraste exige modalidad)', () => {
      expect(serializeImaging(mano({ modalityCode: 'ZZ' }), LOOKUPS)).toBeNull();
      expect(serializeImaging(mano(), { ...LOOKUPS, modalities: [{ codigo: 'RX', nombre: 'x', conceptId: '' }] })).toBeNull();
    });
  });

  describe('describeSelection', () => {
    it('«RX · Mano · Izquierda · sin contraste»', () => {
      expect(describeSelection(mano({ laterality: 'IZQ' }), REGIONS, CONTRAST)).toBe('RX · Mano · Izquierda · sin contraste');
    });
    it('no deja ver el prefijo de sistema de la modalidad (`SC_MOD_RX` se lee «RX»)', () => {
      expect(describeSelection(mano({ modalityCode: 'SC_MOD_RX', laterality: 'IZQ' }), REGIONS, CONTRAST)).toBe(
        'RX · Mano · Izquierda · sin contraste',
      );
    });
    it('omite lo que no hay', () => {
      expect(describeSelection(mano({ region: null, contrastConceptId: null }), REGIONS, CONTRAST)).toBe('RX');
      expect(describeSelection(initialSelection(TC_CRANEO, CONTRAST), REGIONS, CONTRAST)).toBe(
        'TC · Cráneo · sin y con contraste',
      );
    });
  });

  describe('shortModalityCode', () => {
    it('quita el prefijo del sistema y deja intacto lo demás', () => {
      // Defecto de la corrida con navegador (31/10/2026): el desplegable mostraba «SC_MOD_RX · Mano».
      expect(shortModalityCode('SC_MOD_RX')).toBe('RX');
      expect(shortModalityCode('SC_MOD_DXA')).toBe('DXA');
      expect(shortModalityCode('RX')).toBe('RX');
      expect(shortModalityCode('')).toBe('');
    });
  });
});
