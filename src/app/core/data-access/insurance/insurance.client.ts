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
  ClaimLine,
  ClaimLineDuplicateStudy,
  ClaimListItem,
  ClaimPage,
  ClaimQuery,
  CarrierCatalogEntry,
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
  PractitionerInsuranceNetwork,
  PractitionerInsuranceNetworkPage,
  Product,
  PractitionerInsuranceCarrier,
  ProviderNetwork,
  CreateInsurancePlanInput,
  CreatePlanBenefitInput,
  UpdatePlanBenefitInput,
  UpdatePlanBenefitRulesInput,
  UpdatePlanPremiumInput,
  UpdateInsurancePlanInput,
  CampaignCondition,
  CampaignPage,
  CampaignQuery,
  CampaignTargetStatus,
  CreateCampaignInput,
  InsuranceCampaign,
  InsurerMarketplace,
  MarketplaceBroker,
  PatientCampaign,
  MyClaim,
  MyClaimList,
  MyClaimsView,
  ReceivedClaim,
  ReceivedClaimDecision,
  ReceivedClaimDecisionInput,
  ReceivedClaimInvoice,
  ReceivedClaimList,
  InsurerPatientPage,
  InsurerPatientQuery,
  PatientDirectoryOptions,
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

type WirePractitionerNetwork = Omit<
  PractitionerInsuranceNetwork,
  'effectiveFrom' | 'effectiveTo'
