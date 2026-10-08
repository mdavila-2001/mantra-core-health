import { ESTADO, ESTADO_RESERVA } from '../fixtures/conceptos';
import { bloqueos, cupos, plantillas, recursos, reservas, type CupoSimulado, type RecursoSimulado, type ReservaSimulada } from '../fixtures/agenda';
import { ofertas, type OfertaSimulada } from '../fixtures/servicios-ofrecidos';
import { cabe, proponerInicios, sePuedenReabrir, tramoOcupado, type DuracionDeServicio, type Tramo } from '../disponibilidad-de-servicios';
import { conflict, forbidden, notFound, reply, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId, texto } from '../mock-store';
import { servicios } from './practice.handlers';

/* ============================================================================
    Servicios con duración dinámica (v4.2.40) — el espejo, en la maqueta, de
    `GET/POST/PATCH /scheduling/service-offerings`, `GET …/service-availability`
    y `POST …/service-offerings/:id/holds`.

    Las consultas salen de una grilla pre-generada; un servicio no: los horarios se
    CALCULAN al leer y el cupo nace al retener, con la duración MÁXIMA. Si el
    contrato de la API cambia, esto cambia con él (ver `disponibilidad-de-servicios`).
    ========================================================================== */

const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 24 * 60 * MS_POR_MINUTO;

/** Cuánto vale una retención si nadie la confirma, como en la API (300 s). */
const RETENCION_MINUTOS = 5;

/** Cuántos días se pueden mirar de una vez, como en la API. */
const MAX_DIAS_DE_CONSULTA = 62;

/** El techo de los colchones, para mirar compromisos vecinos (como en la API). */
const MARGEN_DE_COLCHONES_MS = 240 * MS_POR_MINUTO;

/** Estados de una reserva que comprometen el tiempo del profesional. */
const COMPROMETEN = ['BK-CONFIRMED', 'BK-CHECKED-IN', 'BK-IN-PROGRESS'] as const;

const ROLES_QUE_ADMINISTRAN = ['SCHEDULING_ADMIN', 'SUPERADMIN'];

function estaEn(r: ReservaSimulada, estados: readonly (keyof typeof ESTADO_RESERVA)[]): boolean {
  return estados.some((e) => ESTADO_RESERVA[e] === r.statusConceptId);
}

function administra(request: MockRequest): boolean {
  return request.user?.roles.some((r) => ROLES_QUE_ADMINISTRAN.includes(r)) ?? false;
}

/** Un 422 de regla de negocio, con la forma del `PreconditionFailedException` de la API. */
function preconditionFailed422(message: string, details: unknown = {}) {
  return reply(422, { statusCode: 422, code: 'PRECONDITION_FAILED', message, error: 'Unprocessable Entity', details });
}

/** La oferta con lo que el catálogo dice del servicio, como la sirve la API. */
function aDto(o: OfertaSimulada) {
  const s = servicios.get(o.serviceCatalogId);
  return {
    id: o.id,
    practitionerProfileId: o.practitionerProfileId,
    serviceCatalogId: o.serviceCatalogId,
    serviceCode: s?.code ?? '',
    serviceName: s?.name ?? '',
    price: s?.defaultPrice ?? '0.00',
    ...(s?.currencyConceptId === undefined ? {} : { currencyConceptId: s.currencyConceptId }),
    minDurationMinutes: o.minDurationMinutes,
    maxDurationMinutes: o.maxDurationMinutes,
    prepMinutes: o.prepMinutes,
    cleanupMinutes: o.cleanupMinutes,
    isPatientBookable: o.isPatientBookable,
    requiresApproval: o.requiresApproval,
    ...(o.channel === undefined ? {} : { channel: o.channel }),
    isActive: o.isActive && (s?.isActive ?? true),
  };
}

function duracionDe(o: OfertaSimulada): DuracionDeServicio {
  return { min: o.minDurationMinutes, max: o.maxDurationMinutes, preparacion: o.prepMinutes, limpieza: o.cleanupMinutes };
}

/** Los recursos (sedes) de un profesional. */
function sedesDe(practitionerProfileId: string): readonly RecursoSimulado[] {
  return recursos.filtrar((r) => r.resourceRefId === practitionerProfileId);
}

