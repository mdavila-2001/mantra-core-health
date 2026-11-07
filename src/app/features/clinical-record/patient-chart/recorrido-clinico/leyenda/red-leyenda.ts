import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NOMBRE_DEL_MOTIVO, type MotivoDelVinculo } from '../red-clinica.model';
import type { AristaDeLaRed, HiloDeLaRed } from '../red-clinica.geometria.types';
import type { HitoDelEpisodio } from '../red-clinica.episodio';

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

type TipoDeHito = HitoDelEpisodio['tipo'];

/**
 * Each mark the collapsed strip draws, keyed by the milestone kinds it stands
 * for, with the sample it shows (the same `.red__hito--*` class as the strip).
 * Referral and procedure share one shape and one tone on the strip, so they
 * share one entry.
 */
const HITOS: readonly {
  readonly tipos: readonly TipoDeHito[];
  readonly muestra: TipoDeHito;
  readonly nombre: string;
}[] = [
  { tipos: ['confirmado'], muestra: 'confirmado', nombre: 'Confirmado' },
  { tipos: ['presuntivo'], muestra: 'presuntivo', nombre: 'Presuntivo' },
  { tipos: ['descartado'], muestra: 'descartado', nombre: 'Descartado' },
  { tipos: ['historico'], muestra: 'historico', nombre: 'Histórico' },
  {
    tipos: ['derivacion', 'procedimiento'],
    muestra: 'derivacion',
    nombre: 'Derivación o procedimiento',
  },
  { tipos: ['internacion'], muestra: 'internacion', nombre: 'Internación' },
  { tipos: ['momento'], muestra: 'momento', nombre: 'Atención o cita' },
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
  styleUrls: ['../red-clinica-tonos.css', './red-leyenda.css', '../red-clinica-trazos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedLeyenda {
  readonly aristas = input.required<readonly AristaDeLaRed[]>();
  /** Whether the strip's milestones are explained (something is collapsed). */
  readonly conHitos = input(true);
  /**
   * The threads on the canvas: the strip marks are explained from the
   * milestones they really draw. Unbound, every mark the strip can draw is
   * explained.
   */
  readonly hilos = input<readonly HiloDeLaRed[] | null>(null);

  /** The strip marks on screen, from the milestones of the collapsed threads. */
  protected readonly hitos = computed(() => {
    if (!this.conHitos()) return [];
    const hilos = this.hilos();
    if (hilos === null) return HITOS;
    const dibujados = new Set(
      hilos.filter((h) => !h.desplegado).flatMap((h) => h.hitos.map((x) => x.tipo)),
    );
    return HITOS.filter(({ tipos }) => tipos.some((t) => dibujados.has(t)));
  });

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
