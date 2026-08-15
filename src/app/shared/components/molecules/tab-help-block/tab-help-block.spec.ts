import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TutorialEngine } from '../../../../core/tutorials/tutorial.engine';
import {
  HELP_BLOCK_STORAGE,
  type HelpBlockStorageAdapter,
} from '../../../../core/tutorials/help-block-dismissal.store';
import { TabHelpBlock } from './tab-help-block';

/** Host con contenido proyectado de verdad: explicación + ejemplo. */
@Component({
  imports: [TabHelpBlock],
  template: `
    <app-tab-help-block helpId="perfil-trayectoria-ayuda" [tutorialId]="tutorialId">
      <p class="explicacion">Acá se arma la línea de tiempo profesional.</p>
      <p class="ejemplo">Ejemplo: formación en la UMSA, luego Hospital Obrero N.º 1.</p>
    </app-tab-help-block>
  `,
})
class HostComponent {
  tutorialId: string | undefined = 'perfil-profesional';
}

/** Un adaptador en memoria: las pruebas no dependen del `localStorage` real. */
class MemoriaStorage implements HelpBlockStorageAdapter {
  private datos = new Set<string>();
  read(): ReadonlySet<string> {
    return this.datos;
  }
  write(_clave: string, descartadas: ReadonlySet<string>): void {
    this.datos = new Set(descartadas);
  }
}

describe('TabHelpBlock', () => {
  let fixture: ComponentFixture<HostComponent>;
  let storage: MemoriaStorage;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    storage = new MemoriaStorage();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([]), { provide: HELP_BLOCK_STORAGE, useValue: storage }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('muestra la explicación y el ejemplo proyectados', () => {
    expect(host().textContent).toContain('Acá se arma la línea de tiempo profesional.');
    expect(host().textContent).toContain('Ejemplo: formación en la UMSA');
  });

  it('ofrece un botón "Ver tutorial" cuando se declara tutorialId', () => {
    const boton = Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver tutorial'),
    );
    expect(boton).toBeTruthy();
  });

  it('sin tutorialId no ofrece el botón', () => {
    // Fixture nueva, con el campo ya en `undefined` desde el primer
    // `detectChanges`: mutarlo después del primero dispara NG0100 (el modo
    // "sin cambios" de las pruebas detecta la mutación fuera de ciclo).
    const otra = TestBed.createComponent(HostComponent);
    otra.componentInstance.tutorialId = undefined;
    otra.detectChanges();

    const boton = Array.from(
      (otra.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Ver tutorial'));
    expect(boton).toBeUndefined();
  });

  it('"Ver tutorial" dispara el motor con el id correcto', () => {
    const engine = TestBed.inject(TutorialEngine);
    const start = vi.spyOn(engine, 'start').mockResolvedValue(true);

    const boton = Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver tutorial'),
    ) as HTMLButtonElement;
    boton.click();

    expect(start).toHaveBeenCalledWith('perfil-profesional');
  });

  it('cerrar el aviso lo oculta', () => {
    expect(host().textContent).toContain('Acá se arma la línea de tiempo profesional.');

    const cerrar = host().querySelector<HTMLButtonElement>('.alert__dismiss');
    cerrar?.click();
    fixture.detectChanges();

    expect(host().textContent).not.toContain('Acá se arma la línea de tiempo profesional.');
  });

  it('un bloque cerrado sigue cerrado al volver a montarlo (persistencia)', () => {
    host().querySelector<HTMLButtonElement>('.alert__dismiss')?.click();
    fixture.detectChanges();

    const otraVez = TestBed.createComponent(HostComponent);
    otraVez.detectChanges();

    expect(otraVez.nativeElement.textContent).not.toContain(
      'Acá se arma la línea de tiempo profesional.',
    );
  });
});
