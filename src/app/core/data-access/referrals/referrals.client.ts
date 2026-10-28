import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly } from '../wire';
import {
  REFERRAL_STATUSES,
  REFERRAL_TYPES,
  type CreateReferralInput,
  type Referral,
  type ReferralStatus,
  type ReferralType,
  type RespondReferralInput,
} from './referrals.types';

/**
 * Una derivación como viaja: fechas en texto y opcionales en `null` (así
 * serializa el backend). Todo lo que no es `id`/`patientProfileId`/estado/alta
 * es opcional porque las filas anteriores al patch v4263 no lo traen.
 */
interface WireReferral {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly createdAt: string;
  readonly [campo: string]: unknown;
}

/** El listado puede llegar como arreglo (versión anterior) o con sobre. */
type WireReferralList = readonly WireReferral[] | { readonly items: readonly WireReferral[] };

/** Los campos de texto que se copian tal cual, si vienen con algo. */
const CAMPOS_DE_TEXTO = [
  'sourceEncounterId',
  'referringProfileId',
  'targetProfileId',
  'targetTenantId',
  'targetBranchId',
  'targetExternalName',
  'targetExternalContact',
  'targetProfileName',
  'targetTenantName',
  'targetBranchName',
  'specialtyConceptId',
  'requestedServiceText',
  'requestedServiceConceptId',
  'reasonConceptId',
  'reasonText',
  'diagnosisText',
  'clinicalSummary',
  'treatmentGivenText',
  'priorityConceptId',
  'rejectReason',
  'counterReferralText',
  'informedConsentId',
] as const;

/**
 * Cliente de **derivaciones** (`/referrals`, módulo `clinical_ext`).
 *
 * Emitir (UC-18-07), listar las de un paciente, leer una, responder desde el
 * destino (UC-18-08), registrar la contrarreferencia y anular. Contrato: API
 * `b19cc52d` (`ReferralResponseDto`; errores con `reason` en
 * `referrals.errors.ts`).
 *
 * ## La autoridad es la API
 *
 * Quién puede responder o contrarreferir lo decide el servidor (el destino o
 * su organización). El cliente no lo deduce: manda y muestra el 403 si llega.
 */
@Injectable({ providedIn: 'root' })
export class ReferralsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /referrals?patientProfileId=` — las derivaciones de una persona, de la
   * más reciente a la más antigua.
   */
  listByPatient(patientProfileId: string): Observable<readonly Referral[]> {
    const params = new HttpParams().set('patientProfileId', patientProfileId);
    return this.http
      .get<WireReferralList>(this.url('/referrals'), { params })
      .pipe(map((body) => (Array.isArray(body) ? body : (body as { items: readonly WireReferral[] }).items).map(toReferral)));
  }

  /** `GET /referrals/:id`. */
  get(id: string): Observable<Referral> {
    return this.http
      .get<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}`))
      .pipe(map(toReferral));
  }

  /**
   * `POST /referrals` — emite la derivación.
   *
   * Los opcionales vacíos se **omiten**: el backend valida con
   * `forbidNonWhitelisted` y una clave en `undefined` o `''` no es «sin dato».
   */
  create(entrada: CreateReferralInput): Observable<Referral> {
    const cuerpo = sinVacios({
      ...entrada,
      validUntil: diaDe(entrada.validUntil),
    });
    return this.http
      .post<WireReferral>(this.url('/referrals'), cuerpo)
      .pipe(map((body) => toReferral({ ...cuerpoComoWire(cuerpo), ...body })));
  }

  /**
   * `PATCH /referrals/:id/respond` — el destino acepta o rechaza (con motivo).
   *
   * @returns La derivación ya respondida (`{ ok, ...ReferralResponseDto }`).
   */
  respond(id: string, entrada: RespondReferralInput): Observable<Referral> {
    return this.http
      .patch<WireReferral>(
        this.url(`/referrals/${encodeURIComponent(id)}/respond`),
        sinVacios({ ...entrada }),
      )
      .pipe(map(toReferral));
  }

  /**
   * `PATCH /referrals/:id/counter-referral` — lo que el destino devuelve. Cierra
   * la derivación (`COMPLETED`). Si el destino es sólo externo, la transcribe
   * quien puede escribir la historia.
   */
  counterReferral(id: string, counterReferralText: string): Observable<Referral> {
    return this.http
      .patch<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}/counter-referral`), {
        counterReferralText,
      })
      .pipe(map(toReferral));
  }

  /** `PATCH /referrals/:id/cancel` — anula una pendiente o aceptada. Sin cuerpo. */
  cancel(id: string): Observable<Referral> {
    return this.http
      .patch<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}/cancel`), {})
      .pipe(map(toReferral));
  }

  /** `GET /referrals/me` — las derivaciones de la persona autenticada (rol paciente). */
  listMine(): Observable<readonly Referral[]> {
    return this.http
      .get<readonly WireReferral[]>(this.url('/referrals/me'))
      .pipe(map((body) => body.map(toReferral)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** El cable a la vista: `null` fuera, fechas a `Date`, enums sólo si se conocen. */
export function toReferral(body: WireReferral): Referral {
  const textos: Record<string, string> = {};
  for (const campo of CAMPOS_DE_TEXTO) {
    const valor = body[campo];
    if (typeof valor === 'string' && valor !== '') {
      textos[campo] = valor;
    }
  }
  const tipo = body['referralType'];
  const estado = body['status'];
  const validUntil = maybeDateOnly(texto(body['validUntil'])?.slice(0, 10));
  const respondedAt = maybeDate(texto(body['respondedAt']));
  const counterReferralAt = maybeDate(texto(body['counterReferralAt']));
  return {
    ...textos,
    id: body.id,
    patientProfileId: body.patientProfileId,
    statusConceptId: body.statusConceptId,
    createdAt: new Date(body.createdAt),
    ...(esTipo(tipo) ? { referralType: tipo } : {}),
    ...(esEstado(estado) ? { status: estado } : {}),
    ...(validUntil === undefined ? {} : { validUntil }),
    ...(respondedAt === undefined ? {} : { respondedAt }),
    ...(counterReferralAt === undefined ? {} : { counterReferralAt }),
  };
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor !== '' ? valor : undefined;
}

function esTipo(valor: unknown): valor is ReferralType {
  return typeof valor === 'string' && (REFERRAL_TYPES as readonly string[]).includes(valor);
}

function esEstado(valor: unknown): valor is ReferralStatus {
  return typeof valor === 'string' && (REFERRAL_STATUSES as readonly string[]).includes(valor);
}

/**
 * La respuesta del alta puede ser angosta (`id`, estado, alta): se completa
 * con lo enviado para que la pantalla pueda ofrecer el consentimiento dirigido
 * sin una segunda lectura.
 */
function cuerpoComoWire(cuerpo: Record<string, unknown>): WireReferral {
  return cuerpo as unknown as WireReferral;
}

/** La fecha en `YYYY-MM-DD` del día local, no en UTC. */
function diaDe(fecha: Date | undefined): string | undefined {
  if (fecha === undefined) {
    return undefined;
  }
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Fuera las claves en `undefined` y los textos vacíos o en blanco. */
function sinVacios(valor: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(valor)
      .filter(([, v]) => v !== undefined && !(typeof v === 'string' && v.trim() === ''))
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
  );
}
