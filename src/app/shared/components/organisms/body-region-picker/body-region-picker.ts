import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';

import { AnatomyAtlasClient } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import type { AnatomyLayer, AnatomyPart } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { Radio } from '../../molecules/radio/radio';
import { RadioGroup } from '../../molecules/radio-group/radio-group';
import { AnatomyViewer } from '../anatomy-viewer/anatomy-viewer';

/** Una región elegible: `atlas` es el código con que el atlas la clasifica (`R01`…). */
export interface PickerRegion {
  readonly atlas: string;
  readonly label: string;
}

/** Qué capas se dibujan: el esqueleto y los órganos bastan para ubicar un estudio de imagen. */
const LAYERS: readonly AnatomyLayer[] = ['skeleton', 'organs'];

/**
 * Elegir la parte del cuerpo sobre el modelo 3D del atlas — el mismo visor que
 * usa el glosario, reusado y no copiado.
 *
 * ## Lo que se elige es una región, no una pieza
 *
 * El atlas clasifica cada estructura en siete regiones (cabeza y cuello, dorso,
 * tórax, abdomen, pelvis, miembro superior e inferior). Tocar una pieza en el
 * modelo propone la región de esa estructura; la lista de al lado elige la misma
 * región sin puntero. Es la **misma** elección por dos caminos: un lienzo no
 * puede anunciar sus piezas, así que el teclado y el lector de pantalla trabajan
 * con la lista (ver `AnatomyViewer`, «Accesibilidad»).
 *
 * Alrededor de la mitad de las mallas no trae región en el atlas (varios
 * músculos y nervios). Tocar una de ésas no cambia la elección y la pantalla lo
 * dice: preferimos pedirle la región a la persona que adivinarla.
 *
 * ## Peso
 *
 * El visor importa three.js sólo en el navegador y baja cada capa la primera vez
 * que se enciende; el formulario lo monta sólo cuando el tipo de orden es
 * Imagenología.
 */
@Component({
  selector: 'app-body-region-picker',
  imports: [AnatomyViewer, RadioGroup, Radio],
  templateUrl: './body-region-picker.html',
  styleUrl: './body-region-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BodyRegionPicker {
  private readonly atlas = inject(AnatomyAtlasClient);

  /** Las regiones que se ofrecen, en el orden de la lista. */
  readonly regions = input.required<readonly PickerRegion[]>();

  /** El código de atlas de la región elegida, o `null`. */
  readonly value = model<string | null>(null);

  protected readonly layers = LAYERS;
  protected readonly modelUrls: Readonly<Record<AnatomyLayer, string>> = {
    skeleton: this.atlas.modelUrl('skeleton.glb'),
    muscles: this.atlas.modelUrl('muscles.glb'),
    vessels: this.atlas.modelUrl('vessels.glb'),
    nervous: this.atlas.modelUrl('nervous.glb'),
    organs: this.atlas.modelUrl('organs.glb'),
  };

  protected readonly parts = signal<readonly AnatomyPart[]>([]);
  protected readonly partsFailed = signal(false);
  protected readonly pickedMesh = signal<string | null>(null);
  /** Lo que se dice de la última pieza tocada. */
  protected readonly pickedNote = signal<string | null>(null);

  protected readonly selectedMeshes = computed(() => {
    const mesh = this.pickedMesh();
    return mesh === null ? [] : [mesh];
  });

  protected readonly groupName = `region-${Math.random().toString(36).slice(2, 8)}`;

  constructor() {
    this.atlas.parts().subscribe({
      next: (parts) => this.parts.set(parts),
      error: () => this.partsFailed.set(true),
    });
  }

  /** El visor emitió una pieza tocada (o `null` al tocar el fondo). */
  protected onPicked(meshId: string | null): void {
    this.pickedMesh.set(meshId);
    this.pickedNote.set(null);
    if (meshId === null) {
      return;
    }
    const part = this.parts().find((p) => p.meshId === meshId);
    if (part === undefined) {
      return;
    }
    this.atlas.structure(part.structureId).subscribe({
      next: (structure) => {
        const known = new Set(this.regions().map((r) => r.atlas));
        const region = structure?.regions.find((code) => known.has(code)) ?? null;
        const name = structure?.labelEs ?? structure?.labelEn ?? part.labelEn;
        if (region === null) {
          this.pickedNote.set(`«${name}» no tiene región asignada en el atlas: elíjala en la lista.`);
          return;
        }
        this.value.set(region);
        this.pickedNote.set(`«${name}» está en ${this.labelOf(region)}.`);
      },
      error: () => this.pickedNote.set('No pudimos leer la ficha de esa pieza: elija la región en la lista.'),
    });
  }

  protected pickFromList(atlas: string | null): void {
    this.value.set(atlas);
    this.pickedNote.set(null);
    // La pieza que se había tocado ya no explica la elección: dejarla resaltada
    // mostraría, p. ej., un yeyuno marcado con «Miembro superior» elegido.
    this.pickedMesh.set(null);
  }

  private labelOf(atlas: string): string {
    return this.regions().find((r) => r.atlas === atlas)?.label ?? atlas;
  }
}
