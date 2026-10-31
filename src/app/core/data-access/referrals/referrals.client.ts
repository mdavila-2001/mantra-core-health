import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Subject, tap, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import * as wire from '../wire';
import {
  REFERRAL_STATUSES,
  REFERRAL_TYPES,
  type NewReferral,
  type Referral,
  type ReferralCreated,
  type ReferralTarget,
  type ReferralTargetKind,
  type ReferralTargetService,
  type ReferralStatus,
  type ReferralType,
  type RespondReferralInput,
} from './referrals.types';

/** Cuántas letras pide el servidor antes de buscar un destino. */
export const REFERRAL_TARGET_MIN_QUERY = 2;

/** La fila de la lista tal como viaja: fechas en texto y opcionales en `null`. */
type WireReferral = wire.ConNulos<
  Omit<Referral, 'createdAt' | 'validUntil' | 'respondedAt' | 'counterReferralAt' | 'referralType' | 'status'>
> & {
  readonly createdAt: string;
  readonly validUntil?: string | null;
  readonly respondedAt?: string | null;
  readonly counterReferralAt?: string | null;
  readonly referralType?: string | null;
  readonly status?: string | null;
};

/**
 * Derivaciones: el médico recomienda a la persona que consulte con otro
 * profesional, o la deriva a una organización médica, por un servicio
 * concreto de su catálogo.
 *
 * La derivación **no reserva nada**: con un encuentro, la API le avisa a la
 * persona en su campana —a un profesional o a una organización de la
 * plataforma; a un destino externo no— y ahí reserva con la reserva de
 * siempre. Elegir otro profesional de la misma especialidad sigue siendo
 * posible.
 *
 * Quién puede recibir una derivación y qué servicios ofrece lo resuelve la API
 * (`/referrals/targets` y `/referrals/target-services`), no el directorio
 * público: el destino puede ser una organización de otro tenant.
 */
