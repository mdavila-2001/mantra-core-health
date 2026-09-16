import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { PharmacyCampaignsClient } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import {
  normalizado,
  totalDeRenglones,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import {
  MODALIDADES_DE_ENTREGA,
  type BorradorDePedido,
  type LineaDePedido,
  type ModalidadDeEntrega,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';
import {
  DATOS_DE_EJEMPLO_DE_LA_RECETA,
  NOTA_DE_DATOS_DE_EJEMPLO,
  type AlternativaDeEjemplo,
  type DatosDeEjemploDeLaReceta,
} from './new-order.fixtures';
import {
  CLAVE_DEL_TRASPASO,
  RUTA_DEL_CHECKOUT,
  type TraspasoDeLaReceta,
} from './new-order.handoff';
import { OrderAlternatives } from './order-alternatives/order-alternatives';

/** Menos de una unidad no es un renglón: para no pedirlo está «Volver». */
const CANTIDAD_MINIMA = 1;

/** Lo que la persona decidió sobre un renglón. */
interface EleccionDeRenglon {
  readonly cantidad: number;
  readonly alternativaId: string | null;
}

/** Un renglón listo para pintar: el del borrador más lo que se eligió. */
interface RenglonVisible {
  readonly indice: number;
  /** La línea del borrador, intacta. */
  readonly linea: LineaDePedido;
  readonly medicamento: string;
  readonly presentacion: string | null;
  readonly cantidad: number;
  readonly cantidadRecetada: number;
  /** El precio unitario sin campaña: el de la alternativa o el de la sede. */
  readonly precioDeLista: string | null;
  /** El precio de campaña (FAR-I7), sólo sobre la recetada. */
  readonly precioPromocional: string | null;
  readonly subtotal: string | null;
  readonly alternativa: AlternativaDeEjemplo | null;
  readonly alternativas: readonly AlternativaDeEjemplo[];
  readonly aprobadoPorSeguro: boolean;
  /** Variante con seguro y renglón aprobado: no suma ni ofrece alternativas. */
  readonly cubierto: boolean;
  readonly ofreceAlternativas: boolean;
}

/**
 * La dirección de ejemplo con que la demo ejercita los envíos. El backend no
 * expone todavía las direcciones del paciente (mismo bloqueador que anotó
 * «dónde comprar mi receta»): sin el gate de demostración los envíos se
 * ofrecen deshabilitados y con el porqué escrito.
 */
/**
 * **Confirmá tu pedido** (carril FAR-I2), extendida como **la orden médica
 * como pedido** (T-E1): el paso entre «dónde comprar mi receta» y el checkout.
 *
 * ## De dónde salen los datos
 *
 * Del **borrador** que la pantalla anterior dejó en el cliente al tocar
 * «Enviar pedido»: renglones ya evaluados contra la sede, con lo que la
 * farmacia no tiene dicho claro. Nada viaja por la URL — ni ids de productos
 * ni datos de la persona— y no se repite ninguna consulta.
 *
 * El borrador se **copia al construir**. Quien recarga o entra por URL directa
 * no tiene borrador y ve la salida honesta hacia su historia.
 *
 * Sobre el borrador, T-E1 dibuja lo que todavía no tiene contrato —cabecera
 * de la receta, cantidad dentro de lo recetado, alternativas por renglón y la
 * variante con seguro— con los datos de ejemplo de `new-order.fixtures.ts`,
 * rotulados como tales. **Nada de eso toca el borrador**: vive en señales de
 * esta pantalla.
 *
 * ## Desde acá no se crea ningún pedido (D-FARMOCK-T-E1-01)
 *
 * El pedido real se crea en la confirmación final del checkout. «Continuar»
 * conserva el borrador y lleva las elecciones en el estado de la navegación
 * (`new-order.handoff.ts`); mientras el checkout no exista, se ofrece
 * deshabilitado. Ninguna acción de esta pantalla llama a
 * `PharmacyOrdersClient.enviar()`: esa capacidad real sigue intacta en el
 * cliente para la confirmación final.
 *
 * ## La modalidad dice la verdad
 *
 * «Retiro en la farmacia» es el default del contrato y lo único elegible hoy:
 * los envíos existen para que se sepa que vienen, pero sin direcciones del
 * paciente en el backend quedan deshabilitados y con el porqué escrito.
 */
@Component({
  selector: 'app-new-order',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    DatePipe,
    FormField,
    OrderAlternatives,
    PageHeader,
    Radio,
    RadioGroup,
    RouterLink,
    Skeleton,
    Switch,
    ViewStateHost,
  ],
  templateUrl: './new-order.html',
  styleUrl: './new-order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrder {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documento = inject(DOCUMENT);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly fuenteDeEjemplo = inject(DATOS_DE_EJEMPLO_DE_LA_RECETA);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;

  /** La copia del borrador (ver el JSDoc de la clase). */
  protected readonly borrador = this.ordersClient.borradorPreparado();

  /** Medications that block the complete order under the approved policy. */
  protected readonly unresolvedProductNames =
    this.borrador?.lineas
      .filter((line) => line.productId === null)
      .map((line) => line.medicamento) ?? [];

  protected readonly hasUnresolvedProducts = this.unresolvedProductNames.length > 0;

  /** Vuelve a la consulta de sedes de la misma receta. */
  protected readonly rutaDeVuelta =
    this.borrador === null
      ? MI_HISTORIA_ROUTE
      : `/my-account/medical-record/where-to-buy/${this.borrador.requestId}`;

  /* ---- los datos de ejemplo (T-E1) ----------------------------------------- */

  protected readonly datos = signal<DatosDeEjemploDeLaReceta | null>(null);
  private readonly falloDeLosDatos = signal<ViewState<BorradorDePedido> | null>(null);

  /**
   * Sin borrador, la salida honesta hacia la historia; con un borrador vacío,
   * la vuelta a las sucursales; y mientras los datos de ejemplo no llegan, el
   * esqueleto.
   */
  protected readonly estado = computed<ViewState<BorradorDePedido>>(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return notFound({ label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE });
    }
    if (borrador.lineas.length === 0) {
      return empty(
        { label: 'Volver a las sucursales', route: this.rutaDeVuelta },
        'Este pedido no tiene medicamentos para confirmar.',
      );
    }
    const fallo = this.falloDeLosDatos();
    if (fallo !== null) {
      return fallo;
    }
    return this.datos() === null ? loading() : ready(borrador);
  });

  /* ---- las promociones del pedido (FAR-I7) --------------------------------- */

  private readonly campaigns = inject(PharmacyCampaignsClient);

  /**
   * Los renglones que alguna campaña vigente de esta farmacia alcanza.
   *
   * Se resuelve una sola vez al construir, como el borrador: el pedido ya está
   * congelado y nada de esta pantalla lo cambia.
   */
  protected readonly renglonesEnPromocion = this.resolverPromociones();

  /** El total con los precios promocionales aplicados, o `null`. */
  protected readonly totalConPromocion = this.calcularTotalConPromocion();

  /**
   * El total del borrador **no se reescribe**: se muestra al lado del
   * promocional.
   *
   * El precio congelado es del backend, y el cálculo de FAR-E1 es de Ender (la
   * regla que tiene que agregar está en `COORDINACION-AGENTES.md`). Bakear el
   * descuento en el borrador haría que la cifra enviada difiera de la que la
   * API vuelve a calcular y congelar.
   */
  private resolverPromociones(): ReadonlyMap<string, string> {
    const borrador = this.borrador;
    if (borrador === null) {
      return new Map();
    }
    const enPromocion = new Map<string, string>();
    for (const linea of borrador.lineas) {
      if (linea.productId === null || !linea.disponible) {
        continue;
      }
      const promocional = this.campaigns.precioPromocional(borrador.pharmacyId, linea.productId);
      if (promocional !== null) {
        enPromocion.set(linea.productId, promocional.precioPromocional);
      }
    }
    return enPromocion;
  }

  private calcularTotalConPromocion(): string | null {
    const borrador = this.borrador;
    if (borrador === null || this.renglonesEnPromocion.size === 0) {
      return null;
    }
    return totalDeRenglones(
      borrador.lineas
        .filter((linea) => linea.disponible)
        .map((linea) => ({
          precio:
            (linea.productId === null
              ? null
              : (this.renglonesEnPromocion.get(linea.productId) ?? null)) ??
            linea.precio ??
            '',
          cantidad: linea.cantidad,
        })),
    );
  }

  /** El precio de campaña de un renglón, o `null` si ninguna lo alcanza. */
  protected precioPromocionalDe(productId: string | null): string | null {
    return productId === null ? null : (this.renglonesEnPromocion.get(productId) ?? null);
  }

  /**
   * El precio de lista con el mismo formato que el promocional.
   *
   * `GET /pharmacy-inventory/availability` devuelve el `numeric` tal cual —
   * `"22.5"`—, y el promocional sale de la aritmética en centavos, siempre con
   * dos decimales. Sueltos no molesta; puestos uno al lado del otro, «antes
   * 22.5 · ahora 14.62» se lee como un descuido, y el descuido está sobre el
   * número que la paciente va a pagar.
   *
   * Lo que no es un importe vuelve **como vino**: mejor un formato raro que un
   * precio que desaparece de la pantalla.
   */
  protected precioNormalizado(importe: string | null): string | null {
    return importe === null ? null : (normalizado(importe) ?? importe);
  }

  /** `true` si hay al menos un renglón en promoción: gobierna el banner. */
  protected readonly hayPromocion = this.renglonesEnPromocion.size > 0;

  /* ---- la receta como pedido (T-E1) ---------------------------------------- */

  protected readonly elecciones = signal<readonly EleccionDeRenglon[]>(
    this.borrador?.lineas.map((linea) => ({ cantidad: linea.cantidad, alternativaId: null })) ??
      [],
  );

  /** El conmutador de demostración de la variante con seguro. */
  protected readonly conSeguro = signal(false);

  /** El renglón cuyo panel de alternativas está abierto, o `null`. */
  protected readonly panelAbierto = signal<number | null>(null);

  protected readonly renglones = computed<readonly RenglonVisible[]>(() => {
    const borrador = this.borrador;
    const datos = this.datos();
    if (borrador === null || datos === null) {
      return [];
    }
    const conSeguro = this.conSeguro();
    const elecciones = this.elecciones();
    return borrador.lineas.map((linea, indice): RenglonVisible => {
      const deEjemplo = datos.renglones[indice];
      const eleccion = elecciones[indice] ?? { cantidad: linea.cantidad, alternativaId: null };
      const aprobadoPorSeguro = deEjemplo?.aprobadoPorSeguro ?? false;
      // Lo que la sede no tiene no se reparte con nadie: sigue diciendo que falta.
      const cubierto = conSeguro && aprobadoPorSeguro && linea.disponible;
      const alternativas = deEjemplo?.alternativas ?? [];
      // Con seguro, un aprobado muestra la recetada: la elección se conserva
      // y vuelve si se apaga el conmutador.
      const alternativa = cubierto
        ? null
        : (alternativas.find((opcion) => opcion.id === eleccion.alternativaId) ?? null);
      const precioDeLista = alternativa?.precio ?? this.precioNormalizado(linea.precio);
      const precioPromocional =
        alternativa === null ? this.precioPromocionalDe(linea.productId) : null;
      const precioUnitario = precioPromocional ?? precioDeLista;
      return {
        indice,
        linea,
        medicamento: alternativa?.nombre ?? linea.medicamento,
        presentacion: alternativa?.presentacion ?? linea.presentacion,
        cantidad: eleccion.cantidad,
        cantidadRecetada: deEjemplo?.cantidadRecetada ?? linea.cantidad,
        precioDeLista,
        precioPromocional,
        subtotal:
          linea.disponible && precioUnitario !== null
            ? totalDeRenglones([{ precio: precioUnitario, cantidad: eleccion.cantidad }])
            : null,
        alternativa,
        alternativas,
        aprobadoPorSeguro,
        cubierto,
        ofreceAlternativas: linea.disponible && alternativas.length > 0 && !cubierto,
      };
    });
  });

  /** Algo en pantalla ya no es el borrador tal como lo armó la sucursal. */
  protected readonly hayCambiosDeDemostracion = computed(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return false;
    }
    return (
      this.conSeguro() ||
      this.elecciones().some(
        (eleccion, indice) =>
          eleccion.alternativaId !== null || eleccion.cantidad !== borrador.lineas[indice]?.cantidad,
      )
    );
  });

  /**
   * El total recalculado con las elecciones: renglones disponibles y, con
   * seguro, sólo los no aprobados. `null` si falta algún precio.
   */
  protected readonly totalConCambios = computed(() => {
    const suman = this.renglones().filter((renglon) => renglon.linea.disponible && !renglon.cubierto);
    if (suman.some((renglon) => renglon.subtotal === null)) {
      return null;
    }
    return totalDeRenglones(
      suman.map((renglon) => ({ precio: renglon.subtotal ?? '', cantidad: 1 })),
    );
  });

  protected readonly renglonesCubiertos = computed(
    () => this.renglones().filter((renglon) => renglon.cubierto).length,
  );

  /* ---- el paso siguiente (D-FARMOCK-T-E1-01) ------------------------------- */

  /** La ruta del checkout, o `null` mientras T-E3 no la publique. */
  protected readonly rutaDelCheckout = inject(RUTA_DEL_CHECKOUT);

  protected readonly puedeContinuar = computed(
    () => this.rutaDelCheckout !== null && !this.hasUnresolvedProducts && this.datos() !== null,
  );

  /** `true` desde que «Continuar» navega: el borrador ya no se descarta. */
  private continuando = false;

  constructor() {
    // Salir sin continuar descarta el borrador: quien vuelve atrás no deja un
    // pedido a medias esperando en la sesión. Tras continuar no se toca,
    // porque el checkout lo necesita.
    this.destroyRef.onDestroy(() => {
      if (!this.continuando) {
        this.ordersClient.descartarBorrador();
      }
    });
    this.cargarDatosDeEjemplo();
  }

  protected cargarDatosDeEjemplo(): void {
    const borrador = this.borrador;
    if (borrador === null || borrador.lineas.length === 0) {
      return;
    }
    this.falloDeLosDatos.set(null);
    this.datos.set(null);
    this.fuenteDeEjemplo(borrador)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.datos.set(datos),
        error: (error: unknown) =>
          this.falloDeLosDatos.set(errorToViewState<BorradorDePedido>(error)),
      });
  }

  protected cambiarCantidad(indice: number, paso: 1 | -1): void {
    const renglon = this.renglones()[indice];
    if (renglon === undefined) {
      return;
    }
    const siguiente = renglon.cantidad + paso;
    if (siguiente < CANTIDAD_MINIMA || siguiente > renglon.cantidadRecetada) {
      return;
    }
    this.actualizarEleccion(indice, { cantidad: siguiente });
  }

  protected alternarAlternativas(indice: number): void {
    this.panelAbierto.update((abierto) => (abierto === indice ? null : indice));
  }

  protected elegirAlternativa(indice: number, alternativa: AlternativaDeEjemplo): void {
    this.actualizarEleccion(indice, { alternativaId: alternativa.id });
    this.cerrarPanel(indice);
  }

  protected restaurarRecetada(indice: number): void {
    this.actualizarEleccion(indice, { alternativaId: null });
    this.cerrarPanel(indice);
  }

  protected alElegirSeguro(activo: boolean): void {
    this.conSeguro.set(activo);
    const abierto = this.panelAbierto();
    if (abierto !== null && !(this.renglones()[abierto]?.ofreceAlternativas ?? false)) {
      this.panelAbierto.set(null);
    }
  }

  /**
   * Lleva al checkout con el borrador intacto y las elecciones en el estado de
   * la navegación. No crea el pedido ni llama a la API.
   */
  protected continuar(): void {
    const ruta = this.rutaDelCheckout;
    if (ruta === null || !this.puedeContinuar()) {
      return;
    }
    const traspaso: TraspasoDeLaReceta = {
      conSeguro: this.conSeguro(),
      renglones: this.renglones().map((renglon) => ({
        indice: renglon.indice,
        cantidad: renglon.cantidad,
        alternativa: renglon.alternativa,
        aprobadoPorSeguro: renglon.aprobadoPorSeguro,
      })),
    };
    this.continuando = true;
    this.router.navigate([ruta], { state: { [CLAVE_DEL_TRASPASO]: traspaso } }).then(
      (navego) => {
        if (!navego) {
          this.continuando = false;
        }
      },
      () => {
        this.continuando = false;
      },
    );
  }

  protected readonly modalidad = signal<ModalidadDeEntrega>('RETIRO');

  /** El grupo de radios entrega `unknown`; acá se estrecha o se ignora. */
  protected alElegirModalidad(valor: unknown): void {
    if (esModalidad(valor)) {
      this.modalidad.set(valor);
    }
  }

  private actualizarEleccion(indice: number, cambio: Partial<EleccionDeRenglon>): void {
    this.elecciones.update((actuales) =>
      actuales.map((eleccion, i) => (i === indice ? { ...eleccion, ...cambio } : eleccion)),
    );
  }

  /**
   * Elegir o restaurar desmonta el botón que tenía el foco: sin esto cae al
   * `body`. Vuelve al botón que abrió el panel, que sigue en el renglón.
   */
  private cerrarPanel(indice: number): void {
    this.panelAbierto.set(null);
    if (!this.esBrowser) {
      return;
    }
    queueMicrotask(() =>
      this.documento.getElementById(`pedido-ver-alternativas-${indice}`)?.focus(),
    );
  }
}

function esModalidad(valor: unknown): valor is ModalidadDeEntrega {
  return (MODALIDADES_DE_ENTREGA as readonly unknown[]).includes(valor);
}
