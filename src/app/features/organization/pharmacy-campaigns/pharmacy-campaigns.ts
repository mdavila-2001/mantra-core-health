import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PromotionRuleEditor } from '../../../shared/components/organisms/promotion-rule-editor/promotion-rule-editor';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { displayCurrency } from '../../../core/money/display-currency';
import { describeDraftFailure } from '../../../core/promotions-engine/describe-failure';
import { isOrderLevel } from '../../../core/promotions-engine/mechanic-level';
import type {
  DraftFailure,
  Mechanic,
  PromotableItem,
} from '../../../core/promotions-engine/promotion-mechanics.types';
import { defaultRuleFields, ruleFromFields, textOf } from '../../../core/promotions-engine/rule-fields';
import type { RuleFields } from '../../../core/promotions-engine/rule-fields';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import {
  PharmacyCampaignsClient,
  estadoDe,
  etiquetaDeCampana,
  fallosDelMotor,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import type {
  BorradorDeCampana,
  CampanaDeFarmacia,
  EstadoDeCampana,
  FalloDeBorrador,
  RenglonDeBorrador,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

/** Cuánto dura, por defecto, una campaña nueva. Un mes de mostrador. */
const DIAS_DE_VIGENCIA_POR_DEFECTO = 30;

/**
 * El texto de los fallos que este carril ya nombraba en castellano. Los del
 * motor (`DraftFailure`) los dice `describeDraftFailure()`, su única fuente.
 */
const TEXTO_DEL_FALLO_HEREDADO = {
  SIN_TITULO: 'Ponga un título: es lo primero que va a leer la gente.',
  SIN_PRODUCTOS: 'Agregue al menos un producto de su catálogo.',
  FALTA_FECHA: 'Elija desde qué día y hasta qué día vale la campaña.',
  VIGENCIA_INVERTIDA: 'La fecha de fin no puede ser anterior a la de inicio.',
  PORCENTAJE_FUERA_DE_RANGO: 'El descuento tiene que estar entre 1 % y 99 %.',
  PRECIO_NO_ES_DESCUENTO:
    'Cada precio de campaña tiene que ser menor que el precio normal del producto.',
  MONEDAS_MEZCLADAS: 'Todos los productos de una campaña tienen que estar en la misma moneda.',
} as const;

function textoDelFallo(fallo: FalloDeBorrador): string {
  return fallo in TEXTO_DEL_FALLO_HEREDADO
    ? TEXTO_DEL_FALLO_HEREDADO[fallo as keyof typeof TEXTO_DEL_FALLO_HEREDADO]
    : describeDraftFailure(fallo as DraftFailure);
}

/** Cómo se dice cada estado de vigencia en el panel. */
const TEXTO_DEL_ESTADO: Readonly<Record<EstadoDeCampana, string>> = {
  PROGRAMADA: 'Programada',
  VIGENTE: 'Vigente',
  TERMINADA: 'Terminada',
};

/** Una campaña de la lista, con lo que la fila necesita ya resuelto. */
interface FilaDeCampana {
  readonly campana: CampanaDeFarmacia;
  readonly estado: EstadoDeCampana;
  readonly cuantosProductos: number;
}

/**
 * **Promociones de mi farmacia** (carril FAR-I7): la farmacia crea sus
 * campañas y ve las que ya publicó.
 *
 * ## Por qué es una ruta hermana y no una sección del panel
 *
 * Mismo criterio que la bandeja del mostrador (FAR-I3): el panel de
 * organización es de TP-1 y su componente es un monolito con la agenda, la
 * gente y las solicitudes. Colgarle una sección más obliga a tocarlo; una ruta
 * hermana bajo `administration/` no le toca una línea y se lista igual en la
 * navegación.
 *
 * ## De qué farmacia es la campaña
 *
 * Se elige de `GET /pharmacy/pharmacies`, el directorio publicado. No se
 * deduce del tenant de la sesión porque el front no tiene ese mapeo: al leer
 * sólo conoce `tenantTypeConceptId`, y la relación tenant → farmacia la
 * resuelve el backend. Con una sola farmacia publicada queda elegida sola y no
 * se pregunta nada.
 *
 * ## Los precios los escribe la farmacia
 *
 * `GET /pharmacy/products` publica el catálogo pero **no sus precios** —los
 * precios vigentes viven por sede, y esta pantalla no tiene una sede elegida—.
 * La farmacia escribe el precio normal y el de campaña, que es lo que sabe. El
 * porcentaje es un atajo que rellena los precios de campaña de una vez; lo que
 * se guarda son siempre los dos precios.
 */
@Component({
  selector: 'app-pharmacy-campaigns',
  imports: [
    Alert,
    AppButton,
    Badge,
    DatePicker,
    DatePipe,
    FormField,
    Input,
    Link,
    PageHeader,
    PromotionRuleEditor,
    RouterLink,
    SearchField,
    Select,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './pharmacy-campaigns.html',
  styleUrl: './pharmacy-campaigns.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyCampaigns {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly campaigns = inject(PharmacyCampaignsClient);
  private readonly toasts = inject(ToastService);

  /** El interruptor del carril. Apagado, la pantalla lo dice y no finge. */
  protected readonly activo = this.campaigns.activo;

  /* ─── Qué farmacia ────────────────────────────────────────────────────── */

  protected readonly farmacias = signal<ViewState<readonly SelectOption<string>[]>>(loading());
  protected readonly farmaciaElegida = signal<string | null>(null);

  private readonly nombresPorId = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly opcionesDeFarmacia = computed<readonly SelectOption<string>[]>(
    () => dataOf(this.farmacias()) ?? [],
  );

  protected readonly hayVariasFarmacias = computed(() => this.opcionesDeFarmacia().length > 1);

  protected readonly nombreDeLaFarmacia = computed(() => {
    const id = this.farmaciaElegida();
    return id === null ? '' : (this.nombresPorId().get(id) ?? '');
  });

  /* ─── Las campañas ya publicadas ──────────────────────────────────────── */

  protected readonly lista = signal<ViewState<readonly FilaDeCampana[]>>(loading());

  /** Las filas ya publicadas, o vacío mientras el estado no las tenga. */
  protected readonly filas = computed<readonly FilaDeCampana[]>(
    () => dataOf(this.lista()) ?? [],
  );

  /* ─── El formulario ───────────────────────────────────────────────────── */

  protected readonly titulo = signal('');
  protected readonly descripcion = signal('');
  protected readonly desde = signal<Date | null>(new Date());
  protected readonly hasta = signal<Date | null>(enDias(DIAS_DE_VIGENCIA_POR_DEFECTO));
  /**
   * Lo que se escribió en la regla, como texto. El editor lo pinta y emite el
   * siguiente; acá se convierte a `Mechanic` recién al publicar.
   */
  protected readonly campos = signal<RuleFields>(defaultRuleFields());
  protected readonly renglones = signal<readonly RenglonDeBorrador[]>([]);
  protected readonly publicando = signal(false);
  protected readonly fallos = signal<readonly FalloDeBorrador[]>([]);

  /** La regla ya convertida: mecánica, condiciones y alcance. */
  protected readonly regla = computed(() => ruleFromFields(this.campos()));

  /**
   * La mecánica con los precios de campaña que se escribieron en la lista: el
   * editor no los conoce, porque son por producto.
   */
  private readonly mecanica = computed<Mechanic>(() => {
    const { mechanic } = this.regla();
    if (mechanic.kind !== 'CAMPAIGN_PRICE') {
      return mechanic;
    }
    const prices: Record<string, string> = {};
    for (const renglon of this.renglones()) {
      if (renglon.precioPromocional !== null) {
        prices[renglon.productId] = renglon.precioPromocional;
      }
    }
    return { kind: 'CAMPAIGN_PRICE', prices };
  });

  /** ¿Se eligen productos? No en las de total, ni en «toda la farmacia». */
  protected readonly pideProductos = computed(
    () => !isOrderLevel(this.regla().mechanic) && !this.regla().allItems,
  );

  protected readonly esPrecioPorProducto = computed(
    () => this.regla().mechanic.kind === 'CAMPAIGN_PRICE',
  );

  /** Los productos elegidos, tal como los lee el editor. */
  protected readonly itemsParaElEditor = computed<readonly PromotableItem[]>(() =>
    this.renglones().map((renglon) => ({
      itemId: renglon.productId,
      label: renglon.nombre,
      detail: renglon.presentacion,
      unitPrice: renglon.precioNormal,
      currency: renglon.moneda,
    })),
  );

  /** Los fallos en el idioma del motor, para marcar cada campo del editor. */
  protected readonly fallosParaElEditor = computed(() => fallosDelMotor(this.fallos()));

  protected readonly mensajesDeFallo = computed(() =>
    this.fallos().map(textoDelFallo),
  );

  /* ─── El buscador del catálogo ────────────────────────────────────────── */

  protected readonly termino = signal('');
  protected readonly buscando = signal(false);
  protected readonly resultados = signal<readonly PharmacyProduct[]>([]);
  protected readonly seBusco = signal(false);

  /** Lo que la búsqueda ofrece: su catálogo, sin lo que ya está en la campaña. */
  protected readonly candidatos = computed(() => {
    const yaElegidos = new Set(this.renglones().map((renglon) => renglon.productId));
    const farmacia = this.farmaciaElegida();
    return this.resultados().filter(
      (producto) => producto.pharmacyId === farmacia && !yaElegidos.has(producto.id),
    );
  });

  constructor() {
    this.cargarFarmacias();
  }

  /* ─── Carga ───────────────────────────────────────────────────────────── */

  private cargarFarmacias(): void {
    if (!this.activo) {
      this.farmacias.set(ready([]));
      return;
    }
    this.pharmacy.listPharmacies().subscribe({
      next: (pagina) => {
        const opciones = pagina.items.map((item) => ({
          value: item.id,
          label: item.name,
        }));
        this.nombresPorId.set(new Map(opciones.map((opcion) => [opcion.value, opcion.label])));
        this.farmacias.set(
          opciones.length === 0
            ? empty({
                label: 'Ir al panel de mi organización',
                route: '/administration/my-organization',
              })
            : ready(opciones),
        );
        // Con una sola farmacia no hay nada que preguntar.
        if (opciones.length === 1) {
          this.elegirFarmacia(opciones[0].value);
        }
      },
      error: (error: unknown) =>
        this.farmacias.set(errorToViewState<readonly SelectOption<string>[]>(error)),
    });
  }

  protected elegirFarmacia(id: string | null): void {
    this.farmaciaElegida.set(id);
    this.resultados.set([]);
    this.seBusco.set(false);
    this.renglones.set([]);
    if (id === null) {
      this.lista.set(loading());
      return;
    }
    this.recargarLista(id);
  }

  private recargarLista(pharmacyId: string): void {
    this.lista.set(loading());
    this.campaigns.campanasDeFarmacia(pharmacyId).subscribe({
      next: (campanas) => {
        const filas = campanas.map((campana) => ({
          campana,
          estado: estadoDe(campana),
          cuantosProductos: campana.productos.length,
        }));
        this.lista.set(
          // Sin `route`: la acción no navega, el formulario ya está más abajo
          // en esta misma pantalla.
          filas.length === 0 ? empty({ label: 'Crear la primera' }) : ready(filas),
        );
      },
      error: (error: unknown) => this.lista.set(errorToViewState<readonly FilaDeCampana[]>(error)),
    });
  }

  /* ─── El catálogo ─────────────────────────────────────────────────────── */

  protected buscarEnElCatalogo(termino: string): void {
    const farmacia = this.farmaciaElegida();
    if (farmacia === null) {
      return;
    }
    this.buscando.set(true);
    this.pharmacy.searchProducts({ search: termino.trim(), limit: 25 }).subscribe({
      next: (pagina) => {
        this.resultados.set(pagina.items);
        this.seBusco.set(true);
        this.buscando.set(false);
      },
      error: () => {
        this.resultados.set([]);
        this.seBusco.set(true);
        this.buscando.set(false);
        this.toasts.error('No se pudo consultar el catálogo. Pruebe de nuevo.');
      },
    });
  }

  protected agregar(producto: PharmacyProduct): void {
    const renglon: RenglonDeBorrador = {
      productId: producto.id,
      nombre: nombreVisible(producto),
      presentacion: presentacionDe(producto),
      // Si el catálogo trae el precio vigente, la farmacia no lo tipea de nuevo.
      precioNormal: producto.unitPrice ?? '',
      moneda: 'BOB',
      precioPromocional: null,
    };
    this.renglones.set([...this.renglones(), renglon]);
  }

  protected quitar(productId: string): void {
    this.renglones.set(this.renglones().filter((renglon) => renglon.productId !== productId));
    // Un regalo o un 2x1 entre productos no puede apuntar a uno que ya no está.
    this.campos.update((campos) => ({
      ...campos,
      triggerItemId: campos.triggerItemId === productId ? null : campos.triggerItemId,
      rewardItemId: campos.rewardItemId === productId ? null : campos.rewardItemId,
    }));
  }

  protected fijarTitulo(valor: ValorDeCampo): void {
    this.titulo.set(textoDe(valor));
  }

  /** El porcentaje de la regla. El campo numérico emite un número: se normaliza al borde. */
  protected fijarPorcentaje(valor: ValorDeCampo): void {
    this.campos.update((campos) => ({ ...campos, percent: textOf(valor) }));
  }

  /** El editor emite los campos ya con el cambio aplicado. */
  protected cambiarCampos(siguientes: RuleFields): void {
    this.campos.set(siguientes);
  }

  protected fijarPrecioNormal(productId: string, precio: ValorDeCampo): void {
    this.actualizarRenglon(productId, { precioNormal: textoDe(precio) });
  }

  protected fijarPrecioPromocional(productId: string, precio: ValorDeCampo): void {
    const texto = textoDe(precio);
    this.actualizarRenglon(productId, { precioPromocional: texto === '' ? null : texto });
  }

  private actualizarRenglon(productId: string, cambios: Partial<RenglonDeBorrador>): void {
    this.renglones.set(
      this.renglones().map((renglon) =>
        renglon.productId === productId ? { ...renglon, ...cambios } : renglon,
      ),
    );
  }

  /* ─── Publicar ────────────────────────────────────────────────────────── */

  protected publicar(): void {
    const pharmacyId = this.farmaciaElegida();
    if (pharmacyId === null) {
      // Sin farmacia elegida el formulario ni siquiera está en pantalla.
      return;
    }
    // Las fechas viajan como están, vacías incluidas: quien decide qué le
    // falta al borrador es `revisar()`, y devuelve **todos** los fallos de una
    // vez. Cortar acá con uno solo obligaba a publicar tres veces para
    // enterarse de los tres problemas.
    const { conditions, allItems } = this.regla();
    const borrador: BorradorDeCampana = {
      titulo: this.titulo(),
      descripcion: this.descripcion(),
      desde: this.desde(),
      hasta: this.hasta(),
      mecanica: this.mecanica(),
      condiciones: conditions,
      ...(allItems ? { alcance: { itemIds: [], categoryIds: [], allItems: true } } : {}),
      // Las de total y «toda la farmacia» no apuntan a productos: lo que
      // quedó elegido de antes no se arrastra.
      renglones: this.pideProductos() ? this.renglones() : [],
    };
    this.publicando.set(true);
    this.campaigns.crear(borrador, pharmacyId, this.nombreDeLaFarmacia()).subscribe({
      next: (resultado) => {
        this.publicando.set(false);
        if (Array.isArray(resultado)) {
          this.fallos.set(resultado);
          return;
        }
        this.fallos.set([]);
        this.limpiarFormulario();
        this.recargarLista(pharmacyId);
        this.toasts.success('Su campaña ya está publicada.');
      },
      error: () => {
        this.publicando.set(false);
        this.toasts.error('No se pudo publicar la campaña. Pruebe de nuevo.');
      },
    });
  }

  private limpiarFormulario(): void {
    this.titulo.set('');
    this.descripcion.set('');
    this.desde.set(new Date());
    this.hasta.set(enDias(DIAS_DE_VIGENCIA_POR_DEFECTO));
    this.renglones.set([]);
    this.resultados.set([]);
    this.seBusco.set(false);
    this.termino.set('');
  }

  /* ─── Lo que la plantilla necesita ────────────────────────────────────── */

  protected textoDelEstado(estado: EstadoDeCampana): string {
    return TEXTO_DEL_ESTADO[estado];
  }

  protected tonoDelEstado(estado: EstadoDeCampana): 'success' | 'info' | 'secondary' {
    if (estado === 'VIGENTE') {
      return 'success';
    }
    return estado === 'PROGRAMADA' ? 'info' : 'secondary';
  }

  /** Cómo se resume una campaña ya publicada en su fila: la etiqueta que lee el paciente. */
  protected etiquetaDe(campana: CampanaDeFarmacia): string {
    return etiquetaDeCampana(campana);
  }

  /** La moneda con que el editor rotula los importes. */
  protected readonly moneda = computed(() => displayCurrency(this.renglones()[0]?.moneda));
}

/** El nombre con que se lee un producto: marca, y si no, genérico. */
function nombreVisible(producto: PharmacyProduct): string {
  return producto.brandName ?? producto.genericName ?? producto.productCode;
}

/** «500 mg · caja x 20», con lo que el directorio publique. */
function presentacionDe(producto: PharmacyProduct): string | null {
  const partes = [producto.strengthText, producto.packageSizeText].filter(
    (parte): parte is string => parte !== null && parte !== '',
  );
  return partes.length === 0 ? null : partes.join(' · ');
}

/** Una fecha a N días de hoy. */
function enDias(dias: number): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha;
}

/**
 * Lo que emite `app-input`: el átomo declara `model<string | number | null>` y
 * en un campo `type="number"` devuelve un **número**, no su texto.
 */
type ValorDeCampo = string | number | null;

/**
 * Normaliza al borde lo que llega de un campo.
 *
 * Existe porque la alternativa era un `$any()` en la plantilla, y `$any` apaga
 * exactamente la comprobación que hacía falta: el porcentaje entraba como
 * número a un signal de texto, `enteroDe` moría en `20.trim()` y publicar no
 * hacía nada — sin alerta y sin decir por qué.
 */
function textoDe(valor: ValorDeCampo): string {
  return valor === null ? '' : String(valor);
}
