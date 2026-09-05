import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { AttachmentUploader } from './attachment-uploader';

/**
 * Lo que estas pruebas fijan.
 *
 * Adjuntar son **dos** operaciones encadenadas, y el caso interesante es el del
 * medio: que la subida salga bien y el vínculo falle. Ahí el archivo **ya
 * existe**, y decir «no se pudo subir» llevaría a reintentar y duplicarlo.
 */
describe('AttachmentUploader', () => {
  let fixture: ComponentFixture<AttachmentUploader>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const elegirArchivo = (): void => {
    const archivo = new File(['bytes'], 'estudio.pdf', {
      type: 'application/pdf',
    });
    (fixture.componentInstance as unknown as {
      seleccionados: { set: (v: readonly File[]) => void };
    }).seleccionados.set([archivo]);
    fixture.detectChanges();
  };

  const subir = (): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes('Adjuntar'))!.click();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentUploader],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentUploader);
    fixture.componentRef.setInput('ownerType', 'PATIENT');
    fixture.componentRef.setInput('ownerId', 'p-1');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('sube y después vincula: son dos peticiones', () => {
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirArchivo();
    subir();

    const subida = http.expectOne((r) => r.url === '/common/files/upload');
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'f-1' });

    const vinculo = http.expectOne((r) => r.url === '/common/files/f-1/links');
    expect(vinculo.request.body).toEqual({
      ownerType: 'PATIENT',
      ownerId: 'p-1',
    });
    vinculo.flush({
      id: 'l-1',
      fileId: 'f-1',
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });

    expect(avisos.length).toBe(1);
  });

  /**
   * `linkVia` es la vía de escape para un dominio con su propia regla de quién
   * puede adjuntar qué (ALV-033: `clinical` liga por su propio endpoint, no
   * por el genérico de `common`, que no verifica rol ni que el dueño exista).
   */
  it('con `linkVia`, el vínculo pasa por ahí y no por el genérico', () => {
    const enlazar = vi.fn((_fileId: string, _ownerId: string) => of(undefined));
    fixture.componentRef.setInput('linkVia', enlazar);
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirArchivo();
    subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });

    expect(enlazar).toHaveBeenCalledWith('f-1', 'p-1');
    http.expectNone((r) => r.url === '/common/files/f-1/links');
    expect(avisos.length).toBe(1);
  });

  /**
   * El caso del medio. Si acá dijera «no se pudo subir», quien lo lea vuelve a
   * subir el mismo archivo y quedan dos copias en el sistema.
   */
  it('si falla el vínculo dice que el archivo YA se subió', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });
    http
      .expectOne((r) => r.url === '/common/files/f-1/links')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('se subió pero no se pudo adjuntar');
    expect(texto()).toContain('no volviendo a subirlo');
  });

  it('si falla la subida no intenta vincular nada', () => {
    elegirArchivo();
    subir();

    http
      .expectOne((r) => r.url === '/common/files/upload')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos subir el archivo');
    http.expectNone((r) => r.url.includes('/links'));
  });

  /** Sensibilidad `PHI` por defecto: en dato clínico se protege de más. */
  it('el valor por defecto de sensibilidad es PHI', () => {
    elegirArchivo();
    subir();

    const req = http.expectOne((r) => r.url === '/common/files/upload');
    expect((req.request.body as FormData).get('sensitivity')).toBe('PHI');
    req.flush({ id: 'f-1' });
    http.expectOne((r) => r.url === '/common/files/f-1/links').flush({
      id: 'l-1',
      fileId: 'f-1',
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
  });

  it('sin archivo elegido no manda nada', () => {
    subir();
    http.expectNone((r) => r.url === '/common/files/upload');
  });
});
