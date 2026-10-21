import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { PublicDirectoryClient } from '../data-access/public-directory/public-directory.client';
import { enlaceDe, ProfileSummaryStore } from './profile-summary.store';

const base = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `slug-${id}`,
  kind: 'PRACTITIONER',
  displayName: `Nombre ${id}`,
  headline: 'Cardióloga',
  ...extra,
});

describe('ProfileSummaryStore', () => {
  let community: { readProfile: ReturnType<typeof vi.fn>; readProfileBySlug: ReturnType<typeof vi.fn> };
  let directorio: { getProfile: ReturnType<typeof vi.fn> };

  function armar(): ProfileSummaryStore {
    community = {
      readProfile: vi.fn((id: string) => of(base(id))),
      readProfileBySlug: vi.fn((slug: string) => of(base(`id-de-${slug}`))),
    };
    directorio = {
      getProfile: vi.fn(() => of({ headline: 'Cardióloga · Clínica', avatarUrl: 'data:foto' })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: community },
        { provide: PublicDirectoryClient, useValue: directorio },
      ],
    });
    return TestBed.inject(ProfileSummaryStore);
  }

  async function esperar(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('resuelve nombre, titular, foto y enlace a la ficha pública', async () => {
    const store = armar();

    expect(store.resumen('p1')).toBeUndefined();
    await esperar();

    expect(store.resumen('p1')).toEqual({
      id: 'p1',
      slug: 'slug-p1',
      kind: 'PRACTITIONER',
      displayName: 'Nombre p1',
      headline: 'Cardióloga · Clínica',
      avatarUrl: 'data:foto',
      enlace: ['/p', 'slug-p1'],
    });
    expect(directorio.getProfile).toHaveBeenCalledWith('PRACTITIONER', 'slug-p1');
  });

  it('lee una sola vez por persona, no una vez por tarjeta', async () => {
    const store = armar();

    store.resumen('p1');
    store.resumen('p1');
    store.resumen('p1');
    await esperar();
    store.resumen('p1');

    expect(community.readProfile).toHaveBeenCalledTimes(1);
  });

  it('si la ficha pública falla muestra lo que ya sabe, sin foto', async () => {
    const store = armar();
    directorio.getProfile.mockReturnValue(throwError(() => new Error('404')));

    store.resumen('p1');
    await esperar();

    expect(store.resumen('p1')).toMatchObject({ displayName: 'Nombre p1', avatarUrl: null, headline: 'Cardióloga' });
  });

  it('un paciente no tiene ficha pública: ni enlace ni segunda lectura', async () => {
    const store = armar();
    community.readProfile.mockReturnValue(of(base('p9', { kind: 'PATIENT' })));

    store.resumen('p9');
    await esperar();

    expect(store.resumen('p9')?.enlace).toBeNull();
    expect(directorio.getProfile).not.toHaveBeenCalled();
  });

  it('si el perfil no se puede leer queda en null: se intentó y no se pudo', async () => {
    const store = armar();
    community.readProfile.mockReturnValue(throwError(() => new Error('500')));

    store.resumen('p1');
    await esperar();

    expect(store.resumen('p1')).toBeNull();
  });

  it('no dispara más de cuatro lecturas a la vez', async () => {
    const store = armar();
    // Nunca contestan: las cuatro plazas quedan ocupadas.
    community.readProfile.mockImplementation(() => new Subject());

    for (let i = 0; i < 10; i += 1) store.resumen(`p${i}`);
    await esperar();

    expect(community.readProfile).toHaveBeenCalledTimes(4);
  });

  it('registrar guarda un resumen conocido sin leer nada', () => {
    const store = armar();

    store.registrar({ id: 'yo', slug: 'yo', kind: 'PRACTITIONER', displayName: 'Yo', headline: null, avatarUrl: null, enlace: ['/p', 'yo'] });

    expect(store.resumen('yo')?.displayName).toBe('Yo');
    expect(community.readProfile).not.toHaveBeenCalled();
  });

  describe('idPorSlug — la superficie pública no expone ids', () => {
    it('resuelve el id del perfil a partir de su slug', async () => {
      const store = armar();

      expect(store.idPorSlug('dra-rojas')).toBeUndefined();
      await esperar();

      expect(store.idPorSlug('dra-rojas')).toBe('id-de-dra-rojas');
      expect(community.readProfileBySlug).toHaveBeenCalledWith('dra-rojas');
    });

    it('lee una sola vez por slug', async () => {
      const store = armar();

      store.idPorSlug('dra-rojas');
      store.idPorSlug('dra-rojas');
      await esperar();
      store.idPorSlug('dra-rojas');

      expect(community.readProfileBySlug).toHaveBeenCalledTimes(1);
    });

    it('si no se puede resolver queda en null: se intentó y no se pudo', async () => {
      const store = armar();
      community.readProfileBySlug.mockReturnValue(throwError(() => new Error('404')));

      store.idPorSlug('nadie');
      await esperar();

      expect(store.idPorSlug('nadie')).toBeNull();
    });

    it('registrar un resumen también enseña su slug: no hace falta volver a leerlo', () => {
      const store = armar();

      store.registrar({ id: 'yo', slug: 'mi-slug', kind: 'PRACTITIONER', displayName: 'Yo', headline: null, avatarUrl: null, enlace: ['/p', 'mi-slug'] });

      expect(store.idPorSlug('mi-slug')).toBe('yo');
      expect(community.readProfileBySlug).not.toHaveBeenCalled();
    });
  });

  it('enlaceDe: cada vertical tiene su prefijo y el paciente ninguno', () => {
    expect(enlaceDe('ORGANIZATION', 'clinica')).toEqual(['/o', 'clinica']);
    expect(enlaceDe('PHARMACY', 'farma')).toEqual(['/f', 'farma']);
    expect(enlaceDe('PATIENT', 'ana')).toBeNull();
  });
});
