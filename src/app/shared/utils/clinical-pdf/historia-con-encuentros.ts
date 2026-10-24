import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../pdf-export/pdf-export';
import { bloquesDeHistoria } from './clinical-pdf';
import type { DocumentoDeHistoria } from './clinical-pdf.types';

/* ============================================================================
    Carril C6 · las dos secciones que le faltaban a «Descargar tu historia»:
    **los diagnósticos por estado** y **la línea de cada atención**.

    ## Por qué vive acá y no dentro de `bloquesDeHistoria`

    Porque `clinical-pdf.ts` lo está tocando otro carril en paralelo (C5, la
    sección de receta del mismo documento) y el reparto de la noche es explícito:
    **si dos carriles coinciden en una función, cada uno agrega la suya y C8
    unifica**. Meter dos manos en `bloquesDeHistoria` produce un conflicto de
    merge sobre un generador de documentos clínicos, que es el peor sitio donde
    resolver un conflicto a mano.

    // TODO C8: fundir estas dos secciones dentro de `bloquesDeHistoria` cuando
    // C5 haya aterrizado, y dejar un solo `downloadHistoryPdf`.

    ## Todo llega ya en palabras

    Igual que el resto de `clinical-pdf`: ningún campo es un uuid ni un código.
    La pantalla que arma el documento ya resolvió la terminología — el paciente
    que abre el PDF no tiene catálogo con qué resolver nada.
    ========================================================================== */

/** Un diagnóstico, tal como lo imprime la historia. */
export interface DiagnosticoDeLaHistoria {
  /** «Hipertensión». */
  readonly nombre: string;
  /** «Confirmado», del catálogo. */
  readonly certeza: string;
  /** «activa hasta el 24/11/2026», «crónica», «resuelto el 03/09/2026». */
  readonly detalle: string | null;
}

/** Los tres bloques de la pestaña «Diagnósticos», en el papel. */
export interface DiagnosticosDeLaHistoria {
  readonly enEstudio: readonly DiagnosticoDeLaHistoria[];
  readonly activas: readonly DiagnosticoDeLaHistoria[];
  readonly historicos: readonly DiagnosticoDeLaHistoria[];
}

/** Un hecho de la línea de una atención: «Receta: Losartán — por Hipertensión». */
export interface HechoDeLaAtencion {
  readonly titulo: string;
  readonly detalle: string | null;
  /** Cuándo pasó, ya en palabras. `null` si el registro no lo declara. */
  readonly cuando: string | null;
}

/** La línea de una atención, en el papel. */
export interface LineaDeAtencion {
  /** «Dolor de garganta · 1 de marzo de 2026». */
  readonly titulo: string;
  readonly sello: string;
  readonly hechos: readonly HechoDeLaAtencion[];
}

/** Lo que C6 agrega al documento de la historia. */
export interface SeccionesNuevasDeLaHistoria {
  readonly diagnosticos: DiagnosticosDeLaHistoria;
  readonly lineas: readonly LineaDeAtencion[];
}

/**
 * La historia completa **con** los diagnósticos por estado y la línea de cada
 * atención.
 *
 * Las secciones nuevas se insertan **antes del pie** y no después: el pie dice
 * cuándo y desde dónde salió el papel, y algo impreso después de esa línea se
 * lee como un anexo de otro documento. Se localiza por su tipo (`caption`, el
 * único que `bloquesDeHistoria` pone al final) en vez de por un índice fijo,
 * que se rompería en cuanto aquélla agregara una sección.
 */
export function bloquesDeHistoriaConEncuentros(
  historia: DocumentoDeHistoria,
  nuevas: SeccionesNuevasDeLaHistoria,
): readonly PdfBlock[] {
  const base = bloquesDeHistoria(historia);
  const corte = base.at(-1)?.kind === 'caption' ? base.length - 1 : base.length;

  return [
    ...base.slice(0, corte),
    ...bloquesDeDiagnosticos(nuevas.diagnosticos),
    ...bloquesDeLasLineas(nuevas.lineas),
    ...base.slice(corte),
  ];
}

/** Arma el PDF de la historia con las secciones de C6. */
export function buildHistoriaConEncuentrosPdf(
  historia: DocumentoDeHistoria,
  nuevas: SeccionesNuevasDeLaHistoria,
) {
  return buildBlocksPdf(bloquesDeHistoriaConEncuentros(historia, nuevas), {
    title: 'Historia clínica',
    kind: 'Historia clínica',
    subtitle: bajada(historia.paciente.nombre),
  });
}

