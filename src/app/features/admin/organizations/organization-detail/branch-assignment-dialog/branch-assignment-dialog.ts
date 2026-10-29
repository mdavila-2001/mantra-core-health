import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { DirectoryClient } from '../../../../../core/data-access/directory/directory.client';
import type {
  BranchAssignmentListItem,
  BranchListItem,
} from '../../../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { errorMessageOf } from '../../../../../shared/forms/form-support';

/**
 * Asignar una sede a alguien de la plantilla — UC-04-06
 * (`POST /tenants/{id}/memberships/{mid}/branch-assignments`), con su cara de
 * lectura (`GET …/branch-assignments`) al lado.
 *
 * ## Por qué existe
 *
 * El alta de membresía encadena la asignación cuando el alcance es «sólo una
 * sede», y si esa segunda llamada falla avisaba «completá la asignación desde
 * la ficha». La ficha no tenía cómo: el aviso mandaba a la persona a un lugar
 * donde la acción no existía. Este modal es esa acción.
 *
 * ## Lo que demuestra después de guardar
 *
 * No se fía del `201`: vuelve a leer las asignaciones y las muestra. Si la
 * sede elegida aparece en la lista releída, quedó guardada; un aviso de
 * «listo» sin releer no demuestra nada.
 *
 * Es un modal y no un selector en la fila (`composition-rules.md` §6): pide
 * elegir algo sobre un registro que ya existe.
 */
@Component({
  selector: 'app-branch-assignment-dialog',
  imports: [AnnounceOnAppear, Alert, AppButton, ContentDialog, FormField, Select, ViewStateHost],
  templateUrl: './branch-assignment-dialog.html',
  styleUrl: './branch-assignment-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchAssignmentDialog {
  private readonly directory = inject(DirectoryClient);

  readonly tenantId = input.required<string>();
  readonly membershipId = input.required<string>();
  /** Cómo se llama la persona, para el título. Nunca el uuid. */
  readonly persona = input.required<string>();
  /** Las sucursales de la organización, ya cargadas por la ficha. */
  readonly sucursales = input.required<readonly BranchListItem[]>();

  /** Se guardó una asignación y la relectura la confirma. */
  readonly asignada = output<BranchAssignmentListItem>();
  readonly closed = output<void>();

  /** Las asignaciones vigentes de la membresía, releídas tras cada guardado. */
  protected readonly asignaciones = signal<ViewState<readonly BranchAssignmentListItem[]>>(
    loading(),
  );

  /** La sede elegida en el modal. No sobrevive al cierre (§6). */
  protected readonly elegida = signal<string | null>(null);
  protected readonly envio = signal<ViewState<null>>(ready(null));
  protected readonly guardando = computed(() => this.envio().status === 'loading');
  protected readonly faltaElegir = signal(false);

  /** Confirmación tras releer: el nombre de la sede que ya figura asignada. */
  protected readonly confirmada = signal<string | null>(null);

  protected readonly errorDelEnvio = computed(() =>
    errorMessageOf(
      this.envio(),
      'Sólo quien administra la organización puede asignar sedes.',
      'No encontramos a esta persona en la plantilla: puede que ya no forme parte. Cierre y recargue la ficha.',
    ),
  );

  private readonly nombreDeSucursal = computed(
    () => new Map(this.sucursales().map((sucursal) => [sucursal.id, sucursal.name])),
  );

  protected readonly yaAsignadas = computed<ReadonlySet<string>>(() => {
    const estado = this.asignaciones();
    return new Set(estado.status === 'ready' ? estado.data.map((a) => a.branchId) : []);
  });

  /** Las sedes que todavía no tiene: asignar dos veces la misma no suma nada. */
  protected readonly opciones = computed<readonly SelectOption<string>[]>(() =>
    this.sucursales()
      .filter((sucursal) => !this.yaAsignadas().has(sucursal.id))
      .map((sucursal) => ({ value: sucursal.id, label: sucursal.name })),
  );

  protected readonly titulo = computed(() => `Asignar sede a ${this.persona()}`);

  constructor() {
    effect(() => {
      const tenantId = this.tenantId();
      const membershipId = this.membershipId();
      untracked(() => this.releer(tenantId, membershipId));
    });
  }

  protected nombreDe(branchId: string): string {
    return this.nombreDeSucursal().get(branchId) ?? 'Sede sin nombre en el listado';
  }

  protected elegir(valor: string | null): void {
    this.elegida.set(valor);
    this.faltaElegir.set(false);
  }

  protected recargar(): void {
    this.releer(this.tenantId(), this.membershipId());
  }

  protected asignar(): void {
    if (this.guardando()) return;
    const branchId = this.elegida();
    if (branchId === null) {
      this.faltaElegir.set(true);
      return;
    }

    this.envio.set(loading());
    this.confirmada.set(null);
    this.directory.assignBranch(this.tenantId(), this.membershipId(), { branchId }).subscribe({
      next: (asignacion) => {
        this.envio.set(ready(null));
        this.elegida.set(null);
        this.releer(this.tenantId(), this.membershipId(), asignacion);
      },
      error: (error: unknown) => this.envio.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Lee las asignaciones. Con `recienCreada`, además confirma que la relectura
   * la trae: es la prueba de que quedó persistida, no el `201`.
   */
  private releer(
    tenantId: string,
    membershipId: string,
    recienCreada?: BranchAssignmentListItem,
  ): void {
    this.asignaciones.set(loading());
    this.directory.listBranchAssignments(tenantId, membershipId).subscribe({
      next: (lista) => {
        this.asignaciones.set(ready(lista.items));
        if (recienCreada !== undefined) {
          const guardada = lista.items.find((a) => a.branchId === recienCreada.branchId);
          if (guardada !== undefined) {
            this.confirmada.set(this.nombreDe(guardada.branchId));
            this.asignada.emit(guardada);
          }
        }
      },
      error: (error: unknown) =>
        this.asignaciones.set(errorToViewState<readonly BranchAssignmentListItem[]>(error)),
    });
  }
}
