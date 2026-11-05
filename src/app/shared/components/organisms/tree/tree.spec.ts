import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Tree } from './tree';
import type { TreeItem } from './tree.types';

/**
 * Un recorte del árbol real de un hospital: seis niveles hasta la cama, que es
 * lo que `tree-select` (dos niveles) no podía mostrar.
 */
const ARBOL: readonly TreeItem[] = [
  {
    id: 'edificio-a',
    label: 'Edificio A',
    description: 'BLD-A',
    children: [
      {
        id: 'pabellon-norte',
        label: 'Pabellón Norte',
        children: [
          {
            id: 'piso-3',
            label: 'Piso 3',
            children: [
              {
                id: 'sala',
                label: 'Sala de internación',
                children: [
                  {
                    id: 'hab-301',
                    label: 'Habitación 301',
                    badge: { label: 'Activo', variant: 'success' },
                    children: [
                      { id: 'cama-a', label: 'Cama 301-A' },
                      { id: 'cama-b', label: 'Cama 301-B' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: 'farmacia', label: 'Farmacia' },
    ],
  },
  { id: 'deposito', label: 'Depósito externo' },
];

describe('Tree', () => {
  let fixture: ComponentFixture<Tree>;
  let tree: Tree;

  beforeEach(() => {
    fixture = TestBed.createComponent(Tree);
    tree = fixture.componentInstance;
    fixture.componentRef.setInput('items', ARBOL);
    fixture.componentRef.setInput('label', 'Infraestructura');
    fixture.detectChanges();
  });

  function filas(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role=treeitem]'));
  }
  function fila(id: string): HTMLElement {
    const encontrada = filas().find((f) => f.dataset['treeId'] === id);
    if (!encontrada) throw new Error(`sin fila ${id}`);
    return encontrada;
  }
  function tecla(key: string): void {
    const activo = (document.activeElement as HTMLElement | null) ?? filas()[0]!;
    activo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }
  function enfocada(): string | undefined {
    return (document.activeElement as HTMLElement | null)?.dataset['treeId'];
  }

  it('expone role=tree con nombre y sólo la raíz visible al empezar', () => {
    const raiz: HTMLElement = fixture.nativeElement.querySelector('[role=tree]');
    expect(raiz.getAttribute('aria-label')).toBe('Infraestructura');
    expect(filas().map((f) => f.dataset['treeId'])).toEqual(['edificio-a', 'deposito']);
  });

  it('marca nivel, posición y aria-expanded sólo en las ramas', () => {
    const edificio = fila('edificio-a');
    expect(edificio.getAttribute('aria-level')).toBe('1');
    expect(edificio.getAttribute('aria-posinset')).toBe('1');
    expect(edificio.getAttribute('aria-setsize')).toBe('2');
    expect(edificio.getAttribute('aria-expanded')).toBe('false');
    expect(fila('deposito').hasAttribute('aria-expanded')).toBe(false);
  });

  it('tiene un solo punto de tabulación (tabindex itinerante)', () => {
    const tabulables = filas().filter((f) => f.getAttribute('tabindex') === '0');
    expect(tabulables.map((f) => f.dataset['treeId'])).toEqual(['edificio-a']);
  });

  it('flecha derecha abre la rama; la segunda baja al primer hijo', () => {
    fila('edificio-a').focus();
    tecla('ArrowRight');
    expect(fila('edificio-a').getAttribute('aria-expanded')).toBe('true');
    expect(enfocada()).toBe('edificio-a');
    tecla('ArrowRight');
    expect(enfocada()).toBe('pabellon-norte');
    expect(fila('pabellon-norte').getAttribute('aria-level')).toBe('2');
  });

  it('flecha izquierda cierra la rama abierta y, cerrada, sube al padre', () => {
    tree.expandedIds.set(['edificio-a']);
    fixture.detectChanges();
    fila('farmacia').focus();
    tecla('ArrowLeft');
    expect(enfocada()).toBe('edificio-a');
    tecla('ArrowLeft');
    expect(fila('edificio-a').getAttribute('aria-expanded')).toBe('false');
  });

  it('flechas arriba/abajo recorren las filas visibles; Inicio y Fin saltan', () => {
    tree.expandedIds.set(['edificio-a']);
    fixture.detectChanges();
    fila('edificio-a').focus();
    tecla('ArrowDown');
    expect(enfocada()).toBe('pabellon-norte');
    tecla('ArrowDown');
    expect(enfocada()).toBe('farmacia');
    tecla('End');
    expect(enfocada()).toBe('deposito');
    tecla('Home');
    expect(enfocada()).toBe('edificio-a');
    tecla('ArrowUp');
    expect(enfocada()).toBe('edificio-a');
  });

  it('llega a seis niveles: la cama tiene aria-level 6', () => {
    tree.revelar('cama-b');
    fixture.detectChanges();
    expect(fila('cama-b').getAttribute('aria-level')).toBe('6');
  });

  it('Enter y Espacio eligen la fila y la marcan aria-selected', () => {
    fila('deposito').focus();
    tecla('Enter');
    expect(tree.selectedId()).toBe('deposito');
    expect(fila('deposito').getAttribute('aria-selected')).toBe('true');
    fila('edificio-a').focus();
    tecla(' ');
    expect(tree.selectedId()).toBe('edificio-a');
  });

  it('un clic en la fila elige; en el chevrón sólo abre o cierra', () => {
    const chevron: HTMLElement = fila('edificio-a').querySelector('.tree__chevron')!;
    chevron.click();
    fixture.detectChanges();
    expect(tree.expandedIds()).toEqual(['edificio-a']);
    expect(tree.selectedId()).toBeNull();
    (fila('farmacia').querySelector('.tree__fila') as HTMLElement).click();
    fixture.detectChanges();
    expect(tree.selectedId()).toBe('farmacia');
  });

  it('type-ahead: una letra salta a la próxima fila que empieza así', () => {
    fila('edificio-a').focus();
    tecla('d');
    expect(enfocada()).toBe('deposito');
  });

  it('asterisco abre todas las ramas hermanas', () => {
    tree.expandedIds.set(['edificio-a']);
    fixture.detectChanges();
    fila('pabellon-norte').focus();
    tecla('*');
    expect(fila('pabellon-norte').getAttribute('aria-expanded')).toBe('true');
  });

  it('pinta la marca de estado', () => {
    tree.revelar('hab-301');
    fixture.detectChanges();
    expect(fila('hab-301').querySelector('app-badge')?.textContent).toContain('Activo');
  });
});
