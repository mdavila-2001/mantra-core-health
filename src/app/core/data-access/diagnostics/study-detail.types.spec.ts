import { studyDetailSummary, studyDetailConceptIds } from './study-detail.summary';
import { toWireOrder as toWire, withStudyDetail, type StudyDetailFields } from './study-detail.types';

/** La orden con sus otros campos: el tipo real los trae; acá basta con cualquiera. */
const toWireOrder = (order: StudyDetailFields & Record<string, unknown>) => toWire(order);

describe('el detalle de la orden de estudios en el cable', () => {
  describe('toWireOrder', () => {
    it('laboratorio: la muestra viaja plana y no hay `imaging`', () => {
      const wire = toWireOrder({ codeConceptId: 'c', specimenTypeConceptId: 'sp-ur' });
      expect(wire).toEqual({ codeConceptId: 'c', specimenTypeConceptId: 'sp-ur' });
      expect('imaging' in wire).toBe(false);
    });

    it('imagen: los seis campos van dentro de `imaging`, planos no', () => {
      const wire = toWireOrder({
        codeConceptId: 'c',
        modalityConceptId: 'm',
        bodySiteConceptId: 'b',
        lateralityConceptId: 'l',
        bodyStructureUberon: 'UBERON:0001',
        bodyMeshId: 'BP1',
        boneTypeConceptId: 'h',
      });
      expect(wire).toEqual({
        codeConceptId: 'c',
        imaging: {
          modalityConceptId: 'm',
          bodySiteConceptId: 'b',
          lateralityConceptId: 'l',
          bodyStructureUberon: 'UBERON:0001',
          bodyMeshId: 'BP1',
          boneTypeConceptId: 'h',
        },
      });
    });

    it('límite: sin nada del detalle no manda claves de más (forbidNonWhitelisted)', () => {
      expect(toWireOrder({ codeConceptId: 'c' })).toEqual({ codeConceptId: 'c' });
      expect(toWireOrder({ codeConceptId: 'c', specimenTypeConceptId: '', bodySiteConceptId: '' })).toEqual({ codeConceptId: 'c' });
    });
  });

  describe('withStudyDetail', () => {
    it('aplana `imaging` y quita los null: la vista siempre ve campos planos', () => {
      const out = withStudyDetail({
        id: 'o1',
        specimenTypeConceptId: null,
        imaging: { bodySiteConceptId: 'b', bodySiteDisplay: 'Mano', lateralityConceptId: null, boneTypeConceptId: 'h' },
      });
      expect(out).toEqual({ id: 'o1', bodySiteConceptId: 'b', bodySiteDisplay: 'Mano', boneTypeConceptId: 'h' });
      expect('imaging' in out).toBe(false);
    });

    it('lo plano manda sobre lo anidado (como la API al recibirlo)', () => {
      const out = withStudyDetail({ bodySiteConceptId: 'plano', imaging: { bodySiteConceptId: 'anidado' } });
      expect(out.bodySiteConceptId).toBe('plano');
    });

    it('una orden anterior, sin detalle, queda sin detalle', () => {
      expect(withStudyDetail({ id: 'o1', imaging: null })).toEqual({ id: 'o1' });
    });
  });

  describe('studyDetailSummary', () => {
    const label = (id: string): string | undefined => ({ b: 'Mano', l: 'Izquierda', m: 'Radiografía', h: 'Hueso largo', s: 'Orina' })[id];

    it('laboratorio: «Muestra: Orina»', () => {
      expect(studyDetailSummary({ specimenTypeConceptId: 's' }, label)).toBe('Muestra: Orina');
    });

    it('imagen: región, lado, modalidad y tipo de hueso, y dice si se marcó en el 3D', () => {
      expect(
        studyDetailSummary({ bodySiteConceptId: 'b', lateralityConceptId: 'l', modalityConceptId: 'm', boneTypeConceptId: 'h', bodyStructureUberon: 'UBERON:1' }, label),
      ).toBe('Región: Mano · Izquierda · Radiografía · Hueso largo · marcada en el cuerpo 3D');
    });

    it('el nombre de la API gana sobre el del catálogo, y un concepto sin nombre se omite (nunca su uuid)', () => {
      expect(studyDetailSummary({ bodySiteConceptId: 'x', bodySiteDisplay: 'Rodilla', lateralityConceptId: 'desconocido' }, label)).toBe('Región: Rodilla');
    });

    it('inválido/ausente: sin detalle no inventa nada', () => {
      expect(studyDetailSummary({}, label)).toBeNull();
      expect(studyDetailConceptIds({ bodySiteConceptId: 'b', bodySiteDisplay: 'Mano', modalityConceptId: 'm' })).toEqual(['m']);
    });
  });
});
