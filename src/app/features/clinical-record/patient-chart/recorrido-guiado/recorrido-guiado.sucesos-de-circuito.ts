/* ============================================================================
    The circuit's templates: referrals (sending, arrival, rejection,
    counter-referral), chained appointments and follow-ups, procedures.
    ========================================================================== */

import type { SurgicalCase } from '../../../../core/data-access/procedures/procedures.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';

import { enAtencion, fechaDeAtencion, frase, type Indices, type Nombres, type Suceso } from './recorrido-guiado.sucesos';
import {
  enumerar,
  fechaCorta,
  fechaValida,
  legible,
  libre,
  mayusculaInicial,
  minusculaInicial,
} from './recorrido-guiado.texto';

export function destinoDe(d: Referral): string | undefined {
  return legible(d.targetDisplayName) ?? legible(d.targetTenantName) ?? legible(d.targetExternalName);
}

export function sucesosDeDerivaciones(lista: readonly Referral[], idx: Indices): Suceso[] {
  return lista.flatMap((d) => {
    const destino = destinoDe(d);
    const emitida = enAtencion(idx, d.sourceEncounterId, fechaValida(d.createdAt));
    const sucesos: Suceso[] = [
      {
        clase: 'derivacion',
        ...emitida,
        titulo: destino === undefined ? 'Derivación' : `Derivación a ${destino}`,
        enfocar: [d.id],
        frase: () => {
          if (destino === undefined) return frase('Se emitió una derivación; no se registró el destino.', [d.id]);
          const servicio = legible(d.targetServiceName) ?? libre(d.requestedServiceText);
          const dicho = libre(d.diagnosisText) ?? libre(d.reasonText);
          // «para evaluación de cefalea por cefalea»: the reason is not repeated when the service already names it.
          const motivo = dicho !== undefined && servicio?.toLocaleLowerCase('es').includes(dicho.toLocaleLowerCase('es')) ? undefined : dicho;
          return frase(
            `Se derivó a ${destino}${servicio === undefined ? '' : ` para ${minusculaInicial(servicio)}`}${
              motivo === undefined ? '' : ` por ${minusculaInicial(motivo)}`
            }.`,
            [d.id],
          );
        },
      },
    ];

    const origen = emitida.fecha;
    // It only exists after accepting the referral: the destination records it.
    const llegadaId = d.targetEncounterId;
    const deLaDerivacion = origen === null ? 'la derivación' : `la derivación del ${fechaCorta(origen)}`;
    if (llegadaId !== undefined && idx.atenciones.has(llegadaId)) {
      sucesos.push({
        clase: 'llegada',
        atencionId: llegadaId,
        fecha: fechaDeAtencion(idx, llegadaId),
        titulo: destino === undefined ? 'Llegada por derivación' : `Llegada a ${destino}`,
        enfocar: [d.id, llegadaId],
        frase: () =>
          frase(
            `Llegó por ${deLaDerivacion}${destino === undefined ? '' : ` a ${destino}`}, y se lo recibió en esta atención.`,
            [d.id, llegadaId],
          ),
      });
    } else if (fechaValida(d.transfer?.arrivedAt) !== null) {
      sucesos.push({
        clase: 'llegada',
        fecha: fechaValida(d.transfer?.arrivedAt),
        titulo: destino === undefined ? 'Llegada por derivación' : `Llegada a ${destino}`,
        enfocar: [d.id],
        frase: () =>
          frase(`Llegó al destino de ${deLaDerivacion}${destino === undefined ? '' : ` (${destino})`}.`, [d.id]),
      });
    }

    const respondida = fechaValida(d.respondedAt);
    if (d.status === 'REJECTED' && respondida !== null) {
      const motivo = libre(d.rejectReason);
      sucesos.push({
        clase: 'derivacion',
        fecha: respondida,
        titulo: 'Derivación rechazada',
        enfocar: [d.id],
        frase: () =>
          frase(
            `${mayusculaInicial(deLaDerivacion)} fue rechazada${motivo === undefined ? '. No se registró el motivo.' : `: ${motivo}.`}`,
            [d.id],
          ),
      });
    }

    const contra = fechaValida(d.counterReferralAt);
    if (contra !== null) {
      const texto = libre(d.counterReferralText);
      sucesos.push({
        clase: 'derivacion',
        fecha: contra,
        titulo: 'Contrarreferencia',
        enfocar: [d.id],
        frase: () =>
          frase(`Se recibió la contrarreferencia de ${deLaDerivacion}${texto === undefined ? '.' : `: ${texto}.`}`, [
            d.id,
          ]),
      });
    }
    return sucesos;
  });
}

