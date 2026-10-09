/**
 * Qué campos de un formulario están a la vista según lo ya contestado.
 *
 * Es la semántica de `enableWhen` de HL7 FHIR Questionnaire con el operador
 * `=` y el comportamiento `SHOW`, la misma que publica la API en
 * `ChartTemplateField.showWhen` y que declara `CreateFieldDependencyDto`:
 *
 * - un campo sin condición se ve siempre;
 * - uno con condición se ve si su padre **se ve** y vale lo esperado. Lo
 *   primero importa: el «¿desde cuándo?» de un «¿fuma?» que cuelga de un
 *   «¿consume tabaco?» no puede quedar a la vista cuando se contestó «no» al
 *   de arriba;
 * - si el padre es de varias respuestas (una lista), basta con que la incluya;
 * - si `equals` es una lista, basta con que coincida uno de sus valores;
 * - si el padre no está entre los campos, la condición se ignora y el campo se
 *   ve: perder una condición es preferible a esconder una pregunta para
 *   siempre.
 *
 * No sabe nada de Angular: la usan el motor de la vista previa y el bloque de
 * la consulta, cada uno con su forma de leer los valores.
 */

/** La condición, por la clave con la que se lee el valor del padre. */
export interface ConditionVisible {
  readonly key: string;
  readonly equals: string | boolean | readonly (string | boolean)[];
}

/** Lo mínimo que esta función necesita saber de un campo. */
export interface ConditionalField {
  readonly key: string;
  readonly showWhen?: ConditionVisible;
}

/** Si un valor contestado cumple la condición. */
export function conditionMeets(valor: unknown, equals: ConditionVisible['equals']): boolean {
  const esperados: readonly unknown[] = Array.isArray(equals) ? equals : [equals];
  const respuestas: readonly unknown[] = Array.isArray(valor) ? valor : [valor];
  return esperados.some((esperado) => respuestas.includes(esperado));
}

/**
 * Las claves de los campos ocultos.
 *
 * Se devuelven los **ocultos** y no los visibles porque es el conjunto chico:
 * casi todo formulario se ve entero y sólo los «¿cuál?» esperan respuesta.
 */
export function hiddenFields(
  campos: readonly ConditionalField[],
  valorDe: (key: string) => unknown,
): ReadonlySet<string> {
  const porClave = new Map(campos.map((campo) => [campo.key, campo]));
  const memo = new Map<string, boolean>();

  const visible = (campo: ConditionalField, camino: ReadonlySet<string>): boolean => {
    const guardado = memo.get(campo.key);
    if (guardado !== undefined) return guardado;

    const condicion = campo.showWhen;
    const padre = condicion === undefined ? undefined : porClave.get(condicion.key);
    let resultado = true;
    // Un ciclo es un error de la ficha; se corta mostrando el campo.
    if (condicion !== undefined && padre !== undefined && !camino.has(padre.key)) {
      resultado =
        visible(padre, new Set([...camino, campo.key])) &&
        conditionMeets(valorDe(condicion.key), condicion.equals);
    }
    memo.set(campo.key, resultado);
    return resultado;
  };

  const ocultos = new Set<string>();
  for (const campo of campos) {
    if (!visible(campo, new Set([campo.key]))) ocultos.add(campo.key);
  }
  return ocultos;
}
