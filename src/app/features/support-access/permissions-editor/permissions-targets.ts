import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

import type {
  ExpansionMode,
  LocationNode,
  SupportActionCode,
  SupportCatalog,
  SupportScopeTarget,
} from '../../../core/data-access/support-access/support-access.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { EditorGrant } from './editor-grant';
import {
  addTargets,
  buildLocationTree,
  hasTarget,
  levelNoun,
  locationTarget,
  removeTargets,
  selectionOf,
  selectLevel,
  toggleTarget,
  type LocationSelection,
  type LocationTreeNode,
} from './permissions-draft';

type TipoDeCombinacion = 'PRACTITIONER_SERVICE' | 'PRACTITIONER_LOCATION' | 'SERVICE_LOCATION';

const COMBINACIONES: readonly SegmentedOption<TipoDeCombinacion>[] = [
  { value: 'PRACTITIONER_SERVICE', label: 'Doctor × servicio' },
  { value: 'PRACTITIONER_LOCATION', label: 'Doctor × ubicación' },
  { value: 'SERVICE_LOCATION', label: 'Servicio × ubicación' },
];

/**
 * Lo que el editor sabe hacer con los **objetivos** de los permisos (por doctor, por servicio, por ubicación y las
 * combinaciones): marcarlos, quitarlos y mostrarlos. Vive aparte de `PermissionsEditor` para no pasar del tope de
 * líneas; la pantalla lo hereda y le da el borrador, el catálogo y el paquete del rol.
 */
export abstract class PermissionsTargets {
  protected abstract readonly borrador: WritableSignal<readonly EditorGrant[]>;
  protected abstract readonly catalogo: Signal<SupportCatalog | null>;
  /** Lo que el rol da por defecto: lo que se marca al elegir un objetivo nuevo. */
  protected abstract readonly paquete: Signal<readonly SupportActionCode[]>;
  protected abstract cambiar(nuevo: readonly EditorGrant[]): void;

  /** «Incluir automáticamente lo nuevo»: el modo de las filas de ubicación que se agreguen. */
  protected readonly automatico = signal(true);
  protected readonly abiertos = signal<ReadonlySet<string>>(new Set());
  protected readonly tipoDeCombinacion = signal<TipoDeCombinacion>('PRACTITIONER_SERVICE');
  protected readonly comboDoctor = signal<string | null>(null);
  protected readonly comboServicio = signal<string | null>(null);
  protected readonly comboUbicacion = signal<string | null>(null);

  protected readonly combinaciones = COMBINACIONES;
  protected readonly modo = computed<ExpansionMode>(() =>
    this.automatico() ? 'DYNAMIC' : 'FIXED',
  );

