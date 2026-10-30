import {
  conflict,
  notFound,
  preconditionFailed,
  validation,
  type MockRouter,
} from '../mock-router';
import { ahora, Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';

/**
 * P34 · el simulador de «abre 24 h» y de los turnos de guardia de las sedes de
 * farmacia, con el mismo contrato que la API:
 *
 * - `GET /pharmacies/:pharmacyId/opening-hours`
 * - `PUT /pharmacies/:pharmacyId/sites/:siteId/open-24h`
 * - `POST /pharmacies/:pharmacyId/sites/:siteId/on-call-shifts`
 * - `POST /pharmacies/:pharmacyId/on-call-shifts/:shiftId/cancel`
 * - `GET /public/pharmacies/open-now`
 *
 * Aparte de `pharmacy.handlers.ts` para no seguir engordándolo; ése le pasa sus
 * sedes y usa `open24hDe`/`turnoVigente` en `GET /pharmacy/sites`.
 */

/** Lo que este simulador necesita saber de cada sede de la maqueta. */
export interface SedeConHorario {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly addressText: string;
  readonly lat: number;
  readonly lng: number;
  /** Las sucursales reales del corpus no reciben 24 h ni turno inventados. */
  readonly fromCorpus: boolean;
}

/** El horario simulado de un conjunto de sedes. */
export interface HorarioSimulado {
  open24hDe(siteId: string): boolean | null;
  turnoVigente(siteId: string, ahoraMs?: number): { readonly endsAt: string } | undefined;
  registrar(
    router: MockRouter,
    distanciaKm: (aLat: number, aLng: number, bLat: number, bLng: number) => number,
  ): void;
}

/** Hora ISO-8601 con desplazamiento explícito: lo mismo que exige el DTO de la API. */
const CON_DESPLAZAMIENTO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function horarioDeFarmacias(FARMACIAS: readonly SedeConHorario[]): HorarioSimulado {
  /**
   * Sólo las farmacias **de la maqueta** reciben 24 h o turno de ejemplo: a una
   * sucursal real del corpus no se le inventa que abre de noche — mandaría a
   * alguien a una puerta cerrada. Datos sintéticos, declarados como tales.
   */
  const DE_LA_MAQUETA = FARMACIAS.filter((f) => !f.fromCorpus);
  type FarmaciaSimulada = SedeConHorario;
  /** La declaración de 24 h de una sede. `id` es el `siteId`. */
  interface Apertura24hSimulada {
    readonly id: string;
    readonly open24h: boolean | null;
  }

  interface TurnoSimulado {
    readonly id: string;
    readonly pharmacyId: string;
    readonly siteId: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly source: 'PHARMACY' | 'PLATFORM';
    readonly status: 'ACTIVE' | 'CANCELLED';
  }

  const HORA_MS = 3_600_000;

  /**
   * Sólo las farmacias **de la maqueta** reciben 24 h o turno de ejemplo: a una
   * sucursal real del corpus no se le inventa que abre de noche — mandaría a
   * alguien a una puerta cerrada. Datos sintéticos, declarados como tales.
   */
  const aperturas24h = new Coleccion<Apertura24hSimulada>(
    DE_LA_MAQUETA.slice(0, 1).map((f) => ({ id: f.siteId, open24h: true })),
  );

  const turnos = new Coleccion<TurnoSimulado>(
    DE_LA_MAQUETA.slice(1, 2).map((f) => ({
      id: uuid(`pharmacy-on-call-${f.siteId}`),
      pharmacyId: f.id,
      siteId: f.siteId,
      // Relativo a la carga del simulador: vigente al abrir la maqueta.
      startsAt: new Date(Date.now() - HORA_MS).toISOString(),
      endsAt: new Date(Date.now() + 11 * HORA_MS).toISOString(),
      source: 'PHARMACY',
      status: 'ACTIVE',
    })),
  );

  /** El instante en la hora de Bolivia, con su desplazamiento (UTC−4 todo el año). */
  function enHoraDeBolivia(instante: string): string {
    return `${new Date(new Date(instante).getTime() - 4 * HORA_MS).toISOString().slice(0, 19)}-04:00`;
  }

  /** Turno vigente (activo y dentro de su ventana) de una sede, si hay. */
  function turnoVigente(siteId: string, ahoraMs = Date.now()): TurnoSimulado | undefined {
    return turnos
      .todos()
      .filter(
        (t) =>
          t.siteId === siteId &&
          t.status === 'ACTIVE' &&
          new Date(t.startsAt).getTime() <= ahoraMs &&
          ahoraMs < new Date(t.endsAt).getTime(),
      )
      .sort((a, b) => b.endsAt.localeCompare(a.endsAt))[0];
  }

  function open24hDe(siteId: string): boolean | null {
    return aperturas24h.get(siteId)?.open24h ?? null;
  }

  /** Un turno como lo sirve la API (`OnCallShiftDto`). */
  function turnoComoApi(t: TurnoSimulado, ahoraMs = Date.now()) {
    return {
      id: t.id,
      siteId: t.siteId,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      startsAtLocal: enHoraDeBolivia(t.startsAt),
      endsAtLocal: enHoraDeBolivia(t.endsAt),
      timeZone: 'America/La_Paz',
      source: t.source,
      status: t.status,
      current:
        t.status === 'ACTIVE' &&
        new Date(t.startsAt).getTime() <= ahoraMs &&
        ahoraMs < new Date(t.endsAt).getTime(),
    };
  }

  /** El horario de una sede como lo sirve la API (`SiteOpeningHoursDto`). */
  function horarioDeSede(f: FarmaciaSimulada) {
    const ahoraMs = Date.now();
    return {
      siteId: f.siteId,
      siteName: f.siteName,
      timeZone: 'America/La_Paz',
      open24h: open24hDe(f.siteId),
      shifts: turnos
        .todos()
        .filter(
          (t) =>
            t.siteId === f.siteId &&
            t.status === 'ACTIVE' &&
            new Date(t.endsAt).getTime() > ahoraMs,
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((t) => turnoComoApi(t, ahoraMs)),
    };
  }

  return {
    open24hDe,
    turnoVigente,
    registrar(router, distanciaKm) {
      // P34 · el horario declarado de las sedes (24 h y turnos), mismo contrato
      // que `GET /pharmacies/:pharmacyId/opening-hours`.
      router.get('/pharmacies/:pharmacyId/opening-hours', ({ params }) => {
        const f = FARMACIAS.find((farmacia) => farmacia.id === params['pharmacyId']);
        if (f === undefined) return notFound('Farmacia no disponible');
        return { pharmacyId: f.id, asOf: ahora(), sites: [horarioDeSede(f)] };
      });

      router.put('/pharmacies/:pharmacyId/sites/:siteId/open-24h', (request) => {
        const f = FARMACIAS.find((farmacia) => farmacia.id === request.params['pharmacyId']);
        if (f === undefined) return notFound('Farmacia no disponible');
        if (f.siteId !== request.params['siteId']) return notFound('Referencia no disponible');
        const valor = cuerpo<{ open24h?: unknown }>(request).open24h;
        if (valor !== true && valor !== false && valor !== null) {
          return validation('open24h debe ser true, false o null', [
            { field: 'open24h', message: 'debe ser booleano o null' },
          ]);
        }
        if (aperturas24h.has(f.siteId)) aperturas24h.actualizar(f.siteId, { open24h: valor });
        else aperturas24h.agregar({ id: f.siteId, open24h: valor });
        return horarioDeSede(f);
      });

      router.post('/pharmacies/:pharmacyId/sites/:siteId/on-call-shifts', (request) => {
        const f = FARMACIAS.find((farmacia) => farmacia.id === request.params['pharmacyId']);
        if (f === undefined) return notFound('Farmacia no disponible');
        if (f.siteId !== request.params['siteId']) return notFound('Referencia no disponible');
        const { startsAt, endsAt } = cuerpo<{ startsAt?: unknown; endsAt?: unknown }>(request);
        if (
          typeof startsAt !== 'string' ||
          !CON_DESPLAZAMIENTO.test(startsAt) ||
          typeof endsAt !== 'string' ||
          !CON_DESPLAZAMIENTO.test(endsAt)
        ) {
          return validation('Las horas van en ISO-8601 con desplazamiento explícito', [
            {
              field: 'startsAt',
              message: 'debe ser ISO-8601 con desplazamiento explícito (Z o ±hh:mm)',
            },
          ]);
        }
        const inicio = new Date(startsAt).getTime();
        const fin = new Date(endsAt).getTime();
        const ahoraMs = Date.now();
        const problema =
          fin <= inicio
            ? 'El fin del turno tiene que ser posterior al inicio'
            : fin - inicio > 72 * HORA_MS
              ? 'Un turno dura como mucho 72 horas'
              : fin <= ahoraMs
                ? 'Ese turno ya terminó: un turno vencido no se publica'
                : inicio - ahoraMs > 62 * 24 * HORA_MS
                  ? 'Un turno se declara con 62 días de anticipación como mucho'
                  : null;
        if (problema !== null)
          return preconditionFailed(problema, { reason: 'ON_CALL_SHIFT_WINDOW_INVALID' });
        const solapado = turnos
          .todos()
          .some(
            (t) =>
              t.siteId === f.siteId &&
              t.status === 'ACTIVE' &&
              new Date(t.startsAt).getTime() < fin &&
              inicio < new Date(t.endsAt).getTime(),
          );
        if (solapado)
          return conflict('La sede ya tiene un turno activo en ese horario', {
            reason: 'ON_CALL_SHIFT_OVERLAP',
          });
        const nuevo = turnos.agregar({
          id: nuevoId('pharmacy-on-call'),
          pharmacyId: f.id,
          siteId: f.siteId,
          startsAt: new Date(inicio).toISOString(),
          endsAt: new Date(fin).toISOString(),
          source: 'PHARMACY',
          status: 'ACTIVE',
        });
        return { status: 201, body: turnoComoApi(nuevo, ahoraMs) };
      });

      router.post('/pharmacies/:pharmacyId/on-call-shifts/:shiftId/cancel', ({ params }) => {
        const t = turnos.get(params['shiftId']!);
        if (t === undefined || t.pharmacyId !== params['pharmacyId'])
          return notFound('Referencia no disponible');
        if (t.status !== 'ACTIVE' || new Date(t.endsAt).getTime() <= Date.now()) {
          return preconditionFailed('El turno ya terminó o ya estaba cancelado', {
            reason: 'ON_CALL_SHIFT_NOT_CANCELLABLE',
          });
        }
        return turnoComoApi(turnos.actualizar(t.id, { status: 'CANCELLED' })!);
      });

      // P34 · lectura pública: abiertas ahora (24 h o de turno vigente), mismo
      // contrato que `GET /public/pharmacies/open-now` (página con cursor).
      router.get('/public/pharmacies/open-now', ({ query }) => {
        const mode = query.get('mode') ?? 'any';
        if (!['any', '24h', 'on-call'].includes(mode)) {
          return validation('mode debe ser uno de: any, 24h, on-call');
        }
        const ciudad = query.get('city')?.trim().toLocaleLowerCase('es') ?? '';
        const latTexto = query.get('lat');
        const lngTexto = query.get('lng');
        if ((latTexto === null) !== (lngTexto === null)) {
          return validation(
            'lat y lng van juntos: mande ambos para ordenar por distancia, o ninguno',
          );
        }
        const origen =
          latTexto === null || lngTexto === null
            ? null
            : { lat: Number(latTexto), lng: Number(lngTexto) };
        const limit = Math.min(Math.max(Number(query.get('limit') ?? 20) || 20, 1), 50);
        const desde = Number(query.get('cursor') ?? 0) || 0;
        const ahoraMs = Date.now();
        const todas = FARMACIAS.map((f) => ({
          f,
          abierta24h: open24hDe(f.siteId) === true,
          turno: turnoVigente(f.siteId, ahoraMs),
        }))
          .filter(
            ({ abierta24h, turno }) =>
              (mode !== 'on-call' && abierta24h) || (mode !== '24h' && turno !== undefined),
          )
          .filter(
            ({ f }) => ciudad === '' || f.addressText.toLocaleLowerCase('es').includes(ciudad),
          )
          .map(({ f, abierta24h, turno }) => ({
            siteId: f.siteId,
            siteName: f.siteName,
            pharmacyName: f.name,
            pharmacySlug: f.slug,
            addressText: f.addressText,
            city: null,
            latitude: f.lat,
            longitude: f.lng,
            distanceKm: origen === null ? null : distanciaKm(origen.lat, origen.lng, f.lat, f.lng),
            open24h: abierta24h,
            onCall:
              turno === undefined
                ? null
                : {
                    startsAt: turno.startsAt,
                    endsAt: turno.endsAt,
                    endsAtLocal: enHoraDeBolivia(turno.endsAt),
                    source: turno.source,
                  },
            timeZone: 'America/La_Paz',
          }))
          .sort(
            (a, b) =>
              (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
              a.pharmacyName.localeCompare(b.pharmacyName, 'es') ||
              a.siteName.localeCompare(b.siteName, 'es'),
          );
        const items = todas.slice(desde, desde + limit);
        const asOf = new Date(ahoraMs).toISOString();
        return {
          items,
          nextCursor: desde + limit < todas.length ? String(desde + limit) : null,
          asOf,
          asOfLocal: enHoraDeBolivia(asOf),
          timeZone: 'America/La_Paz',
        };
      });
    },
  };
}
