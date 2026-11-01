import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** Un filtro de la consulta. Los códigos se eligen de una lista; el texto libre es sólo para valores exactos. */
export interface FilterField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'select' | 'text' | 'date';
  /** Opciones de un `select`. La primera con valor `''` es «sin filtrar». */
  readonly options?: readonly SelectOption<string>[];
  readonly placeholder?: string;
  readonly hint?: string;
  /** Filtro fino: queda plegado bajo «Más filtros» salvo que tenga valor. */
  readonly advanced?: boolean;
}

/**
 * Formulario de filtros de una consulta con valores exactos y rango de fechas,
 * que `app-filter-bar` no cubre (sólo desplegables y un buscador). Es
 * presentacional: recibe los valores vigentes (los de la URL) y emite los
 * nuevos al aplicar; quien lo usa los escribe en la URL.
 *
 * Los cambios no se aplican al teclear: la bitácora es una consulta cara y
 * auditada del lado del servidor, y cada petición queda registrada.
 */
@Component({
  selector: 'app-governance-filter-form',
  imports: [AppButton, Input, Select, FormField],
  template: `
    <form class="filter-form" novalidate (submit)="$event.preventDefault(); apply()">
      <div class="filter-form__fields">
        @for (field of visibleFields(); track field.key) {
          <app-form-field
          [class.filter-form__wide]="field.kind === 'text'"
          [label]="field.label"
          [hint]="field.hint ?? ''"
        >
            @if (field.kind === 'select') {
              <app-select
                [ariaLabel]="field.label"
                [options]="field.options ?? []"
                [value]="draft()[field.key] ?? ''"
                (valueChange)="set(field.key, $event ?? '')"
              />
            } @else {
              <app-input
                [type]="field.kind === 'date' ? 'date' : 'text'"
                [ariaLabel]="field.label"
                [placeholder]="field.placeholder ?? ''"
                [value]="draft()[field.key] ?? ''"
                [testId]="'filter-' + field.key"
                (valueChange)="set(field.key, $event === null ? '' : String($event))"
              />
            }
          </app-form-field>
        }
      </div>
      <div class="filter-form__actions">
        @if (advancedCount() > 0) {
          <button
            app-button
            variant="ghost"
            class="filter-form__more"
            data-testid="filter-form-more"
            [attr.aria-expanded]="expanded()"
            (clicked)="expanded.set(!expanded())"
          >
            {{ expanded() ? 'Menos filtros' : 'Más filtros (' + advancedCount() + ')' }}
          </button>
        }
        <button app-button variant="ghost" data-testid="filter-form-clear" (clicked)="cleared.emit()">
          Quitar filtros
        </button>
        <button app-button variant="primary" type="submit" data-testid="filter-form-apply">
          Aplicar filtros
        </button>
      </div>
    </form>
  `,
  styles: `
    /* Base (teléfono y tableta): los campos se apilan en una rejilla que se reparte
       por ancho, y las acciones van debajo, a la derecha. */
    .filter-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--sp-3);
    }
    .filter-form__fields {
      flex: 1 1 100%;
      min-inline-size: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(11.5rem, 100%), 1fr));
      align-items: start;
      gap: var(--sp-3);
    }
    /* El buscador va primero y ocupa dos columnas (la fila entera en el teléfono): su texto
       de ejemplo no se corta. Los selectores tienen ancho para su opción más larga. */
    .filter-form__wide {
      grid-column: 1 / -1;
      order: -1;
    }
    @media (min-width: 40.0625rem) {
      .filter-form__wide {
        grid-column: span 2;
      }
    }
    .filter-form__actions {
      display: flex;
      flex: 0 1 auto;
      flex-wrap: wrap;
      min-inline-size: 0;
      justify-content: flex-end;
      gap: var(--sp-2);
      margin-inline-start: auto;
    }
    /* ≥ 1024 px (barra de filtros de AtlasAdminPortal): UNA fila. El buscador es
       flexible, los selectores toman su parte y «Quitar» / «Aplicar» cierran la
       MISMA fila, alineados abajo con los controles. Si hay tantos filtros que no
       entran, se parten los campos —nunca las acciones, que no bajan solas. */
    @media (min-width: 64rem) {
      .filter-form {
        flex-wrap: nowrap;
      }
      .filter-form__fields {
        flex: 1 1 auto;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
      }
      .filter-form__fields > * {
        flex: 1 1 9.5rem;
        min-inline-size: 0;
      }
      .filter-form__fields > .filter-form__wide {
        flex: 2 1 15rem;
      }
      .filter-form__actions {
        flex: none;
        flex-wrap: nowrap;
        margin-inline-start: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterForm {
  readonly fields = input.required<readonly FilterField[]>();
  /** Los valores vigentes; un cambio de afuera (atrás, enlace) reemplaza el borrador. */
  readonly values = input.required<Readonly<Record<string, string>>>();
  readonly applied = output<Readonly<Record<string, string>>>();
  readonly cleared = output<void>();

  protected readonly draft = linkedSignal<Readonly<Record<string, string>>>(() => ({ ...this.values() }));
  /** Los filtros finos se despliegan solos si alguno ya trae valor (un enlace, «atrás»). */
  protected readonly expanded = linkedSignal(() =>
    this.fields().some((f) => f.advanced === true && (this.values()[f.key] ?? '') !== ''),
  );
  protected readonly advancedCount = computed(() => this.fields().filter((f) => f.advanced === true).length);
  protected readonly visibleFields = computed(() =>
    this.expanded() ? this.fields() : this.fields().filter((f) => f.advanced !== true),
  );
  protected readonly String = String;

  protected set(key: string, value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected apply(): void {
    const draft = this.draft();
    // Todos los campos, también los plegados: plegar no es quitar un filtro.
    this.applied.emit(Object.fromEntries(this.fields().map((f) => [f.key, (draft[f.key] ?? '').trim()])));
  }
}
