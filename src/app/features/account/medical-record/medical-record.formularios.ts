/* ============================================================================
    The clinical forms of the patient's history, as the patient reads them and
    as the PDF prints them (`medical-record.ts`).
    ========================================================================== */

import type { FormInstanceDetail } from '../../../core/data-access/forms/forms.types';
import type { DocumentoDeFormulario } from '../../../shared/utils/clinical-pdf/clinical-pdf.types';
import { textoDeValor } from '../../../shared/utils/form-values/form-values';

/** Una respuesta de un formulario, ya en palabras. */
export interface RespuestaLeible {
  readonly id: string;
  readonly etiqueta: string;
  /** La respuesta en palabras. Vacía cuando `masked`: el marcador la reemplaza. */
  readonly texto: string;
  readonly masked: boolean;
}

/** Un formulario clínico respondido, tal como lo lee quien fue atendido. */
export interface FormularioVisible {
  readonly id: string;
  /** El encuentro en que se respondió; ata el formulario a su atención. */
  readonly encounterId: string;
  readonly titulo: string;
  /** Cuándo se completó, para mostrarse: el cierre manda; si no, la creación. */
  readonly cuando: Date | null;
  /** El cierre real, si lo hubo. Es lo único que el PDF declara como completado. */
  readonly cerradoEl?: Date;
  readonly respuestas: readonly RespuestaLeible[];
}

/**
 * Un formulario visible, en la forma del documento PDF.
 *
 * Lo comparten la historia de una atención y la historia completa: el mismo
 * formulario no puede salir distinto según qué papel lo lleve. `completadoEl`
 * sale sólo del cierre real, y el texto de un campo enmascarado ya viene vacío
 * del view-model — el armador además lo descarta por la bandera.
 */
export function comoDocumentoDeFormulario(formulario: FormularioVisible): DocumentoDeFormulario {
  return {
    id: formulario.id,
    titulo: formulario.titulo,
    ...(formulario.cerradoEl === undefined ? {} : { completadoEl: formulario.cerradoEl }),
    respuestas: formulario.respuestas.map((respuesta) => ({
      etiqueta: respuesta.etiqueta,
      texto: respuesta.texto,
      masked: respuesta.masked,
    })),
  };
}

/**
 * Un formulario respondido, en la forma en que el archivo lo lee.
 *
 * El título es genérico porque la instancia no declara su plantilla y el
 * paciente no puede leer el catálogo de plantillas; la etiqueta de cada campo
 * sí viaja en el detalle (`fieldName`) y es lo que vuelve legible la respuesta.
 * Cuando `masked` está puesto, el texto queda vacío: el marcador lo pone el
 * documento — acá jamás viaja el contenido.
 */
export function formularioLeible(detalle: FormInstanceDetail): FormularioVisible {
  const cierre = detalle.closedAt == null ? undefined : new Date(detalle.closedAt);
  const cerradoEl = cierre !== undefined && !Number.isNaN(cierre.getTime()) ? cierre : undefined;
  const creacion = new Date(detalle.createdAt);
  return {
    id: detalle.id,
    encounterId: detalle.resourceId,
    titulo: 'Formulario clínico',
    cuando: cerradoEl ?? (Number.isNaN(creacion.getTime()) ? null : creacion),
    ...(cerradoEl === undefined ? {} : { cerradoEl }),
    respuestas: [...detalle.values]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((valor) => ({
        id: valor.id,
        etiqueta: valor.fieldName ?? 'Campo del formulario',
        texto: valor.masked ? '' : textoDeValor(valor.value, valor.dataType),
        masked: valor.masked,
      })),
  };
}
