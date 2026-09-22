import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type {
  MyRoleAssignment,
  NewOwnSite,
  OwnSitePatch,
  PracticeSite,
  PracticeSitePage,
  RoleAssignmentResult,
  SelfRequestAffiliationInput,
} from './practice-sites.types';

/**
 * Cliente de los **consultorios** de `practice` (M14).
 *
 * ## Por qué existe esta carpeta y no una llamada más en `scheduling`
 *
 * El backend modela sedes desde siempre (`practice.practice_sites`,
 * `GET /practices/:practiceId/sites`) y el frontend no tenía **ningún** cliente
 * para ellas: `grep -rln "practice/sites" src/app/core/data-access` daba cero.
 * El resultado era que el sistema sabía *cuándo* atiende un profesional y no
 * *dónde*, y un turno sin dirección obliga a averiguarla por fuera —que es
 * justo lo que el sistema existe para evitar—.
 *
 * ## Se pide por profesional, no por práctica
 *
 * `GET /practices/:practiceId/sites` responde otra pregunta —«¿qué sedes tiene
 * esta organización?»— y para hacerla hay que saber primero en qué práctica
 * trabaja el profesional, que es lo que se está preguntando. Por eso el
 * endpoint que consume este cliente cuelga de `/practitioners/:profileId/sites`.
 *
 * ## La agenda ya no necesita este cliente para lo suyo
 *
 * `GET /scheduling/resources` trae la sede resuelta en cada recurso, así que la
 * agenda no encadena una petición por profesional. Este cliente es para las
 * pantallas que preguntan por una persona concreta —el perfil, la ficha del
 * profesional— donde no hay agenda de por medio.
 */
@Injectable({
  providedIn: 'root',
})
export class PracticeSitesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practitioners/:profileId/sites` — dónde atiende el profesional.
   *
   * Sale de sus asignaciones de rol vigentes, la principal primero. Una lista
   * vacía es un estado normal: quien la reciba tiene que decirlo como «no tiene
   * consultorio registrado», nunca como un fallo.
   *
   * @param practitionerProfileId - Profesional consultado.
   * @returns Sus consultorios, con nombre y dirección.
   */
  listSitesOfPractitioner(practitionerProfileId: string): Observable<PracticeSitePage> {
    return this.http.get<PracticeSitePage>(
      this.url(`/practitioners/${encodeURIComponent(practitionerProfileId)}/sites`),
    );
  }

  /**
   * `GET /practitioners/me/role-assignments` — Carril 18: mis vinculaciones
   * con organizaciones, en cualquier estado (pendiente, activa, suspendida,
   * rechazada, finalizada). No implica acceso a los pacientes de esas
   * organizaciones.
   */
  listMyRoleAssignments(): Observable<readonly MyRoleAssignment[]> {
    return this.http
      .get<readonly ConNulos<WireRoleAssignment>[]>(
        this.url('/practitioners/me/role-assignments'),
      )
      .pipe(map((items) => items.map(aVinculacion)));
  }

  /**
   * `POST /practices/{practiceId}/role-assignments/self-request` — pido
   * vincularme a una organización. Queda pendiente hasta que ella la
   * apruebe, rechace, suspenda o finalice.
   */
  selfRequestAffiliation(
    practiceId: string,
    input: SelfRequestAffiliationInput,
  ): Observable<RoleAssignmentResult> {
    return this.http
      .post<ConNulos<WireRoleAssignmentResult>>(
        this.url(`/practices/${encodeURIComponent(practiceId)}/role-assignments/self-request`),
        input,
      )
      .pipe(map(aResultadoDeVinculacion));
  }

  /**
   * `POST /practitioners/me/sites` — ALV-005/006: registro un consultorio
   * propio. El backend crea (o reutiliza) mi práctica personal, la dirección
   * si la mando y la vinculación que conecta la sede con mi agenda.
   *
   * @param input - Nombre, huso horario y dirección opcional.
   * @returns La sede recién creada, en el mismo formato que la lista.
   */
  createOwnSite(input: NewOwnSite): Observable<PracticeSite> {
    return this.http.post<PracticeSite>(this.url('/practitioners/me/sites'), input);
  }

  /**
   * `PATCH /practitioners/me/sites/:siteId` — corrijo mi consultorio propio.
   *
   * **Sólo el propio.** Una sede de otra organización no se corrige desde acá:
   * es de ella, y lo que uno tiene con ella es una vinculación, no la sede.
   *
   * Expuesta por la API desde el cierre del P32-b. Devuelve la sede con los
   * cambios aplicados, en el mismo formato que la lista.
   *
   * @param siteId - El consultorio a corregir.
   * @param input - Sólo los campos que cambian.
   * @returns La sede con los cambios aplicados.
   */
  updateOwnSite(siteId: string, input: OwnSitePatch): Observable<PracticeSite> {
    return this.http.patch<PracticeSite>(
      this.url(`/practitioners/me/sites/${encodeURIComponent(siteId)}`),
      input,
    );
  }

  /**
   * `PUT /practitioners/me/sites/:siteId/bank-qr` — el QR bancario con el que
   * cobro **en esta sede**.
   *
   * Va por su propia ruta y no dentro del `PATCH` del consultorio por dos
   * razones. La primera es de alcance: el `PATCH` sólo corrige el consultorio
   * **propio**, y el QR se configura también en la clínica u hospital donde el
   * profesional atiende sin ser dueño de la sede — lo que se guarda ahí no es
   * la sede, es con qué cobra él en ella. La segunda es de contrato: el
   * archivo ya está subido (`FilesClient.upload`) y lo único que viaja es su
   * id, así que mezclarlo con nombre y dirección obligaría a mandar el resto
   * del consultorio para cambiar una imagen.
   *
   * Expuesta por la API desde el cierre del P33. Autoriza por vinculación
   * vigente con la sede, no por ser dueño de la práctica: por eso también
   * funciona en la clínica donde el profesional atiende sin ser dueño.
   *
   * @param siteId - La sede donde se cobra con ese QR.
   * @param fileId - El archivo ya subido, o `null` para dejarla sin QR.
   * @returns La sede con el QR aplicado.
   */
  setSiteBankQr(siteId: string, fileId: string | null): Observable<PracticeSite> {
    return this.http.put<PracticeSite>(
      this.url(`/practitioners/me/sites/${encodeURIComponent(siteId)}/bank-qr`),
      { fileId },
    );
  }

  /**
   * `DELETE /practitioners/me/sites/:siteId` — ALV-005: dejo de atender en
   * esa sede. No se borra: se cierra mi vinculación vigente con ella.
   */
  removeOwnSite(siteId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/practitioners/me/sites/${encodeURIComponent(siteId)}`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- Carril 18: transporte de "mis organizaciones" ------------------------ */

