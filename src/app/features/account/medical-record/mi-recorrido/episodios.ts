import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { EstadoDelDiagnostico, RegistroConVinculos } from './registro-con-vinculos.types';
import { narracion, type PasoNarrado } from './narracion';
import { porFecha } from './redaccion';

/* ============================================================================
    (b) The grouping into episodes (the template narration lives in
    `narracion.ts`).

    It only works on `RegistroConVinculos`: it knows no endpoints nor portal
    types. Everything is pure and tested without TestBed.

    ## What an episode is

    One thread per health problem. It is built by the **final** diagnosis of a
    replacement chain (`reemplazadoPorId`): if «Migraña» was ruled out and
    «Cefalea tensional» took its place, both are the same thread and the ruled
    out one goes folded inside. The thread gets, **only by a declared link**:

    - the encounters where any of its diagnoses was entered;
    - the studies ordered for it (`diagnosticoId`) or used to decide it
      (`evidenciaEstudioId`);
    - the prescriptions indicated for it;
    - the follow-ups booked from one of those encounters.

    A study or a prescription **without** a link to a diagnosis is not assigned
    to a thread by proximity: it shows inside its encounter marked «de esta
    consulta», and does not enter the thread's narration. Encounters touching
    no diagnosis go to «Otras consultas».

    ## Why it does not delegate to the chart's `agruparEnEpisodios` (06/11/2026)

    The practitioner's network (`patient-chart/recorrido-clinico/red-clinica.episodios.ts`,
    ADR-0021) answers the same question with other rules, deliberately: it
    joins two records of the same concept into one problem, splits an
    encounter across several episodes and **deduces** links (the study ordered
    next to a presumptive, the same-day appointment and encounter). For the
    patient, each fact enters a thread only by a declared link and the rest is
    marked «de esta consulta» (Strip 5's decision 3). Delegating would require
    switching off exactly what sets that model apart, so it stays separate;
    what they do share is the source: the same ids and the same contract
    fields (`replacedByConditionId`, `reasonConditionId`,
    `indicationConditionId`, `verification.basedOn`, `followUpOf`).
    ========================================================================== */

/** A fact inside one of the episode's encounters. */
export interface HechoDelEpisodio {
  readonly registro: RegistroConVinculos;
  /**
   * `true` if it belongs to the episode by a declared link; `false` if it only
   * shares the encounter (and then it shows marked as such).
   */
  readonly directo: boolean;
}

/** An encounter, with what happened in it within this thread. */
export interface AtencionDelEpisodio {
  readonly registro: RegistroConVinculos;
  readonly hechos: readonly HechoDelEpisodio[];
}

export type ClaseDeEpisodio = 'vigente' | 'cerrado' | 'descartado' | 'otras';

export interface Episodio {
  readonly id: string;
  readonly clase: ClaseDeEpisodio;
  readonly titulo: string;
  readonly estado: EstadoDelDiagnostico | null;
  readonly sello: string;
  readonly tono: Tone;
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly atenciones: readonly AtencionDelEpisodio[];
  /** Diagnoses ruled out on the way to the final one, folded. */
  readonly descartados: readonly RegistroConVinculos[];
  /** The thread's facts whose encounter did not arrive (or that have none). */
  readonly sueltos: readonly HechoDelEpisodio[];
  readonly pasos: readonly PasoNarrado[];
}

export interface Recorrido {
  /** The threads with a current or closed diagnosis, most recent first. */
  readonly episodios: readonly Episodio[];
  /** The threads that ended in a ruling out, apart and folded. */
  readonly descartados: readonly Episodio[];
  /** The encounters touching no diagnosis, or `null` if there are none. */
  readonly otras: Episodio | null;
}

const SELLO: Readonly<Record<EstadoDelDiagnostico, { readonly sello: string; readonly tono: Tone }>> = {
  'en-estudio': { sello: 'En estudio', tono: 'warning' },
  confirmado: { sello: 'Confirmado', tono: 'success' },
  resuelto: { sello: 'Resuelto', tono: 'info' },
  descartado: { sello: 'Descartado', tono: 'secondary' },
};

