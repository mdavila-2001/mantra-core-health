import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { APP_TITLE } from '../core/navigation/navigation.types';
import { seccionRolesGuard } from '../core/navigation/section-roles.guard';
import { chunkFallido } from './chunk-fallido';

/**
 * Pantalla de operación de una sección sin listados: una acción de la sección,
 * no una entrada de menú.
 */
export function pantallaDeOperacion(
  seccion: string,
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return {
    path: `${seccion}/${subpath}`,
    title: `${APP_TITLE} - ${titulo}`,
    canActivate: [seccionRolesGuard],
    loadComponent: () => loader().catch(() => chunkFallido()),
  };
}

/** Fija la sección de pantallaDeOperacion para no repetir el envoltorio por sección. */
export const pantallaDeSeccion =
  (seccion: string) =>
  (subpath: string, titulo: string, loader: () => Promise<Type<unknown>>): Routes[number] =>
    pantallaDeOperacion(seccion, subpath, titulo, loader);

export const pantallaDeAccesoDelegado = pantallaDeSeccion('administration/delegated-access');
export const pantallaDeEquipoDeApoyo = pantallaDeSeccion('administration/support-team');
export const pantallaDeMiEquipo = pantallaDeSeccion('my-team');
export const pantallaDeMisAccesos = pantallaDeSeccion('my-support');
export const pantallaDeProveedoresDeIdentidad = pantallaDeSeccion('administration/identity-providers');
export const pantallaDeVerificacionIdentidad = pantallaDeSeccion('administration/identity-assurance');
export const pantallaDeContextoSanitario = pantallaDeSeccion('administration/health-context');

export function pantallaDeGeolocalizacion(
  subpath: string,
  titulo: string,
  loader: () => Promise<Type<unknown>>,
): Routes[number] {
  return pantallaDeOperacion('administration/geolocation', subpath, titulo, loader);
}
