import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { PharmacyOrdersClient } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Accordion } from '../../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { tiempoRelativo } from '../../../shared/date/tiempo-relativo';
import { AlarmaDePedidos } from './alarma-de-pedidos';
import {
  GRUPOS_A_LA_VISTA,
  GRUPOS_DE_BANDEJA,
  etiquetaDeGrupo,
  grupoDeBandeja,
  toBandejaStatusPresentation,
  type BandejaStatusPresentation,
  type GrupoDeBandeja,
} from './bandeja-status';

/**
 * Cada cuánto se refresca la bandeja sola. La campana ya avisa; esto es el
 * respaldo del mostrador que dejó la pestaña abierta. TODO(FAR-E2): será el
 * único mecanismo cuando el canal de la demo se vaya.
 */
const SONDEO_MS = 20_000;

/** La base del detalle: la bandeja enlaza, jamás pinta el uuid. */
const DETALLE_ROUTE = '/administration/pharmacy-orders';

/** Un grupo ya resuelto para la plantilla. */
interface GrupoResuelto {
  readonly grupo: GrupoDeBandeja;
  readonly etiqueta: string;
  readonly pedidos: readonly PedidoFarmacia[];
}

/**
 * **La bandeja del mostrador** (carril FAR-I3) — el registro del cliente,
 * literal: «recepciona el pedido por un link y tiene que tener alguna alarma
 * o sonido al llegar el pedido, muy similar a PEDIDOS YA».
 *
 * ## Cómo llega un pedido nuevo
 *
 * La bandeja compara los ids en `ENVIADO` contra los que ya vio: lo que
 * aparece de más dispara la alarma (`AlarmaDePedidos`: díng-dóng con
 * interruptor, título con contador si la pestaña está oculta) y entra
 * destacado. La primera carga es la línea de base — encontrar la bandeja
 * llena al abrirla no es «llegó un pedido».
 *
 * ## Privacidad
 *
 * Se pinta SOLO lo que el mostrador necesita: quién pidió, los renglones,
 * los montos, el estado y los tiempos. Ni diagnóstico ni ningún otro dato
 * clínico — si el DTO real de FAR-E2 trajera de más, no se pinta y se
 * reporta.
 */
