import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { nombreDeContentDisposition } from '../files/content-disposition';
import type {
  BinaryDownload,
  PortabilityExportInput,
  PortabilityExportResult,
  PortabilitySummary,
  PortabilityVerification,
} from './insurance-portability.types';

/* ---- formas de transporte --------------------------------------------------
   `generatedAt` viaja como instante ISO completo (no una vigencia de sólo
   fecha): pasa por `maybeDate`-equivalente acá mismo, sin tipo `Wire*`
   separado porque es el único campo que necesita conversión. */

type WirePortabilitySummary = PortabilitySummary;

interface WirePortabilityExportResult
  extends Omit<PortabilityExportResult, 'generatedAt' | 'summary'> {
  readonly generatedAt: string;
  readonly summary: WirePortabilitySummary;
}

interface WirePortabilityVerification
  extends Omit<PortabilityVerification, 'generatedAt'> {
  readonly generatedAt: string;
}

function toExportResult(wire: WirePortabilityExportResult): PortabilityExportResult {
  return { ...wire, generatedAt: new Date(wire.generatedAt) };
}

function toVerification(wire: WirePortabilityVerification): PortabilityVerification {
  return { ...wire, generatedAt: new Date(wire.generatedAt) };
}

/**
 * Portabilidad de póliza e historial de siniestralidad a 1 clic (subtarea
 * 3.3): exportar el certificado del titular, descargarlo en PDF o JSON, y
 * verificarlo públicamente por su sello.
 */
@Injectable({ providedIn: 'root' })
export class InsurancePortabilityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /insurance/portability/export` — arma, sella y persiste el certificado. */
  exportPortability(input: PortabilityExportInput): Observable<PortabilityExportResult> {
    return this.http
      .post<WirePortabilityExportResult>(this.url('/insurance/portability/export'), input)
      .pipe(map(toExportResult));
  }

  /**
   * `GET /insurance/portability/certificates/:certificateId/pdf` — el
   * certificado oficial, con su código QR de verificación.
   */
  downloadCertificatePdf(certificateId: string): Observable<BinaryDownload> {
    return this.http
      .get(
        this.url(
          `/insurance/portability/certificates/${encodeURIComponent(certificateId)}/pdf`,
        ),
        { responseType: 'blob', observe: 'response' },
      )
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body ?? new Blob([]),
          fileName: nombreDeContentDisposition(
            respuesta.headers.get('Content-Disposition'),
          ),
        })),
      );
  }

  /**
   * `GET /insurance/portability/certificates/:certificateId/json` — el
   * certificado en JSON interoperable, tal como se selló.
   */
  downloadCertificateJson(certificateId: string): Observable<BinaryDownload> {
    return this.http
      .get(
        this.url(
          `/insurance/portability/certificates/${encodeURIComponent(certificateId)}/json`,
        ),
        { responseType: 'blob', observe: 'response' },
      )
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body ?? new Blob([]),
          fileName: nombreDeContentDisposition(
            respuesta.headers.get('Content-Disposition'),
          ),
        })),
      );
  }

  /**
   * `GET /public/portability/verify/:manifestHash` — sin sesión: confirma
   * que el certificado existe y con qué se emitió.
   */
  verifyCertificate(manifestHash: string): Observable<PortabilityVerification> {
    return this.http
      .get<WirePortabilityVerification>(
        this.url(`/public/portability/verify/${encodeURIComponent(manifestHash)}`),
      )
      .pipe(map(toVerification));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
