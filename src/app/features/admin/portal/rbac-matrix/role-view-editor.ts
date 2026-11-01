import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthzAdminClient } from '../../../../core/data-access/authz-admin/authz-admin.client';
import { AuthzGovernanceClient } from '../../../../core/data-access/authz-governance/authz-governance.client';
import type { SetRolePermissionsInput } from '../../../../core/data-access/authz-governance/authz-governance.types';
import type {
  ModuleEntry,
  ModulesCatalog,
} from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { governanceFailure } from '../permissions/permissions-labels';
import { accionDeMatriz, coberturaDeCelda, nombreDeModulo } from './rbac-matrix-labels';
import {
  buildMatrix,
  buildSavePlan,
  draftChangeCount,
  effectOf,
  indexCatalog,
  roleCountsByModule,
  type DraftEffect,
} from './rbac-matrix-model';

const EFFECT_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Sin asignar' },
  { value: 'ALLOW', label: 'Permite' },
  { value: 'DENY', label: 'Niega' },
];

/**
 * Vista por rol: todas las acciones del rol en el módulo elegido, con edición por BORRADOR.
 *
 * Nada se escribe hasta «Guardar», que (1) vuelve a leer del servidor los permisos que el rol
 * tiene HOY —la foto del catálogo puede ser vieja y la API reemplaza todo lo activo—, (2) arma el
 * reemplazo conservando ámbito, restricción y conjunto de campos de lo que no se tocó, y (3) pide
 * confirmación con el resumen. Si el guardado falla, el borrador queda.
 */
