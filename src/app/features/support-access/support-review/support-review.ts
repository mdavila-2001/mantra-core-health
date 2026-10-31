import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type OnInit, type TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportActivityEntry, SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import { activityActionLabel } from '../../../core/data-access/support-access/support-activity';
import { classifyReview, needsAttention, reviewHeadline, reviewStatusText, sortByUrgency, type ReviewInfo, type ReviewStatus } from '../../../core/data-access/support-access/support-recertification';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { formatDateTime, formatDay, scopeSummary, templateLabel } from '../support-labels';
import { confirmBatch, describeBatch, revokeBatch, type BatchOutcome } from './review-batch';

/** Una fila de la revisión: el vínculo y lo que se sabe de su vencimiento. */
interface ReviewRow {
  readonly engagement: SupportEngagement;
  readonly info: ReviewInfo;
}

type Filtro = 'ALL' | 'DUE_SOON' | 'OVERDUE' | 'SUSPENDED';
type Meses = 'KEEP' | '6' | '12';

const OPCIONES_DE_MESES: readonly SelectOption<Meses>[] = [
  { value: 'KEEP', label: 'Como estaba: cada vínculo conserva su período' },
  { value: '6', label: '6 meses más' },
  { value: '12', label: '12 meses más' },
];

/** Lo que cuenta como historia de la revisión: lo que le pasó a un vínculo y los permisos que se retiraron. */
/**
 * Lo que cuenta como historia de revisiones: lo que le pasa a un vínculo (confirmarlo,
 * suspenderlo, terminarlo) y retirar un permiso. Un asiento que la API no reconoce llega
 * con su asiento crudo como código, de ahí la segunda mirada.
 */
const ASIENTOS_DE_VINCULO = /^SUPPORT_(ENGAGEMENT_(RECERTIFIED|CONFIRMED_BY_PERSON|SUSPENDED|REACTIVATED|ENDED)|GRANT_REVOKED)$/;
const esHistoria = (e: SupportActivityEntry): boolean => e.action.startsWith('engagement.') || e.action === 'grant.revoked' || ASIENTOS_DE_VINCULO.test(e.auditAction);

/**
 * **Revisión periódica** de la organización: los vínculos de apoyo que hay que
 * confirmar —por vencer, vencidos— o que ya se suspendieron por no confirmarse.
 *
 * Cada 6 o 12 meses hay que confirmar que una persona sigue ayudando; sin
 * confirmación, a los 15 días de vencida, el vínculo se **suspende** (no se borra:
 * deja de regir hasta que se lo reactive). Desde acá se confirma de a uno o **en
 * lote**, y también en lote se **quitan los permisos**, que deja el vínculo sin
 * poder actuar. El lote se arma pidiéndole a la API persona por persona: si una
 * falla, las demás siguen y el resumen dice cuáles no se pudieron.
 *
 * El historial lee la bitácora de la organización y deja solo lo que le pasó a los
 * vínculos. Nada de esto autoriza: confirmar, suspender y retirar lo decide la API.
 */