  protected readonly arbol = computed<readonly LocationTreeNode[]>(() =>
    buildLocationTree(this.catalogo()?.locations ?? []),
  );
  protected readonly opcionesDeDoctor = computed<readonly SelectOption<string>[]>(() =>
    (this.catalogo()?.doctors ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} · ${d.specialty}`,
    })),
  );
  protected readonly opcionesDeServicio = computed<readonly SelectOption<string>[]>(() =>
    (this.catalogo()?.services ?? []).map((s) => ({ value: s.id, label: s.name })),
  );
  protected readonly opcionesDeUbicacion = computed<readonly SelectOption<string>[]>(() =>
    (this.catalogo()?.locations ?? []).map((n) => ({ value: n.id, label: this.rutaLegible(n) })),
  );

  /** Las filas que son un cruce, para la pestaña «Combinaciones». */
  protected readonly cruces = computed(() =>
    this.borrador().filter(
      (f) =>
        f.targetKind === 'PRACTITIONER_SERVICE' ||
        f.targetKind === 'PRACTITIONER_LOCATION' ||
        f.targetKind === 'SERVICE_LOCATION',
    ),
  );
  protected readonly comboCompleto = computed(() => {
    switch (this.tipoDeCombinacion()) {
      case 'PRACTITIONER_SERVICE':
        return this.comboDoctor() !== null && this.comboServicio() !== null;
      case 'PRACTITIONER_LOCATION':
        return this.comboDoctor() !== null && this.comboUbicacion() !== null;
      case 'SERVICE_LOCATION':
        return this.comboServicio() !== null && this.comboUbicacion() !== null;
    }
  });

  /** «Edificio A › Piso 1 › Consultorio 101»: el camino completo, para elegir sin confundirse. */
  private rutaLegible(nodo: LocationNode): string {
    const todos = this.catalogo()?.locations ?? [];
    const camino: string[] = [];
    let actual: LocationNode | undefined = nodo;
    while (actual !== undefined) {
      camino.unshift(actual.name);
      const padre: string | null = actual.parentId;
      actual = padre === null ? undefined : todos.find((n) => n.id === padre);
    }
    return camino.join(' › ');
  }

  /* ---- por doctor y por servicio ------------------------------------------ */

  protected eligeDoctor(id: string): boolean {
    return hasTarget(this.borrador(), {
      targetKind: 'PRACTITIONER',
      practitionerRoleAssignmentId: id,
    });
  }
  protected todosLosDoctores(): boolean {
    return hasTarget(this.borrador(), { targetKind: 'ALL_PRACTITIONERS' });
  }
  protected alternarDoctor(id: string): void {
    this.cambiar(
      toggleTarget(
        this.borrador(),
        { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: id },
        this.paquete(),
        'DYNAMIC',
      ),
    );
  }
  protected alternarTodosLosDoctores(): void {
    this.cambiar(
      toggleTarget(this.borrador(), { targetKind: 'ALL_PRACTITIONERS' }, this.paquete(), 'DYNAMIC'),
    );
  }
  protected seleccionarTodosLosDoctores(): void {
    const objetivos = (this.catalogo()?.doctors ?? []).map((d): SupportScopeTarget => ({
      targetKind: 'PRACTITIONER',
      practitionerRoleAssignmentId: d.id,
    }));
    this.cambiar(addTargets(this.borrador(), objetivos, this.paquete(), 'FIXED'));
  }

  protected eligeServicio(id: string): boolean {
    return hasTarget(this.borrador(), { targetKind: 'SERVICE', healthcareServiceId: id });
  }
  protected todosLosServicios(): boolean {
    return hasTarget(this.borrador(), { targetKind: 'ALL_SERVICES' });
  }
  protected alternarServicio(id: string): void {
    this.cambiar(
      toggleTarget(
        this.borrador(),
        { targetKind: 'SERVICE', healthcareServiceId: id },
        this.paquete(),
        'DYNAMIC',
      ),
    );
  }
  protected alternarTodosLosServicios(): void {
    this.cambiar(
      toggleTarget(this.borrador(), { targetKind: 'ALL_SERVICES' }, this.paquete(), 'DYNAMIC'),
    );
  }
  protected seleccionarTodosLosServicios(): void {
    const objetivos = (this.catalogo()?.services ?? []).map((s): SupportScopeTarget => ({
      targetKind: 'SERVICE',
      healthcareServiceId: s.id,
    }));
    this.cambiar(addTargets(this.borrador(), objetivos, this.paquete(), 'FIXED'));
  }

  /* ---- por ubicación ------------------------------------------------------- */

  protected todasLasUbicaciones(): boolean {
    return hasTarget(this.borrador(), { targetKind: 'ALL_LOCATIONS' });
  }
  protected alternarTodasLasUbicaciones(): void {
    this.cambiar(
      toggleTarget(this.borrador(), { targetKind: 'ALL_LOCATIONS' }, this.paquete(), this.modo()),
    );
  }
  protected seleccion(nodo: LocationNode): LocationSelection {
    return selectionOf(nodo, this.catalogo()?.locations ?? [], this.borrador());
  }
  protected alternarUbicacion(nodo: LocationNode): void {
    this.cambiar(toggleTarget(this.borrador(), locationTarget(nodo), this.paquete(), this.modo()));
  }
  protected estaAbierto(nodo: LocationNode): boolean {
    return this.abiertos().has(nodo.id);
  }
  protected alternarApertura(nodo: LocationNode): void {
    this.abiertos.update((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(nodo.id)) nuevo.add(nodo.id);
      return nuevo;
    });
  }
  protected seleccionarNivel(arbol: LocationTreeNode): void {
    this.cambiar(
      selectLevel(
        this.borrador(),
        arbol.node,
        arbol.children.map((h) => h.node),
        this.paquete(),
        this.modo(),
      ),
    );
    this.abiertos.update((actual) => new Set([...actual, arbol.node.id]));
  }
  protected textoDeNivel(arbol: LocationTreeNode): string {
    return `Seleccionar todo: ${levelNoun(arbol.children.map((h) => h.node))} de ${arbol.node.name}`;
  }
  protected deseleccionarTodoUbicaciones(): void {
    const objetivos = (this.catalogo()?.locations ?? []).map(locationTarget);
    this.cambiar(removeTargets(this.borrador(), [...objetivos, { targetKind: 'ALL_LOCATIONS' }]));
  }
  protected motivoHeredado(sel: LocationSelection): string {
    return sel.state === 'inherited' ? `Incluido por «${sel.by.name}»` : '';
  }

  /* ---- combinaciones ------------------------------------------------------- */

  protected agregarCombinacion(): void {
    if (!this.comboCompleto()) return;
    const doctor = this.comboDoctor();
    const servicio = this.comboServicio();
    const lugar = this.comboUbicacion();
    const nodo = (this.catalogo()?.locations ?? []).find((n) => n.id === lugar);
    const ubicacion: Pick<SupportScopeTarget, 'careSpaceId' | 'practiceSiteId'> =
      nodo === undefined
        ? {}
        : nodo.kind === 'SITE'
          ? { practiceSiteId: nodo.id }
          : { careSpaceId: nodo.id };
    let objetivo: SupportScopeTarget;
    switch (this.tipoDeCombinacion()) {
      case 'PRACTITIONER_SERVICE':
        objetivo = {
          targetKind: 'PRACTITIONER_SERVICE',
          practitionerRoleAssignmentId: doctor!,
          healthcareServiceId: servicio!,
        };
        break;
      case 'PRACTITIONER_LOCATION':
        objetivo = {
          targetKind: 'PRACTITIONER_LOCATION',
          practitionerRoleAssignmentId: doctor!,
          ...ubicacion,
        };
        break;
      case 'SERVICE_LOCATION':
        objetivo = { targetKind: 'SERVICE_LOCATION', healthcareServiceId: servicio!, ...ubicacion };
        break;
    }
    if (hasTarget(this.borrador(), objetivo)) return;
    this.cambiar(toggleTarget(this.borrador(), objetivo, this.paquete(), this.modo()));
  }
}