@Injectable({ providedIn: 'root' })
export class ReferralsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly issuedReferrals = new Subject<ReferralCreated>();

  /**
   * Cada derivación emitida con éxito, de quien sea que la haya pedido.
   *
   * Existe para que la lista que se muestra (`ConsultationReferrals`) se relea
   * **aunque quien emitió ya no esté montado**: si el médico cierra el modal
   * mientras el `POST` viaja, el bloque se destruye y su `output` ya no llega
   * a nadie; la respuesta, en cambio, sigue pasando por acá.
   */
  readonly issued: Observable<ReferralCreated> = this.issuedReferrals.asObservable();

  /**
   * `POST /referrals` — emite la derivación. 404 con `reason` si el destino,
   * el servicio o el encuentro no están (`REFERRAL_TARGET_NOT_FOUND`,
   * `REFERRAL_SERVICE_NOT_FOUND`, `REFERRAL_ENCOUNTER_NOT_FOUND`); 409
   * `REFERRAL_ALREADY_EXISTS` si ya hay una equivalente en ese encuentro; 422
   * si falta el destino o el servicio no corresponde (ver `referrals.errors.ts`).
   */
  create(body: NewReferral): Observable<ReferralCreated> {
    const { validUntil, ...rest } = body;
    return this.http
      .post<ReferralCreated>(this.url('/referrals'), {
        ...rest,
        ...(validUntil === undefined ? {} : { validUntil: toLocalDay(validUntil) }),
      })
      .pipe(
        // La persona es la del pedido: es la que se sabe seguro, venga lo que
        // venga en la respuesta.
        tap((created) => this.issuedReferrals.next({ ...created, patientProfileId: body.patientProfileId })),
      );
  }

  /**
   * `GET /referrals/targets` — destinos posibles por nombre.
   *
   * @param q - Lo escrito. El servidor exige {@link REFERRAL_TARGET_MIN_QUERY} letras.
   * @param kind - Profesional u organización médica.
   */
  searchTargets(q: string, kind: ReferralTargetKind): Observable<readonly ReferralTarget[]> {
    return this.http
      .get<{ readonly items: readonly ReferralTarget[] }>(this.url('/referrals/targets'), {
        params: new HttpParams().set('q', q).set('kind', kind),
      })
      .pipe(map((body) => body.items));
  }

  /**
   * `GET /referrals/target-services` — los servicios concretos de un destino.
   *
   * Se pide por **uno** de los dos: una unión y no dos opcionales, para que no
   * se pueda armar la petición con los dos o con ninguno.
   */
  listTargetServices(
    target: { readonly targetProfileId: string } | { readonly targetTenantId: string },
  ): Observable<readonly ReferralTargetService[]> {
    const params =
      'targetProfileId' in target
        ? new HttpParams().set('targetProfileId', target.targetProfileId)
        : new HttpParams().set('targetTenantId', target.targetTenantId);
    return this.http
      .get<{
        readonly items: readonly ReferralTargetService[];
      }>(this.url('/referrals/target-services'), { params })
      .pipe(map((body) => body.items));
  }

  /**
   * `GET /referrals?patientProfileId=` — las derivaciones de la persona, de la
   * más reciente a la más vieja (el orden lo pone el servidor).
   */
  listByPatient(patientProfileId: string): Observable<readonly Referral[]> {
    return this.http
      .get<readonly WireReferral[]>(this.url('/referrals'), {
        params: new HttpParams().set('patientProfileId', patientProfileId),
      })
      .pipe(map((rows) => rows.map(toReferral)));
  }

  /** `GET /referrals/:id`. 404 `REFERRAL_NOT_FOUND` también para quien no la puede ver. */
  get(id: string): Observable<Referral> {
    return this.http
      .get<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}`))
      .pipe(map(toReferral));
  }

  /**
   * `PATCH /referrals/:id/respond` — el destino acepta o rechaza (con motivo).
   *
   * Exige organización activa (`X-Tenant-Id`, lo pone el interceptor; sin
   * ella, 422 `TENANT_REQUIRED`). Quien no es destino recibe 404
   * `REFERRAL_NOT_FOUND`: la API no confirma que la derivación exista.
   *
   * @returns La derivación ya respondida (`{ ok, ...ReferralResponseDto }`).
   */
  respond(id: string, body: RespondReferralInput): Observable<Referral> {
    const rejectReason = body.rejectReason?.trim();
    return this.http
      .patch<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}/respond`), {
        decision: body.decision,
        ...(rejectReason === undefined || rejectReason === '' ? {} : { rejectReason }),
      })
      .pipe(map(toReferral));
  }

  /**
   * `PATCH /referrals/:id/counter-referral` — lo que el destino devuelve.
   * Cierra la derivación (`COMPLETED`). Si el destino es sólo externo, la
   * transcribe quien puede escribir la historia.
   */
  counterReferral(id: string, counterReferralText: string): Observable<Referral> {
    return this.http
      .patch<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}/counter-referral`), {
        counterReferralText: counterReferralText.trim(),
      })
      .pipe(map(toReferral));
  }

  /** `PATCH /referrals/:id/cancel` — anula una pendiente o aceptada. Sin cuerpo. */
  cancel(id: string): Observable<Referral> {
    return this.http
      .patch<WireReferral>(this.url(`/referrals/${encodeURIComponent(id)}/cancel`), {})
      .pipe(map(toReferral));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toReferral(row: WireReferral): Referral {
  const { createdAt, validUntil, respondedAt, counterReferralAt, referralType, status, ...rest } = row;
  // `respond` devuelve además `ok`: no es parte de la derivación.
  const { ok: _ok, ...fields } = rest as typeof rest & { readonly ok?: unknown };
  const clean = wire.sinNulos(fields as wire.ConNulos<Omit<Referral, 'createdAt'>>);
  const knownType = isKnownType(referralType) ? referralType : undefined;
  const knownStatus = isKnownStatus(status) ? status : undefined;
  const validDay = wire.maybeDateOnly(validUntil);
  const responded = wire.maybeDate(respondedAt);
  const countered = wire.maybeDate(counterReferralAt);
  return {
    ...clean,
    createdAt: new Date(createdAt),
    ...(knownType === undefined ? {} : { referralType: knownType }),
    ...(knownStatus === undefined ? {} : { status: knownStatus }),
    ...(validDay === undefined ? {} : { validUntil: validDay }),
    ...(responded === undefined ? {} : { respondedAt: responded }),
    ...(countered === undefined ? {} : { counterReferralAt: countered }),
  };
}

/** Un estado que esta versión no conoce no se inventa: queda sin estado legible. */
function isKnownStatus(value: string | null | undefined): value is ReferralStatus {
  return (REFERRAL_STATUSES as readonly string[]).includes(value ?? '');
}

/** Un código que esta versión no conoce no se inventa: queda sin tipo. */
function isKnownType(value: string | null | undefined): value is ReferralType {
  return (REFERRAL_TYPES as readonly string[]).includes(value ?? '');
}

/**
 * La fecha en `YYYY-MM-DD`, en el día **local**: `toISOString()` correría al
 * día anterior todo lo elegido después de las 20:00 en Bolivia.
 */
function toLocalDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
