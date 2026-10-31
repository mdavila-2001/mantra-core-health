import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { PrescriberLicense } from '../prescription-shares/prescription-shares.types';
import type {
  MaskedPatient,
  PharmacyPrescriptionItem,
  PharmacyPrescriptionShare,
  PrescriptionProductMatch,
  PrescriptionProductSite,
  SiteProductAvailability,
  SiteProductRef,
} from './pharmacy-prescription-shares.types';

interface WireLicense {
  readonly number: string;
  readonly authority?: string | null;
  readonly state?: string | null;
}

interface WireSite {
  readonly siteId: string;
  readonly siteName: string;
  readonly available: boolean;
  readonly quantity?: number | null;
  readonly stockUpdatedAt?: string | null;
}

interface WireMatch {
  readonly pharmacyId: string;
  readonly pharmacyProductId: string;
  readonly name: string;
  readonly price?: string | null;
  readonly currencyCode?: string | null;
  readonly requiresPrescription: boolean;
  readonly outOfStockDeclared?: boolean;
  readonly sites?: readonly WireSite[];
}

interface WireItem {
  readonly medicationRequestId: string;
  readonly medicationConceptId: string;
  readonly display?: string | null;
  readonly dosageText?: string | null;
  readonly prescribedQuantity?: number | null;
  readonly unitCode?: string | null;
  readonly dispensedQuantity?: number | null;
  readonly remainingQuantity?: number | null;
  readonly matches?: readonly WireMatch[];
}

interface WireShare {
  readonly shareId: string;
  readonly issuedAt?: string | null;
  readonly validTo?: string | null;
  readonly prescriber?: { readonly name?: string | null; readonly license?: WireLicense | null } | null;
  readonly patient?: { readonly maskedName?: string | null; readonly documentLast3?: string | null } | null;
  readonly items?: readonly WireItem[];
}

interface WireAvailability {
  readonly siteId: string;
  readonly productId: string;
  readonly available: boolean;
  readonly quantity: number;
  readonly stockUpdatedAt?: string | null;
}

function toDateOrNull(value: string | null | undefined): Date | null {
  return value === null || value === undefined ? null : new Date(value);
}

/**
 * La matrícula, con su estado: el DTO de la API siempre lo manda
 * (`'ACTIVE' | 'PENDING'`). Un valor que no sea `ACTIVE` se lee como
 * `PENDING`: no se afirma vigente una matrícula que no se sabe si lo es.
 */
function toLicense(wire: WireLicense | null | undefined): PrescriberLicense | null {
  if (wire === null || wire === undefined) {
    return null;
  }
  const state = wire.state === 'ACTIVE' ? 'ACTIVE' : 'PENDING';
  return { number: wire.number, authority: wire.authority ?? null, state };
}

/**
 * Se copian **solo** las dos claves enmascaradas (S-4): si la respuesta trajera
 * otra cosa del paciente, no pasa de acá.
 */
function toMaskedPatient(wire: WireShare['patient']): MaskedPatient {
  return {
    maskedName: wire?.maskedName ?? null,
    documentLast3: wire?.documentLast3 ?? null,
  };
}

function toSite(wire: WireSite): PrescriptionProductSite {
  return {
    siteId: wire.siteId,
    siteName: wire.siteName,
    available: wire.available,
    quantity: wire.quantity ?? null,
    stockUpdatedAt: toDateOrNull(wire.stockUpdatedAt),
  };
}

function toMatch(wire: WireMatch): PrescriptionProductMatch {
  return {
    pharmacyId: wire.pharmacyId,
    pharmacyProductId: wire.pharmacyProductId,
    name: wire.name,
    price: wire.price ?? null,
    currencyCode: wire.currencyCode ?? null,
    requiresPrescription: wire.requiresPrescription,
    outOfStockDeclared: wire.outOfStockDeclared === true,
    sites: (wire.sites ?? []).map(toSite),
  };
}

function toItem(wire: WireItem): PharmacyPrescriptionItem {
  return {
    medicationRequestId: wire.medicationRequestId,
    medicationConceptId: wire.medicationConceptId,
    display: wire.display ?? null,
    dosageText: wire.dosageText ?? null,
    prescribedQuantity: wire.prescribedQuantity ?? null,
    unitCode: wire.unitCode ?? null,
    dispensedQuantity: wire.dispensedQuantity ?? null,
    remainingQuantity: wire.remainingQuantity ?? null,
    matches: (wire.matches ?? []).map(toMatch),
  };
}

function toShare(wire: WireShare): PharmacyPrescriptionShare {
  return {
    shareId: wire.shareId,
    issuedAt: toDateOrNull(wire.issuedAt),
    validTo: toDateOrNull(wire.validTo),
    prescriber: {
      name: wire.prescriber?.name ?? null,
      license: toLicense(wire.prescriber?.license),
    },
    patient: toMaskedPatient(wire.patient),
    items: (wire.items ?? []).map(toItem),
  };
}

function toAvailability(wire: WireAvailability): SiteProductAvailability {
  return {
    siteId: wire.siteId,
    productId: wire.productId,
    available: wire.available,
    quantity: wire.quantity,
    stockUpdatedAt: toDateOrNull(wire.stockUpdatedAt),
  };
}

/**
 * Cliente de la farmacia para la receta compartida (FAR-02): abrirla por su
 * token (`CONTRATO.md` §2) y marcar «Lo tengo / No lo tengo» por sede (§4, el
 * endpoint de FAR-06, declarado acá en archivo propio, R-02-5).
 *
 * El token y los ids viajan en la ruta con `encodeURIComponent`: lo que llega
 * por la dirección del navegador lo escribió cualquiera.
 */
@Injectable({
  providedIn: 'root',
})
export class PharmacyPrescriptionSharesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /pharmacy/prescription-shares/:token` — registra la apertura. 404 si
   * el enlace no existe o el tenant no tiene farmacia; 410 si está vencido o
   * revocado (`reason` `PRESCRIPTION_SHARE_EXPIRED` / `_REVOKED`).
   */
  open(token: string): Observable<PharmacyPrescriptionShare> {
    return this.http
      .get<WireShare>(this.url(`/pharmacy/prescription-shares/${encodeURIComponent(token)}`))
      .pipe(map(toShare));
  }

  /**
   * `PUT /pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability`
   * con `{ available }`. Sin cantidad: «Lo tengo» toma la del catálogo (o 1) y
   * «No lo tengo» la deja en 0 (lo decide la API).
   */
  setSiteAvailability(ref: SiteProductRef, available: boolean): Observable<SiteProductAvailability> {
    return this.http
      .put<WireAvailability>(
        this.url(
          `/pharmacies/${encodeURIComponent(ref.pharmacyId)}/sites/${encodeURIComponent(ref.siteId)}/products/${encodeURIComponent(ref.productId)}/availability`,
        ),
        { available },
      )
      .pipe(map(toAvailability));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
