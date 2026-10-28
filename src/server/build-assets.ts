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
 * El nombre que esbuild le pone a lo que compila: `main-YHR6MAGL.js`,
 * `chunk-…`, `styles-…`. Ocho mayúsculas o dígitos que cambian con el contenido.
 */
const HUELLA_DE_CONTENIDO = /-[A-Z0-9]{8}\.(?:m?js|css)$/;

export function tieneHuellaDeContenido(ruta: string): boolean {
  return HUELLA_DE_CONTENIDO.test(ruta);
}

/**
 * Cuánto puede guardar el navegador cada archivo estático.
 *
 * Con huella, un año: si el contenido cambia, cambia el nombre. Sin huella
 * —`paciente.css`, que se compila aparte y Angular no la firma, y todo lo de
 * `public/`: el logo, las imágenes, las tipografías—, `no-cache`: el navegador
 * la guarda pero pregunta antes de usarla, y con el ETag la respuesta es un
 * 304 sin cuerpo.
 *
 * Antes eran un año para todo. Quien abrió la maqueta con la primera versión
 * de `paciente.css` siguió viendo, después de dos despliegues, el trazo de
 * electro que la segunda había quitado.
 */
export function cachePorHuella(res: express.Response, ruta: string): void {
  if (!tieneHuellaDeContenido(ruta)) {
    res.setHeader('Cache-Control', 'no-cache');
  }
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
