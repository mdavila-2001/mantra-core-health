import type express from 'express';

/**
 * Extensiones que **sólo** puede tener un artefacto de la construcción.
 *
 * Ninguna ruta del router de Angular termina así, de modo que si `express.static`
 * no encontró el archivo, no existe: no hay nada que renderizar.
 */
const EXTENSIONES_DE_CONSTRUCCION = ['.js', '.mjs', '.css', '.map'] as const;

export function esArtefactoDeConstruccion(ruta: string): boolean {
  const sinConsulta = ruta.split('?')[0] ?? '';
  return EXTENSIONES_DE_CONSTRUCCION.some((ext) => sinConsulta.endsWith(ext));
}

/**
 * Un `.js` que no existe tiene que ser un 404, no la aplicación entera.
 *
 * Va **después** de `express.static`: lo que llega acá es lo que el servidor de
 * estáticos no encontró. Sin esta regla la petición seguía hasta el motor de
 * Angular, que respondía el HTML de la aplicación con un **200**, y el navegador
 * intentaba parsear ese HTML como un módulo. El error que se ve es
 * `Failed to fetch dynamically imported module`, que no dice nada de lo que pasa
 * y manda a buscar el problema al lado del cliente.
 *
 * Pasa de verdad cada vez que se redespliega: el navegador que tiene el
 * `index.html` viejo en caché pide los `chunk-*.js` de la construcción anterior,
 * que ya no están. Con un 404 el fallo es legible; que además deje de ocurrir es
 * cosa de `no-cache` sobre el HTML, en `server.ts`.
 */
export function artefactosInexistentesDan404(): express.RequestHandler {
  return (req, res, next) => {
    if (esArtefactoDeConstruccion(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  };
}
