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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  AccessScopeCode,
  BranchListItem,
  NewMembership,
  TenantRoleCode,
} from '../../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { errorMessageOf } from '../../../../shared/forms/form-support';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Link } from '../../../../shared/components/atoms/link/link';
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
import {
  branchNewRoute,
  ORGANIZATIONS_ROUTE,
  organizationDetailRoute,
} from '../organizations.routes';
import { crearBuscadorDePersonas } from '../people-search';

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
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Link,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    Select,
  ],
  templateUrl: './membership-new.html',
  styleUrl: './membership-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipNew {
  private readonly directory = inject(DirectoryClient);
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
  /** La búsqueda de persona: errores distintos del vacío y la última tecla manda. */
  protected readonly personas = crearBuscadorDePersonas(CANDIDATOS_POR_BUSQUEDA);

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

  /** La lectura de las sedes terminó bien (aunque no haya ninguna). */
  private readonly sedesLeidas = signal(false);

  /**
   * Por qué no se pudieron leer las sedes, si falló. **No es «no hay sedes»**:
   * antes el fallo se tragaba, la lista quedaba vacía y la pantalla afirmaba que
   * la organización no tenía sedes cuando lo que había fallado era la lectura.
   */
  protected readonly errorDeSedes = signal<string | null>(null);

  /** A dónde lleva «Abrir una sucursal», que es lo que el aviso de sin-sedes pide hacer. */
  protected readonly rutaDeNuevaSucursal = computed(() => branchNewRoute(this.tenantId()));

  /**
   * La membresía que ya existe pero quedó sin su sede.
   *
   * Es lo que vuelve ejecutable el aviso de «falta la sede»: antes decía
   * «complete la asignación desde la ficha de la organización», y la ficha no
   * tiene ninguna pantalla para asignar la sede de una membresía. Ahora la
   * pantalla se queda y ofrece repetir **sólo** ese paso, sin volver a crear a
   * la persona (que duplicaría la membresía).
   */
  protected readonly membresiaSinSede = signal<string | null>(null);

  /** Sin sedes cargadas no se puede acotar a una: hay que abrir alguna antes. */
  protected readonly sinSedes = computed(
    () => this.esPorSede() && this.sedesLeidas() && this.sedes().length === 0,
  );

  protected readonly sedeFaltante = computed(
    () => this.enviado() && this.esPorSede() && this.sede() === null,
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /**
   * Por qué falló el envío, con el texto común del producto (`errorMessageOf`):
   * incluye el 404 —antes un formulario de una organización que ya no existe
   * no mostraba **nada** al enviar— y el código de la petición en S9.
   */
  protected readonly errorMessage = computed<string | null>(
    () => errorMessageOf(this.state(), 'Necesita administrar esta organización para sumar a alguien.'),
  );

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
    this.errorDeSedes.set(null);
    this.directory.listBranches(tenantId).subscribe({
      next: (lista) => {
        this.sedes.set(lista.items);
        this.sedesLeidas.set(true);
      },
      error: (error: unknown) => {
        this.sedes.set([]);
        // El alta sigue posible con alcance sobre toda la organización; lo que
        // no se puede es afirmar que no hay sedes ni acotar a una.
        this.errorDeSedes.set(
          errorMessageOf(
            errorToViewState<null>(error),
            'No tiene permiso para ver las sedes de esta organización.',
          ) ?? 'No pudimos leer las sedes de la organización.',
        );
      },
    });
  }

  /** Reintento de la lectura de sedes. */
  protected recargarSedes(): void {
    const id = this.tenantId();
    if (id !== '') {
      this.cargarSedes(id);
    }
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

    // La persona ya está dentro: repetir el alta la duplicaría. Sólo se repite
    // el paso que falló.
    const pendiente = this.membresiaSinSede();
    if (pendiente !== null) {
      this.state.set(loading());
      this.asignarSedeSiHaceFalta(pendiente);
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
   * Si la asignación falla, la membresía ya existe y no se deshace: la pantalla
   * se queda, dice qué falta y ofrece repetir **sólo** esa asignación
   * (`membresiaSinSede`). Deshacerla sería peor —la persona quedaría fuera sin
   * que nadie lo pidiera—.
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
      error: (error: unknown) => {
        // La membresía existe: no es un fracaso del alta, y la pantalla no queda
        // en error. Se recuerda cuál es y se ofrece repetir sólo la asignación.
        this.membresiaSinSede.set(membershipId);
        this.errorDeAsignacion.set(
          errorMessageOf(errorToViewState<null>(error), 'No tiene permiso para asignar la sede.') ??
            null,
        );
        this.state.set(ready(null));
      },
    });
  }

  /** Por qué falló la última asignación de sede, para mostrarlo junto al aviso. */
  protected readonly errorDeAsignacion = signal<string | null>(null);

  private terminar(): void {
    this.state.set(ready(null));
    this.membresiaSinSede.set(null);
    const nombre = this.persona()?.label ?? 'La persona';
    this.toast.success(`${nombre} ya forma parte de la organización.`, 'Alguien más adentro');
    void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
  }

  /** A dónde lleva «Ir a la organización». */
  protected readonly rutaDeLaFicha = computed(() => organizationDetailRoute(this.tenantId()));

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
