import type { FilaDeClausula, PlanDelMercado } from './insurer-detail.types';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, tap, type Observable } from 'rxjs';

import { InsuranceClient } from '@core/data-access/insurance/insurance.client';
import type {
  ApprovalDocumentCode,
  CarrierDetail,
  InsuranceConcept,
  MarketplaceBroker,
  PlanBenefit,
} from '@core/data-access/insurance/insurance.types';
import type { PublicPage } from '@core/data-access/public-directory/public-directory.types';
import { ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { Badge } from '@shared/components/atoms/badge/badge';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Card } from '@shared/components/molecules/card/card';
import { FactList } from '@shared/components/molecules/fact-list/fact-list';
import { Pagination } from '@shared/components/molecules/pagination/pagination';
import { SectionHeading } from '@shared/components/molecules/section-heading/section-heading';
import { Tab } from '@shared/components/molecules/tabs/tab/tab';
import { Tabs } from '@shared/components/molecules/tabs/tabs';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '@shared/components/organisms/data-table/data-table.types';
import { FilterBar, SEARCH_PARAM } from '@shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { formatKpiAmount } from '../../insurance/money-format';
import { PublicCatalogDetail } from '../public-catalog-detail';
import {
  CLAVE_COBERTURA,
  CLAVE_SEGMENTO,
  CLAVE_TIPO,
  criterioDe,
  filtrarPlanes,
  filtrosDelCatalogo,
  hayCriterio,
  type PlanFiltrado,
} from './insurer-detail.filtros';

/** Los documentos que una cláusula puede exigir, dichos para el paciente. */
const DOCUMENTOS: Readonly<Record<ApprovalDocumentCode, string>> = {
  FIRMA_MEDICO: 'Firma del médico',
  SELLO_MEDICO: 'Sello del médico',
  ORDEN_MEDICA: 'Orden médica',
  INFORME_CLINICO: 'Informe clínico',
};

export type { FilaDeClausula, CoberturaDestacada, PlanDelMercado } from './insurer-detail.types';

/** Cuántas coberturas se destacan en la tarjeta de un plan. */
const DESTACADAS = 3;

const SIN_DATO = '—';

/** El importe con su moneda, sin partirse en dos renglones en la tabla. */
function importe(valor: string | null, moneda: InsuranceConcept | null): string {
  return valor === null ? SIN_DATO : formatKpiAmount(valor, moneda).replace(/ /gu, '\u00a0');
}

function aFila(beneficio: PlanBenefit, moneda: InsuranceConcept | null): FilaDeClausula {
  const documentos = beneficio.approvalRules.requiredDocuments.map((codigo) => DOCUMENTOS[codigo]);
  const exclusion = beneficio.approvalRules.exclusionNotes?.trim() ?? '';
  const requisitos = [
    ...(documentos.length === 0 ? [] : [`Pide: ${documentos.join(', ')}`]),
    ...(exclusion === '' ? [] : [`No cubre: ${exclusion}`]),
  ];
  return {
    id: beneficio.id,
    categoria: beneficio.category.display,
    cobertura:
      beneficio.service === null
        ? beneficio.category.display
        : `${beneficio.category.display} · ${beneficio.service.display}`,
    // Espacio duro: «100 %» no se parte en dos renglones en la columna angosta.
    cubre: beneficio.coveragePercent === null ? SIN_DATO : `${beneficio.coveragePercent}\u00a0%`,
    copago: importe(beneficio.copayAmount, moneda),
    deducible: importe(beneficio.deductibleAmount, moneda),
    tope: importe(beneficio.annualLimitAmount, moneda),
    autorizacion:
      beneficio.requiresPriorAuthorization === null
        ? SIN_DATO
        : beneficio.requiresPriorAuthorization
          ? 'Sí'
          : 'No',
    requisitos: requisitos.length === 0 ? SIN_DATO : requisitos.join(' · '),
  };
}

/**
 * El plan en una frase: «4 coberturas · tope anual de hasta 150.000,00 Bs ·
 * 1 pide autorización previa». Lo que no se publicó no se dice.
 */
