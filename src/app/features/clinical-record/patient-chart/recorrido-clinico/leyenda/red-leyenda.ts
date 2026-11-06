import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NOMBRE_DEL_MOTIVO, type MotivoDelVinculo } from '../red-clinica.model';
import type { AristaDeLaRed } from '../red-clinica.geometria.types';

type Familia = 'tronco' | 'enlace' | 'inferido';

/**
 * The families the canvas really tells apart, each with its own stroke: the
 * trunk (thin, no arrowhead), the recorded link (solid, arrowhead) and the
 * inferred one (dotted, arrowhead). Listing every reason under the same green
 * line distinguished nothing; the reason of each line is in the panel.
 */
const FAMILIAS: readonly { readonly familia: Familia; readonly nombre: string }[] = [
  { familia: 'tronco', nombre: 'Registrado en la atención' },
  { familia: 'enlace', nombre: 'Relación registrada' },
  { familia: 'inferido', nombre: 'Inferido (no registrado)' },
];

/** The order the reasons are named in, inside each family. */
const ORDEN_DE_LOS_MOTIVOS = Object.keys(NOMBRE_DEL_MOTIVO) as readonly MotivoDelVinculo[];

/**
 * The legend's items: each family of line on screen and, with something
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
   * The families on screen, from how each line was drawn (the geometry's
   * family, or inferred), each naming the reasons it carries for hover and
   * for assistive technology.
   */
  protected readonly items = computed(() => {
    const presentes = new Map<Familia, Set<MotivoDelVinculo>>();
    for (const a of this.aristas()) {
      const familia: Familia = a.inferido ? 'inferido' : a.familia;
      presentes.set(familia, (presentes.get(familia) ?? new Set<MotivoDelVinculo>()).add(a.motivo));
    }
    return FAMILIAS.filter(({ familia }) => presentes.has(familia)).map(({ familia, nombre }) => ({
      familia,
      nombre,
      motivos: ORDEN_DE_LOS_MOTIVOS.filter((m) => presentes.get(familia)!.has(m))
        .map((m) => NOMBRE_DEL_MOTIVO[m])
        .join(' · '),
    }));
  });
}
