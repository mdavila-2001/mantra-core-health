import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RED_CLINICA_SCENARIOS, ScenarioRedClinica } from './red-clinica.scenarios';

/** Cada escenario de la red clínica monta lo que promete. */
describe('escenarios de la red clínica', () => {
  async function montar(variante: string) {
    await TestBed.configureTestingModule({
      imports: [ScenarioRedClinica],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ScenarioRedClinica);
    fixture.componentRef.setInput('variante', variante);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('ids coherentes con clave y variante', () => {
    for (const e of RED_CLINICA_SCENARIOS) expect(e.id).toBe(`${e.clave}#${e.variante}`);
  });

  it.each(RED_CLINICA_SCENARIOS.map((e) => [e.variante]))('«%s» monta filtros, alertas y nodos', async (variante) => {
    const fixture = await montar(variante);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="red-filtros"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="red-alertas"]')).not.toBeNull();
    expect(el.querySelectorAll('[data-testid="escenario-nodo"]')).toHaveLength(14);
    const conPanel = ['estudio', 'diagnostico', 'derivacion', 'reconsulta', 'hoja'].includes(variante);
    expect(el.querySelector('[data-testid="red-panel"]') !== null).toBe(conPanel);
  });

  it('un nodo de la lista abre el panel y un vínculo registra nodoElegido', async () => {
    const fixture = await montar('filtros');
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-testid="escenario-nodo"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="red-panel"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="red-panel-vinculo"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.outputs().map((o) => o.salida)).toContain('nodoElegido');
  });
});
