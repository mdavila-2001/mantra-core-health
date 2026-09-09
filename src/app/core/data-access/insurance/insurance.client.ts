import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly } from '../wire';
import type {
  BrokerAgreement,
  ClaimAdjudication,
  ClaimDetail,
  ClaimDispute,
  ClaimListItem,
  ClaimPage,
  ClaimQuery,
  CarrierCatalogEntry,
  InsuredMemberLookup,
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

type WireClaimListItem = Omit<ClaimListItem, 'submittedAt'> & {
  readonly submittedAt: string | null;
};

type WireClaimAdjudication = Omit<ClaimAdjudication, 'adjudicatedAt'> & {
  readonly adjudicatedAt: string;
};

type WireClaimDispute = Omit<ClaimDispute, 'submittedAt' | 'filingDeadline'> & {
  readonly submittedAt: string | null;
  readonly filingDeadline: string | null;
};

type WireClaimDetail = Omit<
  ClaimDetail,
  'header' | 'adjudication' | 'adjudicationHistory' | 'disputes'
> & {
  readonly header: WireClaimListItem;
  readonly adjudication: WireClaimAdjudication | null;
  readonly adjudicationHistory: readonly WireClaimAdjudication[];
  readonly disputes: readonly WireClaimDispute[];
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
  /**
   * `GET /insurance-carrier-catalog`. El catálogo boliviano de aseguradoras.
   *
   * Es público: la pantalla de registro lo consulta antes de que exista la
   * cuenta. No confundir con {@link InsuranceClient.listCarriers}, que lista
   * las aseguradoras del tenant activo y desde el tenant de un paciente
   * devuelve vacío.
   *
   * @returns Aseguradoras privadas y públicas con sus planes de salud.
   */
  listCarrierCatalog(): Observable<readonly CarrierCatalogEntry[]> {
    return this.http
      .get<{ readonly carriers: readonly CarrierCatalogEntry[] }>(
        this.url('/insurance-carrier-catalog'),
      )
      .pipe(map((body) => body.carriers));
  }

  /**
   * `GET /insurance-carrier-catalog/:id`. El catálogo comercial de una
   * aseguradora del catálogo público: productos, planes, coberturas y red.
   *
   * Es la lectura de «Mi seguro» del paciente. No sirve
   * {@link InsuranceClient.getCarrier}: esa ruta acota al tenant activo y desde
   * el tenant de un paciente responde 404. **Contrato declarado por el
   * simulador**, pendiente en la API real.
   *
   * @param id - La aseguradora del catálogo.
   * @returns Su ficha completa.
   */
  getCarrierCatalogEntry(id: string): Observable<CarrierDetail> {
    return this.http
      .get<WireCarrierDetail>(
        this.url(`/insurance-carrier-catalog/${encodeURIComponent(id)}`),
      )
      .pipe(map(toCarrierDetail));
  }

  /**
   * `GET /insurance-carrier-catalog/members/:memberIdentifier`. Busca a un
   * afiliado por su número de asegurado, antes de que tenga cuenta.
   *
   * Lo usa el alta de paciente para precargar los datos. Un número que ninguna
   * aseguradora reconoce responde 404, y el alta lo dice sin frenar el
   * registro: el campo es opcional. **Contrato declarado por el simulador**,
   * pendiente en la API real.
   *
   * @param memberIdentifier - El número del carnet del asegurado.
   * @returns La cobertura y los datos de la persona.
   */
  lookupInsuredMember(memberIdentifier: string): Observable<InsuredMemberLookup> {
    return this.http.get<InsuredMemberLookup>(
      this.url(
        `/insurance-carrier-catalog/members/${encodeURIComponent(memberIdentifier.trim())}`,
      ),
    );
  }

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

  /**
   * `GET /insurance-claims` — solicitudes presentadas, por cursor.
   *
   * Los parámetros vacíos **no se envían**: un `?statusConceptId=` sin valor
   * llegaría al servidor como cadena vacía y reventaría su `@IsUUID()` con un
   * 400 que la pantalla no provocó a propósito.
   *
   * @param query - Filtros y cursor de continuación.
   * @returns La página, con el cursor de la siguiente.
   */
  listClaims(query: ClaimQuery = {}): Observable<ClaimPage> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return this.http
      .get<{
        readonly items: readonly WireClaimListItem[];
        readonly nextCursor: string | null;
      }>(this.url('/insurance-claims'), { params })
      .pipe(
        map((body) => ({
          items: body.items.map(toClaimListItem),
          nextCursor: body.nextCursor,
        })),
      );
  }

  /**
   * `GET /insurance-claims/:id` — cabecera, ítems, dictámenes y disputas.
   *
   * @param id - Solicitud consultada.
   * @returns El detalle completo.
   */
  getClaim(id: string): Observable<ClaimDetail> {
    return this.http
      .get<WireClaimDetail>(
        this.url(`/insurance-claims/${encodeURIComponent(id)}`),
      )
      .pipe(map(toClaimDetail));
  }

  /**
   * `POST /insurance-claims/:id/disputes` — reclamar un dictamen.
   *
   * Reabre el caso **sin borrar ni editar** el dictamen anterior: las
   * adjudicaciones son inmutables y la disputa es una fila nueva que las
   * referencia. Reclamar dos veces sobre la misma versión devuelve la misma
   * disputa: el servidor lo resuelve buscando la abierta antes de crear.
   *
   * @param claimId - Solicitud que se reclama.
   * @param body - Versión disputada y parte que inicia.
   * @returns El identificador de la disputa.
   */
  openClaimDispute(
    claimId: string,
    body: {
      readonly claimAdjudicationVersionId?: string;
      readonly initiatedBy: 'PROVIDER' | 'PATIENT';
    },
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/insurance-claims/${encodeURIComponent(claimId)}/disputes`),
      body,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toClaimListItem(body: WireClaimListItem): ClaimListItem {
  return { ...body, submittedAt: maybeDate(body.submittedAt) ?? null };
}

function toClaimAdjudication(
  body: WireClaimAdjudication,
): ClaimAdjudication {
  return { ...body, adjudicatedAt: new Date(body.adjudicatedAt) };
}

function toClaimDispute(body: WireClaimDispute): ClaimDispute {
  return {
    ...body,
    submittedAt: maybeDate(body.submittedAt) ?? null,
    // `filingDeadline` es `format: 'date'`: pasarlo por `new Date()` lo ancla a
    // medianoche UTC y **retrocede un día** en Bolivia, que es UTC-4.
    filingDeadline: maybeDateOnly(body.filingDeadline) ?? null,
  };
}

function toClaimDetail(body: WireClaimDetail): ClaimDetail {
  return {
    ...body,
    header: toClaimListItem(body.header),
    adjudication: body.adjudication
      ? toClaimAdjudication(body.adjudication)
      : null,
    adjudicationHistory: body.adjudicationHistory.map(toClaimAdjudication),
    disputes: body.disputes.map(toClaimDispute),
  };
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
