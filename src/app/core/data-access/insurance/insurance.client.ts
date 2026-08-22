import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDateOnly } from '../wire';
import type {
  BrokerAgreement,
  BrokerClient,
  BrokerDirectory,
  BrokerPortfolio,
  BrokerProfile,
  BrokerSummary,
  CarrierDetail,
  CarrierDirectory,
  CarrierSummary,
  Plan,
  PlanBenefit,
  Product,
  ProviderNetwork,
} from './insurance.types';

/* ---- formas de transporte -------------------------------------------------
   Las vigencias son `format: 'date'` y viajan como `YYYY-MM-DD`; los instantes
   (`createdAt`) viajan como ISO completo. Se separan a propósito: una vigencia
   pasada por `new Date()` se ancla a medianoche UTC y **retrocede un día** al
   oeste de Greenwich — es lo que `maybeDateOnly` existe para evitar. */

type WireCarrierSummary = Omit<CarrierSummary, 'createdAt'> & {
  readonly createdAt: string;
};

type WireBenefit = Omit<PlanBenefit, 'effectiveFrom' | 'effectiveTo'> & {
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
};

type WirePlan = Omit<Plan, 'effectiveFrom' | 'effectiveTo' | 'benefits'> & {
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly benefits: readonly WireBenefit[];
};

type WireProduct = Omit<Product, 'plans'> & {
  readonly plans: readonly WirePlan[];
};

type WireNetwork = Omit<ProviderNetwork, 'effectiveFrom' | 'effectiveTo'> & {
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
};

type WireCarrierDetail = WireCarrierSummary & {
  readonly products: readonly WireProduct[];
  readonly networks: readonly WireNetwork[];
};

type WireBrokerSummary = Omit<BrokerSummary, 'createdAt'> & {
  readonly createdAt: string;
};

type WireAgreement = Omit<BrokerAgreement, 'effectiveFrom' | 'effectiveTo'> & {
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
};

type WireBrokerProfile = WireBrokerSummary & {
  readonly agreements: readonly WireAgreement[];
  readonly publicProfileId: string | null;
};

type WireBrokerClient = Omit<BrokerClient, 'effectiveFrom' | 'effectiveTo'> & {
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
};

/**
 * Cliente de `insurance` (módulo 26): el catálogo de la aseguradora y sus
 * brokers.
 *
 * **Sólo lecturas.** El alta de aseguradora la hace `directory` al aprovisionar
 * un tenant de tipo `PAYER`, y el resto del catálogo se da de alta con los
 * endpoints administrativos del backbone; duplicar esas escrituras acá sería
 * una segunda implementación del mismo caso de uso.
 *
 * Todas las rutas las acota el servidor al tenant activo: no llevan `tenantId`
 * porque no lo eligen. Un identificador de otra organización responde 404 —no
 * 403—, así que el error no sirve para sondear qué existe.
 */
@Injectable({ providedIn: 'root' })
export class InsuranceClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /insurance-carriers` — aseguradoras del tenant activo. */
  listCarriers(): Observable<CarrierDirectory> {
    return this.http
      .get<{
        readonly items: readonly WireCarrierSummary[];
        readonly count: number;
      }>(this.url('/insurance-carriers'))
      .pipe(
        map((body) => ({
          items: body.items.map(toCarrierSummary),
          count: body.count,
        })),
      );
  }

  /** `GET /insurance-carriers/:id` — catálogo comercial y red. */
  getCarrier(id: string): Observable<CarrierDetail> {
    return this.http
      .get<WireCarrierDetail>(
        this.url(`/insurance-carriers/${encodeURIComponent(id)}`),
      )
      .pipe(map(toCarrierDetail));
  }

  /** `GET /insurance-brokers` — brokers del tenant activo. */
  listBrokers(): Observable<BrokerDirectory> {
    return this.http
      .get<{
        readonly items: readonly WireBrokerSummary[];
        readonly count: number;
      }>(this.url('/insurance-brokers'))
      .pipe(
        map((body) => ({
          items: body.items.map(toBrokerSummary),
          count: body.count,
        })),
      );
  }

  /** `GET /insurance-brokers/:id` — perfil e historial de vinculaciones. */
  getBroker(id: string): Observable<BrokerProfile> {
    return this.http
      .get<WireBrokerProfile>(
        this.url(`/insurance-brokers/${encodeURIComponent(id)}`),
      )
      .pipe(map(toBrokerProfile));
  }

  /**
   * `GET /insurance-brokers/:id/clients` — cartera comercial.
   *
   * Es una llamada aparte de la del perfil a propósito: ver quién es un broker
   * no debería traer consigo la lista de sus asegurados.
   */
  listBrokerClients(id: string): Observable<BrokerPortfolio> {
    return this.http
      .get<{
        readonly items: readonly WireBrokerClient[];
        readonly count: number;
      }>(this.url(`/insurance-brokers/${encodeURIComponent(id)}/clients`))
      .pipe(
        map((body) => ({
          items: body.items.map(toBrokerClient),
          count: body.count,
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toCarrierSummary(body: WireCarrierSummary): CarrierSummary {
  return { ...body, createdAt: new Date(body.createdAt) };
}

function toCarrierDetail(body: WireCarrierDetail): CarrierDetail {
  return {
    ...toCarrierSummary(body),
    products: body.products.map((product) => ({
      ...product,
      plans: product.plans.map(toPlan),
    })),
    networks: body.networks.map((network) => ({
      ...network,
      effectiveFrom: maybeDateOnly(network.effectiveFrom) ?? null,
      effectiveTo: maybeDateOnly(network.effectiveTo) ?? null,
    })),
  };
}

function toPlan(plan: WirePlan): Plan {
  return {
    ...plan,
    effectiveFrom: maybeDateOnly(plan.effectiveFrom) ?? null,
    effectiveTo: maybeDateOnly(plan.effectiveTo) ?? null,
    benefits: plan.benefits.map((benefit) => ({
      ...benefit,
      effectiveFrom: maybeDateOnly(benefit.effectiveFrom) ?? null,
      effectiveTo: maybeDateOnly(benefit.effectiveTo) ?? null,
    })),
  };
}

function toBrokerSummary(body: WireBrokerSummary): BrokerSummary {
  return { ...body, createdAt: new Date(body.createdAt) };
}

function toBrokerProfile(body: WireBrokerProfile): BrokerProfile {
  return {
    ...toBrokerSummary(body),
    publicProfileId: body.publicProfileId,
    agreements: body.agreements.map((agreement) => ({
      ...agreement,
      effectiveFrom: maybeDateOnly(agreement.effectiveFrom) ?? null,
      effectiveTo: maybeDateOnly(agreement.effectiveTo) ?? null,
    })),
  };
}

function toBrokerClient(body: WireBrokerClient): BrokerClient {
  return {
    ...body,
    effectiveFrom: maybeDateOnly(body.effectiveFrom) ?? null,
    effectiveTo: maybeDateOnly(body.effectiveTo) ?? null,
  };
}
