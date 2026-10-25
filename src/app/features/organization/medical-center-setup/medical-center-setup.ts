import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { SessionStore } from '../../../core/auth/session.store';
import { PracticeOnboardingClient } from '../../../core/data-access/practice-onboarding/practice-onboarding.client';
import type { CreatedOrganizationPractice } from '../../../core/data-access/practice-onboarding/practice-onboarding.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';

const MAX_NOMBRE = 200;
const MAX_DIRECCION = 500;
const MAX_CIUDAD = 255;

/**
 * Lo que la API respondió, dicho en castellano.
 *
 * Cada código tiene su causa y su salida: 403 no es 422, y el paciente de la
 * pantalla —un administrador— tiene que saber cuál es para saber qué hacer.
 */
export function mensajeDeLaConfiguracion(error: unknown): string {
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
 * es obligatorio.
 *
 * La pantalla no decide quién puede: muestra lo que la API respondió. Ocultar
 * el botón a quien no administra no sería seguridad, así que se deja intentar
 * y se explica el 403, el 422 y el 409.
 */
@Component({
  selector: 'app-medical-center-setup',
  imports: [Alert, Card, CampoPersonalizado, PageHeader, PaginatedForm, UbicacionPicker],
  templateUrl: './medical-center-setup.html',
  styleUrl: './medical-center-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCenterSetup {
  private readonly session = inject(SessionStore);
  private readonly client = inject(PracticeOnboardingClient);

  readonly form = new FormGroup({
    practiceName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NOMBRE)],
    }),
    siteName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NOMBRE)],
    }),
    addressText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_DIRECCION)],
    }),
    cityText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_CIUDAD)],
    }),
    // El punto en el mapa es obligatorio: sin él la sede no se puede ordenar
    // por cercanía. Lo escribe el selector de ubicación, no una persona.
    point: new FormControl<Coordenadas | null>(null, { validators: [Validators.required] }),
  });

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly created = signal<CreatedOrganizationPractice | null>(null);

  protected readonly pointIds: IdsDePrueba = {
    mapa: 'centro-medico-sede-map',
    confirmada: 'centro-medico-sede-location-confirmed',
    avisoGeocodificacion: 'centro-medico-sede-geocoding-notice',
    quitar: 'centro-medico-sede-location-remove',
    confirmar: 'centro-medico-sede-location-confirm',
    usarUbicacion: 'centro-medico-sede-location-use',
    marcarEnMapa: 'centro-medico-sede-location-pick',
  };

  /** Dos páginas, de a cuatro campos como tope: el centro y su primera sede. */
  protected readonly pages = paginarCampos([
    {
      titulo: 'El centro',
      hint: 'Cómo se llama el centro y su primera sede.',
      campos: [
        {
          key: 'practiceName',
          label: 'Nombre del centro médico',
          control: 'text' as const,
          required: true,
          testId: 'centro-medico-setup-practice-name',
          mensajeDeError: 'Escriba el nombre del centro médico.',
        },
        {
          key: 'siteName',
          label: 'Nombre de la sede',
          hint: 'Como la va a ver el paciente: «Sede Norte», «Casa matriz».',
          control: 'text' as const,
          required: true,
          testId: 'centro-medico-setup-site-name',
          mensajeDeError: 'Escriba el nombre de la sede.',
        },
      ],
    },
    {
      titulo: 'La sede',
      hint: 'Dónde queda: la dirección y el punto exacto en el mapa.',
      campos: [
        {
          key: 'addressText',
          label: 'Dirección',
          control: 'text' as const,
          required: true,
          autocomplete: 'street-address',
          testId: 'centro-medico-setup-address',
          mensajeDeError: 'Escriba la dirección de la sede.',
        },
        {
          key: 'cityText',
          label: 'Ciudad',
          control: 'text' as const,
          autocomplete: 'address-level2',
          testId: 'centro-medico-setup-city',
        },
        {
          key: 'point',
          label: 'Ubicación de la sede en el mapa',
          hint: 'Use su GPS o toque el plano. Sin el punto, el centro no aparece cuando alguien busca el más cercano.',
          control: 'custom' as const,
          ancho: 'completo' as const,
          required: true,
          mensajeDeError: 'Marque la sede en el mapa.',
        },
      ],
    },
  ]);

  protected setPoint(point: Coordenadas | null): void {
    this.form.controls.point.setValue(point);
    this.form.controls.point.markAsTouched();
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
          this.errorMessage.set(mensajeDeLaConfiguracion(error));
        },
      });
  }
}
