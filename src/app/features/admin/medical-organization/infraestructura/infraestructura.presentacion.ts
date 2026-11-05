import {
  armarArbol,
  VARIANTE_DE_ESTADO,
  type NodoArmado,
} from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  CareSpaceNode,
  ClinicalUnitNode,
  InfraConcept,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import type { TreeItem } from '../../../../shared/components/organisms/tree/tree.types';

/* ============================================================================
    Cómo se dice la infraestructura en pantalla. Un solo lugar para las rutas,
    los tonos y el armado de los árboles, que usan la consola y las fichas.
    ========================================================================== */

/** La consola, de la que cuelgan todas las pantallas de F1. */
export const RUTA_DE_CONSOLA = '/administration/medical-organization';

export const rutaDeEspacio = (id: string): string => `${RUTA_DE_CONSOLA}/spaces/${encodeURIComponent(id)}`;
export const rutaDeEdicion = (id: string): string => `${rutaDeEspacio(id)}/edit`;
export const RUTA_DE_ALTA = `${RUTA_DE_CONSOLA}/spaces/new`;
export const RUTA_DE_ALTA_MASIVA = `${RUTA_DE_CONSOLA}/spaces/bulk`;
export const RUTA_DE_IMPORTACION = `${RUTA_DE_CONSOLA}/spaces/import`;

/** Los parámetros de la consola para volver al mismo lugar del árbol. */
export function volverALaConsola(siteId: string | null, spaceId: string | null = null): Record<string, string> {
  return {
    tab: 'infrastructure',
    ...(siteId === null ? {} : { site: siteId }),
    ...(spaceId === null ? {} : { space: spaceId }),
  };
}

/** Variante del badge por **código**, nunca por etiqueta. Lo desconocido, `info`. */
export function varianteDe(concepto: InfraConcept | null | undefined): BadgeVariant {
  return (concepto && VARIANTE_DE_ESTADO[concepto.code]) ?? 'info';
}

/**
 * El árbol físico listo para `app-tree`.
 *
 * El estado sólo se marca cuando **no** es «activo»: con una marca verde en
 * cada fila, la que importa —la suspendida, la planificada— no se ve.
 */
export function arbolDeEspacios(espacios: readonly CareSpaceNode[], incluirRetirados = false): readonly TreeItem[] {
  const visibles = incluirRetirados ? espacios : espacios.filter((e) => e.status.code !== 'SPACE_RETIRED');
  const convertir = (nodo: NodoArmado<CareSpaceNode>): TreeItem => {
    const e = nodo.item;
    const marca =
      e.status.code !== 'SPACE_ACTIVE'
        ? { label: e.status.display, variant: varianteDe(e.status) }
        : e.operationalStatus !== null && e.operationalStatus.code !== 'SPACE_OP_AVAILABLE'
          ? { label: e.operationalStatus.display, variant: varianteDe(e.operationalStatus) }
          : undefined;
    return {
      id: e.id,
      label: e.name,
      description: `${e.code} · ${e.function.display}`,
      ...(marca === undefined ? {} : { badge: marca }),
      children: nodo.children.map(convertir),
    };
  };
  return armarArbol(visibles).map(convertir);
}

/** El árbol organizativo listo para `app-tree`. */
export function arbolDeUnidades(unidades: readonly ClinicalUnitNode[]): readonly TreeItem[] {
  const convertir = (nodo: NodoArmado<ClinicalUnitNode>): TreeItem => ({
    id: nodo.item.id,
    label: nodo.item.name,
    description: `${nodo.item.code} · ${nodo.item.type.display}`,
    ...(nodo.item.status.code !== 'UNIT_ACTIVE'
      ? { badge: { label: nodo.item.status.display, variant: varianteDe(nodo.item.status) } }
      : {}),
    children: nodo.children.map(convertir),
  });
  return armarArbol(unidades).map(convertir);
}

/** Camas activas del establecimiento: se **cuentan**, no se leen de un campo. */
export function camasActivas(espacios: readonly CareSpaceNode[]): number {
  return espacios.filter((e) => e.form.code === 'LOC_FORM_BED' && e.status.code === 'SPACE_ACTIVE').length;
}

/** Cuánto hace, en palabras, para S7 y para el «actualizado hace…». */
export function antiguedadEnPalabras(desde: Date, ahora: Date = new Date()): string {
  const minutos = Math.max(0, Math.round((ahora.getTime() - desde.getTime()) / 60_000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} día${dias === 1 ? '' : 's'}`;
}

/** A partir de cuántos minutos la estructura se muestra como atrasada (S7). */
export const MINUTOS_HASTA_ATRASADO = 10;
