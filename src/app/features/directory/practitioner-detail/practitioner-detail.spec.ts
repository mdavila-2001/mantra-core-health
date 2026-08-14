import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { PractitionerDetail } from './practitioner-detail';
import type { PerfilProfesionalVisible } from '../../account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view.types';

/**
 * La ficha de un profesional — el destino del clic en la guía (carril R2-1).
 *
 * Lo que fija:
 *
 * 1. **Pide el perfil del id de la ruta**, no el propio.
 * 2. **Traduce al mismo contrato** que consume `practitioner-profile-view`, el
 *    componente que también pinta el perfil propio. Un solo perfil de doctor
 *    en el producto.
 * 3. Los fallos laterales —catálogo, foto— degradan sin tumbar la ficha.
 */

const PERFIL = {
  profileId: 'per-9',
  personId: 'per-9',
  practitionerCode: 'MED-9',
  displayName: 'Dr. Andrés Peña',
  professionalTitle: 'Pediatra',
  professionalBio: 'Veinte años en pediatría.',
  practitionerCategoryConceptId: 'cat-1',
  verificationStatusConceptId: 'st-verificado',
  practiceStatusConceptId: 'st-ejerciendo',
  acceptsNewPatients: true,
  telehealthAvailable: true,
  specialties: [
    {
      id: 'sp-1',
      specialtyConceptId: 'esp-pediatria',
      isPrimary: true,
      boardCertified: true,
      verificationStatusConceptId: 'st-verificado',
    },
  ],
  credentials: [],
  licenses: [],
  languages: [],
  activity: { encounters: 5, medicationRequests: 2, clinicalNotes: 1, documents: 0 },
  createdAt: '2015-01-01T00:00:00.000Z',
};

const CONCEPTOS = {
  items: [
    {
      conceptId: 'esp-pediatria',
      code: 'PEDIATRICS',
      display: 'Pediatría',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'st-verificado',
      code: 'CRED_VERIFIED',
      display: 'Verificada',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'st-ejerciendo',
      code: 'PRACTICE_ACTIVE',
      display: 'En ejercicio',
      codeSystemVersionId: 'csv-1',
    },
  ],
  count: 3,
  limit: 200,
};

describe('PractitionerDetail', () => {
  let componente: PractitionerDetail;
  let http: HttpTestingController;

  function montar(profileId: string | null = 'per-9'): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ profileId: profileId ?? '' })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    componente = TestBed.createComponent(PractitionerDetail).componentInstance;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function visible(): PerfilProfesionalVisible {
    const valor = interno<() => PerfilProfesionalVisible | null>('visible')();
    if (valor === null) {
      throw new Error('la ficha no está lista');
    }
    return valor;
  }

  function responder(perfil: object = {}, conceptos: object = CONCEPTOS): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners/per-9/summary')
      .flush({ ...PERFIL, ...perfil });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
  }

  it('pide el perfil del id de la ruta, no el propio', () => {
    montar();

    // Si pidiera `me/summary`, este `expectOne` fallaría y `verify()` también.
    http.expectOne((r) => r.url === '/profiles/practitioners/per-9/summary').flush(PERFIL);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http.verify();

    expect(visible().nombre).toBe('Dr. Andrés Peña');
  });

  it('traduce al contrato que consume la vista compartida', () => {
    montar();
    responder();
    http.verify();

    expect(visible()).toMatchObject({
      codigo: 'MED-9',
      titulo: 'Pediatra',
      especialidadPrincipal: 'Pediatría',
      estadoDePractica: 'En ejercicio',
      aceptaPacientesNuevos: true,
      telemedicina: true,
    });
    expect(visible().verificacion?.variant).toBe('approved');
  });

  it('sin foto registrada no pide ninguna URL de descarga', () => {
    montar();
    responder();
    http.verify();

    expect(visible().fotoUrl).toBeNull();
  });

  it('con foto registrada resuelve su URL', () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/per-9/summary')
      .flush({ ...PERFIL, photoFileId: 'foto-9' });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http
      .expectOne((r) => r.url === '/common/files/foto-9/download-url')
      .flush({ url: 'https://cdn.example/foto-9.jpg', expiresAt: '2030-01-01T00:00:00.000Z' });
    http.verify();

    expect(visible().fotoUrl).toBe('https://cdn.example/foto-9.jpg');
  });

  /** El catálogo caído deja los rótulos sin resolver, no la ficha sin perfil. */
  it('un fallo del catálogo no tumba la ficha', () => {
    montar();
    http.expectOne((r) => r.url === '/profiles/practitioners/per-9/summary').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
    http.verify();

    expect(visible().nombre).toBe('Dr. Andrés Peña');
    expect(visible().especialidades[0].nombre).toBe('Sin registrar');
  });

  /** Un perfil que no existe es un estado de vista, no una excepción. */
  it('un profesional inexistente cae en no encontrado', () => {
    montar();
    http
      .expectOne((r) => r.url === '/profiles/practitioners/per-9/summary')
      .flush(
        { code: 'NOT_FOUND', message: 'Perfil profesional no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );
    http.verify();

    expect(interno<() => { status: string }>('estado')().status).toBe('not-found');
  });

  /** Sin id en la ruta no se pide nada: no hay a quién consultar. */
  it('sin id en la ruta no dispara ninguna petición', () => {
    montar(null);
    http.verify();

    expect(interno<() => { status: string }>('estado')().status).toBe('not-found');
  });
});
