import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../core/data-access/terminology/bo-municipalities.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { isVisibleTo } from '../../../core/navigation/navigation.types';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PracticeOnboardingClient } from '../../../core/data-access/practice-onboarding/practice-onboarding.client';
import type { CreatedOrganizationPractice } from '../../../core/data-access/practice-onboarding/practice-onboarding.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import {
  MapLocationPicker,
  type Coordinates,
  type LocalityFromPoint,
} from '../../auth/shared-registration/map-location-picker/map-location-picker';
import {
  addressFromPoint,
  municipalityName,
  pointLabel,
} from '../../auth/shared-registration/address-from-point';

const MAX_NAME = 200;
const MAX_ADDRESS = 500;
const MAX_CIUDAD = 255;

/**
 * Lo que la API respondió, dicho en castellano.
 *
 * Cada código tiene su causa y su salida: 403 no es 422, y el paciente de la
 * pantalla —un administrador— tiene que saber cuál es para saber qué hacer.
 */
export function setupErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 0:
        return 'No pudimos conectarnos. Revise su conexión e intente de nuevo.';
      case 400:
        return 'Revise los datos: alguno no es válido.';
      case 403:
        return 'Solo quien administra esta organización puede configurarla.';
      case 409:
        return 'Su organización ya usa ese nombre. Elija otro nombre.';
      case 422:
        return 'Su organización todavía no fue verificada. Podrá configurarla cuando la plataforma la verifique.';
    }
  }
  return 'No pudimos guardar la configuración. Intente de nuevo en unos segundos.';
}

/** Adónde lleva el estado «todavía no verificada»: la ficha de la propia organización. */
export const RUTA_MI_ORGANIZACION = '/administration/my-organization';

/** La salida cuando esa ficha no es para esta sesión (un médico que administra su consultorio). */
export const RUTA_PANEL = '/dashboard';

/**
 * **Configurar su organización** (CM-11): la organización médica ya verificada
 * abre su práctica y su primera sede, con dirección y punto en el mapa.
 *
 * El nombre es neutro a propósito: la ven un hospital, una clínica, un
 * consultorio, un centro de enfermería y «otra institución de salud», y
 * «centro médico» sólo le cabe a algunos.
 *
 * ## Antes del formulario, si ya está verificada
 *
 * `GET /tenants/me` trae `isVerified` de cada organización del actor —lo
 * resuelve la API, no se decodifica un concepto acá—. Si la organización activa
 * todavía no fue verificada, la pantalla lo dice al entrar (S3, con la ficha de
 * la organización como próxima acción) en vez de dejar completar dos páginas
 * para recibir el 422 al final. Si la organización activa no figura en esa
 * lista —la plataforma mirando otra—, se muestra el formulario: el dato no
 * alcanza para afirmar nada, y la API sigue decidiendo.
 *
 * Sin la sede no hay dónde colgar el catálogo de procedimientos ni un punto
 * desde el cual ordenar la búsqueda por cercanía, por eso el punto en el mapa
 * es obligatorio. Y es lo único de la ubicación que se marca (pedido del
 * cliente del 26/10/2026): la dirección y la ciudad se deducen del punto y el
 * selector las muestra sin dejarlas editar.
 *
 * La pantalla no decide quién puede: muestra lo que la API respondió. Ocultar
 * el botón a quien no administra no sería seguridad, así que se deja intentar
 * y se explica el 403, el 422 y el 409.
 */
