import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, sinNulos, type ConNulos } from '../wire';
import type {
  DentalCatalog,
  DentalProcedure,
  DentalProcedurePage,
  DentalProcedureRegistration,
  NewDentalProcedure,
  OperativeFinding,
  OperativeStep,
  PatientHistoryQuery,
  ProcedureImplant,
  SurgicalCase,
  SurgicalCaseDetail,
  SurgicalCasePage,
} from './procedures.types';

/**
 * Cliente del **histórico de procedimientos** — `procedures_perioperative` (M53).
 *
 * ## Dos historias, un módulo
 *
 * Lo quirúrgico y lo odontológico salen del mismo módulo del backend y se leen
 * en la misma pantalla, así que van en un cliente. No es una fusión arbitraria:
 * el registro odontológico se persiste como procedimiento clínico con categoría
 * odontológica, y su endpoint vive en el módulo perioperatorio porque la pieza
 * tratada es una tabla de ese esquema.
 *
 * ## Por qué la lista y el detalle son dos lecturas
 *
 * `GET /procedure-cases` devuelve **sólo cabeceras** —número, estado, horas—;
 * el equipo, los pasos, los hallazgos y los implantes están en
 * `GET /procedure-cases/:id`. No es un capricho del contrato: la agenda del día
 * de un quirófano no puede arrastrar el registro intraoperatorio de cada caso.
 * La pantalla pide la lista y luego el detalle **de los casos que va a mostrar**.
 *
 * ## Roles
 *
 * Lo quirúrgico exige uno de los cinco roles perioperatorios (`SURGEON`,
 * `ANESTHESIOLOGIST`, `PERIOP_NURSE`, `SURGERY_SCHEDULER`, `PERIOP_ADMIN`); lo
 * odontológico, `CLINICIAN` o `PRACTITIONER`. Son distintos a propósito y por
 * eso las dos lecturas van **por separado** y no en un `forkJoin` que exija las
 * dos: un odontólogo tiene derecho a ver el histórico odontológico de su
 * paciente aunque el quirúrgico le responda `403`, y al revés. Atarlas haría que
 * el permiso más estrecho se llevara puesta la mitad que sí se puede ver.
 */
