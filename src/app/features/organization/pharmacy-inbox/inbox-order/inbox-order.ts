import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import {
  esEstadoTerminal,
  PharmacyOrdersClient,
  puedeConfirmarse,
  puedePrepararse,
  puedeRechazarsePorFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  AjusteDeLinea,
  DecisionDeLinea,
  PedidoFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { toBandejaStatusPresentation } from '../bandeja-status';

/** A dónde vuelve quien llegó a un pedido que ya no está. */
const BANDEJA_ROUTE = '/administration/pharmacy-orders';

/** Lo que el mostrador edita de un renglón antes de confirmar. */
interface AjusteEnEdicion {
  readonly decision: DecisionDeLinea;
  /** El nombre del genérico propuesto; obligatorio para poder confirmar. */
  readonly nombre: string;
  /** El precio propuesto, como lo tipeó el mostrador; vacío = sin precio. */
  readonly precio: string;
}

/**
 * **El pedido, del lado del mostrador** (carril FAR-I3).
 *
 * ## Abrirlo ES recepcionarlo
 *
 * Un pedido `ENVIADO` pasa a `EN_REVISION` al abrirse — el «visto» de
 * PedidosYa: el paciente ve que la farmacia lo está mirando. Por eso no hay
 * botón «tomar en revisión»: el registro del cliente dice «recepciona el
 * pedido por un link», y el link es este.
 *
 * ## Las tres salidas de la revisión
 *
 * Confirmar (ajustando renglón por renglón: tal cual, genérico propuesto con
 * su precio, o no disponible — el total se recalcula en vivo), rechazar (el
 * motivo es obligatorio: lo exige el diálogo, no una validación artesanal) y
 * más tarde el retiro: el código que trae la persona, con entrega parcial
 * por renglón si no se lleva todo.
 *
 * El selector de productos reales del mismo concepto llega con el catálogo
 * del tenant (FAR-E2); mientras, el genérico se escribe con nombre y precio.
 */
@Component({
  selector: 'app-inbox-order',
  imports: [
    Alert,
    AppButton,
    Badge,
    Checkbox,
    DatePipe,
    FormField,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './inbox-order.html',
  styleUrl: './inbox-order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxOrder {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly dialog = inject(DialogService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly bandejaRoute = BANDEJA_ROUTE;

  protected readonly state = signal<ViewState<PedidoFarmacia>>(loading());
  protected readonly pedido = computed(() => dataOf(this.state()));
  protected readonly ocupado = signal(false);

  /** Un ajuste por renglón, en el orden de las líneas del pedido. */
  protected readonly ajustes = signal<readonly AjusteEnEdicion[]>([]);

  /** El código que la persona trae al mostrador, tal como se tipea. */
  protected readonly codigo = signal('');

  /** Qué renglones se lleva en esta entrega. */
  protected readonly llevados = signal<ReadonlySet<number>>(new Set());

  /** El último intento de retiro tenía un código que no coincide. */
  protected readonly codigoInvalido = signal(false);

  protected readonly presentacion = computed(() => {
    const abierto = this.pedido();
    return abierto === null ? null : toBandejaStatusPresentation(abierto.estado);
  });

  /** La revisión está abierta: los ajustes por renglón se pueden editar. */
  protected readonly enRevision = computed(() => {
    const abierto = this.pedido();
    return abierto !== null && puedeConfirmarse(abierto.estado);
  });

  protected readonly puedeRechazar = computed(() => {
    const abierto = this.pedido();
    return abierto !== null && puedeRechazarsePorFarmacia(abierto.estado);
  });

  protected readonly puedeMarcarListo = computed(() => {
    const abierto = this.pedido();
    return abierto !== null && puedePrepararse(abierto.estado) && abierto.modalidad === 'RETIRO';
  });

  protected readonly esEnvio = computed(() => {
    const abierto = this.pedido();
    return abierto !== null && abierto.modalidad !== 'RETIRO';
  });

  protected readonly puedeSalirEnCamino = computed(() => {
    const abierto = this.pedido();
    return (
      abierto !== null &&
      this.esEnvio() &&
      puedePrepararse(abierto.estado) &&
      abierto.envio === null
    );
  });

  /**
   * La entrega sólo cierra un pedido que sigue en preparación: uno cancelado
   * con el envío en la calle no se resucita desde el mostrador.
   */
  protected readonly puedeEntregarse = computed(() => {
    const abierto = this.pedido();
    return abierto !== null && abierto.envio === 'EN_CAMINO' && puedePrepararse(abierto.estado);
  });

  /** El bloque de envío se pinta mientras el pedido vive y no se entregó. */
  protected readonly muestraEnvio = computed(() => {
    const abierto = this.pedido();
    return (
      abierto !== null &&
      this.esEnvio() &&
      abierto.envio !== 'ENTREGADO' &&
      !esEstadoTerminal(abierto.estado)
    );
  });

  protected readonly enRetiro = computed(
    () => this.pedido()?.estado === 'LISTO_PARA_RETIRO',
  );

  /** Renglones en pie que todavía no salieron por el mostrador. */
  protected readonly pendientes = computed<readonly number[]>(() => {
    const abierto = this.pedido();
    if (abierto === null) {
      return [];
    }
    const entregados = new Set(abierto.entregas.flatMap((entrega) => entrega.indices));
    return abierto.lineas.flatMap((linea, indice) =>
      linea.disponible && !entregados.has(indice) ? [indice] : [],
    );
  });

  /**
   * El total en vivo mientras se ajusta: renglones en pie con el precio que
   * quedaría SI el paciente acepta las propuestas. `null` si falta un precio.
   */
  protected readonly totalEnVivo = computed<string | null>(() => {
    const abierto = this.pedido();
    if (abierto === null) {
      return null;
    }
    let total = 0;
    for (const [indice, ajuste] of this.ajustes().entries()) {
      if (ajuste.decision === 'NO_DISPONIBLE') {
        continue;
      }
      const linea = abierto.lineas[indice];
      if (linea === undefined) {
        continue;
      }
      // El mismo lector que arma la propuesta (`aPrecio`): lo que se
      // muestra en vivo y lo que viaja al confirmar no pueden divergir.
      const texto =
        ajuste.decision === 'PROPONER_GENERICO' ? aPrecio(ajuste.precio) : linea.precio;
      const precio = Number(texto ?? Number.NaN);
      if (!Number.isFinite(precio)) {
        return null;
      }
      total += precio * linea.cantidad;
    }
    return total.toFixed(2);
  });

  /** Hay propuestas en el ajuste actual: el total en vivo es condicional. */
  protected readonly hayPropuestas = computed(() =>
    this.ajustes().some((ajuste) => ajuste.decision === 'PROPONER_GENERICO'),
  );

  /**
   * Confirmar exige que cada genérico tenga nombre y que quede al menos un
   * renglón en pie — un pedido sin nada que preparar se rechaza con motivo.
   */
  protected readonly puedeConfirmar = computed(() => {
    const ajustes = this.ajustes();
    if (ajustes.length === 0) {
      return false;
    }
    const todoCaido = ajustes.every((ajuste) => ajuste.decision === 'NO_DISPONIBLE');
    const genericosSinNombre = ajustes.some(
      (ajuste) => ajuste.decision === 'PROPONER_GENERICO' && ajuste.nombre.trim() === '',
    );
    return !todoCaido && !genericosSinNombre;
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.cargar(params.get('orderId') ?? ''));
    // El reflejo en vivo de la demo: si el pedido cambia en otra pestaña
    // (el paciente decide), la ficha se actualiza sola — es lo que el aviso
    // de la espera promete. Con FAR-E2 esto será polling o notificación.
    effect(() => {
      const vivos = this.ordersClient.pedidosEnVivo();
      const actual = untracked(() => this.pedido());
      const fresco = actual === null ? undefined : vivos.find((p) => p.id === actual.id);
      if (fresco !== undefined && fresco !== actual) {
        this.aplicar(fresco);
      }
    });
  }

  protected cargar(id: string = this.pedido()?.id ?? ''): void {
    this.state.set(loading());
    this.ordersClient.pedido(id).subscribe((pedido) => {
      if (pedido === null) {
        this.state.set(
          notFound({ label: 'Volver a la bandeja', route: BANDEJA_ROUTE }),
        );
        return;
      }
      if (pedido.estado === 'ENVIADO') {
        // Abrirlo es recepcionarlo: el paciente ve «en revisión» desde ya.
        this.ordersClient
          .abrirRevision(pedido.id)
          .subscribe((abierto) => this.aplicar(abierto ?? pedido));
        return;
      }
      this.aplicar(pedido);
    });
  }

  protected cambiarDecision(indice: number, decision: unknown): void {
    this.actualizarAjuste(indice, (ajuste) => ({
      ...ajuste,
      decision: decision as DecisionDeLinea,
    }));
  }

  protected cambiarNombre(indice: number, nombre: string | number | null): void {
    this.actualizarAjuste(indice, (ajuste) => ({ ...ajuste, nombre: String(nombre ?? '') }));
  }

  protected cambiarPrecio(indice: number, precio: string | number | null): void {
    this.actualizarAjuste(indice, (ajuste) => ({ ...ajuste, precio: String(precio ?? '') }));
  }

  protected confirmar(): void {
    const abierto = this.pedido();
    if (abierto === null || !this.puedeConfirmar()) {
      return;
    }
    const ajustes: readonly AjusteDeLinea[] = this.ajustes().map((ajuste, indice) => ({
      indice,
      decision: ajuste.decision,
      ...(ajuste.decision === 'PROPONER_GENERICO'
        ? {
            propuesta: {
              nombre: ajuste.nombre.trim(),
              precio: aPrecio(ajuste.precio),
            },
          }
        : {}),
    }));
    this.ejecutar(this.ordersClient.confirmarPedido(abierto.id, ajustes));
  }

  protected async rechazar(): Promise<void> {
    const abierto = this.pedido();
    if (abierto === null) {
      return;
    }
    const motivo = await this.dialog.confirmWithReason(
      {
        title: 'Rechazar el pedido',
        message:
          'El paciente va a ver el motivo tal como lo escribas: contale por qué y qué puede hacer.',
        confirmLabel: 'Rechazar el pedido',
        destructive: true,
      },
      { label: 'Motivo', hint: 'El paciente lo lee en su pantalla.' },
    );
    if (motivo === null) {
      return;
    }
    this.ejecutar(this.ordersClient.rechazarPedido(abierto.id, motivo));
  }

  protected marcarListo(): void {
    const abierto = this.pedido();
    if (abierto === null) {
      return;
    }
    this.ejecutar(this.ordersClient.marcarListo(abierto.id));
  }

  protected salirEnCamino(): void {
    const abierto = this.pedido();
    if (abierto === null) {
      return;
    }
    this.ejecutar(this.ordersClient.marcarEnvio(abierto.id, 'EN_CAMINO'));
  }

  protected async entregar(): Promise<void> {
    const abierto = this.pedido();
    if (abierto === null) {
      return;
    }
    const confirmado = await this.dialog.confirm({
      title: 'Registrar la entrega',
      message: 'El pedido queda cerrado como entregado. ¿Lo confirmás?',
      confirmLabel: 'Sí, se entregó',
    });
    if (!confirmado) {
      return;
    }
    this.ejecutar(this.ordersClient.marcarEnvio(abierto.id, 'ENTREGADO'));
  }

  protected alternarRenglon(indice: number, llevado: boolean): void {
    this.llevados.update((actuales) => {
      const proximos = new Set(actuales);
      if (llevado) {
        proximos.add(indice);
      } else {
        proximos.delete(indice);
      }
      return proximos;
    });
  }

  protected registrarRetiro(): void {
    const abierto = this.pedido();
    if (abierto === null || this.llevados().size === 0) {
      return;
    }
    this.ocupado.set(true);
    this.ordersClient
      .dispensar(abierto.id, { codigo: this.codigo(), indices: [...this.llevados()] })
      .subscribe(({ codigoValido, pedido }) => {
        this.ocupado.set(false);
        this.codigoInvalido.set(!codigoValido);
        if (codigoValido && pedido !== null) {
          this.codigo.set('');
          this.aplicar(pedido);
        }
      });
  }

  protected lineaDe(indice: number): string {
    return this.pedido()?.lineas[indice]?.medicamento ?? '';
  }

  private aplicar(pedido: PedidoFarmacia): void {
    this.state.set(ready(pedido));
    this.reiniciarAjustes(pedido);
    this.reiniciarRetiro(pedido);
  }

  private reiniciarAjustes(pedido: PedidoFarmacia): void {
    this.ajustes.set(
      pedido.lineas.map((linea) => ({
        decision: linea.disponible ? 'TAL_CUAL' : 'NO_DISPONIBLE',
        nombre: `Genérico equivalente de ${linea.medicamento}`,
        precio: '',
      })),
    );
  }

  private reiniciarRetiro(pedido: PedidoFarmacia): void {
    const entregados = new Set(pedido.entregas.flatMap((entrega) => entrega.indices));
    this.llevados.set(
      new Set(
        pedido.lineas.flatMap((linea, indice) =>
          linea.disponible && !entregados.has(indice) ? [indice] : [],
        ),
      ),
    );
  }

  private actualizarAjuste(
    indice: number,
    cambiar: (ajuste: AjusteEnEdicion) => AjusteEnEdicion,
  ): void {
    this.ajustes.update((actuales) =>
      actuales.map((ajuste, posicion) => (posicion === indice ? cambiar(ajuste) : ajuste)),
    );
  }

  private ejecutar(operacion: Observable<unknown>): void {
    this.ocupado.set(true);
    operacion.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.cargar();
      },
      error: () => this.ocupado.set(false),
    });
  }
}

/**
 * El precio tipeado, normalizado a texto exacto; vacío, ilegible o negativo
 * = sin precio. La coma decimal vale: «24,50» es como se escribe acá.
 */
export function aPrecio(texto: string): string | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') {
    return null;
  }
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor >= 0 ? valor.toFixed(2) : null;
}
