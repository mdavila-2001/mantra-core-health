import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreatedPrescriptionShare,
  PrescriberLicense,
  PrescriptionShareOwnership,
  PrescriptionShareResourceType,
  PrescriptionShareStatus,
  PrescriptionShareSummary,
  PrescriptionShareTarget,
  PrescriptionVerification,
  PrescriptionVerificationStatus,
  PublicPrescriptionShare,
} from './prescription-shares.types';

interface WireCreatedShare {
  readonly shareId: string;
  readonly url: string;
  readonly token: string;
  readonly expiresAt: string;
  readonly itemCount: number;
}

/** `PrescriptionShareSummaryDto` de la API, con las fechas como texto. */
interface WireShareSummary {
  readonly shareId: string;
  readonly resourceType: PrescriptionShareResourceType;
  readonly resourceId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly status: string;
  readonly uses: number;
}

/** `PrescriberLicenseDto` de la API. */
interface WireLicense {
  readonly number: string;
  readonly authority: string | null;
  readonly state: 'ACTIVE' | 'PENDING';
}

/** `PublicPrescriptionShareDto` de la API. */
interface WirePublicShare {
  readonly status: string;
  readonly issuedAt: string | null;
  readonly prescriberName: string | null;
  readonly prescriberLicense: WireLicense | null;
  readonly itemCount: number;
}

interface WireVerification {
  readonly id: string;
  readonly status: PrescriptionVerificationStatus;
  readonly issuedAt: string | null;
  readonly contentHash: string | null;
  readonly prescriberLicense: WireLicense | null;
}

/**
 * El estado tal como lo pinta la pantalla (`VALID`, `EXPIRED`, `REVOKED`).
 *
 * Lo desconocido **no** se lee como válido: una receta que no se sabe si vale
 * se muestra vencida, que es el error con menos consecuencias.
 */
function toStatus(status: string): PrescriptionShareStatus {
  if (status === 'VALID' || status === 'REVOKED') {
    return status;
  }
  return 'EXPIRED';
}

/** La matrícula, copiada clave por clave: nada más que lo que declara el DTO. */
function toLicense(wire: WireLicense | null): PrescriberLicense | null {
  return wire === null ? null : { number: wire.number, authority: wire.authority, state: wire.state };
}

function toDateOrNull(value: string | null | undefined): Date | null {
  return value === null || value === undefined ? null : new Date(value);
}

function toCreated(body: WireCreatedShare): CreatedPrescriptionShare {
  return {
    shareId: body.shareId,
    url: body.url,
    token: body.token,
    expiresAt: new Date(body.expiresAt),
    itemCount: body.itemCount,
  };
}

function toSummary(body: WireShareSummary): PrescriptionShareSummary {
  return {
    shareId: body.shareId,
    resourceType: body.resourceType,
    resourceId: body.resourceId,
    createdAt: new Date(body.createdAt),
    expiresAt: new Date(body.expiresAt),
    status: toStatus(body.status),
    uses: body.uses,
  };
}

/**
 * Se copian **solo** las claves del contrato. Si la API mandara algo de más,
 * no llega a la pantalla: la vista pública no muestra nada del paciente ni de
 * los fármacos, y eso se garantiza acá, no en la plantilla.
 */
function toPublicShare(body: WirePublicShare): PublicPrescriptionShare {
  return {
    status: toStatus(body.status),
    issuedAt: toDateOrNull(body.issuedAt),
    prescriberName: body.prescriberName,
    prescriberLicense: toLicense(body.prescriberLicense),
    itemCount: body.itemCount,
  };
}

function toVerification(body: WireVerification): PrescriptionVerification {
  return {
    id: body.id,
    status: body.status,
    issuedAt: toDateOrNull(body.issuedAt),
    contentHash: body.contentHash,
    prescriberLicense: toLicense(body.prescriberLicense),
  };
}

/**
 * Cliente del enlace para compartir una receta (FAR-01, `CONTRATO.md` §1) y
 * del verify público de una receta, que ya existía.
 *
 * El token viaja siempre en la ruta con `encodeURIComponent`: es base64url y
 * no debería necesitarlo, pero lo que llega por la dirección del navegador lo
 * escribió cualquiera.
 */
@Injectable({
  providedIn: 'root',
})
export class PrescriptionSharesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /clinical/prescription-shares` — crea el enlace de una receta. */
  create(target: PrescriptionShareTarget): Observable<CreatedPrescriptionShare> {
    return this.http
      .post<WireCreatedShare>(this.url('/clinical/prescription-shares'), target)
      .pipe(map(toCreated));
  }

  /** `GET /clinical/prescription-shares?patientProfileId=` — los enlaces del paciente. */
  listForPatient(patientProfileId: string): Observable<readonly PrescriptionShareSummary[]> {
    const params = new HttpParams().set('patientProfileId', patientProfileId);
    return this.http
      .get<readonly WireShareSummary[]>(this.url('/clinical/prescription-shares'), { params })
      .pipe(map((rows) => rows.map(toSummary)));
  }

  /** `POST /clinical/prescription-shares/:shareId/revoke` — 204. */
  revoke(shareId: string): Observable<void> {
    return this.http
      .post<null>(
        this.url(`/clinical/prescription-shares/${encodeURIComponent(shareId)}/revoke`),
        {},
      )
      .pipe(map(() => undefined));
  }

  /**
   * `GET /clinical/prescription-shares/by-token/:token` — 200 solo si el
   * enlace es de quien pregunta, 404 si no (D-1). No registra uso.
   */
  resolveOwnership(token: string): Observable<PrescriptionShareOwnership> {
    return this.http
      .get<PrescriptionShareOwnership>(
        this.url(`/clinical/prescription-shares/by-token/${encodeURIComponent(token)}`),
      )
      .pipe(
        map((body) => ({
          shareId: body.shareId,
          resourceType: body.resourceType,
          resourceId: body.resourceId,
        })),
      );
  }

  /** `GET /public/prescription-shares/:token` — sin sesión, sin PHI. */
  readPublic(token: string): Observable<PublicPrescriptionShare> {
    return this.http
      .get<WirePublicShare>(this.url(`/public/prescription-shares/${encodeURIComponent(token)}`))
      .pipe(map(toPublicShare));
  }

  /** `GET /public/prescriptions/:id/verify` — a donde apunta el QR del PDF. */
  verifyPrescription(prescriptionId: string): Observable<PrescriptionVerification> {
    return this.http
      .get<WireVerification>(
        this.url(`/public/prescriptions/${encodeURIComponent(prescriptionId)}/verify`),
      )
      .pipe(map(toVerification));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
