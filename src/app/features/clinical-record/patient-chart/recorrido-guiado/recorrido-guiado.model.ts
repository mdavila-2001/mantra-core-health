/* ============================================================================
    The guided tour: the patient's story told step by step.

    Pure functions, no Angular. They take the records as `core/data-access/`
    returns them and produce an ordered list of **steps**: each with its date,
    a title, a narration built from templates and the ids of the network
    nodes to focus and those already revealed.

    ## Nothing made up (ADR-0022)

    No AI nor generated free text. Each sentence comes from a template and
    carries the list of records it comes from (`FraseDelPaso.fuentes`): if a
    sentence cannot be traced to a record, it is not written. When a piece of
    data is missing it is said to be missing («No se registró el motivo»),
    never filled in.

    A **real** contract link (`indicationConditionId`, `reasonConditionId`,
    `replacedByConditionId`, `followUpOf`, `targetEncounterId`) is narrated as
    a cause: «para confirmar o descartar…». An **inferred** link —two records
    of the same encounter with no field joining them— is narrated as a
    coincidence («en la misma atención») and the sentence is marked
    `inferida`. Never the other way round.

    ## The clinical day

    Every date narrated here is an instant (an encounter's start, a creation),
    so the day is read in the product's time zone (`dia-clinico.ts`): the same
    key the clinical network uses for its columns and `inferido-mismo-dia`.
    It is also the key that groups the records «of the same moment».
    ========================================================================== */

import {
  sucesosDeAtenciones,
  sucesosDeDiagnosticos,
  sucesosDeInternaciones,
  sucesosDeRecetas,
} from './recorrido-guiado.sucesos-clinicos';
import { sucesosDeInformes, sucesosDeOrdenes } from './recorrido-guiado.sucesos-de-estudios';
import {
  sucesosDeCitas,
  sucesosDeDerivaciones,
  sucesosDeProcedimientos,
} from './recorrido-guiado.sucesos-de-circuito';
import { frase, Nombres, ORDEN, porId, type ClaseDeSuceso, type ContextoDelPaso, type Indices, type Suceso } from './recorrido-guiado.sucesos';
import { diaClinico, fechaCorta, fechaValida, mayusculaInicial, minusculaInicial, sinIdentificadores } from './recorrido-guiado.texto';
import type {
  FraseDelPaso,
  LectorDelRecorrido,
  PasoDelRecorrido,
  RegistrosDelRecorrido,
} from './recorrido-guiado.types';

export type {
  FraseDelPaso,
  LectorDelRecorrido,
  PasoDelRecorrido,
  RegistrosDelRecorrido,
} from './recorrido-guiado.types';
export { diaClinico, enumerar, fechaCorta, legible } from './recorrido-guiado.texto';

const TITULO_PRIORIDAD: readonly ClaseDeSuceso[] = [
  'atencion',
  'llegada',
  'internacion',
  'decision',
  'resultado',
  'diagnostico',
  'derivacion',
  'orden',
  'receta',
  'reconsulta',
  'procedimiento',
  'alta',
  'cita',
];

/* -- El armado ------------------------------------------------------------- */

/**
 * The story as a list of steps in chronological order.
 *
 * `ahora` decides the tense of what is booked («tiene agendada» versus
 * «tenía agendada»); it is passed so the tests do not depend on the clock.
 */
export function armarRecorridoGuiado(
  registros: RegistrosDelRecorrido,
  lector: LectorDelRecorrido,
  ahora: Date = new Date(),
): readonly PasoDelRecorrido[] {
  const idx: Indices = {
    atenciones: porId(registros.atenciones),
    diagnosticos: porId(registros.diagnosticos),
    ordenes: porId(registros.ordenes),
    informes: porId(registros.informes),
    citas: porId(registros.citas),
    internaciones: porId(registros.internaciones),
  };
  const nombres = new Nombres(lector);
  const sucesos: Suceso[] = [
    ...sucesosDeInternaciones(registros.internaciones ?? [], nombres),
    ...sucesosDeAtenciones(registros.atenciones ?? [], idx, nombres),
    ...sucesosDeDiagnosticos(registros.diagnosticos ?? [], idx, nombres),
    ...sucesosDeOrdenes(registros.ordenes ?? [], idx, nombres),
    ...sucesosDeInformes(registros.informes ?? [], idx, nombres),
    ...sucesosDeRecetas(registros.recetas ?? [], idx, nombres),
    ...sucesosDeDerivaciones(registros.derivaciones ?? [], idx),
    ...sucesosDeCitas(registros.citas ?? [], idx, nombres, ahora),
    ...sucesosDeProcedimientos(registros.procedimientos ?? [], nombres, ahora),
  ];
  return agrupar(sucesos, idx);
}

/* -- Agrupar en pasos ------------------------------------------------------ */

const SIN_FECHA = 'sin-fecha';

function agrupar(sucesos: readonly Suceso[], idx: Indices): PasoDelRecorrido[] {
  const grupos = new Map<string, Suceso[]>();
  for (const s of sucesos) {
    const clave = s.fecha === null ? SIN_FECHA : diaClinico(s.fecha);
    const lista = grupos.get(clave) ?? [];
    lista.push(s);
    grupos.set(clave, lista);
  }

  const claves = [...grupos.keys()].sort((a, b) =>
    a === SIN_FECHA ? 1 : b === SIN_FECHA ? -1 : a.localeCompare(b),
  );

  const pasos: PasoDelRecorrido[] = [];
  const revelados: string[] = [];
  const yaRevelado = new Set<string>();

  for (const clave of claves) {
    const delDia = grupos.get(clave) ?? [];
    const paso = armarPaso(clave, delDia, idx);
    if (paso === null) continue;
    for (const id of paso.enfocar) {
      if (!yaRevelado.has(id)) {
        yaRevelado.add(id);
        revelados.push(id);
      }
    }
    pasos.push({ ...paso, revelados: [...revelados] });
  }
  return pasos;
}

