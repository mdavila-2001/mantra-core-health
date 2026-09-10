import { InjectionToken } from '@angular/core';
import type { jsPDF } from 'jspdf';

import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../pdf-export/pdf-export';

/* ============================================================================
    El PDF de Evoluciones: a quién se atendió en el período.

    Mismo patrón que `clinical-pdf.ts` y `quotation-pdf.ts`: se arman los
    bloques a mano y los maqueta `buildBlocksPdf`, que es el único maquetador
    del repo y el que pone el membrete con el logo. Renderizar la pantalla y
    leerla del DOM habría dado una pila de párrafos sueltos, no una tabla.

    ## Lo que este papel NO dice, y lo dice

    **No trae el texto de las evoluciones.** `M15 chart` escribe y versiona
    notas (`POST /charts/notes`) pero no tiene ninguna lectura de colección, así
    que no hay de dónde sacarlas. El documento lo declara en un aviso arriba, en
    vez de salir con una lista de pacientes que alguien pueda leer como «acá
    están mis notas». Es la misma advertencia que muestra la pantalla: un
    documento que dijera menos que la pantalla de la que salió sería peor que no
    tenerlo.
    ========================================================================== */

/** Cómo se imprime una fecha con su hora. Local, no ISO: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** El día solo, para la bajada del membrete. */
const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** Una atención del período, ya en palabras. */
export interface EvolucionParaPdf {
  readonly cuando: Date;
  readonly paciente: string;
  /** El motivo registrado, o `null` si no se anotó. */
  readonly motivo: string | null;
  readonly estado: string;
  /** La tipología de la cita, o `null` si la reserva no tiene cita detrás. */
  readonly tipo: string | null;
}

/** Lo que hace falta para imprimir la pantalla de Evoluciones. */
export interface EvolucionesParaPdf {
  /** Quién atendió. Vacío si la sesión no expone un nombre. */
  readonly profesional: string;
  /** La ventana mirada, en días. */
  readonly dias: number;
  /**
   * Las atenciones **tal como se están viendo**: si hay filtros o una búsqueda
   * puestos, el papel lleva lo mismo que la pantalla. Un PDF que ignora el
   * filtro que alguien acaba de poner es un PDF que no era el que se pidió.
   */
  readonly atenciones: readonly EvolucionParaPdf[];
  /** Qué se dejó afuera, en palabras, o `null` si se está viendo todo. */
  readonly filtro: string | null;
}

/** Lo que el papel dice donde el dato no está. Nunca un hueco en blanco. */
const SIN_DATO = 'No registrado';

/**
 * Las líneas del documento, en orden de lectura.
 *
 * Exportada para que el spec fije **qué dice** el papel sin pasar por jsPDF,
 * que ya tiene sus propias pruebas en `pdf-export.spec.ts`.
 */
export function bloquesDeEvoluciones(datos: EvolucionesParaPdf): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    {
      kind: 'note',
      text: 'Este documento lista las atenciones del período, no el texto de cada evolución: la lectura de las notas clínicas todavía no existe en la API.',
    },
    { kind: 'heading', text: 'El período', level: 2 },
  ];

  if (datos.profesional.trim() !== '') {
    bloques.push(campoDeBloque('Profesional', datos.profesional));
  }
  bloques.push(campoDeBloque('Ventana', `Últimos ${datos.dias} días`));
  bloques.push(campoDeBloque('Atenciones', String(datos.atenciones.length)));
  // Se dice arriba y no al pie: quien recibe el papel tiene que saber que está
  // mirando un recorte antes de sacar cuentas con lo que ve.
  if (datos.filtro !== null) {
    bloques.push(campoDeBloque('Filtro aplicado', datos.filtro));
  }

  bloques.push({ kind: 'heading', text: 'Atenciones', level: 2 });
  if (datos.atenciones.length === 0) {
    bloques.push({
      kind: 'paragraph',
      text:
        datos.filtro === null
          ? `No hay atenciones registradas en los últimos ${datos.dias} días.`
          : 'Ninguna atención del período coincide con el filtro aplicado.',
    });
  } else {
    bloques.push(fila(['Cuándo', 'Paciente', 'Motivo', 'Estado', 'Tipo'], true));
    for (const atencion of datos.atenciones) {
      bloques.push(
        fila([
          FORMATO_FECHA.format(atencion.cuando),
          atencion.paciente,
          atencion.motivo ?? SIN_DATO,
          atencion.estado,
          atencion.tipo ?? SIN_DATO,
        ]),
      );
    }
  }

  bloques.push({
    kind: 'caption',
    text: `Documento generado el ${FORMATO_FECHA.format(new Date())} desde el sistema.`,
  });
  return bloques;
}

/**
 * Una fila de la tabla.
 *
 * `text` mantiene la línea corrida —lo que se lee si el documento se recorre
 * como texto— y `cells` son las columnas que el maquetador alinea.
 */
function fila(celdas: readonly string[], header = false): PdfBlock {
  return { kind: 'row', text: celdas.join('   '), cells: celdas, header };
}

/** Arma el PDF. No lo guarda: devuelve el documento. */
export function buildProgressNotesPdf(datos: EvolucionesParaPdf): jsPDF {
  return buildBlocksPdf(bloquesDeEvoluciones(datos), {
    title: 'Evoluciones',
    kind: 'Evoluciones',
    subtitle: `Últimos ${datos.dias} días · ${FORMATO_DIA.format(new Date())}`,
  });
}

/**
 * Descarga el documento.
 *
 * El nombre lleva la fecha de emisión y nada más: este papel no es de un
 * paciente sino del período, así que un apellido en el archivo mentiría sobre
 * lo que contiene.
 */
export function downloadProgressNotesPdf(datos: EvolucionesParaPdf): void {
  const hoy = new Date();
  const dia = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-');
  buildProgressNotesPdf(datos).save(`evoluciones-${dia}.pdf`);
}

/**
 * La descarga como dependencia inyectable.
 *
 * Misma costura que `QUOTATION_PDF_DOWNLOADER`: el sistema de pruebas de
 * Angular no admite `vi.mock` de un import relativo, y comprobar que la
 * pantalla exporta los datos correctos no debería abrir un PDF real ni depender
 * del orden de carga de `jspdf`.
 */
export const PROGRESS_NOTES_PDF_DOWNLOADER = new InjectionToken<
  (datos: EvolucionesParaPdf) => void
>('PROGRESS_NOTES_PDF_DOWNLOADER', {
  providedIn: 'root',
  factory: () => downloadProgressNotesPdf,
});
