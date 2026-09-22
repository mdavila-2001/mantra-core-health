import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { FreeNoteBlock } from './free-note-block';

/**
 * La hoja en blanco de la consulta. Lo que estas pruebas fijan:
 *
 * 1. **El primer guardado abre la nota; el segundo la versiona.** Es una
 *    historia clínica: nada pisa lo anterior.
 * 2. **Sin perfil profesional no se escribe**, y el aviso dice por qué — es una
 *    recepcionista, no un fallo del guardado.
 * 3. **Si falla la petición, el texto se queda.** Perder lo escrito de una
 *    consulta es el peor final posible para un error de red.
 */
describe('FreeNoteBlock', () => {
  let fixture: ComponentFixture<FreeNoteBlock>;
  let http: HttpTestingController;

  /**
   * El perfil propio mínimo que el cliente sabe traducir.
   *
   * `ProfilesClient` convierte fechas y recorre cinco colecciones; si alguna
   * falta, revienta al mapear y el bloque lo lee como «esta cuenta no tiene
   * perfil», que es un caso distinto. De ahí que estén todas, aunque vacías.
   */
  const PERFIL = {
    profileId: 'prof-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    specialties: [],
    credentials: [],
    licenses: [],
    affiliations: [],
    languages: [],
  };

  /** Lee un miembro protegido, que es donde vive el estado del bloque. */
  function interno<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, T>)[nombre];
  }

  /** Escribe en el editor sin depender de su implementación interna. */
  function escribir(texto: string): void {
    interno<{ set(v: string): void }>('contenido').set(texto);
    fixture.detectChanges();
  }

  function peticionDePerfil() {
    return http.expectOne((r) => r.url.endsWith('/profiles/practitioners/me/summary'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FreeNoteBlock],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FreeNoteBlock);
    fixture.componentRef.setInput('patientProfileId', 'pac-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.detectChanges();
    atenderALaCuadricula();
  });

  afterEach(() => http.verify());

  /**
   * Responde la lectura del expediente que hace la cuadrícula al montarse.
   *
   * Desde **C-14** el bloque tiene dos vistas y la segunda es `app-note-grid`,
   * que pide el expediente por su cuenta. Con la pestaña «Escribir» abierta —que
   * es la de arranque— el panel de la cuadrícula **no se dibuja** y esa petición
   * no existe, así que casi siempre esto no drena nada.
   *
   * Se deja igual, y a propósito: el día que una prueba abra la otra vista, la
   * petición aparece y acá está contestada. Es `match` y no `expectOne`
   * justamente porque cero es un resultado válido.
   */
  function atenderALaCuadricula(): void {
    http
      .match((r) => r.url.endsWith('/clinical/patients/pac-1/summary'))
      .forEach((peticion) =>
        peticion.flush({
          patientProfileId: 'pac-1',
          conditions: [],
          allergies: [],
          medicationRequests: [],
          observations: [],
          encounters: [],
          careEpisodes: [],
          limit: 50,
          truncated: [],
        }),
      );
  }

  it('sin texto no guarda nada: no se pide ni el perfil', () => {
    interno<() => void>('guardar').call(fixture.componentInstance);
    http.expectNone((r) => r.url.endsWith('/profiles/practitioners/me/summary'));
    expect(interno<() => boolean>('vacio')()).toBe(true);
  });

  it('un texto con sólo marcas cuenta como vacío', () => {
    // El navegador mete `<p><br></p>` al entrar al área. Eso no es una nota.
    escribir('<p><br></p>');
    expect(interno<() => boolean>('vacio')()).toBe(true);
  });

  it('el primer guardado abre la nota con el texto escrito', () => {
    escribir('<p>Refiere cefalea de tres días.</p>');
    interno<() => void>('guardar').call(fixture.componentInstance);

    peticionDePerfil().flush(PERFIL);
    const alta = http.expectOne((r) => r.url.endsWith('/charts/notes') && r.method === 'POST');
    expect(alta.request.body).toMatchObject({
      patientProfileId: 'pac-1',
      authorProfileId: 'prof-1',
      encounterId: 'enc-1',
      subjectiveText: '<p>Refiere cefalea de tres días.</p>',
    });
    alta.flush({
      noteId: 'nota-1',
      versionId: 'v-1',
      versionNumber: 1,
      lifecycleStatusConceptId: 'c-1',
      versionStatusConceptId: 'c-2',
    });
    fixture.detectChanges();
    expect(interno<() => number>('versiones')()).toBe(1);
  });

  it('el segundo guardado versiona la misma nota, no abre otra', () => {
    escribir('<p>Primera versión.</p>');
    interno<() => void>('guardar').call(fixture.componentInstance);
    peticionDePerfil().flush(PERFIL);
    http.expectOne((r) => r.url.endsWith('/charts/notes') && r.method === 'POST').flush({
      noteId: 'nota-1',
      versionId: 'v-1',
      versionNumber: 1,
      lifecycleStatusConceptId: 'c-1',
      versionStatusConceptId: 'c-2',
    });
    fixture.detectChanges();

    escribir('<p>Primera versión. Se agrega el examen.</p>');
    interno<() => void>('guardar').call(fixture.componentInstance);
    peticionDePerfil().flush(PERFIL);

    const version = http.expectOne(
      (r) => r.url.endsWith('/charts/notes/nota-1/versions') && r.method === 'PUT',
    );
    // Sin `patientProfileId`: la nota ya sabe de quién es, y admitirlo abriría
    // la puerta a moverla de paciente por descuido.
    expect(version.request.body).not.toHaveProperty('patientProfileId');
    version.flush({
      noteId: 'nota-1',
      versionId: 'v-2',
      versionNumber: 2,
      lifecycleStatusConceptId: 'c-1',
      versionStatusConceptId: 'c-2',
    });
    fixture.detectChanges();
    expect(interno<() => number>('versiones')()).toBe(2);
  });

  it('sin encuentro abierto la nota igual se guarda, colgada del paciente', () => {
    fixture.componentRef.setInput('encounterId', null);
    fixture.detectChanges();
    escribir('<p>Nota fuera de consulta.</p>');
    interno<() => void>('guardar').call(fixture.componentInstance);
    peticionDePerfil().flush(PERFIL);

    const alta = http.expectOne((r) => r.url.endsWith('/charts/notes') && r.method === 'POST');
    expect(alta.request.body).not.toHaveProperty('encounterId');
    alta.flush({
      noteId: 'nota-2',
      versionId: 'v-1',
      versionNumber: 1,
      lifecycleStatusConceptId: 'c-1',
      versionStatusConceptId: 'c-2',
    });
  });

  it('una cuenta sin perfil profesional recibe el motivo, no un error genérico', () => {
    escribir('<p>Algo.</p>');
    interno<() => void>('guardar').call(fixture.componentInstance);
    peticionDePerfil().flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(interno<() => string | null>('error')()).toContain('perfil profesional');
    expect(interno<() => boolean>('guardando')()).toBe(false);
  });

  it('si el guardado falla, el texto sigue escrito', () => {
    escribir('<p>Media hora de consulta.</p>');
    interno<() => void>('guardar').call(fixture.componentInstance);
    peticionDePerfil().flush(PERFIL);
    http
      .expectOne((r) => r.url.endsWith('/charts/notes'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(interno<() => string>('contenido')()).toBe('<p>Media hora de consulta.</p>');
    expect(interno<() => string | null>('error')()).toContain('probá de nuevo');
  });

  describe('tieneCambiosPendientes — contrato de DraftBlock', () => {
    it('recién montado no tiene cambios pendientes', () => {
      expect(fixture.componentInstance.tieneCambiosPendientes()).toBe(false);
    });

    it('escribiendo, tiene cambios pendientes', () => {
      escribir('<p>Refiere cefalea.</p>');
      expect(fixture.componentInstance.tieneCambiosPendientes()).toBe(true);
    });

    it('guardada la nota, lo escrito ya no cuenta como pendiente', () => {
      escribir('<p>Refiere cefalea de tres días.</p>');
      interno<() => void>('guardar').call(fixture.componentInstance);
      peticionDePerfil().flush(PERFIL);
      http.expectOne((r) => r.url.endsWith('/charts/notes')).flush({
        noteId: 'nota-1',
        versionId: 'v-1',
        versionNumber: 1,
        lifecycleStatusConceptId: 'c-1',
        versionStatusConceptId: 'c-2',
      });
      fixture.detectChanges();

      expect(fixture.componentInstance.tieneCambiosPendientes()).toBe(false);
    });

    it('seguir escribiendo después de guardar vuelve a ser pendiente', () => {
      escribir('<p>Refiere cefalea de tres días.</p>');
      interno<() => void>('guardar').call(fixture.componentInstance);
      peticionDePerfil().flush(PERFIL);
      http.expectOne((r) => r.url.endsWith('/charts/notes')).flush({
        noteId: 'nota-1',
        versionId: 'v-1',
        versionNumber: 1,
        lifecycleStatusConceptId: 'c-1',
        versionStatusConceptId: 'c-2',
      });
      fixture.detectChanges();

      escribir('<p>Refiere cefalea de tres días. Agrega náuseas.</p>');

      expect(fixture.componentInstance.tieneCambiosPendientes()).toBe(true);
    });

    it('la cita elegida cuenta sólo antes del primer guardado', () => {
      interno<{ set(v: string | null): void }>('citaElegida').set('enc-9');
      expect(fixture.componentInstance.tieneCambiosPendientes()).toBe(true);

      escribir('<p>Refiere cefalea.</p>');
      interno<() => void>('guardar').call(fixture.componentInstance);
      peticionDePerfil().flush(PERFIL);
      http.expectOne((r) => r.url.endsWith('/charts/notes')).flush({
        noteId: 'nota-1',
        versionId: 'v-1',
        versionNumber: 1,
        lifecycleStatusConceptId: 'c-1',
        versionStatusConceptId: 'c-2',
      });
      fixture.detectChanges();

      // Después del primer guardado la nota ya está abierta: la cita viaja en
      // el vínculo de esa nota, no en un alta pendiente de esta pantalla.
      expect(fixture.componentInstance.tieneCambiosPendientes()).toBe(false);
    });
  });
});
