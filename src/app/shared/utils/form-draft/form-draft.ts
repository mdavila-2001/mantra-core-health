/* ============================================================================
    El borrador que no se pisa con lo que uno mismo acaba de emitir.

    Nació en el editor de campos del generador de formularios: la plantilla se
    relee tras cada guardado, y si el borrador se reseteara con cada relectura,
    la tercera letra de una opción borraría las dos primeras. Se aisla acá para
    que cualquier editor con el mismo problema —tipear, guardar solo, releer lo
    guardado— lo reutilice en vez de copiarlo.

    Trabaja sobre **firmas**: cadenas que resumen un estado guardable. Quien lo
    usa decide cómo construir esa firma a partir de su propio dominio; este
    núcleo sólo sabe comparar texto, así que no depende de ningún modelo
    clínico ni de la API.
    ========================================================================== */

/** Reconoce si lo que llegó es lo que este borrador emitió por última vez. */
export interface BorradorAislado {
  /** Si la firma que llegó es la que se emitió por última vez. */
  readonly esLoPropio: (firma: string) => boolean;
  /** Registra la firma recién emitida, para reconocerla cuando vuelva. */
  readonly registrarEmision: (firma: string) => void;
}

/** Crea un borrador aislado, sin nada emitido todavía. */
export function crearBorradorAislado(): BorradorAislado {
  let ultimoEmitido: string | null = null;
  return {
    esLoPropio: (firma) => ultimoEmitido !== null && firma === ultimoEmitido,
    registrarEmision: (firma) => {
      ultimoEmitido = firma;
    },
  };
}

/** Si hay algo que valga la pena mandar: la firma de los cambios difiere de la actual. */
export function hayCambioGuardable(firmaActual: string, firmaDeCambios: string): boolean {
  return firmaActual !== firmaDeCambios;
}
