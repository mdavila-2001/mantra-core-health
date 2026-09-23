import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ContactPanel } from './contact-panel';

/**
 * Lo que estas pruebas fijan.
 *
 * Que el panel **contesta con lo que ya sabe** mientras la ficha viaja —el
 * nombre de la bandeja, no un hueco—, que el salto a la ficha pública sólo
 * aparece **cuando esa ficha existe** (un paciente no tiene, y la API real
 * todavía no manda `kind`), y que un error de lectura no vacía el panel.
 *
 * Son el contrato del defecto que vino a arreglar: «Ver perfil» navegaba a
 * `/public-profile/<id>`, una ruta inexistente, y caía en el 404.
 */
describe('ContactPanel', () => {
  let fixture: ComponentFixture<ContactPanel>;
  let http: HttpTestingController;

  const ficha = (extra: Record<string, unknown> = {}) => ({
    id: 'pp-2',
    tenantId: 't-1',
    targetTypeConceptId: 'concept-practitioner',
    kind: 'PRACTITIONER',
    slug: 'valeria-rojas',
    displayName: 'Dra. Valeria Rojas',
    headline: 'Cardióloga',
    biography: 'Veinte años en cardiología clínica.',
    avatarFileId: null,
    coverFileId: null,
    verificationStatusConceptId: null,
    acceptsReviews: true,
    statusConceptId: 'st-active',
    badges: [],
    prestige: null,
    ...extra,
  });

  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  const montar = (profileId = 'pp-2'): void => {
    fixture = TestBed.createComponent(ContactPanel);
    fixture.componentRef.setInput('profileId', profileId);
    fixture.componentRef.setInput('displayName', 'Dra. Valeria Rojas');
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ContactPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra el nombre que ya traía la bandeja antes de que llegue la ficha', () => {
    montar();

    expect(consultar('hilo-contacto-nombre')?.textContent).toContain(
      'Dra. Valeria Rojas',
    );

    http.expectOne('/community/profiles/pp-2').flush(ficha());
  });

  it('pinta el titular y la biografía de la ficha', () => {
    montar();
    http.expectOne('/community/profiles/pp-2').flush(ficha());
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Cardióloga');
    expect(texto).toContain('Veinte años en cardiología clínica.');
  });

  it('ofrece la ficha pública de un profesional, con su prefijo', () => {
    montar();
    http.expectOne('/community/profiles/pp-2').flush(ficha());
    fixture.detectChanges();

    const enlace = consultar('hilo-contacto-ficha');
    expect(enlace?.getAttribute('href')).toBe('/p/valeria-rojas');
    expect(consultar('hilo-contacto-sin-ficha')).toBeNull();
  });

  it('no ofrece ficha pública a un paciente, y lo dice', () => {
    montar();
    http
      .expectOne('/community/profiles/pp-2')
      .flush(ficha({ kind: 'PATIENT', slug: 'ana-perez' }));
    fixture.detectChanges();

    expect(consultar('hilo-contacto-ficha')).toBeNull();
    expect(consultar('hilo-contacto-sin-ficha')).not.toBeNull();
  });

  it('tampoco la ofrece cuando el servidor no dice la vertical', () => {
    // Es el caso de la API real hasta que publique `kind`: sin saber el
    // prefijo, un enlace sería una adivinanza.
    montar();
    http
      .expectOne('/community/profiles/pp-2')
      .flush(ficha({ kind: null }));
    fixture.detectChanges();

    expect(consultar('hilo-contacto-ficha')).toBeNull();
  });

  it('marca el sello cuando el perfil tiene uno', () => {
    montar();
    http.expectOne('/community/profiles/pp-2').flush(
      ficha({
        badges: [
          {
            id: 'b-1',
            badgeTypeConceptId: 'c-verified',
            verificationMethodConceptId: 'c-registry',
            validFrom: '2026-01-01T00:00:00.000Z',
            validTo: null,
          },
        ],
      }),
    );
    fixture.detectChanges();

    expect(consultar('hilo-contacto-verificado')).not.toBeNull();
  });

  it('si la ficha no se puede leer, el panel sigue mostrando quién es', () => {
    montar();
    http
      .expectOne('/community/profiles/pp-2')
      .flush('nope', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(consultar('hilo-contacto-error')).not.toBeNull();
    expect(consultar('hilo-contacto-nombre')?.textContent).toContain(
      'Dra. Valeria Rojas',
    );
  });

  it('toma el foco al abrirse, para que Escape llegue', async () => {
    // Lo encontró el navegador, no el código: con el foco en el botón del menú
    // la tecla nunca llegaba al contenedor y la hoja no se cerraba nunca.
    montar();
    http.expectOne('/community/profiles/pp-2').flush(ficha());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.activeElement).toBe(consultar('hilo-contacto'));
  });

  it('cierra con Escape', async () => {
    montar();
    http.expectOne('/community/profiles/pp-2').flush(ficha());
    await fixture.whenStable();
    fixture.detectChanges();

    let cerrado = 0;
    fixture.componentInstance.closed.subscribe(() => (cerrado += 1));
    consultar('hilo-contacto')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

    expect(cerrado).toBe(1);
  });

  it('avisa que se cerró', () => {
    montar();
    http.expectOne('/community/profiles/pp-2').flush(ficha());
    fixture.detectChanges();

    let cerrado = 0;
    fixture.componentInstance.closed.subscribe(() => (cerrado += 1));
    consultar('hilo-contacto-cerrar')?.click();

    expect(cerrado).toBe(1);
  });
});
