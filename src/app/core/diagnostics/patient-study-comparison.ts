import { Injectable, computed, signal } from '@angular/core';

import type {
  DiagnosticStudy,
  DiagnosticUnitSearchItem,
  DiagnosticUnitSite,
} from '../data-access/diagnostic-units/diagnostic-units.types';

/** Datos mínimos del pedido para conservarlo durante la navegación del paciente. */
export interface RequestedPatientStudy {
  readonly code: string | null;
  readonly name: string;
  readonly preparationInstructions: string | null;
}

export type PatientStudyCoverageStatus =
  | 'published-at-site'
  | 'site-unavailable'
  | 'not-in-catalog'
  | 'code-unavailable';

export interface PatientStudyCoverageItem {
  readonly name: string;
  readonly status: PatientStudyCoverageStatus;
  readonly siteNames: readonly string[];
}

export interface PatientStudyComparisonResult {
  readonly status: 'complete-at-one-site' | 'different-sites' | 'needs-confirmation';
  readonly sharedSiteNames: readonly string[];
  readonly studies: readonly PatientStudyCoverageItem[];
}

/**
 * Estado temporal del paquete pedido mientras el paciente navega el directorio.
 * No se persiste en URL, almacenamiento local ni backend.
 */
@Injectable({ providedIn: 'root' })
export class PatientStudyComparisonContext {
  private readonly selection = signal<readonly RequestedPatientStudy[]>([]);

  readonly studies = this.selection.asReadonly();
  readonly active = computed(() => this.selection().length > 0);
  readonly canSearchCompletePackage = computed(
    () => this.active() && this.selection().every((study) => study.code !== null),
  );

  start(studies: readonly RequestedPatientStudy[]): void {
    this.selection.set(studies.map((study) => ({ ...study })));
  }

  clear(): void {
    this.selection.set([]);
  }
}

/**
 * Compara códigos de la orden con el catálogo publicado por una unidad.
 * Una coincidencia sólo se acredita como completa cuando todos los códigos
 * comparten un `siteId` presente en la respuesta de sedes.
 */
export function comparePatientStudiesWithCatalog(
  requested: readonly RequestedPatientStudy[],
  catalog: readonly DiagnosticStudy[],
  sites: readonly DiagnosticUnitSite[],
): PatientStudyComparisonResult {
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const studies = requested.map((request): PatientStudyCoverageItem => {
    if (request.code === null || request.code === '') {
      return { name: request.name, status: 'code-unavailable', siteNames: [] };
    }

    const matches = catalog.filter((study) => study.code === request.code);
    if (matches.length === 0) {
      return { name: request.name, status: 'not-in-catalog', siteNames: [] };
    }

    const names = [...new Set(
      matches
        .map((study) => (study.siteId === null ? undefined : siteNames.get(study.siteId)))
        .filter((name): name is string => name !== undefined && name !== ''),
    )];
    return names.length > 0
      ? { name: request.name, status: 'published-at-site', siteNames: names }
      : { name: request.name, status: 'site-unavailable', siteNames: [] };
  });

  const uniqueCodes = [...new Set(requested.map((study) => study.code).filter(
    (code): code is string => code !== null && code !== '',
  ))];
  const requiredSiteSets = uniqueCodes.map((code) => new Set(
    catalog
      .filter((study) => study.code === code && study.siteId !== null && siteNames.has(study.siteId))
      .map((study) => study.siteId as string),
  ));
  const commonSiteIds = requiredSiteSets.length === uniqueCodes.length && requiredSiteSets.length > 0
    ? [...requiredSiteSets[0]!].filter((siteId) => requiredSiteSets.every((set) => set.has(siteId)))
    : [];
  const sharedSiteNames = commonSiteIds
    .map((siteId) => siteNames.get(siteId))
    .filter((name): name is string => name !== undefined && name !== '');
  const allCodesKnown =
    requested.length > 0 && requested.every((study) => study.code !== null && study.code !== '');
  let status: PatientStudyComparisonResult['status'];
  if (allCodesKnown && sharedSiteNames.length > 0) {
    status = 'complete-at-one-site';
  } else if (allCodesKnown && studies.every((study) => study.status === 'published-at-site')) {
    status = 'different-sites';
  } else {
    status = 'needs-confirmation';
  }

  return { status, sharedSiteNames, studies };
}

/** Interseca resultados de búsquedas separadas por `studyCode`, preservando el orden inicial. */
export function intersectStudySearchResults(
  resultSets: readonly (readonly DiagnosticUnitSearchItem[])[],
): readonly DiagnosticUnitSearchItem[] {
  if (resultSets.length === 0) return [];

  const otherIds = resultSets.slice(1).map((items) => new Set(items.map((item) => item.id)));
  return resultSets[0]!.filter((item) => otherIds.every((ids) => ids.has(item.id)));
}
