import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { INSTITUCION_FUERA_DE_CATALOGO } from './instituciones-educativas';
import {
  PAIS_FUERA_DE_CATALOGO,
  PadronDeUniversidades,
  eleccionDesdeTexto,
} from './padron-de-universidades';

describe('PadronDeUniversidades', () => {
  function padron(): PadronDeUniversidades {
    return TestBed.inject(PadronDeUniversidades);
  }

  it('Bolivia está siempre, antes de pedir nada, con la lista curada', () => {
    const servicio = padron();

    expect(servicio.estado()).toBe('sin-pedir');
    expect(servicio.paises()[0]?.nombre).toBe('Bolivia');
    expect(servicio.esPaisDelCatalogo('Bolivia')).toBe(true);
    expect(servicio.esUniversidadDe('Bolivia', 'Universidad Mayor de San Andrés')).toBe(true);
    // La etiqueta curada trae la sigla; el valor sigue siendo el nombre.
    expect(
      servicio
        .universidadesDe('Bolivia')
        .find((opcion) => opcion.value === 'Universidad Mayor de San Andrés')?.label,
    ).toContain('UMSA');
  });

  it('el padrón importado llega después, como árbol: cada país con las suyas', async () => {
    const servicio = padron();
    await servicio.cargar();

    expect(servicio.estado()).toBe('listo');
    expect(servicio.paises().length).toBeGreaterThan(150);
    // Bolivia sigue primera y sigue siendo la curada, no la importada.
    expect(servicio.paises()[0]?.nombre).toBe('Bolivia');
    expect(servicio.paises().filter((pais) => pais.iso === 'BO')).toHaveLength(1);

    expect(servicio.esUniversidadDe('Argentina', 'Universidad de Buenos Aires')).toBe(true);
    expect(servicio.esUniversidadDe('Bolivia', 'Universidad de Buenos Aires')).toBe(false);
    expect(servicio.esUniversidadDe('Cuba', 'Universidad de La Habana')).toBe(true);
    expect(servicio.universidadesDe('España').length).toBeGreaterThan(50);
  });

  it('la lista de universidades cierra siempre con «Otra institución…», y la de países con «Otro país…»', async () => {
    const servicio = padron();
    await servicio.cargar();

    const deArgentina = servicio.opcionesDeUniversidad('Argentina');
    expect(deArgentina.at(-1)?.value).toBe(INSTITUCION_FUERA_DE_CATALOGO);
    expect(deArgentina.length).toBeGreaterThan(1);
    // Sin país, o con «Otro país…», la única opción es escribirla a mano.
    expect(servicio.opcionesDeUniversidad('')).toEqual([
      expect.objectContaining({ value: INSTITUCION_FUERA_DE_CATALOGO }),
    ]);
    expect(servicio.opcionesDePais().at(-1)?.value).toBe(PAIS_FUERA_DE_CATALOGO);
  });

  it('pedirlo dos veces es una sola carga', async () => {
    const servicio = padron();
    const primera = servicio.cargar();
    expect(servicio.estado()).toBe('cargando');
    expect(servicio.cargar()).toBe(primera);
    await primera;
    expect(servicio.estado()).toBe('listo');
  });

  describe('eleccionDesdeTexto', () => {
    const enCatalogo = (texto: string): boolean => texto === 'Bolivia';

    it('vacío es «sin elegir»', () => {
      expect(eleccionDesdeTexto('', enCatalogo, PAIS_FUERA_DE_CATALOGO)).toBeNull();
      expect(eleccionDesdeTexto('   ', enCatalogo, PAIS_FUERA_DE_CATALOGO)).toBeNull();
    });

    it('un nombre del catálogo es esa opción, y cualquier otro texto es «Otro…»', () => {
      expect(eleccionDesdeTexto('Bolivia', enCatalogo, PAIS_FUERA_DE_CATALOGO)).toBe('Bolivia');
      expect(eleccionDesdeTexto('Atlántida', enCatalogo, PAIS_FUERA_DE_CATALOGO)).toBe(
        PAIS_FUERA_DE_CATALOGO,
      );
    });
  });
});
