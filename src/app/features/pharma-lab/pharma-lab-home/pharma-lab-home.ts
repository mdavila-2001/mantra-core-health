import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
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
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
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
  imports: [AppButton, Badge, DataTable, PageHeader, Tab, Tabs, ViewStateHost],
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

  /* ---- las cinco tablas, en el organismo del sistema (refactor UX) --------
     Eran `<table>` escritas a mano: a 390 px empujaban la página de costado y
     no tenían prioridad de columnas, detalle plegable ni indicio de scroll.
     Las filas llevan el texto ya resuelto; la tabla no conoce conceptos. */

  private readonly celdaEstadoDeVisitador =
    viewChild.required<TemplateRef<{ $implicit: FilaDeVisitador }>>('celdaEstadoDeVisitador');
  private readonly celdaAccionDeVisitador =
    viewChild.required<TemplateRef<{ $implicit: FilaDeVisitador }>>('celdaAccionDeVisitador');

  private listo<T>(filas: (d: PharmaLabDashboard) => readonly T[]): ViewState<readonly T[]> {
    const datos = this.data();
    return datos === null ? loading() : ready(filas(datos));
  }

  protected readonly visitadores = computed(() =>
    this.listo((d) =>
      d.visitors.map((v) => ({
        id: v.id,
        fullName: v.fullName,
        internalCode: v.internalCode,
        zona: v.assignedZone ?? v.region ?? '—',
        perfil: v.publiclyListed ? 'Visible' : 'Oculto',
        visitor: v,
      })),
    ),
  );
  protected readonly columnasDeVisitadores = computed<readonly ColumnDef<FilaDeVisitador>[]>(() => [
    { key: 'fullName', header: 'Nombre', priority: 1 },
    { key: 'internalCode', header: 'Código', priority: 2 },
    { key: 'zona', header: 'Zona', priority: 2 },
    { key: 'estado', header: 'Vinculación', priority: 1, cell: this.celdaEstadoDeVisitador() },
    { key: 'perfil', header: 'Perfil público', priority: 2 },
    { key: 'accion', header: 'Acción', priority: 1, cell: this.celdaAccionDeVisitador() },
  ]);

  protected readonly productos = computed(() =>
    this.listo((d) =>
      d.products.map((p) => ({
        id: p.id,
        nombre: p.tradeName,
        principio: p.activeIngredient,
        regulatorio: this.concepto(p.regulatoryStatusConceptId),
        indicacion: p.authorizedIndication ?? 'Sin indicación publicable',
        divulgacion: this.concepto(p.disclosureLevelConceptId),
      })),
    ),
  );
  protected readonly columnasDeProductos: readonly ColumnDef<FilaDeProducto>[] = [
    { key: 'nombre', header: 'Nombre comercial', priority: 1 },
    { key: 'principio', header: 'Principio activo', priority: 1 },
    { key: 'regulatorio', header: 'Estado regulatorio', priority: 1 },
    { key: 'indicacion', header: 'Indicación autorizada', priority: 2 },
    { key: 'divulgacion', header: 'Divulgación', priority: 2 },
  ];

  protected readonly materiales = computed(() =>
    this.listo((d) =>
      d.materials.map((m) => ({
        id: m.id,
        titulo: m.title,
        tipo: this.concepto(m.kindConceptId),
        version: m.version,
        estado: this.concepto(m.statusConceptId),
        vigencia: `${m.validFrom ?? '—'} → ${m.validTo ?? 'sin límite'}`,
      })),
    ),
  );
  protected readonly columnasDeMateriales: readonly ColumnDef<FilaDeMaterial>[] = [
    { key: 'titulo', header: 'Título', priority: 1 },
    { key: 'tipo', header: 'Tipo', priority: 2 },
    { key: 'version', header: 'Versión', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 1 },
    { key: 'vigencia', header: 'Vigencia', priority: 2 },
  ];

  protected readonly reportes = computed(() =>
    this.listo((d) =>
      d.reports.map((r) => ({
        id: r.id,
        caso: r.caseCode,
        fecha: r.eventDate,
        tipo: this.concepto(r.eventTypeConceptId),
        gravedad: this.concepto(r.severityConceptId),
        estado: this.concepto(r.statusConceptId),
      })),
    ),
  );
  protected readonly columnasDeReportes: readonly ColumnDef<FilaDeReporte>[] = [
    { key: 'caso', header: 'Caso', priority: 1 },
    { key: 'fecha', header: 'Fecha del evento', priority: 2 },
    { key: 'tipo', header: 'Tipo', priority: 2 },
    { key: 'gravedad', header: 'Gravedad', priority: 1 },
    { key: 'estado', header: 'Estado', priority: 1 },
  ];

  protected readonly documentos = computed(() =>
    this.listo((d) =>
      d.documents.map((doc) => ({
        id: doc.id,
        nombre: doc.name,
        tipo: this.concepto(doc.documentTypeConceptId),
        version: doc.currentVersion,
        vence: doc.expiresOn ?? 'sin vencimiento',
        estado: this.concepto(doc.statusConceptId),
      })),
    ),
  );
  protected readonly columnasDeDocumentos: readonly ColumnDef<FilaDeDocumento>[] = [
    { key: 'nombre', header: 'Documento', priority: 1 },
    { key: 'tipo', header: 'Tipo', priority: 2 },
    { key: 'version', header: 'Versión', priority: 2 },
    { key: 'vence', header: 'Vence', priority: 1 },
    { key: 'estado', header: 'Estado', priority: 1 },
  ];

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  /** Nombres de fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeVisitador = (fila: FilaDeVisitador): string => fila.fullName;
  protected readonly nombreDeProducto = (fila: FilaDeProducto): string => fila.nombre;
  protected readonly nombreDeMaterial = (fila: FilaDeMaterial): string => fila.titulo;
  protected readonly nombreDeReporte = (fila: FilaDeReporte): string => `el caso ${fila.caso}`;
  protected readonly nombreDeDocumento = (fila: FilaDeDocumento): string => fila.nombre;

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

interface FilaDeVisitador {
  readonly id: string;
  readonly fullName: string;
  readonly internalCode: string;
  readonly zona: string;
  readonly perfil: string;
  readonly visitor: MedicalVisitor;
}

interface FilaDeProducto {
  readonly id: string;
  readonly nombre: string;
  readonly principio: string;
  readonly regulatorio: string;
  readonly indicacion: string;
  readonly divulgacion: string;
}

interface FilaDeMaterial {
  readonly id: string;
  readonly titulo: string;
  readonly tipo: string;
  readonly version: string;
  readonly estado: string;
  readonly vigencia: string;
}

interface FilaDeReporte {
  readonly id: string;
  readonly caso: string;
  readonly fecha: string;
  readonly tipo: string;
  readonly gravedad: string;
  readonly estado: string;
}

interface FilaDeDocumento {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: string;
  readonly version: string;
  readonly vence: string;
  readonly estado: string;
}
