import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AttachmentsBlock } from './attachments-block';

/**
 * Lo que estas pruebas fijan.
 *
 * La regla del bloque no es «mostrar archivos»: es **qué hace cuando no puede
 * mostrarlos**. Un 403 sobre un adjunto `PHI` no es un fallo — es la respuesta
 * correcta— y la diferencia entre decirlo y no decirlo es que el profesional
 * crea que el estudio no existe.
 */
describe('AttachmentsBlock', () => {
  let fixture: ComponentFixture<AttachmentsBlock>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const adjunto = (sensitivity: 'NORMAL' | 'PHI' = 'PHI') => ({
    linkId: 'l-1',
    ownerId: 'p-1',
    ownerType: 'PATIENT',
    linkedAt: '2026-08-14T10:00:00.000Z',
    file: {
      id: 'f-1',
      currentVersionId: null,
      originalName: 'radiografia-torax.jpg',
      category: 'IMAGE',
      sensitivity,
      lifecycleStatusConceptId: 'c-activo',
      createdAt: '2026-08-13T09:00:00.000Z',
    },
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentsBlock],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentsBlock);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('pide los adjuntos del paciente al aparecer', () => {
    const req = http.expectOne((r) => r.url === '/common/files/links');
    expect(req.request.params.get('ownerType')).toBe('PATIENT');
    expect(req.request.params.get('ownerId')).toBe('p-1');
    req.flush({ items: [], count: 0 });
  });

  it('sin adjuntos lo dice, no deja la tarjeta muda', () => {
    http.expectOne((r) => r.url === '/common/files/links').flush({
      items: [],
      count: 0,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Todavía no hay archivos adjuntos');
  });

  it('marca los adjuntos que son dato clínico protegido', () => {
    http.expectOne((r) => r.url === '/common/files/links').flush({
      items: [adjunto('PHI')],
      count: 1,
    });
    fixture.detectChanges();

    expect(texto()).toContain('radiografia-torax.jpg');
    expect(
      fixture.nativeElement.querySelector('app-badge')!.textContent!.trim(),
    ).toBe('Dato clínico protegido');
  });

  it('un adjunto normal no lleva la marca', () => {
    http.expectOne((r) => r.url === '/common/files/links').flush({
      items: [adjunto('NORMAL')],
      count: 1,
    });
    fixture.detectChanges();

    expect(texto()).toContain('radiografia-torax.jpg');
    // La pista del formulario de subida dice «dato clínico protegido» en
    // minúscula; se busca la marca exacta del adjunto, no la frase suelta.
    expect(fixture.nativeElement.querySelector('app-badge')).toBeNull();
  });

  /**
   * El corazón del bloque. Un 403 al abrir se convierte en una frase que
   * nombra el motivo y dice qué hacer — no en una lista que se queda quieta.
   */
  it('ante un 403 al abrir dice que falta permiso, no se queda mudo', () => {
    http.expectOne((r) => r.url === '/common/files/links').flush({
      items: [adjunto('PHI')],
      count: 1,
    });
    fixture.detectChanges();

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    boton.click();

    http
      .expectOne((r) => r.url === '/common/files/f-1/download-url')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(texto()).toContain('no tiene permiso para abrirlo');
    // El adjunto sigue en la lista: se sabe que existe.
    expect(texto()).toContain('radiografia-torax.jpg');
  });

  it('un error que no es 403 se dice como problema, no como permiso', () => {
    http.expectOne((r) => r.url === '/common/files/links').flush({
      items: [adjunto('NORMAL')],
      count: 1,
    });
    fixture.detectChanges();

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    boton.click();

    http
      .expectOne((r) => r.url === '/common/files/f-1/download-url')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos abrir el archivo');
    expect(texto()).not.toContain('no tiene permiso');
  });

  it('si la lectura falla lo dice', () => {
    http
      .expectOne((r) => r.url === '/common/files/links')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos leer los adjuntos');
  });
});
