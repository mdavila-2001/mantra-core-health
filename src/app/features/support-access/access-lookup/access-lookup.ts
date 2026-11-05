import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { AccessLookupEntry, AccessLookupQuery, SupportCatalog } from '../../../core/data-access/support-access/support-access.types';
import { describeActions } from '../../../core/data-access/support-access/support-summary';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { templateLabel } from '../support-labels';

type Tipo = AccessLookupQuery['kind'];

const TIPOS: readonly SegmentedOption<Tipo>[] = [
  { value: 'doctor', label: 'Un doctor' },
  { value: 'service', label: 'Un servicio' },
  { value: 'location', label: 'Un piso o lugar' },
];

/**
 * **Quién tiene acceso**: se elige un doctor, un servicio o una ubicación y se
 * lista quién puede actuar sobre ella, con lo que puede hacer.
 *
 * Responde la pregunta inversa a la del editor de permisos («¿qué cubre esta
 * persona?»): «¿quién cubre esto?». El cálculo es de la API; acá solo se lista.
 */
@Component({
  selector: 'app-access-lookup',
  imports: [Badge, Card, FormField, PageHeader, SegmentedControl, Select, ViewStateHost],
  templateUrl: './access-lookup.html',
  styleUrl: './access-lookup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessLookup implements OnInit {
  private readonly client = inject(SupportAccessClient);

  protected readonly tipos = TIPOS;
  protected readonly tipo = signal<Tipo>('doctor');
  protected readonly catalogo = signal<SupportCatalog | null>(null);
  protected readonly elegido = signal<string | null>(null);
  protected readonly resultado = signal<ViewState<readonly AccessLookupEntry[]>>(
    empty({ label: 'Elija un doctor, un servicio o un lugar' }, 'Todavía no consultó nada.'),
  );
  protected readonly errorDeCatalogo = signal<string | null>(null);

  protected readonly opciones = computed<readonly SelectOption<string>[]>(() => {
    const c = this.catalogo();
    if (c === null) return [];
    switch (this.tipo()) {
      case 'doctor':
        return c.doctors.map((d) => ({ value: d.id, label: `${d.name} · ${d.specialty}` }));
      case 'service':
        return c.services.map((s) => ({ value: s.id, label: s.name }));
      case 'location':
        return c.locations.map((n) => ({ value: n.id, label: this.camino(c, n.id) }));
    }
  });

  protected readonly rotulo = computed(() => {
    switch (this.tipo()) {
      case 'doctor':
        return 'Doctor';
      case 'service':
        return 'Servicio';
      case 'location':
        return 'Ubicación';
    }
  });

  ngOnInit(): void {
    this.client.getCatalog().subscribe({
      next: (c) => this.catalogo.set(c),
      error: () => this.errorDeCatalogo.set('No pudimos cargar los doctores, servicios y ubicaciones.'),
    });
  }

  protected cambiarTipo(tipo: Tipo): void {
    this.tipo.set(tipo);
    this.elegido.set(null);
    this.resultado.set(empty({ label: 'Elija un doctor, un servicio o un lugar' }, 'Todavía no consultó nada.'));
  }

  protected elegir(id: string | null): void {
    this.elegido.set(id);
    if (id === null) return;
    this.resultado.set(loading());
    this.client.lookupAccess({ kind: this.tipo(), id }).subscribe({
      next: ({ items }) =>
        this.resultado.set(
          items.length === 0
            ? empty({ label: 'Pruebe con otro objetivo' }, 'Nadie del personal de apoyo puede actuar sobre esto.')
            : ready(items),
        ),
      error: (failure: unknown) => this.resultado.set(errorToViewState<readonly AccessLookupEntry[]>(failure)),
    });
  }

  protected rol = (e: AccessLookupEntry): string => templateLabel(e.roleTemplate);
  protected acciones = (e: AccessLookupEntry): string => describeActions(e.actions);

  protected filas(): readonly AccessLookupEntry[] {
    const r = this.resultado();
    return r.status === 'ready' ? r.data : [];
  }

  private camino(c: SupportCatalog, id: string): string {
    const partes: string[] = [];
    let actual = c.locations.find((n) => n.id === id);
    while (actual !== undefined) {
      partes.unshift(actual.name);
      const padre: string | null = actual.parentId;
      actual = padre === null ? undefined : c.locations.find((n) => n.id === padre);
    }
    return partes.join(' › ');
  }
}
