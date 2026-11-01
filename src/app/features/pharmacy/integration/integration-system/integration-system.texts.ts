import type { ExternalSystemFormat } from '../../../../core/data-access/pharmacy/pharmacy-integration.types';

/*
 * Los textos de la sección «Sistema de la farmacia» (FAR-C9 · C9-4), aparte
 * del componente para que quede por debajo de las 300 líneas (MAX_300_LINES).
 */

/** Cómo se nombra cada formato en la pestaña. */
export const FORMAT_LABEL: Readonly<Record<ExternalSystemFormat, string>> = {
  ALOVIDA_STANDARD: 'Estándar ALOVIDA',
  SIMULATED_CHAIN: 'Cadena simulada (pruebas)',
};

/** Qué tiene que escribir la farmacia en «Dirección», según el formato. */
export const FORMAT_HINT: Readonly<Record<ExternalSystemFormat, string>> = {
  ALOVIDA_STANDARD:
    'La dirección base que publica su sistema según el Estándar ALOVIDA, por ejemplo https://api.sufarmacia.bo/alovida-standard.',
  SIMULATED_CHAIN: 'La dirección del simulador de cadena, por ejemplo http://simulador:4100/simulated-chain/api/v2.',
};

/** Lo que se ve del lado del sistema si la farmacia no cargó el suyo. */
export const SERVER_SYSTEM_TEXT =
  'Esta conexión usa hoy el sistema que configura la plataforma. Cargue el de su farmacia para sincronizar con sus propias existencias.';

/**
 * El sistema no respondió al guardar. No es el texto de la sincronización
 * («pruebe en unos minutos»): al configurar, lo más probable es que la
 * dirección, el código o la clave no sean los de su sistema.
 */
export const SAVE_UNAVAILABLE_TEXT =
  'Su sistema no respondió con esa dirección, ese código y esa clave. Revíselos y vuelva a probar: no se guardó nada.';

/** «Probar conexión» respondió bien. */
export const PROBE_OK_TEXT = 'El sistema de la farmacia respondió y aceptó la clave.';

/** Sin sistema propio ni del servidor: no hay con quién sincronizar (el aviso de arriba ya lo dice). */
export const NO_SYSTEM_TEXT = 'Cargue el sistema de su farmacia para poder sincronizar.';

/** Avisos de la sección: el de guardar y el de quitar se reemplazan entre sí (#1866). */
export const TOAST_KEY = 'farmacia.sistema';
export const SAVED_TEXT = 'El sistema de la farmacia respondió y quedó guardado.';
export const REMOVED_TEXT = 'Quitó el sistema de la farmacia.';
