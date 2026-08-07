import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnPatientSummary } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Resumen propio — vista **V05-03** de `SALUD/Vistas/V05 profiles`
 * (`GET /profiles/patients/me/summary`).
 *
 * ## Autoservicio de verdad
 *
 * El sujeto lo resuelve el backend desde la sesión: no hay identificador que
 * pasar y no hay forma de pedir el resumen de otra persona. Por eso esta
 * pantalla no tiene parámetro de ruta ni buscador — no le faltan, no van.
 *
 * ## El 403 acá es una puerta, no un muro
 *
 * El endpoint exige identidad verificada vigente. Sin ella responde `403` con
 * `IDENTITY_VERIFICATION_REQUIRED`, y `errorToViewState` ya lo traduce a un S5
 * **con acción**: el host de estados pinta el enlace a la pantalla de
 * verificación. Esta pantalla no escribe ni una línea sobre ese caso, y esa es
 * exactamente la prueba de que la traducción de errores está en el lugar
 * correcto — la ficha del vault lo pide con estas palabras: «la vista debe
 * ofrecer el camino para verificarse, no un error seco».
 */
@Component({
  selector: 'app-my-profile',
  imports: [Card, DatePipe, PageHeader, ViewStateHost],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProfile {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly resumen = signal<ViewState<OwnPatientSummary>>(loading());

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly datos = computed(() => dataOf(this.resumen()));

  /**
   * El estado de la persona, en palabras.
   *
   * Llega como `*ConceptId` en uuid y se traduce con el catálogo. Si el
   * catálogo no responde se muestra el texto de ausencia, nunca el uuid: para
   * quien mira su propia cuenta, un identificador interno no es información,
   * es ruido.
   */
  protected readonly estado = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return '';
    }
    return this.etiquetas().get(datos.personStatus)?.display ?? 'Sin determinar';
  });

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.resumen.set(loading());
    this.etiquetas.set(new Map());

    this.profiles
      .getOwnSummary()
      .pipe(
        switchMap((resumen) =>
          forkJoin({
            resumen: of(resumen),
            // El fallo del catálogo degrada un campo; no puede tumbar la
            // pantalla que muestra los datos propios de alguien.
            etiquetas: this.terminology
              .readConceptLabels([resumen.personStatus])
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ resumen, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.resumen.set(ready(resumen));
        },
        error: (error: unknown) => this.resumen.set(errorToViewState<OwnPatientSummary>(error)),
      });
  }
}