/** `YYYY-MM-DD` local de un día. */
function ymd(d: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Las franjas que admiten servicios en el rango, por sede.
 *
 * Una franja admite servicios si su modo es `SERVICES` o `MIXED`. Sin modo (la
 * franja de siempre) es sólo consultas: así se comportaba antes de este cambio.
 */
function franjasDeServicios(sedes: readonly RecursoSimulado[], desde: number, hasta: number): { readonly resourceId: string; readonly franjas: Tramo[] }[] {
  return sedes.map((sede) => {
    const franjas: Tramo[] = [];
    const plantillasDeLaSede = plantillas.filtrar((t) => t.resourceId === sede.id && !t.retired && t.statusConceptId === ESTADO['ST-PUBLISHED']);
    // Un día de margen por lado: un día local puede arrancar antes de `desde`.
    for (let d = new Date(desde - MS_POR_DIA); d.getTime() <= hasta + MS_POR_DIA; d.setDate(d.getDate() + 1)) {
      const dia = ymd(d);
      for (const t of plantillasDeLaSede) {
        if (dia < t.validFrom || (t.validTo !== undefined && dia > t.validTo)) continue;
        for (const regla of t.rules.filter((r) => r.dayOfWeek === d.getDay() && (r.bookingMode === 'SERVICES' || r.bookingMode === 'MIXED'))) {
          const [hi, mi] = regla.startTime.split(':').map(Number) as [number, number];
          const [hf, mf] = regla.endTime.split(':').map(Number) as [number, number];
          const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hi, mi).getTime();
          const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hf, mf).getTime();
          const desdeRecortado = Math.max(inicio, desde);
          const hastaRecortado = Math.min(fin, hasta);
          if (hastaRecortado > desdeRecortado) franjas.push({ desde: desdeRecortado, hasta: hastaRecortado });
        }
      }
    }
    return { resourceId: sede.id, franjas };
  });
}

/** Un cupo de servicio que nadie confirmó y cuya retención ya venció. */
function retencionVencida(c: CupoSimulado): boolean {
  if (c.serviceOfferingId === undefined || c.serviceOfferingId === null) return false;
  if (c.heldUntil === undefined || c.heldUntil === null) return false;
  const tieneReserva = reservas.todos().some((r) => r.bookableSlotId === c.id);
  return !tieneReserva && new Date(c.heldUntil).getTime() <= Date.now();
}

/** Borra las retenciones vencidas y devuelve las consultas que habían retraído. */
function purgarRetencionesVencidas(sedes: readonly RecursoSimulado[]): void {
  const ids = new Set(sedes.map((s) => s.id));
  const vencidas = cupos.filtrar((c) => ids.has(c.resourceId) && retencionVencida(c));
  if (vencidas.length === 0) return;
  for (const c of vencidas) cupos.borrar(c.id);
  reabrirConsultas(sedes);
}

/**
 * Todo lo que ocupa el tiempo del profesional en un rango, en todas sus sedes:
 * consultas confirmadas, bloqueos, y los turnos de servicio vivos con sus colchones.
 */
function ocupadoDelProfesional(sedes: readonly RecursoSimulado[], desde: number, hasta: number): Tramo[] {
  const ids = new Set(sedes.map((s) => s.id));
  const desdeAncho = desde - MARGEN_DE_COLCHONES_MS;
  const hastaAncho = hasta + MARGEN_DE_COLCHONES_MS;
  const enRango = (inicio: number, fin: number): boolean => inicio < hastaAncho && fin > desdeAncho;
  const ocupado: Tramo[] = [];

  for (const r of reservas.todos()) {
    if (!ids.has(r.resourceId) || !estaEn(r, COMPROMETEN)) continue;
    const inicio = new Date(r.startAt).getTime();
    const fin = new Date(r.endAt).getTime();
    if (enRango(inicio, fin)) ocupado.push({ desde: inicio, hasta: fin });
  }
  for (const b of bloqueos.todos()) {
    if (!ids.has(b.resourceId) || b.isAvailable) continue;
    const inicio = new Date(b.startAt).getTime();
    const fin = new Date(b.endAt).getTime();
    if (enRango(inicio, fin)) ocupado.push({ desde: inicio, hasta: fin });
  }
  for (const c of cupos.todos()) {
    if (!ids.has(c.resourceId) || c.serviceOfferingId === undefined || c.serviceOfferingId === null) continue;
    if (c.remainingCapacity > 0 || retencionVencida(c)) continue;
    const inicio = new Date(c.startAt).getTime();
    const fin = new Date(c.endAt).getTime();
    if (!enRango(inicio, fin)) continue;
    const oferta = ofertas.get(c.serviceOfferingId);
    ocupado.push(tramoOcupado(inicio, fin, { preparacion: oferta?.prepMinutes ?? 0, limpieza: oferta?.cleanupMinutes ?? 0 }));
  }
  return ocupado;
}