interface WireRoleAssignment {
  readonly id: string;
  readonly practiceId: string;
  readonly practiceName: string;
  readonly practiceType: string | null;
  readonly practiceSiteId: string | null;
  readonly roleConceptId: string;
  readonly specialtyConceptId: string | null;
  readonly status: string;
  readonly isPrimary: boolean;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly createdAt: string;
  readonly avatarUrl: string | null;
}

interface WireRoleAssignmentResult {
  readonly id: string;
  readonly practiceId: string;
  readonly practitionerProfileId: string;
  readonly status: string;
  readonly createdAt: string;
}

function aVinculacion(body: ConNulos<WireRoleAssignment>): MyRoleAssignment {
  const { validFrom, validTo, createdAt, avatarUrl, ...resto } = body;
  return {
    ...sinNulos(resto),
    ...(maybeDateOnly(validFrom) === undefined ? {} : { validFrom: maybeDateOnly(validFrom) }),
    ...(maybeDateOnly(validTo) === undefined ? {} : { validTo: maybeDateOnly(validTo) }),
    createdAt: maybeDate(createdAt) ?? new Date(createdAt as string),
    // A diferencia del resto: `avatarUrl` es `string | null` en la vista, no
    // opcional, así que un `null` del servidor se conserva en vez de
    // eliminarse la clave (lo que hace `sinNulos` con cualquier otro campo).
    avatarUrl,
  };
}

function aResultadoDeVinculacion(
  body: ConNulos<WireRoleAssignmentResult>,
): RoleAssignmentResult {
  const { createdAt, ...resto } = body;
  return {
    ...sinNulos(resto),
    createdAt: maybeDate(createdAt) ?? new Date(createdAt as string),
  };
}
