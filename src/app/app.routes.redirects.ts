import type { Routes } from '@angular/router';

/** Las landings públicas, que son las que viajan en los correos. */
export const RUTAS_HEREDADAS_PUBLICAS: Readonly<Record<string, string>> = {
  'auth/organizacion': '/auth/organization',
  'auth/registro': '/auth/register',
  'auth/register-organization': '/auth/register/organization',
  'auth/verificar': '/auth/verify-email',
  'auth/recuperar': '/auth/forgot-password',
  'auth/nueva-clave': '/auth/reset-password',
  'auth/activar': '/auth/activate',
  'auth/reenviar-verificacion': '/auth/resend-verification',
};

/**
 * La superficie de búsqueda pública, renombrada a inglés por TAREA-29.
 * Cada redirect nombra su ruta exacta con pathMatch: 'full'.
 */
export const RUTAS_HEREDADAS_DEL_BUSCADOR: Readonly<Record<string, string>> = {
  publicaciones: '/posts',
  'buscar/profesionales': '/search/practitioners',
  'buscar/medicamentos': '/search/medications',
  'buscar/hospitales': '/search/hospitals',
  'buscar/diagnostico': '/search/diagnostics',
  'buscar/aseguradoras': '/search/insurers',
  'buscar/sintomas': '/search/symptoms',
  'buscar/mapa': '/search/map',
};

/**
 * Genera rutas de redirección con pathMatch: 'full' para preservar parámetros.
 */
export function rutasHeredadas(mapa: Readonly<Record<string, string>>): Routes {
  return Object.entries(mapa).map(([vieja, nueva]) => ({
    path: vieja,
    pathMatch: 'full' as const,
    redirectTo: nueva,
  }));
}
