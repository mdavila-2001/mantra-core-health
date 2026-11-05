import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { LocationNode } from '../../../core/data-access/support-access/support-access.types';
import { flattenLocationTree } from './agenda-filters';
import { AgendaMiniCalendar } from './agenda-mini-calendar';
import { colorOfDoctor, orgToneColors, type AgendaDoctor, type AgendaOrg } from './agenda-model';

export const ALL_SERVICES = '';

/**
 * El costado de la agenda: calendario chico, **Mis doctores** con casillas de
 * color (como los calendarios de Google), ubicaciones en árbol (piso → sala),
 * servicio y los dos interruptores de horarios. No guarda nada: cada gesto se
 * avisa hacia arriba y el estado vive en la URL.
 */
@Component({
  selector: 'app-agenda-sidebar',
  imports: [AgendaMiniCalendar, Select],
  templateUrl: './agenda-sidebar.html',
  styleUrl: './agenda-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaSidebar {
  readonly date = input.required<Date>();
  readonly today = input.required<Date>();
  readonly orgs = input.required<readonly AgendaOrg[]>();
  readonly orgValue = input<string | null>(null);
  readonly orgOptions = input.required<readonly SelectOption<string>[]>();
  readonly doctors = input.required<readonly AgendaDoctor[]>();
  readonly hidden = input.required<ReadonlySet<string>>();
  readonly locations = input.required<readonly LocationNode[]>();
  readonly locationId = input<string | null>(null);
  readonly serviceOptions = input.required<readonly SelectOption<string>[]>();
  readonly serviceId = input<string | null>(null);
  readonly showDenied = input(true);
  readonly showFree = input(true);
  readonly multiOrg = input(false);

  readonly dateChange = output<Date>();
  readonly orgChange = output<string | null>();
  readonly doctorToggle = output<string>();
  readonly allDoctors = output<boolean>();
  readonly locationChange = output<string | null>();
  readonly serviceChange = output<string | null>();
  readonly showDeniedChange = output<boolean>();
  readonly showFreeChange = output<boolean>();

  /** Qué nodos del árbol están abiertos. `null` = los de los tres primeros niveles (sede, edificio y piso): se ven hasta las salas. */
  private readonly opened = signal<ReadonlySet<string> | null>(null);

  protected readonly allOn = computed(() => this.hidden().size === 0);
  protected readonly noneOn = computed(() => this.doctors().length > 0 && this.doctors().every((d) => this.hidden().has(d.id)));
  protected readonly onCount = computed(() => this.doctors().filter((d) => !this.hidden().has(d.id)).length);

  protected readonly doctorGroups = computed(() => {
    const doctores = this.doctors();
    if (!this.multiOrg()) return [{ org: null as AgendaOrg | null, doctors: doctores }];
    return this.orgs()
      .map((org) => ({ org: org as AgendaOrg | null, doctors: doctores.filter((d) => d.orgId === org.id) }))
      .filter((g) => g.doctors.length > 0);
  });

  protected readonly treeRows = computed(() => {
    const todos = flattenLocationTree(this.locations());
    const abiertos = this.opened() ?? new Set(todos.filter((r) => r.depth < 3).map((r) => r.node.id));
    // La ubicación elegida deja abiertos a todos sus ancestros: no se pierde detrás de un nodo cerrado.
    const porId = new Map(this.locations().map((n) => [n.id, n]));
    const forzados = new Set<string>();
    let actual = this.locationId() === null ? undefined : porId.get(this.locationId()!);
    while (actual !== undefined && actual.parentId !== null) {
      forzados.add(actual.parentId);
      actual = porId.get(actual.parentId);
    }
    const cerrados = new Set(todos.filter((r) => r.hasChildren && !abiertos.has(r.node.id) && !forzados.has(r.node.id)).map((r) => r.node.id));
    return flattenLocationTree(this.locations(), cerrados).map((r) => ({ ...r, open: !cerrados.has(r.node.id) }));
  });

  protected color(doctorId: string): { readonly bg: string; readonly border: string } {
    return colorOfDoctor(this.doctors(), doctorId);
  }

  protected orgColors(org: AgendaOrg): { readonly bg: string; readonly fg: string } {
    return orgToneColors(org.tone);
  }

  protected toggleNode(id: string, currentlyOpen: boolean): void {
    const base = this.opened() ?? new Set(flattenLocationTree(this.locations()).filter((r) => r.depth < 3).map((r) => r.node.id));
    const nuevo = new Set(base);
    if (currentlyOpen) nuevo.delete(id);
    else nuevo.add(id);
    this.opened.set(nuevo);
  }

  protected kindLabel(node: LocationNode): string {
    return { SITE: 'Sede', BUILDING: 'Edificio', LEVEL: 'Piso', WING: 'Ala', CONSULTING_ROOM: 'Consultorio', OPERATING_ROOM: 'Quirófano', PROCEDURE_ROOM: 'Sala', BED: 'Cama' }[node.kind];
  }

  protected value(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
