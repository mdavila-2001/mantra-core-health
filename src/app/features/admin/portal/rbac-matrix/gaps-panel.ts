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
      <div class="rbac__toolbar">
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

      <p class="rbac__secondary" aria-live="polite" data-testid="rbac-gaps-count">
        {{ filtered().length }} {{ filtered().length === 1 ? 'hueco' : 'huecos' }} de {{ total() }}.
      </p>

      @if (filtered().length === 0) {
        <p class="rbac__note" data-testid="rbac-gaps-empty">
          @if (total() === 0) {
            No se detectó ningún hueco en lo que el servidor devolvió.
          } @else {
            Ningún hueco coincide con los filtros. Quite alguno para ver el resto.
          }
        </p>
      } @else {
        <ul class="rbac__list">
          @for (g of visible(); track $index) {
            <li class="rbac__item" data-testid="rbac-gap">
              <div class="rbac__item-head">
                <app-badge size="sm" [variant]="severityLabel(g.severity).tone">{{
                  severityLabel(g.severity).label
                }}</app-badge>
                <app-badge size="sm" [variant]="kindLabel(g.kind).tone">{{
                  kindLabel(g.kind).label
                }}</app-badge>
                <strong>{{ label(g.module) }}</strong>
                @if (g.resource) {
                  <span class="rbac__secondary">· {{ g.resource }}</span>
                }
              </div>
              @if (g.proposedCode) {
                <p class="rbac__row">
                  Código propuesto: <code class="rbac__code">{{ g.proposedCode }}</code>
                </p>
              } @else {
                <p class="rbac__row">
                  Ninguna ruta de este módulo está respaldada por un permiso fino. Proponga el
                  catálogo por recurso y acción.
                </p>
              }
              <p class="rbac__secondary">
                {{ g.routeCount }} {{ g.routeCount === 1 ? 'ruta' : 'rutas' }}
                @if (g.roles.length > 0) {
                  · Hoy las autoriza: {{ g.roles.join(', ') }}
                } @else if (g.kind === 'UNDECLARED_AUTH') {
                  · Ningún rol declarado: puede autorizarse en el servicio por pertenencia o
                  propiedad
                }
              </p>
              @if (g.sampleRoutes.length > 0) {
                <details>
                  <summary>Rutas de ejemplo ({{ g.sampleRoutes.length }})</summary>
                  <ul class="rbac__routes">
                    @for (r of g.sampleRoutes; track r.template + r.method) {
                      <li>
                        <code>{{ r.method }} {{ r.template }}</code>
                        <span class="rbac__secondary">{{ r.controller }}.{{ r.handler }}</span>
                      </li>
                    }
                  </ul>
                </details>
              }
            </li>
          }
        </ul>
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
