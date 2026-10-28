import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import {
  REFERRAL_TYPES,
  type NewReferral,
  type Referral,
  type ReferralCreated,
  type ReferralTarget,
  type ReferralTargetKind,
  type ReferralTargetService,
  type ReferralType,
} from './referrals.types';

/** Cuántas letras pide el servidor antes de buscar un destino. */
export const REFERRAL_TARGET_MIN_QUERY = 2;

/** La fila de la lista tal como viaja: fechas en texto y opcionales en `null`. */
type WireReferral = ConNulos<
  Omit<Referral, 'createdAt' | 'validUntil' | 'respondedAt' | 'referralType'>
> & {
  readonly createdAt: string;
  readonly validUntil?: string | null;
  readonly respondedAt?: string | null;
  readonly referralType?: string | null;
};

/**
 * Derivaciones: el médico recomienda a la persona que consulte con otro
 * profesional, o la deriva a una organización médica, por un servicio
 * concreto de su catálogo.
 *
 * La derivación **no reserva nada**: la API le avisa a la persona en su
 * campana, con un enlace a la ficha del profesional recomendado, y ahí reserva
 * con la reserva de siempre. Elegir otro profesional de la misma especialidad
 * sigue siendo posible.
 *
 * Quién puede recibir una derivación y qué servicios ofrece lo resuelve la API
 * (`/referrals/targets` y `/referrals/target-services`), no el directorio
 * público: el destino puede ser una organización de otro tenant.
 */
@Injectable({ providedIn: 'root' })
export class ReferralsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /referrals` — emite la derivación. 404 si el encuentro no es de esa
   * persona o de la organización de quien deriva; 409 si ya existe una
   * equivalente.
   */
  create(body: NewReferral): Observable<ReferralCreated> {
    const { validUntil, ...resto } = body;
    return this.http.post<ReferralCreated>(this.url('/referrals'), {
      ...resto,
      ...(validUntil === undefined ? {} : { validUntil: diaDe(validUntil) }),
    });
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
    destino: { readonly targetProfileId: string } | { readonly targetTenantId: string },
  ): Observable<readonly ReferralTargetService[]> {
    const params =
      'targetProfileId' in destino
        ? new HttpParams().set('targetProfileId', destino.targetProfileId)
        : new HttpParams().set('targetTenantId', destino.targetTenantId);
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
      .pipe(map((filas) => filas.map(toReferral)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toReferral(fila: WireReferral): Referral {
  const { createdAt, validUntil, respondedAt, referralType, ...resto } = fila;
  const limpio = sinNulos(resto as ConNulos<Omit<Referral, 'createdAt'>>);
  const tipo = esTipo(referralType) ? referralType : undefined;
  const vigencia = maybeDateOnly(validUntil);
  const respondida = maybeDate(respondedAt);
  return {
    ...limpio,
    createdAt: new Date(createdAt),
    ...(tipo === undefined ? {} : { referralType: tipo }),
    ...(vigencia === undefined ? {} : { validUntil: vigencia }),
    ...(respondida === undefined ? {} : { respondedAt: respondida }),
  };
}

/** Un código que esta versión no conoce no se inventa: queda sin tipo. */
function esTipo(valor: string | null | undefined): valor is ReferralType {
  return (REFERRAL_TYPES as readonly string[]).includes(valor ?? '');
}

/**
 * La fecha en `YYYY-MM-DD`, en el día **local**: `toISOString()` correría al
 * día anterior todo lo elegido después de las 20:00 en Bolivia.
 */
function diaDe(fecha: Date): string {
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
