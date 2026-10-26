import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { map, of, switchMap } from 'rxjs';

import { ProcedureCentersClient } from '../../../../../core/data-access/procedure-centers/procedure-centers.client';
import type {
  ProcedureCenter,
  ProcedureCentersResult,
} from '../../../../../core/data-access/procedure-centers/procedure-centers.types';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import type { ReferencePoint } from '../where-to-buy.route';
import { directionsUrl } from '../where-to-buy.route';

/** La guía de clínicas y hospitales, sin cercanía. */
const CLINICS_DIRECTORY_ROUTE = '/clinics-directory';

/** Cuántos centros se piden; los mismos que en imagenología. */
const MEDICAL_CENTER_LIMIT = 20;

/** Nombre de respaldo para un concepto que el catálogo no supo nombrar. */
const UNNAMED_PROCEDURE = 'Un procedimiento pedido';

/** Un procedimiento pendiente, ya con su nombre. */
export interface PendingProcedureView {
  readonly conceptId: string;
  readonly name: string;
}

/** Una sede, lista para pintar. */
export interface MedicalCenterView {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly distance: string | null;
  readonly complete: boolean;
  readonly missing: readonly string[];
  readonly directions: string | null;
}

/** Lo que muestra la pestaña cuando hay centros. */
export interface MedicalCentersView {
  readonly procedures: readonly PendingProcedureView[];
  readonly centers: readonly MedicalCenterView[];
}

/**
 * La pestaña «Centros médicos» de la pantalla de la receta (carril 19).
 *
 * Gemela de imagenología: los procedimientos salen de las órdenes propias y
 * los centros de una sola consulta que ya viene ordenada —completos primero,
 * después el más cercano—. La diferencia es que acá el servidor lee él mismo
 * las órdenes (`GET /clinical/me/procedure-centers`): lo que le pidieron a la
 * persona no viaja en la URL.
 *
 * El contenido de una pestaña se pinta aunque esté oculta, así que la consulta
 * espera a que la pestaña se abra (`active`) y se repite sólo si cambia el
 * punto de partida.
 */
@Component({
  selector: 'app-medical-centers-tab',
  imports: [AppButton, AppButtonLink, Badge, Link, RouterLink, ViewStateHost],
  templateUrl: './medical-centers-tab.html',
  styleUrl: '../where-to-buy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCentersTab {
  private readonly procedureCenters = inject(ProcedureCentersClient);
  private readonly terminology = inject(TerminologyClient);

  /** Si la pestaña está a la vista; hasta entonces no se consulta nada. */
  readonly active = input(false);
  /** El punto de partida elegido en Farmacias, o `null`. */
  readonly origin = input<ReferencePoint | null>(null);

  protected readonly clinicsDirectoryRoute = CLINICS_DIRECTORY_ROUTE;
  protected readonly state = signal<ViewState<MedicalCentersView>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));

  /** Por defecto sólo los que tienen todo, como farmacias e imagenología. */
  protected readonly showPartialCenters = signal(false);
  protected readonly partialCenterCount = computed(
    () => this.data()?.centers.filter((center) => !center.complete).length ?? 0,
  );
  protected readonly visibleCenters = computed(() => {
    const centers = this.data()?.centers ?? [];
    return this.showPartialCenters() ? centers : centers.filter((center) => center.complete);
  });
  protected readonly partialCentersLabel = computed(() =>
    partialCentersLabel(this.partialCenterCount(), this.showPartialCenters()),
  );

  /** La última consulta hecha, por su origen; `undefined` si todavía no hubo. */
  private lastQueryKey: string | undefined;
  private subscription: Subscription | undefined;

  constructor() {
    effect(() => {
      const active = this.active();
      const origin = this.origin();
      untracked(() => {
        if (!active && this.lastQueryKey === undefined) return;
        if (originKey(origin) === this.lastQueryKey) return;
        this.load();
      });
    });
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  /** Lee lo pendiente y las sedes; también es el «Reintentar». */
  protected load(): void {
    const origin = this.origin();
    this.lastQueryKey = originKey(origin);
    this.subscription?.unsubscribe();
    this.state.set(loading());
    this.subscription = this.procedureCenters
      .getOwn({
        origin: origin === null ? undefined : { lat: origin.lat, lng: origin.lng },
        limit: MEDICAL_CENTER_LIMIT,
      })
      .pipe(
        switchMap((result) =>
          result.procedures.length === 0
            ? of({ result, labels: new Map() as ConceptLabels })
            : this.terminology
                .readConceptLabels(conceptIdsOf(result))
                .pipe(map((labels) => ({ result, labels }))),
        ),
      )
      .subscribe({
        next: ({ result, labels }) => this.state.set(stateOf(result, labels)),
        error: (error: unknown) => this.state.set(errorToViewState<MedicalCentersView>(error)),
      });
  }

  /** «Endoscopía alta, Espirometría». */
  protected procedureNames(procedures: readonly PendingProcedureView[]): string {
    return procedures.map((procedure) => procedure.name).join(', ');
  }
}

/** Qué estado mostrar: sin pedidos, sin centros, o la lista. */
export function stateOf(
  result: ProcedureCentersResult,
  labels: ConceptLabels,
): ViewState<MedicalCentersView> {
  if (result.procedures.length === 0) {
    return empty(
      { label: 'Ver clínicas y hospitales', route: CLINICS_DIRECTORY_ROUTE },
      'No tiene procedimientos pendientes. Cuando su médico le pida uno, acá va a ver dónde hacérselo.',
    );
  }
  if (result.centers.length === 0) {
    return empty(
      { label: 'Ver clínicas y hospitales', route: CLINICS_DIRECTORY_ROUTE },
      'Ningún centro registrado declara hoy los procedimientos que le pidieron. Puede consultar la guía de clínicas y hospitales.',
    );
  }
  const nameOf = (conceptId: string): string => labels.get(conceptId)?.display ?? UNNAMED_PROCEDURE;
  return ready({
    procedures: result.procedures.map((procedure) => ({
      conceptId: procedure.conceptId,
      name: nameOf(procedure.conceptId),
    })),
    centers: result.centers.map((center) => medicalCenterOf(center, nameOf)),
  });
}

/** Una sede de la API, con nombres en vez de ids y el enlace de «Cómo llegar». */
export function medicalCenterOf(
  center: ProcedureCenter,
  nameOf: (conceptId: string) => string,
): MedicalCenterView {
  return {
    id: center.siteId,
    name:
      center.siteName === center.practiceName
        ? center.practiceName
        : `${center.practiceName} — ${center.siteName}`,
    address: center.addressText,
    distance: center.distanceKm === null ? null : formatKm(center.distanceKm),
    complete: center.complete,
    missing: center.missingProcedureConceptIds.map(nameOf),
    directions: directionsUrl(center.latitude, center.longitude),
  };
}

/** Los conceptos a nombrar: los pedidos (que incluyen todos los faltantes). */
function conceptIdsOf(result: ProcedureCentersResult): string[] {
  return [...new Set(result.procedures.map((procedure) => procedure.conceptId))];
}

function originKey(origin: ReferencePoint | null): string {
  return origin === null ? 'none' : `${origin.lat},${origin.lng}`;
}

/** «1,2 km»: un decimal y coma, como el resto de la pantalla. */
function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** «Ver el que tiene una parte» o «Ver los 3 que tienen una parte»; con todos a la vista, volver. */
function partialCentersLabel(count: number, showing: boolean): string {
  if (showing) return 'Mostrar solo los que tienen todos';
  return count === 1 ? 'Ver el que tiene una parte' : `Ver los ${count} que tienen una parte`;
}
