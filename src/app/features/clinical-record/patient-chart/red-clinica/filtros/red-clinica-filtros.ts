import {
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

/** El valor de «todas» en un desplegable: el `app-select` no ofrece un vacío elegible. */
const TODAS = '';

/**
 * **Barra de filtros de la red clínica.**
 *
 * Edita un {@link FiltroDeRed} y nada más: no filtra. Quien dibuja la red llama
 * a `aplicarFiltro(nodos, filtro, aristas)` con lo que sale de acá.
 *
 * Por qué no es `app-filter-bar`: aquélla guarda su estado en la URL (es la
 * barra de los listados, y la URL es su fuente de verdad) y no tiene rango de
 * fechas ni conmutadores. Ésta vive dentro del expediente, cuya URL ya es de
 * las pestañas; se compone con las mismas primitivas (`app-search-field`,
 * `app-select`, `app-date-picker`, `app-chip`).
 *
 * Las opciones salen de los propios nodos: sólo se ofrece filtrar por un
 * profesional o una especialidad que aparecen en la historia.
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
  /** Todos los nodos de la red (sin filtrar): de acá salen las opciones. */
  readonly nodos = input<readonly NodoDeRed[]>([]);
  /** El filtro vigente; `filtroChange` emite cada cambio. */
  readonly filtro = model<FiltroDeRed>(FILTRO_VACIO);
  /** Cuántos nodos quedan a la vista tras filtrar, para el resumen. `null` = no se muestra. */
  readonly visibles = input<number | null>(null);
  /**
   * Si ofrece los chips de tipo. `false` cuando la pantalla ya tiene su propio
   * filtro por tipo (el expediente lo comparte entre «Tabla» y «Recorrido»):
   * dos filas de chips para lo mismo serían dos verdades.
   */
  readonly mostrarTipos = input(true);

  /** En el teléfono los criterios avanzados se pliegan. */
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
    // En el orden canónico: el mismo filtro escrito en dos órdenes es el mismo filtro.
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

  /** «Desde» posterior a «hasta»: se avisa, no se corrige en silencio. */
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