/** Builds the whole tour from the neutral records. */
export function recorridoDelPaciente(registros: readonly RegistroConVinculos[]): Recorrido {
  const porId = new Map(registros.map((registro) => [registro.id, registro]));
  const atencionesConocidas = new Map(
    registros.filter((r) => r.tipo === 'atencion').map((r) => [r.id, r]),
  );
  const diagnosticos = registros.filter((r) => r.tipo === 'diagnostico');
  const controles = registros.filter((r) => r.tipo === 'control');
  const accesorios = registros.filter((r) => r.tipo === 'estudio' || r.tipo === 'receta');

  // Each diagnosis falls into the thread of its chain's final one.
  const cadenas = new Map<string, RegistroConVinculos[]>();
  for (const diagnostico of diagnosticos) {
    const final = finalDeCadena(diagnostico, porId);
    cadenas.set(final.id, [...(cadenas.get(final.id) ?? []), diagnostico]);
  }

  const atencionesUsadas = new Set<string>();
  const accesoriosUsados = new Set<string>();
  const episodios: Episodio[] = [];

  for (const [finalId, cadena] of cadenas) {
    const final = porId.get(finalId)!;
    const idsDeLaCadena = new Set(cadena.map((d) => d.id));
    const evidencias = new Set(
      cadena.map((d) => d.evidenciaEstudioId).filter((id): id is string => id !== null),
    );
    const vinculados = accesorios.filter(
      (r) => (r.diagnosticoId !== null && idsDeLaCadena.has(r.diagnosticoId)) || evidencias.has(r.id),
    );
    vinculados.forEach((r) => accesoriosUsados.add(r.id));

    const directos = [...cadena, ...vinculados];
    const idsDeAtencion = new Set(
      directos.map((r) => r.atencionId).filter((id): id is string => id !== null && atencionesConocidas.has(id)),
    );
    const controlesDelHilo = controles.filter(
      (c) => c.origenAtencionId !== null && idsDeAtencion.has(c.origenAtencionId),
    );
    idsDeAtencion.forEach((id) => atencionesUsadas.add(id));

    const atenciones = [...idsDeAtencion]
      .map((id) => atencionesConocidas.get(id)!)
      .sort(porFecha)
      .map((atencion) => ({
        registro: atencion,
        hechos: [
          ...directos.filter((r) => r.atencionId === atencion.id && !descartadoEnElCamino(r, final)),
          ...controlesDelHilo.filter((c) => c.origenAtencionId === atencion.id),
        ]
          .map((registro) => ({ registro, directo: true }))
          .concat(
            accesorios
              .filter(
                (r) => r.atencionId === atencion.id && !vinculados.includes(r) && r.diagnosticoId === null,
              )
              .map((registro) => ({ registro, directo: false })),
          )
          .sort((a, b) => porFecha(a.registro, b.registro)),
      }));

    const sueltos = directos
      .filter((r) => r.atencionId === null || !atencionesConocidas.has(r.atencionId))
      .filter((r) => !descartadoEnElCamino(r, final))
      .sort(porFecha)
      .map((registro) => ({ registro, directo: true }));

    const descartados = cadena.filter((d) => descartadoEnElCamino(d, final)).sort(porFecha);
    const estado = final.estado ?? 'en-estudio';
    const fechas = [...directos, ...controlesDelHilo]
      .flatMap((r) => [r.cuando, r.decididoEl, r.resueltoEl])
      .filter((f): f is Date => f !== null)
      .map((f) => f.getTime());

    episodios.push({
      id: final.id,
      clase: estado === 'descartado' ? 'descartado' : estado === 'resuelto' ? 'cerrado' : 'vigente',
      titulo: final.nombre,
      estado,
      ...SELLO[estado],
      desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
      hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
      atenciones,
      descartados,
      sueltos,
      pasos: narracion([...atenciones.map((a) => a.registro), ...directos, ...controlesDelHilo], porId),
    });
  }

  const orden = (a: Episodio, b: Episodio): number =>
    (b.hasta?.getTime() ?? 0) - (a.hasta?.getTime() ?? 0);

  return {
    episodios: [
      ...episodios.filter((e) => e.clase === 'vigente').sort(orden),
      ...episodios.filter((e) => e.clase === 'cerrado').sort(orden),
    ],
    descartados: episodios.filter((e) => e.clase === 'descartado').sort(orden),
    otras: otrasConsultas(registros, atencionesConocidas, atencionesUsadas, accesoriosUsados),
  };
}

/** A ruled-out diagnosis that is not its chain's final one: it goes folded in the thread. */
function descartadoEnElCamino(registro: RegistroConVinculos, final: RegistroConVinculos): boolean {
  return registro.tipo === 'diagnostico' && registro.id !== final.id && registro.estado === 'descartado';
}

/** Follows `reemplazadoPorId` up to the last known diagnosis. Cuts cycles. */
function finalDeCadena(
  diagnostico: RegistroConVinculos,
  porId: ReadonlyMap<string, RegistroConVinculos>,
): RegistroConVinculos {
  const vistos = new Set<string>([diagnostico.id]);
  let actual = diagnostico;
  while (actual.reemplazadoPorId !== null) {
    const siguiente = porId.get(actual.reemplazadoPorId);
    if (siguiente === undefined || siguiente.tipo !== 'diagnostico' || vistos.has(siguiente.id)) break;
    vistos.add(siguiente.id);
    actual = siguiente;
  }
  return actual;
}

function otrasConsultas(
  registros: readonly RegistroConVinculos[],
  atencionesConocidas: ReadonlyMap<string, RegistroConVinculos>,
  atencionesUsadas: ReadonlySet<string>,
  accesoriosUsados: ReadonlySet<string>,
): Episodio | null {
  const libres = [...atencionesConocidas.values()].filter((a) => !atencionesUsadas.has(a.id)).sort(porFecha);
  const sinAtencion = registros
    .filter(
      (r) =>
        (r.tipo === 'estudio' || r.tipo === 'receta') &&
        !accesoriosUsados.has(r.id) &&
        (r.atencionId === null || !atencionesConocidas.has(r.atencionId)),
    )
    .sort(porFecha);
  if (libres.length === 0 && sinAtencion.length === 0) return null;

  const atenciones = libres.map((atencion) => ({
    registro: atencion,
    hechos: registros
      .filter(
        (r) =>
          ((r.tipo === 'estudio' || r.tipo === 'receta') && r.atencionId === atencion.id) ||
          (r.tipo === 'control' && r.origenAtencionId === atencion.id),
      )
      .sort(porFecha)
      .map((registro) => ({ registro, directo: true })),
  }));
  const todos = [...libres, ...atenciones.flatMap((a) => a.hechos.map((h) => h.registro)), ...sinAtencion];
  const fechas = todos.map((r) => r.cuando?.getTime()).filter((t): t is number => t !== undefined);
  const porId = new Map(registros.map((r) => [r.id, r]));

  return {
    id: 'otras-consultas',
    clase: 'otras',
    titulo: 'Otras consultas',
    estado: null,
    sello: 'Sin diagnóstico asociado',
    tono: 'info',
    desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
    hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
    atenciones,
    descartados: [],
    sueltos: sinAtencion.map((registro) => ({ registro, directo: true })),
    pasos: narracion(todos, porId),
  };
}
