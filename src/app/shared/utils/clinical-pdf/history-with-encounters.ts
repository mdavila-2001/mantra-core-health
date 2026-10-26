import { buildBlocksPdf, campoDeBloque, listBlock, type PdfBlock } from '../pdf-export/pdf-export';
import { bloquesDeHistoria, historyPdfOptions } from './clinical-pdf';
import type { DocumentoDeHistoria } from './clinical-pdf.types';
import { servicesBlocks, type HistoryService } from './history-received-services';

/* ============================================================================
    Carril C6 · las dos secciones que le faltaban a «Descargar tu historia»:
    **los diagnósticos por estado** y **la línea de cada atención**.

    ## Por qué vive acá y no dentro de `bloquesDeHistoria`

    Porque `clinical-pdf.ts` lo está tocando otro carril en paralelo (C5, la
    sección de receta del mismo documento) y el reparto de la noche es explícito:
    **si dos carriles coinciden en una función, cada uno agrega la suya y C8
    unifica**. Meter dos manos en `bloquesDeHistoria` produce un conflicto de
    merge sobre un generador de documentos clínicos, que es el peor sitio donde
    resolver un conflicto a mano. Las dos secciones se insertan en los bloques
    de `bloquesDeHistoria` por el nombre de la sección, no por posición.

    ## Todo llega ya en palabras

    Igual que el resto de `clinical-pdf`: ningún campo es un uuid ni un código.
    La pantalla que arma el documento ya resolvió la terminología — el paciente
    que abre el PDF no tiene catálogo con qué resolver nada.
    ========================================================================== */

/** Un diagnóstico, tal como lo imprime la historia. */
export interface HistoryDiagnosis {
  /** «Hipertensión». */
  readonly nombre: string;
  /** «Confirmado», del catálogo. */
  readonly certeza: string;
  /** «activa hasta el 24/11/2026», «crónica», «resuelto el 03/09/2026». */
  readonly detalle: string | null;
}

/** Los tres bloques de la pestaña «Diagnósticos», en el papel. */
export interface HistoryDiagnoses {
  readonly enEstudio: readonly HistoryDiagnosis[];
  readonly activas: readonly HistoryDiagnosis[];
  readonly historicos: readonly HistoryDiagnosis[];
}

/** Un hecho de la línea de una atención: «Receta: Losartán — por Hipertensión». */
export interface CareFact {
  readonly titulo: string;
  readonly detalle: string | null;
  /** Cuándo pasó, ya en palabras. `null` si el registro no lo declara. */
  readonly cuando: string | null;
}

/** La línea de una atención, en el papel. */
export interface CareLinea {
  /** «Dolor de garganta · 1 de marzo de 2026». */
  readonly titulo: string;
  readonly sello: string;
  readonly hechos: readonly CareFact[];
}

/** Lo que C6 agrega al documento de la historia. */
export interface HistoryNewSections {
  readonly diagnosticos: HistoryDiagnoses;
  readonly lineas: readonly CareLinea[];
  /**
   * Los servicios recibidos (intervenciones y vacunas). Opcional: quien no los
   * trae no imprime la sección, en vez de imprimirla vacía y afirmar que no hubo.
   */
  readonly servicios?: readonly HistoryService[];
}

/**
 * La historia completa **con** los diagnósticos por estado y la línea de cada
 * atención.
 *
 * Cada sección nueva va donde se lee: los **diagnósticos por estado**, antes de
 * las atenciones —es la lista de problemas con que se abre una historia—, y la
 * **cronología por atención**, justo después de las atenciones y antes de las
 * recetas. Las dos se ubican por el título de la sección de
 * `bloquesDeHistoria` y no por un índice fijo, que se rompería en cuanto
 * aquélla agregara una sección. Si alguno de esos títulos faltara, la sección
 * va al final.
 */
export function historyWithEncountersBlocks(
  historia: DocumentoDeHistoria,
  nuevas: HistoryNewSections,
): readonly PdfBlock[] {
  const base = bloquesDeHistoria(historia);
  const antesDe = (titulo: string): number => {
    const indice = base.findIndex(
      (bloque) => bloque.kind === 'heading' && bloque.level === 2 && bloque.text === titulo,
    );
    return indice === -1 ? base.length : indice;
  };
  const diagnosticos = antesDe('Atenciones');
  const lineas = Math.max(diagnosticos, antesDe('Recetas'));

  return [
    ...base.slice(0, diagnosticos),
    ...diagnosesBlocks(nuevas.diagnosticos),
    ...base.slice(diagnosticos, lineas),
    ...linesBlocks(nuevas.lineas),
    ...base.slice(lineas),
    // Al final, como la pestaña: lo que se le hizo al paciente, después de lo que se habló y se pidió.
    ...(nuevas.servicios === undefined ? [] : servicesBlocks(nuevas.servicios)),
  ];
}

