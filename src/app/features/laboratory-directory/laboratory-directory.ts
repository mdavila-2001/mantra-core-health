import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { DiagnosticUnitsClient } from '../../core/data-access/diagnostic-units/diagnostic-units.client';
import type { DiagnosticUnitDirectoryItem } from '../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { SearchResult } from '../../shared/components/molecules/search-result/search-result';
import type { SearchResultItem } from '../../shared/components/molecules/search-result/search-result.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

export interface LaboratoryCategoryGroup {
  readonly code: string;
  readonly name: string;
  readonly units: readonly SearchResultItem[];
}

/** Directorio del módulo 23; no comparte datos ni función con `/diagnostics`. */
@Component({
  selector: 'app-laboratory-directory',
  imports: [PageHeader, SearchResult, ViewStateHost],
  templateUrl: './laboratory-directory.html',
  styleUrl: './laboratory-directory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryDirectory {
  private readonly units = inject(DiagnosticUnitsClient);

  protected readonly state = signal<ViewState<readonly LaboratoryCategoryGroup[]>>(loading());
  protected readonly groups = computed(() => dataOf(this.state()) ?? []);

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.state.set(loading());
    this.units.list().subscribe({
      next: (directory) => {
        this.state.set(
          directory.items.length === 0
            ? empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'Todavía no hay unidades verificadas para esta organización.',
              )
            : ready(groupUnits(directory.items)),
        );
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<readonly LaboratoryCategoryGroup[]>(error)),
    });
  }
}

export function groupUnits(
  units: readonly DiagnosticUnitDirectoryItem[],
): readonly LaboratoryCategoryGroup[] {
  const groups = new Map<string, DiagnosticUnitDirectoryItem[]>();
  for (const unit of units) {
    const current = groups.get(unit.type.code) ?? [];
    current.push(unit);
    groups.set(unit.type.code, current);
  }
  return [...groups.entries()]
    .map(([code, rows]) => ({
      code,
      name: categoryName(code, rows[0]?.type.display ?? 'Otra categoría'),
      units: rows.map(toSearchResult).sort((a, b) => a.title.localeCompare(b.title, 'es')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function categoryName(code: string, fallback: string): string {
  if (code === 'DU_TYPE_LAB') return 'Laboratorio clínico';
  if (code === 'DU_TYPE_IMAGING') return 'Imagenología diagnóstica';
  return fallback;
}

function toSearchResult(unit: DiagnosticUnitDirectoryItem): SearchResultItem {
  const seals = [];
  if (unit.walkInAvailable) seals.push({ label: 'Atención sin cita', tone: 'ok' as const });
  if (unit.homeCollectionAvailable) {
    seals.push({ label: 'Toma a domicilio', tone: 'info' as const });
  }
  if (unit.acceptsExternalOrders) {
    seals.push({ label: 'Recibe órdenes externas', tone: 'neutro' as const });
  }
  return {
    id: unit.id,
    title: unit.name,
    link: `/laboratory-directory/${unit.id}`,
    figureText: initials(unit.name),
    kind: { label: categoryName(unit.type.code, unit.type.display), tone: 'info' },
    meta: [
      { text: `Código ${unit.code}` },
      { text: `${unit.siteCount} ${unit.siteCount === 1 ? 'sede' : 'sedes'}` },
      { text: `${unit.studyCount} ${unit.studyCount === 1 ? 'estudio' : 'estudios'}` },
      { text: `${unit.equipmentCount} ${unit.equipmentCount === 1 ? 'equipo' : 'equipos'}` },
    ],
    seals,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
