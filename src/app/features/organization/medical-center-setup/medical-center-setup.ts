import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SessionStore } from '../../../core/auth/session.store';
import { PracticeOnboardingClient } from '../../../core/data-access/practice-onboarding/practice-onboarding.client';
import type { CreatedOrganizationPractice } from '../../../core/data-access/practice-onboarding/practice-onboarding.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';

const MAX_NOMBRE = 200;
const MAX_DIRECCION = 500;
const MAX_CIUDAD = 255;

/** Lo que se escribe, todavía como texto. */
interface FormularioDelCentro {
  readonly practiceName: string;
  readonly siteName: string;
  readonly addressText: string;
  readonly cityText: string;
}

const VACIO: FormularioDelCentro = { practiceName: '', siteName: '', addressText: '', cityText: '' };

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
  imports: [Alert, AppButton, Card, FormField, Input, PageHeader, UbicacionPicker],
  templateUrl: './medical-center-setup.html',
  styleUrl: './medical-center-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCenterSetup {
  private readonly session = inject(SessionStore);
  private readonly client = inject(PracticeOnboardingClient);

  protected readonly nameMax = MAX_NOMBRE;
  protected readonly addressMax = MAX_DIRECCION;
  protected readonly cityMax = MAX_CIUDAD;

  protected readonly form = signal<FormularioDelCentro>(VACIO);
  protected readonly point = signal<Coordenadas | null>(null);
  protected readonly submitted = signal(false);
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

  protected readonly errors = computed(() => {
    const f = this.form();
    return {
      practiceName: f.practiceName.trim().length < 2 ? 'Escriba el nombre del centro médico.' : '',
      siteName: f.siteName.trim().length < 2 ? 'Escriba el nombre de la sede.' : '',
      addressText: f.addressText.trim().length < 2 ? 'Escriba la dirección de la sede.' : '',
      point: this.point() === null ? 'Marque la sede en el mapa.' : '',
    };
  });

  protected readonly valid = computed(() => Object.values(this.errors()).every((e) => e === ''));

  protected set<K extends keyof FormularioDelCentro>(field: K, value: string | number | null): void {
    this.form.update((f) => ({ ...f, [field]: String(value ?? '') }));
  }

  protected shown(field: 'practiceName' | 'siteName' | 'addressText' | 'point'): string {
    return this.submitted() ? this.errors()[field] : '';
  }

  save(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    const tenantId = this.session.activeTenantId();
    const point = this.point();
    if (!this.valid() || point === null) return;
    if (tenantId === null) {
      this.errorMessage.set('No encontramos la organización activa. Vuelva a iniciar sesión.');
      return;
    }

    const f = this.form();
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
