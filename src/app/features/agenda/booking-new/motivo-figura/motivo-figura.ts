import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { FormControl } from '@angular/forms';
import { finalize, map, of, startWith, switchMap, timer } from 'rxjs';

import { TriageIaClient } from '../../../../core/data-access/triage-ia/triage-ia.client';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  BodyMap,
  type SexoDeLaSilueta,
  type ZonaElegible,
} from '../../../../shared/components/organisms/body-map/body-map';
import {
  combine,
  currentReading,
  readingSymptoms,
  readingZones,
  type TextReading,
} from '../../../symptom-check/ai-reading';
import {
  recognize,
  recognizeAlarms,
  SYMPTOMS_ALL,
  type Sintoma,
} from '../../../symptom-check/symptoms';
import { BODY_ZONES } from '../../../symptom-check/zones.data';

/** Same pause as `symptom-check` before asking the triage service. */
const READ_PAUSE_MS = 600;

/**
 * The body figure next to the booking's reason field (client request,
 * 2026-11-04: the right column of the booking screen was empty).
 *
 * Same figure and same detection as the symptom check (`features/symptom-check`):
 * - text → figure: the reason goes through the local engine and, after a pause,
 *   the triage service; recognized zones light up on the silhouette;
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
  private readonly triageIa = inject(TriageIaClient);

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

  /* ---- detection: the one from `symptom-check` --------------------------- */

  private readonly textoLeido = signal('');

  private readonly lecturaGuardada = toSignal(
    toObservable(this.texto).pipe(
      map((texto) => texto.trim()),
      switchMap((texto) =>
        texto.length < 3
          ? of(null)
          : timer(READ_PAUSE_MS).pipe(
              switchMap(() => this.triageIa.analizar(texto)),
              map((lectura): TextReading | null => (lectura === null ? null : { texto, lectura })),
              finalize(() => this.textoLeido.set(texto)),
            ),
      ),
    ),
    { initialValue: null },
  );

  private readonly lecturaVigente = computed(() =>
    currentReading(this.lecturaGuardada(), this.texto()),
  );

  /** What the reason mentions: local engine plus what the service added. */
  protected readonly sintomas = computed<readonly Sintoma[]>(() =>
    combine(recognize(this.texto()), readingSymptoms(this.lecturaVigente())).filter((s) =>
      this.visible(s),
    ),
  );

  /** The service is still reading the text. */
  protected readonly leyendo = computed(() => {
    const texto = this.texto().trim();
    return texto.length >= 3 && this.textoLeido() !== texto;
  });

  protected readonly alarmas = computed(() => recognizeAlarms(this.texto()));

  /** Zones lit by the text (same rule as `symptom-check`). */
  protected readonly zonasMarcadas = computed<readonly string[]>(() => {
    const delServicio = readingZones(this.lecturaVigente());
    const marcadas = new Set<string>();
    for (const sintoma of [...this.sintomas(), ...this.alarmas()]) {
      const ubicadas = delServicio.get(sintoma.id);
      if (ubicadas !== undefined && ubicadas.length > 0) {
        ubicadas.forEach((zona) => marcadas.add(zona));
        continue;
      }
      const deLaTabla = BODY_ZONES.find((zona) => zona.sintomas.includes(sintoma.id));
      if (deLaTabla !== undefined) marcadas.add(deLaTabla.id);
    }
    return [...marcadas];
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
