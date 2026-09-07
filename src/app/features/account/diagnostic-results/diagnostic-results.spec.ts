import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticResults } from './diagnostic-results';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const SHARE_ID = '33333333-3333-4333-8333-333333333333';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';

const RESULTADO = {
  reportId: REPORT_ID,
  versionId: '55555555-5555-4555-8555-555555555555',
  versionNumber: 2,
  codeConceptId: 'concept-code',
  categoryConceptId: 'concept-cat',
  custodianTenantId: 'tenant-1',
  conclusionText: 'Valores dentro de rango.',
  releasedAt: '2026-08-10T12:00:00.000Z',
  clinicalStatusConceptId: 'concept-final',
  observationIds: [],
  files: [
    { id: 'link-1', fileId: FILE_ID, contentRoleConceptId: 'concept-pdf', ordinal: 0 },
  ],
};

/** Doble mínimo de la sesión: lo único que la pantalla le pide es el perfil. */
function authDoble(patientProfileId: string | null) {
  return { patientProfileId: signal(patientProfileId) };
}

describe('DiagnosticResults', () => {
  let fixture: ComponentFixture<DiagnosticResults>;
  let http: HttpTestingController;

  function configurar(perfil: string | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authDoble(perfil) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  function mount(): void {
    fixture = TestBed.createComponent(DiagnosticResults);
    fixture.detectChanges();
  }

  /** Responde la lectura de resultados y descarta la de terminología. */
  function responderResultados(items: readonly unknown[]): void {
    http
      .expectOne((request) => request.url === '/diagnostic-results/me')
      .flush({ patientProfileId: PROFILE_ID, items, limit: 50, truncated: false });
    // La traducción de conceptos es un accesorio: si no llega, la lista se
    // muestra igual. Se responde vacío para no dejar peticiones pendientes.
    for (const pedido of http.match((request) => request.url.startsWith('/terminology'))) {
      pedido.flush({ items: [] });
    }
  }

  afterEach(() => http.verify());

  it('never asks for anyone else: there is no patient id in the request', () => {
    configurar(PROFILE_ID);
    mount();

    const pedido = http.expectOne(
      (request) => request.url === '/diagnostic-results/me',
    );
    expect(pedido.request.url).not.toContain(PROFILE_ID);
    pedido.flush({ patientProfileId: PROFILE_ID, items: [], limit: 50, truncated: false });
  });

  it('does not read anything for an account without a patient profile', () => {
    configurar(null);
    mount();

    // Ni una petición: no es un 403, es que la pantalla no le corresponde.
    http.expectNone(() => true);
    expect(fixture.nativeElement.textContent).toContain('Esta sección es para pacientes');
  });

  it('explains that a study in progress is not a missing result', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Todavía no hay resultados');
    expect(texto).toContain('cuando el profesional lo valida');
  });

  /* ---- FT-21 · detalle y descarga ---------------------------------------- */

  /**
   * FT-21-R03/R04. El resultado decía el nombre y la fecha y nada más: dos
   * versiones del mismo estudio se leían igual, y no se sabía cuántos archivos
   * traía sin abrirlo.
   */
  it('muestra los metadatos del resultado: versión, firma y cuántos archivos trae', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([{ ...RESULTADO, issuedAt: '2026-08-08T09:00:00.000Z' }]);
    fixture.detectChanges();

    const meta = fixture.nativeElement.querySelector('[data-testid="resultado-meta"]');
    expect(meta?.textContent).toContain('Liberado el');
    expect(meta?.textContent).toContain('Firmado el');
    expect(meta?.textContent).toContain('Versión 2');
    expect(meta?.textContent).toContain('1 archivo');
  });

  /** FT-21-R01. Descargar es la acción por la que se entra: se ve como tal. */
  it('cada archivo ofrece su botón de descarga con ícono', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([RESULTADO]);
    fixture.detectChanges();

    const boton = fixture.nativeElement.querySelector(
      '[data-testid="resultado-descargar-link-1"]',
    ) as HTMLElement | null;
    expect(boton).not.toBeNull();
    expect(boton?.querySelector('app-nav-icon')).not.toBeNull();
  });

  /**
   * FT-21-R06. Un informe sin adjunto no es una descarga rota: se dice qué hay
   * y qué hacer si se esperaba un archivo.
   */
  it('un resultado sin archivos lo explica en vez de dejar el hueco', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([{ ...RESULTADO, files: [] }]);
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('[data-testid="resultado-sin-archivos"]');
    expect(aviso?.textContent).toContain('no tiene archivos para descargar');
    expect(aviso?.textContent).toContain('consultá con el centro que lo emitió');
  });

  it('shows the signed conclusion and offers its file', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([RESULTADO]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Valores dentro de rango.');
    expect(texto).toContain('Descargar Archivo 1');
    // Ni el identificador del informe ni el del archivo llegan a pantalla.
    expect(texto).not.toContain(REPORT_ID);
    expect(texto).not.toContain(FILE_ID);
  });

  it('asks for the signed url only when the file is actually opened', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([RESULTADO]);
    fixture.detectChanges();

    // Nada pedido al pintar: emitir una url por archivo dejaría enlaces vivos a
    // datos clínicos que nadie usó.
    http.expectNone((request) => request.url.includes('/download-url'));

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    boton.click();
    fixture.detectChanges();

    http
      .expectOne(`/common/files/${FILE_ID}/download-url`)
      .flush({ url: 'https://archivos/x', expiresAt: '2026-08-10T13:00:00.000Z' });
  });

  it('reads the shares of a result when the panel opens', () => {
    configurar(PROFILE_ID);
    mount();
    responderResultados([RESULTADO]);
    fixture.detectChanges();

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const compartir = botones.find((boton) =>
      (boton.textContent ?? '').includes('Compartir con un profesional'),
    );
    compartir?.click();
    fixture.detectChanges();

    http
      .expectOne(`/diagnostic-results/me/${REPORT_ID}/shares`)
      .flush({
        reportId: REPORT_ID,
        items: [
          {
            id: SHARE_ID,
            reportId: REPORT_ID,
            practitionerUserId: 'user-9',
            validFrom: '2026-08-10T12:00:00.000Z',
            validTo: '2026-08-17T12:00:00.000Z',
            active: true,
          },
        ],
      });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('user-9');
    expect(texto).toContain('Vigente');
  });
});
