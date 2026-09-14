import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { PracticeSite } from '../../../../../core/data-access/practice-sites/practice-sites.types';
import { SiteBankQrDialog } from './site-bank-qr-dialog';

const SEDE: PracticeSite = {
  id: 'site-1',
  practiceId: 'pr-1',
  code: 'CONSULTORIO-1',
  name: 'Consultorio Dra. Pérez',
  timeZone: 'America/La_Paz',
  addressText: 'Av. Brasil 1234, La Paz',
  latitude: null,
  longitude: null,
  status: 'c-activo',
  esPropio: true,
};

const CONTENIDO = '/common/files/file-qr/content';
const SUBIDA = '/common/files/upload';
const QR_DE_LA_SEDE = '/practitioners/me/sites/site-1/bank-qr';

/** Un PNG cualquiera: lo único que importa es que sea un `File` de imagen. */
function unaImagen(nombre = 'qr-banco-union.png'): File {
  return new File([new Uint8Array([137, 80, 78, 71])], nombre, { type: 'image/png' });
}

async function montar(sede: PracticeSite = SEDE) {
  await TestBed.configureTestingModule({
    imports: [SiteBankQrDialog],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const fixture: ComponentFixture<SiteBankQrDialog> = TestBed.createComponent(SiteBankQrDialog);
  fixture.componentRef.setInput('site', sede);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

/**
 * Espera a que la imagen del QR esté dibujada.
 *
 * La conversión a `data:` URL pasa por `FileReader`, que resuelve en su propio
 * turno: un solo `setTimeout` alcanza unas veces y otras no, y esa es
 * exactamente la prueba que falla un día de cada diez en CI.
 */
async function esperarLaImagen(fixture: ComponentFixture<SiteBankQrDialog>): Promise<void> {
  for (let intento = 0; intento < 20; intento += 1) {
    await new Promise((listo) => setTimeout(listo));
    fixture.detectChanges();
    if (fixture.nativeElement.querySelector('[data-testid="sede-qr-imagen"]') !== null) {
      return;
    }
  }
}

/** Los miembros protegidos, para hablar de lo que hace sin pasar por el DOM. */
function api(fixture: ComponentFixture<SiteBankQrDialog>): Record<string, UnMiembro> {
  return fixture.componentInstance as unknown as Record<string, UnMiembro>;
}

type UnMiembro = { (...args: never[]): unknown; (): unknown } & Record<string, unknown>;

function leer<T>(componente: Record<string, UnMiembro>, nombre: string): T {
  return (componente[nombre] as unknown as () => T)();
}

describe('SiteBankQrDialog — el QR bancario de una sede', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sin QR configurado, el modal ES la zona de soltar', async () => {
    const { fixture, http } = await montar();

    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-archivo"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-imagen"]')).toBeNull();
    // Y no pide ninguna imagen: no hay ninguna que pedir.
    http.verify();
  });

  it('con QR configurado, muestra la imagen y el lápiz para cambiarla', async () => {
    const { fixture, http } = await montar({ ...SEDE, bankQrFileId: 'file-qr' });

    http.expectOne(CONTENIDO).flush(new Blob(['qr'], { type: 'image/png' }));
    await esperarLaImagen(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-imagen"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-archivo"]')).toBeNull();

    const lapiz = fixture.nativeElement.querySelector('[data-testid="sede-qr-reemplazar"]');
    expect(lapiz.getAttribute('aria-label')).toBe(
      'Cambiar el QR bancario de Consultorio Dra. Pérez',
    );
  });

  /**
   * El QR **está** configurado y lo que falló es dibujarlo. Decir «no tenés
   * ninguno» llevaría a cargar otro encima del que ya está.
   */
  it('si la imagen no baja, no se confunde con «no tenés ninguno»', async () => {
    const { fixture, http } = await montar({ ...SEDE, bankQrFileId: 'file-qr' });

    http.expectOne(CONTENIDO).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-sin-imagen"]')).not.toBeNull();
    // Sigue sin ser la zona de soltar: el lápiz es el camino.
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-archivo"]')).toBeNull();
  });

  it('subir es dos pasos: el archivo primero, la sede después', async () => {
    const { fixture, http } = await montar();
    const guardados: string[] = [];
    fixture.componentInstance.saved.subscribe((id) => guardados.push(id));

    (api(fixture)['subir'] as unknown as (a: readonly File[]) => void)([unaImagen()]);

    const subida = http.expectOne((r) => r.url === SUBIDA && r.method === 'POST');
    expect(subida.request.body).toBeInstanceOf(FormData);
    // `IMAGE`/`NORMAL`: un QR no es dato clínico.
    expect((subida.request.body as FormData).get('category')).toBe('IMAGE');
    expect((subida.request.body as FormData).get('sensitivity')).toBe('NORMAL');
    subida.flush({ id: 'file-nuevo' });

    const asociar = http.expectOne((r) => r.url === QR_DE_LA_SEDE && r.method === 'PUT');
    expect(asociar.request.body).toEqual({ fileId: 'file-nuevo' });
    asociar.flush({ ...SEDE, bankQrFileId: 'file-nuevo' });

    // Recién ahí se avisa afuera, con el id que quedó guardado.
    expect(guardados).toEqual(['file-nuevo']);
  });

  /**
   * Si el segundo paso falla, el archivo queda subido y sin dueño. Lo que no
   * puede pasar es que la pantalla diga que quedó guardado.
   */
  it('si la sede rechaza el QR, no se anuncia como guardado', async () => {
    const { fixture, http } = await montar();
    const guardados: string[] = [];
    fixture.componentInstance.saved.subscribe((id) => guardados.push(id));

    (api(fixture)['subir'] as unknown as (a: readonly File[]) => void)([unaImagen()]);
    http.expectOne(SUBIDA).flush({ id: 'file-nuevo' });
    http.expectOne(QR_DE_LA_SEDE).error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    expect(guardados).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-error"]')).not.toBeNull();
    // Y la zona de soltar sigue ahí para reintentar.
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-archivo"]')).not.toBeNull();
  });

  /**
   * Dos archivos soltados sobre una subida en curso terminarían en dos
   * peticiones cuyo orden de llegada decide cuál queda.
   */
  it('mientras sube, no acepta un segundo archivo', async () => {
    const { fixture, http } = await montar();

    (api(fixture)['subir'] as unknown as (a: readonly File[]) => void)([unaImagen()]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-subiendo"]')).not.toBeNull();

    (api(fixture)['subir'] as unknown as (a: readonly File[]) => void)([unaImagen('otro.png')]);
    http.expectOne(SUBIDA);
  });

  it('el lápiz pide otra imagen sin descartar la guardada', async () => {
    const { fixture, http } = await montar({ ...SEDE, bankQrFileId: 'file-qr' });
    http.expectOne(CONTENIDO).flush(new Blob(['qr'], { type: 'image/png' }));
    await esperarLaImagen(fixture);

    fixture.nativeElement.querySelector('[data-testid="sede-qr-reemplazar"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-archivo"]')).not.toBeNull();

    // Y se puede volver: cambiar de opinión no borra lo que ya estaba.
    fixture.nativeElement.querySelector('[data-testid="sede-qr-cancelar"]').click();
    fixture.detectChanges();
    expect(leer<string | null>(api(fixture), 'fileId')).toBe('file-qr');
    expect(fixture.nativeElement.querySelector('[data-testid="sede-qr-imagen"]')).not.toBeNull();
    http.verify();
  });

  it('un archivo que no pasa el formato se explica, y no se sube', async () => {
    const { fixture, http } = await montar();

    (api(fixture)['rechazar'] as unknown as (r: readonly unknown[]) => void)([
      { file: unaImagen('receta.pdf'), reason: 'tipo' },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="sede-qr-error"]').textContent,
    ).toContain('JPG, PNG o WEBP');
    http.verify();
  });
});
