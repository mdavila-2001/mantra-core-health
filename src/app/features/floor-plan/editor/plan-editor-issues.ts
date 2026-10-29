import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { EditorIssue } from './editor-issues';

/**
 * Los errores por elemento (S4): cada uno dice qué figura, qué pasó y qué hacer,
 * y al pulsarlo enfoca la figura. Los del servidor mandan; los de la ayuda local
 * se rotulan como tales (la autoridad es la API).
 */
@Component({
  selector: 'app-plan-editor-issues',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (issues().length > 0) {
      <section class="iss" aria-label="Problemas del dibujo" data-testid="editor-issues">
        <h2 class="iss__title">Problemas del dibujo <span class="iss__count">{{ issues().length }}</span></h2>
        <ul class="iss__list">
          @for (issue of issues(); track issue.source + issue.id + issue.code) {
            <li>
              <button type="button" class="iss__item" [attr.data-source]="issue.source" [attr.data-code]="issue.code" (click)="pickIssue.emit(issue.id)">
                <span class="iss__glyph" aria-hidden="true">⚠</span>
                <span class="iss__body">
                  <strong>{{ nameOf()(issue.id) }}</strong>
                  <span>{{ issue.message }}</span>
                  @for (c of issue.conflictsWith; track c.id) {
                    <span class="iss__conflict">Choca con {{ c.code }} · {{ c.name }}@if (c.overlapAreaM2 !== undefined) { ({{ c.overlapAreaM2 }} m² de solape) }</span>
                  }
                  @if (issue.nextAction; as next) {
                    <span class="iss__next"><b>{{ next.label }}.</b> {{ next.hint }}</span>
                  }
                  <span class="iss__source">{{ issue.source === 'server' ? 'Lo dijo el servidor' : 'Ayuda del editor (el servidor decide al guardar)' }}</span>
                </span>
              </button>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .iss { display: grid; gap: var(--sp-2); padding: var(--sp-3); background: var(--bg-surface); border: 2px solid var(--st-error-fg); border-radius: var(--r-lg); }
    .iss__title { margin: 0; font-size: var(--fs-body); font-weight: 700; color: var(--st-error-fg); }
    .iss__count { margin-left: var(--sp-1); font-variant-numeric: tabular-nums; }
    .iss__list { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--sp-1); }
    .iss__item { display: flex; gap: var(--sp-2); width: 100%; padding: var(--sp-2); min-height: 44px; border: 1px solid var(--border-default); border-radius: var(--r-md); background: var(--bg-surface); color: var(--text-primary); font: inherit; font-size: var(--fs-caption); text-align: left; cursor: pointer; }
    .iss__item:hover { background: var(--bg-hover); }
    .iss__item:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 1px; }
    .iss__glyph { color: var(--st-error-fg); font-weight: 700; }
    .iss__body { display: grid; gap: 2px; }
    .iss__conflict { color: var(--text-primary); }
    .iss__next { color: var(--text-primary); }
    .iss__source { color: var(--text-secondary); font-size: var(--fs-overline); }
  `,
})
export class PlanEditorIssues {
  readonly issues = input.required<readonly EditorIssue[]>();
  /** Cómo se llama cada figura (código · nombre). */
  readonly nameOf = input<(id: string) => string>((id) => id);
  readonly pickIssue = output<string>();
}
