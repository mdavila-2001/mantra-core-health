import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  SupportActionCode,
  SupportEngagementRequest,
  SupportRequestItem,
  SupportRequestStatus,
  SupportRoleTemplateCode,
} from '../../../core/data-access/support-access/support-access.types';
import { describeActions } from '../../../core/data-access/support-access/support-summary';
import {
  AGE_BUCKETS,
  AGE_BUCKET_LABELS,
  countByView,
  effectiveStatus,
  filterRequests,
  isUrgent,
  requesters,
  type AgeBucket,
  type RequestFilters,
} from '../../../core/data-access/support-access/support-request-filters';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { SUPPORT_ROLE_TEMPLATE_CODES } from '../../../core/data-access/support-access/support-access.types';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { SupportActionPicker } from '../support-action-picker/support-action-picker';
import {
  expiryText,
  formatDay,
  itemDecisionText,
  itemDecisionTone,
  requestStatusText,
  requestStatusTone,
  templateLabel,
} from '../support-labels';
import { approveAll, buildDecision, initialDrafts, type ItemDraft, type RequestDrafts } from './request-decision';

type Vista = 'PENDING' | 'RESOLVED';

const ESTADOS: readonly SupportRequestStatus[] = ['PENDING', 'APPROVED', 'PARTIAL', 'REJECTED', 'EXPIRED', 'CANCELLED'];

const VISTAS: readonly SegmentedOption<Vista>[] = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'RESOLVED', label: 'Resueltas' },
];

/** `''` es «todavía sin decidir»: el control segmentado admite que ninguna opción esté marcada. */
type OpcionDeDecision = 'APPROVED' | 'ADJUSTED' | 'REJECTED' | '';

const DECISIONES: readonly SegmentedOption<OpcionDeDecision>[] = [
  { value: 'APPROVED', label: 'Aprobar' },
  { value: 'ADJUSTED', label: 'Ajustar' },
  { value: 'REJECTED', label: 'Rechazar' },
];

/**
 * **Solicitudes de apoyo**: la bandeja donde la organización decide, ítem por
 * ítem, lo que pide su personal.
 *
 * Una solicitud puede traer varios permisos (un doctor, un servicio, una
 * ubicación…). Cada uno se **aprueba** tal como se pidió, se **ajusta** (se
 * conceden menos acciones) o se **rechaza** con motivo; así una misma solicitud
 * puede quedar aprobada en parte. Nada se aplica hasta «Guardar decisión», y la
 * API vuelve a validar todo: esta pantalla no concede nada por su cuenta.
 */
