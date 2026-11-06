/* ============================================================================
    The thread's story in template sentences (`episodios.ts` groups the
    threads).
    ========================================================================== */

import type { RegistroConVinculos } from './registro-con-vinculos.types';
import { compararInstantes, conFecha, DIA_LARGO, minusculaInicial } from './redaccion';

/** A sentence of the narration, tied to the record it comes from. */
export interface PasoNarrado {
  readonly texto: string;
  readonly registroId: string;
  /** The encounter to expand to see the record, if it has one. */
  readonly atencionId: string | null;
}

/** A step with what it takes to sort it. */
interface PasoOrdenable extends PasoNarrado {
  readonly cuando: Date | null;
  readonly peso: number;
}

/**
 * The thread's story in template sentences, in date order.
 *
 * Each sentence comes from **one** record and names it (`registroId`): so the
 * screen can take the reader to the record backing what they just read. There
 * is no sentence without a record behind it.
 */
export function narracion(
  registros: readonly RegistroConVinculos[],
  porId: ReadonlyMap<string, RegistroConVinculos>,
): readonly PasoNarrado[] {
  const nombre = (id: string | null): string | null => (id === null ? null : (porId.get(id)?.nombre ?? null));
  const atencionDe = (r: RegistroConVinculos): string | null =>
    r.tipo === 'control' ? r.origenAtencionId : r.atencionId;
  const pasos: PasoOrdenable[] = [];
  const paso = (r: RegistroConVinculos, cuando: Date | null, peso: number, texto: string): void => {
    pasos.push({ texto, registroId: r.id, atencionId: atencionDe(r), cuando, peso });
  };

  for (const r of registros) {
    switch (r.tipo) {
      case 'atencion':
        paso(
          r,
          r.cuando,
          0,
          conFecha(r.cuando, fraseDeLaConsulta(r.nombre)) +
            (r.enCurso ? ' La atención sigue abierta.' : ''),
        );
        break;
      case 'diagnostico':
        pasosDelDiagnostico(r, nombre, paso);
        break;
      case 'estudio': {
        const para = nombre(r.diagnosticoId);
        paso(
          r,
          r.cuando,
          2,
          `Le pidieron ${r.nombre}${para === null ? '' : ` por ${para}`}.` +
            (r.conResultado ? ' El resultado ya está disponible.' : ''),
        );
        break;
      }
      case 'receta': {
        const para = nombre(r.diagnosticoId);
        paso(r, r.cuando, 4, `Le recetaron ${r.nombre}${para === null ? '' : ` para ${para}`}.`);
        break;
      }
      case 'control':
        paso(r, r.cuando, 7, fraseDelControl(r));
        break;
    }
  }

  return pasos
    .sort((a, b) => compararInstantes(a.cuando, b.cuando) || a.peso - b.peso)
    .map(({ texto, registroId, atencionId }) => ({ texto, registroId, atencionId }));
}

function pasosDelDiagnostico(
  r: RegistroConVinculos,
  nombre: (id: string | null) => string | null,
  paso: (r: RegistroConVinculos, cuando: Date | null, peso: number, texto: string) => void,
): void {
  const decidido = r.estado === 'confirmado' || r.estado === 'descartado';
  const conDecision = decidido && r.decididoEl !== null;
  const anotadoComoPosible = r.estado === 'en-estudio' || conDecision || r.estado === 'descartado';

  paso(
    r,
    r.cuando,
    1,
    anotadoComoPosible
      ? `Se anotó ${r.nombre} como posible diagnóstico${r.estado === 'en-estudio' ? ', todavía en estudio' : ''}.`
      : `Se registró el diagnóstico ${r.nombre}.`,
  );

  if (r.estado === 'confirmado' && r.decididoEl !== null) {
    const con = nombre(r.evidenciaEstudioId);
    paso(r, r.decididoEl, 5, conFecha(r.decididoEl, `se confirmó ${r.nombre}${con === null ? '' : ` con su estudio de ${con}`}.`));
  }
  if (r.estado === 'descartado') {
    const enSuLugar = nombre(r.reemplazadoPorId);
    paso(
      r,
      r.decididoEl ?? r.cuando,
      5,
      conFecha(r.decididoEl, `se descartó ${r.nombre}${enSuLugar === null ? '' : `; en su lugar quedó ${enSuLugar}`}.`),
    );
  }
  // A ruled-out diagnosis is not «resolved»: it was already said it was not.
  // Telling both on the same day reads as if the person had what was ruled out.
  if (r.resueltoEl !== null && r.estado !== 'descartado') {
    paso(r, r.resueltoEl, 6, conFecha(r.resueltoEl, `se resolvió ${r.nombre}.`));
  }
}

function fraseDelControl(r: RegistroConVinculos): string {
  const dia = r.cuando === null ? null : DIA_LARGO.format(r.cuando);
  switch (r.estadoDelControl) {
    case 'realizado':
      return conFecha(r.cuando, 'volvió a control.');
    case 'proximo':
      return dia === null ? 'Tiene un control pendiente.' : `Tiene control el ${dia}.`;
    case 'no-realizado':
      return dia === null ? 'Un control agendado no se realizó.' : `El control del ${dia} no se realizó.`;
    default:
      return dia === null ? 'Se agendó un control.' : `Se agendó un control para el ${dia}.`;
  }
}

/**
 * «consultó por cansancio…»; a follow-up's or a referral visit's reason already
 * says what it is («Reconsulta: lectura de…», «Interconsulta por…»), and
 * «consultó por reconsulta» read badly.
 */
function fraseDeLaConsulta(motivo: string): string {
  // «Interconsulta por …» already names the kind of visit: «tuvo una interconsulta por …».
  if (/^interconsulta\b/i.test(motivo)) return `tuvo una ${minusculaInicial(motivo)}.`;
  const resto = motivo.replace(/^reconsulta\s*[:·-]?\s*/i, '');
  if (resto === motivo) return `consultó por ${minusculaInicial(motivo)}.`;
  return resto === '' ? 'volvió a consulta.' : `volvió a consulta: ${minusculaInicial(resto)}.`;
}
