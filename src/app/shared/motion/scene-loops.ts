/* ============================================================================
    Control de los bucles decorativos de una escena.

    Actúa SOLO sobre las animaciones infinitas: las de una vez (la secuencia de
    encendido, la entrada de la tarjeta, un aviso que aparece) siguen su curso.
    Un bucle infinito es, por definición, decoración que nunca termina de
    costar: cada cuadro vuelve a componer las capas que mueve.

    Va por la Web Animations API y no por una clase de CSS porque el escenario
    vive repartido en cinco hojas con encapsulación propia; `getAnimations`
    los encuentra a todos —pseudo-elementos incluidos— sin que ninguna hoja
    tenga que enterarse.
    ========================================================================== */

/** Las animaciones infinitas vivas dentro de `root`. Vacío donde no hay WAAPI (jsdom, SSR). */
function sceneLoops(root: HTMLElement): Animation[] {
  if (typeof root.getAnimations !== 'function') {
    return [];
  }
  return root
    .getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity);
}

/** Congela cada bucle donde está. Para una pausa que después se reanuda. */
export function pauseLoops(root: HTMLElement): void {
  for (const loop of sceneLoops(root)) {
    loop.pause();
  }
}

/** Reanuda los bucles desde donde se congelaron. */
export function resumeLoops(root: HTMLElement): void {
  for (const loop of sceneLoops(root)) {
    loop.play();
  }
}

/**
 * Detiene cada bucle **al principio de su ciclo**, y ahí se queda.
 *
 * No es lo mismo que pausar. Congelado al azar, el destello del latido o una
 * onda pueden quedar a medio encender. El fotograma 0 % de todos los bucles de
 * la escena es su reposo —ondas y destello en opacidad 0, esferas en su sitio,
 * el cometa todavía antes del trazo—, así que estacionarlos ahí deja la
 * escena quieta y limpia sin repetir en CSS el estado de reposo.
 */
export function parkLoops(root: HTMLElement): void {
  for (const loop of sceneLoops(root)) {
    const timing = loop.effect?.getComputedTiming();
    loop.pause();
    loop.currentTime = startOfCycle(Number(timing?.delay ?? 0), Number(timing?.duration ?? 0));
  }
}

/**
 * El primer instante en que el bucle está al 0 % de un ciclo.
 *
 * Con retardo positivo es el retardo mismo. Con retardo negativo —así se
 * desfasan las esferas entre sí— el bucle ya arrancó a mitad de ciclo, y el
 * próximo inicio está en el primer múltiplo del período que lo compensa.
 */
function startOfCycle(delay: number, period: number): number {
  if (delay >= 0 || period <= 0) {
    return Math.max(delay, 0);
  }
  return delay + Math.ceil(-delay / period) * period;
}