/**
 * The time that orders an event within the day: its encounter's if tied to one
 * (so what belongs to one encounter stays together), its own if loose.
 */
function horaDeOrden(s: Suceso, idx: Indices): number {
  const deLaAtencion = s.atencionId === undefined ? null : fechaValida(idx.atenciones.get(s.atencionId)?.startAt);
  return (deLaAtencion ?? s.fecha)?.getTime() ?? 0;
}

function armarPaso(
  clave: string,
  sucesos: readonly Suceso[],
  idx: Indices,
): Omit<PasoDelRecorrido, 'revelados'> | null {
  const ordenados = [...sucesos].sort(
    (a, b) =>
      horaDeOrden(a, idx) - horaDeOrden(b, idx) ||
      ORDEN[a.clase] - ORDEN[b.clase] ||
      (a.atencionId ?? '').localeCompare(b.atencionId ?? '') ||
      (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0),
  );

  const atenciones = new Set(ordenados.filter((s) => s.clase === 'atencion').map((s) => s.atencionId));
  const atencionesConDiagnostico = new Set(
    ordenados
      .filter((s) => (s.clase === 'diagnostico' || s.clase === 'decision') && s.atencionId !== undefined)
      .map((s) => s.atencionId as string),
  );
  const contexto: ContextoDelPaso = { atencionesConDiagnostico, hayAtencion: atenciones.size > 0 };

  const frases: FraseDelPaso[] = [];
  const enfocar: string[] = [];
  const usados: Suceso[] = [];
  // How many events with a sentence share each plural key.
  const iguales = new Map<string, Suceso[]>();
  for (const s of ordenados) {
    if (s.plural === undefined || s.frase(contexto) === null) continue;
    iguales.set(s.plural.clave, [...(iguales.get(s.plural.clave) ?? []), s]);
  }
  for (const s of ordenados) {
    let f = s.frase(contexto);
    if (f === null) continue;
    const grupo = s.plural === undefined ? undefined : iguales.get(s.plural.clave);
    if (s.plural !== undefined && grupo !== undefined && grupo.length > 1) {
      // The group's first says the total; the rest are already counted.
      if (grupo[0] !== s) {
        usados.push(s);
        for (const id of s.enfocar) if (!enfocar.includes(id)) enfocar.push(id);
        continue;
      }
      f = frase(s.plural.texto(grupo.length, grupo.map((g) => g.plural?.nombre ?? '')), grupo.flatMap((g) => g.enfocar));
    }
    // What is loose on a day with an encounter is said as a date coincidence, not an encounter one.
    const suelto = contexto.hayAtencion && s.atencionId === undefined && frases.length > 0;
    frases.push(suelto ? { ...f, texto: `Ese mismo día, ${minusculaInicial(f.texto)}` } : f);
    usados.push(s);
    for (const id of s.enfocar) if (!enfocar.includes(id)) enfocar.push(id);
  }
  if (frases.length === 0) return null;

  const fecha =
    clave === SIN_FECHA
      ? null
      : usados.map((s) => s.fecha).filter((f): f is Date => f !== null).sort((a, b) => a.getTime() - b.getTime())[0] ??
        null;

  const principal =
    TITULO_PRIORIDAD.map((c) => usados.find((s) => s.clase === c)).find((s) => s !== undefined) ?? usados[0];

  if (fecha === null) {
    frases.unshift(
      frase(
        'Estos registros no tienen fecha, así que no se pueden ubicar en el tiempo.',
        usados.flatMap((s) => s.enfocar).filter((id, i, todos) => todos.indexOf(id) === i),
      ),
    );
  } else {
    const [primera, ...resto] = frases;
    frases.splice(0, frases.length, { ...primera, texto: `El ${fechaCorta(fecha)} ${minusculaInicial(primera.texto)}` }, ...resto);
  }

  const limpias = frases.map((f) => ({ ...f, texto: sinIdentificadores(f.texto) }));
  return {
    clave,
    fecha,
    fechaTexto: fecha === null ? 'Sin fecha' : fechaCorta(fecha),
    titulo: sinIdentificadores(mayusculaInicial(principal.titulo)),
    narracion: limpias.map((f) => f.texto).join(' '),
    frases: limpias,
    enfocar,
  };
}

/* -- Seguir un solo episodio ----------------------------------------------- */

/**
 * The steps touching at least one node of the episode, with the focus trimmed
 * to those nodes and the revealed ones recomputed over the filtered list. The
 * narration is not trimmed: splitting a sentence would change what it says.
 */
export function seguirEpisodio(
  pasos: readonly PasoDelRecorrido[],
  idsDelEpisodio: Iterable<string>,
): readonly PasoDelRecorrido[] {
  const episodio = new Set(idsDelEpisodio);
  const resultado: PasoDelRecorrido[] = [];
  const revelados: string[] = [];
  for (const paso of pasos) {
    const enfocar = paso.enfocar.filter((id) => episodio.has(id));
    if (enfocar.length === 0) continue;
    for (const id of enfocar) if (!revelados.includes(id)) revelados.push(id);
    resultado.push({ ...paso, enfocar, revelados: [...revelados] });
  }
  return resultado;
}
