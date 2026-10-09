/** Una operación del contrato: método, ruta con `:param` y esquema del cuerpo. */
export type ContractRoute = readonly [method: string, pattern: string, schema: string];

/** Las claves de un cuerpo, como las declara el DTO de la API. */
export interface ContractSchema {
  readonly keys: readonly string[];
  readonly required: readonly string[];
  /** Propiedades que son otro esquema (objeto o arreglo de objetos). */
  readonly nested?: Readonly<Record<string, string>>;
  /** `additionalProperties`: acepta cualquier clave. */
  readonly open?: boolean;
}

/** Un campo que no cumplió el contrato, con la forma de `details.fields` de la API. */
export interface ContractViolation {
  readonly field: string;
  readonly constraints: readonly string[];
  readonly messages: readonly string[];
}
