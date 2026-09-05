import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ClinicalClient } from '../../core/data-access/clinical/clinical.client';
import type { MedicationRequest } from '../../core/data-access/clinical/clinical.types';
import { PublicDirectoryClient } from '../../core/data-access/public-directory/public-directory.client';
import type { PublicNearbyResult } from '../../core/data-access/public-directory/public-directory.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Radio por omisión de "cerca": 15 km, como el resto de la búsqueda pública de proximidad. */
const RADIO_KM = 15;

/** Tope de resultados por pestaña: es una guía, no un listado exhaustivo. */
const LIMITE = 20;

/** Tope de recetas leídas del resumen clínico. Misma cifra que `where-to-buy`. */
const TOPE_DE_RECETAS = 50;

/** Un renglón de "mi receta", ya con su nombre resuelto. */
export interface RenglonDeReceta {
  readonly id: string;
  readonly medicamento: string;
}

/** Un resultado de "cerca mío", ya listo para la tarjeta. */
export interface LugarCercano {
  readonly slug: string;
  readonly nombre: string;
  readonly detalle: string | null;
  readonly ciudad: string | null;
  readonly distanciaKm: number;
}

function aLugarCercano(item: PublicNearbyResult): LugarCercano {
  return {
    slug: item.slug,
    nombre: item.displayName,
    detalle: item.headline,
    ciudad: item.city,
    distanciaKm: item.distanceKm,
  };
}

/**
 * **Lugares cercanos, dada mi receta** (FT-19).
 *
 * ## Farmacias: no repite el emparejamiento, lo enlaza
 *
 * "Qué farmacia tiene TODOS los medicamentos de mi receta" ya lo resuelve
 * `WhereToBuy` (`/my-account/medical-record/where-to-buy/:requestId`) —
 * cruza cada renglón contra la vitrina pública, ordena por stock completo y
 * después distancia, y hasta arma el borrador de pedido. Reimplementar ese
 * cruce acá sería la misma lógica en dos archivos que se separan en cuanto
 * alguien corrija uno. Esta pestaña lista la receta vigente y entra a esa
 * pantalla ya construida.
 *
 * ## Imagenología y centros médicos: `GET /public/nearby`
 *
 * Es el mismo buscador de proximidad que ya usa "Cómo llegar"
 * (`facility-directions-dialog`), acotado por `kind`. Dos límites reales,
 * documentados y no disimulados:
 *
 * 1. **No filtra por estudio ni por procedimiento concreto.** El backend
 *    acepta `studyCode` en otras búsquedas, pero no hay ningún dato de "qué
 *    estudio me pidieron" en el resumen clínico del paciente — a diferencia
 *    de la receta, que sí es un dato real. Inventar esa lista sería mentir
 *    sobre qué se está filtrando.
 * 2. `DIAGNOSTIC_UNIT` junta laboratorios y centros de imagenología: la
 *    búsqueda pública no separa el subtipo. Se muestra el `headline` tal
 *    cual lo publica el centro, que es el único dato honesto disponible.
 */
@Component({
  selector: 'app-nearby-places',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Alert, AppButton, Card, NgTemplateOutlet, PageHeader, RouterLink, Tab, Tabs],
  templateUrl: './nearby-places.html',
  styleUrl: './nearby-places.css',
})
export class NearbyPlaces {
  private readonly auth = inject(AuthService);
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly documento = inject(DOCUMENT);

  protected readonly pestanaActiva = signal(0);

  /* ============================================================================
      Farmacias — mi receta vigente.
      ========================================================================== */

  protected readonly receta = toSignal(
    toObservable(computed(() => ({ perfil: this.auth.patientProfileId(), pestana: this.pestanaActiva() }))).pipe(
      switchMap(({ perfil, pestana }): Observable<ViewState<readonly RenglonDeReceta[]>> => {
        if (pestana !== 0 || perfil === null) {
          return of(empty({ label: 'Elegir una pestaña' }));
        }
        return this.clinical.getSummary(perfil, TOPE_DE_RECETAS).pipe(
          switchMap((resumen) => {
            // Sólo las emitidas: es lo mismo que decide `WhereToBuy` para
            // ofrecer "las que la persona puede efectivamente ir a comprar".
            const emitidas = resumen.medicationRequests.filter(
              (fila): fila is MedicationRequest & { issuedAt: Date } => fila.issuedAt !== undefined,
            );
            if (emitidas.length === 0) {
              return of<ViewState<readonly RenglonDeReceta[]>>(
                empty(
                  { label: 'Ir a mi historia clínica', route: '/my-account/medical-record' },
                  'Todavía no tenés recetas emitidas.',
                ),
              );
            }
            return this.terminology
              .readConceptLabels(emitidas.map((fila) => fila.medicationConceptId))
              .pipe(
                map((etiquetas: ConceptLabels): ViewState<readonly RenglonDeReceta[]> =>
                  ready(
                    emitidas.map((fila) => ({
                      id: fila.id,
                      medicamento: etiquetas.get(fila.medicationConceptId)?.display ?? 'Medicamento sin registrar',
                    })),
                  ),
                ),
                catchError(() =>
                  of(
                    ready(
                      emitidas.map((fila) => ({ id: fila.id, medicamento: 'Medicamento sin registrar' })),
                    ),
                  ),
                ),
              );
          }),
          catchError((error: unknown) => of(errorToViewState<readonly RenglonDeReceta[]>(error))),
        );
      }),
    ),
    { initialValue: loading() as ViewState<readonly RenglonDeReceta[]> },
  );

  /* ============================================================================
      Imagenología y centros médicos — geolocalización compartida.
      ========================================================================== */

  protected readonly estadoDeUbicacion = signal<'pendiente' | 'localizando' | 'lista' | 'denegada'>(
    'pendiente',
  );
  private readonly ubicacion = signal<{ lat: number; lng: number } | null>(null);

  protected pedirUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      this.estadoDeUbicacion.set('denegada');
      return;
    }
    this.estadoDeUbicacion.set('localizando');
    geo.getCurrentPosition(
      (posicion) => {
        this.ubicacion.set({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
        this.estadoDeUbicacion.set('lista');
      },
      () => this.estadoDeUbicacion.set('denegada'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  private cercanosDe(kind: 'DIAGNOSTIC_UNIT' | 'ORGANIZATION', activaEn: number) {
    return toSignal(
      toObservable(
        computed(() => ({ ubicacion: this.ubicacion(), pestana: this.pestanaActiva() })),
      ).pipe(
        switchMap(({ ubicacion, pestana }): Observable<ViewState<readonly LugarCercano[]>> => {
          if (pestana !== activaEn || ubicacion === null) {
            return of(empty({ label: 'Elegir una pestaña' }));
          }
          return this.directorio
            .nearby({ lat: ubicacion.lat, lng: ubicacion.lng, radiusKm: RADIO_KM, kind, limit: LIMITE })
            .pipe(
              map((pagina): ViewState<readonly LugarCercano[]> =>
                pagina.items.length === 0
                  ? empty({ label: 'Reintentar' }, 'No encontramos ninguno dentro de 15 km.')
                  : ready(pagina.items.map(aLugarCercano)),
              ),
              catchError((error: unknown) => of(errorToViewState<readonly LugarCercano[]>(error))),
            );
        }),
      ),
      { initialValue: loading() as ViewState<readonly LugarCercano[]> },
    );
  }

  protected readonly centrosDeImagenologia = this.cercanosDe('DIAGNOSTIC_UNIT', 1);
  protected readonly centrosMedicos = this.cercanosDe('ORGANIZATION', 2);
}
