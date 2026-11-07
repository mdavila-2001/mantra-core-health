import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { loading } from '../../../../core/view-state/view-state';
import { recorridoDelPaciente } from './episodios';
import { MiRecorrido } from './mi-recorrido';
import { AHORA, codigo, etiqueta, fuentes, ORDENES } from './mi-recorrido.fixtures';
import { registrosDelPortal } from './registro-con-vinculos';

describe('MiRecorrido', () => {
  let fixture: ComponentFixture<MiRecorrido>;
  let raiz: HTMLElement;

  beforeEach(() => {
    // jsdom no implementa `showModal`: el cajón cae al atributo `open`.
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(MiRecorrido);
    fixture.componentRef.setInput(
      'recorrido',
      recorridoDelPaciente(registrosDelPortal(fuentes(), etiqueta, codigo, AHORA)),
    );
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  });

  const clic = (selector: string, indice = 0): void => {
    raiz.querySelectorAll<HTMLButtonElement>(selector)[indice]!.click();
    fixture.detectChanges();
  };

  const conOrdenes = (ordenes: typeof ORDENES): void => {
    fixture.componentRef.setInput(
      'recorrido',
      recorridoDelPaciente(registrosDelPortal(fuentes({ ordenes }), etiqueta, codigo, AHORA)),
    );
    fixture.detectChanges();
  };

  it('dibuja el hilo, las otras consultas y el grupo de descartados plegados', () => {
    const hilos = raiz.querySelectorAll('[data-testid="recorrido-hilo"]');
    expect(hilos).toHaveLength(2);
    expect(hilos[0].textContent).toContain('Cefalea tensional · Confirmado');
    expect(hilos[1].textContent).toContain('Otras consultas');
    for (const hilo of Array.from(hilos)) {
      expect(hilo.querySelector('.accordion-panel__trigger')?.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('el descartado del camino queda plegado dentro del hilo', () => {
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger');
    const plegado = raiz.querySelector('[data-testid="recorrido-descartados-en-el-camino"]');
    expect(plegado?.textContent).toContain('Lo que se descartó en el camino (1)');
    expect(plegado?.textContent).not.toContain('Migraña · se descartó');
  });

  it('un clic en un estudio abre su hoja con el enlace al resultado', () => {
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger');
    clic('[data-testid="recorrido-atencion"] .accordion-panel__trigger');
    clic('[data-testid="recorrido-hecho-estudio"]');

    const detalle = raiz.querySelector('[data-testid="recorrido-detalle"]');
    expect(detalle?.textContent).toContain('Disponible');
    const enlace = raiz.querySelector<HTMLAnchorElement>('[data-testid="recorrido-ver-resultado"]');
    expect(enlace?.getAttribute('href')).toBe('/my-account/diagnostic-results#rep-1');
  });

  it('el paso a paso no avanza más allá del último paso, y «Ver el registro» abre su hoja', () => {
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger');
    clic('[data-testid="recorrido-empezar-guiado"]');
    expect(raiz.querySelector('[data-testid="recorrido-anterior"]')?.getAttribute('aria-disabled')).toBe('true');

    for (let i = 0; i < 20; i++) clic('[data-testid="recorrido-siguiente"]');
    expect(raiz.querySelector('[data-testid="recorrido-narracion"]')?.textContent?.trim()).toBe(
      'El 10 de marzo de 2026 volvió a control.',
    );
    expect(raiz.querySelector('[data-testid="recorrido-siguiente"]')?.getAttribute('aria-disabled')).toBe('true');

    clic('[data-testid="recorrido-ver-registro"]');
    expect(raiz.querySelector('[data-testid="recorrido-detalle"]')?.textContent).toContain('Realizado');
  });

  it('una receta ofrece la descarga oficial por la salida, sin descargar por su cuenta', () => {
    const pedidas: string[] = [];
    fixture.componentInstance.descargarReceta.subscribe((id) => pedidas.push(id));
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger');
    clic('[data-testid="recorrido-atencion"] .accordion-panel__trigger', 1);
    clic('[data-testid="recorrido-hecho-receta"]');
    clic('[data-testid="recorrido-descargar-receta"]');
    expect(pedidas).toEqual(['rx-1']);
  });

  it('marca el vínculo ausente en la hoja, sin inventarlo', () => {
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger', 1);
    clic('[data-testid="recorrido-atencion"] .accordion-panel__trigger');
    clic('[data-testid="recorrido-hecho-estudio"]');
    expect(raiz.querySelector('[data-testid="recorrido-detalle-ausente"]')?.textContent).toContain(
      'No consta para qué diagnóstico se pidió.',
    );
  });

  it('mientras llegan los estudios dice qué falta y qué ya se puede leer', () => {
    fixture.componentRef.setInput('detalle', loading());
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid="recorrido-cargando"]')?.textContent?.trim()).toBe(
      'Todavía estamos cargando sus estudios y controles. El resto ya está a la vista.',
    );
  });

  it('lo que solo comparte la consulta dice que se hizo por otro motivo, sin jerga del modelo', () => {
    conOrdenes([...ORDENES, { ...ORDENES[1], id: 'sr-otro', encounterId: 'e1' }]);
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger');
    clic('[data-testid="recorrido-atencion"] .accordion-panel__trigger');
    const marcas = Array.from(raiz.querySelectorAll('.recorrido__hecho.is-indirecto .recorrido__hecho-marca'));
    expect(marcas.map((m) => m.textContent?.trim())).toEqual(['Se hizo en esta consulta, por otro motivo']);
    expect(raiz.textContent).not.toContain('vínculo');
  });

  it('lo registrado fuera de una consulta lo dice en voz activa', () => {
    conOrdenes([
      ...ORDENES,
      { ...ORDENES[1], id: 'sr-suelto', encounterId: undefined, reasonConditionId: 'c-tensional' },
    ]);
    clic('[data-testid="recorrido-hilo"] .accordion-panel__trigger');
    const sueltos = raiz.querySelector('.recorrido__hechos--fuera-de-la-linea');
    expect(sueltos?.getAttribute('aria-label')).toBe('Registros que se hicieron fuera de una consulta');
    expect(sueltos?.querySelector('.recorrido__hecho-marca')?.textContent?.trim()).toBe(
      'Se registró fuera de una consulta',
    );
  });
});
