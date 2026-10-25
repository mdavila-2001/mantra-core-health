import { orderPerformerText } from './order-performer-text';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('orderPerformerText', () => {
  it('PATIENT_CHOICE: puede elegir dónde hacérselo, sin aviso ni sede', () => {
    expect(orderPerformerText('PATIENT_CHOICE', null)).toEqual({
      mode: 'Puede elegir dónde hacérselo',
      recommendation: null,
      site: null,
    });
  });

  it('ORGANIZATION: su médico sugirió un centro, y es una recomendación', () => {
    const texto = orderPerformerText('ORGANIZATION', 'Centro Médico Sur');

    expect(texto.mode).toBe('Su médico sugirió un centro');
    expect(texto.recommendation).toBe('Es una recomendación: puede elegir otro centro.');
    expect(texto.site).toBe('Sede sugerida: Centro Médico Sur');
  });

  it('SELF: su médico se ofreció a hacerlo, y es una recomendación', () => {
    const texto = orderPerformerText('SELF', 'Centro Médico Norte');

    expect(texto.mode).toBe('Su médico se ofreció a hacerlo');
    expect(texto.recommendation).toBe('Es una recomendación: puede elegir otro centro.');
    expect(texto.site).toBe('Sede sugerida: Centro Médico Norte');
  });

  it('sin nombre de sede no pinta sede (nunca un uuid de reemplazo)', () => {
    expect(orderPerformerText('ORGANIZATION', null).site).toBeNull();
    expect(orderPerformerText('SELF', '  ').site).toBeNull();
  });

  it('con PATIENT_CHOICE no pinta sede aunque llegue un nombre', () => {
    expect(orderPerformerText('PATIENT_CHOICE', 'Centro Médico Sur').site).toBeNull();
  });

  it.each(['SELF', 'ORGANIZATION', 'PATIENT_CHOICE'] as const)('%s no contiene un uuid', (modo) => {
    const t = orderPerformerText(modo, 'Centro Médico Sur');
    expect(UUID.test(`${t.mode} ${t.recommendation ?? ''} ${t.site ?? ''}`)).toBe(false);
  });
});