function resumenDelPlan(
  beneficios: readonly PlanBenefit[],
  moneda: InsuranceConcept | null,
): string {
  const partes = [`${beneficios.length} ${beneficios.length === 1 ? 'cobertura' : 'coberturas'}`];
  // `Number` sólo para comparar: el importe que se muestra es la cadena exacta.
  const topes = beneficios
    .map((beneficio) => beneficio.annualLimitAmount)
    .filter((tope): tope is string => tope !== null);
  if (topes.length > 0) {
    const mayor = topes.reduce((a, b) => (Number(b) > Number(a) ? b : a));
    partes.push(`tope anual de hasta ${importe(mayor, moneda)}`);
  }
  const conAutorizacion = beneficios.filter((b) => b.requiresPriorAuthorization === true).length;
  if (conAutorizacion > 0) {
    partes.push(
      conAutorizacion === 1
        ? '1 pide autorización previa'
        : `${conAutorizacion} piden autorización previa`,
    );
  }
  return partes.join(' · ');
}

/** Los planes de todos los productos, en el orden en que la aseguradora los publicó. */
export function planesDelMercado(carrier: CarrierDetail | null): readonly PlanDelMercado[] {
  if (carrier === null) return [];
  return carrier.products.flatMap((producto) =>
    producto.plans.map((plan) => ({
      id: plan.id,
      nombre: plan.name,
      producto: producto.name,
      tipo: producto.productType.display,
      segmento: producto.marketSegment?.display ?? null,
      rotulo: [producto.productType.display, producto.marketSegment?.display]
        .filter((parte): parte is string => parte !== undefined)
        .join(' · '),
      prima:
        plan.monthlyPremiumAmount === null
          ? null
          : formatKpiAmount(plan.monthlyPremiumAmount, plan.currency),
      mayorCobertura: plan.planType?.code === 'PREMIUM',
      destacadas: plan.benefits.slice(0, DESTACADAS).map((beneficio) => ({
        id: beneficio.id,
        cobertura: beneficio.category.display,
        cubre:
          beneficio.coveragePercent === null ? SIN_DATO : `${beneficio.coveragePercent}\u00a0%`,
      })),
      resumen: resumenDelPlan(plan.benefits, plan.currency),
      clausulas: plan.benefits.map((beneficio) => aFila(beneficio, plan.currency)),
    })),
  );
}

/**
 * La paginación de la tabla de cláusulas (ADR-0015, regla 7). Por debajo del
 * tamaño menor no se dibuja: un paginador de una sola página con «Anterior» y
 * «Siguiente» deshabilitados, debajo de tres cláusulas, es ruido.
 */
const TAMANOS_DE_PAGINA: readonly number[] = [5, 10, 20];
const POR_PAGINA = 10;

/**
 * El alto máximo de la tabla (regla 6): pasado ese alto se desplaza en
 * vertical, y lo que no entra a lo ancho se pliega al detalle de la fila por
 * prioridad en vez de abrir un scroll lateral.
 */
const ALTO_DE_LA_TABLA = '32rem';

const COLUMNAS: readonly ColumnDef<FilaDeClausula>[] = [
  { key: 'cobertura', header: 'Cobertura', priority: 1 },
  { key: 'cubre', header: 'Cubre', priority: 1, align: 'end' },
  { key: 'copago', header: 'Copago', priority: 2, align: 'end' },
  { key: 'deducible', header: 'Deducible', priority: 2, align: 'end' },
  { key: 'tope', header: 'Tope anual', priority: 2, align: 'end' },
  { key: 'autorizacion', header: 'Autorización previa', priority: 3 },
  { key: 'requisitos', header: 'Requisitos y exclusiones', priority: 3 },
];

