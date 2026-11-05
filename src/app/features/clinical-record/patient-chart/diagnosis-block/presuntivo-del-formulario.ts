import type { MedicalNoteEntry } from '../../../../core/data-access/clinical/clinical.types';
import type { ResponseVisible } from '../specialty-form-block/form-reading';

/**
 * Los topes que la API impone a las filas de una nota (`entries`, P39): el
 * campo admite 60 caracteres, el valor 500 y la nota 40 filas. Se repiten acá
 * —igual que en `AdditionalFields`— porque la precarga tiene que **entrar** en
 * ellos: una fila traída del formulario que el servidor rechazaría haría fallar
 * el registro por algo que quien atiende no escribió.
 */
export const TOPE_DEL_CAMPO = 60;
export const TOPE_DEL_VALOR = 500;

/** Cuánto del resumen viaja en `noteText` del diagnóstico. La nota lleva el detalle. */
export const TOPE_DEL_RESUMEN = 1000;

/** La marca con la que `AdditionalFields` agrupa las filas traídas del formulario. */
export const ORIGEN_FORMULARIO = 'formulario';

/** El formulario médico ya llenado del que salen los motivos. */
export interface OrigenDelFormulario {
  readonly id: string;
  /** Cómo se llama la ficha («Ficha cardiológica base»). */
  readonly nombre: string;
  /** Cuándo quedó completada, en palabras. Vacío si no se pudo leer. */
  readonly fecha: string;
}

/** Lo que dejó la lectura de una respuesta, para decir qué se trajo y qué no. */
export interface MotivosDeLaRespuesta {
  readonly entradas: readonly MedicalNoteEntry[];
  /** Respuestas protegidas: **nunca** se copian, su contenido no viaja. */
  readonly protegidas: number;
  /** Valores que se cortaron para entrar en el tope. */
  readonly recortadas: number;
}

function recortar(texto: string, tope: number): string {
  return texto.length > tope ? `${texto.slice(0, tope - 1)}…` : texto;
}

/** «Presión Arterial» y «presion arterial» son el mismo campo. */
function normalizado(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Las respuestas de un formulario ya llenado, como filas «campo: valor».
 *
 * - Una respuesta **protegida** (`masked`) no se copia jamás: el texto que
 *   trae es el marcador de la vista, y copiarlo a una nota dejaría escrito un
 *   dato que el formulario ocultaba a propósito.
 * - Las vacías se omiten: una fila sin valor no dice nada y la API la rechaza.
 * - El campo y el valor se cortan a los topes del contrato.
 * - Dos preguntas con el mismo nombre no pueden ser dos filas con el mismo
 *   campo —la nota las rechaza como duplicadas—: la segunda sale «(2)».
 */
export function motivosDeLaRespuesta(respuestas: readonly ResponseVisible[]): MotivosDeLaRespuesta {
  const usados = new Set<string>();
  const entradas: MedicalNoteEntry[] = [];
  let protegidas = 0;
  let recortadas = 0;

  for (const respuesta of respuestas) {
    if (respuesta.masked) {
      protegidas += 1;
      continue;
    }
    const valor = respuesta.texto.trim();
    if (valor === '') continue;

    const base = recortar(respuesta.etiqueta.trim() || 'Campo del formulario', TOPE_DEL_CAMPO);
    let campo = base;
    for (let n = 2; usados.has(normalizado(campo)); n += 1) {
      const sufijo = ` (${n})`;
      campo = `${recortar(base, TOPE_DEL_CAMPO - sufijo.length)}${sufijo}`;
    }
    usados.add(normalizado(campo));

    const valorFinal = recortar(valor, TOPE_DEL_VALOR);
    if (valorFinal !== valor) recortadas += 1;
    entradas.push({ label: campo, value: valorFinal });
  }
  return { entradas, protegidas, recortadas };
}

/**
 * El texto que queda en el diagnóstico (`noteText`): lo que escribió el médico,
 * de qué formulario salió y un resumen de los motivos. El detalle estructurado
 * vive en la nota del encuentro; esto es lo que se lee de un vistazo en la
 * historia, así que se acota.
 */
export function resumenDelPresuntivo(
  hallazgos: string,
  origen: OrigenDelFormulario | null,
  motivos: readonly MedicalNoteEntry[],
): string | undefined {
  const partes: string[] = [];
  const libre = hallazgos.trim();
  if (libre !== '') partes.push(libre);
  if (origen !== null) {
    partes.push(
      `Del formulario «${origen.nombre}»${origen.fecha === '' ? '' : ` (${origen.fecha})`}.`,
    );
  }
  if (motivos.length > 0) {
    partes.push(`Motivos: ${motivos.map((m) => `${m.label}: ${m.value}`).join('; ')}`);
  }
  if (partes.length === 0) return undefined;
  return recortar(partes.join('\n'), TOPE_DEL_RESUMEN);
}
