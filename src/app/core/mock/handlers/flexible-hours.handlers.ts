import { STATUS } from '../fixtures/concepts';
import { cupos, plantillas, recursos, type PlantillaSimulada } from '../fixtures/agenda';
import { fits, proposeStarts, type Bracket, type ServiceDuration } from '../service-availability';
import { conflict, notFound, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId, texto } from '../mock-store';
import {
  ocupadoDelProfesional,
  preconditionFailed422,
  purgarRetencionesVencidas,
  sedesDe,
} from './service-offerings.handlers';

/* ============================================================================
    Horario flexible, sin turnos fijos (P36) — el espejo, en la maqueta, de
    `GET /scheduling/resources/:id/flexible-availability` y
    `POST /scheduling/resources/:id/flexible-holds`.

    El médico declara cuándo atiende sin cortarlo en turnos. Las horas se
    CALCULAN al leer —cada 15 min dentro de la franja, menos lo ocupado— y el
    cupo nace al retener, con el tiempo por paciente de la plantilla. Mismo
    contrato que la API: si cambia allá, cambia acá.
    ========================================================================== */

const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 24 * 60 * MS_POR_MINUTO;
const PASO_MINUTOS = 15;
const RETENCION_MINUTOS = 5;
const MAX_DIAS_DE_CONSULTA = 62;

function ymd(d: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Un turno flexible es, para el motor, un servicio de duración fija y sin colchones. */
function duracion(t: PlantillaSimulada): ServiceDuration {
  return { min: t.slotMinutes, max: t.slotMinutes, preparacion: 0, limpieza: 0 };
}

/** Las plantillas flexibles publicadas de la agenda, con sus franjas de consultas. */
function ofertasFlexibles(
  resourceId: string,
  desde: number,
  hasta: number,
): { readonly plantilla: PlantillaSimulada; readonly franjas: Bracket[] }[] {
  return plantillas
    .filtrar(
      (t) =>
        t.resourceId === resourceId &&
        t.flexibleHours === true &&
        !t.retired &&
        t.statusConceptId === STATUS['ST-PUBLISHED'],
    )
    .map((plantilla) => {
      const franjas: Bracket[] = [];
      for (let d = new Date(desde - MS_POR_DIA); d.getTime() <= hasta + MS_POR_DIA; d.setDate(d.getDate() + 1)) {
        const dia = ymd(d);
        if (dia < plantilla.validFrom || (plantilla.validTo !== undefined && dia > plantilla.validTo)) continue;
        for (const regla of plantilla.rules.filter((r) => r.dayOfWeek === d.getDay() && r.bookingMode !== 'SERVICES')) {
          const [hi, mi] = regla.startTime.split(':').map(Number) as [number, number];
          const [hf, mf] = regla.endTime.split(':').map(Number) as [number, number];
          const inicio = Math.max(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hi, mi).getTime(), desde);
          const fin = Math.min(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hf, mf).getTime(), hasta);
          if (fin > inicio) franjas.push({ desde: inicio, hasta: fin });
        }
      }
      return { plantilla, franjas };
    });
}

export function registrarHorarioFlexible(router: MockRouter): void {
  router.get('/scheduling/resources/:id/flexible-availability', (request) => {
    const sede = recursos.get(request.params['id']!);
    if (sede === undefined) return notFound('Agenda no encontrada');
    const ahoraMs = Date.now();
    const desde = Math.max(new Date(texto(request.query, 'from') ?? ahora()).getTime(), ahoraMs);
    const hasta = new Date(texto(request.query, 'to') ?? ahora()).getTime();
    if (!(hasta > desde)) return preconditionFailed422('La ventana debe empezar antes de terminar.');
    if (hasta - desde > MAX_DIAS_DE_CONSULTA * MS_POR_DIA) {
      return preconditionFailed422(`Se pueden mirar hasta ${MAX_DIAS_DE_CONSULTA} días de una vez.`);
    }

    const todas = sedesDe(sede.resourceRefId);
    purgarRetencionesVencidas(todas);
    const ocupado = ocupadoDelProfesional(todas, desde, hasta);
    const porInicio = new Map<number, { templateId: string; startAt: string; endAt: string }>();
    for (const { plantilla, franjas } of ofertasFlexibles(sede.id, desde, hasta)) {
      const horas = proposeStarts({
        franjas,
        ocupado,
        duracion: duracion(plantilla),
        noAntesDe: ahoraMs,
        noDespuesDe: hasta,
        pasoMinutos: PASO_MINUTOS,
      });
      for (const h of horas) {
        if (porInicio.has(h.inicio)) continue;
        porInicio.set(h.inicio, {
          templateId: plantilla.id,
          startAt: new Date(h.inicio).toISOString(),
          endAt: new Date(h.finMaximo).toISOString(),
        });
      }
    }
    const items = [...porInicio.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { resourceId: sede.id, stepMinutes: PASO_MINUTOS, items };
  });

  router.post('/scheduling/resources/:id/flexible-holds', (request) => {
    const sede = recursos.get(request.params['id']!);
    if (sede === undefined) return notFound('Agenda no encontrada');
    const datos = cuerpo<{ startAt: string }>(request);
    const inicio = new Date(datos.startAt ?? '').getTime();
    if (!Number.isFinite(inicio) || inicio % MS_POR_MINUTO !== 0) {
      return preconditionFailed422('La hora pedida tiene que caer en un minuto entero.');
    }
    if (inicio <= Date.now()) return preconditionFailed422('Ese horario ya pasó.');

    const enFranja = ofertasFlexibles(sede.id, inicio - MS_POR_DIA, inicio + 2 * MS_POR_DIA).filter((o) =>
      fits(o.franjas, [], duracion(o.plantilla), inicio),
    );
    if (enFranja.length === 0) {
      return preconditionFailed422('Esa hora no está dentro del horario que atiende este profesional.');
    }
    const todas = sedesDe(sede.resourceRefId);
    purgarRetencionesVencidas(todas);
    const ocupado = ocupadoDelProfesional(todas, inicio - MS_POR_DIA, inicio + 2 * MS_POR_DIA);
    const oferta = enFranja.find((o) => fits(o.franjas, ocupado, duracion(o.plantilla), inicio));
    if (oferta === undefined) {
      return conflict('Esa hora ya no está disponible. Elija otra.', {
        resourceId: sede.id,
        startAt: new Date(inicio).toISOString(),
      });
    }

    const cupo = cupos.agregar({
      id: nuevoId('slot'),
      resourceId: sede.id,
      scheduleTemplateId: oferta.plantilla.id,
      startAt: new Date(inicio).toISOString(),
      endAt: new Date(inicio + oferta.plantilla.slotMinutes * MS_POR_MINUTO).toISOString(),
      capacity: 1,
      remainingCapacity: 0,
      statusConceptId: STATUS['ST-ACTIVE']!,
      serviceConceptId: null,
      heldUntil: new Date(Date.now() + RETENCION_MINUTOS * MS_POR_MINUTO).toISOString(),
    });
    return {
      status: 201,
      body: {
        id: nuevoId('hold'),
        // El mismo formato que los holds de consulta: `confirmar()` lo resuelve a su cupo.
        holdToken: `hold.${cupo.id}`,
        expiresAt: cupo.heldUntil,
        bookableSlotId: cupo.id,
        startAt: cupo.startAt,
        endAt: cupo.endAt,
      },
    };
  });
}