/**
 * **La ficha de una aseguradora** en el mercado de seguros del paciente
 * (28/09/2026).
 *
 * Lo que pidió el cliente: «poder ver los productos que ofrece con sus
 * cláusulas y coberturas» y «un botón para hablar con el broker que lleve al
 * chat». Cuelga del directorio de aseguradoras como la de una clínica cuelga
 * del suyo, con la misma base (`PublicCatalogDetail`): encabezado, miga de pan
 * y estados son los mismos.
 *
 * - **Una tarjeta con una pestaña por plan** (regla 6): cada pestaña dice de qué
 *   producto es, cuánto cuesta por mes y la tabla de sus cláusulas —cuánto
 *   cubre, copago, deducible, tope anual, si pide autorización y qué excluye—.
 * - **Con dos planes o más, la primera pestaña los compara** (29/09/2026,
 *   «mejorar los visuales»): una tarjeta por plan con la prima al frente, sus
 *   primeras coberturas y el resumen del resto, y las dos salidas —ver las
 *   cláusulas, que abre su pestaña, o hablar con el broker—. Es lo que hace que
 *   la ficha se lea como un mercado y no como una tabla: se elige mirando las
 *   tarjetas lado a lado y se confirma en la pestaña. Con un solo plan no hay
 *   nada que comparar y la pestaña sobra.
 * - **Los brokers**, cada uno con «Hablar con el broker», que abre el chat con
 *   `?escribirA=<slug>`. El primero con perfil se ofrece también arriba, junto
 *   a los datos de la aseguradora: es la acción principal de la ficha.
 *
 * El catálogo sale de `GET /insurance-marketplace/insurers/:slug`, el mismo que
 * administra la aseguradora en su consola (P48: hoy sólo en la maqueta).
 */
