import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FreeNoteBlock } from './free-note-block';
import { MeasurementGrid } from '../measurement-grid/measurement-grid';

/**
 * `FreeNoteBlock` — envoltorio `@deprecated` (C7, 2026-09-25).
 *
 * La hoja en blanco (editor de texto libre) se retiró: el propietario pidió
 * homogeneizar la terminología y era uno de los términos con varias formas
 * conviviendo. Lo único que queda es delegar en `MeasurementGrid`, porque
 * `patient-chart.ts` (fuera de mi alcance esta noche) todavía importa esta
 * clase por su nombre viejo — ver el JSDoc de `free-note-block.ts`.
 *
 * Lo que estas pruebas fijan, ya sin la parte retirada:
 * 1. Reenvía `patientProfileId`/`encounterId` a `MeasurementGrid`.
 * 2. Reenvía `(guardada)` tal cual, porque `patient-chart.html` sigue
 *    escuchándolo en `<app-free-note-block>`.
 * 3. `tieneCambiosPendientes` (el contrato `DraftBlock` que el expediente usa
 *    para avisar antes de navegar) sale de la grilla, no de un estado propio.
 */
describe('FreeNoteBlock (envoltorio deprecado sobre MeasurementGrid)', () => {
  let fixture: ComponentFixture<FreeNoteBlock>;
  let http: HttpTestingController;

  function montar(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FreeNoteBlock);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.detectChanges();
  }

  afterEach(() => {
    // MeasurementGrid pide su propio catálogo al montarse; no es el objeto de
    // este spec (ya cubierto en measurement-grid.spec.ts), así que se descarta.
    for (const pedido of http.match(() => true)) {
      pedido.flush({ items: [] });
    }
  });

  it('monta `app-measurement-grid` con el paciente y el encuentro recibidos', () => {
    montar();

    const grilla = fixture.nativeElement.querySelector('app-measurement-grid');
    expect(grilla).not.toBeNull();
  });

  it('no ofrece nada de la hoja en blanco retirada', () => {
    montar();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Hoja en blanco');
    expect(fixture.nativeElement.querySelector('app-rich-text-editor')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-tabs')).toBeNull();
  });

  it('reenvía `guardada` cuando la grilla la emite', () => {
    montar();
    const emitido = vi.fn();
    fixture.componentInstance.guardada.subscribe(emitido);

    fixture.debugElement.query(By.directive(MeasurementGrid)).triggerEventHandler('guardada', undefined);
    fixture.detectChanges();

    expect(emitido).toHaveBeenCalled();
  });
});
