import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type {
  NodoArbol,
  RespuestaPosible,
} from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { Rotulo } from '../../platform/platform-labels';
import { decisionStep } from '../portal-labels';

/**
 * El árbol de decisión de una operación, en el orden en que la API lo recorre:
 * accesos, condiciones (con sus dos ramas), llamadas, efectos y respuestas.
 *
 * Son listas anidadas, no un widget `tree`: ese rol exige un modelo de teclado
 * completo y uno a medias es peor para quien usa lector de pantalla que listas
 * comunes, que se recorren solas. Presentacional: recibe los nodos y nada más.
 */
@Component({
  selector: 'app-portal-decision-tree',
  imports: [NgTemplateOutlet, Badge],
  templateUrl: './decision-tree.html',
  styleUrl: './decision-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionTree {
  readonly nodes = input.required<readonly NodoArbol[]>();
  readonly responses = input<readonly RespuestaPosible[]>([]);
  readonly truncated = input(false);

  // Funciones y no tablas: el contexto de un `ng-template` recursivo es `any`.
  protected readonly step = (node: NodoArbol): Rotulo => decisionStep(node.tipo);
  protected readonly text = nodeText;
  protected readonly outcome = nodeOutcome;
}

/** La frase principal del nodo: la que escribió el generador, o lo que el nodo nombra. */
export function nodeText(node: NodoArbol): string {
  return (
    node.txt ??
    node.mensaje ??
    node.excepcion ??
    (node.tabla ? `${node.operacion ?? 'Toca'} ${node.tabla}` : null) ??
    node.destino ??
    node.corto ??
    'Paso sin descripción'
  );
}

/** Lo que pasa si el paso falla o con qué termina: «403 FORBIDDEN». `null` si no aplica. */
export function nodeOutcome(node: NodoArbol): string | null {
  if (node.falla) return `Si no se cumple: ${node.falla.estado} ${node.falla.codigo}`;
  if (node.estado !== undefined) return `${node.estado}${node.codigo ? ` ${node.codigo}` : ''}`;
  return null;
}
