import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { SessionStore } from '../../../core/auth/session.store';
import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { Geofence, GeofenceShapeType, NewGeofence } from '../../../core/data-access/geo/geo.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { forbidden, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, objetoJson, NUMBER_STRING_PATTERN, opcionDe } from '../../../shared/forms/form-support';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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
    shapeType: new FormControl<GeofenceShapeType | null>(null, {
      validators: [Validators.required],
    }),
    /** GeoJSON: un objeto, no un array ni un texto. */
    geometryJson: new FormControl('', { nonNullable: true, validators: [objetoJson] }),
  });

  /** El valor de la forma, como señal, para que las páginas reaccionen a él. */
  private readonly forma = toSignal(this.form.controls.shapeType.valueChanges, {
    initialValue: this.form.controls.shapeType.value,
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<Geofence | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para crear geocercas.'),
  );

  /**
   * Las páginas, que **dependen de la primera respuesta**.
   *
   * Un círculo pide radio y centro; un polígono pide una geometría. Preguntar
   * las dos cosas a la vez es pedir cinco datos de los que sobran tres, así que
   * la segunda página se arma con lo que la forma elegida necesita — y mientras
   * no haya forma elegida, no hay segunda página que mostrar.
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'Identidad',
        hint: 'El nombre es único dentro de la organización: el duplicado se rechaza.',
        campos: [
          {
            key: 'name',
            label: 'Nombre',
            control: 'text' as const,
            required: true,
            mensajeDeError: 'Escribí el nombre de la geocerca (máx. 200 caracteres).',
          },
          {
            key: 'shapeType',
            label: 'Forma',
            control: 'radio' as const,
            required: true,
            options: [
              { value: 'CIRCLE', label: 'Círculo: un centro y un radio' },
              { value: 'POLYGON', label: 'Polígono: una geometría GeoJSON' },
            ],
          },
        ],
      },
      ...(this.forma() === 'CIRCLE'
        ? [
            {
              titulo: 'El círculo',
              hint: 'Radio en metros y centro en grados decimales. Los tres son obligatorios.',
              campos: [
                {
                  key: 'radiusM',
                  label: 'Radio (metros)',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Ingresá el radio en metros, como 500.',
                },
                {
                  key: 'centerLat',
                  label: 'Latitud del centro',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Ingresá la latitud en grados decimales, como -34.603765.',
                },
                {
                  key: 'centerLng',
                  label: 'Longitud del centro',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Ingresá la longitud en grados decimales, como -58.381592.',
                },
              ],
            },
          ]
        : []),
      ...(this.forma() === 'POLYGON'
        ? [
            {
              titulo: 'El polígono',
              hint: 'La geometría GeoJSON del área, como la produce cualquier editor de mapas.',
              campos: [
                {
                  key: 'geometryJson',
                  label: 'Geometría (GeoJSON)',
                  hint: 'Un objeto como {"type": "Polygon", "coordinates": [...]}.',
                  control: 'textarea' as const,
                  required: true,
                  mensajeDeError: 'Tiene que ser un objeto JSON válido.',
                },
              ],
            },
          ]
        : []),
    ]),
  );

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
    this.created.set(null);
    this.state.set(ready(null));
  }

  private cuerpoValido(): NewGeofence | null {
    const forma = opcionDe(FORMAS, this.form.getRawValue().shapeType);
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

    const geometria = valores.geometryJson.trim();
    if (geometria === '') {
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
