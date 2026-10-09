/**
 * El único mecanismo de QR del front (regla de la tanda de farmacia): el
 * código de retiro (FAR-I2) y el QR de pago simulado (FAR-I5) se dibujan con
 * esta misma función — una lib, un empaquetado, un comportamiento.
 *
 * La lib se carga perezoso: el bundle inicial no la conoce, y quien nunca
 * llega a un QR nunca la descarga. Negro sobre blanco siempre: lo escanea un
 * lector de mostrador o una cámara de banca móvil, no el tema de la interfaz.
 */
export async function dibujarQr(
  lienzo: HTMLCanvasElement,
  contenido: string,
  lado: number,
): Promise<void> {
  // Interop CJS (mismo caso que leaflet): según el empaquetado, la API llega
  // como namespace o colgada de `default`.
  const modulo = (await import('qrcode')) as typeof import('qrcode') & {
    readonly default?: typeof import('qrcode');
  };
  const qr = modulo.default ?? modulo;
  await qr.toCanvas(lienzo, contenido, {
    width: lado,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