@Component({
  selector: 'app-portal-rbac-role-view',
  imports: [AppButton, Badge, Select, Alert, FormField],
  template: `
    <div class="rbac__stack" data-testid="rbac-role-view">
      @if (notice(); as message) {
        <app-alert
          tone="success"
          dismissible
          (dismissed)="notice.set(null)"
          data-testid="rbac-role-notice"
          >{{ message }}</app-alert
        >
      }
      @if (error(); as message) {
        <app-alert tone="error" data-testid="rbac-role-error">{{ message }}</app-alert>
      }
      @if (catalog().truncated) {
        <app-alert tone="warning" data-testid="rbac-role-truncated">
          La lectura del catálogo quedó incompleta (superó el tope). Por seguridad no se edita
          ningún rol desde estos datos.
        </app-alert>
      }
      <app-form-field
        label="Rol"
        [hint]="locked() ? 'Guarde o descarte los cambios para elegir otro rol.' : ''"
      >
        <app-select
          ariaLabel="Rol"
          placeholder="Elegir un rol"
          data-testid="rbac-role-select"
          [options]="roleOptions()"
          [value]="roleId() || null"
          [disabled]="locked()"
          (valueChange)="roleChanged.emit($event ?? '')"
        />
      </app-form-field>

      @if (roleId() === '') {
        <div class="rbac__empty">
          <p>Elija un rol para ver todo lo que puede hacer en cada módulo y editarlo.</p>
        </div>
      } @else {
        <section aria-label="Permisos del rol por módulo">
          <h3 class="rbac__subtitle">Permisos finos del rol, por módulo</h3>
          <ul class="rbac__chips">
            @for (c of counts(); track c.module) {
              <li>
                <button
                  type="button"
                  class="rbac__chip"
                  [class.rbac__chip--on]="c.module === module().key"
                  [attr.aria-current]="c.module === module().key ? 'true' : null"
                  (click)="moduleChanged.emit(c.module)"
                >
                  {{ label(c.module) }}
                  <span class="rbac__chip-count"
                    >{{ c.allow }} permite{{ c.deny > 0 ? ' · ' + c.deny + ' niega' : '' }} de
                    {{ c.total }}</span
                  >
                </button>
              </li>
            }
          </ul>
        </section>

        <div
          class="rbac__scroll"
          role="region"
          tabindex="0"
          [attr.aria-label]="'Permisos del rol en ' + label(module().key)"
        >
          <table class="rbac__table" data-testid="rbac-role-table">
            <caption class="rbac__sr">
              Permisos del rol
              {{
                role()?.name
              }}
              en
              {{
                label(module().key)
              }}
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
                  <th scope="row">{{ row.resource }}</th>
                  @for (cell of row.cells; track $index) {
                    <td>
                      @if (cell === null) {
                        <span class="rbac__none" aria-hidden="true">·</span>
                        <span class="rbac__sr">No ofrece esta acción</span>
                      } @else if (cell.permissionIds.length === 0) {
                        <span class="rbac__none">Sin permiso fino</span>
                        @if (roleCodeIn(cell.routeRoles)) {
                          <app-badge size="sm" variant="info">Rol exigido por las rutas</app-badge>
                        }
                        <span class="rbac__sr">{{ coverage(cell.coverage) }}</span>
                      } @else {
                        @for (id of cell.permissionIds; track id) {
                          <div class="rbac__perm">
                            <app-select
                              [ariaLabel]="'Efecto de ' + codeOf(id)"
                              [options]="effectOptions"
                              [value]="effect(id)"
                              [disabled]="saving() || catalog().truncated"
                              (valueChange)="setEffect(id, $event ?? '')"
                            />
                            <code class="rbac__code">{{ codeOf(id) }}</code>
                            @if (isChanged(id)) {
                              <app-badge size="sm" variant="info">Cambiado</app-badge>
                            }
                            @if (isDangerous(id)) {
                              <app-badge size="sm" variant="warning">Sensible</app-badge>
                            }
                          </div>
                        }
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="matrix().columns.length + 1">
                    Este módulo no tiene recursos para mostrar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="rbac__note">
          El ámbito de lo que ya tiene el rol se conserva; lo nuevo usa el ámbito predeterminado del
          permiso. Las celdas «Sin permiso fino» son huecos: aún no hay nada que asignar ahí.
        </p>

        <div class="rbac__actions">
          <span class="rbac__secondary" aria-live="polite" data-testid="rbac-role-summary">{{
            summary()
          }}</span>
          <button
            app-button
            variant="ghost"
            [disabled]="saving() || changeCount() === 0"
            (clicked)="discard()"
          >
            Descartar cambios
          </button>
          <button
            app-button
            variant="primary"
            data-testid="rbac-role-save"
            [isLoading]="saving()"
            [disabled]="changeCount() === 0 || catalog().truncated"
            (clicked)="save()"
          >
            Revisar y guardar
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './rbac-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleViewEditor {
  private readonly authz = inject(AuthzAdminClient);
  private readonly governance = inject(AuthzGovernanceClient);
  private readonly dialogs = inject(DialogService);

  readonly catalog = input.required<ModulesCatalog>();
  readonly module = input.required<ModuleEntry>();
  readonly roleId = input.required<string>();
  readonly roleChanged = output<string>();
  readonly moduleChanged = output<string>();
  /** El guardado terminó bien: el contenedor vuelve a leer el catálogo. */
  readonly saved = output<void>();

  protected readonly effectOptions = EFFECT_OPTIONS;
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly draft = signal<ReadonlyMap<string, DraftEffect>>(new Map());

  private readonly index = computed(() => indexCatalog(this.catalog()));
  protected readonly role = computed(() =>
    this.catalog().roles.find((r) => r.id === this.roleId()),
  );
  protected readonly roleOptions = computed<readonly SelectOption<string>[]>(() =>
    this.catalog().roles.map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` })),
  );
  protected readonly matrix = computed(() => buildMatrix(this.module()));
  protected readonly counts = computed(() =>
    roleCountsByModule(this.catalog(), this.index(), this.roleId(), this.draft()),
  );
  protected readonly changeCount = computed(() =>
    draftChangeCount(this.index(), this.roleId(), this.draft()),
  );
  protected readonly locked = computed(() => this.saving() || this.changeCount() > 0);
  protected readonly summary = computed(() => {
    const n = this.changeCount();
    return n === 0
      ? 'Sin cambios pendientes.'
      : `${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'}.`;
  });

  private readonly subscriptions: Subscription[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscriptions.forEach((s) => s.unsubscribe()));
    // Otro rol o un catálogo recién leído: el borrador anterior ya no describe nada.
    effect(() => {
      this.roleId();
      this.catalog();
      untracked(() => {
        this.draft.set(new Map());
        this.error.set(null);
      });
    });
  }

  protected label(key: string): string {
    return nombreDeModulo(key);
  }
  protected actionLabel(action: string): string {
    return accionDeMatriz(action).label;
  }
  protected coverage(code: string): string {
    return coberturaDeCelda(code).label;
  }
  protected codeOf(permissionId: string): string {
    return this.index().permissionById.get(permissionId)?.code ?? permissionId;
  }
  protected isDangerous(permissionId: string): boolean {
    return this.index().permissionById.get(permissionId)?.isDangerous ?? false;
  }
  protected roleCodeIn(codes: readonly string[]): boolean {
    const code = this.role()?.code;
    return code !== undefined && codes.includes(code);
  }
  protected effect(permissionId: string): string {
    return effectOf(this.index(), this.roleId(), permissionId, this.draft());
  }
  protected isChanged(permissionId: string): boolean {
    const saved = this.index().grantsByRole.get(this.roleId())?.get(permissionId)?.effect ?? '';
    return this.effect(permissionId) !== saved;
  }

  protected setEffect(permissionId: string, effect: string): void {
    const value: DraftEffect = effect === 'ALLOW' || effect === 'DENY' ? effect : '';
    this.draft.update((m) => new Map(m).set(permissionId, value));
  }

  protected discard(): void {
    this.draft.set(new Map());
    this.error.set(null);
  }

  protected save(): void {
    const roleId = this.roleId();
    this.saving.set(true);
    this.error.set(null);
    this.subscriptions.push(
      this.authz.rolePermissions(roleId).subscribe({
        next: (current) => void this.confirmAndWrite(roleId, current.items),
        error: (e: unknown) =>
          this.fail(
            e,
            'No se pudieron leer los permisos actuales del rol. Lo que editó sigue acá.',
          ),
      }),
    );
  }

  private async confirmAndWrite(
    roleId: string,
    serverItems: readonly {
      readonly permissionId: string;
      readonly effect: string;
      readonly scope: string | null;
    }[],
  ): Promise<void> {
    const plan = buildSavePlan({
      base: serverItems,
      draft: this.draft(),
      index: this.index(),
      roleId,
    });
    if (plan.unknown.length > 0) {
      return this.fail(
        null,
        'El rol tiene permisos que este catálogo no conoce (cambió mientras lo miraba). Recargue la pantalla antes de guardar: así no se pierde nada.',
      );
    }
    if (plan.wouldEmpty) {
      return this.fail(
        null,
        'Un rol tiene que conservar al menos un permiso: la API no acepta dejarlo vacío.',
      );
    }
    if (plan.total === 0) {
      this.saving.set(false);
      this.notice.set('El servidor ya tenía exactamente eso: no hay nada que guardar.');
      this.draft.set(new Map());
      return;
    }
    const ok = await this.dialogs.confirmarCambios({
      title: `Guardar los permisos de ${this.role()?.name ?? 'este rol'}`,
      message:
        'Se reemplazan los permisos del rol. Quienes lo tienen lo notan en la próxima renovación de su sesión. El cambio queda en la bitácora con su autor.',
      details: [
        { label: 'Por agregar', value: lines(plan.added) },
        { label: 'Por cambiar', value: lines(plan.changed) },
        { label: 'Por quitar', value: lines(plan.removed) },
        ...(plan.dangerousGranted > 0
          ? [{ label: 'Sensibles que pasan a permitirse', value: String(plan.dangerousGranted) }]
          : []),
      ],
      confirmLabel: 'Guardar',
    });
    if (!ok) {
      this.saving.set(false);
      return;
    }
    // `constraintJson` y `fieldValueSetId` viajan aunque el tipo del cliente no los nombre: la API
    // los acepta y, sin ellos, el reemplazo borraría la restricción de lo que no se tocó.
    const body = { permissions: plan.bindings } as unknown as SetRolePermissionsInput;
    this.subscriptions.push(
      this.governance.setRolePermissions(roleId, body).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.draft.set(new Map());
          this.notice.set(
            `Se guardaron los permisos de ${this.role()?.name ?? 'el rol'}: ahora tiene ${result.permissionCount}.`,
          );
          this.saved.emit();
        },
        error: (e: unknown) =>
          this.fail(e, 'No se pudieron guardar los permisos. Lo que editó sigue acá.'),
      }),
    );
  }

  /** El borrador se conserva: perder lo que se editó por un fallo está prohibido. */
  private fail(e: unknown, fallback: string): void {
    this.saving.set(false);
    this.error.set(e === null ? fallback : governanceFailure(e, fallback));
  }
}

const lines = (items: readonly { readonly code: string }[]): string =>
  items.length === 0 ? 'Ninguno' : items.map((l) => l.code).join(', ');
