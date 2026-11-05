/**
 * Señales de privacidad del navegador: «No rastrear» (DNT) y Global Privacy
 * Control (GPC).
 *
 * Si cualquiera está activa, el SDK de interacciones **no arranca**: ni vistas
 * anónimas, ni oyentes. Es la lectura estricta, y es la correcta: la persona ya
 * dijo que no, y no hay que preguntarle ni medirla de otra forma.
 *
 * Función pura sobre `Navigator`/`Window` para probarla sin navegador.
 */
export interface SignalNavigator {
  readonly doNotTrack?: string | null;
  readonly msDoNotTrack?: string | null;
  readonly globalPrivacyControl?: boolean;
}

export interface SignalWindow {
  readonly doNotTrack?: string | null;
  readonly navigator?: SignalNavigator;
}

/** `true` si la persona pidió no ser rastreada (DNT = «1»/«yes», o GPC activo). */
export function isPrivacySignalActive(ventana: SignalWindow | null | undefined): boolean {
  if (ventana === null || ventana === undefined) {
    return false;
  }
  const nav = ventana.navigator;
  const dnt = [nav?.doNotTrack, nav?.msDoNotTrack, ventana.doNotTrack];
  if (dnt.some((valor) => valor === '1' || valor === 'yes')) {
    return true;
  }
  return nav?.globalPrivacyControl === true;
}
