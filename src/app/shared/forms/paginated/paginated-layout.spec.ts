import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApilarAlEnvolver, columnasDeOpciones } from './paginated-layout';
import type { CampoDeFormulario } from './paginated-form.types';

const campoCon = (n: number): CampoDeFormulario => ({
  key: 'tipo',
  label: 'Tipo',
  control: 'radio',
  options: Array.from({ length: n }, (_, i) => ({ value: `${i}`, label: `Opción ${i}` })),
});

describe('columnasDeOpciones', () => {
  it.each([
    [1, { ancha: 1, media: 1 }],
    [3, { ancha: 3, media: 3 }],
    [4, { ancha: 4, media: 2 }],
    [5, { ancha: 5, media: 3 }],
    [6, { ancha: 3, media: 3 }],
    [7, { ancha: 3, media: 3 }],
  ])('con %i opciones reparte %j', (n, esperado) => {
    expect(columnasDeOpciones(campoCon(n))).toEqual(esperado);
  });

  it('sin opciones no divide por cero', () => {
    expect(columnasDeOpciones({ key: 'x', label: 'X', control: 'radio' })).toEqual({ ancha: 1, media: 1 });
  });
});

@Component({
  imports: [ApilarAlEnvolver],
  template: `
    <nav appApilarAlEnvolver="apiladas">
      <button type="button" id="cancelar">Cancelar</button>
      <button type="button" id="atras">Atrás</button>
      <button type="button" id="envio" data-accion-primaria>Crear</button>
    </nav>
  `,
})
class Host {}

/** Sin layout en jsdom: se simula dónde cae cada botón y si envuelven. */
function simularLayout(nav: HTMLElement, envuelven: () => boolean): void {
  for (const boton of nav.querySelectorAll('button')) {
    Object.defineProperty(boton, 'offsetParent', { get: () => nav, configurable: true });
    Object.defineProperty(boton, 'offsetHeight', { get: () => 40, configurable: true });
    Object.defineProperty(boton, 'offsetTop', {
      get: () => (envuelven() && boton.id !== 'cancelar' ? 100 : 0),
      configurable: true,
    });
  }
}

describe('ApilarAlEnvolver', () => {
  const originales = { ro: globalThis.ResizeObserver };
  let avisar: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        avisar = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.ResizeObserver = originales.ro;
  });

  async function armar(envuelven: { valor: boolean }) {
    const fixture = TestBed.createComponent(Host);
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    simularLayout(nav, () => envuelven.valor);
    fixture.detectChanges();
    await fixture.whenStable();
    avisar();
    vi.advanceTimersByTime(50);
    return nav;
  }

  const orden = (nav: HTMLElement) => [...nav.querySelectorAll('button')].map((b) => b.id);

  it('si entran en un renglón no toca nada: Atrás a la izquierda y el envío a la derecha', async () => {
    const nav = await armar({ valor: false });

    expect(nav.classList.contains('apiladas')).toBe(false);
    expect(orden(nav)).toEqual(['cancelar', 'atras', 'envio']);
  });

  it('si envuelven, apila y sube el envío al principio del DOM: el tabulador sigue lo que se ve', async () => {
    const nav = await armar({ valor: true });

    expect(nav.classList.contains('apiladas')).toBe(true);
    expect(orden(nav)).toEqual(['envio', 'cancelar', 'atras']);
  });

  it('al volver a entrar devuelve el envío a su sitio', async () => {
    const estado = { valor: true };
    const nav = await armar(estado);
    expect(orden(nav)[0]).toBe('envio');

    estado.valor = false;
    avisar();
    vi.advanceTimersByTime(50);

    expect(nav.classList.contains('apiladas')).toBe(false);
    expect(orden(nav)).toEqual(['cancelar', 'atras', 'envio']);
    expect(nav.querySelectorAll('button')).toHaveLength(3);
  });

  it('el botón movido conserva el foco', async () => {
    const estado = { valor: false };
    const nav = await armar(estado);
    const envio = nav.querySelector<HTMLButtonElement>('#envio')!;
    envio.focus();

    estado.valor = true;
    avisar();
    vi.advanceTimersByTime(50);

    expect(orden(nav)[0]).toBe('envio');
    expect(document.activeElement).toBe(envio);
  });

  it('varios avisos seguidos miden una sola vez, en el cuadro siguiente y no dentro del callback', async () => {
    const nav = await armar({ valor: true });
    const antes = vi.spyOn(nav.classList, 'add');

    avisar();
    avisar();
    avisar();
    // Dentro del callback del observador la barra no cambia.
    expect(antes).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);

    expect(antes.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
