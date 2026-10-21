import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DialogService } from '@shared/components/molecules/dialog/dialog-service';

import { ComposerDialog } from './composer-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ComposerDialog],
  template: `<app-composer-dialog
    profileId="pp-1"
    autorNombre="Dra. López"
    autorIniciales="DL"
    [enfocarImagenes]="conFoto"
    (publicado)="publicados.push($event)"
    (cerrado)="cierres = cierres + 1"
  />`,
})
class Host {
  conFoto = false;
  publicados: string[] = [];
  cierres = 0;
}

describe('ComposerDialog — la ventana de «Crear publicación»', () => {
  let fixture: ComponentFixture<Host>;
  let http: HttpTestingController;
  let confirmarDescarte: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  async function montar(descartar = true, conFoto = false): Promise<void> {
    confirmarDescarte = vi.fn(() => Promise.resolve(descartar));
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogService, useValue: { confirmarDescarte } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.conFoto = conFoto;
    await fixture.whenStable();
  }

  async function escribir(valor: string): Promise<void> {
    const area = root().querySelector('textarea') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  afterEach(() => {
    http?.verify({ ignoreCancelled: true });
    fixture?.destroy();
  });

  it('es un modal con nombre accesible y el compositor adentro', async () => {
    await montar();

    expect(q('content-dialog-title')?.textContent).toContain('Crear una publicación');
    expect(q('post-composer')).not.toBeNull();
    expect(q('post-composer-author')?.textContent).toContain('Dra. López');
  });

  it('sin nada escrito cierra directo, sin preguntar', async () => {
    await montar();

    q('content-dialog-close')?.click();
    await fixture.whenStable();

    expect(confirmarDescarte).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cierres).toBe(1);
  });

  it('con algo escrito PREGUNTA antes de descartar; si no se confirma, no cierra y no pierde nada', async () => {
    await montar(false);
    await escribir('Un caso de la guardia.');

    q('content-dialog-close')?.click();
    await fixture.whenStable();

    expect(confirmarDescarte).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.cierres).toBe(0);
    expect((root().querySelector('textarea') as HTMLTextAreaElement).value).toBe('Un caso de la guardia.');
  });

  it('con algo escrito y confirmando el descarte, cierra', async () => {
    await montar(true);
    await escribir('Un caso de la guardia.');

    q('content-dialog-close')?.click();
    await fixture.whenStable();

    expect(confirmarDescarte).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.cierres).toBe(1);
  });

  it('al publicar emite el id y se cierra SIN preguntar: ya no hay nada que descartar', async () => {
    await montar(false);
    await escribir('Hola a todos.');

    const publicar = Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Public'))!;
    publicar.click();
    http.expectOne((r) => r.url === '/community/profiles/pp-1/posts').flush({ id: 'post-9' });
    await fixture.whenStable();

    expect(fixture.componentInstance.publicados).toEqual(['post-9']);
    expect(confirmarDescarte).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cierres).toBe(1);
  });

  it('si publicar falla NO se cierra: lo escrito sigue ahí', async () => {
    await montar();
    await escribir('Hola a todos.');

    const publicar = Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Public'))!;
    publicar.click();
    http.expectOne((r) => r.url === '/community/profiles/pp-1/posts').flush({ message: 'x' }, { status: 500, statusText: 'x' });
    await fixture.whenStable();

    expect(fixture.componentInstance.cierres).toBe(0);
    expect(fixture.componentInstance.publicados).toEqual([]);
    expect((root().querySelector('textarea') as HTMLTextAreaElement).value).toBe('Hola a todos.');
  });
});
