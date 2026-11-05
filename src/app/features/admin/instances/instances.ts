import { DatePipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import { OpsLivenessClient } from '../../../core/data-access/admin-portal/ops-liveness.client';
import type { Instance, InstanceLiveness } from '../../../core/data-access/admin-portal/ops-liveness.types';
import { OpsToolsClient } from '../../../core/data-access/admin-portal/ops-tools.client';
import type { OpsTools, Tool } from '../../../core/data-access/admin-portal/ops-tools.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { entero } from '../platform/platform-labels';
import {
  CAUSAS,
  CHEQUEOS,
  ESTADO_GENERAL,
  ESTADOS_DE_CATALOGO,
  ESTADOS_DE_INSTANCIA,
  ESTADOS_VIVOS,
  NO_MEDIDO,
  TIPOS_DE_HERRAMIENTA,
  TIPOS_DE_INSTANCIA,
  VINCULOS,
  estadoVivo,
  haceCuanto,
  queDice,
  segundosEntre,
  type Chip,
  type EstadoVivo,
} from './instances-labels';

/** Cada cuánto se vuelve a pedir, salvo que la persona prefiera movimiento reducido. */
export const INTERVALO_DE_REFRESCO_MS = 30_000;

/** Pasado esto desde `evaluatedAt`, el dato se declara atrasado (S7) y no fresco. */
const ATRASADO_TRAS_MS = 2 * INTERVALO_DE_REFRESCO_MS;

type Criticidad = 'todas' | 'criticas' | 'no-criticas';
type FiltroVivo = 'todos' | EstadoVivo;

/** Una fila de la tabla de instancias, ya en palabras: la tabla sólo la pinta. */
export interface FilaInstancia {
  readonly id: string;
  readonly label: string;
  readonly tipo: string;
  readonly requerida: string;
  readonly estado: Chip;
  readonly ultimoLatido: string | null;
  readonly antiguedad: string;
  readonly causa: string;
  readonly detalle: string;
  readonly fuente: string;
}

/** Una fila de la tabla de herramientas, al estilo Atlas. */
export interface FilaHerramienta {
  readonly code: string;
  readonly name: string;
  readonly tipo: string;
  readonly vivo: EstadoVivo;
  readonly estadoVivo: Chip;
  readonly catalogo: string;
  readonly critica: boolean;
  readonly vinculo: string;
  readonly chequeo: string;
  readonly queDice: string;
  readonly latencia: string;
}

type CeldaInstancia = TemplateRef<{ $implicit: FilaInstancia }>;
type CeldaHerramienta = TemplateRef<{ $implicit: FilaHerramienta }>;

/**
 * Instancias y herramientas de la plataforma, como en el portal de Atlas:
 * qué procesos hay (API, workers, bases, servicios) y si cada uno tiene vida
 * según la sonda; y qué herramientas externas usa la API, si están
 * configuradas y si respondieron. Los dos juicios los hace el servidor; acá se
 * muestran con su antigüedad, y lo que la sonda no cubre se declara como «no
 * medido», nunca como vivo.
 */
@Component({
  selector: 'app-instances',
  imports: [DatePipe, AppButton, Badge, Alert, Card, SegmentedControl, Tabs, Tab, DataTable, PageHeader, ViewStateHost],
  templateUrl: './instances.html',
  styleUrl: './instances.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Instances {
  private readonly livenessClient = inject(OpsLivenessClient);
  private readonly toolsClient = inject(OpsToolsClient);
  private readonly documento = inject(DOCUMENT);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly entero = entero;
  protected readonly noMedido = (clave: string): string => NO_MEDIDO[clave] ?? clave;

  protected readonly pestana = signal(0);
  protected readonly criticidad = signal<Criticidad>('todas');
  protected readonly filtroVivo = signal<FiltroVivo>('todos');
  protected readonly opcionesCriticidad = [
    { value: 'todas' as const, label: 'Todas' },
    { value: 'criticas' as const, label: 'Críticas' },
    { value: 'no-criticas' as const, label: 'No críticas' },
  ];
  protected readonly opcionesVivo = [
    { value: 'todos' as const, label: 'Todos' },
    { value: 'UP' as const, label: 'Operativas' },
    { value: 'DOWN' as const, label: 'Caídas' },
    { value: 'NO_PROBE' as const, label: 'Sin chequeo' },
    { value: 'NOT_APPLICABLE' as const, label: 'No aplican' },
  ];

  /** Reloj de la última carga: contra él se mide la antigüedad de cada dato. */
  protected readonly ahora = signal(Date.now());
  protected readonly sonda = signal<ViewState<InstanceLiveness>>(loading());
  protected readonly herramientas = signal<ViewState<OpsTools>>(loading());

  /** Si el dato tiene más de dos refrescos de edad, se dice (S7); sin instancias, se dice por qué (S3). */
  protected readonly estadoSonda = computed<ViewState<InstanceLiveness>>(() => {
    const estado = this.sonda();
    if (estado.status !== 'ready') return estado;
    if (estado.data.instances.length === 0) {
      return empty(
        { label: 'Pida a quien opera la API que registre las instancias esperadas.' },
        'La sonda no tiene instancias registradas que vigilar.',
      );
    }
    return this.conAntiguedad(estado.data, estado.data.evaluatedAt);
  });

  /** Siempre `ready` o un estado sin datos: la antigüedad (S7) la anuncia el anfitrión, una sola vez. */
  protected readonly filasInstancias = computed<ViewState<readonly FilaInstancia[]>>(() => {
    const estado = this.estadoSonda();
    if (estado.status !== 'ready' && estado.status !== 'stale') return estado;
    return ready(estado.data.instances.map((i) => this.filaInstancia(i, estado.data)));
  });

  protected readonly estadoHerramientas = computed<ViewState<OpsTools>>(() => {
    const estado = this.herramientas();
    if (estado.status !== 'ready') return estado;
    if (estado.data.tools.length === 0) {
      return empty(
        { label: 'Pida a quien opera la API que cargue el catálogo de herramientas.' },
        'El catálogo de herramientas está vacío.',
      );
    }
    return this.conAntiguedad(estado.data, estado.data.evaluatedAt);
  });

  /** Las filas que pasan los dos filtros; sin ninguna, un vacío que dice cómo salir. */
  protected readonly filasHerramientas = computed<ViewState<readonly FilaHerramienta[]>>(() => {
    const estado = this.estadoHerramientas();
    if (estado.status !== 'ready' && estado.status !== 'stale') return estado;
    const criticidad = this.criticidad();
    const vivo = this.filtroVivo();
    const filas = estado.data.tools
      .filter((t) => criticidad === 'todas' || (criticidad === 'criticas') === t.isCritical)
      .filter((t) => vivo === 'todos' || estadoVivo(t) === vivo)
      .map((t) => this.filaHerramienta(t));
    if (filas.length === 0) {
      return empty({ label: 'Elija «Todas» y «Todos» para ver la lista completa.' }, 'Ninguna herramienta coincide con los filtros.');
    }
    return ready(filas);
  });

  /** Herramientas caídas, separadas por criticidad: las críticas van al banner rojo. */
  protected readonly caidasCriticas = computed<readonly Tool[]>(() => this.caidas().filter((t) => t.isCritical));
  protected readonly caidasNoCriticas = computed<readonly Tool[]>(() => this.caidas().filter((t) => !t.isCritical));

  /** Instancias caídas que son obligatorias: el detalle del banner de la sonda. */
  protected readonly instanciasCaidas = computed<readonly Instance[]>(() => {
    const s = this.sonda();
    return s.status === 'ready' ? s.data.instances.filter((i) => i.state === 'CAIDA') : [];
  });

  private readonly estadoInstanciaCell = viewChild<CeldaInstancia>('estadoInstanciaCell');
  private readonly instanciaCell = viewChild<CeldaInstancia>('instanciaCell');
  private readonly latidoCell = viewChild<CeldaInstancia>('latidoCell');
  private readonly causaCell = viewChild<CeldaInstancia>('causaCell');
  private readonly herramientaCell = viewChild<CeldaHerramienta>('herramientaCell');
  private readonly vivoCell = viewChild<CeldaHerramienta>('vivoCell');
  private readonly criticaCell = viewChild<CeldaHerramienta>('criticaCell');

  protected readonly columnasInstancias = computed<readonly ColumnDef<FilaInstancia>[]>(() => [
    { key: 'label', header: 'Instancia', priority: 1, cell: this.instanciaCell() },
    { key: 'tipo', header: 'Tipo', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.estadoInstanciaCell() },
    { key: 'ultimoLatido', header: 'Último latido', priority: 2, cell: this.latidoCell() },
    { key: 'antiguedad', header: 'Antigüedad', priority: 2 },
    { key: 'causa', header: 'Causa', priority: 1, cell: this.causaCell() },
  ]);

  protected readonly columnasHerramientas = computed<readonly ColumnDef<FilaHerramienta>[]>(() => [
    { key: 'name', header: 'Herramienta', priority: 1, cell: this.herramientaCell() },
    { key: 'estadoVivo', header: 'Estado en vivo', priority: 1, cell: this.vivoCell() },
    { key: 'catalogo', header: 'Catálogo', priority: 3 },
    { key: 'critica', header: 'Crítica', priority: 2, cell: this.criticaCell() },
    { key: 'vinculo', header: 'Vínculo', priority: 3 },
    { key: 'chequeo', header: 'Chequeo', priority: 3 },
    { key: 'queDice', header: 'Qué dice', priority: 1 },
  ]);

  protected readonly porIdInstancia = (f: FilaInstancia): string => f.id;
  protected readonly porCodigo = (f: FilaHerramienta): string => f.code;
  protected readonly nombreDeInstancia = (f: FilaInstancia): string => f.label;
  protected readonly nombreDeHerramienta = (f: FilaHerramienta): string => f.name;

  constructor() {
    this.cargar();
    this.programarRefresco();
  }

  protected cargar(): void {
    this.ahora.set(Date.now());
    this.sonda.set(loading());
    this.herramientas.set(loading());
    this.livenessClient.liveness().subscribe({
      next: (r) => {
        this.ahora.set(Date.now());
        this.sonda.set(ready(r));
      },
      error: (e: unknown) => this.sonda.set(errorToViewState<InstanceLiveness>(e)),
    });
    this.toolsClient.tools().subscribe({
      next: (r) => {
        this.ahora.set(Date.now());
        this.herramientas.set(ready(r));
      },
      error: (e: unknown) => this.herramientas.set(errorToViewState<OpsTools>(e)),
    });
  }

  /** Antigüedad del dato en palabras, contra el reloj de la última carga. */
  protected antiguedadDe(evaluatedAt: string): string {
    return haceCuanto(segundosEntre(evaluatedAt, this.ahora()));
  }

  protected chipGeneral(data: InstanceLiveness): Chip {
    return ESTADO_GENERAL[data.overall];
  }

  /**
   * Refresco periódico: 30 s, como el monitor de Atlas. Con `prefers-reduced-motion`
   * la pantalla no cambia sola —la persona pidió quietud— y queda el botón
   * «Actualizar». El temporizador muere con el componente. En el servidor
   * (SSR) no hay ventana ni sentido en programarlo.
   */
  private programarRefresco(): void {
    const ventana = this.documento.defaultView;
    if (!ventana || typeof ventana.setInterval !== 'function') return;
    if (ventana.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = ventana.setInterval(() => this.cargar(), INTERVALO_DE_REFRESCO_MS);
    inject(DestroyRef).onDestroy(() => ventana.clearInterval(id));
  }

  /** `ready` si el dato es reciente; `stale` con `asOf` = `evaluatedAt` si envejeció más de dos refrescos. */
  private conAntiguedad<T>(data: T, evaluatedAt: string): ViewState<T> {
    const t = new Date(evaluatedAt).getTime();
    if (!Number.isNaN(t) && this.ahora() - t > ATRASADO_TRAS_MS) return stale(data, new Date(t));
    return ready(data);
  }

  private caidas(): readonly Tool[] {
    const h = this.herramientas();
    return h.status === 'ready' ? h.data.tools.filter((t) => estadoVivo(t) === 'DOWN') : [];
  }

  private filaInstancia(i: Instance, s: InstanceLiveness): FilaInstancia {
    const fuente =
      i.evidence.source === 'heartbeat'
        ? 'latido del proceso'
        : i.evidence.source === 'probe'
          ? 'sonda desde la API'
          : i.evidence.source === 'self'
            ? 'la propia API'
            : 'sin evidencia';
    const umbral = i.thresholdSeconds === null ? '' : ` · umbral ${i.thresholdSeconds} s`;
    return {
      id: i.id,
      label: i.label,
      tipo: TIPOS_DE_INSTANCIA[i.type],
      requerida: i.required ? 'obligatoria' : 'opcional',
      estado: ESTADOS_DE_INSTANCIA[i.state],
      ultimoLatido: i.lastHeartbeatAt,
      antiguedad: i.ageSeconds === null ? 'sin latido' : `${haceCuanto(i.ageSeconds)}${umbral}`,
      causa: CAUSAS[i.cause] ?? i.cause,
      detalle: i.causeDetail,
      fuente: `${fuente}${i.evidence.reportedStatus ? ` · informa «${i.evidence.reportedStatus}»` : ''}${
        s.heartbeatStore.status === 'down' && i.evidence.source === 'heartbeat' ? ' · almacén de latidos caído' : ''
      }`,
    };
  }

  private filaHerramienta(t: Tool): FilaHerramienta {
    const vivo = estadoVivo(t);
    return {
      code: t.code,
      name: t.name,
      tipo: `${TIPOS_DE_HERRAMIENTA[t.kind]} · ${t.provider}`,
      vivo,
      estadoVivo: ESTADOS_VIVOS[vivo],
      catalogo: ESTADOS_DE_CATALOGO[t.status],
      critica: t.isCritical,
      vinculo: VINCULOS[t.binding],
      chequeo: CHEQUEOS[t.checkType],
      queDice: queDice(t),
      latencia: t.latencyMs === null ? '' : `${entero(t.latencyMs)} ms`,
    };
  }
}
