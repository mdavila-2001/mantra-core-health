import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { ModulesCatalog } from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import {
  SEVERIDADES,
  TIPOS_DE_HUECO,
  nombreDeModulo,
  severidadDeHueco,
  tipoDeHueco,
} from './rbac-matrix-labels';
import { allGaps, filterGaps } from './rbac-matrix-model';

const PAGE = 40;
const ALL = '';

/**
 * Pestaña «Huecos»: grupos de rutas protegidos sólo por un rol grueso (o sin autorización declarada)
 * para los que no existe un permiso fino, con el código `<modulo>.<recurso>.<accion>` que se
 * propone. Es una PROPUESTA derivada de las rutas reales: nada se siembra desde acá.
 */
@Component({
  selector: 'app-portal-rbac-gaps-panel',
  imports: [AppButton, Badge, Select, FormField, SearchField],
  template: `
    <div class="rbac__stack" data-testid="rbac-gaps-panel">
      <div class="rbac__toolbar rbac__toolbar--gaps">
        <app-form-field label="Módulo">
          <app-select
            ariaLabel="Módulo"
            [options]="moduleOptions()"
            [value]="module()"
            (valueChange)="setModule($event ?? '')"
          />
        </app-form-field>
        <app-form-field label="Prioridad">
          <app-select
            ariaLabel="Prioridad"
            [options]="severityOptions"
            [value]="severity()"
            (valueChange)="severity.set($event ?? ''); resetPage()"
          />
        </app-form-field>
        <app-form-field label="Tipo de hueco">
          <app-select
            ariaLabel="Tipo de hueco"
            [options]="kindOptions"
            [value]="kind()"
            (valueChange)="kind.set($event ?? ''); resetPage()"
          />
        </app-form-field>
        <app-search-field label="Buscar" placeholder="Recurso, código o rol" [(value)]="query" />
      </div>

      <p class="rbac__meta" aria-live="polite" data-testid="rbac-gaps-count">
        {{ filtered().length }} {{ filtered().length === 1 ? 'hueco' : 'huecos' }} de {{ total() }}.
      </p>

      @if (filtered().length === 0) {
        <div class="rbac__empty" data-testid="rbac-gaps-empty">
          @if (total() === 0) {
            <p>No se detectó ningún hueco en lo que el servidor devolvió.</p>
          } @else {
            <p>Ningún hueco coincide con los filtros.</p>
            <button app-button variant="secondary" size="sm" (clicked)="clearFilters()">
              Quitar filtros
            </button>
          }
        </div>
      } @else {
        <div class="rbac__scroll" role="region" tabindex="0" aria-label="Huecos de autorización">
          <table class="rbac__table rbac__table--gaps">
            <caption class="rbac__sr">
              Rutas sin permiso fino, con el código que se propone
            </caption>
            <thead>
              <tr>
                <th scope="col">Módulo y recurso</th>
                <th scope="col">Prioridad</th>
                <th scope="col">Tipo</th>
                <th scope="col">Código propuesto</th>
                <th scope="col" class="rbac__num">Rutas</th>
                <th scope="col">Hoy la autoriza</th>
              </tr>
            </thead>
            <tbody>
              @for (g of visible(); track $index) {
                <tr data-testid="rbac-gap">
                  <th scope="row">
                    <span class="rbac__resource-name">{{ label(g.module) }}</span>
                    @if (g.resource) {
                      <span class="rbac__resource">{{ g.resource }}</span>
                    }
                  </th>
                  <td>
                    <app-badge size="sm" [variant]="severityLabel(g.severity).tone">{{
                      severityLabel(g.severity).label
                    }}</app-badge>
                  </td>
                  <td>
                    <app-badge size="sm" [variant]="kindLabel(g.kind).tone">{{
                      kindLabel(g.kind).label
                    }}</app-badge>
                  </td>
                  <td>
                    @if (g.proposedCode) {
                      <code class="rbac__code">{{ g.proposedCode }}</code>
                    } @else {
                      <span class="rbac__secondary"
                        >Todo el módulo: proponga el catálogo por recurso y acción.</span
                      >
                    }
                  </td>
                  <td class="rbac__num">
                    @if (g.sampleRoutes.length > 0) {
                      <details class="rbac__routes-more">
                        <summary>{{ g.routeCount }}</summary>
                        <ul class="rbac__routes">
                          @for (r of g.sampleRoutes; track r.template + r.method) {
                            <li>
                              <code>{{ r.method }} {{ r.template }}</code>
                              <span class="rbac__secondary">{{ r.controller }}.{{ r.handler }}</span>
                            </li>
                          }
                        </ul>
                      </details>
                    } @else {
                      {{ g.routeCount }}
                    }
                  </td>
                  <td>
                    @if (g.roles.length > 0) {
                      <span class="rbac__badges">
                        @for (code of g.roles; track code) {
                          <app-badge size="sm" variant="secondary">{{ code }}</app-badge>
                        }
                      </span>
                    } @else if (g.kind === 'UNDECLARED_AUTH') {
                      <span class="rbac__secondary"
                        >Ningún rol declarado: puede decidirse en el servicio por pertenencia o
                        propiedad</span
                      >
                    } @else {
                      <span class="rbac__none">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (visible().length < filtered().length) {
          <div class="rbac__actions">
            <button
              app-button
              variant="secondary"
              data-testid="rbac-gaps-more"
              (clicked)="shown.set(shown() + PAGE)"
            >
              Mostrar más ({{ filtered().length - visible().length }} restantes)
            </button>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './rbac-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GapsPanel {
  readonly catalog = input.required<ModulesCatalog>();
  /** El módulo con que se abre la pestaña (viene de la URL o del botón de la cobertura). */
  readonly module = input<string>('');
  readonly moduleChanged = output<string>();

  protected readonly PAGE = PAGE;
  protected readonly severity = signal(ALL);
  protected readonly kind = signal(ALL);
  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);

  protected readonly severityOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: 'Todas las prioridades' },
    ...SEVERIDADES.map((c) => ({ value: c, label: severidadDeHueco(c).label })),
  ];
  protected readonly kindOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: 'Todos los tipos' },
    ...TIPOS_DE_HUECO.map((c) => ({ value: c, label: tipoDeHueco(c).label })),
  ];
  protected readonly moduleOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: ALL, label: 'Todos los módulos' },
    ...this.catalog()
      .modules.filter((m) => m.gaps.length > 0)
      .map((m) => ({ value: m.key, label: `${nombreDeModulo(m.key)} · ${m.gaps.length}` })),
  ]);

  private readonly everything = computed(() => allGaps(this.catalog()));
  protected readonly total = computed(() => this.everything().length);
  protected readonly filtered = computed(() =>
    filterGaps(this.everything(), {
      module: this.module(),
      severity: this.severity(),
      kind: this.kind(),
      query: this.query(),
    }),
  );
  protected readonly visible = computed(() => this.filtered().slice(0, this.shown()));

  protected setModule(key: string): void {
    this.shown.set(PAGE);
    this.moduleChanged.emit(key);
  }
  protected clearFilters(): void {
    this.severity.set(ALL);
    this.kind.set(ALL);
    this.query.set('');
    this.setModule(ALL);
  }
  protected resetPage(): void {
    this.shown.set(PAGE);
  }
  protected label(key: string): string {
    return nombreDeModulo(key);
  }
  protected severityLabel(code: string) {
    return severidadDeHueco(code);
  }
  protected kindLabel(code: string) {
    return tipoDeHueco(code);
  }
}
