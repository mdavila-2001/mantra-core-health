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
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { GrantBadges } from './grant-badges/grant-badges';
import {
  daysUntil,
  engagementStatusText,
  engagementStatusTone,
  formatDateTime,
  formatDay,
  originText,
  scopeSummary,
  templateLabel,
} from '../support-labels';

/** Un indicador de gobierno de una persona: siempre con texto (el color solo acompaña). */
export interface TeamIndicator {
  readonly key: string;
  readonly text: string;
  readonly icon: string;
  readonly tone: 'warning' | 'error';
}

/**
 * **Equipo de apoyo**: quién le ayuda a la organización, con qué rol, qué
 * alcanza (resumido) y en qué estado está su vínculo.
 *
 * Desde acá se abre el editor de permisos de cada persona, se confirma su
 * vínculo (recertificación) o se lo termina. Terminarlo es inmediato: sus
 * permisos dejan de regir y las citas que creó se mantienen. Esta pantalla solo
 * pide; el efecto lo decide la API.
 */
@Component({
  selector: 'app-support-team',
  imports: [AppButton, AppButtonLink, Badge, Card, DataTable, GrantBadges, PageHeader, RouterLink],
  templateUrl: './support-team.html',
  styleUrl: './support-team.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTeam implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly governance = inject(AccessGovernanceClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<readonly SupportEngagement[]>>(loading());
  protected readonly ocupada = signal<string | null>(null);
  /** Indicadores de gobierno por vínculo (sin responsable, sin uso, conflicto de funciones, acumulación de permisos). */
  protected readonly indicadores = signal<ReadonlyMap<string, readonly TeamIndicator[]>>(new Map());

  private readonly personaCell =
    viewChild.required<TemplateRef<{ $implicit: SupportEngagement }>>('personaCell');
  private readonly alcanceCell =
    viewChild.required<TemplateRef<{ $implicit: SupportEngagement }>>('alcanceCell');
  private readonly estadoCell =
    viewChild.required<TemplateRef<{ $implicit: SupportEngagement }>>('estadoCell');
  private readonly accionesCell =
    viewChild.required<TemplateRef<{ $implicit: SupportEngagement }>>('accionesCell');

  protected readonly columns = computed<readonly ColumnDef<SupportEngagement>[]>(() => [
    { key: 'persona', header: 'Persona y rol', priority: 1, cell: this.personaCell() },
    { key: 'alcance', header: 'Qué alcanza', priority: 3, cell: this.alcanceCell() },
    { key: 'estado', header: 'Estado', priority: 2, cell: this.estadoCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, accion: true, cell: this.accionesCell() },
  ]);

  protected readonly rowId = (row: SupportEngagement): string => row.id;
  protected readonly rowLabel = (row: SupportEngagement): string =>
    `${row.personName}, ${templateLabel(row.roleTemplate)}`;

  protected rol = (fila: SupportEngagement): string => templateLabel(fila.roleTemplate);
  protected estadoTexto = (fila: SupportEngagement): string => engagementStatusText(fila.status);
  protected estadoTono = (fila: SupportEngagement) => engagementStatusTone(fila.status);
  protected origen = (fila: SupportEngagement): string => originText(fila.origin);
  protected alcance = (fila: SupportEngagement): string => scopeSummary(fila.grants);
  protected dia = formatDay;
  protected fechaHora = formatDateTime;

  /** Los indicadores de una persona: los de los informes de gobierno y la certificación vencida, que sale del propio vínculo. */
  protected indicadoresDe(fila: SupportEngagement): readonly TeamIndicator[] {
    const vencida =
      fila.status === 'ACTIVE' &&
      fila.nextRecertificationAt !== undefined &&
      daysUntil(fila.nextRecertificationAt) < 0
        ? [
            {
              key: 'certificacion-vencida',
              text: 'Certificación vencida',
              icon: '✖',
              tone: 'error' as const,
            },
          ]
        : [];
    return [...(this.indicadores().get(fila.id) ?? []), ...vencida];
  }

  /** La recertificación: si vence pronto se avisa; sin confirmar en 15 días el vínculo se suspende. */
  protected recertificacion(fila: SupportEngagement): string | null {
    if (fila.status !== 'ACTIVE' || fila.nextRecertificationAt === undefined) return null;
    const dias = daysUntil(fila.nextRecertificationAt);
    return dias <= 30
      ? `Hay que confirmar el vínculo antes del ${formatDay(fila.nextRecertificationAt)}.`
      : null;
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.listEngagements().subscribe({
      next: ({ items }) =>
        this.state.set(
          items.length === 0
            ? empty(
                {
                  label: 'Emita una invitación para sumar a alguien',
                  route: '/administration/support-invitations',
                },
                'Todavía no tiene personal de apoyo.',
              )
            : ready(items),
        ),
      error: (failure: unknown) =>
        this.state.set(errorToViewState<readonly SupportEngagement[]>(failure)),
    });
    this.cargarIndicadores();
  }

  /**
   * Los informes de gobierno son un **extra**: si uno falla (sin autoridad, sin conexión), la lista sigue y solo faltan esas
   * insignias. Nunca se inventa un indicador: la API es la que dice quién está sin responsable o en conflicto.
   */
  private cargarIndicadores(): void {
    forkJoin({
      sinDueno: this.governance.getOwnerless().pipe(catchError(() => of(null))),
      sinUso: this.governance.getUnusedAccess().pipe(catchError(() => of(null))),
      conflictos: this.governance.listSodFindings().pipe(catchError(() => of(null))),
      acumulacion: this.governance.getPrivilegeCreep().pipe(catchError(() => of(null))),
    }).subscribe(({ sinDueno, sinUso, conflictos, acumulacion }) => {
      const mapa = new Map<string, TeamIndicator[]>();
      const sumar = (id: string, indicador: TeamIndicator): void => {
        const lista = mapa.get(id) ?? [];
        if (!lista.some((i) => i.key === indicador.key)) mapa.set(id, [...lista, indicador]);
      };
      for (const fila of sinDueno?.items ?? [])
        sumar(fila.engagementId, {
          key: 'sin-responsable',
          text: 'Sin responsable de la cuenta',
          icon: '!',
          tone: 'warning',
        });
      const dias = new Map<string, number>();
      for (const fila of sinUso?.items ?? [])
        dias.set(
          fila.engagementId,
          Math.max(dias.get(fila.engagementId) ?? 0, fila.daysSinceUse ?? 0),
        );
      for (const [id, n] of dias)
        sumar(id, {
          key: 'sin-uso',
          text: n > 0 ? `Sin uso hace ${n} días` : 'Sin uso registrado',
          icon: '!',
          tone: 'warning',
        });
      for (const hallazgo of conflictos?.items ?? [])
        sumar(hallazgo.engagementId, {
          key: 'conflicto',
          text: 'Conflicto de funciones',
          icon: hallazgo.action === 'BLOCK' ? '✖' : '!',
          tone: hallazgo.action === 'BLOCK' ? 'error' : 'warning',
        });
      for (const fila of (acumulacion?.items ?? []).filter((i) => i.flagged))
        sumar(fila.engagementId, {
          key: 'acumulacion',
          text: 'Acumuló permisos',
          icon: '!',
          tone: 'warning',
        });
      this.indicadores.set(mapa);
    });
  }

  protected async recertificar(fila: SupportEngagement): Promise<void> {
    if (this.ocupada() !== null) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Confirmar el vínculo',
      message: `${fila.personName} sigue ayudando a la organización. El vínculo queda confirmado por otros 12 meses.`,
      confirmLabel: 'Confirmar por 12 meses',
    });
    if (!confirmado) return;
    this.ejecutar(fila, this.client.recertify(fila.id, 12), 'Vínculo confirmado.');
  }

  protected async terminar(fila: SupportEngagement): Promise<void> {
    if (this.ocupada() !== null) return;
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Terminar el vínculo',
        message: `${fila.personName} deja de tener acceso ahora mismo. Las citas que creó se mantienen y su gestión pasa a la recepción.`,
        confirmLabel: 'Terminar el vínculo',
        destructive: true,
      },
      { label: 'Motivo', hint: 'Queda en la bitácora de la organización.', minLength: 3 },
    );
    if (motivo === null) return;
    this.ejecutar(fila, this.client.endEngagement(fila.id, motivo), 'El vínculo terminó.');
  }

  private ejecutar(
    fila: SupportEngagement,
    peticion: ReturnType<SupportAccessClient['endEngagement']>,
    hecho: string,
  ): void {
    this.ocupada.set(fila.id);
    peticion.subscribe({
      next: () => {
        this.ocupada.set(null);
        this.toasts.success(hecho);
        this.cargar();
      },
      error: (failure: unknown) => {
        this.ocupada.set(null);
        const estado = errorToViewState<unknown>(failure);
        this.toasts.error(
          'message' in estado && typeof estado.message === 'string'
            ? estado.message
            : 'No pudimos completar la acción.',
        );
      },
    });
  }
}