@Injectable({
  providedIn: 'root',
})
export class ProceduresClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /procedure-cases` — casos quirúrgicos de una persona.
   *
   * Siempre acotado al paciente: el backend admite listar la agenda entera del
   * quirófano, pero esta pantalla es una ficha clínica y pedir sin filtro sería
   * traerse la actividad quirúrgica de toda la organización para mostrar la de
   * una persona.
   *
   * @param query - Paciente y tope de página.
   * @returns La página de casos y el total sin paginar.
   */
  listCases(query: PatientHistoryQuery): Observable<SurgicalCasePage> {
    return this.http
      .get<WireCasePage>(this.url('/procedure-cases'), { params: filtroDe(query) })
      .pipe(map((body) => ({ items: body.items.map(toCase), total: body.total })));
  }

  /**
   * `GET /procedure-cases/:id` — el detalle agregado del caso.
   *
   * @param caseId - Caso a leer.
   * @returns Equipo, pasos, hallazgos, implantes e informes del caso.
   */
  getCase(caseId: string): Observable<SurgicalCaseDetail> {
    return this.http
      .get<WireCaseDetail>(this.url(`/procedure-cases/${encodeURIComponent(caseId)}`))
      .pipe(
        map((body) => ({
          case: toCase(body.case),
          team: (body.team ?? []).map((integrante) =>
            sinNulos<SurgicalCaseDetail['team'][number]>(integrante),
          ),
          operativeSteps: (body.operativeSteps ?? []).map(toStep),
          findings: (body.findings ?? []).map(toFinding),
          implants: (body.implants ?? []).map(toImplant),
          operativeReports: (body.operativeReports ?? []).map(
            ({ signedAt, ...informe }) => ({
              ...informe,
              ...opcional('signedAt', signedAt),
            }),
          ),
        })),
      );
  }

  /**
   * `GET /dental-procedures` — histórico odontológico de una persona.
   *
   * @param query - Paciente y tope de página.
   * @returns La página del histórico y el total sin paginar.
   */
  listDentalProcedures(query: PatientHistoryQuery): Observable<DentalProcedurePage> {
    return this.http
      .get<WireDentalPage>(this.url('/dental-procedures'), { params: filtroDe(query) })
      .pipe(map((body) => ({ items: body.items.map(toDental), total: body.total })));
  }

  /**
   * `GET /dental-procedures/catalog` — con qué se llena el formulario de alta.
   *
   * @returns Códigos de procedimiento, piezas (FDI) y cuadrantes.
   */
  readDentalCatalog(): Observable<DentalCatalog> {
    return this.http.get<DentalCatalog>(this.url('/dental-procedures/catalog'));
  }

  /**
   * `POST /dental-procedures` — registra un tratamiento ya realizado.
   *
   * @param procedimiento - Cuerpo del alta.
   * @returns El procedimiento creado.
   */
  recordDentalProcedure(
    procedimiento: NewDentalProcedure,
  ): Observable<DentalProcedureRegistration> {
    return this.http
      .post<WireDentalRegistration>(this.url('/dental-procedures'), procedimiento)
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * Los filtros del histórico.
 *
 * `limit` sólo viaja si se pidió: el backend valida con `forbidNonWhitelisted`,
 * y una clave declarada en `undefined` volvería como `400`.
 */
function filtroDe(query: PatientHistoryQuery): HttpParams {
  const params = new HttpParams().set('patientProfileId', query.patientProfileId);
  return query.limit === undefined ? params : params.set('limit', String(query.limit));
}

/* ---- formas de transporte ------------------------------------------------
    Los opcionales vacíos llegan como `null`, no ausentes —está verificado
    contra la API viva y documentado en `wire.ts`—. Por eso todo lo que no es
    fecha pasa por `sinNulos`: sin él, `primarySurgeonProfileId` valdría `null`
    y `si (caso.primarySurgeonProfileId)` daría falso por el motivo equivocado,
    que es exactamente el defecto que marcó fallecida a toda persona viva en la
    ficha de paciente.
    ------------------------------------------------------------------------- */

type WireCase = ConNulos<Omit<SurgicalCase, 'scheduledStartAt' | 'scheduledEndAt'>> & {
  readonly scheduledStartAt?: string | null;
  readonly scheduledEndAt?: string | null;
};

interface WireCasePage {
  readonly items: readonly WireCase[];
  readonly total: number;
}

type WireStep = ConNulos<Omit<OperativeStep, 'startedAt' | 'endedAt'>> & {
  readonly startedAt?: string | null;
  readonly endedAt?: string | null;
};

type WireFinding = ConNulos<Omit<OperativeFinding, 'recordedAt'>> & {
  readonly recordedAt: string;
};

type WireIdentifier = ConNulos<
  Omit<ProcedureImplant['identifiers'][number], 'expirationDate'>
> & {
  readonly expirationDate?: string | null;
};

type WireImplant = ConNulos<
  Omit<ProcedureImplant, 'implantedAt' | 'explantedAt' | 'identifiers'>
> & {
  readonly implantedAt: string;
  readonly explantedAt?: string | null;
  readonly identifiers?: readonly WireIdentifier[] | null;
};

interface WireCaseDetail {
  readonly case: WireCase;
  readonly team?: readonly SurgicalCaseDetail['team'][number][] | null;
  readonly operativeSteps?: readonly WireStep[] | null;
  readonly findings?: readonly WireFinding[] | null;
  readonly implants?: readonly WireImplant[] | null;
  readonly operativeReports?:
    | readonly {
        readonly id: string;
        readonly reportVersion: number;
        readonly statusConceptId: string;
        readonly signedAt?: string | null;
      }[]
    | null;
}

type WireDental = ConNulos<Omit<DentalProcedure, 'performedAt' | 'createdAt' | 'sites'>> & {
  readonly performedAt?: string | null;
  readonly createdAt: string;
  readonly sites?: readonly ConNulos<DentalProcedure['sites'][number]>[] | null;
};

interface WireDentalPage {
  readonly items: readonly WireDental[];
  readonly total: number;
}

/** La respuesta del alta no tiene opcionales: no hay `null` que normalizar. */
type WireDentalRegistration = Omit<DentalProcedureRegistration, 'createdAt'> & {
  readonly createdAt: string;
};

function toCase({ scheduledStartAt, scheduledEndAt, ...resto }: WireCase): SurgicalCase {
  return {
    ...sinNulos<Omit<SurgicalCase, 'scheduledStartAt' | 'scheduledEndAt'>>(resto),
    ...opcional('scheduledStartAt', scheduledStartAt),
    ...opcional('scheduledEndAt', scheduledEndAt),
  };
}

function toStep({ startedAt, endedAt, ...resto }: WireStep): OperativeStep {
  return {
    ...sinNulos<Omit<OperativeStep, 'startedAt' | 'endedAt'>>(resto),
    ...opcional('startedAt', startedAt),
    ...opcional('endedAt', endedAt),
  };
}

function toFinding({ recordedAt, ...resto }: WireFinding): OperativeFinding {
  return {
    ...sinNulos<Omit<OperativeFinding, 'recordedAt'>>(resto),
    recordedAt: new Date(recordedAt),
  };
}

function toImplant({
  implantedAt,
  explantedAt,
  identifiers,
  ...resto
}: WireImplant): ProcedureImplant {
  return {
    ...sinNulos<Omit<ProcedureImplant, 'implantedAt' | 'explantedAt' | 'identifiers'>>(
      resto,
    ),
    implantedAt: new Date(implantedAt),
    ...opcional('explantedAt', explantedAt),
    // Un implante sin identificadores trae un arreglo vacío, no `undefined`: el
    // consumidor no debería tener que distinguir «sin lote» de «sin dato».
    identifiers: (identifiers ?? []).map(({ expirationDate, ...identificador }) => ({
      ...sinNulos<Omit<ProcedureImplant['identifiers'][number], 'expirationDate'>>(
        identificador,
      ),
      ...opcional('expirationDate', expirationDate),
    })),
  };
}

function toDental({ performedAt, createdAt, sites, ...resto }: WireDental): DentalProcedure {
  return {
    ...sinNulos<Omit<DentalProcedure, 'performedAt' | 'createdAt' | 'sites'>>(resto),
    ...opcional('performedAt', performedAt),
    createdAt: new Date(createdAt),
    // Un tratamiento sin pieza registrada es corriente —no todo procedimiento
    // odontológico es sobre un diente—, pero el arreglo tiene que estar.
    sites: (sites ?? []).map((site) => sinNulos<DentalProcedure['sites'][number]>(site)),
  };
}

/**
 * Una fecha opcional, con la clave **ausente** cuando no vino.
 *
 * `maybeDate` ya resuelve el `null` —y el `new Date(null)` que sería 1970—;
 * esto agrega la otra mitad: dejar la clave fuera en vez de en `undefined`,
 * para que `in` y `Object.keys` digan lo mismo que el tipo.
 */
function opcional<K extends string>(
  clave: K,
  value?: string | null,
): Partial<Record<K, Date>> {
  const fecha = maybeDate(value);
  return (fecha === undefined ? {} : { [clave]: fecha }) as Partial<Record<K, Date>>;
}
