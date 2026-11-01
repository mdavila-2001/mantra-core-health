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
      <ul class="rbac__stats" aria-label="Resumen">
        <li>
          <strong>{{ catalog().summary.modules }}</strong> módulos
        </li>
        <li>
          <strong>{{ catalog().summary.permissions }}</strong> permisos finos
        </li>
        <li>
          <strong>{{ catalog().summary.routes }}</strong> rutas
        </li>
        <li>
          <strong>{{ catalog().summary.roleOnlyRoutes }}</strong> sólo por rol
        </li>
        <li>
          <strong>{{ catalog().summary.undeclaredAuthRoutes }}</strong> sin autorización declarada
        </li>
        <li>
          <strong>{{ catalog().summary.modulesWithoutFinePermissions }}</strong> módulos sin
          permisos finos
        </li>
      </ul>
      <div class="rbac__scroll" role="region" tabindex="0" aria-label="Cobertura por módulo">
        <table class="rbac__table" data-testid="rbac-coverage-table">
          <caption class="rbac__caption">
            Cobertura de permisos finos por módulo, de más a menos huecos
          </caption>
          <thead>
            <tr>
              <th scope="col">Módulo</th>
              <th scope="col">Rutas</th>
              <th scope="col">Sólo rol</th>
              <th scope="col">Sin declarar</th>
              <th scope="col">Permisos</th>
              <th scope="col">Cobertura fina</th>
              <th scope="col">Huecos</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.module) {
              <tr>
                <th scope="row">{{ label(r.module) }}</th>
                <td>{{ r.total }}</td>
                <td>{{ r.roleOnly }}</td>
                <td>{{ r.undeclared }}</td>
                <td>{{ r.permissions }}</td>
                <td>
                  @if (r.finePercent === null) {
                    <span class="rbac__none">No aplica</span>
                  } @else {
                    <progress
                      class="rbac__progress"
                      max="100"
                      [value]="r.finePercent"
                      [attr.aria-label]="'Cobertura fina de ' + label(r.module)"
                    ></progress>
                    <span class="rbac__secondary">{{ r.finePercent }} %</span>
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