/** Arma el PDF de la historia con las secciones de C6. */
export function buildHistoryWithEncountersPdf(
  historia: DocumentoDeHistoria,
  nuevas: HistoryNewSections,
) {
  // La misma portada que la historia de siempre: es el mismo documento con
  // dos secciones más, no otro papel.
  return buildBlocksPdf(historyWithEncountersBlocks(historia, nuevas), historyPdfOptions(historia));
}

/**
 * Descarga la historia con las secciones de C6.
 *
 * Mismo nombre de archivo que la descarga de siempre —`historia-perez-…`—:
 * es el mismo documento con dos secciones más, no otro papel.
 */
export function downloadHistoryWithEncounters(
  historia: DocumentoDeHistoria,
  nuevas: HistoryNewSections,
): void {
  buildHistoryWithEncountersPdf(historia, nuevas).save(
    historyName(historia.paciente.nombre, new Date()),
  );
}

/* ---- las dos secciones, bloque por bloque -------------------------------- */

/**
 * Los tres bloques, **siempre los tres**, en una sola tabla con una banda por
 * bloque: las columnas se alinean entre los tres y, si la tabla sigue en otra
 * hoja, la banda del bloque se repite arriba.
 *
 * Un bloque que desaparece cuando está vacío deja a quien lee el papel sin
 * saber si no tiene diagnósticos de ese tipo o si el sistema no los trajo. En
 * un documento clínico eso no es lo mismo, y por eso cada uno dice su vacío.
 */
export function diagnosesBlocks(diagnosticos: HistoryDiagnoses): readonly PdfBlock[] {
  return [
    { kind: 'heading', text: 'Diagnósticos por estado', level: 2 },
    ...diagnosesGroup('En estudio', diagnosticos.enEstudio, 'Sin diagnósticos en estudio.'),
    ...diagnosesGroup(
      'Enfermedades activas',
      diagnosticos.activas,
      'Sin enfermedades activas registradas.',
    ),
    ...diagnosesGroup('Históricos', diagnosticos.historicos, 'Sin diagnósticos históricos.'),
  ];
}

function diagnosesGroup(
  titulo: string,
  filas: readonly HistoryDiagnosis[],
  vacio: string,
): readonly PdfBlock[] {
  // La banda dice el bloque; `text` es su nombre a secas, que es como se lee.
  const bloques: PdfBlock[] = [
    { kind: 'row', text: titulo, cells: [titulo, 'Certeza', 'Detalle'], header: true },
  ];
  if (filas.length === 0) {
    // Sin punto en la celda: al lado van rayas.
    bloques.push({ kind: 'row', text: vacio, cells: [vacio.replace(/\.$/, ''), '—', '—'] });
    return bloques;
  }

  for (const fila of filas) {
    const detalle = fila.detalle ?? '—';
    bloques.push({
      kind: 'row',
      text: `${fila.nombre} (${fila.certeza}) — ${detalle}`,
      cells: [fila.nombre, fila.certeza, detalle],
    });
  }
  return bloques;
}

/**
 * La cronología de cada atención: qué pasó y en qué orden.
 *
 * El orden lo trae quien arma el documento —es el mismo que la pantalla
 * dibuja—; el papel no reordena nada, porque dos versiones del mismo hecho
 * clínico en distinto orden es exactamente lo que no puede pasar.
 */
export function linesBlocks(lineas: readonly CareLinea[]): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [{ kind: 'heading', text: 'Cronología por atención', level: 2 }];

  if (lineas.length === 0) {
    bloques.push({ kind: 'paragraph', text: 'Sin atenciones registradas.' });
    return bloques;
  }

  for (const linea of lineas) {
    bloques.push({ kind: 'heading', text: linea.titulo, level: 3 });
    bloques.push(campoDeBloque('Estado de la atención', linea.sello));
    if (linea.hechos.length === 0) {
      bloques.push({ kind: 'paragraph', text: 'Sin registros clínicos en esta atención.' });
      continue;
    }
    // Los hechos son una enumeración: una viñeta por hecho, en el orden dado.
    bloques.push(listBlock(linea.hechos.map(frase)));
  }
  return bloques;
}

/** «Receta: Losartán — por Hipertensión (01/03/2026)». */
function frase(hecho: CareFact): string {
  const conDetalle = hecho.detalle === null ? hecho.titulo : `${hecho.titulo} — ${hecho.detalle}`;
  return hecho.cuando === null ? conDetalle : `${conDetalle} (${hecho.cuando})`;
}

/* ---- nombre de archivo ---------------------------------------------------- */

/**
 * `historia-perez-2026-09-25.pdf`.
 *
 * Con el apellido y sin sufijo hexadecimal: este archivo lo abre una persona en
 * su carpeta de descargas y un identificador no le dice nada. Misma regla que
 * `nombreLegible` de `clinical-pdf.ts`, que es privada de aquel archivo.
 */
function historyName(nombre: string, fecha: Date): string {
  const dia = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
  const apellido = (nombre.trim().split(/\s+/).filter(Boolean).at(-1) ?? 'paciente')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `historia-${apellido === '' ? 'paciente' : apellido}-${dia}.pdf`;
}
