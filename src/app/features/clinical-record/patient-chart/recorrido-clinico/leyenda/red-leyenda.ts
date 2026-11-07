import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NOMBRE_DEL_MOTIVO, type MotivoDelVinculo } from '../red-clinica.model';
import type { AristaDeLaRed } from '../red-clinica.geometria.types';

type Familia = 'tronco' | 'enlace' | 'inferido';

/** The links the legend explains, in the order it explains them. */
const ORDEN_DE_LA_LEYENDA: readonly MotivoDelVinculo[] = [
  'registrado-en',
  'derivado-desde',
  'indicado-para',
  'pedido-para',
  'resultado-de',
  'plan-para',
  'evidencia',
  'reemplazado-por',
  'receta-reemplazada',
  'reconsulta-de',
  'recibido-en',
  'durante-internacion',
  'inferido-misma-atencion',
  'inferido-mismo-dia',
];

/**
 * The legend's items: each kind of line on screen and, with something
 * collapsed, the strip's milestones. Without it, the lines are a code. It sits
 * on the network's `<ul>` (same element, no wrapper).
 */
@Component({
  selector: 'ul[app-red-leyenda]',
  templateUrl: './red-leyenda.html',
  styleUrls: ['./red-leyenda.css', '../red-clinica-trazos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedLeyenda {
  readonly aristas = input.required<readonly AristaDeLaRed[]>();
  /** Whether the strip's milestones are explained (something is collapsed). */
  readonly conHitos = input(true);

  /**
   * The lines on screen, by reason AND by how they are drawn: the family comes
   * from the geometry (same column: trunk; otherwise: link), so a reason drawn
   * both ways gets two samples, the trunk one saying «en la misma atención».
   */
  protected readonly items = computed(() => {
    const presentes = new Map<MotivoDelVinculo, Set<Familia>>();
    for (const a of this.aristas()) {
      const familia: Familia = a.inferido ? 'inferido' : a.familia;
      presentes.set(a.motivo, (presentes.get(a.motivo) ?? new Set<Familia>()).add(familia));
    }
    return ORDEN_DE_LA_LEYENDA.flatMap((motivo) => {
      const familias = [...(presentes.get(motivo) ?? [])].sort();
      return familias.map((familia) => ({
        clave: `${motivo}:${familia}`,
        motivo,
        familia,
        nombre:
          familia === 'tronco' && familias.length > 1
            ? `${NOMBRE_DEL_MOTIVO[motivo]} (en la misma atención)`
            : NOMBRE_DEL_MOTIVO[motivo],
      }));
    });
  });
}
