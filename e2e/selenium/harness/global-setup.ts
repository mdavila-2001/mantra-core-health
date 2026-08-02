import { configuracion, verificarEntornoSeguro } from '../config/environment';
import { esperarSalud, levantarArnes, type ArnesEnMarcha } from './servidor';

/**
 * Preparación global de la suite: corre una vez, antes de la primera prueba.
 *
 * Levanta el arnés en el proceso principal de Vitest. Los trabajadores no
 * comparten memoria con él, así que **no** se les pasa nada por variable: la
 * dirección es determinista (`E2E_PORT`, 4175 por defecto) y cada trabajador la
 * reconstruye desde la misma configuración. Eso evita el problema clásico de
 * propagar un puerto efímero a procesos que ya arrancaron.
 *
 * Con `E2E_BASE_URL` puesta no se levanta nada: la suite apunta a un servidor
 * de otro y solo comprueba que responda antes de empezar.
 */

let arnes: ArnesEnMarcha | null = null;

export async function setup(): Promise<void> {
  const config = configuracion();
  verificarEntornoSeguro(config);

  if (!config.levantarServidor) {
    console.log(`[e2e] Servidor externo: ${config.baseUrl}`);
    // Un servidor ajeno no tiene la ruta de salud del arnés: alcanza con que
    // conteste la raíz.
    await esperarSalud(config.baseUrl, '/');
    return;
  }

  arnes = await levantarArnes();
}

export async function teardown(): Promise<void> {
  if (arnes === null) {
    return;
  }
  await arnes.detener();
  arnes = null;
  console.log('[e2e] Arnés detenido.');
}
