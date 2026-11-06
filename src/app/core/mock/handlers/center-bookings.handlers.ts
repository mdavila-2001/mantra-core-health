import type { CenterBooking } from '../../data-access/diagnostic-units/center-schedule.types';
import { asignarALineas } from '../../data-access/diagnostic-units/equipment-lines.rules';
import type { ModalityCode } from '../../data-access/diagnostic-units/modalidades';
import { ESTUDIO, displayOf } from '../fixtures/concepts';
import { turnosDeOrdenes } from '../fixtures/centros';
import { patientById } from '../fixtures/people';
import { notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
import { equiposDe } from './center-equipment.handlers';
import { horarioDe } from './centros.handlers';
import { destinoDeOrden } from './lab-portal.handlers';
import { labInboxOrders, sitioDe, UNIDADES, type UnidadSimulada } from './diagnostics.handlers';

/* ============================================================================
    `GET /diagnostic-units/me/bookings?from&to` — the bookings of the active
    center between two instants (04/11/2026). The real API publishes it; this is
    the simulator mirror for `development,demo`.

    Two sources: the slots patients booked from their order
    (`turnosDeOrdenes`) and, so that the demo home is never blank, a few
    walk-in slots for today derived from the center's still-open inbox orders.
    ========================================================================== */

/** How many demo walk-ins are derived for today. */
const DEMO_WALK_INS = 4;
const DEMO_FIRST_SLOT_MINUTES = 7 * 60 + 30;
const DEMO_SLOT_MINUTES = 45;

/** The center behind the session, resolved like `/diagnostic-units/me/schedule`. */
function centerOf(request: MockRequest): UnidadSimulada | undefined {
  const tenants = request.user?.tenants ?? [];
  return UNIDADES.find((u) => u.publiclyListed && tenants.includes(u.tenantId));
}

/** Status of a slot relative to now: past slots are done, the current one checked in. */
function statusAt(startsAt: Date, endsAt: Date, now: Date): string {
  if (endsAt <= now) return 'BOOKING_COMPLETED';
  if (startsAt <= now) return 'BOOKING_CHECKED_IN';
  return 'BOOKING_CONFIRMED';
}

function bookedFromOrders(u: UnidadSimulada, now: Date): CenterBooking[] {
  const studyByCode = new Map(Object.entries(ESTUDIO).map(([code, id]) => [code, displayOf(id)]));
  return turnosDeOrdenes
    .filtrar((t) => t.unitId === u.id)
    .map((t) => ({
      bookingId: t.bookingId,
      orderId: t.id,
      patientName: patientById(t.patientProfileId)?.displayName ?? 'Paciente',
      studyName: studyByCode.get(t.studyCode) ?? t.studyCode,
      startsAt: t.startAt,
      endsAt: t.endAt,
      siteName: sitioDe(u).name,
      status: statusAt(new Date(t.startAt), new Date(t.endAt), now),
    }));
}

function demoWalkIns(u: UnidadSimulada, now: Date): CenterBooking[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return labInboxOrders
    .filtrar((o) => o.performerTenantId === u.tenantId)
    .slice(0, DEMO_WALK_INS)
    .flatMap((order, i) => {
      const target = destinoDeOrden(order.id);
      if (target === undefined) return [];
      const startsAt = new Date(midnight.getTime() + (DEMO_FIRST_SLOT_MINUTES + i * DEMO_SLOT_MINUTES) * 60_000);
      const endsAt = new Date(startsAt.getTime() + DEMO_SLOT_MINUTES * 60_000);
      return [
        {
          bookingId: `demo-walk-in-${order.id}`,
          orderId: order.id,
          patientName: target.patientName,
          studyName: target.studyName,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          siteName: sitioDe(u).name,
          status: statusAt(startsAt, endsAt, now),
        },
      ];
    });
}

export function registerCenterBookings(router: MockRouter): void {
  router.get('/diagnostic-units/me/bookings', (request) => {
    const from = Date.parse(request.query.get('from') ?? '');
    const to = Date.parse(request.query.get('to') ?? '');
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
      return validation('`from` y `to` tienen que ser instantes ISO, con `to` después de `from`.');
    }
    const u = centerOf(request);
    if (u === undefined) return notFound('Su organización no tiene un centro de diagnóstico con agenda.');
    const now = new Date();
    const listed = [...bookedFromOrders(u, now), ...demoWalkIns(u, now)]
      .filter((b) => {
        const at = Date.parse(b.startsAt);
        return at >= from && at < to;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    // Like the API: each booking says which line (device) attends it.
    const modalityOf = (b: CenterBooking): ModalityCode | null =>
      turnosDeOrdenes.get(b.orderId ?? '')?.modalityCode ?? (u.kind === 'LABORATORY' ? 'LAB' : null);
    const lines = asignarALineas(
      horarioDe(u),
      equiposDe(u),
      listed.map((b) => ({ id: b.bookingId, inicio: new Date(b.startsAt), fin: new Date(b.endsAt), modalityCode: modalityOf(b) })),
    );
    const items = listed.map((b) => ({ ...b, equipmentId: lines.get(b.bookingId) ?? null }));
    return { items, count: items.length };
  });
}