@Component({
  selector: 'app-support-review',
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, ContentDialog, DataTable, PageHeader, Pagination, RouterLink, SegmentedControl, Select, Tab, Tabs],
  templateUrl: './support-review.html',
  styleUrl: './support-review.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportReview implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly dialogs = inject(DialogService);

  protected readonly pestana = signal(0);
  protected readonly state = signal<ViewState<readonly ReviewRow[]>>(loading());
  protected readonly filtro = signal<Filtro>('ALL');
  protected readonly seleccion = signal<readonly ReviewRow[]>([]);
  /** Cambia cada vez que se vuelve a cargar: la tabla no suelta sola lo que se marcó, así que se la recrea. */
  protected readonly generacion = signal(0);
  protected readonly ocupada = signal(false);
  protected readonly resultado = signal<{ readonly tone: 'success' | 'warning' | 'error'; readonly text: string } | null>(null);

  protected readonly confirmandoEnLote = signal(false);
  protected readonly meses = signal<Meses>('KEEP');
  protected readonly opcionesDeMeses = OPCIONES_DE_MESES;

  protected readonly historial = signal<ViewState<readonly SupportActivityEntry[]>>(loading());
  protected readonly pagina = signal(1);
  protected readonly tamano = signal(10);

  private readonly personaCell = viewChild.required<TemplateRef<{ $implicit: ReviewRow }>>('personaCell');
  private readonly alcanceCell = viewChild.required<TemplateRef<{ $implicit: ReviewRow }>>('alcanceCell');
  private readonly vencimientoCell = viewChild.required<TemplateRef<{ $implicit: ReviewRow }>>('vencimientoCell');
  private readonly accionesCell = viewChild.required<TemplateRef<{ $implicit: ReviewRow }>>('accionesCell');
  private readonly cuandoCell = viewChild.required<TemplateRef<{ $implicit: SupportActivityEntry }>>('cuandoCell');
  private readonly queCell = viewChild.required<TemplateRef<{ $implicit: SupportActivityEntry }>>('queCell');

  private readonly todas = computed<readonly ReviewRow[]>(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  protected readonly conteo = computed(() => {
    const filas = this.todas();
    const de = (estado: ReviewStatus): number => filas.filter((f) => f.info.status === estado).length;
    return { all: filas.length, dueSoon: de('DUE_SOON'), overdue: de('OVERDUE'), suspended: de('SUSPENDED') };
  });

  protected readonly filtros = computed<readonly SegmentedOption<Filtro>[]>(() => [
    { value: 'ALL', label: `Todos (${this.conteo().all})` },
    { value: 'DUE_SOON', label: `Por vencer (${this.conteo().dueSoon})` },
    { value: 'OVERDUE', label: `Vencidos (${this.conteo().overdue})` },
    { value: 'SUSPENDED', label: `Suspendidos (${this.conteo().suspended})` },
  ]);

  /** Lo que muestra la tabla según el filtro. */
  protected readonly visibles = computed<ViewState<readonly ReviewRow[]>>(() => {
    const s = this.state();
    if (s.status !== 'ready') return s;
    const filtro = this.filtro();
    const filas = filtro === 'ALL' ? s.data : s.data.filter((f) => f.info.status === filtro);
    return filas.length === 0 ? empty({ label: 'Cambie el filtro para ver otros vínculos' }, 'Ningún vínculo coincide con ese filtro.') : ready(filas);
  });

  protected readonly columnas = computed<readonly ColumnDef<ReviewRow>[]>(() => [
    { key: 'persona', header: 'Persona y rol', priority: 1, cell: this.personaCell() },
    { key: 'vencimiento', header: 'Vencimiento', priority: 1, cell: this.vencimientoCell() },
    { key: 'alcance', header: 'Qué alcanza', priority: 3, cell: this.alcanceCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, accion: true, cell: this.accionesCell() },
  ]);

  protected readonly columnasDeHistorial = computed<readonly ColumnDef<SupportActivityEntry>[]>(() => [
    { key: 'cuando', header: 'Cuándo', priority: 1, cell: this.cuandoCell() },
    { key: 'que', header: 'Qué pasó', priority: 1, cell: this.queCell() },
  ]);

  protected readonly historialDePagina = computed<ViewState<readonly SupportActivityEntry[]>>(() => {
    const h = this.historial();
    if (h.status !== 'ready') return h;
    const desde = (this.pagina() - 1) * this.tamano();
    return ready(h.data.slice(desde, desde + this.tamano()));
  });

  protected readonly totalDeHistorial = computed(() => {
    const h = this.historial();
    return h.status === 'ready' ? h.data.length : 0;
  });

  protected readonly generaciones = computed(() => [this.generacion()]);
  protected readonly rowId = (fila: ReviewRow): string => fila.engagement.id;
  protected readonly rowLabel = (fila: ReviewRow): string => `${fila.engagement.personName}, ${templateLabel(fila.engagement.roleTemplate)}`;
  protected readonly entryId = (e: SupportActivityEntry): string => e.id;

  protected rol = (f: ReviewRow): string => templateLabel(f.engagement.roleTemplate);
  protected alcance = (f: ReviewRow): string => scopeSummary(f.engagement.grants);
  protected estadoTexto = (f: ReviewRow): string => reviewStatusText(f.info.status);
  protected estadoTono = (f: ReviewRow): BadgeVariant => (f.info.status === 'SUSPENDED' ? 'error' : f.info.status === 'OVERDUE' ? 'warning' : f.info.status === 'DUE_SOON' ? 'info' : 'success');
  protected frase = (f: ReviewRow): string => reviewHeadline(f.info);
  protected cuando = formatDateTime;
  protected dia = formatDay;
  protected accionTexto = (e: SupportActivityEntry): string => activityActionLabel(e.action);
  protected botonDeConfirmar = (f: ReviewRow): string => (f.info.status === 'SUSPENDED' ? 'Reactivar' : 'Confirmar');

  protected readonly cantidad = computed(() => this.seleccion().length);
  protected readonly conPermisos = computed(() => this.seleccion().filter((f) => f.engagement.grants.length > 0));

  ngOnInit(): void {
    this.cargar();
    this.cargarHistorial();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.listEngagements().subscribe({
      next: ({ items }) => {
        const filas = sortByUrgency(items.map((engagement) => ({ engagement, info: classifyReview(engagement) })).filter((f) => needsAttention(f.info)));
        this.seleccion.set([]);
        this.generacion.update((g) => g + 1);
        this.state.set(filas.length === 0 ? empty({ label: 'Cuando algo esté por vencer, aparecerá acá' }, 'No hay vínculos por revisar: todos están al día.') : ready(filas));
      },
      error: (failure: unknown) => this.state.set(errorToViewState<readonly ReviewRow[]>(failure)),
    });
  }

  protected cargarHistorial(): void {
    this.historial.set(loading());
    this.client.getOrganizationActivity({ limit: 200 }).subscribe({
      next: ({ items }) => {
        // La API ya entrega lo más reciente primero.
        const historia = items.filter(esHistoria);
        this.pagina.set(1);
        this.historial.set(historia.length === 0 ? empty({ label: 'Cuando se confirme o suspenda un vínculo, quedará acá' }, 'Todavía no hay historia de revisiones.') : ready(historia));
      },
      error: (failure: unknown) => this.historial.set(errorToViewState<readonly SupportActivityEntry[]>(failure)),
    });
  }

  protected cambiarSeleccion(filas: readonly ReviewRow[]): void {
    this.seleccion.set(filas);
  }

  /* ---- de a uno ------------------------------------------------------------ */

  protected async confirmarUno(fila: ReviewRow): Promise<void> {
    if (this.ocupada()) return;
    const reactivar = fila.info.status === 'SUSPENDED';
    const confirmado = await this.dialogs.confirm({
      title: reactivar ? 'Reactivar el vínculo' : 'Confirmar el vínculo',
      message: reactivar
        ? `${fila.engagement.personName} vuelve a poder actuar con los permisos que tenía. El vínculo queda confirmado.`
        : `${fila.engagement.personName} sigue ayudando a la organización. El vínculo queda confirmado y conserva su período.`,
      confirmLabel: reactivar ? 'Reactivar' : 'Confirmar',
    });
    if (!confirmado) return;
    await this.ejecutar(confirmBatch(this.client, [fila.engagement]), 'confirm');
  }

  /* ---- en lote -------------------------------------------------------------- */

  protected abrirConfirmarEnLote(): void {
    if (this.cantidad() === 0) return;
    this.meses.set('KEEP');
    this.confirmandoEnLote.set(true);
  }

  protected cerrarConfirmarEnLote(): void {
    this.confirmandoEnLote.set(false);
  }

  protected cambiarMeses(valor: Meses | null): void {
    if (valor !== null) this.meses.set(valor);
  }

  protected async confirmarEnLote(): Promise<void> {
    const personas = this.seleccion().map((f) => f.engagement);
    const meses = this.meses();
    this.confirmandoEnLote.set(false);
    await this.ejecutar(confirmBatch(this.client, personas, meses === 'KEEP' ? undefined : meses === '6' ? 6 : 12), 'confirm');
  }

  protected async quitarPermisosEnLote(): Promise<void> {
    const personas = this.conPermisos().map((f) => f.engagement);
    if (personas.length === 0 || this.ocupada()) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Quitar los permisos',
      message: `Se quitan todos los permisos de ${personas.length === 1 ? '1 persona' : `${personas.length} personas`}. Su vínculo sigue, pero sin permisos no pueden actuar sobre ninguna agenda. Para volver a darles acceso hay que otorgar los permisos de nuevo.`,
      details: personas.map((p) => ({ label: p.personName, value: `${p.grants.length} ${p.grants.length === 1 ? 'permiso' : 'permisos'}` })),
      confirmLabel: 'Quitar permisos',
      destructive: true,
    });
    if (!confirmado) return;
    await this.ejecutar(revokeBatch(this.client, personas), 'revoke');
  }

  private ejecutar(operacion: ReturnType<typeof confirmBatch>, que: 'confirm' | 'revoke'): Promise<void> {
    this.ocupada.set(true);
    this.resultado.set(null);
    return new Promise((resolver) => {
      operacion.subscribe({
        next: (resultados: readonly BatchOutcome[]) => {
          this.resultado.set(describeBatch(resultados, que));
        },
        error: () => {
          this.ocupada.set(false);
          this.resultado.set({ tone: 'error', text: 'No pudimos completar la operación. Vuelva a intentarlo.' });
          resolver();
        },
        complete: () => {
          this.ocupada.set(false);
          // Se vuelve a leer: lo que queda en pantalla es lo que la API guardó.
          this.cargar();
          this.cargarHistorial();
          resolver();
        },
      });
    });
  }
}
