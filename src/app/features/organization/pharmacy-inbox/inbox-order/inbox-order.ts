import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
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
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
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
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { toBandejaStatusPresentation } from '../bandeja-status';

/** A dónde vuelve quien llegó a un pedido que ya no está. */
const BANDEJA_ROUTE = '/administration/pharmacy-orders';

/** Lo que el mostrador edita de un renglón antes de confirmar. */
interface AjusteEnEdicion {
  readonly decision: DecisionDeLinea;
  readonly propuesta?: {
    readonly productId: string;
    readonly nombre: string;
    readonly precio: null;
  };
}

interface SubstituteSearch {
  readonly status: 'idle' | 'loading' | 'ready' | 'error' | 'missing-concept';
  readonly products: readonly PharmacyProduct[];
  readonly options: readonly SelectOption<string>[];
}

const EMPTY_SUBSTITUTE_SEARCH: SubstituteSearch = {
  status: 'idle',
  products: [],
  options: [],
};

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
 * Las sustituciones se eligen del catálogo publicado del tenant usando el
 * concepto que la API entrega en cada línea. El backend vuelve a validar que
 * el producto propuesto pertenece a la farmacia y al mismo concepto.
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
    Select,
    ViewStateHost,
  ],
  templateUrl: './inbox-order.html',
  styleUrl: './inbox-order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxOrder {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly pharmacyClient = inject(PharmacyClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(DialogService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly bandejaRoute = BANDEJA_ROUTE;

  protected readonly state = signal<ViewState<PedidoFarmacia>>(loading());
  protected readonly pedido = computed(() => dataOf(this.state()));
  protected readonly ocupado = signal(false);

  /** Un ajuste por renglón, en el orden de las líneas del pedido. */
  protected readonly ajustes = signal<readonly AjusteEnEdicion[]>([]);
  protected readonly substituteSearches = signal<Readonly<Record<number, SubstituteSearch>>>({});

  /** El código que la persona trae al mostrador, tal como se tipea. */
  protected readonly codigo = signal('');

  /** Qué renglones se lleva en esta entrega. */
  protected readonly llevados = signal<ReadonlySet<number>>(new Set());

  /** El último intento de retiro tenía un código que no coincide. */
  protected readonly codigoInvalido = signal(false);

  /**
   * El estado del pago, dicho donde el mostrador decide si cobra (FAR-I5).
   * Sólo lectura: el pago se registra al cerrar la dispensa, no acá. Lo
   * crítico es el «ya pagado» del QR de la demo — sin este badge, la
   * farmacia cobraría dos veces.
   */
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

  protected readonly enRetiro = computed(() => this.pedido()?.estado === 'LISTO_PARA_RETIRO');

  /** Renglones en pie que todavía no salieron por el mostrador. */
  protected readonly pendientes = computed<readonly number[]>(() => {
    const abierto = this.pedido();
    if (abierto === null) {
      return [];
    }
    return abierto.lineas.flatMap((linea, indice) =>
      linea.disponible &&
      (linea.fulfilledQuantity ?? 0) < (linea.reservedQuantity ?? linea.cantidad)
        ? [indice]
        : [],
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
      // El total usa únicamente los precios congelados que devolvió la API.
      const precio = Number(linea.precio ?? Number.NaN);
      if (!Number.isFinite(precio)) {
        return null;
      }
      total += precio * linea.cantidad;
    }
    return total.toFixed(2);
  });

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
    const hasUnresolvedSubstitute = ajustes.some(
      (ajuste) => ajuste.decision === 'PROPONER_GENERICO' && ajuste.propuesta === undefined,
    );
    return !todoCaido && !hasUnresolvedSubstitute;
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.cargar(params.get('orderId') ?? ''));
  }

  protected cargar(id: string = this.pedido()?.id ?? ''): void {
    this.state.set(loading());
    this.ordersClient.pedidoParaMostrador(id).subscribe({
      next: (pedido) => {
        if (pedido.estado === 'ENVIADO') {
          this.ordersClient.abrirRevision(pedido.id).subscribe({
            next: (opened) => this.aplicar(opened),
            error: (error: unknown) => this.state.set(errorToViewState<PedidoFarmacia>(error)),
          });
          return;
        }
        this.aplicar(pedido);
      },
      error: (error: unknown) => this.state.set(errorToViewState<PedidoFarmacia>(error)),
    });
  }

  protected cambiarDecision(indice: number, decision: unknown): void {
    const nextDecision = decision as DecisionDeLinea;
    this.actualizarAjuste(indice, () => ({ decision: nextDecision }));
    if (nextDecision === 'PROPONER_GENERICO') {
      this.loadSubstitutes(indice);
    }
  }

  protected selectSubstitute(indice: number, productId: string | null): void {
    const product = this.substituteSearchAt(indice).products.find((item) => item.id === productId);
    this.actualizarAjuste(indice, () =>
      product === undefined
        ? { decision: 'PROPONER_GENERICO' }
        : {
            decision: 'PROPONER_GENERICO',
            propuesta: {
              productId: product.id,
              nombre: visibleProductName(product),
              precio: null,
            },
          },
    );
  }

  protected substituteSearchAt(indice: number): SubstituteSearch {
    return this.substituteSearches()[indice] ?? EMPTY_SUBSTITUTE_SEARCH;
  }

  protected retrySubstitutes(indice: number): void {
    this.loadSubstitutes(indice);
  }

  protected confirmar(): void {
    const abierto = this.pedido();
    if (abierto === null || !this.puedeConfirmar()) {
      return;
    }
    const ajustes: readonly AjusteDeLinea[] = this.ajustes().map((ajuste, indice) => ({
      indice,
      decision: ajuste.decision,
      ...(ajuste.propuesta === undefined ? {} : { propuesta: ajuste.propuesta }),
    }));
    this.ejecutar(this.ordersClient.confirmarPedido(abierto, ajustes));
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
      .dispensar(abierto, { codigo: this.codigo(), indices: [...this.llevados()] })
      .subscribe({
        next: ({ codigoValido, pedido }) => {
          this.ocupado.set(false);
          this.codigoInvalido.set(!codigoValido);
          if (codigoValido && pedido !== null) {
            this.codigo.set('');
            this.aplicar(pedido);
          }
        },
        error: (error: unknown) => {
          this.ocupado.set(false);
          this.state.set(errorToViewState<PedidoFarmacia>(error));
        },
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
    this.substituteSearches.set({});
    this.ajustes.set(
      pedido.lineas.map((linea) => ({
        decision: linea.disponible ? 'TAL_CUAL' : 'NO_DISPONIBLE',
      })),
    );
  }

  private reiniciarRetiro(pedido: PedidoFarmacia): void {
    this.llevados.set(
      new Set(
        pedido.lineas.flatMap((linea, indice) =>
          linea.disponible &&
          (linea.fulfilledQuantity ?? 0) < (linea.reservedQuantity ?? linea.cantidad)
            ? [indice]
            : [],
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

  private loadSubstitutes(indice: number): void {
    const line = this.pedido()?.lineas[indice];
    if (line === undefined) {
      return;
    }
    if (!line.conceptId) {
      this.updateSubstituteSearch(indice, {
        status: 'missing-concept',
        products: [],
        options: [],
      });
      return;
    }

    this.updateSubstituteSearch(indice, { status: 'loading', products: [], options: [] });
    this.pharmacyClient
      .searchProducts({ conceptId: line.conceptId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const products = page.items.filter((product) => product.id !== line.productId);
          this.updateSubstituteSearch(indice, {
            status: 'ready',
            products,
            options: products.map((product) => ({
              value: product.id,
              label: visibleProductName(product),
            })),
          });
        },
        error: () => {
          this.updateSubstituteSearch(indice, { status: 'error', products: [], options: [] });
        },
      });
  }

  private updateSubstituteSearch(indice: number, search: SubstituteSearch): void {
    this.substituteSearches.update((current) => ({ ...current, [indice]: search }));
  }

  private ejecutar(operacion: Observable<unknown>): void {
    this.ocupado.set(true);
    operacion.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.cargar();
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.state.set(errorToViewState<PedidoFarmacia>(error));
      },
    });
  }
}

function visibleProductName(product: PharmacyProduct): string {
  return product.brandName ?? product.genericName ?? product.productCode;
}