/** Retira de la oferta los cupos de consulta intactos que el rango pisa. */
function retraerConsultas(sedes: readonly RecursoSimulado[], tramo: Tramo): number {
  const ids = new Set(sedes.map((s) => s.id));
  const pisados = cupos.filtrar(
    (c) =>
      ids.has(c.resourceId) &&
      (c.serviceOfferingId === undefined || c.serviceOfferingId === null) &&
      c.statusConceptId === ESTADO['ST-ACTIVE'] &&
      c.remainingCapacity === c.capacity &&
      new Date(c.startAt).getTime() < tramo.hasta &&
      new Date(c.endAt).getTime() > tramo.desde,
  );
  // Retraído y no bloqueado: al bloqueado nadie lo devuelve, y al retraído sí.
  for (const c of pisados) cupos.actualizar(c.id, { statusConceptId: ESTADO['ST-INACTIVE']!, retractedByService: true });
  return pisados.length;
}

/** Vuelve a ofrecer las consultas retraídas que ya no chocan con ningún servicio. */
function reabrirConsultas(sedes: readonly RecursoSimulado[]): void {
  const ids = new Set(sedes.map((s) => s.id));
  const retraidos = cupos.filtrar((c) => ids.has(c.resourceId) && c.retractedByService === true);
  if (retraidos.length === 0) return;
  const desde = Math.min(...retraidos.map((c) => new Date(c.startAt).getTime()));
  const hasta = Math.max(...retraidos.map((c) => new Date(c.endAt).getTime()));
  const ocupado = ocupadoDelProfesional(sedes, desde, hasta);
  const reabribles = new Set(sePuedenReabrir(retraidos.map((c) => ({ id: c.id, desde: new Date(c.startAt).getTime(), hasta: new Date(c.endAt).getTime() })), ocupado));
  for (const c of retraidos) {
    if (reabribles.has(c.id)) cupos.actualizar(c.id, { statusConceptId: ESTADO['ST-ACTIVE']!, retractedByService: false });
  }
}

/**
 * El cupo de una reserva de servicio deja de ocupar tiempo (cancelada o rechazada).
 *
 * Nació para esa reserva y nunca estuvo ofrecido: **se borra**, no se reabre. Lo
 * que sí vuelve son las consultas que había retraído. Devuelve si era de servicio.
 */
export function liberarCupoDeServicio(slotId: string): boolean {
  const cupo = cupos.get(slotId);
  if (cupo === undefined || cupo.serviceOfferingId === undefined || cupo.serviceOfferingId === null) return false;
  const sedes = recursos.filtrar((r) => r.id === cupo.resourceId);
  const profesional = sedes[0]?.resourceRefId;
  cupos.borrar(cupo.id);
  if (profesional !== undefined) reabrirConsultas(sedesDe(profesional));
  return true;
}

/**
 * Terminar antes de lo reservado libera el sobrante.
 *
 * Un servicio se reserva por su duración máxima; si el profesional lo da por
 * cumplido antes, el cupo se recorta a ese instante y el resto vuelve a estar libre.
 */
export function liberarSobranteDeServicio(reserva: ReservaSimulada): void {
  if (reserva.serviceOfferingId === undefined || reserva.serviceOfferingId === null) return;
  const cupo = cupos.get(reserva.bookableSlotId);
  if (cupo === undefined) return;
  const ahoraMs = Date.now();
  if (ahoraMs <= new Date(cupo.startAt).getTime() || ahoraMs >= new Date(cupo.endAt).getTime()) return;
  const fin = new Date(ahoraMs).toISOString();
  cupos.actualizar(cupo.id, { endAt: fin });
  reservas.actualizar(reserva.id, { endAt: fin });
  const sede = recursos.get(cupo.resourceId);
  if (sede !== undefined) reabrirConsultas(sedesDe(sede.resourceRefId));
}

/** La oferta, si quien pide puede verla. Un paciente sólo ve lo activo y reservable. */
function ofertaVisible(request: MockRequest, id: string): OfertaSimulada | undefined {
  const oferta = ofertas.get(id);
  if (oferta === undefined) return undefined;
  if (administra(request) || request.user?.practitionerProfileId === oferta.practitionerProfileId) return oferta;
  const servicio = servicios.get(oferta.serviceCatalogId);
  if (!oferta.isActive || !oferta.isPatientBookable || servicio?.isActive === false) return undefined;
  return oferta;
}

function validarDuraciones(min: number, max: number) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < 1 || min > 720 || max > 720) {
    return preconditionFailed422('Las duraciones tienen que ser minutos enteros entre 1 y 720.');
  }
  if (min > max) return preconditionFailed422('La duración mínima no puede ser mayor que la máxima.', { minDurationMinutes: min, maxDurationMinutes: max });
  return null;
}

