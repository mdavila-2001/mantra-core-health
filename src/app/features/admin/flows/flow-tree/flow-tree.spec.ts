import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { esperarSinViolaciones } from '../../../../../testing/a11y';
import { flujo } from '../flows.fixture';
import { FlowTree } from './flow-tree';

describe('FlowTree', () => {
  let fixture: ComponentFixture<FlowTree>;
  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const qa = (selector: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function montar(nodos = flujo().nodes, raiz = 'decidir'): void {
    fixture = TestBed.createComponent(FlowTree);
    fixture.componentRef.setInput('nodes', nodos);
    fixture.componentRef.setInput('rootId', raiz);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FlowTree] }).compileComponents();
  });

  it('dibuja cada nodo una sola vez, aunque varias ramas lleven a él', () => {
    montar();
    const ids = qa('[data-testid^="flow-node-"]').map((n) => n.getAttribute('data-testid'));
    expect(ids).toEqual(['flow-node-decidir', 'flow-node-cobrar', 'flow-node-fin', 'flow-node-reclamo', 'flow-node-qr']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('el destino que se dibuja en otro lugar se nombra: «continúa en» y «vuelve a»', () => {
    montar();
    expect(texto()).toContain('↪ Continúa en «Consulta cobrada»');
    expect(texto()).toContain('↺ Vuelve a «¿Tiene seguro?»');
  });

  it('un endpoint declarado y uno ausente del contrato se distinguen con texto, no sólo con color', () => {
    montar();
    expect(q('[data-testid="flow-endpoint-cobrar"]')!.textContent).toContain('POST /cobros/{id}');
    expect(q('[data-testid="flow-contract-cobrar"]')!.textContent).toContain('En el contrato');
    expect(q('[data-testid="flow-contract-reclamo"]')!.textContent).toContain('No existe en el contrato');
  });

  it('un paso sin endpoint dice «Sin endpoint» y muestra lo que la fuente pide', () => {
    montar();
    expect(q('[data-testid="flow-gap-qr"]')!.textContent).toContain('Sin endpoint');
    expect(q('[data-testid="flow-node-qr"]')!.textContent).toContain('No se encontró un endpoint que emita un QR');
  });

  it('cada rama muestra su tipo en palabras: válido, límite o inválido', () => {
    montar();
    const cobrar = q('[data-testid="flow-node-cobrar"]')!.textContent!;
    expect(cobrar).toContain('Válido');
    expect(cobrar).toContain('Inválido');
    expect(cobrar).toContain('Límite');
  });

  it('el último veredicto de cada rama sale del servidor: pasó, falló con lo observado, o sin caso con su razón', () => {
    montar();
    expect(q('[data-testid="flow-verdict-cobrar-1"]')!.textContent).toContain('Falló · devolvió 200');
    expect(q('[data-testid="flow-verdict-cobrar-2"]')!.textContent).toContain('Pasó · devolvió 404');
    expect(q('[data-testid="flow-reason-cobrar-0"]')!.textContent).toContain('Sin caso de prueba: Journey con variable.');
  });

  it('un caso sin sembrar, desactualizado o sin correr se dice como tal', () => {
    const f = flujo();
    const nodos = f.nodes.map((n) =>
      n.id !== 'cobrar'
        ? n
        : {
            ...n,
            branches: n.branches.map((b, i) =>
              !b.qaCase
                ? b
                : { ...b, qaCase: { ...b.qaCase, lastResult: null, seeded: i !== 1, drifted: i === 2 } },
            ),
          },
    );
    montar(nodos);
    expect(q('[data-testid="flow-verdict-cobrar-1"]')!.textContent).toContain('No sembrado');
    expect(q('[data-testid="flow-verdict-cobrar-2"]')!.textContent).toContain('Desactualizado');
  });

  it('plegar un nodo oculta sus ramas y deja el control con aria-expanded', () => {
    montar();
    const boton = q<HTMLButtonElement>('[data-testid="flow-node-cobrar"] > .arbol__cabecera .arbol__plegar')!;
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(q('#ramas-cobrar')).not.toBeNull();

    boton.click();
    fixture.detectChanges();

    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-label')).toBe('Expandir Cobrar');
    expect(q('#ramas-cobrar')).toBeNull();
    expect(q('[data-testid="flow-node-decidir"]')).not.toBeNull();
  });

  it('«Contraer todo» deja sólo la raíz y «Expandir todo» lo devuelve', () => {
    montar();
    q<HTMLButtonElement>('[data-testid="flow-tree-collapse"]')!.click();
    fixture.detectChanges();
    expect(qa('[data-testid^="flow-node-"]')).toHaveLength(1);

    q<HTMLButtonElement>('[data-testid="flow-tree-expand"]')!.click();
    fixture.detectChanges();
    expect(qa('[data-testid^="flow-node-"]')).toHaveLength(5);
  });

  it('una raíz que no existe lo dice en vez de dejar un hueco', () => {
    montar(flujo().nodes, 'no-existe');
    expect(texto()).toContain('El flujo no tiene un nodo raíz que mostrar.');
  });

  it('no tiene violaciones de accesibilidad', async () => {
    montar();
    await esperarSinViolaciones(fixture.nativeElement as HTMLElement);
  }, 30_000);
});
