import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  AccessScopeCode,
  BranchListItem,
  NewMembership,
  TenantRoleCode,
} from '../../../../core/data-access/directory/directory.types';
import { IamClient } from '../../../../core/data-access/iam/iam.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE, organizationDetailRoute } from '../organizations.routes';

/** Cuántos candidatos trae cada búsqueda del combobox de persona. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/** Etiquetas visibles de los roles del contrato. */
const ETIQUETAS_DE_ROL: Readonly<Record<TenantRoleCode, string>> = {
  OWNER: 'Dueño',
  ADMIN: 'Administración',
  STAFF: 'Equipo',
};

/** Etiquetas visibles de los alcances del contrato. */
const ETIQUETAS_DE_ALCANCE: Readonly<Record<AccessScopeCode, string>> = {
  ALL_TENANT: 'Toda la organización',
  BRANCH: 'Sólo una sede',
};

/**
 * Incorporación de alguien a la organización — vista **V04-02·F**
 * (`POST /tenants/{id}/memberships`, UC-04-05).
 *
 * ## Es lo que hace que el token de esa persona lleve la organización
 *
 * Sin membresía, quien inicia sesión no lleva `X-Tenant-Id` para esta
 * organización y no puede trabajar dentro de ella por más rol global que tenga:
 * sólo quien la creó ve algo. Por eso el recorrido de puesta en marcha no da la
 * organización por operable hasta que hay alguien más que su dueño.
 *
 * ## La persona se elige, nunca se tipea
 *
 * La membresía ata una cuenta que ya existe; no la crea. El buscador es el
 * mismo patrón del owner en el alta de organización, con el mismo aviso: elegir
 * a alguien que nunca verificó su correo es un error que conviene ver antes de
 * guardar, no después.
 *
 * ## El alcance por sede se completa en el mismo acto
 *
 * Declarar alcance `BRANCH` sin asignar ninguna sucursal deja a esa persona sin
 * nada a la vista: el alcance dice «sólo una sede» y no hay ninguna. Son dos
 * operaciones del contrato (`memberships` y `branch-assignments`), pero una
 * sola decisión de quien las usa, así que la pantalla encadena la segunda.
 */