@Component({
  selector: 'app-pharmacy-inbox',
  imports: [
    Accordion,
    AccordionPanel,
    Badge,
    DatePipe,
    FormsModule,
    PageHeader,
    RouterLink,
    Switch,
    ViewStateHost,
  ],
  providers: [AlarmaDePedidos],
  templateUrl: './pharmacy-inbox.html',
  styleUrl: './pharmacy-inbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyInbox {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly navigation = inject(NavigationService);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  /** Ids de `ENVIADO` ya vistos; `null` = la línea de base aún no existe. */
  private vistos: Set<string> | null = null;

  protected readonly alarma = inject(AlarmaDePedidos);
  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly demoActiva = environment.demoPresets;
  protected readonly detalleRoute = DETALLE_ROUTE;

  protected readonly state = signal<ViewState<readonly PedidoFarmacia[]>>(loading());

  /** El «ahora» de los tiempos relativos: avanza con cada tic del sondeo. */
  protected readonly ahora = signal(new Date());

  /** Los pedidos que entraron con alarma y siguen sin abrirse. */
  protected readonly destacados = signal<ReadonlySet<string>>(new Set());

  /**
   * El cuarto canal de la alarma: el aviso que un lector de pantalla SÍ
   * anuncia — sonido, título y destaque son todos visuales o de audio.
   */
  protected readonly avisoDeNuevos = signal('');

  private readonly lista = computed(() => {
    const estado = this.state();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** Las cuatro colas a la vista, en el orden de la tarjeta. */
  protected readonly colas = computed(() => this.grupos().slice(0, GRUPOS_A_LA_VISTA));

  /** El resto, plegado: preparación y cerrados no corren contra un reloj. */
  protected readonly plegados = computed(() => this.grupos().slice(GRUPOS_A_LA_VISTA));

  private readonly grupos = computed<readonly GrupoResuelto[]>(() => {
    const pedidos = this.lista();
    return GRUPOS_DE_BANDEJA.map((grupo) => ({
      grupo,
      etiqueta: etiquetaDeGrupo(grupo),
      pedidos: pedidos.filter((pedido) => grupoDeBandeja(pedido.estado) === grupo),
    }));
  });

  constructor() {
    this.cargar();
    this.agendar();
    inject(DestroyRef).onDestroy(() => this.detener());
    // El empujón de la demo de dos ventanas: lo que llega por el canal se
    // aplica al instante, sin esperar el sondeo. Se va con FAR-E2.
    effect(() => this.aplicar(this.ordersClient.pedidosEnVivo()));
  }

  protected cargar(): void {
    this.state.set(loading());
    this.ordersClient.pedidosDeFarmacia().subscribe({
      next: (pedidos) => this.aplicar(pedidos),
      error: (error: unknown) =>
        this.state.set(errorToViewState<readonly PedidoFarmacia[]>(error)),
    });
  }

  protected presentacionDe(pedido: PedidoFarmacia): BandejaStatusPresentation {
    return toBandejaStatusPresentation(pedido.estado);
  }

  protected esNuevo(pedido: PedidoFarmacia): boolean {
    return pedido.estado === 'ENVIADO' && this.destacados().has(pedido.id);
  }

  protected nombreDe(pedido: PedidoFarmacia): string {
    return pedido.paciente ?? 'Paciente';
  }

  /** «Amoxicilina» o «Amoxicilina y 2 más»: el resumen cabe en una tarjeta. */
  protected resumenDe(pedido: PedidoFarmacia): string {
    const [primera, ...resto] = pedido.lineas;
    if (primera === undefined) {
      return 'Sin renglones';
    }
    return resto.length === 0
      ? primera.medicamento
      : `${primera.medicamento} y ${resto.length} más`;
  }

  protected totalDe(pedido: PedidoFarmacia): string {
    return pedido.totalEstimado === null
      ? 'Total no disponible'
      : `${pedido.totalEstimado} ${pedido.moneda ?? ''}`.trim();
  }

  /** «hace 5 min», o `null` para caer al formato de fecha de siempre. */
  protected llegadaDe(pedido: PedidoFarmacia): string | null {
    return tiempoRelativo(pedido.creadoEl, this.ahora());
  }

  /** La cuenta regresiva discreta de la reserva, sólo mientras espera. */
  protected vencimientoDe(pedido: PedidoFarmacia): string | null {
    if (pedido.estado !== 'LISTO_PARA_RETIRO' || pedido.venceEl === null) {
      return null;
    }
    const minutos = Math.round((pedido.venceEl.getTime() - this.ahora().getTime()) / 60_000);
    if (minutos <= 0) {
      return 'La reserva venció';
    }
    if (minutos < 60) {
      return `Vence en ${minutos} min`;
    }
    return `Vence en ${Math.round(minutos / 60)} h`;
  }

  private aplicar(pedidos: readonly PedidoFarmacia[]): void {
    // El S3 exige salida por contrato: la puerta natural es el panel org.
    const volverAlPanel = {
      label: 'Ver tu organización',
      route: '/administration/my-organization',
    };
    if (!this.demoActiva) {
      // VISUAL-FIRST: la pantalla existe; la conexión real es de FAR-E2.
      this.state.set(
        empty(
          volverAlPanel,
          'Los pedidos de los pacientes van a llegar acá, con su alarma, cuando la conexión con el mostrador esté activa. Próximamente.',
        ),
      );
      return;
    }
    this.detectarNuevos(pedidos);
    if (pedidos.length === 0) {
      this.state.set(
        empty(
          volverAlPanel,
          'Todavía no llegó ningún pedido. Cuando un paciente envíe el suyo desde su receta, va a aparecer acá y va a sonar la alarma.',
        ),
      );
      return;
    }
    this.state.set(ready(pedidos));
  }

  private detectarNuevos(pedidos: readonly PedidoFarmacia[]): void {
    const enviados = pedidos
      .filter((pedido) => pedido.estado === 'ENVIADO')
      .map((pedido) => pedido.id);
    if (this.vistos === null) {
      this.vistos = new Set(enviados);
      return;
    }
    const conocidos = this.vistos;
    const nuevos = enviados.filter((id) => !conocidos.has(id));
    if (nuevos.length === 0) {
      return;
    }
    for (const id of nuevos) {
      conocidos.add(id);
    }
    this.destacados.update((actuales) => new Set([...actuales, ...nuevos]));
    this.avisoDeNuevos.set(
      nuevos.length === 1
        ? 'Llegó un pedido nuevo a la bandeja.'
        : `Llegaron ${nuevos.length} pedidos nuevos a la bandeja.`,
    );
    this.alarma.notificar(nuevos.length);
  }

  /** Encadena el próximo tic. Nunca hay dos vivos a la vez. */
  private agendar(): void {
    if (!this.esBrowser) {
      return;
    }
    this.temporizador = setTimeout(() => {
      this.ahora.set(new Date());
      this.refrescar();
      this.agendar();
    }, SONDEO_MS);
  }

  private detener(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  /** Refresco de fondo: sin pasar por `loading`, la bandeja no parpadea. */
  private refrescar(): void {
    this.ordersClient.pedidosDeFarmacia().subscribe({
      next: (pedidos) => this.aplicar(pedidos),
      // Un tic que falla no borra la bandeja: el próximo lo reintenta.
      error: () => undefined,
    });
  }
}
