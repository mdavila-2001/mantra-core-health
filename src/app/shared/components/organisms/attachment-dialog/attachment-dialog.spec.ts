import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { AttachmentDialog } from './attachment-dialog';

/**
 * El envoltorio que saca el subidor de archivos de adentro de la fila.
 *
 * Lo que estas pruebas fijan no es cómo se sube un archivo —eso lo fija
 * `attachment-uploader.spec`— sino las dos cosas que este componente agrega:
 * que el subidor quede **dentro del modal** y que haya **una sola salida**,
 * porque los tres consumidores tenían que acordarse de cerrar en dos eventos
 * distintos y olvidarse de uno dejaba el modal abierto sobre una tarea hecha.
 */
@Component({
  imports: [AttachmentDialog],
  template: `
    @if (abierto()) {
      <app-attachment-dialog
        ownerType="CONDITION"
        ownerId="c-1"
        heading="Adjuntar al diagnóstico"
        (attached)="adjuntados = adjuntados + 1"
        (closed)="abierto.set(false)"
      />
    }
  `,
})
class Anfitrion {
  readonly abierto = signal(true);
  adjuntados = 0;
}

describe('AttachmentDialog', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('monta el subidor dentro del modal, no suelto en la página', () => {
    const modal = raiz().querySelector('app-content-dialog');
    expect(modal).not.toBeNull();
    expect(modal?.querySelector('app-attachment-uploader')).not.toBeNull();
  });

  it('el título es el que le pasa quien lo usa', () => {
    expect(raiz().textContent).toContain('Adjuntar al diagnóstico');
  });

  /**
   * La salida por «Listo, sin adjuntar» / `Escape` / el fondo llega por
   * `closed` de `content-dialog`, y este componente la reemite tal cual.
   */
  it('cerrar el modal sin subir nada avisa una vez y no cuenta un adjunto', () => {
    const dialogo = fixture.debugElement.query(
      (nodo) => nodo.name === 'app-content-dialog',
    ).componentInstance as { closed: { emit: () => void } };
    dialogo.closed.emit();
    fixture.detectChanges();

    expect(anfitrion.abierto()).toBe(false);
    expect(anfitrion.adjuntados).toBe(0);
  });

  /**
   * Adjuntar **también** cierra: es la línea que los tres consumidores
   * repetían, y el motivo por el que este envoltorio existe.
   */
  it('adjuntar avisa y cierra, sin que quien lo usa tenga que acordarse', () => {
    const subidor = fixture.debugElement.query(
      (nodo) => nodo.name === 'app-attachment-uploader',
    ).componentInstance as { attached: { emit: () => void } };
    subidor.attached.emit();
    fixture.detectChanges();

    expect(anfitrion.adjuntados).toBe(1);
    expect(anfitrion.abierto()).toBe(false);
    expect(raiz().querySelector('app-content-dialog')).toBeNull();
  });
});
