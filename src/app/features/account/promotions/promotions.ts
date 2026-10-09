import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';

import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import { PromotionsClient } from '@core/data-access/promotions/promotions.client';
import type { MyPromotionDto } from '@core/data-access/promotions/promotions.dto';
import { errorToViewState } from '@core/http/error-to-view-state';
import { SAMPLE_DATA_ENABLED } from '@core/mock/sample-data';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import type { SearchResultItem } from '@shared/components/molecules/search-result/search-result.types';
import {
  DepartmentMap,
  type DepartamentoElegible,
} from '@shared/components/organisms/department-map/department-map';
import { DirectoryPage } from '@shared/components/organisms/directory-page/directory-page';
import type {
  GrupoDeDirectorio,
  SustantivoDelDirectorio,
} from '@shared/components/organisms/directory-page/directory-page.types';
import { SEARCH_PARAM, type FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';
import { departamentoPorCiudad, normalizarLugar } from '@shared/geo/city-department';

import { promocionesDeEjemplo, type Promocion } from './promotions.fixtures';

const PARAM_CIUDAD = 'ciudad';
const PARAM_VIGENTES = 'vigentes';
const PARAM_DEPARTAMENTO = 'departamento';
const PARAM_CATEGORIA = 'categoria';

const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'promoción encontrada',
  plural: 'promociones encontradas',
};

/** A dónde lleva una promoción: la pestaña «Comprar» de Farmacia. */
const RUTA_DE_COMPRA = '/my-account/pharmacy';

/** Lo que se ofrece mientras no haya promociones que mostrar. */
const SEARCH_PHARMACIES_ACTION = { label: 'Buscar farmacias', route: '/search/medications' };

/** El vacío contra la API real: la consulta se hizo y no hay ninguna vigente. */
const NONE_CURRENT_MESSAGE =
  'Por ahora no tiene promociones vigentes. Cuando haya una para usted, va a aparecer acá.';

/**
 * El grupo de las promociones que no declaran ciudad. El contrato no relaciona
 * una promoción con un lugar, así que no se le inventa uno.
 */
const NO_CITY_GROUP = 'Sin ciudad declarada';

/** Sobre qué aplica el descuento, en palabras (`appliesTo` del contrato). */
const CATEGORY_BY_TARGET: Readonly<Record<string, { code: string; label: string }>> = {
  TARGET_ORDER: { code: 'toda-la-compra', label: 'En toda la compra' },
  TARGET_ITEM: { code: 'un-producto', label: 'En un producto' },
  TARGET_CATEGORY: { code: 'una-categoria', label: 'En una categoría' },
};

const GENERIC_CATEGORY = { code: 'promocion', label: 'Promoción' };

/**
 * Una promoción del contrato (`GET /promotions/me`) en la forma que dibuja el
 * directorio. Lo que el contrato no trae —farmacia, ciudad, medicamento,
 * puntos— queda `null`; el descuento sale de su primera regla. Todas son
 * vigentes (el backend no sirve otra cosa) y no hay registro de cuáles ya
 * vio la persona, así que ninguna se marca «Nueva».
 */
export function promotionFromContract(promotion: MyPromotionDto): Promocion {
  const discount = promotion.discounts[0];
  const percentage = discount?.percentage == null ? null : Number(discount.percentage);
  return {
    id: promotion.id,
    farmacia: null,
    farmaciaVerificada: false,
    ciudad: null,
    titulo: promotion.name,
    medicamento: null,
    categoria:
      (discount?.appliesTo && CATEGORY_BY_TARGET[discount.appliesTo.code]) ?? GENERIC_CATEGORY,
    porcentaje: percentage === null || !Number.isFinite(percentage) ? null : Math.round(percentage),
    montoFijo:
      discount?.fixedAmount == null
        ? null
        : [discount.fixedAmount, discount.currency?.code].filter(Boolean).join(' '),
    desde: promotion.validFrom === null ? null : new Date(promotion.validFrom),
    hasta: promotion.validTo === null ? null : new Date(promotion.validTo),
    factorDePuntos: null,
    estado: 'vista',
    cupones: promotion.coupons.map((coupon) => coupon.code),
  };
}

