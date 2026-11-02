import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type {
  ModuleEntry,
  ModulesCatalog,
} from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { accionDeMatriz, coberturaDeCelda, nombreDeModulo } from './rbac-matrix-labels';
import { buildMatrix, cellRoles } from './rbac-matrix-model';
import { RoleViewEditor } from './role-view-editor';

export const MATRIX_MODES = ['action', 'role'] as const;
export type MatrixMode = (typeof MATRIX_MODES)[number];

/**
 * Pestaña «Matriz»: filas = recursos del módulo, columnas = las acciones que el módulo ofrece, celdas
 * = qué roles tienen el permiso fino. Junto a eso, SIEMPRE, los roles que las rutas exigen hoy con
 * `@Roles`: es lo que de verdad autoriza, y verlo al lado impide confundir un permiso asignado con
 * uno que se evalúa. La vista por rol (`app-portal-rbac-role-view`) edita con borrador.
 */
@Component({
  selector: 'app-portal-rbac-matrix-panel',
  imports: [AppButton, Badge, Select, SegmentedControl, FormField, SearchField, RoleViewEditor],
  template: `
    <div class="rbac__stack" data-testid="rbac-matrix-panel">
      <div class="rbac__toolbar" [class.rbac__toolbar--two]="mode() === 'role'">
        <app-form-field label="Módulo">
          <app-select
            ariaLabel="Módulo"
            data-testid="rbac-module-select"
            [options]="moduleOptions()"
            [value]="module().key"
            (valueChange)="moduleChanged.emit($event ?? '')"
          />
        </app-form-field>
        <app-form-field label="Vista">
          <app-segmented-control
            ariaLabel="Vista de la matriz"
            data-testid="rbac-mode"
            [options]="modeOptions"
            [value]="mode()"
            (valueChange)="modeChanged.emit($event)"
          />
        </app-form-field>
        @if (mode() === 'action') {
          <app-form-field label="Buscar recurso">
            <app-search-field
              label="Buscar recursos"
              placeholder="Nombre del recurso"
              [(value)]="query"
            />
          </app-form-field>
        }
      </div>

      <p class="rbac__meta" aria-live="polite">
        <strong>{{ label(module().key) }}</strong> · {{ moduleHint() }}
      </p>

      @if (mode() === 'role') {
        <app-portal-rbac-role-view
          [catalog]="catalog()"
          [module]="module()"
          [roleId]="roleId()"
          (roleChanged)="roleChanged.emit($event)"
          (moduleChanged)="moduleChanged.emit($event)"
          (saved)="saved.emit()"
        />
      } @else {
        <ul class="rbac-legend" aria-label="Cómo leer la matriz">
          <li>
            <app-badge size="sm" variant="success">ROL</app-badge>
            <span>El rol tiene el permiso</span>
          </li>
          <li>
            <app-badge size="sm" variant="error">Niega ROL</app-badge>
            <span>El rol lo tiene negado</span>
          </li>
          <li>
            <app-badge size="sm" variant="warning">Sólo por rol</app-badge>
            <span>Sin permiso fino: decide el rol de la ruta</span>
          </li>
          <li>
            <span class="rbac__route">Rutas exigen: ROL</span>
            <span>Rol que la ruta pide hoy (lo que autoriza de verdad)</span>
          </li>
          <li>
            <span class="rbac__none" aria-hidden="true">—</span>
            <span>El recurso no ofrece esa acción</span>
          </li>
        </ul>

        <div
          class="rbac__scroll"
          role="region"
          tabindex="0"
          [attr.aria-label]="'Matriz de ' + label(module().key)"
        >
          <table class="rbac__table rbac__table--matrix" data-testid="rbac-matrix-table">
            <caption class="rbac__sr">
              Qué roles tienen cada permiso fino en
              {{
                label(module().key)
              }}, y qué roles exigen hoy las rutas
            </caption>
            <thead>
              <tr>
                <th scope="col">Recurso</th>
                @for (a of matrix().columns; track a) {
                  <th scope="col">{{ actionLabel(a) }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of matrix().rows; track row.resource) {
                <tr>
                  <th scope="row">
                    <span class="rbac__resource">{{ row.resource }}</span>
                  </th>
                  @for (cell of row.cells; track $index) {
                    <td>
                      @if (cell === null) {
                        <span class="rbac__none" aria-hidden="true">—</span>
                        <span class="rbac__sr">No ofrece esta acción</span>
                      } @else {
                        @let roles = rolesOf(cell, row.permissions);
                        <div class="rbac__cell">
                          @if (cell.permissionIds.length > 0) {
                            <span class="rbac__badges">
                              @for (code of roles.allow; track code) {
                                <app-badge size="sm" variant="success">{{ code }}</app-badge>
                              }
                              @for (code of roles.deny; track code) {
                                <app-badge size="sm" variant="error">Niega {{ code }}</app-badge>
                              }
                              @if (roles.allow.length === 0 && roles.deny.length === 0) {
                                <span class="rbac__none">Ningún rol</span>
                              }
                            </span>
                          } @else {
                            <span class="rbac__badges">
                              <app-badge size="sm" [variant]="coverageTone(cell.coverage)">{{
                                coverage(cell.coverage)
                              }}</app-badge>
                            </span>
                          }
                          @if (cell.routeRoles.length > 0) {
                            <span class="rbac__route" [attr.title]="cell.proposedCode ?? null">
                              Rutas exigen: {{ cell.routeRoles.join(', ') }}
                            </span>
                          } @else if (
                            cell.routeCount > 0 && cell.publicRouteCount === cell.routeCount
                          ) {
                            <span class="rbac__route">Pública</span>
                          }
                        </div>
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr>
                  <td class="rbac__empty-row" [attr.colspan]="matrix().columns.length + 1">
                    <span>Ningún recurso coincide con «{{ query() }}».</span>
                    <button app-button variant="ghost" size="sm" (clicked)="query.set('')">
                      Limpiar búsqueda
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styleUrl: './rbac-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrixPanel {
  readonly catalog = input.required<ModulesCatalog>();
  readonly module = input.required<ModuleEntry>();
  readonly mode = input.required<MatrixMode>();
  readonly roleId = input.required<string>();
  readonly moduleChanged = output<string>();
  readonly modeChanged = output<MatrixMode>();
  readonly roleChanged = output<string>();
  readonly saved = output<void>();

  protected readonly query = signal('');
  protected readonly modeOptions: readonly SegmentedOption<MatrixMode>[] = [
    { value: 'action', label: 'Por acción' },
    { value: 'role', label: 'Por rol' },
  ];

  protected readonly moduleOptions = computed<readonly SelectOption<string>[]>(() =>
    this.catalog().modules.map((m) => ({
      value: m.key,
      label: `${nombreDeModulo(m.key)} · ${plural(m.permissionCount, 'permiso', 'permisos')} · ${plural(m.gaps.length, 'hueco', 'huecos')}`,
    })),
  );
  protected readonly moduleHint = computed(() => {
    const m = this.module();
    return m.permissionCount === 0
      ? `${m.routes.total} rutas. Este módulo no tiene ningún permiso fino: lo autorizan sólo los roles de sus rutas.`
      : `${m.routes.total} rutas · ${m.permissionCount} permisos finos · ${m.gaps.length} ${m.gaps.length === 1 ? 'hueco' : 'huecos'}`;
  });
  protected readonly matrix = computed(() => buildMatrix(this.module(), this.query()));

  protected readonly rolesOf = cellRoles;

  protected label(key: string): string {
    return nombreDeModulo(key);
  }
  protected actionLabel(action: string): string {
    return accionDeMatriz(action).label;
  }
  protected coverage(code: string): string {
    return coberturaDeCelda(code).label;
  }
  protected coverageTone(code: string) {
    return coberturaDeCelda(code).tone;
  }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
