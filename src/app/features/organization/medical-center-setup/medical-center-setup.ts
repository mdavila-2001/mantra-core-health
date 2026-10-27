import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../core/data-access/terminology/bo-municipalities.service';
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
        return 'Solo quien administra esta organización puede configurar el centro médico.';
      case 409:
        return 'Su organización ya tiene un centro con ese nombre. Elija otro nombre.';
      case 422:
        return 'Su organización todavía no fue verificada. Podrá configurar su centro cuando la plataforma la verifique.';
    }
  }
  return 'No pudimos guardar el centro. Intente de nuevo en unos segundos.';
}

/**
 * **Configurar centro médico** (CM-11): la organización ya verificada abre su
 * práctica y su primera sede, con dirección y punto en el mapa.
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
  imports: [Alert, Card, CustomField, PageHeader, PaginatedForm, MapLocationPicker],
  templateUrl: './medical-center-setup.html',
  styleUrl: './medical-center-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCenterSetup {
  private readonly session = inject(SessionStore);
  private readonly client = inject(PracticeOnboardingClient);

  /** El catálogo de municipios, para nombrar la ciudad del punto. */
  private readonly municipalities = toSignal(
    inject(BoMunicipalitiesCatalog)
      .listar()
      .pipe(catchError(() => of([] as readonly RamaDepartamento[]))),
    { initialValue: [] as readonly RamaDepartamento[] },
  );

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

  /** Dos páginas, de a cuatro campos como tope: el centro y su primera sede. */
  protected readonly pages = paginateFields([
    {
      titulo: 'El centro',
      hint: 'Cómo se llama el centro y su primera sede.',
      campos: [
        {
          key: 'practiceName',
          label: 'Nombre del centro médico',
          control: 'text' as const,
          required: true,
          testId: 'medical-center-setup-practice-name',
          mensajeDeError: 'Escriba el nombre del centro médico.',
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
