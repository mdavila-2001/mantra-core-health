import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ModulesCatalog } from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { nombreDeModulo } from './rbac-matrix-labels';
import { coverageRows } from './rbac-matrix-model';

/**
 * Pestaña «Cobertura»: por módulo, cuántas de las rutas que autorizan algo están respaldadas por un
 * permiso fino. El porcentaje es de RUTAS EN CELDAS CON PERMISO FINO, no de rutas que lo evalúan:
 * hoy ningún controlador evalúa permisos finos, así que esto mide cuánto del catálogo está
 * definido, no cuánto está en vigor. Sin rutas que autorizar no hay porcentaje (ni 0 ni 100).
 */
@Component({
  selector: 'app-portal-rbac-coverage-panel',
  imports: [AppButton],
  template: `
    <div class="rbac__stack" data-testid="rbac-coverage-panel">
      <p class="rbac__meta">
        Cuántas rutas que autorizan algo tienen ya un permiso fino definido. Mide lo definido en el
        catálogo, no lo que está en vigor.
      </p>
      <div class="rbac__scroll" role="region" tabindex="0" aria-label="Cobertura por módulo">
        <table class="rbac__table rbac__table--coverage" data-testid="rbac-coverage-table">
          <caption class="rbac__sr">
            Cobertura de permisos finos por módulo, de más a menos huecos
          </caption>
          <thead>
            <tr>
              <th scope="col">Módulo</th>
              <th scope="col" class="rbac__num">Rutas</th>
              <th scope="col" class="rbac__num">Sólo rol</th>
              <th scope="col" class="rbac__num">Sin declarar</th>
              <th scope="col" class="rbac__num">Permisos</th>
              <th scope="col">Cobertura fina</th>
              <th scope="col">Huecos</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.module) {
              <tr>
                <th scope="row">{{ label(r.module) }}</th>
                <td class="rbac__num">{{ r.total }}</td>
                <td class="rbac__num">{{ r.roleOnly }}</td>
                <td class="rbac__num">{{ r.undeclared }}</td>
                <td class="rbac__num">{{ r.permissions }}</td>
                <td>
                  @if (r.finePercent === null) {
                    <span class="rbac__none">No aplica</span>
                  } @else {
                    <span class="rbac__bar">
                    <progress
                      class="rbac__progress"
                      max="100"
                      [value]="r.finePercent"
                      [attr.aria-label]="'Cobertura fina de ' + label(r.module)"
                    ></progress>
                    <span class="rbac__pct">{{ r.finePercent }} %</span>
                    </span>
                  }
                </td>
                <td>
                  @if (r.gaps > 0) {
                    <button
                      app-button
                      variant="ghost"
                      size="sm"
                      (clicked)="openGaps.emit(r.module)"
                    >
                      Ver {{ r.gaps }} {{ r.gaps === 1 ? 'hueco' : 'huecos' }}
                    </button>
                  } @else {
                    <span class="rbac__none">Ninguno</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrl: './rbac-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoveragePanel {
  readonly catalog = input.required<ModulesCatalog>();
  readonly openGaps = output<string>();

  protected readonly rows = computed(() => coverageRows(this.catalog()));

  protected label(key: string): string {
    return nombreDeModulo(key);
  }
}