export function registrarServiciosDeAgenda(router: MockRouter): void {
  router.get('/scheduling/service-offerings', (request) => {
    const pedido = texto(request.query, 'practitionerProfileId') ?? request.user?.practitionerProfileId;
    if (pedido === undefined || pedido === null) return preconditionFailed422('Indique de qué profesional quiere ver los servicios.');
    const veTodo = administra(request) || request.user?.practitionerProfileId === pedido;
    const items = ofertas
      .filtrar((o) => o.practitionerProfileId === pedido)
      .filter((o) => veTodo || (o.isActive && o.isPatientBookable))
      .map(aDto)
      .filter((o) => veTodo || o.isActive);
    return { items };
  });

  router.post('/scheduling/service-offerings', (request) => {
    const datos = cuerpo<{
      serviceCatalogId: string;
      minDurationMinutes: number;
      maxDurationMinutes: number;
      prepMinutes: number;
      cleanupMinutes: number;
      isPatientBookable: boolean;
      requiresApproval: boolean;
      channel: OfertaSimulada['channel'];
      practitionerProfileId: string;
    }>(request);
    // Sin pedido explícito la oferta es de quien atiende: hay quien atiende Y administra
    // agendas (el consultorio propio), y exigirle su propio id es pedirle lo que ya se sabe.
    const propio = request.user?.practitionerProfileId;
    if (datos.practitionerProfileId !== undefined && datos.practitionerProfileId !== propio && !administra(request)) {
      return forbidden('Sólo puede crear ofertas para usted.');
    }
    const dueno = datos.practitionerProfileId ?? propio;
    if (dueno === undefined) {
      return administra(request) ? preconditionFailed422('Indique de qué profesional es la oferta.') : forbidden('Sólo un profesional ofrece servicios.');
    }

    const servicio = servicios.get(datos.serviceCatalogId ?? '');
    if (servicio === undefined) return notFound('Servicio no encontrado');
    const invalida = validarDuraciones(datos.minDurationMinutes ?? 0, datos.maxDurationMinutes ?? 0);
    if (invalida !== null) return invalida;
    if (!servicio.isActive) return preconditionFailed422('Ese servicio está inactivo en el catálogo.');
    const existente = ofertas.todos().find((o) => o.practitionerProfileId === dueno && o.serviceCatalogId === servicio.id);
    if (existente !== undefined) return conflict('Ya ofrece ese servicio. Edite la oferta que ya tiene.', { offeringId: existente.id });

    const nueva = ofertas.agregar({
      id: nuevoId('offering'),
      practitionerProfileId: dueno,
      serviceCatalogId: servicio.id,
      minDurationMinutes: datos.minDurationMinutes!,
      maxDurationMinutes: datos.maxDurationMinutes!,
      prepMinutes: datos.prepMinutes ?? 0,
      cleanupMinutes: datos.cleanupMinutes ?? 0,
      isPatientBookable: datos.isPatientBookable ?? true,
      requiresApproval: datos.requiresApproval ?? false,
      ...(datos.channel === undefined ? {} : { channel: datos.channel }),
      isActive: true,
    });
    return { status: 201, body: aDto(nueva) };
  });

  router.patch('/scheduling/service-offerings/:id', (request) => {
    const oferta = ofertas.get(request.params['id']!);
    // 404 y no 403: una oferta ajena no se distingue de una inexistente.
    if (oferta === undefined || (!administra(request) && request.user?.practitionerProfileId !== oferta.practitionerProfileId)) {
      return notFound('Oferta no encontrada');
    }
    const c = cuerpo<Omit<OfertaSimulada, 'id' | 'practitionerProfileId' | 'serviceCatalogId'>>(request);
    const min = c.minDurationMinutes ?? oferta.minDurationMinutes;
    const max = c.maxDurationMinutes ?? oferta.maxDurationMinutes;
    const invalida = validarDuraciones(min, max);
    if (invalida !== null) return invalida;
    const cambios: Partial<OfertaSimulada> = {
      minDurationMinutes: min,
      maxDurationMinutes: max,
      ...(c.prepMinutes === undefined ? {} : { prepMinutes: c.prepMinutes }),
      ...(c.cleanupMinutes === undefined ? {} : { cleanupMinutes: c.cleanupMinutes }),
      ...(c.isPatientBookable === undefined ? {} : { isPatientBookable: c.isPatientBookable }),
      ...(c.requiresApproval === undefined ? {} : { requiresApproval: c.requiresApproval }),
      ...(c.channel === undefined ? {} : { channel: c.channel }),
      ...(c.isActive === undefined ? {} : { isActive: c.isActive }),
    };
    return aDto(ofertas.actualizar(oferta.id, cambios)!);
  });

  router.get('/scheduling/service-availability', (request) => {
    const oferta = ofertaVisible(request, texto(request.query, 'offeringId') ?? '');
    if (oferta === undefined) return notFound('Servicio no encontrado');
    const ahoraMs = Date.now();
    const desde = Math.max(new Date(texto(request.query, 'from') ?? ahora()).getTime(), ahoraMs);
    const hasta = new Date(texto(request.query, 'to') ?? ahora()).getTime();
    if (!(hasta > desde)) return preconditionFailed422('La ventana debe empezar antes de terminar.');
    if (hasta - desde > MAX_DIAS_DE_CONSULTA * MS_POR_DIA) return preconditionFailed422(`Se pueden mirar hasta ${MAX_DIAS_DE_CONSULTA} días de una vez.`);

    const pedida = texto(request.query, 'resourceId');
    const sedes = sedesDe(oferta.practitionerProfileId).filter((s) => pedida === null || s.id === pedida);
    purgarRetencionesVencidas(sedesDe(oferta.practitionerProfileId));
    const ocupado = ocupadoDelProfesional(sedesDe(oferta.practitionerProfileId), desde, hasta);

    const items = franjasDeServicios(sedes, desde, hasta).flatMap(({ resourceId, franjas }) =>
      proponerInicios({ franjas, ocupado, duracion: duracionDe(oferta), noAntesDe: ahoraMs, noDespuesDe: hasta }).map((h) => ({
        resourceId,
        startAt: new Date(h.inicio).toISOString(),
        endAtMax: new Date(h.finMaximo).toISOString(),
        endAtMin: new Date(h.finMinimo).toISOString(),
      })),
    );
    items.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { offeringId: oferta.id, minDurationMinutes: oferta.minDurationMinutes, maxDurationMinutes: oferta.maxDurationMinutes, items };
  });

  router.post('/scheduling/service-offerings/:id/holds', (request) => {
    const oferta = ofertaVisible(request, request.params['id']!);
    if (oferta === undefined) return notFound('Servicio no encontrado');
    const datos = cuerpo<{ resourceId: string; startAt: string }>(request);
    const sede = recursos.get(datos.resourceId ?? '');
    if (sede === undefined || sede.resourceRefId !== oferta.practitionerProfileId) return notFound('Agenda no encontrada');

    const inicio = new Date(datos.startAt ?? '').getTime();
    if (!Number.isFinite(inicio) || inicio <= Date.now()) return preconditionFailed422('Ese horario ya pasó.');
    const duracion = duracionDe(oferta);
    const fin = inicio + oferta.maxDurationMinutes * MS_POR_MINUTO;

    const todasLasSedes = sedesDe(oferta.practitionerProfileId);
    purgarRetencionesVencidas(todasLasSedes);
    const ocupado = ocupadoDelProfesional(todasLasSedes, inicio, fin);
    const franjas = franjasDeServicios([sede], inicio - MS_POR_DIA, fin + MS_POR_DIA).flatMap((g) => g.franjas);
    if (!cabe(franjas, ocupado, duracion, inicio)) {
      return conflict('Ese horario ya no está disponible para este servicio. Elija otro.', { offeringId: oferta.id, startAt: new Date(inicio).toISOString() });
    }

    const retractedSlots = retraerConsultas(todasLasSedes, tramoOcupado(inicio, fin, duracion));
    const servicio = servicios.get(oferta.serviceCatalogId);
    const cupo = cupos.agregar({
      id: nuevoId('slot'),
      resourceId: sede.id,
      scheduleTemplateId: null,
      startAt: new Date(inicio).toISOString(),
      endAt: new Date(fin).toISOString(),
      capacity: 1,
      remainingCapacity: 0,
      statusConceptId: ESTADO['ST-ACTIVE']!,
      serviceConceptId: servicio?.serviceConceptId ?? null,
      serviceOfferingId: oferta.id,
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
        retractedSlots,
      },
    };
  });
}

/** Lo que `confirmar()` necesita saber de la oferta de un cupo. */
export function ofertaDelCupo(cupo: CupoSimulado): { readonly oferta: OfertaSimulada; readonly dto: ReturnType<typeof aDto> } | undefined {
  if (cupo.serviceOfferingId === undefined || cupo.serviceOfferingId === null) return undefined;
  const oferta = ofertas.get(cupo.serviceOfferingId);
  return oferta === undefined ? undefined : { oferta, dto: aDto(oferta) };
}
