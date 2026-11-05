import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { FormControl } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';

import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  BodyMap,
  type SexoDeLaSilueta,
  type ZonaElegible,
} from '../../../../shared/components/organisms/body-map/body-map';
import { bodyPartsIn, withNamedParts } from '../../../symptom-check/body-parts';
import {
  recognize,
  recognizeAlarms,
  SYMPTOMS_ALL,
  type Sintoma,
} from '../../../symptom-check/symptoms';
import { BODY_ZONES } from '../../../symptom-check/zones.data';

/**
 * The body figure next to the booking's reason field (client request,
 * 2026-11-04: the right column of the booking screen was empty).
 *
 * Same figure and same detection as the symptom check (`features/symptom-check`):
 * - text → figure: the reason goes through the local engine only (no external
 *   service); recognized zones light up on the silhouette;
 * - figure → text: tapping a zone lists its symptoms, and picking one appends it
 *   to the reason without overwriting it and without exceeding `maximo`.
 *
 * Alarm symptoms show an "go to the ER" notice. No specialty recommendation:
 * the practitioner is already chosen here.
 */
@Component({
  selector: 'app-motivo-figura',
  imports: [Alert, BodyMap],
  templateUrl: './motivo-figura.html',
  styleUrl: './motivo-figura.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotivoFigura {
  /** The reason field the figure reads and appends to. */
  readonly control = input.required<FormControl<string>>();

  /** Max length of the reason; a symptom that does not fit is not appended. */
  readonly maximo = input(500);

  /** `false` only shows (confirm step: the reason is no longer editable). */
  readonly editable = input(true);

  /** Silhouette proportions; neutral when unknown. */
  readonly sexo = input<SexoDeLaSilueta | undefined>(undefined);

  protected readonly texto = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    ),
    { initialValue: '' },
  );

  /* ---- detection: the local one from `symptom-check` ---------------------- */

  /** What the reason mentions, from the local engine. */
  protected readonly sintomas = computed<readonly Sintoma[]>(() =>
    recognize(this.texto()).filter((s) => this.visible(s)),
  );

  protected readonly alarmas = computed(() => recognizeAlarms(this.texto()));

  /** Zones lit by the text: same rule as `symptom-check`. */
  protected readonly zonasMarcadas = computed<readonly string[]>(() => {
    const marcadas = new Set<string>();
    for (const sintoma of [...this.sintomas(), ...this.alarmas()]) {
      const deLaTabla = BODY_ZONES.find((zona) => zona.sintomas.includes(sintoma.id));
      if (deLaTabla !== undefined) marcadas.add(deLaTabla.madre ?? deLaTabla.id); // no invented side
    }
    // Parts named in the text are exact («rodilla derecha») and narrow the symptom's coarse zone.
    return withNamedParts(bodyPartsIn(this.texto()), [...marcadas], (id) => BODY_ZONES.find((z) => z.id === id)?.madre);
  });

  /* ---- picking by touch -------------------------------------------------- */

  protected readonly zonas: readonly ZonaElegible[] = BODY_ZONES.map(({ id, nombre }) => ({
    id,
    nombre,
  }));

  protected readonly zonaAbierta = signal<string | null>(null);

  protected readonly nombreDeLaZonaAbierta = computed(
    () => BODY_ZONES.find((zona) => zona.id === this.zonaAbierta())?.nombre ?? null,
  );

  protected readonly sintomasDeLaZona = computed<readonly Sintoma[]>(() => {
    const zona = BODY_ZONES.find((z) => z.id === this.zonaAbierta());
    if (zona === undefined) return [];
    return zona.sintomas
      .map((id) => SYMPTOMS_ALL.find((s) => s.id === id))
      .filter((s): s is Sintoma => s !== undefined)
      .filter((s) => this.visible(s));
  });

  protected elegirZona(id: string | null): void {
    this.zonaAbierta.set(id);
  }

  protected estaEnElMotivo(sintoma: Sintoma): boolean {
    return [...this.sintomas(), ...this.alarmas()].some((s) => s.id === sintoma.id);
  }

  /** Appends the symptom at the end, comma-separated; never half of it. */
  protected agregar(sintoma: Sintoma): void {
    if (!this.editable() || this.estaEnElMotivo(sintoma)) return;
    const control = this.control();
    const previo = control.value.trimEnd();
    const nombre = sintoma.nombre;
    const nuevo =
      previo === '' ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : `${previo}, ${nombre}`;
    if (nuevo.length > this.maximo()) return;
    control.setValue(nuevo);
    control.markAsDirty();
  }

  /** Same as `symptom-check`: with unknown sex nothing is hidden. */
  private visible(sintoma: Sintoma): boolean {
    const solo = sintoma.soloParaSexo;
    const sexo = this.sexo();
    return solo === undefined || sexo === undefined || solo === sexo;
  }
}
