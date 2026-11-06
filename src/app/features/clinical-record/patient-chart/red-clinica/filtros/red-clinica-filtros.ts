import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { DatePicker } from '../../../../../shared/components/organisms/date-picker/date-picker';
import {
  criteriosActivos,
  diagnosticosDe,
  especialidadesDe,
  FILTRO_VACIO,
  profesionalesDe,
  tiposPresentes,
  type FiltroDeRed,
} from '../red-clinica-filtro';
import { ASPECTO_DE_TIPO, TIPOS_DE_NODO, type NodoDeRed, type TipoDeNodo } from '../red-clinica.types';

/** The «todas» value of a dropdown: `app-select` offers no selectable empty. */
const TODAS = '';

/**
 * **The clinical network's filter bar.**
 *
 * It edits a {@link FiltroDeRed} and nothing else: it does not filter.
 * Whoever draws the network calls `aplicarFiltro(nodos, filtro, aristas)` with
 * what comes out of here.
 *
 * Why it is not `app-filter-bar`: that one keeps its state in the URL (it is
 * the listings' bar, and the URL is its source of truth) and has neither a
 * date range nor toggles. This one lives inside the chart, whose URL already
 * belongs to the tabs; it is composed of the same primitives
 * (`app-search-field`, `app-select`, `app-date-picker`, `app-chip`).
 *
 * The options come from the nodes themselves: filtering is only offered by a
 * practitioner or a specialty that appear in the history.
 *
 * ```html
 * <app-red-clinica-filtros [nodos]="nodos()" [(filtro)]="filtro" [visibles]="visibles().length" />
 * ```
 */
@Component({
  selector: 'app-red-clinica-filtros',
  imports: [AppButton, Chip, DatePicker, FormField, NavIcon, SearchField, Select],
  templateUrl: './red-clinica-filtros.html',
  styleUrl: './red-clinica-filtros.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaFiltros {
  /** Every network node (unfiltered): the options come from here. */
  readonly nodos = input<readonly NodoDeRed[]>([]);
  /** El filtro vigente; `filtroChange` emite cada cambio. */
  readonly filtro = model<FiltroDeRed>(FILTRO_VACIO);
  /** How many nodes remain in view after filtering, for the summary. `null` = not shown. */
  readonly visibles = input<number | null>(null);
  /**
   * Whether it offers the type chips. `false` when the screen already has its
   * own filter by type (the chart shares it between «Tabla» and «Recorrido»):
   * two rows of chips for the same thing would be two truths.
   */
  readonly mostrarTipos = input(true);
  /**
   * Inside a surface that already has its border (the chart's Tour): no box of
   * its own, so as not to stack one on another.
   */
  readonly integrada = input(false, { transform: booleanAttribute });

  /** On the phone the advanced criteria fold. */
  protected readonly desplegado = signal(false);

  protected readonly aspecto = ASPECTO_DE_TIPO;

  protected readonly opcionesDeEspecialidad = computed<readonly SelectOption<string>[]>(() => [
    { value: TODAS, label: 'Todas las especialidades' },
    ...especialidadesDe(this.nodos()).map((e) => ({ value: e.id, label: e.nombre })),
  ]);

  protected readonly opcionesDeProfesional = computed<readonly SelectOption<string>[]>(() => [
    { value: TODAS, label: 'Todos los profesionales' },
    ...profesionalesDe(this.nodos()).map((p) => ({ value: p.id, label: p.nombre })),
  ]);

  protected readonly opcionesDeHilo = computed<readonly SelectOption<string>[]>(() => [
    { value: TODAS, label: 'Toda la historia' },
    ...diagnosticosDe(this.nodos()).map((d) => ({
      value: d.id,
      label: d.titulo,
      ...(d.estado ? { description: d.estado.etiqueta } : {}),
    })),
  ]);

  /*
   * A dropdown that only offers «Todos» filters nothing: it is hidden. If a
   * value is already set (another read brought it and later did not), it is
   * still shown so it can be removed.
   */
  protected readonly conEspecialidades = computed(
    () => this.opcionesDeEspecialidad().length > 1 || this.filtro().especialidadId !== null,
  );
  protected readonly conProfesionales = computed(
    () => this.opcionesDeProfesional().length > 1 || this.filtro().profesionalId !== null,
  );

  protected readonly tipos = computed(() => tiposPresentes(this.nodos(), TIPOS_DE_NODO));
  protected readonly activos = computed(() => criteriosActivos(this.filtro()));
  protected readonly total = computed(() => this.nodos().length);

  protected readonly especialidad = computed(() => this.filtro().especialidadId ?? TODAS);
  protected readonly profesional = computed(() => this.filtro().profesionalId ?? TODAS);
  protected readonly hilo = computed(() => this.filtro().hiloDeDiagnosticoId ?? TODAS);

  protected tipoElegido(tipo: TipoDeNodo): boolean {
    return this.filtro().tipos.includes(tipo);
  }

  protected alternarTipo(tipo: TipoDeNodo): void {
    const actuales = this.filtro().tipos;
    const tipos = actuales.includes(tipo) ? actuales.filter((t) => t !== tipo) : [...actuales, tipo];
    // In the canonical order: the same filter written in two orders is the same filter.
    this.cambiar({ tipos: TIPOS_DE_NODO.filter((t) => tipos.includes(t)) });
  }

  protected buscar(texto: string): void {
    if (texto !== this.filtro().texto) this.cambiar({ texto });
  }

  protected elegirEspecialidad(valor: string | null): void {
    this.cambiar({ especialidadId: valor === null || valor === TODAS ? null : valor });
  }

  protected elegirProfesional(valor: string | null): void {
    this.cambiar({ profesionalId: valor === null || valor === TODAS ? null : valor });
  }

  protected elegirHilo(valor: string | null): void {
    this.cambiar({ hiloDeDiagnosticoId: valor === null || valor === TODAS ? null : valor });
  }

  protected elegirDesde(fecha: Date | null): void {
    this.cambiar({ desde: fecha });
  }

  protected elegirHasta(fecha: Date | null): void {
    this.cambiar({ hasta: fecha });
  }

  /** «Desde» after «hasta»: it is said, not silently corrected. */
  protected readonly rangoInvertido = computed(() => {
    const { desde, hasta } = this.filtro();
    return desde !== null && hasta !== null && desde.getTime() > hasta.getTime();
  });

  protected limpiar(): void {
    this.filtro.set(FILTRO_VACIO);
  }

  private cambiar(parcial: Partial<FiltroDeRed>): void {
    this.filtro.update((actual) => ({ ...actual, ...parcial }));
  }
}
