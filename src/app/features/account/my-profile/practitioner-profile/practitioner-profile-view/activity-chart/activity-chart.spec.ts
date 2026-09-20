import { TestBed } from '@angular/core/testing';

import { ActivityChart } from './activity-chart';
import type { PuntoDeSerie } from '../practitioner-profile-view.types';

/**
 * El gráfico de consultas mes a mes.
 *
 * Lo que se fija acá es lo que el pedido tiene de observable: que el alto sea
 * proporcional al máximo, que un mes en cero no dibuje barra, y que el dato
 * viaje también en una tabla — las barras son `aria-hidden` y sin la tabla la
 * serie no existiría para un lector de pantalla.
 */
describe('ActivityChart', () => {
  const punto = (clave: string, valor: number): PuntoDeSerie => ({
    clave,
    etiqueta: clave.slice(5),
    etiquetaLarga: `mes ${clave}`,
    valor,
  });

  function montar(puntos: readonly PuntoDeSerie[]): HTMLElement {
    TestBed.configureTestingModule({ imports: [ActivityChart] });
    const fixture = TestBed.createComponent(ActivityChart);
    fixture.componentRef.setInput('puntos', puntos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('el alto de cada barra es su proporción del mes más alto', () => {
    const raiz = montar([punto('2026-07', 10), punto('2026-08', 20), punto('2026-09', 5)]);

    const altos = [...raiz.querySelectorAll<HTMLElement>('.grafico__barra')].map(
      (barra) => barra.style.height,
    );
    expect(altos).toEqual(['50%', '100%', '25%']);
  });

  it('un mes sin consultas no dibuja barra: cero es cero', () => {
    const raiz = montar([punto('2026-08', 12), punto('2026-09', 0)]);

    const altos = [...raiz.querySelectorAll<HTMLElement>('.grafico__barra')].map(
      (barra) => barra.style.height,
    );
    expect(altos).toEqual(['100%', '0%']);
    // Pero el mes sigue rotulado: la serie no puede saltearse un mes.
    expect([...raiz.querySelectorAll('.grafico__mes')]).toHaveLength(2);
  });

  it('sólo el mes más alto lleva su cifra encima', () => {
    const raiz = montar([punto('2026-07', 10), punto('2026-08', 20), punto('2026-09', 5)]);

    const cifras = [...raiz.querySelectorAll('.grafico__cifra')].map((c) => c.textContent?.trim());
    expect(cifras).toEqual(['20']);
  });

  it('el resumen suma, promedia y nombra el mejor mes', () => {
    const raiz = montar([punto('2026-08', 10), punto('2026-09', 20)]);

    const resumen =
      raiz.querySelector('.grafico__resumen')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(resumen).toContain('30 en 2 meses');
    expect(resumen).toContain('15 por mes');
    expect(resumen).toContain('mes 2026-09');
  });

  it('el dato también viaja en una tabla: las barras no se leen en voz alta', () => {
    const raiz = montar([punto('2026-08', 10), punto('2026-09', 20)]);

    expect(raiz.querySelector('.grafico__barras')?.getAttribute('aria-hidden')).toBe('true');
    const filas = [...raiz.querySelectorAll('tbody tr')].map((fila) =>
      [...fila.children].map((celda) => celda.textContent?.trim()),
    );
    expect(filas).toEqual([
      ['mes 2026-08', '10'],
      ['mes 2026-09', '20'],
    ]);
  });
});
