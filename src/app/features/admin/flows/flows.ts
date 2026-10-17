import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FlowsClient } from '../../../core/data-access/admin-portal/flows.client';
import type { FlowCoverage, FlowSummary, FlowsPage } from '../../../core/data-access/admin-portal/flows.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { conceptStatus } from '../platform/platform-labels';

interface FilaFlujo {
  readonly id: string;
  readonly title: string;
  readonly module: string;
  readonly steps: string;
  readonly contract: string;
  readonly contractNote: string;
  readonly contractTone: 'success' | 'warning';
  readonly cases: string;
  readonly lastRunLabel: string;
  readonly lastRunTone: ReturnType<typeof conceptStatus>['tone'];
  readonly lastRunAt: Date | null;
}

const COBERTURA: readonly SelectOption<FlowCoverage | null>[] = [
  { value: null, label: 'Cualquier cobertura' },
  { value: 'SEEDED', label: 'Con suite en el QA Lab' },
  { value: 'NOT_SEEDED', label: 'Sin sembrar' },
  { value: 'RAN', label: 'Con alguna corrida' },
  { value: 'NEVER_RAN', label: 'Nunca corrido' },
];

/**
 * Catálogo de flujos: cada recorrido del usuario como un árbol de decisión.
 * Esta lista es el índice; el árbol, los endpoints y los casos están en el
 * detalle de cada flujo. Lo que la API calcula (contrato declarado o ausente,
 * cobertura de casos, último veredicto) se muestra tal cual.
 */
@Component({
  selector: 'app-flows',
  imports: [DatePipe, RouterLink, Badge, Select, Card, SearchField, DataTable, PageHeader, ViewStateHost],
  templateUrl: './flows.html',
  styleUrl: './flows.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Flows {
  private readonly flows = inject(FlowsClient);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly busqueda = signal('');
  protected readonly modulo = signal<string | null>(null);
  protected readonly cobertura = signal<FlowCoverage | null>(null);
  protected readonly opcionesCobertura = COBERTURA;

  private readonly pagina = signal<ViewState<FlowsPage>>(loading());
  private readonly modulos = signal<readonly string[]>([]);
  protected readonly opcionesModulo = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Todos los módulos' },
    ...this.modulos().map((m) => ({ value: m, label: m })),
  ]);

  private readonly celdaFlujo = viewChild<TemplateRef<{ $implicit: FilaFlujo }>>('flujoCell');
  private readonly celdaCorrida = viewChild<TemplateRef<{ $implicit: FilaFlujo }>>('corridaCell');
  private readonly celdaContrato = viewChild<TemplateRef<{ $implicit: FilaFlujo }>>('contratoCell');

  protected readonly filas = computed<ViewState<readonly FilaFlujo[]>>(() => {
    const estado = this.pagina();
    if (estado.status !== 'ready') return estado as ViewState<readonly FilaFlujo[]>;
    if (estado.data.items.length === 0) {
      return this.hayFiltros()
        ? empty({ label: 'Quite o cambie los filtros de arriba.' }, 'Ningún flujo coincide con los filtros elegidos.')
        : empty(
            { label: 'Los flujos son archivos de la API (qa_lab/flows/catalog); se agregan con un cambio de código.' },
            'No hay flujos declarados todavía.',
          );
    }
    return ready(estado.data.items.map((f) => this.fila(f)));
  });

  protected readonly columnas = computed<readonly ColumnDef<FilaFlujo>[]>(() => [
    { key: 'title', header: 'Flujo', priority: 1, cell: this.celdaFlujo() },
    { key: 'module', header: 'Módulo', priority: 3 },
    { key: 'steps', header: 'Pasos', priority: 3, align: 'end' },
    { key: 'contract', header: 'Contrato', priority: 1, cell: this.celdaContrato() },
    { key: 'cases', header: 'Casos sembrados', priority: 2, align: 'end' },
    { key: 'lastRunLabel', header: 'Última corrida', priority: 1, cell: this.celdaCorrida() },
  ]);
  protected readonly porId = (fila: FilaFlujo): string => fila.id;
  protected readonly nombreDeFila = (fila: FilaFlujo): string => `Flujo ${fila.id}: ${fila.title}`;

  constructor() {
    this.cargar();
  }

  protected hayFiltros(): boolean {
    return Boolean(this.busqueda() || this.modulo() || this.cobertura());
  }

  protected cargar(): void {
    this.pagina.set(loading());
    this.flows
      .list({
        ...(this.busqueda() ? { search: this.busqueda() } : {}),
        ...(this.modulo() ? { module: this.modulo()! } : {}),
        ...(this.cobertura() ? { coverage: this.cobertura()! } : {}),
      })
      .subscribe({
        next: (p) => {
          // Los módulos disponibles no deben achicarse al filtrar por uno.
          if (this.modulos().length === 0 || !this.modulo()) this.modulos.set(p.modules);
          this.pagina.set(ready(p));
        },
        error: (e: unknown) => this.pagina.set(errorToViewState<FlowsPage>(e)),
      });
  }

  protected cambiarModulo(valor: string | null): void {
    this.modulo.set(valor);
    this.cargar();
  }

  protected cambiarCobertura(valor: FlowCoverage | null): void {
    this.cobertura.set(valor);
    this.cargar();
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.modulo.set(null);
    this.cobertura.set(null);
    this.cargar();
  }

  protected abrir(fila: FilaFlujo): void {
    void this.router.navigate(['/superadmin/flows', fila.id]);
  }

  private fila(f: FlowSummary): FilaFlujo {
    const corrida = f.qa.lastRun;
    const estado = corrida ? conceptStatus(corrida.status) : null;
    const sinContrato = f.contract.missing > 0 || f.contract.gaps > 0;
    return {
      id: f.id,
      title: f.title,
      module: f.module,
      steps: String(f.counts.nodes),
      contract: `${f.contract.declared} de ${f.contract.endpoints} en el contrato`,
      contractNote: [
        f.contract.missing > 0 ? `${f.contract.missing} ausentes` : '',
        f.contract.gaps > 0 ? `${f.contract.gaps} pasos sin endpoint` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      contractTone: sinContrato ? 'warning' : 'success',
      cases: f.qa.seeded ? `${f.qa.casesLinked} de ${f.qa.casesExpected}` : 'Sin sembrar',
      lastRunLabel: estado ? estado.label : f.qa.seeded ? 'Sin correr' : '—',
      lastRunTone: estado ? estado.tone : 'secondary',
      lastRunAt: corrida?.finishedAt ? new Date(corrida.finishedAt) : null,
    };
  }
}
