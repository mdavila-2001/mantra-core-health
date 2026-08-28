import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';

import { agruparPorEspecialidad } from './profesionales-listado';

describe('agruparPorEspecialidad', () => {
  const profesional = (
    displayName: string,
    headline: string | null,
  ): PublicSearchResult => ({
    kind: 'PRACTITIONER',
    slug: displayName.toLowerCase().replaceAll(' ', '-'),
    displayName,
    headline,
    city: null,
    avatarUrl: null,
    verified: true,
    ratingAverage: null,
    ratingCount: 0,
    coverUrl: null,
    address: null,
    location: null,
    hasPublishedAgenda: false,
    nextAvailableDate: null,
  });

  it('reúne y ordena los profesionales por su especialidad visible', () => {
    const grupos = agruparPorEspecialidad([
      profesional('Zoé Ríos', 'Cardiología'),
      profesional('Ana Díaz', 'Dermatología'),
      profesional('Álvaro Silva', 'Cardiología'),
    ]);

    expect(grupos.map((grupo) => grupo.especialidad)).toEqual(['Cardiología', 'Dermatología']);
    expect(grupos[0].tarjetas.map((tarjeta) => tarjeta.title)).toEqual(['Álvaro Silva', 'Zoé Ríos']);
  });

  it('conserva los perfiles sin especialidad bajo un bloque claro', () => {
    const grupos = agruparPorEspecialidad([profesional('Luz Pérez', null)]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].especialidad).toBe('Especialidad no informada');
  });
});
