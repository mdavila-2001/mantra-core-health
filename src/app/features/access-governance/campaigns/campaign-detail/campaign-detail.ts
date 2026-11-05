import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessReviewsClient } from '../../../../core/data-access/access-governance/access-reviews.client';
import {
  REVIEW_KIND_LABELS,
  type Campaign,
  type CampaignResults,
  type ReviewItem,
} from '../../../../core/data-access/access-governance/access-reviews.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import {
  empty,
  hasData,
  loading,
  notFound,
  ready,
  stale,
} from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Progress } from '../../../../shared/components/atoms/progress/progress';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import {
  EXPORT_REASON_CODES,
  EXPORT_REASON_LABELS,
  type ExportReasonCode,
} from '../../../../core/data-access/access-governance/governance-reports.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDay } from '../../../support-access/support-labels';
import {
  campaignStatusText,
  campaignStatusTone,
  dueCounter,
  itemStateText,
  itemStateTone,
  reviewerKindText,
  scopeKindText,
  sensitivityRisk,
  uncertifiedActionText,
} from '../../review-labels';
import { downloadText, exportFileName } from '../campaign-download';

/** Todo lo que la pantalla necesita de una campaña. Un borrador no tiene resultados ni ítems todavía. */
interface CampaignView {
  readonly campaign: Campaign;
  readonly results: CampaignResults | null;
  readonly items: readonly ReviewItem[];
}

type Filtro = 'ALL' | 'PENDING' | 'OVERDUE' | 'DECIDED';
/** Un aviso que la pantalla anuncia (`aria-live`) tras una acción. */
interface Aviso {
  readonly tone: 'success' | 'warning' | 'error' | 'info';
  readonly text: string;
}

const LISTA = '/administration/access-governance/campaigns';

const dias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;
const accesos = (n: number): string => (n === 1 ? '1 acceso' : `${n} accesos`);

/** «7, 3 y 1 día antes». */
function recordatorios(dias: readonly number[]): string {
  if (dias.length === 0) return 'Sin recordatorios';
  const ordenados = [...dias].sort((a, b) => b - a);
  const ultimo = ordenados[ordenados.length - 1]!;
  const lista =
    ordenados.length === 1 ? String(ultimo) : `${ordenados.slice(0, -1).join(', ')} y ${ultimo}`;
  return `${lista} ${ultimo === 1 ? 'día' : 'días'} antes`;
}

/**
 * **Seguimiento de una campaña** (CONTRATO-GOBIERNO §6.2 y §9.3): resultados, accesos vencidos y auto-revocados,
 * configuración, y las acciones que cambian su vida: lanzar un borrador, cerrar, cancelar y exportar.
 *
 * Una sola tarjeta con pestañas. Cada acción pide confirmación diciendo qué pasa, la API decide, y la pantalla vuelve a
 * leer para mostrar lo que quedó guardado. Exportar entrega el archivo con su huella (`sha256`): queda un asiento de
 * auditoría en el servidor. Nada acá autoriza: ocultar un botón no es seguridad.
 */
