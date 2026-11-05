import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Input } from './input';

/**
 * Detector de ejecución. Un doble de `window.alert` no sirve en este corredor:
 * jsdom corre los manejadores inline en su propio contexto y llama a SU `alert`,
 * no al del objeto que ven las pruebas (medido: el doble nunca se llamaba).
 * Por eso las cargas, en vez de `alert(1)`, escriben una marca en el DOM
 * —`data-xss` en `<html>`— que se ve desde cualquier contexto.
 */
const MARCA = 'data-xss';
function limpiarMarca(): void {
  document.documentElement.removeAttribute(MARCA);
}
/** Dispara los eventos que activan un manejador inline y dice si alguno corrió. */
function ejecutado(): boolean {
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const conManejador = el.getAttributeNames().some((a) => /^on/i.test(a));
    for (const tipo of ['error', 'load', 'toggle', 'focus', 'mouseover', 'animationstart', ...(conManejador ? ['click'] : [])]) {
      el.dispatchEvent(new Event(tipo));
    }
  }
  return document.documentElement.hasAttribute(MARCA);
}

/**
 * M-4 / O3-5 — `input.html:3`: los íconos del campo van **proyectados** y no por
 * `[innerHTML]`. Lo que se fija: ningún texto que reciba el campo (valor,
 * placeholder, etiqueta accesible, `testId`) se vuelve marcado, y lo que se
 * proyecta en el hueco del ícono es el nodo que el padre armó con su propia
 * plantilla, no un string reinterpretado.
 */

const HOSTIL = '"><img src=x onerror=document.documentElement.dataset.xss=1><script>document.documentElement.dataset.xss=1</script><svg onload=document.documentElement.dataset.xss=1>';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Input],
  template: `<app-input [placeholder]="texto" [ariaLabel]="texto"><span slot="icon-start" class="mi-icono">{{ texto }}</span></app-input>`,
})
class ConIcono {
  readonly texto = HOSTIL;
}

describe('Input · textos hostiles (M-4, input.html:3)', () => {

  beforeEach(async () => {
    limpiarMarca();
    await TestBed.configureTestingModule({ imports: [Input, ConIcono] }).compileComponents();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    // Un manejador que corre en una tarea posterior (p. ej. `ontoggle`) también cuenta.
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
  });

  it('valor, placeholder, etiqueta y testId hostiles quedan como propiedades/atributos, sin marcado nuevo', async () => {
    const fixture: ComponentFixture<Input> = TestBed.createComponent(Input);
    fixture.componentRef.setInput('value', HOSTIL);
    fixture.componentRef.setInput('placeholder', HOSTIL);
    fixture.componentRef.setInput('ariaLabel', HOSTIL);
    fixture.componentRef.setInput('testId', HOSTIL);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const nativo = root.querySelector('input')!;
    expect(nativo.value).toBe(HOSTIL);
    expect(nativo.getAttribute('placeholder')).toBe(HOSTIL);
    expect(nativo.getAttribute('aria-label')).toBe(HOSTIL);
    expect(root.querySelector('img, script, svg[onload]')).toBeNull();
    expect(root.querySelectorAll('input')).toHaveLength(1);
    expect(ejecutado()).toBe(false);
  });

  it('el tipo search dibuja su lupa constante, sin manejadores', async () => {
    const fixture = TestBed.createComponent(Input);
    fixture.componentRef.setInput('type', 'search');
    fixture.componentRef.setInput('value', HOSTIL);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const svgs = Array.from(root.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);
    for (const nodo of Array.from(root.querySelectorAll('svg, svg *'))) {
      expect(nodo.getAttributeNames().some((a) => /^on/i.test(a))).toBe(false);
    }
    expect(root.querySelector('img, script')).toBeNull();
  });

  it('lo proyectado en el hueco del ícono es el nodo del padre, con el texto hostil como texto', async () => {
    const fixture = TestBed.createComponent(ConIcono);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const icono = root.querySelector('app-input .mi-icono');
    expect(icono).not.toBeNull();
    expect(icono!.textContent).toBe(HOSTIL);
    expect(root.querySelector('img, script, svg[onload]')).toBeNull();
    expect(ejecutado()).toBe(false);
  });
});
