import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MS_POR_PASO, RecorridoGuiado, type PasoActualDelRecorrido } from './recorrido-guiado';
import type { PasoDelRecorrido } from './recorrido-guiado.model';

/**
 * El control en pantalla. La narración se prueba en el modelo; acá, lo que
 * promete el control: moverse, saltar, emitir el foco, reproducir y pausar,
 * el teclado, y no reproducir solo cuando el sistema pide menos movimiento.
 */
const paso = (n: number, ids: readonly string[], revelados: readonly string[]): PasoDelRecorrido => ({
  clave: `2026-02-0${n}`,
  fecha: new Date(Date.UTC(2026, 1, n)),
  fechaTexto: `${n} feb 2026`,
  titulo: `Título ${n}`,
  narracion: `El ${n} feb 2026 pasó la cosa ${n}.`,
  frases: [{ texto: `El ${n} feb 2026 pasó la cosa ${n}.`, fuentes: ids, inferida: false }],
  enfocar: ids,
  revelados,
});

const PASOS: readonly PasoDelRecorrido[] = [
  paso(1, ['a'], ['a']),
  paso(2, ['b'], ['a', 'b']),
  paso(3, ['c', 'a'], ['a', 'b', 'c']),
];

@Component({
  imports: [RecorridoGuiado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-recorrido-guiado
      [pasos]="pasos()"
      [episodio]="episodio()"
      [nombreDelEpisodio]="nombre()"
      [interaccionEnLaRed]="interaccion()"
      [integrada]="integrada()"
      (pasoActual)="emitidos.push($event)"
    />
  `,
})
class Anfitrion {
  readonly pasos = signal<readonly PasoDelRecorrido[]>(PASOS);
  readonly episodio = signal<readonly string[] | null>(null);
  readonly nombre = signal<string | null>(null);
  readonly interaccion = signal(0);
  readonly integrada = signal(false);
  readonly emitidos: PasoActualDelRecorrido[] = [];
}

function simularMovimiento(reducido: boolean): void {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('reduce'),
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('RecorridoGuiado', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let host: Anfitrion;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const por = <T extends HTMLElement = HTMLElement>(testId: string): T => {
    const el = raiz().querySelector<T>(`[data-testid="${testId}"]`);
    if (el === null) throw new Error(`no está ${testId}`);
    return el;
  };
  const boton = (testId: string): HTMLButtonElement => por<HTMLButtonElement>(testId);
  const tecla = (key: string, en: HTMLElement = por('recorrido-guiado')): void => {
    en.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  function montar(reducido = false): void {
    simularMovimiento(reducido);
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('integrada en otra superficie, pierde su tarjeta propia (clase en el anfitrión)', () => {
    montar();
    const anfitrion = raiz().querySelector('app-recorrido-guiado')!;
    expect(anfitrion.classList).not.toContain('recorrido-guiado--integrada');
    host.integrada.set(true);
    fixture.detectChanges();
    expect(anfitrion.classList).toContain('recorrido-guiado--integrada');
  });

  it('muestra el primer paso con contador, fecha y narración en una región viva', () => {
    montar();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 1 de 3');
    expect(por('guiado-narracion').textContent).toContain('pasó la cosa 1');
    expect(por('guiado-relato').getAttribute('aria-live')).toBe('polite');
    expect(raiz().querySelector('time')?.getAttribute('datetime')).toBe('2026-02-01');
  });

  it('una frase inferida lo dice en palabras, no sólo con el estilo', () => {
    simularMovimiento(false);
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    const [primero, ...resto] = PASOS;
    host.pasos.set([
      {
        ...primero!,
        frases: [
          { texto: 'Se atendió.', fuentes: ['a'], inferida: false },
          { texto: 'Se pidió un hemograma en la misma atención.', fuentes: ['a'], inferida: true },
        ],
      },
      ...resto,
    ]);
    fixture.detectChanges();
    fixture.detectChanges();
    const marcas = raiz().querySelectorAll('[data-testid="guiado-inferido"]');
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.textContent).toContain('inferido');
    expect(marcas[0]!.closest('.guiado__frase')?.textContent).toContain('en la misma atención');
    expect(por('guiado-narracion').textContent?.replace(/\s+/g, ' ')).toContain('Se atendió. Se pidió un hemograma en la misma atención. (inferido)');
  });

  it('emite el paso inicial con lo que hay que enfocar y lo revelado', () => {
    montar();
    expect(host.emitidos.at(-1)).toMatchObject({ indice: 0, total: 3, enfocar: ['a'], revelados: ['a'] });
  });

  it('siguiente y anterior se mueven y se deshabilitan en los extremos', () => {
    montar();
    expect(boton('guiado-anterior').getAttribute('aria-disabled')).toBe('true');
    boton('guiado-siguiente').click();
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 2 de 3');
    expect(host.emitidos.at(-1)?.enfocar).toEqual(['b']);
    boton('guiado-siguiente').click();
    fixture.detectChanges();
    expect(boton('guiado-siguiente').getAttribute('aria-disabled')).toBe('true');
    expect(host.emitidos.at(-1)?.revelados).toEqual(['a', 'b', 'c']);
    boton('guiado-anterior').click();
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 2 de 3');
  });

  it('la línea de progreso salta al paso y marca el actual', () => {
    montar();
    boton('guiado-segmento-2').click();
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 3 de 3');
    expect(boton('guiado-segmento-2').getAttribute('aria-current')).toBe('step');
    expect(boton('guiado-segmento-0').getAttribute('aria-current')).toBeNull();
    expect(boton('guiado-segmento-0').classList).toContain('is-revelado');
    expect(boton('guiado-segmento-1').getAttribute('aria-label')).toBe('Ir al paso 2 de 3: 2 feb 2026, Título 2');
  });

  it('las flechas, Inicio y Fin mueven el paso', () => {
    montar();
    tecla('ArrowRight');
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 2 de 3');
    tecla('End');
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 3 de 3');
    tecla('ArrowLeft');
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 2 de 3');
    tecla('Home');
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 1 de 3');
  });

  it('con el foco en la línea de progreso, las flechas llevan el foco al segmento nuevo', () => {
    montar();
    const primero = boton('guiado-segmento-0');
    primero.focus();
    tecla('ArrowRight', primero);
    expect(document.activeElement).toBe(boton('guiado-segmento-1'));
  });

  it('las flechas dentro del selector de velocidad no cambian de paso', () => {
    montar();
    const radio = raiz().querySelector<HTMLElement>('[role="radio"]');
    if (radio === null) throw new Error('no está el selector de velocidad');
    tecla('ArrowRight', radio);
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 1 de 3');
  });

  it('reproduce paso a paso y se detiene en el último', () => {
    vi.useFakeTimers();
    montar();
    boton('guiado-reproducir').click();
    fixture.detectChanges();
    expect(boton('guiado-reproducir').textContent).toContain('Pausar');
    vi.advanceTimersByTime(MS_POR_PASO.normal);
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 2 de 3');
    vi.advanceTimersByTime(MS_POR_PASO.normal);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 3 de 3');
    expect(boton('guiado-reproducir').textContent).toContain('Reproducir');
    vi.advanceTimersByTime(MS_POR_PASO.normal * 3);
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 3 de 3');
  });

  it('el espacio alterna reproducir y pausa', () => {
    vi.useFakeTimers();
    montar();
    tecla(' ');
    expect(boton('guiado-reproducir').textContent).toContain('Pausar');
    tecla(' ');
    expect(boton('guiado-reproducir').textContent).toContain('Reproducir');
    vi.advanceTimersByTime(MS_POR_PASO.normal * 2);
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 1 de 3');
  });

  it('tocar la red pausa la reproducción', () => {
    vi.useFakeTimers();
    montar();
    boton('guiado-reproducir').click();
    fixture.detectChanges();
    host.interaccion.set(1);
    fixture.detectChanges();
    expect(boton('guiado-reproducir').textContent).toContain('Reproducir');
    vi.advanceTimersByTime(MS_POR_PASO.normal * 2);
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 1 de 3');
  });

  it('con movimiento reducido no reproduce solo: botón deshabilitado y aviso', () => {
    montar(true);
    expect(boton('guiado-reproducir').getAttribute('aria-disabled')).toBe('true');
    expect(por('guiado-aviso-movimiento').textContent).toContain('reducir el movimiento');
    tecla(' ');
    expect(boton('guiado-reproducir').textContent).toContain('Reproducir');
    // Lo manual sigue funcionando.
    tecla('ArrowRight');
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 2 de 3');
  });

  it('siguiendo un episodio recorre sólo sus pasos y lo dice', () => {
    montar();
    host.episodio.set(['c']);
    host.nombre.set('Cefalea');
    fixture.detectChanges();
    expect(por('guiado-contador').textContent?.trim()).toBe('Paso 1 de 1');
    expect(por('guiado-episodio').textContent).toContain('Siguiendo: Cefalea');
    expect(host.emitidos.at(-1)).toMatchObject({ indice: 0, total: 1, enfocar: ['c'], revelados: ['c'] });
  });

  it('sin pasos muestra un vacío que dice qué lo va a llenar', () => {
    montar();
    host.pasos.set([]);
    fixture.detectChanges();
    expect(por('guiado-vacio').textContent).toContain('Cuando se registre la primera atención');
    expect(raiz().querySelector('[data-testid="recorrido-guiado"]')).toBeNull();
  });
});
