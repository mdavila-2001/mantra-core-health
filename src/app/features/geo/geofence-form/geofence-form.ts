import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SessionStore } from '../../../core/auth/session.store';
import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { Geofence, GeofenceShapeType, NewGeofence } from '../../../core/data-access/geo/geo.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { forbidden, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, NUMBER_STRING_PATTERN, opcionDe } from '../../../shared/forms/form-support';

const FORMAS: readonly GeofenceShapeType[] = ['CIRCLE', 'POLYGON'];

/** Número positivo para el radio: el backend valida `@IsPositive`. */
const NUMERO_POSITIVO = NUMBER_STRING_PATTERN;

/**
 * Crear una geocerca (V13-07, `POST /geo/geofences`).
 *
 * La única pantalla del módulo con **forma condicional de verdad**: un círculo
 * exige radio y centro, un polígono exige su geometría GeoJSON, y mandar la
 * combinación incoherente es un 422. Cada rama valida lo suyo acá, antes de
 * gastar la petición.
 *
 * ## `tenantId` es obligatorio y NO se pide
 *
 * A diferencia del sujeto rastreado —donde el campo es opcional y se omite—,
 * acá el DTO lo exige. Es un campo de propiedad: tiene que coincidir con el
 * `X-Tenant-Id` de la petición o el backend responde 403. Se toma del tenant
 * activo de la sesión, que es el mismo que el interceptor pone en la cabecera:
 * pedírselo a la persona sería ofrecerle un campo cuyo único valor válido ya
 * se conoce. Sin tenant activo, la pantalla lo dice con S5 en vez de dejar
 * armar un cuerpo condenado.
 */
@Component({
  selector: 'app-geofence-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    Textarea,
  ],
  templateUrl: './geofence-form.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeofenceForm {
  private readonly client = inject(GeoClient);
  private readonly navigation = inject(NavigationService);
  private readonly session = inject(SessionStore);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)],
    }),
    radiusM: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMERO_POSITIVO)],
    }),
    centerLat: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    centerLng: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
  });

  protected readonly shapeType = signal<GeofenceShapeType | null>(null);
  protected readonly geometryJson = signal('');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<Geofence | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para crear geocercas.'),
  );

  protected readonly esCirculo = computed(() => this.shapeType() === 'CIRCLE');
  protected readonly esPoligono = computed(() => this.shapeType() === 'POLYGON');

  /** GeoJSON: un objeto, no un array ni un texto. */
  protected readonly geometriaInvalida = computed(() => {
    const texto = this.geometryJson().trim();
    if (texto === '') {
      return false;
    }
    try {
      const valor: unknown = JSON.parse(texto);
      return typeof valor !== 'object' || valor === null || Array.isArray(valor);
    } catch {
      return true;
    }
  });

  protected elegirForma(valor: unknown): void {
    this.shapeType.set(opcionDe(FORMAS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const cuerpo = this.cuerpoValido();
    if (cuerpo === null) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.createGeofence(cuerpo).subscribe({
      next: (geocerca) => {
        this.state.set(ready(null));
        this.created.set(geocerca);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraGeocerca(): void {
    this.form.reset();
    this.shapeType.set(null);
    this.geometryJson.set('');
    this.created.set(null);
    this.state.set(ready(null));
  }

  private cuerpoValido(): NewGeofence | null {
    const forma = this.shapeType();
    const tenantId = this.session.activeTenantId();

    if (this.form.invalid || forma === null) {
      return null;
    }
    if (tenantId === null) {
      // Sin organización activa el cuerpo nace condenado al 403: se dice acá.
      this.state.set(
        forbidden({
          message: 'Elegí una organización antes de crear geocercas.',
          nextAction: { label: 'Elegir organización', route: '/auth/organization' },
        }),
      );
      return null;
    }

    const valores = this.form.getRawValue();

    if (forma === 'CIRCLE') {
      const radio = valores.radiusM.trim();
      const lat = valores.centerLat.trim();
      const lng = valores.centerLng.trim();
      if (radio === '' || lat === '' || lng === '') {
        return null;
      }
      return {
        tenantId,
        name: valores.name.trim(),
        shapeType: 'CIRCLE',
        radiusM: Number(radio),
        centerLat: Number(lat),
        centerLng: Number(lng),
      };
    }

    const geometria = this.geometryJson().trim();
    if (geometria === '' || this.geometriaInvalida()) {
      return null;
    }
    return {
      tenantId,
      name: valores.name.trim(),
      shapeType: 'POLYGON',
      geometryJson: JSON.parse(geometria) as Record<string, unknown>,
    };
  }
}
