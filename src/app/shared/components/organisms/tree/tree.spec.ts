import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Tree } from './tree';
import { expandableIds, flattenTree, moveFor, treeAncestorIds, typeAheadTarget } from './tree.logic';
import type { TreeNode } from './tree.types';

const ARBOL: readonly TreeNode[] = [
  {
    id: 'ed',
    label: 'Edificio A',
    hint: 'ED-A',
    children: [
      {
        id: 'p3',
        label: 'Piso 3',
        children: [
          { id: 'h301', label: 'Habitación 301', children: [{ id: 'c301a', label: 'Cama 301-A' }, { id: 'c301b', label: 'Cama 301-B' }] },
          { id: 'h302', label: 'Habitación 302', muted: true },
        ],
      },
      { id: 'qx', label: 'Quirófano', disabled: true },
    ],
  },
  { id: 'edb', label: 'Edificio B' },
];

describe('lógica del árbol', () => {
  it('aplana sólo los nodos abiertos, con nivel, posición y hermanos', () => {
    const cerrado = flattenTree(ARBOL, new Set());
    expect(cerrado.map((f) => f.node.id)).toEqual(['ed', 'edb']);
    const abierto = flattenTree(ARBOL, new Set(['ed', 'p3']));
    expect(abierto.map((f) => `${f.level}:${f.node.id}`)).toEqual(['1:ed', '2:p3', '3:h301', '3:h302', '2:qx', '1:edb']);
    const p3 = abierto.find((f) => f.node.id === 'p3')!;
    expect(p3).toMatchObject({ position: 1, setSize: 2, parentId: 'ed', expandable: true, expanded: true });
  });

  it('da los ancestros y los ids que se pueden abrir', () => {
    expect(treeAncestorIds(ARBOL, 'c301b')).toEqual(['ed', 'p3', 'h301']);
    expect(treeAncestorIds(ARBOL, 'ed')).toEqual([]);
    expect(treeAncestorIds(ARBOL, 'no-existe')).toEqual([]);
    expect(expandableIds(ARBOL)).toEqual(['ed', 'p3', 'h301']);
  });

  it('las flechas siguen el patrón de ARIA', () => {
    const filas = flattenTree(ARBOL, new Set(['ed', 'p3']));
    expect(moveFor('ArrowDown', filas, 'ed')).toEqual({ kind: 'focus', id: 'p3' });
    expect(moveFor('ArrowUp', filas, 'ed')).toEqual({ kind: 'none' });
    expect(moveFor('ArrowRight', filas, 'p3')).toEqual({ kind: 'focus', id: 'h301' });
    expect(moveFor('ArrowRight', filas, 'h301')).toEqual({ kind: 'expand', id: 'h301' });
    expect(moveFor('ArrowRight', filas, 'h302')).toEqual({ kind: 'none' });
    expect(moveFor('ArrowLeft', filas, 'p3')).toEqual({ kind: 'collapse', id: 'p3' });
    expect(moveFor('ArrowLeft', filas, 'h302')).toEqual({ kind: 'focus', id: 'p3' });
    expect(moveFor('ArrowLeft', filas, 'ed')).toEqual({ kind: 'collapse', id: 'ed' });
    expect(moveFor('Home', filas, 'qx')).toEqual({ kind: 'focus', id: 'ed' });
    expect(moveFor('End', filas, 'ed')).toEqual({ kind: 'focus', id: 'edb' });
    expect(moveFor('Enter', filas, 'p3')).toEqual({ kind: 'select', id: 'p3', activate: true });
    expect(moveFor(' ', filas, 'p3')).toEqual({ kind: 'select', id: 'p3', activate: false });
    expect(moveFor('*', filas, 'p3')).toEqual({ kind: 'expand-siblings', id: 'p3' });
    expect(moveFor('x', filas, 'p3')).toEqual({ kind: 'none' });
  });

  it('la escritura anticipada ignora mayúsculas y tildes, y da la vuelta', () => {
    const filas = flattenTree(ARBOL, new Set(['ed', 'p3']));
    expect(typeAheadTarget('h', filas, 'ed')).toBe('h301');
    expect(typeAheadTarget('h', filas, 'h301')).toBe('h302');
    expect(typeAheadTarget('quiro', filas, 'ed')).toBeNull(); // deshabilitado: no se salta a él
    expect(typeAheadTarget('PISO', filas, 'edb')).toBe('p3');
    expect(typeAheadTarget('', filas, 'ed')).toBeNull();
  });
});

