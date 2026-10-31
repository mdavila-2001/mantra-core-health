import { senalDePrivacidadActiva } from './privacy-signal';

describe('senalDePrivacidadActiva', () => {
  describe('válido', () => {
    it.each([
      ['DNT del navegador en «1»', { navigator: { doNotTrack: '1' } }],
      ['DNT del navegador en «yes»', { navigator: { doNotTrack: 'yes' } }],
      ['DNT de la ventana (Safari antiguo)', { doNotTrack: '1' }],
      ['DNT de IE/Edge antiguo', { navigator: { msDoNotTrack: '1' } }],
      ['Global Privacy Control', { navigator: { globalPrivacyControl: true } }],
      ['DNT y GPC juntos', { navigator: { doNotTrack: '1', globalPrivacyControl: true } }],
    ])('%s → activa', (_nombre, ventana) => {
      expect(senalDePrivacidadActiva(ventana)).toBe(true);
    });
  });

  describe('límite', () => {
    it.each([
      ['DNT en «0»', { navigator: { doNotTrack: '0' } }],
      ['DNT sin definir (null)', { navigator: { doNotTrack: null } }],
      ['«unspecified»', { navigator: { doNotTrack: 'unspecified' } }],
      ['GPC en false', { navigator: { globalPrivacyControl: false } }],
      ['navegador sin ninguna señal', { navigator: {} }],
    ])('%s → inactiva', (_nombre, ventana) => {
      expect(senalDePrivacidadActiva(ventana)).toBe(false);
    });
  });

  describe('inválido', () => {
    it('sin ventana (servidor) no hay señal que leer', () => {
      expect(senalDePrivacidadActiva(null)).toBe(false);
      expect(senalDePrivacidadActiva(undefined)).toBe(false);
    });

    it('un GPC que no es el booleano true no cuenta (cadena «true»)', () => {
      expect(
        senalDePrivacidadActiva({ navigator: { globalPrivacyControl: 'true' as unknown as boolean } }),
      ).toBe(false);
    });
  });
});
