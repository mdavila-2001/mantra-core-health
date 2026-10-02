import type {
  ChartTemplate,
  ChartTemplateField,
} from '../../../../core/data-access/chart-templates/chart-templates.types';
import type { FormInstanceDetail } from '../../../../core/data-access/forms/forms.types';
import { textoDeValor } from '../../../../shared/utils/form-values/form-values';

/** Una respuesta ya lista para leerse: etiqueta, texto y si está protegida. */
export interface RespuestaVisible {
  readonly id: string;
  readonly etiqueta: string;
  /** La respuesta en palabras. Vacía cuando `masked`: el marcador la reemplaza. */
  readonly texto: string;
  readonly masked: boolean;
}

/** Todos los campos conocidos por las plantillas, para ponerle nombre a cada valor. */
export function camposDe(
  plantillas: readonly ChartTemplate[],
): ReadonlyMap<string, ChartTemplateField> {
  const campos = new Map<string, ChartTemplateField>();
  for (const plantilla of plantillas) {
    for (const campo of plantilla.fields) {
      if (!campos.has(campo.fieldId)) campos.set(campo.fieldId, campo);
    }
  }
  return campos;
}

/**
 * La plantilla de la que salió la respuesta, inferida por cobertura de
 * campos: la instancia no declara su plantilla, así que gana la que más
 * `fieldId` de los valores contiene. Con el dato real —una plantilla por
 * especialidad— la inferencia es exacta; si nada coincide, `null`.
 */
export function plantillaPorCobertura(
  detalle: FormInstanceDetail,
  plantillas: readonly ChartTemplate[],
): ChartTemplate | null {
  const respondidos = new Set(detalle.values.map((valor) => valor.fieldId));
  let mejor: ChartTemplate | null = null;
  let mejorCobertura = 0;
  for (const plantilla of plantillas) {
    const cobertura = plantilla.fields.filter((campo) => respondidos.has(campo.fieldId)).length;
    if (cobertura > mejorCobertura) {
      mejor = plantilla;
      mejorCobertura = cobertura;
    }
  }
  return mejor;
}

/** Las respuestas de una instancia, en orden y en palabras. */
export function respuestasDe(
  detalle: FormInstanceDetail,
  campos: ReadonlyMap<string, ChartTemplateField>,
): readonly RespuestaVisible[] {
  return [...detalle.values]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((valor) => {
      const campo = campos.get(valor.fieldId);
      return {
        id: valor.id,
        etiqueta: campo?.name ?? 'Campo del formulario',
        texto: valor.masked
          ? // El marcador lo pone la vista; acá jamás viaja el contenido.
            ''
          : textoDeValor(valor.value, valor.dataType ?? campo?.dataType),
        masked: valor.masked,
      };
    });
}
