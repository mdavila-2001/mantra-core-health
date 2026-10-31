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
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { unavailableMessageOf } from '../../../../core/data-access/simulator-only';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE, organizationDetailRoute } from '../organizations.routes';
import { crearBuscadorDePersonas } from '../people-search';
import { errorMessageOf } from '../../../../shared/forms/form-support';

/** S6 del envío: la organización de la ruta no está (o no se puede ver). */
const ORGANIZACION_NO_ENCONTRADA =
  'No encontramos esta organización: puede que ya no exista. Vuelva al listado de organizaciones.';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Si ya se avisó que la búsqueda de personas no está en la API. */
  private busquedaNoDisponibleAvisada = false;

  /**
   * «Sin resultados» mentiría si la búsqueda no existe en la API (informe B,
   * §2): se dice qué falta, una sola vez y no en cada tecla.
   */
  private avisarBusquedaNoDisponible(error: unknown): void {
    const aviso = unavailableMessageOf(error);
    if (aviso === null || this.busquedaNoDisponibleAvisada) return;
    this.busquedaNoDisponibleAvisada = true;
    this.toast.warning(aviso);
  }

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

  /**
   * Cómo terminó la lectura de sedes. Antes un fallo se tragaba como «cero
   * sedes» y la pantalla decía «la organización todavía no tiene sedes»: una
   * afirmación falsa sobre el dato, con un consejo —abrir una— que duplicaba la
   * que ya existía.
   */
  protected readonly lecturaDeSedes = signal<ViewState<null>>(loading());

  protected readonly sedesFallaron = computed(() => {
    const estado = this.lecturaDeSedes().status;
    return this.esPorSede() && estado !== 'ready' && estado !== 'loading';
  });

  protected readonly mensajeDeSedes = computed(() =>
    errorMessageOf(
      this.lecturaDeSedes(),
      'No tiene permiso para ver las sedes de esta organización.',
      ORGANIZACION_NO_ENCONTRADA,
    ),
  );

  /** Sin sedes cargadas no se puede acotar a una: hay que abrir alguna antes. */
  protected readonly sinSedes = computed(
    () =>
      this.esPorSede() && this.lecturaDeSedes().status === 'ready' && this.sedes().length === 0,
  );

  /** Con alcance por sede, sin sedes que ofrecer —no hay o no se pudieron leer— no se envía. */
  protected readonly bloqueadoPorSedes = computed(
    () => this.sinSedes() || this.sedesFallaron() || (this.esPorSede() && this.lecturaDeSedes().status === 'loading'),
  );

  protected readonly sedeFaltante = computed(
    () => this.enviado() && this.esPorSede() && this.sede() === null,
  );

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /**
   * El mensaje del fallo del envío, con el criterio común (`errorMessageOf`).
   * Antes cada alta repetía su propia copia, y las cinco olvidaban el `404`:
   * el formulario quedaba mudo cuando la organización ya no existía.
   */
  protected readonly errorMessage = computed<string | null>(() =>
    errorMessageOf(
      this.state(),
      'Necesita administrar esta organización para sumar a alguien.',
      ORGANIZACION_NO_ENCONTRADA,
    ),
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
    this.lecturaDeSedes.set(loading());
    this.directory.listBranches(tenantId).subscribe({
      next: (lista) => {
        this.sedes.set(lista.items);
        this.lecturaDeSedes.set(ready(null));
      },
      // Un fallo acá no rompe el alta con alcance a toda la organización; con
      // alcance por sede, la pantalla dice qué pasó y ofrece reintentar.
      error: (error: unknown) => {
        this.sedes.set([]);
        this.lecturaDeSedes.set(errorToViewState<null>(error));
      },
    });
  }

  protected reintentarSedes(): void {
    this.cargarSedes(this.tenantId());
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
   * y se abre la ficha en la pestaña «Plantilla», donde la fila de la persona
   * tiene «Asignar sede» —la acción existe ahí, no es un consejo vacío—. Deshacerla sería peor —la persona quedaría fuera sin que nadie
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
            'En su fila de la plantilla, use «Asignar sede».',
          'Falta la sede',
        );
        void this.router.navigateByUrl(`${organizationDetailRoute(this.tenantId())}?tab=plantilla`);
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
    return !(this.esPorSede() && (this.sede() === null || this.bloqueadoPorSedes()));
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