@Component({
  selector: 'app-support-requests',
  imports: [Alert, AppButton, Badge, Card, FilterBar, FormField, PageHeader, Pagination, SegmentedControl, SupportActionPicker, Textarea, ViewStateHost],
  templateUrl: './support-requests.html',
  styleUrl: './support-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportRequests implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly vistas = VISTAS;
  protected readonly decisiones = DECISIONES;
  protected readonly vista = signal<Vista>('PENDING');
  protected readonly state = signal<ViewState<readonly SupportEngagementRequest[]>>(loading());
  /** El borrador de cada solicitud, por su id. */
  protected readonly borradores = signal<Readonly<Record<string, RequestDrafts>>>({});
  protected readonly motivos = signal<Readonly<Record<string, string>>>({});
  /** Qué solicitud tiene el intento de guardado a la vista (para mostrar lo que falta). */
  protected readonly intentadas = signal<ReadonlySet<string>>(new Set());
  protected readonly guardando = signal<string | null>(null);
  protected readonly falloDeGuardado = signal<string | null>(null);

  private readonly todas = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  /* ---- filtros: viven en la URL, la barra los escribe y acá se leen --------- */

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly pagina = signal(1);
  protected readonly tamano = signal(5);

  protected readonly filtros = computed<RequestFilters>(() => {
    const p = this.params();
    const persona = p.get('persona');
    const rol = p.get('rol');
    const estado = p.get('estado');
    const antiguedad = p.get('antiguedad');
    return {
      ...(persona === null || persona === '' ? {} : { person: persona }),
      ...(rol !== null && (SUPPORT_ROLE_TEMPLATE_CODES as readonly string[]).includes(rol) ? { role: rol as SupportRoleTemplateCode } : {}),
      ...(estado !== null && ESTADOS.includes(estado as SupportRequestStatus) ? { status: estado as SupportRequestStatus } : {}),
      ...(antiguedad !== null && (AGE_BUCKETS as readonly string[]).includes(antiguedad) ? { age: antiguedad as AgeBucket } : {}),
    };
  });

  protected readonly opcionesDeFiltro = computed<readonly FilterDef[]>(() => [
    { key: 'persona', label: 'Persona', placeholder: 'Todas las personas', options: requesters(this.todas()).map((p) => ({ value: p.id, label: p.name })) },
    { key: 'rol', label: 'Rol', placeholder: 'Todos los roles', options: SUPPORT_ROLE_TEMPLATE_CODES.map((c) => ({ value: c, label: templateLabel(c) })) },
    { key: 'estado', label: 'Estado', placeholder: 'Todos los estados', options: ESTADOS.map((e) => ({ value: e, label: requestStatusText(e) })) },
    { key: 'antiguedad', label: 'Antigüedad', placeholder: 'Cualquier antigüedad', options: AGE_BUCKETS.map((b) => ({ value: b, label: AGE_BUCKET_LABELS[b] })) },
  ]);

  /** Todo lo que cumple los filtros, antes de separar en pendientes y resueltas. */
  private readonly filtradas = computed(() => filterRequests(this.todas(), { ...this.filtros(), status: undefined } as RequestFilters));

  /**
   * La vista que rige: elegir un estado concreto en los filtros manda a la que le
   * corresponde (esperando decisión → pendientes; cualquier otro → resueltas).
   */
  protected readonly vistaEfectiva = computed<Vista>(() => {
    const estado = this.filtros().status;
    return estado === undefined ? this.vista() : estado === 'PENDING' ? 'PENDING' : 'RESOLVED';
  });

  private readonly delaVista = computed(() => {
    const estado = this.filtros().status;
    const pendiente = this.vistaEfectiva() === 'PENDING';
    return this.filtradas().filter((r) => {
      const efectivo = effectiveStatus(r);
      return (pendiente ? efectivo === 'PENDING' : efectivo !== 'PENDING') && (estado === undefined || efectivo === estado);
    });
  });

  protected readonly totalVisible = computed(() => this.delaVista().length);
  /** No hay ningún filtro puesto: lo vacío es de verdad vacío y no un resultado de filtrar. */
  protected readonly todasSinFiltro = computed(() => Object.keys(this.filtros()).length === 0);
  protected readonly visibles = computed(() => {
    const desde = (this.pagina() - 1) * this.tamano();
    return this.delaVista().slice(desde, desde + this.tamano());
  });

  protected readonly vistasConConteo = computed<readonly SegmentedOption<Vista>[]>(() => {
    const { pending, resolved } = countByView(this.filtradas());
    return [
      { value: 'PENDING', label: `Pendientes (${pending})` },
      { value: 'RESOLVED', label: `Resueltas (${resolved})` },
    ];
  });

  /** Cambió un filtro (ya está en la URL): se vuelve a la primera página. */
  protected filtrosCambiaron(): void {
    this.pagina.set(1);
  }

  protected cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    this.pagina.set(1);
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.listRequests().subscribe({
      next: ({ items }) => {
        const nuevos = { ...this.borradores() };
        for (const solicitud of items) {
          if (solicitud.status === 'PENDING' && nuevos[solicitud.id] === undefined) {
            nuevos[solicitud.id] = initialDrafts(solicitud);
          }
        }
        this.borradores.set(nuevos);
        this.state.set(
          items.length === 0
            ? empty({ label: 'Cuando alguien pida acceso, aparecerá acá' }, 'No hay solicitudes.')
            : ready(items),
        );
      },
      error: (failure: unknown) =>
        this.state.set(errorToViewState<readonly SupportEngagementRequest[]>(failure)),
    });
  }

  /* ---- lectura ------------------------------------------------------------- */

  protected plantilla(solicitud: SupportEngagementRequest): string {
    return templateLabel(solicitud.roleTemplate);
  }
  protected estadoTexto = requestStatusText;
  protected estadoTono = requestStatusTone;
  /** El estado que se muestra: una pendiente que ya pasó su plazo es «vencida» aunque la API todavía no la haya marcado. */
  protected estadoDe = (solicitud: SupportEngagementRequest): SupportRequestStatus => effectiveStatus(solicitud);
  protected esPendiente = (solicitud: SupportEngagementRequest): boolean => effectiveStatus(solicitud) === 'PENDING';
  protected esVencida = (solicitud: SupportEngagementRequest): boolean => effectiveStatus(solicitud) === 'EXPIRED';
  protected esUrgente = (solicitud: SupportEngagementRequest): boolean => isUrgent(solicitud);
  protected decisionTexto = itemDecisionText;
  protected decisionTono = itemDecisionTone;
  protected dia = formatDay;

  protected vence(solicitud: SupportEngagementRequest): string {
    return expiryText(solicitud.expiresAt);
  }

  /** Cómo se llama el objetivo de un ítem: lo que ve quien decide. */
  protected nombreDelItem(item: SupportRequestItem): string {
    switch (item.targetKind) {
      case 'PRACTITIONER':
        return item.practitionerName ?? 'Un doctor';
      case 'SERVICE':
        return `Servicio · ${item.serviceName ?? 'un servicio'}`;
      case 'LOCATION':
        return item.locationName ?? 'Una ubicación';
      case 'PRACTITIONER_SERVICE':
        return `${item.practitionerName ?? 'Doctor'} solo para ${item.serviceName ?? 'un servicio'}`;
      case 'PRACTITIONER_LOCATION':
        return `${item.practitionerName ?? 'Doctor'} solo en ${item.locationName ?? 'una ubicación'}`;
      case 'SERVICE_LOCATION':
        return `${item.serviceName ?? 'Servicio'} solo en ${item.locationName ?? 'una ubicación'}`;
      case 'ALL_PRACTITIONERS':
        return 'Todos los doctores';
      case 'ALL_SERVICES':
        return 'Todos los servicios';
      case 'ALL_LOCATIONS':
        return 'Todas las ubicaciones';
      case 'ALL':
        return 'Toda la organización';
    }
  }

  protected accionesTexto(acciones: readonly SupportActionCode[]): string {
    const texto = describeActions(acciones);
    return texto === '' ? 'ninguna acción' : texto;
  }

  protected borrador(solicitud: SupportEngagementRequest, item: SupportRequestItem): ItemDraft {
    return this.borradores()[solicitud.id]?.[item.id] ?? { actions: item.proposedActions, comment: '' };
  }

  protected faltantes(solicitud: SupportEngagementRequest): readonly string[] {
    return this.verificar(solicitud).problems;
  }

  protected mostrarFaltantes(solicitud: SupportEngagementRequest): boolean {
    return this.intentadas().has(solicitud.id);
  }

  protected motivoGeneral(solicitud: SupportEngagementRequest): string {
    return this.motivos()[solicitud.id] ?? '';
  }

  /* ---- edición del borrador ------------------------------------------------ */

  protected decidir(solicitud: SupportEngagementRequest, item: SupportRequestItem, decision: OpcionDeDecision): void {
    if (decision === '') return;
    this.cambiar(solicitud, item, { decision });
  }

  protected decisionActual(solicitud: SupportEngagementRequest, item: SupportRequestItem): OpcionDeDecision {
    return this.borrador(solicitud, item).decision ?? '';
  }

  protected ajustarAcciones(solicitud: SupportEngagementRequest, item: SupportRequestItem, actions: readonly SupportActionCode[]): void {
    this.cambiar(solicitud, item, { actions });
  }

  protected escribirComentario(solicitud: SupportEngagementRequest, item: SupportRequestItem, comment: string): void {
    this.cambiar(solicitud, item, { comment });
  }

  protected escribirMotivo(solicitud: SupportEngagementRequest, valor: string | null | undefined): void {
    this.motivos.update((actual) => ({ ...actual, [solicitud.id]: valor ?? '' }));
  }

  protected aprobarTodo(solicitud: SupportEngagementRequest): void {
    this.borradores.update((actual) => ({
      ...actual,
      [solicitud.id]: approveAll(solicitud, actual[solicitud.id] ?? initialDrafts(solicitud)),
    }));
  }

  private cambiar(solicitud: SupportEngagementRequest, item: SupportRequestItem, cambios: Partial<ItemDraft>): void {
    this.borradores.update((actual) => {
      const delaSolicitud = actual[solicitud.id] ?? initialDrafts(solicitud);
      const previo = delaSolicitud[item.id] ?? { actions: item.proposedActions, comment: '' };
      return { ...actual, [solicitud.id]: { ...delaSolicitud, [item.id]: { ...previo, ...cambios } } };
    });
  }

  /* ---- guardar ------------------------------------------------------------- */

  private verificar(solicitud: SupportEngagementRequest) {
    return buildDecision(
      solicitud,
      this.borradores()[solicitud.id] ?? initialDrafts(solicitud),
      (itemId) => {
        const item = solicitud.items.find((x) => x.id === itemId);
        return item === undefined ? 'un ítem' : this.nombreDelItem(item);
      },
      this.motivoGeneral(solicitud),
    );
  }

  protected guardar(solicitud: SupportEngagementRequest): void {
    if (this.guardando() !== null) return;
    this.intentadas.update((actual) => new Set([...actual, solicitud.id]));
    const { decision } = this.verificar(solicitud);
    if (decision === null) return;
    this.guardando.set(solicitud.id);
    this.falloDeGuardado.set(null);
    this.client.decideRequest(solicitud.id, decision).subscribe({
      next: (resuelta) => {
        this.guardando.set(null);
        // La API responde cómo quedó (`status`), no la solicitud: lo del doctor sale de lo que se decidió.
        const rechazados = new Set(decision.items.filter((i) => i.decision === 'REJECTED').map((i) => i.itemId));
        const nombraDoctor = solicitud.items.some((i) => i.practitionerName !== undefined && !rechazados.has(i.id));
        this.toasts.success(
          `Solicitud de ${solicitud.requesterName}: ${requestStatusText(resuelta.status).toLocaleLowerCase('es')}.`,
          nombraDoctor ? 'Cada doctor nombrado tiene que aceptar a la persona una vez.' : undefined,
        );
        this.cargar();
      },
      error: (failure: unknown) => {
        this.guardando.set(null);
        const estado = errorToViewState<unknown>(failure);
        this.falloDeGuardado.set(
          'message' in estado && typeof estado.message === 'string' ? estado.message : 'No pudimos guardar la decisión. Vuelva a intentarlo.',
        );
      },
    });
  }
}
