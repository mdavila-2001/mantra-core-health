import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

import { FilesClient } from '../files/files.client';
import { OwnPhotoStore } from './own-photo.store';
import { ProfilesClient } from './profiles.client';

describe('OwnPhotoStore', () => {
  const getOwnPatientProfile = vi.fn();
  const imageDataUrl = vi.fn();

  const userId = signal<string | null>('u1');

  function crear(): OwnPhotoStore {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { userId } },
        { provide: ProfilesClient, useValue: { getOwnPatientProfile } },
        { provide: FilesClient, useValue: { imageDataUrl } },
      ],
    });
    return TestBed.inject(OwnPhotoStore);
  }

  beforeEach(() => {
    userId.set('u1');
    getOwnPatientProfile.mockReset();
    imageDataUrl.mockReset();
  });

  it('lee la foto del perfil una sola vez', () => {
    getOwnPatientProfile.mockReturnValue(of({ photoFileId: 'f1' }));
    imageDataUrl.mockReturnValue(of('data:image/png;base64,AAA'));
    const store = crear();

    store.load();
    store.load();

    expect(getOwnPatientProfile).toHaveBeenCalledTimes(1);
    expect(store.url()).toBe('data:image/png;base64,AAA');
  });

  it('sin foto, o si la lectura falla, queda en null', () => {
    getOwnPatientProfile.mockReturnValue(of({}));
    const sinFoto = crear();
    sinFoto.load();
    expect(sinFoto.url()).toBeNull();

    TestBed.resetTestingModule();
    getOwnPatientProfile.mockReturnValue(throwError(() => new Error('404')));
    const conFallo = crear();
    conFallo.load();
    expect(conFallo.url()).toBeNull();
  });

  it('set deja la foto subida y reset la borra al cerrar sesión', () => {
    const store = crear();

    store.set('data:image/png;base64,BBB');
    expect(store.url()).toBe('data:image/png;base64,BBB');

    store.reset();
    expect(store.url()).toBeNull();
  });

  it('si cambia la sesión, borra la foto de la cuenta anterior', () => {
    const store = crear();
    TestBed.tick();
    store.set('data:image/png;base64,AAA');

    userId.set(null);
    TestBed.tick();

    expect(store.url()).toBeNull();
  });

  it('descarta una respuesta que llega después de cambiar de sesión', () => {
    const respuesta = new Subject<{ photoFileId: string }>();
    getOwnPatientProfile.mockReturnValue(respuesta);
    imageDataUrl.mockReturnValue(of('data:image/png;base64,VIEJA'));
    const store = crear();
    TestBed.tick();

    store.load();
    userId.set('u2');
    TestBed.tick();
    respuesta.next({ photoFileId: 'f1' });
    respuesta.complete();

    expect(store.url()).toBeNull();
  });
});
