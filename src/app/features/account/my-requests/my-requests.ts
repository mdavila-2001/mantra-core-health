import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NavigationService } from '@core/navigation/navigation.service';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  MyClaim,
  MyClaimsView,
  ReceivedClaimOutcome,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState, ViewStateNextAction } from '../../../core/view-state/view-state.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { formatMoney } from '../../insurance/money-format';

const TAMANO_INICIAL = 10;

/** Las dos pestañas: lo que la aseguradora ya decidió y lo que todavía espera. */
export const PESTANAS = ['Decisiones de la aseguradora', 'En espera de decisión'] as const;
const PESTANA_DECIDIDAS = 0;

/** El dictamen, dicho en palabras y con su sello. */
const DECISION: Readonly<Record<ReceivedClaimOutcome, { readonly label: string; readonly seal: StatusSealVariant }>> =
  {
    APPROVED: { label: 'Aprobada', seal: 'approved' },
    PARTIAL: { label: 'Aprobada en parte', seal: 'approved' },
    REJECTED: { label: 'Rechazada', seal: 'rejected' },
  };

/** Estado de una solicitud abierta → sello. */
const SELLO_ABIERTA: Readonly<Record<string, StatusSealVariant>> = {
  SUBMITTED: 'pending',
  IN_REVIEW: 'in-review',
};

const PERIODOS: readonly { readonly value: string; readonly label: string; readonly dias: number }[] = [
  { value: '30', label: 'Últimos 30 días', dias: 30 },
  { value: '90', label: 'Últimos 90 días', dias: 90 },
  { value: '180', label: 'Últimos 180 días', dias: 180 },
];

const SUBTITULO: Readonly<Record<MyClaimsView, string>> = {
  PATIENT: 'Lo que su aseguradora decidió sobre sus consultas y estudios: si los cubre, cuánto y por qué.',
  PRACTITIONER: 'Lo que las aseguradoras decidieron sobre las atenciones que presentó: cuánto cubren y por qué.',
  LABORATORY: 'Lo que las aseguradoras decidieron sobre los análisis que hizo su laboratorio.',
  IMAGING: 'Lo que las aseguradoras decidieron sobre los estudios de imagen que hizo su centro.',
  NONE: 'Las solicitudes a aseguradoras y lo que cada una decidió.',
};

/** El vacío de cada pestaña, según de qué lado mira la cuenta. */
function vacioDe(vista: MyClaimsView, pestana: number): { readonly accion: ViewStateNextAction; readonly texto: string } {
  const panel: ViewStateNextAction = { label: 'Volver al panel', route: '/dashboard' };
  if (vista === 'NONE') {
    return { accion: panel, texto: 'Su cuenta no presenta solicitudes a aseguradoras, así que no hay decisiones que mostrar.' };
  }
  if (pestana === PESTANA_DECIDIDAS) {
    return {
      accion: panel,
      texto:
        'Todavía no hay decisiones de la aseguradora. Cuando apruebe, apruebe en parte o rechace una solicitud, aparece acá con su motivo.',
    };
  }
  return { accion: panel, texto: 'No hay solicitudes esperando decisión: la aseguradora ya respondió todas.' };
}

/**
 * **Mis solicitudes** (propietario, 01/10/2026): las solicitudes de seguro de
 * quien mira y lo que decidió la aseguradora, para el paciente, el médico, el
 * laboratorio y el centro de imagenología.
 *
 * Lee la misma solicitud que la aseguradora dictamina en «Solicitudes
 * recibidas»: un dictamen tomado allá aparece acá en la próxima lectura. De
 * qué lado mira cada cuenta lo decide el servidor (`view`): la pantalla sólo
 * cambia el texto y la columna de la contraparte.
 *
 * Una tarjeta a lo ancho con dos pestañas (regla de la casa,
 * `composition-rules.md` §5); cada una con buscador, filtros, tabla con scroll
 * vertical y paginación (ADR-0015). El motivo de la decisión se lee en un
 * modal.
 */
