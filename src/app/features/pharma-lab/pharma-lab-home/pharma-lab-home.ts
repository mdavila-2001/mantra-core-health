import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { PharmaLabClient } from '../../../core/data-access/pharma-lab/pharma-lab.client';
import type {
  InformationalMaterial,
  MedicalVisitor,
  PharmaLab,
  PharmaProduct,
  PharmacovigilanceReport,
  RatingAggregate,
  RegulatoryDocument,
} from '../../../core/data-access/pharma-lab/pharma-lab.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PharmaLabConcepts, type ConceptDictionary } from '../../../core/data-access/pharma-lab/pharma-lab-concepts.client';

/** Todo lo que la pantalla del laboratorio necesita, en una sola carga. */
export interface PharmaLabDashboard {
  readonly lab: PharmaLab;
  readonly visitors: readonly MedicalVisitor[];
  readonly products: readonly PharmaProduct[];
  readonly materials: readonly InformationalMaterial[];
  readonly reports: readonly PharmacovigilanceReport[];
  readonly documents: readonly RegulatoryDocument[];
  readonly ratings: RatingAggregate;
  readonly concepts: ConceptDictionary;
}

/**
 * Panel del administrador de laboratorio farmacéutico (carril 17).
 *
 * Reúne en una sola pantalla lo que la especificación reparte en secciones —
 * visitadores, catálogo de medicamentos, material informativo, farmacovigilancia
 * y documentación regulatoria — porque son vistas de la **misma organización** y
 * separarlas en cinco entradas de menú obligaría a elegir el laboratorio cinco
 * veces.
 *
 * ## Desvincular es la acción cargada
 *
 * El botón de desvincular no es un cambio de estado más: cierra sesiones, revoca
 * permisos y cancela visitas. Por eso pide motivo antes de ejecutarse y muestra
 * después **qué se revocó**, con números: una desvinculación que dice «listo» no
 * permite comprobar que efectivamente cortó el acceso.
 *
 * ## Las calificaciones se ven agregadas
 *
 * La especificación prohíbe publicar la calificación de una visita concreta
 * (5524) y solo permite a la organización consultar resultados agregados (5523).
 * Esta pantalla pide `rating-summary`, que devuelve promedios; no existe ninguna
 * llamada desde acá que traiga la nota que puso un doctor.
 */
@Component({
  selector: 'app-pharma-lab-home',
  imports: [AppButton, Badge, PageHeader, Tab, Tabs, ViewStateHost],
  templateUrl: './pharma-lab-home.html',
  styleUrl: './pharma-lab-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmaLabHome {
  private readonly api = inject(PharmaLabClient);
  private readonly conceptsApi = inject(PharmaLabConcepts);

  protected readonly state = signal<ViewState<PharmaLabDashboard>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));

  /** Resultado de la última desvinculación, para poder comprobarla. */
  protected readonly ultimaRevocacion = signal<string | null>(null);

  /** Motivo que se enviará al desvincular. Obligatorio. */
  protected readonly motivo = signal('');

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected concepto(conceptId: string | undefined): string {
    return this.data()?.concepts.label(conceptId) ?? '—';
  }

  /** Si el visitador conserva la vinculación, y por tanto puede operar. */
  protected estaVinculado(visitor: MedicalVisitor): boolean {
    return this.concepto(visitor.statusConceptId) === 'Vinculación activa';
  }

  protected escribirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLInputElement).value);
  }

  /**
   * Desvincula al visitador y deja el resultado a la vista.
   *
   * No pregunta con un `confirm()` del navegador: exige que el motivo esté
   * escrito, que es a la vez el requisito del backend y la pausa que evita el
   * clic accidental.
   */
  protected desvincular(visitor: MedicalVisitor): void {
    const dashboard = this.data();
    const motivo = this.motivo().trim();
    if (!dashboard || motivo === '') {
      this.ultimaRevocacion.set('Escribí el motivo antes de desvincular.');
      return;
    }
    this.api.unlinkVisitor(dashboard.lab.id, visitor.id, motivo).subscribe({
      next: (resultado) => {
        this.ultimaRevocacion.set(
          `${visitor.fullName}: ${resultado.revokedSessions} sesión(es) cerradas, ` +
            `${resultado.revokedRefreshTokens} token(s) revocados, ` +
            `${resultado.cancelledVisitRequests ?? 0} visita(s) cancelada(s).`,
        );
        this.motivo.set('');
        this.load();
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<PharmaLabDashboard>(error)),
    });
  }

  private load(): void {
    this.state.set(loading());
    this.api.listLabs().subscribe({
      next: (labs) => {
        const lab = labs[0];
        if (lab === undefined) {
          this.state.set(
            empty(
              { label: 'Volver al panel', route: '/dashboard' },
              'Todavía no hay ninguna organización registrada como laboratorio farmacéutico.',
            ),
          );
          return;
        }
        this.loadLab(lab);
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<PharmaLabDashboard>(error)),
    });
  }

  private loadLab(lab: PharmaLab): void {
    forkJoin({
      visitors: this.api.listVisitors(lab.id),
      products: this.api.listProducts(lab.id),
      materials: this.api.listMaterials(lab.id),
      reports: this.api.listPharmacovigilanceReports(lab.id),
      documents: this.api.listRegulatoryDocuments(lab.id),
      ratings: this.api.getRatingSummary(lab.id),
      concepts: this.conceptsApi.load(),
    }).subscribe({
      next: (partes) => this.state.set(ready({ lab, ...partes })),
      error: (error: unknown) =>
        this.state.set(errorToViewState<PharmaLabDashboard>(error)),
    });
  }
}