@Component({
  selector: 'app-membership-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    FormActions,
    FormField,
    FormSection,
    PageHeader,
    ReferenceCombobox,
    Select,
  ],
  templateUrl: './membership-new.html',
  styleUrl: './membership-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipNew {
  private readonly directory = inject(DirectoryClient);
  private readonly iam = inject(IamClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /**
   * La organización a la que se suma la persona, del segmento `:tenantId`.
   *
   * Del `paramMap` y no con `input()`: el router no declara
   * `withComponentInputBinding()`. Mismo mecanismo que la ficha.
   */
  protected readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tenantId') ?? '')),
    { initialValue: '' },
  );

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Organizaciones', routerLink: ORGANIZATIONS_ROUTE },
    { label: 'Organización', routerLink: organizationDetailRoute(this.tenantId()) },
    { label: 'Sumar a alguien' },
  ]);

  /* ---- la persona: se elige, nunca se tipea ------------------------------ */

  protected readonly persona = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);

  /** Marca que el envío ya se intentó, para mostrar los faltantes no tocados. */
  private readonly enviado = signal(false);

  protected readonly personaFaltante = computed(() => this.enviado() && this.persona() === null);

  protected readonly rol = signal<TenantRoleCode>('STAFF');
  protected readonly alcance = signal<AccessScopeCode>('ALL_TENANT');
  protected readonly sede = signal<string | null>(null);

  protected readonly opcionesDeRol: readonly SelectOption<TenantRoleCode>[] = (
    Object.keys(ETIQUETAS_DE_ROL) as TenantRoleCode[]
  ).map((code) => ({ value: code, label: ETIQUETAS_DE_ROL[code] }));

  protected readonly opcionesDeAlcance: readonly SelectOption<AccessScopeCode>[] = (
    Object.keys(ETIQUETAS_DE_ALCANCE) as AccessScopeCode[]
  ).map((code) => ({ value: code, label: ETIQUETAS_DE_ALCANCE[code] }));

  /** Las sedes de la organización, para el alcance por sucursal. */
  protected readonly sedes = signal<readonly BranchListItem[]>([]);

  protected readonly opcionesDeSede = computed<readonly SelectOption<string>[]>(() =>
    this.sedes().map((sucursal) => ({ value: sucursal.id, label: sucursal.name })),
  );

  protected readonly esPorSede = computed(() => this.alcance() === 'BRANCH');

  /** Sin sedes cargadas no se puede acotar a una: hay que abrir alguna antes. */
  protected readonly sinSedes = computed(() => this.esPorSede() && this.sedes().length === 0);

  protected readonly sedeFaltante = computed(
    () => this.enviado() && this.esPorSede() && this.sede() === null,
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message || 'Necesitás administrar esta organización para sumar a alguien.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    // Las sedes alimentan el desplegable del alcance por sucursal, y saber si
    // hay alguna cambia lo que la pantalla puede ofrecer. Van por `effect` y no
    // en línea porque el id llega del `paramMap`: al construir todavía es
    // vacío.
    effect(() => {
      const id = this.tenantId();
      if (id === '') {
        return;
      }
      untracked(() => this.cargarSedes(id));
    });
  }

  /**
   * Trae las sedes de la organización.
   *
   * @param tenantId - La organización cuyas sedes se listan.
   */
  private cargarSedes(tenantId: string): void {
    this.directory.listBranches(tenantId).subscribe({
      next: (lista) => this.sedes.set(lista.items),
      // Un fallo acá no rompe el alta: deja el alcance por sede sin opciones y
      // la pantalla lo dice. El error general se reserva para el envío.
      error: () => this.sedes.set([]),
    });
  }

  /**
   * Busca personas y las traduce a opciones. El `hint` distingue una cuenta sin
   * verificar, igual que en el alta de organización.
   */
  protected buscarPersona(texto: string): void {
    if (texto === '') {
      this.candidatos.set([]);
      return;
    }

    this.buscando.set(true);
    this.iam.searchUsers({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.candidatos.set(
          pagina.items.map((usuario) => ({
            value: usuario.id,
            label: usuario.displayName,
            ...(usuario.emailVerified ? {} : { hint: 'Correo sin verificar' }),
          })),
        );
        this.buscando.set(false);
      },
      error: () => {
        this.candidatos.set([]);
        this.buscando.set(false);
      },
    });
  }

  protected cambiarRol(rol: TenantRoleCode | null): void {
    this.rol.set(rol ?? 'STAFF');
  }

  protected cambiarAlcance(alcance: AccessScopeCode | null): void {
    this.alcance.set(alcance ?? 'ALL_TENANT');
  }

  protected cambiarSede(sede: string | null): void {
    this.sede.set(sede);
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    this.enviado.set(true);

    if (!this.puedeEnviar()) {
      return;
    }

    this.state.set(loading());

    this.directory.createMembership(this.tenantId(), this.datos()).subscribe({
      next: (membresia) => this.asignarSedeSiHaceFalta(membresia.id),
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Cierra el alta, encadenando la asignación de sede cuando el alcance la
   * exige.
   *
   * Si la asignación falla, la membresía ya existe y no se deshace: se avisa
   * para que alguien la complete desde la ficha, en vez de dejar creer que no
   * pasó nada. Deshacerla sería peor —la persona quedaría fuera sin que nadie
   * lo pidiera—.
   *
   * @param membershipId - La membresía recién creada.
   */
  private asignarSedeSiHaceFalta(membershipId: string): void {
    const sede = this.sede();
    if (!this.esPorSede() || sede === null) {
      this.terminar();
      return;
    }

    this.directory.assignBranch(this.tenantId(), membershipId, { branchId: sede }).subscribe({
      next: () => this.terminar(),
      error: () => {
        this.state.set(ready(null));
        this.toast.warning(
          'La persona quedó incorporada, pero no pudimos asignarle la sede. ' +
            'Completá la asignación desde la ficha de la organización.',
          'Falta la sede',
        );
        void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
      },
    });
  }

  private terminar(): void {
    this.state.set(ready(null));
    const nombre = this.persona()?.label ?? 'La persona';
    this.toast.success(`${nombre} ya forma parte de la organización.`, 'Alguien más adentro');
    void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
  }

  private puedeEnviar(): boolean {
    if (this.persona() === null) {
      return false;
    }
    return !(this.esPorSede() && this.sede() === null);
  }

  /** El cuerpo de la petición; la sede sólo viaja si el alcance la usa. */
  private datos(): NewMembership {
    const persona = this.persona();
    const sede = this.sede();

    return {
      // `puedeEnviar` ya garantizó la persona; el `?? ''` sólo le consta al
      // compilador.
      userId: persona?.value ?? '',
      role: this.rol(),
      accessScope: this.alcance(),
      ...(this.esPorSede() && sede !== null ? { primaryBranchId: sede } : {}),
    };
  }
}
