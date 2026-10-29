import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { PlacementGeometry } from '../../../core/data-access/floor-plan/floor-plan.types';
import { measureText, type EditSpace } from '../../../core/floor-plan/editor-model';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';

type RectField = 'centerXM' | 'centerYM' | 'widthM' | 'depthM' | 'rotationDeg';

const FIELDS: readonly { key: RectField; label: string; unit: string }[] = [
  { key: 'centerXM', label: 'Centro X', unit: 'm' },
  { key: 'centerYM', label: 'Centro Y', unit: 'm' },
  { key: 'widthM', label: 'Ancho', unit: 'm' },
  { key: 'depthM', label: 'Fondo', unit: 'm' },
  { key: 'rotationDeg', label: 'Giro', unit: '°' },
];

/**
 * Medidas exactas de la figura elegida. Se escribe, se confirma al salir del
 * campo y queda como un solo paso de deshacer.
 */
@Component({
  selector: 'app-plan-editor-inspector',
  imports: [AppButton, Input],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="insp" aria-label="Figura elegida" data-testid="editor-inspector">
      @if (space(); as s) {
        <h2 class="insp__title">{{ s.code }} · {{ s.name }}</h2>
        <p class="insp__measure" data-testid="editor-measure">{{ measure() }}</p>
        @if (s.geometry.kind === 'RECT') {
          <div class="insp__grid">
            @for (f of fields; track f.key) {
              <div class="insp__field">
                <span>{{ f.label }} ({{ f.unit }})</span>
                <app-input type="number" [step]="f.key === 'rotationDeg' ? 1 : 0.1" [ariaLabel]="f.label" [value]="valueOf(f.key)" [disabled]="s.locked" (valueChange)="stage(f.key, $event)" (blurred)="apply()" />
              </div>
            }
          </div>
        } @else {
          <p class="insp__note">Polígono de {{ s.geometry.vertices.length }} vértices. Arrastre un vértice, o el punto del medio de una arista para agregar otro; con Supr quita el vértice elegido.</p>
        }
        <div class="insp__actions">
          <button app-button size="sm" variant="outline" type="button" data-testid="editor-lock" [attr.aria-pressed]="s.locked" (clicked)="lockToggled.emit()">{{ s.locked ? 'Desbloquear' : 'Bloquear' }}</button>
          <button app-button size="sm" variant="danger" type="button" data-testid="editor-remove" [disabled]="s.locked" (clicked)="remove.emit()">Quitar del plano</button>
        </div>
        <p class="insp__note">«Quitar del plano» solo quita el dibujo: el espacio sigue en el árbol de la organización.</p>
      } @else {
        <h2 class="insp__title">Figura elegida</h2>
        <p class="insp__note">Elija una figura en el plano para ver y ajustar sus medidas.</p>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .insp { display: grid; gap: var(--sp-2); min-width: 0; padding: var(--sp-3); background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r-lg); }
    .insp__title { margin: 0; font-size: var(--fs-body); font-weight: 700; color: var(--text-primary); overflow-wrap: anywhere; }
    .insp__measure { margin: 0; font-size: var(--fs-caption); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .insp__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); }
    .insp__field { display: grid; gap: 2px; min-width: 0; font-size: var(--fs-caption); color: var(--text-secondary); font-weight: 600; }
    .insp__actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .insp__note { margin: 0; font-size: var(--fs-caption); color: var(--text-secondary); }
  `,
})
export class PlanEditorInspector {
  readonly space = input<EditSpace | null>(null);
  readonly geometryChange = output<PlacementGeometry>();
  readonly lockToggled = output<void>();
  readonly remove = output<void>();

  protected readonly fields = FIELDS;
  private readonly staged = signal<Partial<Record<RectField, string | number | null>>>({});
  protected readonly measure = computed(() => {
    const s = this.space();
    return s ? measureText(s) : '';
  });

  protected valueOf(key: RectField): number | string {
    const staged = this.staged()[key];
    if (staged !== undefined && staged !== null) return staged;
    const g = this.space()?.geometry;
    return g?.kind === 'RECT' ? g[key] : '';
  }

  protected stage(key: RectField, value: string | number | null): void {
    this.staged.update((s) => ({ ...s, [key]: value }));
  }

  protected apply(): void {
    const g = this.space()?.geometry;
    const staged = this.staged();
    this.staged.set({});
    if (g?.kind !== 'RECT') return;
    const next = { ...g };
    let changed = false;
    for (const f of FIELDS) {
      const raw = staged[f.key];
      if (raw === undefined || raw === null || raw === '') continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n === g[f.key]) continue;
      if ((f.key === 'widthM' || f.key === 'depthM') && n < 0.05) continue;
      next[f.key] = Math.round(n * 1000) / 1000;
      changed = true;
    }
    if (changed) this.geometryChange.emit(next);
  }
}