@Component({
  selector: 'app-medical-center-setup',
  imports: [
    Alert,
    Card,
    CustomField,
    EmptyState,
    Link,
    MapLocationPicker,
    NavIcon,
    PageHeader,
    PaginatedForm,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './medical-center-setup.html',
  styleUrl: './medical-center-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCenterSetup {
  private readonly session = inject(SessionStore);
  private readonly client = inject(PracticeOnboardingClient);
  private readonly directory = inject(DirectoryClient);

  /** El catálogo de municipios, para nombrar la ciudad del punto. */
  private readonly municipalities = toSignal(
    inject(BoMunicipalitiesCatalog)
      .listar()
      .pipe(catchError(() => of([] as readonly RamaDepartamento[]))),
    { initialValue: [] as readonly RamaDepartamento[] },
  );

  /**
   * Si la organización activa puede configurarse: `ready` muestra el
   * formulario y `empty` (S3) dice que falta la verificación. Ver la nota de la
   * clase.
   */
  protected readonly estado = signal<ViewState<true>>(loading());

  /**
   * La próxima acción del S3: la ficha de la organización **si esta sesión la
   * puede abrir**. «Mi organización» lleva `hiddenFor: ['PATIENT',
   * 'PRACTITIONER']` y su guard rebota: un médico que administra su
   * consultorio entraría acá y su única salida lo devolvería. Para él, el panel.
   */
  protected readonly proximaAccion = computed(() => {
    const ficha = APP_SECTIONS.find((s) => `/${s.path}` === RUTA_MI_ORGANIZACION);
    const alcanzable =
      ficha !== undefined &&
      isVisibleTo(ficha, this.session.roles(), this.session.tenants(), this.session.activeTenantType());
    return alcanzable
      ? { label: 'Ver los datos de su organización', route: RUTA_MI_ORGANIZACION }
      : { label: 'Volver al panel', route: RUTA_PANEL };
  });

  readonly form = new FormGroup({
    practiceName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NAME)],
    }),
    siteName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NAME)],
    }),
    // Dirección y ciudad no se escriben: las llena `writeLocality` con lo
    // deducido del punto. La dirección sigue obligatoria porque la API la
    // exige, y nunca queda vacía con un punto puesto (ver `setPoint`).
    addressText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_ADDRESS)],
    }),
    cityText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_CIUDAD)],
    }),
    // El punto en el mapa es obligatorio: sin él la sede no se puede ordenar
    // por cercanía. Lo escribe el selector de ubicación, no una persona.
    point: new FormControl<Coordinates | null>(null, { validators: [Validators.required] }),
  });

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly created = signal<CreatedOrganizationPractice | null>(null);

  protected readonly pointIds = {
    mapa: 'medical-center-site-map',
    confirmada: 'medical-center-site-location-confirmed',
    avisoGeocodificacion: 'medical-center-site-geocoding-notice',
    quitar: 'medical-center-site-location-remove',
    confirmar: 'medical-center-site-location-confirm',
    usarUbicacion: 'medical-center-site-location-use',
    marcarEnMapa: 'medical-center-site-location-pick',
  };

  /** Dos páginas, de a cuatro campos como tope: la organización y su primera sede. */
  protected readonly pages = paginateFields([
    {
      titulo: 'Su organización',
      hint: 'Cómo la van a encontrar los pacientes y cómo se llama su primera sede.',
      campos: [
        {
          key: 'practiceName',
          label: 'Nombre de la organización',
          hint: 'El nombre con el que atiende, como lo va a ver el paciente.',
          control: 'text' as const,
          required: true,
          testId: 'medical-center-setup-practice-name',
          mensajeDeError: 'Escriba el nombre de la organización.',
        },
        {
          key: 'siteName',
          label: 'Nombre de la sede',
          hint: 'Como la va a ver el paciente: «Sede Norte», «Casa matriz».',
          control: 'text' as const,
          required: true,
          testId: 'medical-center-setup-site-name',
          mensajeDeError: 'Escriba el nombre de la sede.',
        },
      ],
    },
    {
      titulo: 'La sede',
      hint: 'Dónde queda: marque el punto exacto en el mapa; la dirección sale de ahí.',
      campos: [
        {
          key: 'point',
          label: 'Ubicación de la sede en el mapa',
          hint: 'Use su GPS o toque el plano. De ese punto sacamos la dirección, el municipio y la zona.',
          control: 'custom' as const,
          ancho: 'completo' as const,
          required: true,
          mensajeDeError: 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
        },
      ],
    },
  ]);

  constructor() {
    this.cargarVerificacion();
  }

  /** Lee si la organización activa ya fue verificada. También es el «Reintentar» del S9. */
  protected cargarVerificacion(): void {
    const tenantId = this.session.activeTenantId();
    if (tenantId === null) {
      // Sin organización activa no hay nada que preguntar: `save()` ya lo dice.
      this.estado.set(ready(true));
      return;
    }
    this.estado.set(loading());
    this.directory.listMyOrganizations().subscribe({
      next: (organizaciones) => {
        const activa = organizaciones.find((organizacion) => organizacion.id === tenantId);
        this.estado.set(
          activa !== undefined && !activa.isVerified
            ? empty(
                this.proximaAccion(),
                'Podrá abrir su práctica y su primera sede cuando la plataforma la verifique.',
              )
            : ready(true),
        );
      },
      error: (error: unknown) => this.estado.set(errorToViewState<true>(error)),
    });
  }

  protected setPoint(point: Coordinates | null): void {
    this.form.controls.point.setValue(point);
    this.form.controls.point.markAsTouched();
    // Con punto, la dirección nunca queda vacía: es un obligatorio que no se ve.
    const address = this.form.controls.addressText;
    if (point !== null && address.value.trim() === '') address.setValue(pointLabel(point));
  }

  /**
   * Lo deducido del punto llena la dirección y la ciudad, que ya no se
   * escriben. Sin punto no se toca nada: el punto obligatorio, que sí se ve,
   * es el que frena.
   */
  protected writeLocality(locality: LocalityFromPoint | null): void {
    if (locality === null) return;
    const city = municipalityName(this.municipalities(), locality.municipioConceptId);
    this.form.controls.addressText.setValue(addressFromPoint(locality, city, MAX_ADDRESS));
    this.form.controls.cityText.setValue((city ?? '').slice(0, MAX_CIUDAD));
  }

  save(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const tenantId = this.session.activeTenantId();
    if (tenantId === null) {
      this.errorMessage.set('No encontramos la organización activa. Vuelva a iniciar sesión.');
      return;
    }

    const f = this.form.getRawValue();
    const point = f.point!;
    const city = f.cityText.trim();
    this.saving.set(true);
    this.errorMessage.set(null);
    this.client
      .createPractice(tenantId, {
        name: f.practiceName.trim(),
        site: {
          name: f.siteName.trim(),
          addressText: f.addressText.trim(),
          latitude: point.lat,
          longitude: point.lng,
          ...(city === '' ? {} : { cityText: city }),
        },
      })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.created.set(created);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(setupErrorMessage(error));
        },
      });
  }
}
