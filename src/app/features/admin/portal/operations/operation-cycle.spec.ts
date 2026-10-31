import { TestBed } from '@angular/core/testing';

import { esperarSinViolaciones } from '../../../../../testing/a11y';
import { OperationCycle } from './operation-cycle';
import { CYCLE_PHASES, NO_COMPROBADO, REQUEST_CYCLE, stagesOf } from './request-cycle';

describe('request-cycle (dato)', () => {
  it('son 21 etapas numeradas de corrido, sin saltos ni repetidas', () => {
    expect(REQUEST_CYCLE.map((s) => s.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
  });

  it('cada etapa nombra al menos un archivo de la API con su línea', () => {
    for (const stage of REQUEST_CYCLE) {
      expect(stage.fuentes.length, `etapa ${stage.n}`).toBeGreaterThan(0);
      for (const f of stage.fuentes) expect(f, `etapa ${stage.n}`).toMatch(/^src\/[\w./-]+\.ts:\d+$/);
    }
  });

  it('las fases cubren todas las etapas y siguen el orden de Nest', () => {
    expect(CYCLE_PHASES.flatMap((p) => stagesOf(p.codigo).map((s) => s.n))).toEqual(REQUEST_CYCLE.map((s) => s.n));
    expect(CYCLE_PHASES.map((p) => p.codigo)).toEqual([
      'MIDDLEWARE',
      'GUARDS',
      'INTERCEPTORES',
      'VALIDACION',
      'HANDLER',
      'EVENTOS',
      'ERRORES',
    ]);
  });

  it('declara lo que no se comprobó en ejecución', () => {
    expect(NO_COMPROBADO.length).toBeGreaterThan(0);
  });
});

describe('OperationCycle', () => {
  function montar(): HTMLElement {
    const fixture = TestBed.createComponent(OperationCycle);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dice que es el ciclo común de la API y no el de la operación', () => {
    const el = montar();
    expect(el.textContent).toContain('Ciclo común de la API, no de esta operación');
    expect(el.textContent).toContain('Estas 21 etapas');
  });

  it('pinta las 21 etapas, cada una con su archivo de origen', () => {
    const el = montar();
    const stages = el.querySelectorAll('.cycle__stage');
    expect(stages).toHaveLength(21);
    expect(stages[0]!.textContent).toContain('Cabeceras de seguridad');
    expect(stages[0]!.textContent).toContain('src/main.ts:162');
    expect(stages[20]!.textContent).toContain('Filtro de errores');
    expect(stages[20]!.textContent).toContain('src/common/filters/all-exceptions.filter.ts:191');
    for (const li of stages) expect(li.querySelectorAll('code').length).toBeGreaterThan(0);
  });

  it('la etapa se anuncia con texto («Etapa 9:»), no sólo con el número dibujado', () => {
    const el = montar();
    const nueve = el.querySelectorAll('.cycle__stage')[8]!;
    expect(nueve.querySelector('.sr-only')!.textContent).toBe('Etapa 9: ');
    expect(nueve.querySelector('.cycle__number')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('agrupa por fase con un encabezado cada una y lista lo no comprobado', () => {
    const el = montar();
    expect([...el.querySelectorAll('h3')].map((h) => h.textContent!.trim())).toEqual([
      'Middleware de Express',
      'Guards globales',
      'Interceptores globales',
      'Validación',
      'Controlador, servicio y repositorio',
      'Eventos',
      'Filtro de errores',
      'Lo que no se comprobó Sin verificar',
    ]);
    expect(el.querySelectorAll('[data-testid="portal-cycle-unverified"] li')).toHaveLength(NO_COMPROBADO.length);
  });

  it('no tiene violaciones de accesibilidad', async () => {
    await esperarSinViolaciones(montar());
  }, 30_000);
});
