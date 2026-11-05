import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { NodoArbol, RespuestaPosible } from '../../../../core/data-access/admin-portal/portal.types';
import { DecisionTree, nodeOutcome, nodeText } from './decision-tree';

/**
 * El árbol de decisión de una operación del portal de administración: cada
 * paso con su tipo rotulado, su texto y su desenlace, con las ramas «si se
 * cumple / si no» anidadas, y la lista de respuestas con las que puede
 * terminar. Si el generador lo recortó, se avisa.
 */

const ARBOL: readonly NodoArbol[] = [
  { tipo: 'ACCESO', txt: 'Exige sesión', falla: { estado: 401, codigo: 'UNAUTHENTICATED' } },
  {
    tipo: 'SI',
    txt: '¿Existe el paciente?',
    entonces: [{ tipo: 'EFECTO', tabla: 'clinical.encounter', operacion: 'Inserta', f: 'encounters.service.ts:120' }],
    sino: [{ tipo: 'ERROR', mensaje: 'Paciente inexistente', estado: 404, codigo: 'NOT_FOUND' }],
  },
  { tipo: 'RESPUESTA', estado: 201 },
];

describe('DecisionTree', () => {
  let fixture: ComponentFixture<DecisionTree>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(nodes: readonly NodoArbol[], responses: readonly RespuestaPosible[] = [], truncated = false): void {
    fixture = TestBed.createComponent(DecisionTree);
    fixture.componentRef.setInput('nodes', nodes);
    fixture.componentRef.setInput('responses', responses);
    fixture.componentRef.setInput('truncated', truncated);
    fixture.detectChanges();
  }

  it('pinta cada paso con su tipo, su texto y su desenlace, y anida las ramas', () => {
    pintar(ARBOL);
    const nodos = root().querySelectorAll('.tree__node');
    expect(nodos).toHaveLength(5);
    expect(nodos[0]!.querySelector('app-badge')?.textContent?.trim()).toBe('Acceso');
    expect(nodos[0]!.querySelector('.tree__outcome')?.textContent).toBe('Si no se cumple: 401 UNAUTHENTICATED');
    expect(Array.from(root().querySelectorAll('.tree__branch-label')).map((p) => p.textContent)).toEqual([
      'Si se cumple',
      'Si no se cumple',
    ]);
    expect(root().textContent).toContain('Inserta clinical.encounter');
    expect(root().querySelector('.tree__source')?.textContent).toBe('encounters.service.ts:120');
  });

  it('avisa cuando el árbol vino recortado', () => {
    pintar(ARBOL, [], true);
    expect(root().querySelector('.tree__note')).not.toBeNull();
    pintar(ARBOL);
    expect(root().querySelector('.tree__note')).toBeNull();
  });

  it('lista con qué puede terminar, con sus causas', () => {
    pintar(ARBOL, [
      { estado: 201, codigo: null, causas: [] },
      { estado: 404, codigo: 'NOT_FOUND', causas: ['paciente inexistente', 'de otro tenant'] },
    ]);
    const items = Array.from(root().querySelectorAll('.tree__responses li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(items).toEqual(['201', '404 NOT_FOUND · paciente inexistente · de otro tenant']);
  });

  describe('nodeText / nodeOutcome', () => {
    it('el texto toma el primer dato disponible, y si no hay ninguno lo dice', () => {
      expect(nodeText({ tipo: 'X', mensaje: 'm' })).toBe('m');
      expect(nodeText({ tipo: 'X', tabla: 't' })).toBe('Toca t');
      expect(nodeText({ tipo: 'X', destino: 'svc.metodo' })).toBe('svc.metodo');
      expect(nodeText({ tipo: 'X' })).toBe('Paso sin descripción');
    });

    it('el desenlace: falla, estado con o sin código, o nada', () => {
      expect(nodeOutcome({ tipo: 'X', estado: 200 })).toBe('200');
      expect(nodeOutcome({ tipo: 'X', estado: 409, codigo: 'CONFLICT' })).toBe('409 CONFLICT');
      expect(nodeOutcome({ tipo: 'X' })).toBeNull();
    });
  });
});