/** The dates of the follow-up chain backwards, without repeats or cycles. */
export function cadenaDeReconsultas(cita: Booking, idx: Indices): { fechas: (Date | null)[]; ids: string[] } {
  const fechas: (Date | null)[] = [];
  const ids: string[] = [];
  const vistos = new Set<string>([cita.id]);
  let actual: Booking | undefined = cita;
  while (actual?.followUpOf !== undefined && actual.followUpOf !== null && fechas.length < 6) {
    const ref = actual.followUpOf;
    if (vistos.has(ref.bookingId)) break;
    vistos.add(ref.bookingId);
    const origen = idx.citas.get(ref.bookingId);
    fechas.push(
      fechaValida(ref.startAt) ?? fechaValida(origen?.startAt) ?? fechaDeAtencion(idx, ref.encounterId ?? undefined),
    );
    if (origen !== undefined) ids.push(origen.id);
    if (ref.encounterId !== null && ref.encounterId !== undefined && idx.atenciones.has(ref.encounterId)) {
      ids.push(ref.encounterId);
    }
    actual = origen;
  }
  return { fechas, ids };
}

const CANTIDADES = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** «tres», or the number if above ten. */
function cantidad(n: number): string {
  return CANTIDADES[n] ?? String(n);
}

export function sucesosDeCitas(lista: readonly Booking[], idx: Indices, n: Nombres, ahora: Date): Suceso[] {
  return lista.map((c) => {
    const fecha = fechaValida(c.startAt);
    const futura = fecha !== null && fecha.getTime() > ahora.getTime();
    const servicio = legible(c.service?.name) ?? n.concepto(c.serviceConceptId);
    if (c.followUpOf === undefined || c.followUpOf === null) {
      const estado = n.concepto(c.statusConceptId);
      return {
        clase: 'cita',
        fecha,
        titulo: futura ? 'Próxima cita' : 'Cita',
        enfocar: [c.id],
        plural: {
          clave: `cita|${futura}|${servicio ?? ''}|${futura ? '' : (estado ?? '')}`,
          texto: (cuantos) =>
            `${futura ? 'Tiene' : 'Tenía'} ${cantidad(cuantos)} citas${servicio === undefined ? '' : ` de ${servicio}`}${
              estado === undefined || futura ? '' : ` (estado: ${minusculaInicial(estado)})`
            }.`,
        },
        // A plain appointment matching an encounter is the same visit: it is not repeated.
        frase: (ctx) =>
          ctx.hayAtencion && !futura
            ? null
            : frase(
                `${futura ? 'Tiene' : 'Tenía'} una cita${servicio === undefined ? '' : ` de ${servicio}`}${
                  estado === undefined || futura ? '' : ` (estado: ${minusculaInicial(estado)})`
                }.`,
                [c.id],
              ),
      };
    }
    const cadena = cadenaDeReconsultas(c, idx);
    return {
      clase: 'reconsulta',
      fecha,
      titulo: futura ? 'Reconsulta agendada' : 'Reconsulta',
      enfocar: [c.id],
      frase: () => {
        const [primera, ...resto] = cadena.fechas;
        const vuelve =
          primera === null || primera === undefined
            ? 'vuelve a una cita anterior cuya fecha no está en esta lectura'
            : `vuelve a la cita del ${fechaCorta(primera)}`;
        const antes = resto
          .filter((f): f is Date => f !== null)
          .map((f) => `la del ${fechaCorta(f)}`);
        const encadenada = antes.length === 0 ? '' : `, que a su vez volvía a ${enumerar(antes)}`;
        return frase(
          `${futura ? 'Tiene agendada' : 'Tenía agendada'} una reconsulta${
            servicio === undefined ? '' : ` de ${servicio}`
          } que ${vuelve}${encadenada}.`,
          [c.id, ...cadena.ids],
        );
      },
    };
  });
}

export function sucesosDeProcedimientos(lista: readonly SurgicalCase[], n: Nombres, ahora: Date): Suceso[] {
  return lista.map((p) => {
    const fecha = fechaValida(p.scheduledStartAt);
    const futura = fecha !== null && fecha.getTime() > ahora.getTime();
    const estado = n.concepto(p.statusConceptId);
    const cirujano = n.profesional(p.primarySurgeonProfileId);
    return {
      clase: 'procedimiento',
      fecha,
      titulo: 'Intervención quirúrgica',
      enfocar: [p.id],
      frase: () =>
        frase(
          `${futura ? 'Tiene programada' : 'Se programó'} una intervención quirúrgica${
            cirujano === undefined ? '' : ` con ${cirujano}`
          }${estado === undefined ? '' : ` (estado: ${minusculaInicial(estado)})`}.`,
          [p.id],
        ),
    };
  });
}
