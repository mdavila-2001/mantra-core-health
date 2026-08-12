import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { GeoClient } from '../../../core/data-access/geo/geo.client';
import type { LastPosition as UltimaPosicion } from '../../../core/data-access/geo/geo.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Input } from '../../../shared/components/atoms/input/input';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const BASE = '/administration/geolocation';

/** A dónde se manda a quien no encontró nada: registrar posiciones. */
const RUTA_PINGS = `${BASE}/subjects/pings`;

/**
 * V13-02 · La última posición conocida de un sujeto rastreado.
 *
 * `GET /geo/tracked-subjects/:id/last-position` — la única lectura del módulo.
 *
 * ## El sujeto viaja en la ruta, y por `paramMap`
 *
 * No por `snapshot`: si el router reutiliza el componente para otro sujeto —que
 * es lo que pasa al consultar uno nuevo desde el propio formulario— con el
 * snapshot se seguiría viendo el anterior. El formulario navega, y la carga la
 * dispara el cambio de parámetro.
 *
 * ## El 404 tiene dos causas y se muestran igual
 *
 * El backend responde `NOT_FOUND` tanto si el sujeto no existe como si existe y
 * todavía no tiene posiciones. Distinguirlos leyendo el mensaje sería revelar
 * que el identificador es real, que es justamente lo que el estado S6 del M34
 * existe para evitar. Se muestra un solo estado, con la salida que sirve en los
 * dos casos: ir a registrar pings.
 *
 * ## Las coordenadas no se convierten
 *
 * Llegan como texto desde `numeric` de Postgres y se muestran tal cual. Pasarlas
 * por `Number` perdería decimales y los ceros significativos que el backend sí
 * emite. Ver `geo.types.ts`.
 */
@Component({
  selector: 'app-last-position',
  imports: [
    Card,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    ReactiveFormsModule,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './last-position.html',
  styleUrl: '../m13.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LastPosition {
  private readonly geo = inject(GeoClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    trackedSubjectId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<UltimaPosicion>>(estadoInicial());

  protected readonly posicion = computed(() => dataOf(this.state()));

  private trackedSubjectId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.trackedSubjectId = params.get('trackedSubjectId');
      this.form.controls.trackedSubjectId.setValue(this.trackedSubjectId ?? '');
      this.cargar();
    });
  }

  /** Navegar y no pedir acá: la ruta es la que manda, y así el enlace es compartible. */
  protected consultar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    void this.router.navigate([
      BASE,
      'subjects',
      'last-position',
      this.form.controls.trackedSubjectId.value.trim(),
    ]);
  }

  protected cargar(): void {
    const id = this.trackedSubjectId;
    if (id === null || id === '') {
      this.state.set(estadoInicial());
      return;
    }

    this.state.set(loading());
    this.geo.lastPosition(id).subscribe({
      next: (posicion) => this.state.set(ready(posicion)),
      error: (error: unknown) => this.state.set(this.conSalida(error)),
    });
  }

  /**
   * Un S6 sin salida es un callejón. El backend no da ninguna pista de cuál de
   * las dos causas fue —y hace bien—, así que la salida que se ofrece es la que
   * sirve para ambas.
   */
  private conSalida(error: unknown): ViewState<UltimaPosicion> {
    const estado = errorToViewState<UltimaPosicion>(error);
    return estado.status === 'not-found'
      ? notFound({ label: 'Registrar posiciones', route: RUTA_PINGS })
      : estado;
  }
}

/**
 * S3 con acción, no S2: sin identificador no hay nada pidiéndose, y un esqueleto
 * insinuaría que sí.
 */
function estadoInicial(): ViewState<UltimaPosicion> {
  return empty(
    { label: 'Dar de alta un sujeto', route: `${BASE}/subjects/new` },
    'El módulo no expone un listado de sujetos: pegá el identificador para ver su última posición.',
  );
}