describe('Tree', () => {
  let fixture: ComponentFixture<Tree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Tree] }).compileComponents();
    fixture = TestBed.createComponent(Tree);
    fixture.componentRef.setInput('nodes', ARBOL);
    fixture.componentRef.setInput('label', 'Espacios');
    fixture.detectChanges();
  });

  const items = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[role="treeitem"]'));
  const item = (id: string): HTMLElement => fixture.nativeElement.querySelector(`[data-node-id="${id}"]`)!;
  const tecla = async (id: string, key: string): Promise<void> => {
    item(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
  };

  it('es un tree con nombre accesible y sólo las raíces cuando todo está cerrado', () => {
    const arbol: HTMLElement = fixture.nativeElement.querySelector('[role="tree"]');
    expect(arbol.getAttribute('aria-label')).toBe('Espacios');
    expect(items().map((i) => i.dataset['nodeId'])).toEqual(['ed', 'edb']);
  });

  it('cada fila declara nivel, posición, tamaño y, si tiene hijos, aria-expanded', () => {
    const ed = item('ed');
    expect(ed.getAttribute('aria-level')).toBe('1');
    expect(ed.getAttribute('aria-posinset')).toBe('1');
    expect(ed.getAttribute('aria-setsize')).toBe('2');
    expect(ed.getAttribute('aria-expanded')).toBe('false');
    expect(item('edb').hasAttribute('aria-expanded')).toBe(false);
  });

  it('el nombre accesible de la fila es su rótulo, sin el aviso ni los hijos', () => {
    const ed = item('ed');
    const nombre = fixture.nativeElement.querySelector(`#${ed.getAttribute('aria-labelledby')}`);
    expect(nombre.textContent.trim()).toBe('Edificio A');
  });

  it('hay un solo tabulador: la primera fila, y luego la elegida', () => {
    expect(items().filter((i) => i.tabIndex === 0).map((i) => i.dataset['nodeId'])).toEqual(['ed']);
    fixture.componentRef.setInput('selectedId', 'edb');
    fixture.detectChanges();
    expect(items().filter((i) => i.tabIndex === 0).map((i) => i.dataset['nodeId'])).toEqual(['edb']);
    expect(item('edb').getAttribute('aria-selected')).toBe('true');
    expect(item('ed').getAttribute('aria-selected')).toBe('false');
  });

  it('→ abre, → otra vez baja al primer hijo, ← sube al padre y ← cierra', async () => {
    item('ed').focus();
    await tecla('ed', 'ArrowRight');
    expect(item('ed').getAttribute('aria-expanded')).toBe('true');
    expect(items().map((i) => i.dataset['nodeId'])).toEqual(['ed', 'p3', 'qx', 'edb']);

    await tecla('ed', 'ArrowRight');
    expect(document.activeElement).toBe(item('p3'));

    await tecla('p3', 'ArrowLeft');
    expect(document.activeElement).toBe(item('ed'));

    await tecla('ed', 'ArrowLeft');
    expect(item('ed').getAttribute('aria-expanded')).toBe('false');
  });

  it('↓ y ↑ mueven el foco sin elegir; Enter elige y emite nodeActivated', async () => {
    const activados: string[] = [];
    fixture.componentInstance.nodeActivated.subscribe((id) => activados.push(id));
    item('ed').focus();
    await tecla('ed', 'ArrowDown');
    expect(document.activeElement).toBe(item('edb'));
    expect(fixture.componentInstance.selectedId()).toBeNull();

    await tecla('edb', 'Enter');
    expect(fixture.componentInstance.selectedId()).toBe('edb');
    expect(activados).toEqual(['edb']);
  });

  it('Espacio elige sin activar y un nodo deshabilitado no se elige', async () => {
    const activados: string[] = [];
    fixture.componentInstance.nodeActivated.subscribe((id) => activados.push(id));
    fixture.componentRef.setInput('expandedIds', ['ed']);
    fixture.detectChanges();
    await tecla('qx', ' ');
    expect(fixture.componentInstance.selectedId()).toBeNull();
    await tecla('p3', ' ');
    expect(fixture.componentInstance.selectedId()).toBe('p3');
    expect(activados).toEqual([]);
  });

  it('Inicio y Fin van a los extremos; * abre a los hermanos', async () => {
    item('ed').focus();
    await tecla('ed', 'End');
    expect(document.activeElement).toBe(item('edb'));
    await tecla('edb', 'Home');
    expect(document.activeElement).toBe(item('ed'));
    await tecla('ed', '*');
    expect(item('ed').getAttribute('aria-expanded')).toBe('true');
  });

  it('hacer clic elige la fila; hacer clic en el triángulo abre sin elegir', () => {
    item('edb').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedId()).toBe('edb');

    (item('ed').querySelector('.tree__toggle') as HTMLElement).click();
    fixture.detectChanges();
    expect(item('ed').getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.selectedId()).toBe('edb');
  });

  it('una fila atenuada y una deshabilitada lo declaran', () => {
    fixture.componentRef.setInput('expandedIds', ['ed', 'p3']);
    fixture.detectChanges();
    expect(item('qx').getAttribute('aria-disabled')).toBe('true');
    expect(item('h302').classList.contains('tree__item--muted')).toBe(true);
  });

  it('con otro árbol vacío no revienta y no deja ningún tabulador', () => {
    fixture.componentRef.setInput('nodes', []);
    fixture.detectChanges();
    expect(items()).toEqual([]);
  });
});
