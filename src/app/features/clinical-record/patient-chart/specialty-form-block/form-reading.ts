import type {
  ChartTemplate,
  ChartTemplateField,
} from '../../../../core/data-access/chart-templates/chart-templates.types';
import type { FormInstanceDetail } from '../../../../core/data-access/forms/forms.types';
import { textoDeValor } from '../../../../shared/utils/form-values/form-values';

/** Una respuesta ya lista para leerse: etiqueta, texto y si está protegida. */
export interface ResponseVisible {
  readonly id: string;
  readonly etiqueta: string;
  /** La respuesta en palabras. Vacía cuando `masked`: el marcador la reemplaza. */
  readonly texto: string;
  readonly masked: boolean;
}

/** Todos los campos conocidos por las plantillas, para ponerle nombre a cada valor. */
export function fieldsOf(
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
 * La plantilla de la que salió la respuesta. La instancia no declara su
 * plantilla, así que se infiere de los `fieldId` respondidos:
 *
 * 1. La que contiene **todos** los campos respondidos y tiene menos campos.
 *    Las fichas comparten los campos base (motivo, antecedentes…): contar sólo
 *    coincidencias le daba la anamnesis a la ficha cardiológica, que trae esos
 *    mismos campos y más.
 * 2. Si ninguna los contiene a todos, la que más contiene.
 *
 * `null` si ninguna comparte un solo campo.
 */
export function templateByCoverage(
  detalle: FormInstanceDetail,
  plantillas: readonly ChartTemplate[],
): ChartTemplate | null {
  const respondidos = new Set(detalle.values.map((valor) => valor.fieldId));
  let mejor: ChartTemplate | null = null;
  let mejorCobertura = 0;
  let menorQueCubreTodo: ChartTemplate | null = null;
  for (const plantilla of plantillas) {
    const propios = new Set(plantilla.fields.map((campo) => campo.fieldId));
    const cobertura = [...respondidos].filter((id) => propios.has(id)).length;
    if (cobertura > mejorCobertura) {
      mejor = plantilla;
      mejorCobertura = cobertura;
    }
    if (
      respondidos.size > 0 &&
      cobertura === respondidos.size &&
      (menorQueCubreTodo === null || plantilla.fields.length < menorQueCubreTodo.fields.length)
    ) {
      menorQueCubreTodo = plantilla;
    }
  }
  return menorQueCubreTodo ?? mejor;
}

/** Las respuestas de una instancia, en orden y en palabras. */
export function responsesOf(
  detalle: FormInstanceDetail,
  campos: ReadonlyMap<string, ChartTemplateField>,
): readonly ResponseVisible[] {
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
