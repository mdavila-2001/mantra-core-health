import { PROFESIONALES } from './core/mock/fixtures/people';
import { perfilProfesionalDe } from './core/mock/handlers/profiles.handlers';
import { esTelefonoCompleto } from './shared/components/molecules/phone-input/phone-input.countries';

/**
 * Los teléfonos que sirve el perfil profesional.
 *
 * `esTelefonoCompleto` pide «+591 » y OCHO dígitos SEGUIDOS. La maqueta servía
 * el fijo del trabajo como `'+591 3 3456789'` —con un espacio adentro— y eso
 * tenía una consecuencia que no se veía mirando el fixture: el editor del
 * médico nacía con ese control inválido y **se negaba a guardar cualquier
 * cosa**, aunque nadie hubiera tocado ese campo. Se descubrió el 19/09/2026
 * intentando cargar un NIT.
 */
describe('el perfil profesional de la maqueta sirve teléfonos que el editor acepta', () => {
  it('los tres teléfonos pasan `esTelefonoCompleto`', () => {
    const perfil = perfilProfesionalDe(PROFESIONALES[0]!) as unknown as Record<string, string>;

    for (const campo of ['phone', 'mobilePhone', 'workMobilePhone', 'workLandline']) {
      expect(esTelefonoCompleto(perfil[campo] ?? ''), `${campo}: «${perfil[campo]}»`).toBe(true);
    }
  });

  it('el NIT y la razón social viajan en el perfil, como en el del paciente', () => {
    const perfil = perfilProfesionalDe(PROFESIONALES[0]!) as unknown as Record<string, string>;

    expect(perfil['taxId']).toBe(`${PROFESIONALES[0]!.nationalId}011`);
    expect(perfil['taxHolderName']).toBe(PROFESIONALES[0]!.displayName);
  });
});
