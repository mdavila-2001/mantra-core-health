import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import {
  descendientesDe,
  formasHijasPermitidas,
} from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  CareSpaceNode,
  ClinicalUnitNode,
  SiteStructure,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, hasData, loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tree } from '../../../../shared/components/organisms/tree/tree';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CatalogoDeInfraestructuraStore } from './catalogo-de-infraestructura.store';
import {
  antiguedadEnPalabras,
  arbolDeEspacios,
  arbolDeUnidades,
  camasActivas,
  MINUTOS_HASTA_ATRASADO,
  RUTA_DE_ALTA,
  RUTA_DE_ALTA_MASIVA,
  RUTA_DE_IMPORTACION,
  rutaDeEspacio,
  varianteDe,
} from './infraestructura.presentacion';

/** Un establecimiento elegible, como lo trae la consola. */
export interface SitioElegible {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

type Vista = 'fisica' | 'organizativa';

const VISTAS: readonly SegmentedOption<Vista>[] = [
  { value: 'fisica', label: 'Árbol físico' },
  { value: 'organizativa', label: 'Árbol organizativo' },
];

/**
 * Pestaña **Infraestructura** de la consola — franja F1.
 *
 * Dos árboles ligados (decisión D2): el físico —edificio > pabellón > piso >
 * sala > local > cama— y el organizativo —servicios y departamentos—, con un
 * panel que muestra lo elegido y ofrece el paso siguiente.
 *
 * ## La URL manda
 *
 * El establecimiento (`site`), el espacio elegido (`space`) y la vista
 * (`view`) viven en la query: así «volver a la consola» desde una ficha deja
 * el árbol abierto donde estaba, y un enlace pegado abre lo mismo.
 *
 * ## Los permisos se reflejan, no se deciden
 *
 * `puedeEscribir` sólo esconde los botones de alta. Quien no administra y
 * llega igual a un formulario recibe el 403 de la API como S5.
 */
@Component({
  selector: 'app-infraestructura-tab',
  imports: [AppButtonLink, Badge, FactList, RouterLink, SegmentedControl, Tree, ViewStateHost],
  templateUrl: './infraestructura-tab.html',
  styleUrl: './infraestructura-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfraestructuraTab {
  private readonly client = inject(InfrastructureClient);
  private readonly catalogo = inject(CatalogoDeInfraestructuraStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Los establecimientos de la organización. */
  readonly sitios = input.required<readonly SitioElegible[]>();
  /** Reflejo de permisos: la API decide. */
  readonly puedeEscribir = input(false);

  protected readonly vistas = VISTAS;
  protected readonly rutaDeAlta = RUTA_DE_ALTA;
  protected readonly rutaDeAltaMasiva = RUTA_DE_ALTA_MASIVA;
  protected readonly rutaDeImportacion = RUTA_DE_IMPORTACION;
  protected readonly rutaDeEspacio = rutaDeEspacio;
  protected readonly varianteDe = varianteDe;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** El establecimiento: el de la URL si es de esta organización, o el primero. */
  protected readonly sitioId = computed(() => {
    const pedido = this.query().get('site');
    const sitios = this.sitios();
    return sitios.find((s) => s.id === pedido)?.id ?? sitios[0]?.id ?? null;
  });

  protected readonly vista = computed<Vista>(() =>
    this.query().get('view') === 'units' ? 'organizativa' : 'fisica',
  );

  protected readonly elegido = computed(() => this.query().get('space'));
  protected readonly unidadElegida = computed(() => this.query().get('unit'));

  protected readonly abiertos = signal<readonly string[]>([]);
  protected readonly unidadesAbiertas = signal<readonly string[]>([]);

  /** Lo que respondió `GET /sites/:id/structure`. */
  private readonly estructura = signal<ViewState<SiteStructure>>(loading());

  /** El estado que se pinta: vacío con salida, o atrasado con su antigüedad. */
  protected readonly estado = computed<ViewState<SiteStructure>>(() => {
    const estado = this.estructura();
    if (estado.status !== 'ready') return estado;
    if (estado.data.spaces.length === 0) {
      return empty(
        { label: 'Registrar el primer espacio', route: `${RUTA_DE_ALTA}?site=${encodeURIComponent(estado.data.site.id)}` },
        'Este establecimiento todavía no tiene ningún espacio. Empezá por el edificio o, si es un consultorio, por el local.',
      );
    }
    const asOf = new Date(estado.data.asOf);
    const minutos = (Date.now() - asOf.getTime()) / 60_000;
    return Number.isFinite(minutos) && minutos > MINUTOS_HASTA_ATRASADO ? stale(estado.data, asOf) : estado;
  });

  protected readonly datos = computed(() => dataOf(this.estructura()));

  protected readonly arbol = computed(() => arbolDeEspacios(this.datos()?.spaces ?? []));
  protected readonly arbolOrganizativo = computed(() => arbolDeUnidades(this.datos()?.units ?? []));

  protected readonly resumen = computed(() => {
    const datos = this.datos();
    if (datos === null) return null;
    const vivos = datos.spaces.filter((e) => e.status.code !== 'SPACE_RETIRED');
    return {
      espacios: vivos.length,
      camas: camasActivas(datos.spaces),
      unidades: datos.units.length,
      actualizado: antiguedadEnPalabras(new Date(datos.asOf)),
    };
  });

  private readonly unidadPorId = computed<ReadonlyMap<string, ClinicalUnitNode>>(
    () => new Map((this.datos()?.units ?? []).map((u) => [u.id, u])),
  );

  private readonly espacioPorId = computed<ReadonlyMap<string, CareSpaceNode>>(
    () => new Map((this.datos()?.spaces ?? []).map((e) => [e.id, e])),
  );

  /** El espacio elegido, si sigue existiendo en la estructura. */
  protected readonly espacio = computed(() => {
    const id = this.elegido();
    return id === null ? null : (this.espacioPorId().get(id) ?? null);
  });

  protected readonly hechosDelEspacio = computed<readonly Hecho[]>(() => {
    const e = this.espacio();
    const datos = this.datos();
    if (e === null || datos === null) return [];
    const bajo = descendientesDe(datos.spaces, e.id);
    const camas = datos.spaces.filter(
      (x) => (bajo.has(x.id) || x.id === e.id) && x.form.code === 'LOC_FORM_BED' && x.status.code === 'SPACE_ACTIVE',
    ).length;
    return [
      { etiqueta: 'Código', valor: e.code },
      { etiqueta: 'Forma', valor: e.form.display },
      { etiqueta: 'Función', valor: e.function.display },
      { etiqueta: 'Unidad propietaria', valor: e.clinicalUnitId === null ? 'Sin unidad' : (this.unidadPorId().get(e.clinicalUnitId)?.name ?? '—') },
      { etiqueta: 'Capacidad', valor: e.capacity === null ? null : String(e.capacity) },
      { etiqueta: 'Espacios adentro', valor: String(e.childCount) },
      { etiqueta: 'Camas activas', valor: e.form.code === 'LOC_FORM_BED' ? null : String(camas) },
    ];
  });

  /** ¿La forma del elegido admite hijos? Sin catálogo todavía, se ofrece igual. */
  protected readonly admiteHijos = computed(() => {
    const e = this.espacio();
    const catalogo = dataOf(this.catalogo.estado());
    if (e === null) return false;
    return catalogo === null ? true : formasHijasPermitidas(catalogo, e.form.code).length > 0;
  });

  protected readonly unidad = computed(() => {
    const id = this.unidadElegida();
    return id === null ? null : (this.unidadPorId().get(id) ?? null);
  });

  /** Los espacios vinculados a la unidad elegida, con su rol. */
  protected readonly espaciosDeLaUnidad = computed(() => {
    const u = this.unidad();
    const datos = this.datos();
    if (u === null || datos === null) return [];
    return datos.assignments
      .filter((a) => a.clinicalUnitId === u.id && a.validTo === null)
      .map((a) => ({ asignacion: a, espacio: this.espacioPorId().get(a.careSpaceId) ?? null }))
      .filter((x): x is { asignacion: typeof x.asignacion; espacio: CareSpaceNode } => x.espacio !== null)
      .sort((a, b) => a.espacio.code.localeCompare(b.espacio.code, 'es', { numeric: true }));
  });

  constructor() {
    this.catalogo.asegurar();
    // Se recarga cuando cambia el establecimiento, no cuando cambia la
    // selección: elegir un nodo no vuelve a pedir el árbol.
    effect(() => {
      const sitio = this.sitioId();
      untracked(() => this.cargar(sitio));
    });
  }

  protected recargar(): void {
    this.cargar(this.sitioId(), true);
  }

  protected elegirSitio(siteId: string): void {
    this.navegar({ site: siteId, space: null, unit: null });
  }

  protected elegirVista(vista: Vista): void {
    this.navegar({ view: vista === 'organizativa' ? 'units' : null });
  }

  protected elegirEspacio(id: string | null): void {
    this.navegar({ space: id });
  }

  protected elegirUnidad(id: string | null): void {
    this.navegar({ unit: id });
  }

  protected parametrosDeAlta(padre: CareSpaceNode | null): Record<string, string> {
    const sitio = this.sitioId();
    return {
      ...(sitio === null ? {} : { site: sitio }),
      ...(padre === null ? {} : { parent: padre.id }),
    };
  }

  private cargar(siteId: string | null, conservarDatos = false): void {
    if (siteId === null) {
      this.estructura.set(
        empty({ label: 'Registrar una sede', route: '/administration/organizations' }, 'La organización no tiene ninguna sede donde ubicar espacios.'),
      );
      return;
    }
    const anterior = this.estructura();
    if (!conservarDatos || !hasData(anterior)) this.estructura.set(loading());
    this.client
      .getStructure(siteId)
      .pipe(
        map((datos) => ready(datos) as ViewState<SiteStructure>),
        catchError((error: unknown) => {
          const fallo = errorToViewState<SiteStructure>(error);
          // Un refresco que falla con datos en pantalla no los borra: los deja
          // a la vista como atrasados, con su antigüedad (S7).
          return of(
            conservarDatos && hasData(anterior) && (fallo.status === 'offline' || fallo.status === 'error')
              ? stale(anterior.data, new Date(anterior.data.asOf))
              : fallo,
          );
        }),
      )
      .subscribe((estado) => {
        this.estructura.set(estado);
        if (estado.status === 'ready') this.abrirCamino(estado.data);
      });
  }

  /** Abre el primer nivel y el camino hasta lo elegido en la URL. */
  private abrirCamino(datos: SiteStructure): void {
    const porId = new Map(datos.spaces.map((e) => [e.id, e]));
    const abiertos = new Set(datos.spaces.filter((e) => e.parentId === null).map((e) => e.id));
    let actual = this.elegido() === null ? undefined : porId.get(this.elegido()!);
    while (actual?.parentId) {
      abiertos.add(actual.parentId);
      actual = porId.get(actual.parentId);
    }
    this.abiertos.set([...new Set([...this.abiertos(), ...abiertos])]);
    this.unidadesAbiertas.set(datos.units.filter((u) => u.parentId === null).map((u) => u.id));
  }

  private navegar(cambios: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cambios,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
