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
import { empty, ready } from '@core/view-state/view-state';
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
import { departamentoPorCiudad, normalizarLugar } from '@shared/geo/departamento-de-ciudad';

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

const FECHA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' });

/**
 * **Promociones** del paciente, con la anatomía de los directorios: mapa de
 * Bolivia, buscador, chips de categoría, ciudad y vigencia, y la grilla por
 * ciudad. Los cortes viven en la URL, igual que en el directorio de farmacias
 * (`PublicDirectoryListing`), así que un enlace filtrado se puede compartir.
 *
 * En `mockup` los datos son de ejemplo: la API todavía no publica las
 * promociones recibidas (B-REAL-13).
 */
@Component({
  selector: 'app-promotions',
  imports: [AppButton, DepartmentMap, DirectoryPage],
  templateUrl: './promotions.html',
  styleUrl: '../../public-directories/mapa-directorio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Promotions {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sustantivo = SUSTANTIVO;

  private readonly todas = promocionesDeEjemplo();

  protected readonly estado = signal<ViewState<readonly Promocion[]>>(
    this.todas.length === 0
      ? empty(
          { label: 'Buscar farmacias', route: '/search/medications' },
          'Cuando las farmacias te manden promociones, van a aparecer acá.',
        )
      : ready(this.todas),
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
  private readonly ciudad = computed(() => this.parametro(PARAM_CIUDAD));
  private readonly categoria = computed(() => this.parametro(PARAM_CATEGORIA));
  private readonly soloVigentes = computed(() => this.parametro(PARAM_VIGENTES) === 'true');
  private readonly termino = computed(() => normalizarLugar(this.parametro(SEARCH_PARAM) ?? ''));

  private departamentoDe(promo: Promocion): string | undefined {
    return this.porCiudad().get(normalizarLugar(promo.ciudad));
  }

  /** Texto, vigencia y categoría: los cortes que no dependen del lugar. */
  private readonly paraElMapa = computed(() => {
    const termino = this.termino();
    const soloVigentes = this.soloVigentes();
    const categoria = this.categoria();
    return this.todas.filter(
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
      : `${cuantas} en ${nombre}. Tocá otra vez el departamento para ver todo el país.`;
  });

  /** Con el departamento, sin la ciudad ni la categoría: base de los chips. */
  private readonly delDepartamento = computed(() => {
    const departamento = this.departamentoElegido();
    const termino = this.termino();
    const soloVigentes = this.soloVigentes();
    return this.todas.filter(
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
      porCiudad.set(promo.ciudad, [...(porCiudad.get(promo.ciudad) ?? []), promo]);
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
      const ciudades = contar(this.delDepartamento().map((promo) => [promo.ciudad, promo.ciudad]));
      if (ciudades.length > 1) {
        filtros.unshift({ key: PARAM_CIUDAD, label: 'Ciudad', asChips: true, options: ciudades });
      }
    }
    return filtros;
  });

  protected readonly sinCoincidencias = computed<string | null>(() => {
    if (this.tramos().length > 0 || this.estado().status !== 'ready') return null;
    return this.departamentoElegido() === null
      ? 'Ninguna promoción coincide con los filtros que pusiste. Probá quitando alguno.'
      : 'No hay promociones en ese departamento con los filtros que pusiste. Tocalo otra vez en el mapa para ver todo el país.';
  });

  constructor() {
    this.leerGeografia();
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
  return [promo.titulo, promo.farmacia, promo.medicamento, promo.categoria.label].some((campo) =>
    normalizarLugar(campo).includes(termino),
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
  return vencidaA - vencidaB || b.porcentaje - a.porcentaje;
}

function aTarjeta(promo: Promocion): SearchResultItem {
  const sellos: { label: string; tone: 'ok' | 'neutro' | 'info' | 'aviso' | 'error' }[] = [];
  if (promo.estado === 'nueva') sellos.push({ label: 'Nueva', tone: 'info' });
  if (promo.estado === 'vencida') sellos.push({ label: 'Vencida', tone: 'neutro' });
  else sellos.push({ label: 'Vigente', tone: 'ok' });
  if (promo.factorDePuntos !== null)
    sellos.push({ label: `Puntos x${promo.factorDePuntos}`, tone: 'aviso' });
  if (promo.farmaciaVerificada) sellos.push({ label: 'Farmacia verificada', tone: 'ok' });

  return {
    id: promo.id,
    title: promo.titulo,
    link: RUTA_DE_COMPRA,
    figureText: `-${promo.porcentaje}%`,
    subtitle: `${promo.farmacia} · ${promo.medicamento}`,
    meta: [
      { text: promo.categoria.label },
      { text: `Del ${FECHA.format(promo.desde)} al ${FECHA.format(promo.hasta)}` },
    ],
    seals: sellos,
  };
}
