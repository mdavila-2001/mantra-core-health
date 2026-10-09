import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CATALOG_OUTSIDE_INSTITUTION } from './educational-institutions';
import {
  CATALOG_OUTSIDE_COUNTRY,
  UniversitiesRegistry,
  cityToChooseUniversity,
  choiceFromText,
} from './university-registry';

describe('PadronDeUniversidades', () => {
  function padron(): UniversitiesRegistry {
    return TestBed.inject(UniversitiesRegistry);
  }

  it('Bolivia está siempre, antes de pedir nada, con la lista curada', () => {
    const servicio = padron();

    expect(servicio.status()).toBe('sin-pedir');
    expect(servicio.countries()[0]?.nombre).toBe('Bolivia');
    expect(servicio.isCatalogCountry('Bolivia')).toBe(true);
    expect(servicio.isUniversityOf('Bolivia', 'Universidad Mayor de San Andrés')).toBe(true);
    // La etiqueta curada trae la sigla; el valor sigue siendo el nombre.
    expect(
      servicio
        .universitiesOf('Bolivia')
        .find((opcion) => opcion.value === 'Universidad Mayor de San Andrés')?.label,
    ).toContain('UMSA');
  });

  it('el padrón importado llega después, como árbol: cada país con las suyas', async () => {
    const servicio = padron();
    await servicio.cargar();

    expect(servicio.status()).toBe('listo');
    expect(servicio.countries().length).toBeGreaterThan(150);
    // Bolivia sigue primera y sigue siendo la curada, no la importada.
    expect(servicio.countries()[0]?.nombre).toBe('Bolivia');
    expect(servicio.countries().filter((pais) => pais.iso === 'BO')).toHaveLength(1);

    expect(servicio.isUniversityOf('Argentina', 'Universidad de Buenos Aires')).toBe(true);
    expect(servicio.isUniversityOf('Bolivia', 'Universidad de Buenos Aires')).toBe(false);
    expect(servicio.isUniversityOf('Cuba', 'Universidad de La Habana')).toBe(true);
    expect(servicio.universitiesOf('España').length).toBeGreaterThan(50);
  });

  it('la lista de universidades cierra siempre con «Otra institución…», y la de países con «Otro país…»', async () => {
    const servicio = padron();
    await servicio.cargar();

    const deArgentina = servicio.universityOptions('Argentina');
    expect(deArgentina.at(-1)?.value).toBe(CATALOG_OUTSIDE_INSTITUTION);
    expect(deArgentina.length).toBeGreaterThan(1);
    // Sin país, o con «Otro país…», la única opción es escribirla a mano.
    expect(servicio.universityOptions('')).toEqual([
      expect.objectContaining({ value: CATALOG_OUTSIDE_INSTITUTION }),
    ]);
    expect(servicio.countryOptions().at(-1)?.value).toBe(CATALOG_OUTSIDE_COUNTRY);
  });

  it('pedirlo dos veces es una sola carga', async () => {
    const servicio = padron();
    const primera = servicio.cargar();
    expect(servicio.status()).toBe('cargando');
    expect(servicio.cargar()).toBe(primera);
    await primera;
    expect(servicio.status()).toBe('listo');
  });

  it('las ciudades de una universidad son sus sedes, la principal primero', async () => {
    const servicio = padron();
    await servicio.cargar();

    expect(servicio.citiesOf('Bolivia', 'Universidad Privada de Santa Cruz de la Sierra')).toEqual(
      ['Santa Cruz de la Sierra'],
    );
    expect(servicio.citiesOf('Bolivia', 'Universidad Católica Boliviana San Pablo')).toEqual([
      'La Paz',
      'Cochabamba',
      'Santa Cruz de la Sierra',
      'Tarija',
      'Sucre',
    ]);
    // Lo que no figura en el padrón no tiene ciudad: no se inventa.
    expect(servicio.citiesOf('Bolivia', 'Universidad de la Atlántida')).toEqual([]);
    expect(servicio.citiesOf('', 'Universidad Mayor de San Simón')).toEqual([]);
  });

  describe('el filtro de salud (propietario, 04/10/2026)', () => {
    const nombres = (opciones: readonly { value: string }[]): string[] =>
      opciones.map((o) => o.value);

    it('la UPSA entra en un título de salud por Psicología, aunque no tenga Medicina', () => {
      const servicio = padron();
      const deSalud = nombres(servicio.universityOptions('Bolivia', 'salud'));
      expect(deSalud).toContain('Universidad Privada de Santa Cruz de la Sierra');
      // Sin ninguna carrera de salud no entra.
      expect(deSalud).not.toContain('Escuela Militar de Ingeniería');
      expect(deSalud).not.toContain('Universidad Real de La Paz');
    });

    it('un médico no ve la UPSA; un psicólogo sí', () => {
      const servicio = padron();
      expect(nombres(servicio.universityOptions('Bolivia', 'Medicina'))).not.toContain(
        'Universidad Privada de Santa Cruz de la Sierra',
      );
      expect(nombres(servicio.universityOptions('Bolivia', 'Psicología'))).toContain(
        'Universidad Privada de Santa Cruz de la Sierra',
      );
    });

    it('sin filtro —«Otra profesión»— se ofrecen todas', () => {
      const servicio = padron();
      expect(nombres(servicio.universityOptions('Bolivia', null))).toContain(
        'Escuela Militar de Ingeniería',
      );
    });

    it('«Otra institución…» sigue al final con cualquier filtro', () => {
      const servicio = padron();
      expect(servicio.universityOptions('Bolivia', 'Medicina').at(-1)?.value).toBe(
        CATALOG_OUTSIDE_INSTITUTION,
      );
    });
  });

  describe('ciudadAlElegirUniversidad', () => {
    it('toma la sede principal de la universidad elegida', () => {
      expect(cityToChooseUniversity('', ['Cochabamba', 'Punata'])).toBe('Cochabamba');
    });

    it('conserva la elegida si sigue siendo una de las sedes', () => {
      expect(cityToChooseUniversity('Montero', ['Santa Cruz de la Sierra', 'Montero'])).toBe(
        'Montero',
      );
    });

    it('si la universidad no tiene sede conocida, queda vacía: no se inventa', () => {
      expect(cityToChooseUniversity('La Paz', [])).toBe('');
    });
  });

  describe('eleccionDesdeTexto', () => {
    const enCatalogo = (texto: string): boolean => texto === 'Bolivia';

    it('vacío es «sin elegir»', () => {
      expect(choiceFromText('', enCatalogo, CATALOG_OUTSIDE_COUNTRY)).toBeNull();
      expect(choiceFromText('   ', enCatalogo, CATALOG_OUTSIDE_COUNTRY)).toBeNull();
    });

    it('un nombre del catálogo es esa opción, y cualquier otro texto es «Otro…»', () => {
      expect(choiceFromText('Bolivia', enCatalogo, CATALOG_OUTSIDE_COUNTRY)).toBe('Bolivia');
      expect(choiceFromText('Atlántida', enCatalogo, CATALOG_OUTSIDE_COUNTRY)).toBe(
        CATALOG_OUTSIDE_COUNTRY,
      );
    });
  });
});