const FECHA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' });

/**
 * **Promociones** del paciente, con la anatomía de los directorios: mapa de
 * Bolivia, buscador, chips de categoría, ciudad y vigencia, y la grilla por
 * ciudad. Los cortes viven en la URL, igual que en el directorio de farmacias
 * (`PublicDirectoryListing`), así que un enlace filtrado se puede compartir.
 *
 * En `mockup` los datos son de ejemplo, con farmacia, ciudad y medicamento.
 * Contra la API real (`SAMPLE_DATA_ENABLED` apagado, ver
 * `core/mock/sample-data.ts`) salen de `GET /promotions/me` (B-REAL-13): las
 * vigentes para la persona, sin lugar ni farmacia, porque el contrato no los
 * relaciona con una promoción.
 */
@Component({
  selector: 'app-promotions',
  imports: [AppButton, DepartmentMap, DirectoryPage],
  templateUrl: './promotions.html',
  styleUrl: '../../public-directories/directory-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Promotions {
  private readonly router = inject(Router);
  private readonly promotions = inject(PromotionsClient);
  private readonly ruta = inject(ActivatedRoute);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sustantivo = SUSTANTIVO;

  /** Maqueta (`true`) o API real (`false`): ver la nota de la clase. */
  private readonly sampleData = inject(SAMPLE_DATA_ENABLED);

  private readonly todas = signal<readonly Promocion[]>(
    this.sampleData ? promocionesDeEjemplo() : [],
  );

  protected readonly estado = signal<ViewState<readonly Promocion[]>>(
    !this.sampleData
      ? loading()
      : this.todas().length === 0
        ? empty(
            SEARCH_PHARMACIES_ACTION,
            'Cuando las farmacias le manden promociones, van a aparecer acá.',
          )
        : ready(this.todas()),
  );

  /* ---- el mapa ------------------------------------------------------------ */

  private readonly ramas = signal<readonly RamaDepartamento[]>([]);
  protected readonly catalogoGeoCaido = signal(false);

  protected readonly departamentos = computed<readonly DepartamentoElegible[]>(() =>
    this.ramas().map((rama) => ({
      conceptId: rama.conceptId,
      sigla: rama.sigla,
      nombre: rama.nombre,
    })),
  );

  private readonly porCiudad = computed(() => departamentoPorCiudad(this.ramas()));

  /* ---- los cortes, leídos de la URL ------------------------------------- */

  private readonly parametros = toSignal(this.ruta.queryParams, { initialValue: {} as Params });

  private parametro(clave: string): string | null {
    const valor: unknown = this.parametros()[clave];
    return typeof valor === 'string' && valor !== '' ? valor : null;
  }

  protected readonly departamentoElegido = computed(() => this.parametro(PARAM_DEPARTAMENTO));
  protected readonly ciudad = computed(() => this.parametro(PARAM_CIUDAD));
  private readonly categoria = computed(() => this.parametro(PARAM_CATEGORIA));
  private readonly soloVigentes = computed(() => this.parametro(PARAM_VIGENTES) === 'true');
  private readonly termino = computed(() => normalizarLugar(this.parametro(SEARCH_PARAM) ?? ''));

  private departamentoDe(promo: Promocion): string | undefined {
    return promo.ciudad === null ? undefined : this.porCiudad().get(normalizarLugar(promo.ciudad));
  }

  /** Texto, vigencia y categoría: los cortes que no dependen del lugar. */
  private readonly paraElMapa = computed(() => {
    const termino = this.termino();
    const soloVigentes = this.soloVigentes();
    const categoria = this.categoria();
    return this.todas().filter(
      (promo) =>
        (termino === '' || coincide(promo, termino)) &&
        (!soloVigentes || promo.estado !== 'vencida') &&
        (categoria === null || promo.categoria.code === categoria),
    );
  });

  protected readonly cuentaPorDepartamento = computed<ReadonlyMap<string, number>>(() => {
    const cuenta = new Map<string, number>();
    for (const promo of this.paraElMapa()) {
      const conceptId = this.departamentoDe(promo);
      if (conceptId !== undefined) cuenta.set(conceptId, (cuenta.get(conceptId) ?? 0) + 1);
    }
    return cuenta;
  });

  protected readonly resumenDelMapa = computed<string | null>(() => {
    const elegido = this.departamentoElegido();
    if (elegido === null) return null;
    const nombre = this.ramas().find((rama) => rama.conceptId === elegido)?.nombre ?? '';
    const cuantas = this.cuentaPorDepartamento().get(elegido) ?? 0;
    return cuantas === 0
      ? `Todavía no hay promociones en ${nombre}.`
      : `${cuantas} en ${nombre}. Toque otra vez el departamento para ver todo el país.`;
  });

  /** Con el departamento, sin la ciudad ni la categoría: base de los chips. */
  private readonly delDepartamento = computed(() => {
    const departamento = this.departamentoElegido();
    const termino = this.termino();
    const soloVigentes = this.soloVigentes();
    return this.todas().filter(
      (promo) =>
        (departamento === null || this.departamentoDe(promo) === departamento) &&
        (termino === '' || coincide(promo, termino)) &&
        (!soloVigentes || promo.estado !== 'vencida'),
    );
  });

  private readonly filtradas = computed(() => {
    const ciudad = this.ciudad();
    const categoria = this.categoria();
    return this.delDepartamento().filter(
      (promo) =>
        (ciudad === null || promo.ciudad === ciudad) &&
        (categoria === null || promo.categoria.code === categoria),
    );
  });

  protected readonly tramos = computed<readonly GrupoDeDirectorio[]>(() => {
    const porCiudad = new Map<string, Promocion[]>();
    for (const promo of this.filtradas()) {
      const ciudad = promo.ciudad ?? NO_CITY_GROUP;
      porCiudad.set(ciudad, [...(porCiudad.get(ciudad) ?? []), promo]);
    }
    return [...porCiudad.entries()]
      .map(([ciudad, promos]) => ({
        id: normalizarLugar(ciudad).replace(/\s+/g, '-'),
        nombre: ciudad,
        resultados: promos.sort(porVigenciaYDescuento).map(aTarjeta),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const ciudad = this.ciudad();
    const base = this.delDepartamento().filter(
      (promo) => ciudad === null || promo.ciudad === ciudad,
    );
    const categorias = contar(base.map((promo) => [promo.categoria.code, promo.categoria.label]));

    const filtros: FilterDef[] = [];
    if (categorias.length > 1) {
      filtros.push({
        key: PARAM_CATEGORIA,
        label: 'Categoría',
        asChips: true,
        options: categorias,
      });
    }
    filtros.push({
      key: PARAM_VIGENTES,
      label: 'Vigencia',
      asChips: true,
      options: [{ value: 'true', label: 'Sólo vigentes' }],
    });

    if (this.departamentoElegido() !== null) {
      const ciudades = contar(
        this.delDepartamento().flatMap((promo) =>
          promo.ciudad === null ? [] : [[promo.ciudad, promo.ciudad] as const],
        ),
      );
      if (ciudades.length > 1) {
        filtros.unshift({ key: PARAM_CIUDAD, label: 'Ciudad', asChips: true, options: ciudades });
      }
    }
    return filtros;
  });

  protected readonly sinCoincidencias = computed<string | null>(() => {
    if (this.tramos().length > 0 || this.estado().status !== 'ready') return null;
    return this.departamentoElegido() === null
      ? 'Ninguna promoción coincide con los filtros que puso. Pruebe quitando alguno.'
      : 'No hay promociones en ese departamento con los filtros que puso. Tóquelo otra vez en el mapa para ver todo el país.';
  });

  constructor() {
    this.leerGeografia();
    if (!this.sampleData) {
      this.loadMine();
    }
  }

  /** Vuelve a pedir las promociones (el reintento del estado de error). */
  protected reloadPromotions(): void {
    if (!this.sampleData) {
      this.loadMine();
    }
  }

  /** Las vigentes para la persona, desde `GET /promotions/me`. */
  private loadMine(): void {
    this.estado.set(loading());
    this.promotions
      .listMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const promos = page.items.map(promotionFromContract);
          this.todas.set(promos);
          this.estado.set(
            promos.length === 0
              ? empty(SEARCH_PHARMACIES_ACTION, NONE_CURRENT_MESSAGE)
              : ready(promos),
          );
        },
        error: (error: unknown) =>
          this.estado.set(errorToViewState<readonly Promocion[]>(error)),
      });
  }

  protected elegirDepartamento(conceptId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_DEPARTAMENTO]: conceptId, [PARAM_CIUDAD]: null },
      queryParamsHandling: 'merge',
    });
  }

  protected reintentarGeo(): void {
    this.municipios.olvidar();
    this.leerGeografia();
  }

  private leerGeografia(): void {
    this.catalogoGeoCaido.set(false);
    this.municipios
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ramas: readonly RamaDepartamento[]) => this.ramas.set(ramas),
        error: () => {
          this.ramas.set([]);
          this.catalogoGeoCaido.set(true);
        },
      });
  }
}

