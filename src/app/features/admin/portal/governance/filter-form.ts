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
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';

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
  imports: [AppButton, Input, Select, FormField, DatePicker],
  template: `
    <form class="filter-form" novalidate (submit)="$event.preventDefault(); apply()">
      <div class="filter-form__fields">
        @for (field of visibleFields(); track field.key) {
          <app-form-field
          [class]="'filter-form__campo filter-form__campo--' + field.kind"
          [class.filter-form__wide]="esBuscador(field)"
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
            } @else if (field.kind === 'date') {
              <!-- El selector de fecha del sistema (DD/MM/AAAA): el «type=date»
                   nativo pinta el formato del idioma del navegador (mm/dd/yyyy en
                   uno en inglés). Lo que viaja sigue siendo AAAA-MM-DD. -->
              <app-date-picker
                [value]="aFecha(draft()[field.key])"
                (valueChange)="set(field.key, deFecha($event))"
              />
            } @else {
              <app-input
                type="text"
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
    /* El buscador principal (el primer campo de texto que no es avanzado) ocupa dos
       columnas (la fila entera en el teléfono): su texto de ejemplo no se corta. Va
       primero en el DOM (ver «visibleFields»), no por «order»: el orden de foco
       tiene que ser el orden visual (WCAG 1.3.2 / 2.4.3). */
    .filter-form__wide {
      grid-column: 1 / -1;
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
    /* «Más filtros» abre campos, no aplica nada: separado de Quitar / Aplicar. */
    .filter-form__more {
      margin-inline-end: var(--sp-4);
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
      /* Cada campo pide el ancho de lo que muestra: un select, su opción
         «Cualquier …» entera (no «Cualquier per…»); una fecha, DD/MM/AAAA y su
         botón. Si no entran todos (Auditoría: 4 campos + 3 acciones), los
         CAMPOS pasan a otra fila: nunca se trunca un valor ni bajan las acciones. */
      .filter-form__fields > * {
        flex: 1 1 11rem;
        min-inline-size: 0;
      }
      .filter-form__fields > .filter-form__campo--select {
        flex: 1 0 13rem;
      }
      .filter-form__fields > .filter-form__campo--date {
        flex: 1 0 11rem;
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
  /** El buscador principal: el primer campo de texto que no es avanzado. */
  private readonly buscador = computed(() =>
    this.fields().find((f) => f.kind === 'text' && f.advanced !== true) ?? null,
  );
  /**
   * En el orden en que se dibujan Y se recorren con el teclado: el buscador
   * principal primero, el resto en el orden declarado.
   */
  protected readonly visibleFields = computed(() => {
    const visibles = this.expanded() ? this.fields() : this.fields().filter((f) => f.advanced !== true);
    const buscador = this.buscador();
    return buscador ? [buscador, ...visibles.filter((f) => f !== buscador)] : visibles;
  });

  /** «AAAA-MM-DD» (el valor de la URL) → fecha local, o `null`. */
  protected aFecha(valor: string | undefined): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor ?? '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  /** Fecha elegida → «AAAA-MM-DD», sin pasar por UTC (sin corrimiento de día). */
  protected deFecha(fecha: Date | null): string {
    if (!fecha) return '';
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
  }

  protected esBuscador(field: FilterField): boolean {
    return field === this.buscador();
  }
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
