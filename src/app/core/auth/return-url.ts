/**
 * Valida un `returnUrl` que llega por la barra de direcciones (entrada de
 * usuario): sólo se acepta una ruta interna. Empieza con `/` y **no** con `//`
 * ni `/\`, que el navegador resuelve como host externo (redirección abierta).
 * Devuelve `null` si no sirve.
 */
export function safeReturnUrl(pedido: string | null | undefined): string | null {
  if (pedido === null || pedido === undefined || pedido === '') {
    return null;
  }
  const externo = !pedido.startsWith('/') || /^\/[/\\]/.test(pedido);
  return externo ? null : pedido;
}