function coincide(promo: Promocion, termino: string): boolean {
  return [promo.titulo, promo.farmacia, promo.medicamento, promo.categoria.label].some(
    (campo) => campo !== null && normalizarLugar(campo).includes(termino),
  );
}

/** Opciones de chip de la que más tiene a la que menos, y a igualdad por nombre. */
function contar(pares: readonly (readonly [string, string])[]): { value: string; label: string }[] {
  const cuenta = new Map<string, { label: string; total: number }>();
  for (const [value, label] of pares) {
    cuenta.set(value, { label, total: (cuenta.get(value)?.total ?? 0) + 1 });
  }
  return [...cuenta.entries()]
    .sort(([, a], [, b]) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
    .map(([value, { label }]) => ({ value, label }));
}

function porVigenciaYDescuento(a: Promocion, b: Promocion): number {
  const vencidaA = a.estado === 'vencida' ? 1 : 0;
  const vencidaB = b.estado === 'vencida' ? 1 : 0;
  return vencidaA - vencidaB || (b.porcentaje ?? 0) - (a.porcentaje ?? 0);
}

function aTarjeta(promo: Promocion): SearchResultItem {
  const sellos: { label: string; tone: 'ok' | 'neutro' | 'info' | 'aviso' | 'error' }[] = [];
  if (promo.estado === 'nueva') sellos.push({ label: 'Nueva', tone: 'info' });
  if (promo.estado === 'vencida') sellos.push({ label: 'Vencida', tone: 'neutro' });
  else sellos.push({ label: 'Vigente', tone: 'ok' });
  if (promo.factorDePuntos !== null)
    sellos.push({ label: `Puntos x${promo.factorDePuntos}`, tone: 'aviso' });
  if (promo.farmaciaVerificada) sellos.push({ label: 'Farmacia verificada', tone: 'ok' });

  // La tarjeta muestra dos líneas de contexto: el cupón propio va en el
  // subtítulo, que en una promoción del contrato queda libre (no trae farmacia
  // ni medicamento).
  const subtitle =
    [promo.farmacia, promo.medicamento].filter(Boolean).join(' · ') ||
    (promo.cupones.length === 0 ? '' : `Su cupón: ${promo.cupones.join(', ')}`);
  return {
    id: promo.id,
    title: promo.titulo,
    link: RUTA_DE_COMPRA,
    ...(promo.porcentaje !== null
      ? { figureText: `-${promo.porcentaje}%` }
      : promo.montoFijo !== null
        ? { figureText: `-${promo.montoFijo}` }
        : {}),
    ...(subtitle === '' ? {} : { subtitle }),
    meta: [
      { text: promo.categoria.label },
      { text: validityText(promo.desde, promo.hasta) },
    ],
    seals: sellos,
  };
}

/** La ventana de la promoción en palabras, diciendo lo que no declara. */
function validityText(desde: Date | null, hasta: Date | null): string {
  if (desde !== null && hasta !== null) {
    return `Del ${FECHA.format(desde)} al ${FECHA.format(hasta)}`;
  }
  if (hasta !== null) return `Hasta el ${FECHA.format(hasta)}`;
  if (desde !== null) return `Desde el ${FECHA.format(desde)}, sin fecha de fin`;
  return 'Sin fecha de fin';
}
