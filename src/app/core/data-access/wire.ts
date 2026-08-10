/* ============================================================================
    Conversión del transporte a los tipos de la vista.

    Vive acá y no dentro de un cliente porque **el mismo defecto apareció en
    dos**, y con la misma causa: una suposición sobre la forma del cuerpo que
    las pruebas unitarias no podían desmentir, porque fabricaban la respuesta
    con la forma supuesta.

    ## Lo que el servidor manda de verdad

    Verificado contra la API viva el 2026-08-08:

    - **Los campos opcionales vacíos llegan como `null`; no se omiten.**
      `GET /profiles/patients/:id` devuelve `"deceasedAt": null`,
      `"birthDate": null`, `"administrativeGenderConceptId": null`…
      Es lo esperable: las columnas son `nullable: true` y el servicio copia el
      valor de la entidad tal cual.
    - **Una fecha `format: 'date'` se serializa como instante**:
      `"1985-03-14T00:00:00.000Z"`.

    ## Por qué eso rompe cosas

    Los tipos de la vista declaran esos campos con `?:`, que en TypeScript
    significa `undefined`. La diferencia con `null` no es cosmética:

    - `new Date(null)` es **1970-01-01**, no `Invalid Date`. Una fecha ausente se
      mostraba como el 1 de enero de 1970 — o el 31 de diciembre de 1969, según
      el huso.
    - `campo !== undefined` es **`true`** cuando el campo vale `null`. La ficha
      de paciente marcaba **fallecida a toda persona viva** por esto.
    - Una fecha anclada a medianoche UTC, pintada en hora local, **retrocede un
      día** al oeste de Greenwich.

    ## La regla

    **Se normaliza en la frontera.** Un cliente de `data-access/` promete la
    forma que declara su tipo de vista, y estas funciones son cómo la cumple.
    Ningún componente debería tener que preguntarse si un opcional llegó como
    `null`.
    ========================================================================== */

/** La misma forma, admitiendo el `null` que el transporte sí manda. */
export type ConNulos<T> = { readonly [K in keyof T]: T[K] | null };

/**
 * Quita las claves que llegaron en `null`.
 *
 * No las pone en `undefined`: **elimina la clave**. Es la única forma de que
 * `'x' in objeto` y `Object.keys()` digan lo mismo que el tipo.
 */
export function sinNulos<T extends object>(body: ConNulos<T>): T {
  return Object.fromEntries(
    Object.entries(body).filter(([, valor]) => valor !== null),
  ) as T;
}

/**
 * Convierte una marca de tiempo que puede no venir.
 *
 * **`== null` y no `=== undefined`**: cubre los dos, y el segundo solo no
 * alcanza porque el servidor manda `null`.
 *
 * Devolver `undefined` en vez de una `Invalid Date` es lo que deja al
 * consumidor distinguir «no hay dato» de «hay un dato roto».
 */
export function maybeDate(value?: string | null): Date | undefined {
  return value == null ? undefined : new Date(value);
}

/**
 * Convierte una fecha **sin hora** a la medianoche **local**.
 *
 * El contrato declara estos campos como `format: 'date'`, pero el servidor los
 * serializa como instante (`"1985-03-14T00:00:00.000Z"`). Pasarlos por
 * `new Date()` los ancla a medianoche UTC, y al pintarlos en hora local
 * **retroceden un día** en cualquier huso al oeste de Greenwich.
 *
 * Es el espejo del cuidado que los formularios ya tienen al **enviar**: allá se
 * arma el `YYYY-MM-DD` con los componentes locales para no correrlo al pasar
 * por UTC. Acá se hace el camino de vuelta.
 *
 * Una marca de tiempo de verdad —`deceasedAt`, `createdAt`, `openedAt`— **no**
 * pasa por acá: ahí el instante **es** el dato, y anclarlo a medianoche local
 * lo rompería. Para esas, {@link maybeDate}.
 */
export function maybeDateOnly(value?: string | null): Date | undefined {
  if (value == null) {
    return undefined;
  }
  const [anio, mes, dia] = value.slice(0, 10).split('-').map(Number);
  // `Number.isNaN` y no sólo `=== undefined`: con un texto que no es una fecha,
  // `Number('es')` da `NaN` —no `undefined`— y `new Date(NaN, …)` produce una
  // `Invalid Date`, que en una plantilla se cuela como valor verdadero. Es el
  // mismo modo de fallo que esta función existe para evitar.
  if (
    anio === undefined ||
    mes === undefined ||
    dia === undefined ||
    Number.isNaN(anio) ||
    Number.isNaN(mes) ||
    Number.isNaN(dia)
  ) {
    return undefined;
  }
  return new Date(anio, mes - 1, dia);
}
