/**
 * Mosaicos del servidor comunitario de OpenStreetMap, sin clave de API.
 *
 * **Por qué ya no son los de CARTO** (19/09/2026): CARTO dejó de servir sus
 * basemaps de forma anónima y ahora estampa «API KEY REQUIRED ·
 * carto.com/basemaps/apikey» **en diagonal sobre cada mosaico**. No es un
 * fallo de carga que se vea en la consola: el mosaico llega con 200 y con la
 * marca de agua pintada encima, así que TODOS los mapas del producto —el de
 * los directorios, «Dónde comprar», las sedes del perfil— se veían rotos y
 * nada lo delataba salvo mirarlos. Medido pidiendo el mismo mosaico de Santa
 * Cruz a los dos proveedores: CARTO 26 441 B con la marca, OSM 34 984 B
 * limpio.
 *
 * El comentario que estaba acá decía que OSM «bloquea las solicitudes de esta
 * aplicación por su política de uso». No se sostiene: el mismo mosaico, con el
 * agente y el referente del navegador, responde 200 y se lee. La política de
 * OSM pide atribución visible y uso moderado —las dos se cumplen—, y es
 * además la decisión ya escrita del proyecto: Leaflet + OpenStreetMap sin
 * clave, que es lo que la CSP del servidor permitía antes de que alguien la
 * abriera a CARTO.
 *
 * Un solo host: el servidor de OSM ya no reparte por subdominios `a`/`b`/`c`,
 * así que la plantilla no lleva `{s}` ni la capa `subdomains`.
 */
export const DEMO_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** La atribución de OSM es condición de uso, no un adorno. */
export const DEMO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
