import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { VisorDeImagenes, type ImagenDelVisor } from './visor-de-imagenes';

const foto = (n: number, accionable = true): ImagenDelVisor => ({
  clave: `m-${n}`,
  url: `data:image/png;base64,AAA${n}`,
  alt: `Foto ${n}`,
  pie: `Dra. Quispe · 10:0${n}`,
  nombreArchivo: `foto-${n}.png`,
  accionable,
});

@Component({
  imports: [VisorDeImagenes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" id="miniatura">miniatura</button>
    @if (abierto()) {
      <app-visor-de-imagenes
        [imagenes]="imagenes()"
        [(indice)]="indice"
        (cerrado)="abierto.set(false)"
        (responder)="respondida = $event"
        (reenviar)="reenviada = $event"
      />
    }
  `,
})
class Anfitrion {
  readonly imagenes = signal<readonly ImagenDelVisor[]>([foto(1), foto(2), foto(3)]);
  readonly indice = signal(0);
  readonly abierto = signal(false);
  respondida = '';
  reenviada = '';
}

/**
 * El visor: Escape cierra, ← y → recorren, el foco entra al botón de cerrar,
 * no se escapa con Tab y vuelve a la miniatura al salir.
 */
describe('VisorDeImagenes', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  const q = <T extends HTMLElement>(testid: string): T | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const tecla = (key: string, shiftKey = false): void => {
    q('hilo-visor')!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  const abrir = async (indice = 0): Promise<void> => {
    (fixture.nativeElement.querySelector('#miniatura') as HTMLButtonElement).focus();
    anfitrion.indice.set(indice);
    anfitrion.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('abre en la foto pedida, dice cuál es y enfoca «Cerrar»', async () => {
    await abrir(1);

    expect(q<HTMLImageElement>('hilo-visor-foto')?.getAttribute('alt')).toBe('Foto 2');
    expect(q('hilo-visor-posicion')?.textContent?.trim()).toBe('2 de 3');
    expect(document.activeElement).toBe(q('hilo-visor-cerrar'));
  });

  it('← y → recorren las fotos sin pasarse de los extremos', async () => {
    await abrir(0);

    tecla('ArrowLeft');
    expect(anfitrion.indice()).toBe(0);
    expect(q('hilo-visor-anterior')).toBeNull();

    tecla('ArrowRight');
    tecla('ArrowRight');
    expect(anfitrion.indice()).toBe(2);
    expect(q('hilo-visor-siguiente')).toBeNull();
    tecla('ArrowRight');
    expect(anfitrion.indice()).toBe(2);

    (q<HTMLButtonElement>('hilo-visor-anterior'))!.click();
    fixture.detectChanges();
    expect(anfitrion.indice()).toBe(1);
  });

  it('Escape cierra y el foco vuelve a la miniatura', async () => {
    await abrir(0);

    tecla('Escape');

    expect(q('hilo-visor')).toBeNull();
    expect(document.activeElement?.id).toBe('miniatura');
  });

  it('Tab no se escapa del visor', async () => {
    await abrir(1);
    const cerrar = q<HTMLButtonElement>('hilo-visor-cerrar')!;
    const primero = q<HTMLButtonElement>('hilo-visor-responder')!;

    cerrar.focus();
    // «Cerrar» no es el último: después vienen los pasos. Se va al último.
    const nodos = Array.from(
      q('hilo-visor')!.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );
    nodos[nodos.length - 1]!.focus();
    tecla('Tab');
    expect(document.activeElement).toBe(primero);

    tecla('Tab', true);
    expect(document.activeElement).toBe(nodos[nodos.length - 1]);
  });

  it('descargar baja la foto actual con su nombre', async () => {
    await abrir(2);

    const enlace = q<HTMLAnchorElement>('hilo-visor-descargar')!;
    expect(enlace.getAttribute('href')).toBe('data:image/png;base64,AAA3');
    expect(enlace.getAttribute('download')).toBe('foto-3.png');
  });

  it('responder y reenviar avisan con la clave; una foto que sube no los ofrece', async () => {
    await abrir(0);
    q<HTMLButtonElement>('hilo-visor-responder')!.click();
    q<HTMLButtonElement>('hilo-visor-reenviar')!.click();
    expect(anfitrion.respondida).toBe('m-1');
    expect(anfitrion.reenviada).toBe('m-1');

    anfitrion.imagenes.set([foto(1, false)]);
    fixture.detectChanges();
    expect(q('hilo-visor-responder')).toBeNull();
    expect(q('hilo-visor-posicion')).toBeNull();
  });
});
