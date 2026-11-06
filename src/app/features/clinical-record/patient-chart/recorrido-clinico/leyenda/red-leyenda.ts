import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NOMBRE_DEL_MOTIVO, type MotivoDelVinculo } from '../red-clinica.model';
import type { AristaDeLaRed } from '../red-clinica.geometria.types';

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

  /** The reasons on screen. */
  protected readonly items = computed(() => {
    const presentes = new Set(this.aristas().map((a) => a.motivo));
    return ORDEN_DE_LA_LEYENDA.filter((m) => presentes.has(m)).map((motivo) => ({
      motivo,
      nombre: NOMBRE_DEL_MOTIVO[motivo],
      familia: motivo.startsWith('inferido-') ? 'inferido' : motivo === 'registrado-en' || motivo === 'derivado-desde' ? 'tronco' : 'enlace',
    }));
  });
}