> & {
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

type WireReceivedClaimInvoice = Omit<ReceivedClaimInvoice, 'issuedAt' | 'annulledAt' | 'previous'> & {
  readonly issuedAt: string;
  readonly annulledAt: string | null;
  readonly previous: readonly WireReceivedClaimInvoice[];
};

type WireReceivedClaim = Omit<ReceivedClaim, 'submittedAt' | 'serviceDate' | 'decision' | 'invoice'> & {
  readonly submittedAt: string | null;
  /** `format: 'date'`: se convierte con `maybeDateOnly`, no con `new Date()`. */
  readonly serviceDate: string | null;
  readonly decision: (Omit<ReceivedClaimDecision, 'decidedAt'> & { readonly decidedAt: string }) | null;
  readonly invoice: WireReceivedClaimInvoice | null;
};

type WireMyClaim = Omit<MyClaim, 'submittedAt' | 'serviceDate' | 'decision'> & {
  readonly submittedAt: string | null;
  /** `format: 'date'`: se convierte con `maybeDateOnly`, no con `new Date()`. */
  readonly serviceDate: string | null;
  readonly decision: (Omit<NonNullable<MyClaim['decision']>, 'decidedAt'> & { readonly decidedAt: string }) | null;
};

type WireClaimAdjudication = Omit<ClaimAdjudication, 'adjudicatedAt'> & {
  readonly adjudicatedAt: string;
};

type WireClaimDispute = Omit<ClaimDispute, 'submittedAt' | 'filingDeadline'> & {
  readonly submittedAt: string | null;
  readonly filingDeadline: string | null;
};

// Antiduplicación de estudios (subtarea 3.2): `duplicateStudy.performedAt`
// llega como texto ISO, no como `Date` — el resto de la línea ya venía sin
// mapear (`toClaimDetail` esparcía `lines` tal cual); se corrige acá.
type WireClaimLineDuplicateStudy = Omit<ClaimLineDuplicateStudy, 'performedAt'> & {
  readonly performedAt: string;
};

type WireClaimLine = Omit<ClaimLine, 'duplicateStudy'> & {
  readonly duplicateStudy: WireClaimLineDuplicateStudy | null;
};

type WireClaimDetail = Omit<
  ClaimDetail,
  'header' | 'lines' | 'adjudication' | 'adjudicationHistory' | 'disputes'
> & {
  readonly header: WireClaimListItem;
  readonly lines: readonly WireClaimLine[];
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

  /**
   * `GET /practitioners/:id/insurance-carriers` — las aseguradoras en cuya red
   * atiende un profesional, con los planes de cada una.
   *
   * Es lo que el paciente mira en la ficha para saber si su seguro lo cubre.
   * Una lista vacía es «no hay convenios informados», no «no trabaja con
   * seguros»: la pantalla lo dice así.
   *
   * @param practitionerProfileId - El perfil profesional de la ficha.
   * @returns Las aseguradoras, ya ordenadas por nombre.
   */
  listPractitionerCarriers(
    practitionerProfileId: string,
  ): Observable<readonly PractitionerInsuranceCarrier[]> {
    return this.http
      .get<{ readonly items: readonly PractitionerInsuranceCarrier[] }>(
        this.url(
          `/practitioners/${encodeURIComponent(practitionerProfileId)}/insurance-carriers`,
        ),
      )
      .pipe(map((body) => body.items));
  }

  /** `GET /insurance-carriers/:id` — catálogo comercial y red. */
  getCarrier(id: string): Observable<CarrierDetail> {
    return this.http
      .get<WireCarrierDetail>(this.url(`/insurance-carriers/${encodeURIComponent(id)}`))
      .pipe(map(toCarrierDetail));
  }

  /**
   * `GET /insurance-marketplace/insurers/:slug` — la vitrina de una
   * aseguradora para el paciente: productos con planes y cláusulas, y los
   * brokers con los que puede hablar. Se busca por el slug de su ficha
   * pública, que es lo que trae el directorio.
   *
   * **Sólo existe en la maqueta**: la API todavía no lo expone (P48).
   */
  getMarketplace(slug: string): Observable<InsurerMarketplace> {
    return this.http
      .get<{
        readonly carrier: WireCarrierDetail | null;
        readonly brokers: readonly MarketplaceBroker[];
      }>(this.url(`/insurance-marketplace/insurers/${encodeURIComponent(slug)}`))
      .pipe(
        map((body) => ({
          carrier: body.carrier === null ? null : toCarrierDetail(body.carrier),
          brokers: body.brokers,
        })),
      );
  }

  /**
   * `GET /practitioners/:profileId/insurance-networks` — con qué aseguradoras
   * trabaja el profesional: sus membresías activas en redes de prestadores.
   *
   * Una lista vacía es un estado normal —ninguna aseguradora lo sumó a su red—
   * y quien la reciba tiene que decirlo así, nunca como un fallo.
   *
   * @param practitionerProfileId - Profesional consultado.
   * @returns Una fila por red, con la aseguradora dueña de la red.
   */
  listNetworksOfPractitioner(
    practitionerProfileId: string,
  ): Observable<PractitionerInsuranceNetworkPage> {
    return this.http
      .get<{
        readonly items: readonly WirePractitionerNetwork[];
        readonly count: number;
      }>(this.url(`/practitioners/${encodeURIComponent(practitionerProfileId)}/insurance-networks`))
      .pipe(
        map((body) => ({
          items: body.items.map((item) => ({
            ...item,
            effectiveFrom: maybeDateOnly(item.effectiveFrom) ?? null,
            effectiveTo: maybeDateOnly(item.effectiveTo) ?? null,
          })),
          count: body.count,
        })),
      );
  }

  /** Crea un plan dentro de un producto del carrier del tenant activo. */
  createPlan(
    productId: string,
    body: CreateInsurancePlanInput,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/insurance-products/${encodeURIComponent(productId)}/plans`),
      body,
    );
  }

  /**
   * `PUT /insurance-plans/:planId` — corrige los datos generales de un
   * producto seguro. **Sólo existe en la maqueta**: la API todavía no lo expone.
   */
  updatePlan(planId: string, body: UpdateInsurancePlanInput): Observable<{ readonly ok: true }> {
    return this.http.put<{ readonly ok: true }>(
      this.url(`/insurance-plans/${encodeURIComponent(planId)}`),
      body,
    );
  }

  /**
   * `DELETE /insurance-plans/:planId` — da de baja un producto seguro con sus
   * cláusulas. **Sólo existe en la maqueta**: la API todavía no lo expone.
   */
  deletePlan(planId: string): Observable<void> {
    return this.http.delete<void>(this.url(`/insurance-plans/${encodeURIComponent(planId)}`));
  }

  /** Crea una cobertura dentro de un plan del carrier del tenant activo. */
  createBenefit(planId: string, body: CreatePlanBenefitInput): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/insurance-plans/${encodeURIComponent(planId)}/benefits`),
      body,
    );
  }

  /** Reemplaza el subconjunto económico de una cobertura. */
  updateBenefit(
    planId: string,
    benefitId: string,
    body: UpdatePlanBenefitInput,
  ): Observable<{ readonly ok: true }> {
    return this.http.put<{ readonly ok: true }>(
      this.url(
        `/insurance-plans/${encodeURIComponent(planId)}/benefits/${encodeURIComponent(benefitId)}`,
      ),
      body,
    );
  }

  /** Reemplaza autorización previa, documentos y exclusión. */
  updateBenefitRules(
    planId: string,
    benefitId: string,
    body: UpdatePlanBenefitRulesInput,
  ): Observable<{ readonly ok: true }> {
    return this.http.put<{ readonly ok: true }>(
      this.url(
        `/insurance-plans/${encodeURIComponent(planId)}/benefits/${encodeURIComponent(benefitId)}/rules`,
      ),
      body,
    );
  }

  /**
   * Declara (o quita, con `null`) la prima de lista mensual de un plan del
   * carrier del tenant activo (v4.2.14, subtarea 3.1).
   */
  updatePlanPremium(
    planId: string,
    body: UpdatePlanPremiumInput,
  ): Observable<{ readonly id: string; readonly monthlyPremiumAmount: string | null }> {
    return this.http.put<{
      readonly id: string;
      readonly monthlyPremiumAmount: string | null;
    }>(this.url(`/insurance-plans/${encodeURIComponent(planId)}/premium`), body);
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
      .get<WireBrokerProfile>(this.url(`/insurance-brokers/${encodeURIComponent(id)}`))
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
   * `GET /insurance/received-claims` — lo que los prestadores le presentaron a
   * la aseguradora activa («Solicitudes recibidas»).
   *
   * Trae la ventana entera de una vez, con tope y aviso `truncated`: la
   * pantalla filtra, busca, ordena y pagina en el cliente (ADR-0015, familia
   * «lista local»). El alcance lo resuelve el servidor por la membresía en la
   * aseguradora; el cliente no manda ningún id de aseguradora.
   *
   * @returns Las solicitudes recibidas, de la más reciente a la más antigua.
   */
  listReceivedClaims(): Observable<ReceivedClaimList> {
    return this.http
      .get<{
        readonly items: readonly WireReceivedClaim[];
        readonly truncated: boolean;
      }>(this.url('/insurance/received-claims'))
      .pipe(
        map((body) => ({
          items: body.items.map(toReceivedClaim),
          truncated: body.truncated,
        })),
      );
  }

  /**
   * `POST /insurance/patients/search` — el directorio autorizado de pacientes
   * por cursor, con total exacto.
   *
   * El servidor restringe a cobertura vigente o padrón administrativo según
   * el actor. Seleccionar una aseguradora filtra dentro de ese alcance.
   * Los filtros viajan en el cuerpo y no se conservan en transfer cache.
   *
   * @param query - Filtros, orden y cursor de continuación.
   * @returns La página, con el cursor de la siguiente.
   */
  listInsurerPatients(query: InsurerPatientQuery = {}): Observable<InsurerPatientPage> {
    const body = Object.fromEntries(
      Object.entries(query).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      ),
    );
    return this.http.post<InsurerPatientPage>(this.url('/insurance/patients/search'), body, {
      transferCache: false,
    });
  }

  patientDirectoryOptions(): Observable<PatientDirectoryOptions> {
    return this.http.get<PatientDirectoryOptions>(this.url('/insurance/patients/options'), {
      transferCache: false,
    });
  }

  openPatientConversation(
    patientProfileId: string,
    channel: 'internal',
  ): Observable<{ readonly conversationId: string }> {
    return this.http.post<{ readonly conversationId: string }>(
      this.url('/insurance/patients/conversation'),
      { patientProfileId, channel },
      { transferCache: false },
    );
  }
  /**
   * `GET /insurance/my-claims` — «Mis solicitudes»: las solicitudes de seguro
   * de quien mira y lo que decidió la aseguradora. Cualquier sesión puede
   * pedirla; el lado (paciente, médico, laboratorio, imagenología) lo resuelve
   * el servidor por la sesión — el cliente no manda ningún id.
   *
   * @returns Las solicitudes, de la más reciente a la más antigua.
   */
  listMyClaims(): Observable<MyClaimList> {
    return this.http
      .get<{
        readonly view: MyClaimsView;
        readonly items: readonly WireMyClaim[];
        readonly truncated: boolean;
      }>(this.url('/insurance/my-claims'))
      .pipe(map((body) => ({ view: body.view, items: body.items.map(toMyClaim), truncated: body.truncated })));
  }

  /**
   * `POST /insurance/received-claims/:id/decision` — el dictamen de la
   * aseguradora. **Definitivo**: la API responde `409` si la solicitud ya tiene
   * uno. Aprobar (total o parcial) emite en el mismo acto la factura del
   * prestador a la aseguradora por el monto aprobado.
   *
   * @returns La solicitud como quedó, con su dictamen y su factura.
   */
  decideReceivedClaim(claimId: string, body: ReceivedClaimDecisionInput): Observable<ReceivedClaim> {
    return this.http
      .post<WireReceivedClaim>(
        this.url(`/insurance/received-claims/${encodeURIComponent(claimId)}/decision`),
        body,
      )
      .pipe(map(toReceivedClaim));
  }

  /**
   * `POST /insurance/received-claims/:id/invoice/annulment` — anula la factura
   * vigente, con motivo. El dictamen no cambia.
   */
  annulReceivedClaimInvoice(claimId: string, reason: string): Observable<ReceivedClaim> {
    return this.http
      .post<WireReceivedClaim>(
        this.url(`/insurance/received-claims/${encodeURIComponent(claimId)}/invoice/annulment`),
        { reason },
      )
      .pipe(map(toReceivedClaim));
  }

  /**
   * `POST /insurance/received-claims/:id/invoice` — emite la factura corregida
   * de una solicitud aprobada cuya factura se anuló. `409` si ya hay una vigente.
   */
  reissueReceivedClaimInvoice(claimId: string): Observable<ReceivedClaim> {
    return this.http
      .post<WireReceivedClaim>(
        this.url(`/insurance/received-claims/${encodeURIComponent(claimId)}/invoice`),
        {},
      )
      .pipe(map(toReceivedClaim));
  }

  /**
   * `GET /insurance-claims/:id` — cabecera, ítems, dictámenes y disputas.
   *
   * @param id - Solicitud consultada.
   * @returns El detalle completo.
   */
  getClaim(id: string): Observable<ClaimDetail> {
    return this.http
      .get<WireClaimDetail>(this.url(`/insurance-claims/${encodeURIComponent(id)}`))
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

  /**
   * `GET /insurance-campaigns` — las campañas preventivas de la aseguradora
   * activa, de la más nueva a la más vieja, con cursor opaco.
   *
   * Los filtros vacíos se descartan: un `status=''` llegaría al servidor como
   * cadena vacía y reventaría su `@IsIn()` con un 400 que la pantalla no
   * provocó a propósito.
   *
   * @param query - Filtros por tipo y estado, y cursor de continuación.
   * @returns La página, con el cursor de la siguiente.
   */
  listCampaigns(query: CampaignQuery = {}): Observable<CampaignPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http
      .get<{
        readonly items: readonly WireCampaign[];
        readonly nextCursor: string | null;
      }>(this.url('/insurance-campaigns'), { params })
      .pipe(
        map((body) => ({
          items: body.items.map(toCampaign),
          nextCursor: body.nextCursor,
        })),
      );
  }

  /**
   * `POST /insurance-campaigns` — crea una campaña; nace en borrador, o activa
   * si `activate` es `true`.
   *
   * Responde 400 con fechas invertidas o porcentaje fuera de 0..100, 409 con un
   * código repetido en la aseguradora y 403 a quien no administra una.
   *
   * @param input - La campaña, con sus aliados.
   * @returns La campaña creada.
   */
  createCampaign(input: CreateCampaignInput): Observable<InsuranceCampaign> {
    return this.http
      .post<WireCampaign>(this.url('/insurance-campaigns'), input)
      .pipe(map(toCampaign));
  }

  /**
   * `PATCH /insurance-campaigns/:id/status` — activa, pausa o finaliza.
   *
   * Una transición fuera de la tabla responde 422; repetir el estado actual es
   * idempotente.
   *
   * @param id - Campaña a mover.
   * @param status - Estado destino.
   * @returns La campaña ya en su nuevo estado.
   */
  updateCampaignStatus(
    id: string,
    status: CampaignTargetStatus,
  ): Observable<InsuranceCampaign> {
    return this.http
      .patch<WireCampaign>(this.url(`/insurance-campaigns/${encodeURIComponent(id)}/status`), {
        status,
      })
      .pipe(map(toCampaign));
  }

  /**
   * `GET /insurance-campaigns/patient/:patientProfileId` — las campañas
   * vigentes para el afiliado.
   *
   * El id del perfil viaja en la URL a propósito: la API exige que sea el del
   * titular y un intento sobre el de otro responde 403 y queda auditado.
   *
   * @param patientProfileId - Perfil del afiliado (claim `pid`).
   * @returns Sólo campañas activas, dentro de su vigencia y de su aseguradora.
   */
  getActivePatientCampaigns(patientProfileId: string): Observable<readonly PatientCampaign[]> {
    return this.http
      .get<readonly WirePatientCampaign[]>(
        this.url(`/insurance-campaigns/patient/${encodeURIComponent(patientProfileId)}`),
      )
      .pipe(map((body) => body.map(toPatientCampaign)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toClaimListItem(body: WireClaimListItem): ClaimListItem {
  return { ...body, submittedAt: maybeDate(body.submittedAt) ?? null };
}

function toReceivedClaim(body: WireReceivedClaim): ReceivedClaim {
  return {
    ...body,
    submittedAt: maybeDate(body.submittedAt) ?? null,
    serviceDate: maybeDateOnly(body.serviceDate) ?? null,
    decision: body.decision === null ? null : { ...body.decision, decidedAt: new Date(body.decision.decidedAt) },
    invoice: body.invoice === null ? null : toReceivedClaimInvoice(body.invoice),
  };
}

function toMyClaim(body: WireMyClaim): MyClaim {
  return {
    ...body,
    submittedAt: maybeDate(body.submittedAt) ?? null,
    serviceDate: maybeDateOnly(body.serviceDate) ?? null,
    decision: body.decision === null ? null : { ...body.decision, decidedAt: new Date(body.decision.decidedAt) },
  };
}

function toReceivedClaimInvoice(body: WireReceivedClaimInvoice): ReceivedClaimInvoice {
  return {
    ...body,
    issuedAt: new Date(body.issuedAt),
    annulledAt: maybeDate(body.annulledAt) ?? null,
    previous: body.previous.map(toReceivedClaimInvoice),
  };
}

function toClaimAdjudication(body: WireClaimAdjudication): ClaimAdjudication {
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
    lines: body.lines.map(toClaimLine),
    adjudication: body.adjudication ? toClaimAdjudication(body.adjudication) : null,
    adjudicationHistory: body.adjudicationHistory.map(toClaimAdjudication),
    disputes: body.disputes.map(toClaimDispute),
  };
}

function toClaimLine(body: WireClaimLine): ClaimLine {
  return {
    ...body,
    duplicateStudy: body.duplicateStudy
      ? { ...body.duplicateStudy, performedAt: new Date(body.duplicateStudy.performedAt) }
      : null,
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

/* ---- campañas preventivas (Tarea 4) --------------------------------------- */

interface WireCampaignPartner {
  readonly id: string;
  readonly role: InsuranceCampaign['partners'][number]['role'];
  readonly type: InsuranceCampaign['partners'][number]['type'];
  readonly name: string;
  readonly networkProviderMembershipId: string | null;
}

interface WireCampaign {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly campaignType: InsuranceCampaign['campaignType'];
  readonly status: InsuranceCampaign['status'];
  readonly targetCondition: CampaignCondition | null;
  readonly copayBonusPercentage: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly activatedAt: string | null;
  readonly partners: readonly WireCampaignPartner[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface WirePatientCampaign {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly campaignType: PatientCampaign['campaignType'];
  readonly targetCondition: CampaignCondition | null;
  readonly copayBonusPercentage: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly carrierName: string;
  readonly partners: PatientCampaign['partners'];
}

/** Una fecha `AAAA-MM-DD` a medianoche local: sin correr un día al pintarla. */
function civilDate(value: string): Date {
  return maybeDateOnly(value) ?? new Date(value);
}

function toCampaign(body: WireCampaign): InsuranceCampaign {
  return {
    ...body,
    validFrom: civilDate(body.validFrom),
    validTo: civilDate(body.validTo),
    activatedAt: maybeDate(body.activatedAt) ?? null,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  };
}

function toPatientCampaign(body: WirePatientCampaign): PatientCampaign {
  return {
    ...body,
    validFrom: civilDate(body.validFrom),
    validTo: civilDate(body.validTo),
  };
}
