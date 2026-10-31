import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AnalyticsDevicesClient } from '../../../core/data-access/admin-portal/analytics-devices.client';
import type {
  DeviceBreakdownItem,
  DevicesBreakdown,
  DevicesPortal,
  DevicesQuery,
} from '../../../core/data-access/admin-portal/analytics-devices.types';
import { OpsLivenessClient } from '../../../core/data-access/admin-portal/ops-liveness.client';
import type {
  InstanceType,
  InstancesLiveness,
  LivenessInstance,
  LivenessState,
} from '../../../core/data-access/admin-portal/ops-liveness.types';
import { OpsToolsClient } from '../../../core/data-access/admin-portal/ops-tools.client';
import type {
  OpsTool,
  OpsToolsOverview,
} from '../../../core/data-access/admin-portal/ops-tools.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import type { MetricTone } from '../../../shared/components/molecules/metric-card/metric-card.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { entero, porcentaje } from '../platform/platform-labels';
import {
  CONTEO_DE_VIDA,
  ESTADOS_DE_VIDA,
  FILTROS_DE_SALUD,
  TIPOS_DE_INSTANCIA,
  antiguedad,
  causaDeVida,
  estadoDeRegistro,
  estadoDeVida,
  etiquetaDeDispositivo,
  ordenarHerramientas,
  ordenarInstancias,
  resumirCriticas,
  saludDeHerramienta,
  tipoDeComprobacion,
  tipoDeHerramienta,
  tipoDeInstancia,
  type ResumenCriticas,
  type Rotulo,
} from './instances-labels';

type Rango = '24h' | '7d' | '30d';
type Criticidad = 'todas' | 'criticas' | 'no-criticas';

/** Una fila de la tabla de instancias, ya formateada: la tabla sólo la pinta. */
interface FilaInstancia {
  readonly id: string;
  readonly required: boolean;
  readonly type: string;
  readonly estado: Rotulo;
  readonly edad: string;
  readonly momento: string | null;
  readonly umbral: string;
  readonly causa: string;
  readonly codigoCausa: string | null;
  readonly evidence: string;
}

/** Una fila de la tabla de herramientas. */
interface FilaHerramienta {
  readonly code: string;
  readonly name: string;
  readonly kind: string;
  readonly isCritical: boolean;
  readonly registro: Rotulo;
  readonly salud: Rotulo;
  readonly comprobacion: string;
  readonly observedAt: string | null;
  readonly faltan: readonly string[];
}

/** Un desglose de dispositivos listo para pintar: título, filas con su parte del total. */
interface GrupoDeDispositivos {
  readonly id: string;
  readonly titulo: string;
  readonly ayuda: string;
  readonly filas: readonly {
    readonly clave: string;
    readonly etiqueta: string;
    readonly contextos: string;
    readonly parte: string;
    readonly ancho: string;
  }[];
}

const RANGO_DIAS: Readonly<Record<Rango, number>> = { '24h': 1, '7d': 7, '30d': 30 };

const FILTRO_TODOS = null;

/**
 * Instancias y herramientas: qué procesos y servicios están vivos (con su
 * antigüedad y su causa), qué herramientas usa la plataforma y cuáles son
 * críticas, y desde qué dispositivos se usa. Cada bloque se pide por su cuenta:
 * que uno falle o no tenga permiso no apaga a los demás.
 *
 * Regla de honestidad: «viva» es lo que el servidor puede probar con evidencia
 * fresca; sin evidencia la pantalla dice «sin dato», nunca «todo bien». El
 * estado nunca se comunica sólo con color.
 */