@Component({
  selector: 'app-my-requests',
  imports: [
    Alert,
    Card,
    ContentDialog,
    DataTable,
    FilterBar,
    NgTemplateOutlet,
    PageHeader,
    Pagination,
    RowActions,
    StatusSeal,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './my-requests.html',
  styleUrl: './my-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyRequests {
  private readonly client = inject(InsuranceClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly pestanas = PESTANAS;
  protected readonly formatMoney = formatMoney;

  protected readonly estado = signal<ViewState<readonly MyClaim[]>>(loading());
  protected readonly vista = signal<MyClaimsView>('NONE');
  protected readonly truncada = signal(false);
  protected readonly subtitulo = computed(() => SUBTITULO[this.vista()]);

  protected readonly pestana = signal(PESTANA_DECIDIDAS);
  protected readonly q = signal('');
  protected readonly filtroResultado = signal<string | null>(null);
  protected readonly filtroPeriodo = signal<string | null>(null);
  protected readonly pagina = signal(1);
  protected readonly tamano = signal(TAMANO_INICIAL);

  protected readonly abierta = signal<MyClaim | null>(null);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.client
      .listMyClaims()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          this.vista.set(lista.view);
          this.truncada.set(lista.truncated);
          this.estado.set(ready(lista.items));
        },
        error: (error: unknown) => this.estado.set(errorToViewState<readonly MyClaim[]>(error)),
      });
  }

  protected elegirPestana(indice: number): void {
    this.pestana.set(indice);
    this.filtroResultado.set(null);
    this.pagina.set(1);
  }

  private readonly todas = computed<readonly MyClaim[]>(() => {
    const estado = this.estado();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected readonly decididas = computed(() => this.todas().filter((s) => s.decision !== null));
  protected readonly enEspera = computed(() => this.todas().filter((s) => s.decision === null));

  /** Lo de la pestaña activa, antes de buscar y filtrar. */
  private readonly delaPestana = computed(() =>
    this.pestana() === PESTANA_DECIDIDAS ? this.decididas() : this.enEspera(),
  );

  /** El estado de la pestaña: el de la carga, o su propio vacío. */
  protected readonly estadoDePestana = computed<ViewState<readonly MyClaim[]>>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return actual;
    const filas = this.delaPestana();
    if (filas.length > 0) return ready(filas);
    const { accion, texto } = vacioDe(this.vista(), this.pestana());
    return empty(accion, texto);
  });

  /** Sólo los resultados que existen en la pestaña (C9 §4). */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const periodo: FilterDef = {
      key: 'periodo',
      label: 'Período',
      placeholder: 'Desde siempre',
      options: PERIODOS.map((p) => ({ value: p.value, label: p.label })),
    };
    if (this.pestana() !== PESTANA_DECIDIDAS) return [periodo];
    const resultados = [...new Set(this.decididas().map((s) => s.decision!.outcome))];
    return [
      {
        key: 'resultado',
        label: 'Decisión',
        placeholder: 'Todas las decisiones',
        options: resultados.map((value) => ({ value, label: DECISION[value].label })),
      },
      periodo,
    ];
  });

  protected onFiltrosCambiaron(activos: Readonly<Record<string, string>>): void {
    this.q.set(activos['q'] ?? '');
    this.filtroResultado.set(activos['resultado'] ?? null);
    this.filtroPeriodo.set(activos['periodo'] ?? null);
    this.pagina.set(1);
  }

  /** Buscador multicampo, sin acentos ni mayúsculas. */
  protected readonly filasFiltradas = computed<readonly MyClaim[]>(() => {
    const termino = normalizarTexto(this.q().trim());
    const resultado = this.filtroResultado();
    const dias = PERIODOS.find((p) => p.value === this.filtroPeriodo())?.dias ?? null;
    const ahora = Date.now();
    return this.delaPestana().filter((s) => {
      if (resultado !== null && s.decision?.outcome !== resultado) return false;
      const referencia = s.decision?.decidedAt ?? s.submittedAt;
      if (dias !== null && (referencia === null || (ahora - referencia.getTime()) / 86_400_000 > dias)) return false;
      if (termino === '') return true;
      const campos = [
        s.claimIdentifier,
        s.service?.display ?? '',
        s.patientName ?? '',
        s.practitioner?.displayName ?? '',
        s.providerName,
        s.insurerName,
        s.decision === null ? (s.status?.display ?? '') : DECISION[s.decision.outcome].label,
        s.decision?.reason ?? '',
      ];
      return campos.some((campo) => normalizarTexto(campo).includes(termino));
    });
  });

  protected readonly totalFiltrado = computed(() => this.filasFiltradas().length);

  protected readonly filasDeTabla = computed<ViewState<readonly MyClaim[]>>(() => {
    const inicio = (this.pagina() - 1) * this.tamano();
    return ready(this.filasFiltradas().slice(inicio, inicio + this.tamano()));
  });

  /* ---- columnas --------------------------------------------------------------- */

  private readonly celdaSolicitud = viewChild.required<TemplateRef<{ $implicit: MyClaim }>>('celdaSolicitud');
  private readonly celdaContraparte = viewChild.required<TemplateRef<{ $implicit: MyClaim }>>('celdaContraparte');
  private readonly celdaAseguradora = viewChild.required<TemplateRef<{ $implicit: MyClaim }>>('celdaAseguradora');
  private readonly celdaMontos = viewChild.required<TemplateRef<{ $implicit: MyClaim }>>('celdaMontos');
  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: MyClaim }>>('celdaEstado');
  private readonly celdaAcciones = viewChild.required<TemplateRef<{ $implicit: MyClaim }>>('celdaAcciones');

  /** Quién es «el otro» de cada fila, según de qué lado mira la cuenta. */
  protected readonly encabezadoContraparte = computed(() => {
    switch (this.vista()) {
      case 'PATIENT':
        return 'Médico';
      case 'PRACTITIONER':
        return 'Paciente';
      default:
        return 'Paciente y médico';
    }
  });

  protected readonly columnas = computed<readonly ColumnDef<MyClaim>[]>(() => {
    const decididas = this.pestana() === PESTANA_DECIDIDAS;
    // En pantalla angosta quedan la solicitud, la decisión y las acciones; el
    // resto se pliega al detalle de la fila.
    return [
      { key: 'solicitud', header: 'Solicitud', priority: 1, cell: this.celdaSolicitud() },
      { key: 'contraparte', header: this.encabezadoContraparte(), priority: 2, cell: this.celdaContraparte() },
      { key: 'aseguradora', header: 'Aseguradora', priority: 2, cell: this.celdaAseguradora() },
      {
        key: 'montos',
        header: decididas ? 'Solicitado / aprobado' : 'Solicitado',
        priority: 2,
        align: 'end',
        cell: this.celdaMontos(),
      },
      { key: 'estado', header: decididas ? 'Decisión' : 'Estado', priority: 1, cell: this.celdaEstado() },
      { key: 'acciones', header: 'Acciones', priority: 1, cell: this.celdaAcciones() },
    ];
  });

  protected readonly porId = (fila: MyClaim): string => fila.id;
  protected readonly nombreDeFila = (fila: MyClaim): string =>
    `Solicitud ${fila.claimIdentifier} · ${fila.service?.display ?? 'Sin servicio'}`;

  protected rotuloDecision(fila: MyClaim): string {
    return fila.decision === null ? '' : DECISION[fila.decision.outcome].label;
  }

  protected selloDe(fila: MyClaim): StatusSealVariant {
    if (fila.decision !== null) return DECISION[fila.decision.outcome].seal;
    return SELLO_ABIERTA[fila.status?.code ?? ''] ?? 'unknown';
  }

  protected accionesDe(fila: MyClaim): readonly RowAction[] {
    return [{ code: 'ver', label: fila.decision === null ? 'Ver solicitud' : 'Ver decisión', icon: 'eye' }];
  }

  protected ejecutarAccion(codigo: string, fila: MyClaim): void {
    if (codigo === 'ver') this.abierta.set(fila);
  }

  protected cerrar(): void {
    this.abierta.set(null);
  }
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
