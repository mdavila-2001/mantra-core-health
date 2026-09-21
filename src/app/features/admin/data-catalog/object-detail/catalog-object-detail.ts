import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type {
  Annotation,
  AnnotationHistory,
  CatalogColumn,
  CatalogObjectDetail as ObjectDetailData,
  ChangeEvent,
  Evidence,
  Impact,
} from '../../../../core/data-access/admin-portal/data-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  type ErrorDeApi,
  entero,
  errorDeApi,
  observationStatus,
  reviewStatus,
  sensitivityLabel,
} from '../../platform/platform-labels';
import { AnnotationDialog } from './annotation-dialog';
import { EVIDENCE_KINDS, EvidenceDialog } from './evidence-dialog';

const CAMPO_FALTANTE: Readonly<Record<string, string>> = {
  purpose: 'propósito',
  existenceRationale: 'por qué existe',
  rowGrain: 'qué significa una fila',
  businessOwner: 'responsable',
  sensitivity: 'sensibilidad',
};

/**
 * Ficha de una tabla o vista del catálogo: hechos técnicos observados, la
 * justificación de negocio con su estado de revisión, columnas, evidencia,
 * historial, impacto estructural y cambios detectados. Una sola tarjeta con
 * pestañas (regla de composición §5).
 */
@Component({
  selector: 'app-catalog-object-detail',
  imports: [
    DatePipe,
    RouterLink,
    AppButton,
    Badge,
    Alert,
    Card,
    FactList,
    SegmentedControl,
    Tabs,
    Tab,
    PageHeader,
    ViewStateHost,
    AnnotationDialog,
    EvidenceDialog,
  ],
  templateUrl: './catalog-object-detail.html',
  styleUrl: './catalog-object-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogObjectDetail {
  private readonly catalog = inject(DataCatalogClient);
  private readonly dialogs = inject(DialogService);
  protected readonly objectId = inject(ActivatedRoute).snapshot.paramMap.get('objectId') ?? '';

  protected readonly pestana = signal(0);
  protected readonly reviewStatus = reviewStatus;
  protected readonly observationStatus = observationStatus;
  protected readonly evidenceLabel = (kind: string) => EVIDENCE_KINDS.find((k) => k.value === kind)?.label ?? kind;

  protected readonly detalle = signal<ViewState<ObjectDetailData>>(loading());
  protected readonly columnas = signal<ViewState<readonly CatalogColumn[]>>(loading());
  protected readonly evidencia = signal<readonly Evidence[]>([]);
  protected readonly historial = signal<AnnotationHistory>({ revisions: [], decisions: [] });
  protected readonly cambios = signal<readonly ChangeEvent[]>([]);
  protected readonly impacto = signal<ViewState<Impact>>(loading());
  protected readonly direccion = signal<Impact['direction']>('downstream');

  protected readonly editando = signal(false);
  protected readonly anadiendoEvidencia = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly objeto = computed(() => {
    const d = this.detalle();
    return d.status === 'ready' ? d.data : null;
  });

  protected readonly titulo = computed(() => {
    const o = this.objeto();
    return o ? `${o.technical.schemaName}.${o.technical.objectName}` : 'Objeto del catálogo';
  });

  protected readonly breadcrumbs = computed(() => [
    { label: 'Catálogo de datos', routerLink: '/administration/data-catalog' },
    { label: this.titulo() },
  ]);

  protected readonly hechosTecnicos = computed<readonly Hecho[]>(() => {
    const o = this.objeto();
    if (!o) return [];
    const t = o.technical;
    return [
      { etiqueta: 'Tipo', valor: t.objectKind },
      { etiqueta: 'Columnas', valor: String(t.columnCount) },
      { etiqueta: 'Clave primaria', valor: t.primaryKey.length ? t.primaryKey.join(', ') : 'Sin clave primaria' },
      { etiqueta: 'Filas (estimación)', valor: entero(t.statistics.estimatedRows) },
      { etiqueta: 'Método', valor: t.statistics.method },
      { etiqueta: 'Comentario en la base', valor: t.comment },
      { etiqueta: 'Motor', valor: o.observation.lastScanEngineVersion },
    ];
  });

  protected readonly hechosNegocio = computed<readonly Hecho[]>(() => {
    const c = this.objeto()?.annotation?.content;
    if (!c) return [];
    return [
      { etiqueta: 'Nombre de negocio', valor: c.businessName },
      { etiqueta: 'Propósito', valor: c.purpose },
      { etiqueta: 'Por qué existe', valor: c.existenceRationale },
      { etiqueta: 'Qué significa una fila', valor: c.rowGrain },
      { etiqueta: 'Qué pasa si se elimina', valor: c.deletionImpact },
      { etiqueta: 'Dueño de negocio', valor: c.businessOwner },
      { etiqueta: 'Steward', valor: c.dataSteward },
      { etiqueta: 'Responsable técnico', valor: c.technicalOwner },
      { etiqueta: 'Sensibilidad', valor: sensitivityLabel(c.sensitivity) },
    ];
  });

  protected readonly faltantes = computed(() =>
    (this.objeto()?.coverage.missingFields ?? []).map((f) => CAMPO_FALTANTE[f] ?? f),
  );

  protected readonly puedeRevisar = computed(() => this.objeto()?.annotation?.reviewStatus === 'NEEDS_REVIEW');

  protected readonly opcionesDireccion = [
    { value: 'downstream' as const, label: 'Qué depende de esta tabla' },
    { value: 'upstream' as const, label: 'De qué depende' },
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.detalle.set(loading());
    this.catalog.getObject(this.objectId).subscribe({
      next: (d) => this.detalle.set(ready(d)),
      error: (e: unknown) => this.detalle.set(errorToViewState<ObjectDetailData>(e)),
    });
    this.catalog.listColumns(this.objectId).subscribe({
      next: (c) => this.columnas.set(ready(c)),
      error: (e: unknown) => this.columnas.set(errorToViewState<readonly CatalogColumn[]>(e)),
    });
    this.catalog.listEvidence(this.objectId).subscribe({ next: (e) => this.evidencia.set(e), error: () => undefined });
    this.catalog.history(this.objectId).subscribe({ next: (h) => this.historial.set(h), error: () => undefined });
    this.catalog.changes(this.objectId).subscribe({ next: (p) => this.cambios.set(p.items), error: () => undefined });
    this.cargarImpacto();
  }

  protected cargarImpacto(): void {
    this.impacto.set(loading());
    this.catalog.impact(this.objectId, this.direccion(), 3).subscribe({
      next: (i) => this.impacto.set(ready(i)),
      error: (e: unknown) => this.impacto.set(errorToViewState<Impact>(e)),
    });
  }

  protected cambiarDireccion(valor: Impact['direction']): void {
    this.direccion.set(valor);
    this.cargarImpacto();
  }

  protected fichaGuardada(ficha: Annotation): void {
    this.editando.set(false);
    this.aviso.set(
      ficha.reviewStatus === 'NEEDS_REVIEW'
        ? `Ficha enviada a revisión (revisión ${ficha.currentRevisionNo}). Otra persona tiene que aprobarla.`
        : `Borrador guardado (revisión ${ficha.currentRevisionNo}).`,
    );
    this.cargar();
  }

  protected recargarTrasConflicto(): void {
    this.editando.set(false);
    this.cargar();
  }

  protected evidenciaAnadida(): void {
    this.anadiendoEvidencia.set(false);
    this.aviso.set('Evidencia añadida.');
    this.catalog.listEvidence(this.objectId).subscribe({ next: (e) => this.evidencia.set(e) });
    this.catalog.getObject(this.objectId).subscribe({ next: (d) => this.detalle.set(ready(d)) });
  }

  /** Aprobar o rechazar la revisión vigente. El servidor decide si quien revisa puede. */
  protected async revisar(decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    const ficha = this.objeto()?.annotation;
    if (!ficha) return;
    let comentario: string | null | undefined;
    if (decision === 'REJECTED') {
      comentario = await this.dialogs.confirmWithReason(
        {
          title: 'Rechazar la ficha',
          message: `Vas a rechazar la revisión ${ficha.currentRevisionNo}. Quien la escribió verá tu comentario.`,
          confirmLabel: 'Rechazar',
          cancelLabel: 'Volver',
          destructive: true,
        },
        { label: 'Qué falta o qué está mal', minLength: 10, maxLength: 2000 },
      );
      if (comentario === null) return;
    } else {
      const ok = await this.dialogs.confirm({
        title: 'Aprobar la ficha',
        message: `Vas a aprobar la revisión ${ficha.currentRevisionNo}. Si alguien la edita después, vuelve a necesitar revisión.`,
        confirmLabel: 'Aprobar',
        cancelLabel: 'Volver',
      });
      if (!ok) return;
    }
    this.error.set(null);
    this.aviso.set(null);
    this.catalog
      .review(ficha.id, {
        decision,
        expectedRevisionNo: ficha.currentRevisionNo,
        ...(comentario ? { comment: comentario } : {}),
      })
      .subscribe({
        next: () => {
          this.aviso.set(decision === 'APPROVED' ? 'Ficha aprobada.' : 'Ficha rechazada.');
          this.cargar();
        },
        error: (e: unknown) => {
          const api = errorDeApi(e);
          this.error.set(
            api.status === 403
              ? esAutoRevision(api)
                ? 'No podés revisar una revisión que escribiste vos: tiene que hacerlo otra persona.'
                : 'Tu rol no permite revisar fichas.'
              : api.status === 409
                ? 'La ficha cambió mientras la revisabas. Recargá y revisá la versión vigente.'
                : (api.message ?? 'No se pudo registrar la revisión.'),
          );
        },
      });
  }

  protected nombreNodo(n: Impact['nodes'][number]): string {
    return n.schemaName && n.objectName ? `${n.schemaName}.${n.objectName}` : n.objectId;
  }

  protected cambiosDe(e: ChangeEvent): string {
    const antes = e.before ? JSON.stringify(e.before) : '—';
    const despues = e.after ? JSON.stringify(e.after) : '—';
    return `${antes} → ${despues}`;
  }
}

/** El 403 de segregación de funciones se distingue del de rol por su violación. */
function esAutoRevision(api: ErrorDeApi): boolean {
  const violaciones = (api.details?.['violations'] as { reason?: string }[] | undefined) ?? [];
  return violaciones.some((v) => v.reason === 'SELF_REVIEW');
}