@Component({
  selector: 'app-instances',
  imports: [
    DatePipe,
    AppButton,
    Badge,
    Alert,
    Card,
    MetricCard,
    SegmentedControl,
    Select,
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './instances.html',
  styleUrl: './instances.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Instances {
  private readonly livenessClient = inject(OpsLivenessClient);
  private readonly toolsClient = inject(OpsToolsClient);
  private readonly devicesClient = inject(AnalyticsDevicesClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly entero = entero;
  protected readonly porcentaje = porcentaje;
  protected readonly antiguedad = antiguedad;
  protected readonly estadoDeVida = estadoDeVida;
  protected readonly conteoDeVida = CONTEO_DE_VIDA;
  protected readonly estadosDeVida = ESTADOS_DE_VIDA;

  protected readonly pestana = signal(0);

  protected readonly vida = signal<ViewState<InstancesLiveness>>(loading());
  protected readonly herramientas = signal<ViewState<OpsToolsOverview>>(loading());
  protected readonly dispositivos = signal<ViewState<DevicesBreakdown>>(loading());

  /* -- Filtros ----------------------------------------------------------- */
  protected readonly tipo = signal<InstanceType | null>(FILTRO_TODOS);
  protected readonly estado = signal<LivenessState | null>(FILTRO_TODOS);
  protected readonly criticidad = signal<Criticidad>('todas');
  protected readonly salud = signal<string | null>(FILTRO_TODOS);
  protected readonly rango = signal<Rango>('7d');
  protected readonly portal = signal<DevicesPortal | null>(FILTRO_TODOS);

  protected readonly opcionesTipo: readonly SelectOption<InstanceType | null>[] = [
    { value: null, label: 'Todos los tipos' },
    ...TIPOS_DE_INSTANCIA,
  ];
  protected readonly opcionesEstado: readonly SelectOption<LivenessState | null>[] = [
    { value: null, label: 'Todos los estados' },
    ...ESTADOS_DE_VIDA.map((e) => ({ value: e, label: estadoDeVida(e).label })),
  ];
  protected readonly opcionesCriticidad = [
    { value: 'todas' as const, label: 'Todas' },
    { value: 'criticas' as const, label: 'Críticas' },
    { value: 'no-criticas' as const, label: 'No críticas' },
  ];
  protected readonly opcionesSalud: readonly SelectOption<string | null>[] = [
    { value: null, label: 'Toda la salud' },
    ...FILTROS_DE_SALUD,
  ];
  protected readonly opcionesRango = [
    { value: '24h' as const, label: '24 h' },
    { value: '7d' as const, label: '7 días' },
    { value: '30d' as const, label: '30 días' },
  ];
  protected readonly opcionesPortal: readonly SelectOption<DevicesPortal | null>[] = [
    { value: null, label: 'Web y móvil' },
    { value: 'WEB', label: 'Sólo web' },
    { value: 'MOBILE', label: 'Sólo móvil' },
  ];

  /* -- Instancias -------------------------------------------------------- */
  private readonly celdaInstancia =
    viewChild<TemplateRef<{ $implicit: FilaInstancia }>>('instanciaCell');
  private readonly celdaEstadoVida =
    viewChild<TemplateRef<{ $implicit: FilaInstancia }>>('estadoVidaCell');
  private readonly celdaCausa = viewChild<TemplateRef<{ $implicit: FilaInstancia }>>('causaCell');

  protected readonly hayFiltrosDeInstancias = computed(
    () => this.tipo() !== null || this.estado() !== null,
  );

  protected readonly filasInstancias = computed<ViewState<readonly FilaInstancia[]>>(() => {
    const e = this.vida();
    if (e.status !== 'ready') return e as ViewState<readonly FilaInstancia[]>;
    if (e.data.instances.length === 0) {
      return empty(
        { label: 'Pida a quien opera la API que revise el registro de instancias esperadas.' },
        'La API no declara ninguna instancia esperada: no hay nada que evaluar, y eso no significa que todo esté bien.',
      );
    }
    const visibles = ordenarInstancias(e.data.instances).filter(
      (i) =>
        (this.tipo() === null || i.type === this.tipo()) &&
        (this.estado() === null || i.state === this.estado()),
    );
    if (visibles.length === 0) {
      return empty(
        { label: 'Quite o cambie los filtros de arriba.' },
        'Ninguna instancia coincide con los filtros elegidos.',
      );
    }
    return ready(visibles.map((i) => this.filaInstancia(i)));
  });

  protected readonly columnasInstancias = computed<readonly ColumnDef<FilaInstancia>[]>(() => [
    { key: 'id', header: 'Instancia', priority: 1, cell: this.celdaInstancia() },
    { key: 'type', header: 'Tipo', priority: 3 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstadoVida() },
    { key: 'edad', header: 'Último latido o sonda', priority: 2 },
    { key: 'umbral', header: 'Se da por caída después de', priority: 3, align: 'end' },
    { key: 'causa', header: 'Causa y evidencia', priority: 2, cell: this.celdaCausa() },
  ]);
  protected readonly porIdInstancia = (fila: FilaInstancia): string => fila.id;
  protected readonly porCodigo = (fila: FilaHerramienta): string => fila.code;
  protected readonly nombreDeInstancia = (fila: FilaInstancia): string =>
    `${fila.id}: ${fila.estado.label}`;

  /** Cuántas instancias hay en cada estado (todas, requeridas o no: es un conteo). */
  protected conteoPorEstado(
    vida: InstancesLiveness,
  ): readonly { readonly estado: LivenessState; readonly cantidad: number }[] {
    return ESTADOS_DE_VIDA.map((estado) => ({
      estado,
      cantidad: vida.instances.filter((i) => i.state === estado).length,
    }));
  }

  protected tonoDeConteo(estado: LivenessState, cantidad: number): MetricTone {
    if (cantidad === 0) return 'neutral';
    const tono = estadoDeVida(estado).tone;
    return tono === 'secondary' ? 'neutral' : (tono as MetricTone);
  }

  /** El aviso general: lo que `overall` quiere decir, sin pintar verde lo que no tiene evidencia. */
  protected avisoGeneral(vida: InstancesLiveness): {
    readonly tone: AlertTone;
    readonly titulo: string;
    readonly texto: string;
  } {
    switch (vida.overall) {
      case 'VIVA':
        return {
          tone: 'success',
          titulo: 'Todas las instancias requeridas tienen evidencia fresca',
          texto: `«Viva» quiere decir que llegó un latido (o la sonda respondió) dentro de ${vida.thresholds.liveSeconds} s según el reloj de la API. No garantiza que todo funcione.`,
        };
      case 'DEGRADADA':
        return {
          tone: 'warning',
          titulo: 'Hay instancias requeridas degradadas o sin evidencia',
          texto:
            'Al menos una instancia requerida responde tarde, o no se sabe si vive. Revise las filas marcadas abajo.',
        };
      case 'CAIDA':
        return {
          tone: 'error',
          titulo: 'Hay instancias requeridas caídas',
          texto:
            'No llegó latido de al menos una instancia requerida dentro del límite. «Caída» quiere decir sin latido recibido, no que se haya observado el proceso detenido.',
        };
      default:
        return {
          tone: 'warning',
          titulo: 'Sin datos: no se sabe si las instancias viven',
          texto:
            'No hay evidencia de ninguna instancia requerida. Eso no es una buena noticia ni una mala: es que no se midió.',
        };
    }
  }

  /* -- Herramientas ------------------------------------------------------ */
  private readonly celdaHerramienta =
    viewChild<TemplateRef<{ $implicit: FilaHerramienta }>>('herramientaCell');
  private readonly celdaCritica =
    viewChild<TemplateRef<{ $implicit: FilaHerramienta }>>('criticaCell');
  private readonly celdaRegistro =
    viewChild<TemplateRef<{ $implicit: FilaHerramienta }>>('registroCell');
  private readonly celdaSalud = viewChild<TemplateRef<{ $implicit: FilaHerramienta }>>('saludCell');
  private readonly celdaFaltan =
    viewChild<TemplateRef<{ $implicit: FilaHerramienta }>>('faltanCell');

  protected readonly hayFiltrosDeHerramientas = computed(
    () => this.criticidad() !== 'todas' || this.salud() !== null,
  );

  protected readonly filasHerramientas = computed<ViewState<readonly FilaHerramienta[]>>(() => {
    const e = this.herramientas();
    if (e.status !== 'ready') return e as ViewState<readonly FilaHerramienta[]>;
    if (e.data.items.length === 0) {
      return empty(
        { label: 'Pida a quien opera la API que cargue el catálogo de herramientas.' },
        'El catálogo de herramientas está vacío: no hay nada que evaluar, y eso no significa que todo esté bien.',
      );
    }
    const visibles = ordenarHerramientas(e.data.items).filter((t) => {
      if (this.criticidad() === 'criticas' && !t.isCritical) return false;
      if (this.criticidad() === 'no-criticas' && t.isCritical) return false;
      const s = this.salud();
      return s === null || saludDeHerramienta(t.health.state, t.health.checkType).label === s;
    });
    if (visibles.length === 0) {
      return empty(
        { label: 'Quite o cambie los filtros de arriba.' },
        'Ninguna herramienta coincide con los filtros elegidos.',
      );
    }
    return ready(visibles.map((t) => this.filaHerramienta(t)));
  });

  protected readonly columnasHerramientas = computed<readonly ColumnDef<FilaHerramienta>[]>(() => [
    { key: 'name', header: 'Herramienta', priority: 1, cell: this.celdaHerramienta() },
    { key: 'isCritical', header: 'Criticidad', priority: 1, cell: this.celdaCritica() },
    { key: 'salud', header: 'Salud', priority: 1, cell: this.celdaSalud() },
    { key: 'comprobacion', header: 'Cómo se comprobó', priority: 2 },
    { key: 'registro', header: 'En el catálogo', priority: 3, cell: this.celdaRegistro() },
    { key: 'kind', header: 'Tipo', priority: 3 },
    { key: 'faltan', header: 'Variables que faltan', priority: 2, cell: this.celdaFaltan() },
  ]);
  protected readonly nombreDeHerramienta = (fila: FilaHerramienta): string =>
    `${fila.name}: ${fila.salud.label}`;

  /** Resumen de las críticas, tal como lo cuenta la portada. */
  protected resumenDeCriticas(herramientas: OpsToolsOverview): ResumenCriticas {
    return resumirCriticas(herramientas.items);
  }

  /* -- Dispositivos ------------------------------------------------------ */
  protected readonly gruposDeDispositivos = computed<readonly GrupoDeDispositivos[]>(() => {
    const e = this.dispositivos();
    if (e.status !== 'ready') return [];
    const d = e.data;
    return [
      this.grupo(
        'tipo',
        'Tipo de dispositivo',
        'Escritorio, móvil o tableta.',
        d.byDeviceType,
        d.totals.contexts,
      ),
      this.grupo(
        'so',
        'Sistema operativo',
        'Familia del sistema operativo.',
        d.byOsFamily,
        d.totals.contexts,
      ),
      this.grupo(
        'navegador',
        'Navegador',
        'Familia del navegador (no aplica a la app móvil).',
        d.byBrowserFamily,
        d.totals.contexts,
      ),
      this.grupo(
        'version',
        'Versión de la app',
        'Sólo la app móvil informa su versión.',
        d.byAppVersion,
        d.totals.contexts,
      ),
    ];
  });

  /** Sin contextos, la pestaña lo dice con la ventana; los bots solos no la llenan. */
  protected readonly estadoDispositivos = computed<ViewState<DevicesBreakdown>>(() => {
    const e = this.dispositivos();
    if (e.status === 'ready' && e.data.totals.contexts === 0 && e.data.totals.bots === 0) {
      return empty(
        { label: 'Pruebe con una ventana más amplia.' },
        'Todavía no hay contextos de cliente medidos en esta ventana.',
      );
    }
    return e;
  });

  constructor() {
    // La portada enlaza a una pestaña concreta: `?pestana=1` abre «Herramientas».
    const pedida = Number(this.route.snapshot.queryParamMap.get('pestana'));
    if (Number.isInteger(pedida) && pedida >= 0 && pedida <= 2) this.pestana.set(pedida);
    this.cargar();
  }

  protected cargar(): void {
    this.cargarVida();
    this.cargarHerramientas();
    this.cargarDispositivos();
  }

  protected cargarVida(): void {
    this.vida.set(loading());
    this.livenessClient.liveness().subscribe({
      next: (r) => this.vida.set(ready(r)),
      error: (e: unknown) => this.vida.set(errorToViewState<InstancesLiveness>(e)),
    });
  }

  protected cargarHerramientas(): void {
    this.herramientas.set(loading());
    this.toolsClient.tools().subscribe({
      next: (r) => this.herramientas.set(ready(r)),
      error: (e: unknown) => this.herramientas.set(errorToViewState<OpsToolsOverview>(e)),
    });
  }

  protected cargarDispositivos(): void {
    this.dispositivos.set(loading());
    this.devicesClient.devices(this.ventanaDeDispositivos()).subscribe({
      next: (r) => this.dispositivos.set(ready(r)),
      error: (e: unknown) => this.dispositivos.set(errorToViewState<DevicesBreakdown>(e)),
    });
  }

  protected cambiarRango(r: Rango): void {
    this.rango.set(r);
    this.cargarDispositivos();
  }

  protected cambiarPortal(p: DevicesPortal | null): void {
    this.portal.set(p);
    this.cargarDispositivos();
  }

  protected limpiarInstancias(): void {
    this.tipo.set(FILTRO_TODOS);
    this.estado.set(FILTRO_TODOS);
  }

  protected limpiarHerramientas(): void {
    this.criticidad.set('todas');
    this.salud.set(FILTRO_TODOS);
  }

  private ventanaDeDispositivos(): DevicesQuery {
    const to = new Date();
    const from = new Date(to.getTime() - RANGO_DIAS[this.rango()] * 24 * 3_600_000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      ...(this.portal() ? { portal: this.portal()! } : {}),
    };
  }

  private filaInstancia(i: LivenessInstance): FilaInstancia {
    return {
      id: i.id,
      required: i.required,
      type: tipoDeInstancia(i.type),
      estado: estadoDeVida(i.state),
      edad: i.lastHeartbeatAt === null ? 'Nunca' : antiguedad(i.ageSeconds),
      momento: i.lastHeartbeatAt,
      umbral: `${i.thresholdSeconds} s`,
      causa: causaDeVida(i.cause),
      codigoCausa: i.cause,
      evidence: i.evidence,
    };
  }

  private filaHerramienta(t: OpsTool): FilaHerramienta {
    return {
      code: t.code,
      name: t.name,
      kind: tipoDeHerramienta(t.kind),
      isCritical: t.isCritical,
      registro: estadoDeRegistro(t.status),
      salud: saludDeHerramienta(t.health.state, t.health.checkType),
      comprobacion: tipoDeComprobacion(t.health.checkType),
      observedAt: t.health.observedAt,
      faltan: t.health.missingEnvVars,
    };
  }

  private grupo(
    id: string,
    titulo: string,
    ayuda: string,
    items: readonly DeviceBreakdownItem[],
    total: number,
  ): GrupoDeDispositivos {
    const maximo = Math.max(1, ...items.map((i) => i.contexts));
    return {
      id,
      titulo,
      ayuda,
      filas: items.map((i) => ({
        clave: i.code,
        etiqueta: etiquetaDeDispositivo(i),
        contextos: entero(i.contexts),
        parte: total === 0 ? '—' : porcentaje(i.contexts / total),
        ancho: `${Math.round((i.contexts / maximo) * 100)}%`,
      })),
    };
  }
}