/**
 * Descarga la historia con las secciones de C6.
 *
 * Mismo nombre de archivo que la descarga de siempre —`historia-perez-…`—:
 * es el mismo documento con dos secciones más, no otro papel.
 */
export function descargarHistoriaConEncuentros(
  historia: DocumentoDeHistoria,
  nuevas: SeccionesNuevasDeLaHistoria,
): void {
  buildHistoriaConEncuentrosPdf(historia, nuevas).save(
    nombreDeLaHistoria(historia.paciente.nombre, new Date()),
  );
}

/* ---- las dos secciones, bloque por bloque -------------------------------- */

/**
 * Los tres bloques, **siempre los tres**.
 *
 * Un bloque que desaparece cuando está vacío deja a quien lee el papel sin
 * saber si no tiene diagnósticos de ese tipo o si el sistema no los trajo. En
 * un documento clínico eso no es lo mismo, y por eso cada uno dice su vacío.
 */
export function bloquesDeDiagnosticos(diagnosticos: DiagnosticosDeLaHistoria): readonly PdfBlock[] {
  return [
    { kind: 'heading', text: 'Diagnósticos por estado', level: 2 },
    ...grupoDeDiagnosticos('En estudio', diagnosticos.enEstudio, 'Sin diagnósticos en estudio.'),
    ...grupoDeDiagnosticos(
      'Enfermedades activas',
      diagnosticos.activas,
      'Sin enfermedades activas registradas.',
    ),
    ...grupoDeDiagnosticos('Históricos', diagnosticos.historicos, 'Sin diagnósticos históricos.'),
  ];
}

function grupoDeDiagnosticos(
  titulo: string,
  filas: readonly DiagnosticoDeLaHistoria[],
  vacio: string,
): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [{ kind: 'heading', text: titulo, level: 3 }];
  if (filas.length === 0) {
    bloques.push({ kind: 'paragraph', text: vacio });
    return bloques;
  }

  bloques.push({
    kind: 'row',
    text: ['Diagnóstico', 'Certeza', 'Detalle'].join('\t'),
    cells: ['Diagnóstico', 'Certeza', 'Detalle'],
    header: true,
  });
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
 * La línea de cada atención: qué pasó y en qué orden.
 *
 * El orden lo trae quien arma el documento —es el mismo que la pantalla
 * dibuja—; el papel no reordena nada, porque dos versiones del mismo hecho
 * clínico en distinto orden es exactamente lo que no puede pasar.
 */
export function bloquesDeLasLineas(lineas: readonly LineaDeAtencion[]): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [{ kind: 'heading', text: 'Línea de cada atención', level: 2 }];

  if (lineas.length === 0) {
    bloques.push({ kind: 'paragraph', text: 'Sin atenciones registradas.' });
    return bloques;
  }

  for (const linea of lineas) {
    bloques.push({ kind: 'heading', text: linea.titulo, level: 3 });
    bloques.push(campoDeBloque('Estado de la atención', linea.sello));
    if (linea.hechos.length === 0) {
      bloques.push({ kind: 'paragraph', text: 'De esta atención no quedó nada registrado.' });
      continue;
    }
    for (const hecho of linea.hechos) {
      bloques.push({ kind: 'paragraph', text: frase(hecho) });
    }
  }
  return bloques;
}

/** «Receta: Losartán — por Hipertensión (1 de marzo de 2026)». */
function frase(hecho: HechoDeLaAtencion): string {
  const conDetalle = hecho.detalle === null ? hecho.titulo : `${hecho.titulo} — ${hecho.detalle}`;
  return hecho.cuando === null ? conDetalle : `${conDetalle} (${hecho.cuando})`;
}

/* ---- membrete y nombre de archivo ---------------------------------------- */

/** La fecha sola, como la imprime el resto de los documentos clínicos. */
const DIA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** La bajada del membrete: de quién es el papel y de cuándo. */
function bajada(nombre: string): string | undefined {
  const quien = nombre.trim();
  const cuando = DIA.format(new Date());
  return quien === '' ? cuando : `${quien} · ${cuando}`;
}

/**
 * `historia-perez-2026-09-25.pdf`.
 *
 * Con el apellido y sin sufijo hexadecimal: este archivo lo abre una persona en
 * su carpeta de descargas y un identificador no le dice nada. Misma regla que
 * `nombreLegible` de `clinical-pdf.ts`, que es privada de aquel archivo.
 */
function nombreDeLaHistoria(nombre: string, fecha: Date): string {
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