@Component({
  selector: 'app-insurer-detail',
  imports: [
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    DataTable,
    FactList,
    FilterBar,
    NgTemplateOutlet,
    PageHeader,
    Pagination,
    RouterLink,
    SectionHeading,
    Skeleton,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './insurer-detail.html',
  styleUrls: [
    '../../../shared/styles/rejilla-de-tarjetas.css',
    '../../../shared/styles/ficha-publica.css',
    './insurer-detail.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurerDetail extends PublicCatalogDetail<PlanDelMercado> {
  private readonly seguros = inject(InsuranceClient);

  protected readonly kind = 'INSURER' as const;
  protected readonly rutaDelDirectorio = '/insurers-directory';
  protected readonly rotuloDelDirectorio = 'Directorio de aseguradoras';

  private readonly rutaActual = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly columnas = COLUMNAS;
  protected readonly porId = (fila: FilaDeClausula): string => fila.id;
  protected readonly altoDeLaTabla = ALTO_DE_LA_TABLA;
  protected readonly tamanosDePagina = TAMANOS_DE_PAGINA;

  /** Los brokers de la aseguradora. Llegan con el catálogo, en la misma lectura. */
  protected readonly brokers = signal<readonly MarketplaceBroker[]>([]);

  // ── Buscador y filtros (ADR-0015, regla 5) ─────────────────────────────
  // La URL es la fuente de verdad, como en `app-filter-bar`: la barra escribe
  // los query params y acá se leen. Recargar o compartir el enlace reproduce
  // la búsqueda.

  private readonly params = toSignal(this.rutaActual.queryParams, {
    initialValue: {} as Readonly<Record<string, string | undefined>>,
  });

  /** Sólo los filtros con algo que elegir en el catálogo de esta aseguradora. */
  protected readonly filtros = computed(() => filtrosDelCatalogo(this.items()));

  private readonly criterio = computed(() => criterioDe(this.params(), this.filtros()));

  protected readonly filtrando = computed(() => hayCriterio(this.criterio()));

  /** Los planes que pasaron el filtro, cada uno con las cláusulas a la vista. */
  protected readonly visibles = computed<readonly PlanFiltrado[]>(() =>
    filtrarPlanes(this.items(), this.criterio()),
  );

  /**
   * El plan abierto en las pestañas. Vuelve a la primera cada vez que cambia
   * lo que se ve: con otro filtro, el índice de antes apunta a otro plan.
   */
  protected readonly pestana = linkedSignal({ source: this.visibles, computation: () => 0 });

  /** Saca buscador y filtros de la URL, que es lo mismo que «Limpiar» de la barra. */
  protected limpiarFiltros(): void {
    void this.router.navigate([], {
      relativeTo: this.rutaActual,
      queryParams: {
        [SEARCH_PARAM]: null,
        [CLAVE_TIPO]: null,
        [CLAVE_SEGMENTO]: null,
        [CLAVE_COBERTURA]: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  // ── Paginación de las cláusulas (regla 7) ──────────────────────────────

  /** Página y tamaño de la tabla de cada plan, por id; sin entrada, los de omisión. */
  private readonly paginas = linkedSignal<
    readonly PlanFiltrado[],
    Readonly<Record<string, { readonly pagina: number; readonly porPagina: number }>>
  >({
    source: this.visibles,
    // Con otro filtro cambian las filas: la página 3 de antes puede no existir.
    computation: (_visibles, anterior) =>
      Object.fromEntries(
        Object.entries(anterior?.value ?? {}).map(([id, { porPagina }]) => [
          id,
          { pagina: 1, porPagina },
        ]),
      ),
  });

  protected paginaDe(plan: PlanFiltrado): number {
    const porPagina = this.porPaginaDe(plan);
    const ultima = Math.max(1, Math.ceil(plan.clausulas.length / porPagina));
    return Math.min(ultima, this.paginas()[plan.plan.id]?.pagina ?? 1);
  }

  protected porPaginaDe(plan: PlanFiltrado): number {
    return this.paginas()[plan.plan.id]?.porPagina ?? POR_PAGINA;
  }

  protected irAPagina(plan: PlanFiltrado, pagina: number): void {
    this.paginas.update((actual) => ({
      ...actual,
      [plan.plan.id]: { pagina, porPagina: this.porPaginaDe(plan) },
    }));
  }

  protected cambiarPorPagina(plan: PlanFiltrado, porPagina: number): void {
    this.paginas.update((actual) => ({ ...actual, [plan.plan.id]: { pagina: 1, porPagina } }));
  }

  /** Si la tabla de un plan lleva paginador: sólo si no entra en la página menor. */
  protected paginada(plan: PlanFiltrado): boolean {
    return plan.clausulas.length > (TAMANOS_DE_PAGINA[0] ?? POR_PAGINA);
  }

  /** El broker que se ofrece arriba: el primero al que se le puede escribir. */
  protected readonly brokerPrincipal = computed(
    () => this.brokers().find((broker) => broker.chatSlug !== null) ?? null,
  );

  protected leerCatalogo(slug: string): Observable<PublicPage<PlanDelMercado>> {
    return this.seguros.getMarketplace(slug).pipe(
      tap((mercado) => {
        this.brokers.set(mercado.brokers);
      }),
      map((mercado) => ({
        items: planesDelMercado(mercado.carrier),
        nextCursor: null,
        totalHint: null,
        generatedAt: new Date(),
      })),
    );
  }

  /** Si la primera pestaña compara los planes: sólo con dos o más a la vista. */
  protected readonly hayComparacion = computed(() => this.visibles().length > 1);

  /** «Ver cláusulas» de la tarjeta de un plan: abre la pestaña de ese plan. */
  protected verClausulas(indice: number): void {
    this.pestana.set(indice + (this.hayComparacion() ? 1 : 0));
  }

  /** La página a la vista de las cláusulas del plan, ya filtradas. */
  protected estadoDeClausulas(plan: PlanFiltrado): ViewState<readonly FilaDeClausula[]> {
    if (!this.paginada(plan)) return ready(plan.clausulas);
    const porPagina = this.porPaginaDe(plan);
    const desde = (this.paginaDe(plan) - 1) * porPagina;
    return ready(plan.clausulas.slice(desde, desde + porPagina));
  }

  /** «Se ven 2 de 12 coberturas», cuando el filtro acotó la tabla del plan. */
  protected acotadas(plan: PlanFiltrado): string | null {
    const total = plan.plan.clausulas.length;
    return plan.clausulas.length === total
      ? null
      : `Se ven ${plan.clausulas.length} de ${total} coberturas: las que coinciden con su búsqueda.`;
  }

  /**
   * Matrícula y con quién trabaja, en una línea. Una frase y no una lista de
   * datos: en la tarjeta angosta del broker, rótulo y valor lado a lado
   * partían «Varias aseguradoras» letra por letra.
   */
  protected resumenDelBroker(broker: MarketplaceBroker): string {
    const alcance = broker.independent
      ? 'Trabaja con varias aseguradoras'
      : 'Trabaja sólo con esta aseguradora';
    return broker.licenseNumber === null
      ? alcance
      : `Matrícula ${broker.licenseNumber} · ${alcance}`;
  }

  protected verificado(broker: MarketplaceBroker): boolean {
    return broker.verification.code === 'VERIFIED';
  }
}