@Component({
  selector: 'app-campaign-detail',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    PageHeader,
    Progress,
    RouterLink,
    Select,
    SegmentedControl,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './campaign-detail.html',
  styleUrl: './campaign-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetail implements OnInit {
  private readonly client = inject(AccessReviewsClient);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  protected readonly lista = LISTA;
  protected readonly state = signal<ViewState<CampaignView>>(loading());
  protected readonly pestana = signal(0);
  protected readonly filtro = signal<Filtro>('ALL');
  protected readonly ocupada = signal(false);
  protected readonly aviso = signal<Aviso | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly exportado = signal<string | null>(null);
  /**
   * Exportar es solo del administrador de seguridad (`GET …/campaigns/:id/export`): el resto de las rutas de campañas admiten a
   * quien administra personal de apoyo, pero esta no. Un botón que va a dar 403 es una trampa: se le dice por qué no está.
   */
  protected readonly puedeExportar = computed(() => {
    const roles = this.session.roles();
    return roles.includes('SECURITY_ADMIN') || roles.includes('SUPERADMIN');
  });
  private cargadoEn = new Date();

  private readonly personaCell =
    viewChild.required<TemplateRef<{ $implicit: ReviewItem }>>('personaCell');
  private readonly revisorCell =
    viewChild.required<TemplateRef<{ $implicit: ReviewItem }>>('revisorCell');
  private readonly estadoCell =
    viewChild.required<TemplateRef<{ $implicit: ReviewItem }>>('estadoCell');
  private readonly venceCell =
    viewChild.required<TemplateRef<{ $implicit: ReviewItem }>>('venceCell');

  protected readonly vista = computed<CampaignView | null>(() => {
    const s = this.state();
    return hasData(s) ? s.data : null;
  });

  protected readonly esVencido = (i: ReviewItem): boolean =>
    i.state === 'PENDING' && dueCounter(i.dueAt).overdue;

  protected readonly filtros = computed<readonly SegmentedOption<Filtro>[]>(() => {
    const items = this.vista()?.items ?? [];
    return [
      { value: 'ALL', label: `Todos (${items.length})` },
      {
        value: 'PENDING',
        label: `Pendientes (${items.filter((i) => i.state === 'PENDING').length})`,
      },
      { value: 'OVERDUE', label: `Vencidos sin decidir (${items.filter(this.esVencido).length})` },
      {
        value: 'DECIDED',
        label: `Decididos (${items.filter((i) => i.state !== 'PENDING').length})`,
      },
    ];
  });

  protected readonly itemsVisibles = computed<ViewState<readonly ReviewItem[]>>(() => {
    const items = this.vista()?.items ?? [];
    const filtro = this.filtro();
    const filas = items.filter((i) =>
      filtro === 'ALL'
        ? true
        : filtro === 'PENDING'
          ? i.state === 'PENDING'
          : filtro === 'OVERDUE'
            ? this.esVencido(i)
            : i.state !== 'PENDING',
    );
    return filas.length === 0
      ? empty(
          { label: 'Cambie el filtro para ver otros accesos' },
          items.length === 0
            ? 'Esta campaña aún no tiene accesos para revisar.'
            : 'Ningún acceso coincide con ese filtro.',
        )
      : ready(filas);
  });

  protected readonly columnas = computed<readonly ColumnDef<ReviewItem>[]>(() => [
    { key: 'persona', header: 'Persona', priority: 1, cell: this.personaCell() },
    { key: 'revisor', header: 'Quién revisa', priority: 2, cell: this.revisorCell() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.estadoCell() },
    { key: 'vence', header: 'Plazo', priority: 1, cell: this.venceCell() },
  ]);

  protected readonly rowId = (i: ReviewItem): string => i.id;
  protected readonly rowLabel = (i: ReviewItem): string =>
    `Acceso de ${i.subjectName ?? 'una persona'}`;
  protected readonly revisor = (i: ReviewItem): string => reviewerKindText(i.reviewerKind);
  protected readonly estadoTexto = (i: ReviewItem): string => itemStateText(i.state);
  protected readonly estadoTono = (i: ReviewItem) => itemStateTone(i.state);
  protected readonly plazo = (i: ReviewItem): string =>
    i.state === 'PENDING' ? dueCounter(i.dueAt).text : `Decidido el ${formatDay(i.decidedAt)}`;

  /* ---- lo que muestran las pestañas --------------------------------------------------------------------------------- */

  protected readonly estadoTextoDe = campaignStatusText;
  protected readonly estadoTonoDe = campaignStatusTone;
  protected readonly tipoDe = (c: Campaign): string => REVIEW_KIND_LABELS[c.kind];
  protected readonly venceDe = (c: Campaign): string => {
    if (c.status === 'CLOSED') return `Cerrada el ${formatDay(c.closedAt)}`;
    if (c.status === 'CANCELLED') return `Cancelada el ${formatDay(c.cancelledAt)}`;
    return dueCounter(c.dueAt).text;
  };
  protected readonly vencidaDe = (c: Campaign): boolean =>
    (c.status === 'OPEN' || c.status === 'DRAFT') && dueCounter(c.dueAt).overdue;

  protected readonly vencidos = computed(
    () => (this.vista()?.items ?? []).filter(this.esVencido).length,
  );
  protected readonly porDecision = computed(() =>
    this.pares(this.vista()?.results?.byDecision, itemStateText),
  );
  protected readonly porRevisor = computed(() =>
    this.pares(this.vista()?.results?.byReviewerKind, reviewerKindText),
  );
  protected readonly porSensibilidad = computed(() =>
    this.pares(this.vista()?.results?.bySensitivity, sensitivityRisk),
  );
  protected readonly tiempoMedio = computed(() => {
    const horas = this.vista()?.results?.meanResponseHours;
    return horas === null || horas === undefined
      ? 'Aún sin respuestas'
      : `${Math.round(horas)} ${Math.round(horas) === 1 ? 'hora' : 'horas'}`;
  });
  protected readonly autoRevocados = computed(() => {
    const v = this.vista();
    if (v?.results === null || v === null) return [];
    return v.results.autoRevokedItemIds.map(
      (id) => v.items.find((i) => i.id === id)?.subjectName ?? 'Una persona',
    );
  });

  protected readonly alcance = (c: Campaign): string => {
    const s = c.scope;
    const n = (
      s.practitionerRoleAssignmentIds ??
      s.healthcareServiceIds ??
      s.careSpaceIds ??
      s.templateCodes ??
      []
    ).length;
    return s.kind === 'ORGANIZATION' ? scopeKindText(s.kind) : `${scopeKindText(s.kind)} (${n})`;
  };
  protected readonly filtrosTexto = (c: Campaign): string => {
    const f = c.filters;
    const partes = [
      f?.minSensitivity === undefined
        ? null
        : `riesgo ${sensitivityRisk(f.minSensitivity).replace('Riesgo ', '')} o más`,
      f?.unusedDays === undefined ? null : `sin uso en ${dias(f.unusedDays)}`,
      f?.onlyAboveCeiling === true ? 'solo lo que pasa el techo' : null,
      f?.onlySodFindings === true ? 'solo con conflictos de funciones' : null,
      f?.includeSuspended === true ? 'incluye personas suspendidas' : null,
    ].filter((p): p is string => p !== null);
    return partes.length === 0 ? 'Todos los accesos del alcance' : partes.join(' · ');
  };
  protected readonly graciaTexto = (c: Campaign): string => dias(c.graceDays);
  protected readonly avisosTexto = (c: Campaign): string => recordatorios(c.reminderDaysBefore);
  protected readonly escalaTexto = (c: Campaign): string =>
    `${dias(c.escalateAfterDays)} después del vencimiento`;
  protected readonly noCertificadoTexto = (c: Campaign): string =>
    uncertifiedActionText(c.uncertifiedAction);
  protected readonly fechaLimite = (c: Campaign): string => formatDay(c.dueAt);

  ngOnInit(): void {
    this.cargar();
  }

  private pares(
    conteos: Readonly<Record<string, number>> | undefined,
    texto: (clave: string) => string,
  ): readonly { readonly clave: string; readonly texto: string; readonly cantidad: number }[] {
    return Object.entries(conteos ?? {}).map(([clave, cantidad]) => ({
      clave,
      texto: texto(clave),
      cantidad,
    }));
  }

  /** Una lectura completa: la campaña y, si ya salió del borrador, sus resultados y ítems. */
  protected cargar(): void {
    const previo = this.vista();
    if (previo === null) this.state.set(loading());
    const id = this.route.snapshot.paramMap.get('campaignId') ?? '';
    this.client
      .getCampaign(id)
      .pipe(
        switchMap((campaign) =>
          campaign.status === 'DRAFT'
            ? of<CampaignView>({ campaign, results: null, items: [] })
            : forkJoin({
                results: this.client.getCampaignResults(id),
                items: this.client.listCampaignItems(id),
              }).pipe(
                map(({ results, items }): CampaignView => ({
                  campaign,
                  results,
                  items: items.items,
                })),
              ),
        ),
      )
      .subscribe({
        next: (vista) => {
          this.cargadoEn = new Date();
          this.state.set(ready(vista));
        },
        error: (failure: unknown) => {
          if (previo !== null) {
            this.state.set(stale(previo, this.cargadoEn));
            return;
          }
          const s = errorToViewState<CampaignView>(failure);
          this.state.set(
            s.status === 'not-found'
              ? notFound({ label: 'Volver a las campañas', route: LISTA })
              : s,
          );
        },
      });
  }

  /* ---- acciones --------------------------------------------------------------------------------------------------------- */

  protected async lanzar(c: Campaign): Promise<void> {
    if (this.ocupada()) return;
    const ok = await this.dialogs.confirm({
      title: 'Lanzar la campaña',
      message:
        'Se generan los accesos para revisar con su evidencia y se avisa a cada revisor. Desde ese momento corre el plazo.',
      confirmLabel: 'Lanzar',
    });
    if (!ok) return;
    this.ejecutar(this.client.launchCampaign(c.id), (r) => ({
      tone: r.withoutReviewer > 0 ? 'warning' : 'success',
      text: `Se generaron ${accesos(r.items)} para revisar.${r.withoutReviewer > 0 ? ` ${accesos(r.withoutReviewer)} no tienen quien los revise: revíselos como administración de seguridad.` : ''}`,
    }));
  }

  protected async cerrar(c: Campaign): Promise<void> {
    if (this.ocupada()) return;
    const pendientes = this.vista()?.results?.pending ?? 0;
    const quita = c.uncertifiedAction === 'UNCERTIFIED_REVOKE';
    const ok = await this.dialogs.confirm({
      title: 'Cerrar la campaña',
      message: quita
        ? `Hay ${accesos(pendientes)} sin decidir. Al cerrar, cada uno se quita automáticamente y se avisa a la persona, a su responsable y al doctor. Esta acción no se puede deshacer.`
        : `Hay ${accesos(pendientes)} sin decidir. Al cerrar, su estado no cambia: siguen como están y deberá resolverlos a mano.`,
      confirmLabel: 'Cerrar la campaña',
      destructive: quita,
    });
    if (!ok) return;
    this.ejecutar(this.client.closeCampaign(c.id), (r) => ({
      tone: 'success',
      text: quita
        ? `Se cerró la campaña. ${r.autoRevoked === 1 ? 'Se quitó 1 acceso' : `Se quitaron ${r.autoRevoked} accesos`} por no certificarse a tiempo.`
        : `Se cerró la campaña. ${accesos(r.skipped)} siguen sin decidir; no se quitó ninguno.`,
    }));
  }

  protected async cancelar(c: Campaign): Promise<void> {
    if (this.ocupada()) return;
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Cancelar la campaña',
        message: 'La campaña termina sin aplicar ninguna acción: no se quita ningún acceso.',
        confirmLabel: 'Cancelar la campaña',
        cancelLabel: 'Volver',
        destructive: true,
      },
      {
        label: 'Motivo de la cancelación',
        hint: 'Queda registrado.',
        minLength: 10,
        maxLength: 500,
      },
    );
    if (motivo === null) return;
    this.ejecutar(this.client.cancelCampaign(c.id, motivo), () => ({
      tone: 'info',
      text: 'La campaña se canceló: no se quitó ningún acceso.',
    }));
  }

  /** Para qué se exporta: la API pide un código (y el paso extra); lo que se elige queda asentado. */
  protected readonly motivosDeExportacion: readonly SelectOption<ExportReasonCode>[] =
    EXPORT_REASON_CODES.map((value) => ({ value, label: EXPORT_REASON_LABELS[value] }));
  protected readonly motivoDeExportacion = signal<ExportReasonCode>('AUDIT_REVIEW');

  protected exportar(c: Campaign, formato: 'csv' | 'json'): void {
    if (this.ocupada()) return;
    this.ocupada.set(true);
    this.error.set(null);
    this.exportado.set(null);
    this.client.exportCampaign(c.id, formato, this.motivoDeExportacion()).subscribe({
      next: (archivo) => {
        downloadText(
          this.document,
          URL,
          exportFileName(c.name, archivo.format, new Date()),
          archivo.format,
          archivo.content,
        );
        this.exportado.set(
          `Se descargó el archivo (${archivo.format.toUpperCase()}, ${archivo.rowCount === 1 ? '1 fila' : `${archivo.rowCount} filas`}). Huella SHA-256: ${archivo.sha256.slice(0, 12)}… La exportación queda registrada.`,
        );
        this.ocupada.set(false);
      },
      error: (failure: unknown) => this.fallo(failure),
    });
  }

  /** Corre una acción que cambia la campaña: pide, dice qué pasó y vuelve a leer lo que la API guardó. */
  private ejecutar<T>(accion: Observable<T>, aviso: (r: T) => Aviso): void {
    this.ocupada.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.exportado.set(null);
    accion.subscribe({
      next: (r) => {
        this.aviso.set(aviso(r));
        this.ocupada.set(false);
        this.cargar();
      },
      error: (failure: unknown) => this.fallo(failure),
    });
  }

  private fallo(failure: unknown): void {
    this.ocupada.set(false);
    const f = accessFailureOf(failure);
    this.error.set(
      f === null
        ? 'No pudimos completar la operación. Intente de nuevo.'
        : `${f.message}${f.requestId === undefined ? '' : ` Código de soporte: ${f.requestId}.`}`,
    );
    // Un fallo de estado (la campaña ya no está abierta) se resuelve releyendo.
    if (f?.status === 409) this.cargar();
  }
}
