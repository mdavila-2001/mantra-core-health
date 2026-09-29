import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Card } from '@shared/components/molecules/card/card';
import { FactList } from '@shared/components/molecules/fact-list/fact-list';
import { SectionHeading } from '@shared/components/molecules/section-heading/section-heading';
import { Tab } from '@shared/components/molecules/tabs/tab/tab';
import { Tabs } from '@shared/components/molecules/tabs/tabs';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '@shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { formatKpiAmount } from '../../insurance/money-format';
import { PublicCatalogDetail } from '../public-catalog-detail';

/** Los documentos que una cláusula puede exigir, dichos para el paciente. */
const DOCUMENTOS: Readonly<Record<ApprovalDocumentCode, string>> = {
  FIRMA_MEDICO: 'Firma del médico',
  SELLO_MEDICO: 'Sello del médico',
  ORDEN_MEDICA: 'Orden médica',
  INFORME_CLINICO: 'Informe clínico',
};

/** Una cláusula, lista para la tabla: todo en palabras, nada que calcular. */
export interface FilaDeClausula {
  readonly id: string;
  readonly cobertura: string;
  readonly cubre: string;
  readonly copago: string;
  readonly deducible: string;
  readonly tope: string;
  readonly autorizacion: string;
  readonly requisitos: string;
}

/** Un plan de la aseguradora, como lo lee quien lo va a contratar. */
export interface PlanDelMercado {
  readonly id: string;
  readonly nombre: string;
  readonly producto: string;
  readonly segmento: string | null;
  /** La prima mensual formateada, o `null` si la aseguradora no la publicó. */
  readonly prima: string | null;
  readonly clausulas: readonly FilaDeClausula[];
}

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

/** Los planes de todos los productos, en el orden en que la aseguradora los publicó. */
export function planesDelMercado(carrier: CarrierDetail | null): readonly PlanDelMercado[] {
  if (carrier === null) return [];
  return carrier.products.flatMap((producto) =>
    producto.plans.map((plan) => ({
      id: plan.id,
      nombre: plan.name,
      producto: producto.name,
      segmento: producto.marketSegment?.display ?? null,
      prima:
        plan.monthlyPremiumAmount === null
          ? null
          : formatKpiAmount(plan.monthlyPremiumAmount, plan.currency),
      clausulas: plan.benefits.map((beneficio) => aFila(beneficio, plan.currency)),
    })),
  );
}

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
    AppButtonLink,
    Badge,
    Card,
    DataTable,
    FactList,
    PageHeader,
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

  protected readonly columnas = COLUMNAS;
  protected readonly porId = (fila: FilaDeClausula): string => fila.id;

  /** Los brokers de la aseguradora. Llegan con el catálogo, en la misma lectura. */
  protected readonly brokers = signal<readonly MarketplaceBroker[]>([]);

  /** El plan abierto en las pestañas. */
  protected readonly pestana = signal(0);

  /** El broker que se ofrece arriba: el primero al que se le puede escribir. */
  protected readonly brokerPrincipal = computed(
    () => this.brokers().find((broker) => broker.chatSlug !== null) ?? null,
  );

  protected leerCatalogo(slug: string): Observable<PublicPage<PlanDelMercado>> {
    return this.seguros.getMarketplace(slug).pipe(
      tap((mercado) => {
        this.brokers.set(mercado.brokers);
        this.pestana.set(0);
      }),
      map((mercado) => ({
        items: planesDelMercado(mercado.carrier),
        nextCursor: null,
        totalHint: null,
        generatedAt: new Date(),
      })),
    );
  }

  protected estadoDeClausulas(plan: PlanDelMercado): ViewState<readonly FilaDeClausula[]> {
    return ready(plan.clausulas);
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
