/**
 * Regenera la lista de rutas del carril 34 (auditoría global de la regla visual)
 * a partir del mapa de navegación.
 *
 * Se toman las secciones **sin parámetro** en la ruta: una ruta con `:id` necesita
 * un identificador real para cargar, y una foto de un «no encontrado» no prueba
 * nada sobre el fondo ni sobre el ancho. Las que hagan falta se agregan a mano al
 * JSON, con un id del backend simulado.
 *
 *   node scripts/corr-rutas.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MAPA = 'src/app/core/navigation/navigation.map.ts';
const DESTINO = 'playwright/corr-rutas.json';

const fuente = readFileSync(MAPA, 'utf8');
const secciones = [...fuente.matchAll(/path:\s*'([^']+)'[\s\S]{0,400}?label:\s*'([^']+)'/g)];

const vistas = new Set();
const rutas = [];
for (const [, ruta] of secciones) {
  if (ruta.includes(':') || vistas.has(ruta)) continue;
  vistas.add(ruta);
  rutas.push({ ruta: `/${ruta}`, nombre: ruta.replace(/[/?=&]+/g, '_') || 'inicio' });
}

const catalogo = JSON.parse(readFileSync(DESTINO, 'utf8'));
catalogo['34'] = rutas;
writeFileSync(DESTINO, `${JSON.stringify(catalogo, null, 2)}\n`);
console.log(`Carril 34: ${rutas.length} rutas escritas en ${DESTINO}`);
