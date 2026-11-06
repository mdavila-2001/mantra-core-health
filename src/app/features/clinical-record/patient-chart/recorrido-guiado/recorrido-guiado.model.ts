/* ============================================================================
    El recorrido guiado: la historia del paciente contada paso a paso.

    Funciones puras y sin Angular. Reciben los registros tal como los devuelve
    `core/data-access/` y producen una lista ordenada de **pasos**: cada uno con
    su fecha, un título, una narración armada con plantillas y los ids de los
    nodos de la red que hay que enfocar y los que ya quedaron revelados.

    ## Nada inventado (ADR-0022)

    No hay IA ni texto libre generado. Cada frase sale de una plantilla y lleva
    la lista de registros de los que sale (`FraseDelPaso.fuentes`): si una frase
    no se puede rastrear a un registro, no se escribe. Cuando falta un dato se
    dice que falta («No se registró el motivo»), nunca se rellena.

    Un vínculo **real** del contrato (`indicationConditionId`,
    `reasonConditionId`, `replacedByConditionId`, `followUpOf`,
    `targetEncounterId`) se narra como causa: «para confirmar o descartar…». Un
    vínculo **inferido** —dos registros de la misma atención sin campo que los
    una— se narra como coincidencia («en la misma atención») y la frase queda
    marcada `inferida`. Nunca al revés.

    ## Fechas en UTC

    El mismo criterio que `fechaClinica` de
    `account/medical-record/history-view-model.ts` (no exportada, por eso se
    replica): el día se lee en UTC, porque una medianoche UTC leída en hora de
    Bolivia (UTC−4) cae el día anterior. El día UTC también es la clave con la
    que se agrupan los registros «del mismo momento».
    ========================================================================== */

import {
  sucesosDeAtenciones,
  sucesosDeDiagnosticos,
  sucesosDeInformes,
  sucesosDeInternaciones,
  sucesosDeOrdenes,
  sucesosDeRecetas,
} from './recorrido-guiado.sucesos-clinicos';
import {
  sucesosDeCitas,
  sucesosDeDerivaciones,
  sucesosDeProcedimientos,
} from './recorrido-guiado.sucesos-de-circuito';
import { frase, Nombres, ORDEN, porId, type ClaseDeSuceso, type ContextoDelPaso, type Indices, type Suceso } from './recorrido-guiado.sucesos';
import { diaUtc, fechaCorta, fechaValida, mayusculaInicial, minusculaInicial, sinIdentificadores } from './recorrido-guiado.texto';
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
export { diaUtc, enumerar, fechaCorta, legible } from './recorrido-guiado.texto';

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
 * La historia como lista de pasos en orden cronológico.
 *
 * `ahora` decide el tiempo verbal de lo agendado («tiene agendada» frente a
 * «tenía agendada»); se pasa para que las pruebas no dependan del reloj.
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
    const clave = s.fecha === null ? SIN_FECHA : diaUtc(s.fecha);
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
 * La hora que ordena un suceso dentro del día: la de su atención si está atado a
 * una (así lo de una misma atención queda junto), la propia si va suelto.
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
  for (const s of ordenados) {
    const f = s.frase(contexto);
    if (f === null) continue;
    // Lo suelto en un día con atención se dice como coincidencia de fecha, no de atención.
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
 * Los pasos que tocan al menos un nodo del episodio, con el foco recortado a
 * esos nodos y los revelados recalculados sobre la lista filtrada. La
 * narración no se recorta: partir una frase cambiaría lo que dice.
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
