import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { PublicMarketplaceClient } from '@core/data-access/public-marketplace/public-marketplace.client';
import type {
  PuntoDeOrigen,
  TarjetaDeMedicamento,
} from '@core/data-access/public-marketplace/public-marketplace.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';

import {
  cuantasMarcas,
  cuantosProveedores,
  ramasPorMarca,
  type EstadoDeRama,
  type RamaDeMarca,
} from './medication-tree.logic';

/**
 * **Vista de árbol de la vitrina** — compuesto → para qué se usa → nombre
 * comercial → quién lo ofrece.
 *
 * ## Por qué `<details>` anidados y no `role="tree"`
 *
 * Un `role="tree"` obliga a reimplementar todo el teclado del patrón (flechas,
 * Inicio, Fin, escritura anticipada) y a mover el foco a mano. `<details>` ya
 * se abre con Enter y Espacio, se anuncia como expandible y no necesita ni una
 * línea de JavaScript para eso. Cada nivel es una lista dentro de otra.
 *
 * ## El nivel «para qué se usa» dice lo que hay, no lo que falta inventar
 *
 * La API de la vitrina sólo trae el grupo terapéutico (primer nivel del ATC).
 * Las enfermedades concretas que trata cada compuesto existen como relaciones
 * publicadas (`tools/terminology-import/drug-treatments` en la API) pero no
 * están servidas todavía, y una indicación escrita a mano es un dato clínico
 * sin fuente (B-13). El nodo muestra el grupo y dice que las indicaciones
 * llegan con la fuente oficial.
 *
 * ## Los proveedores se piden al abrir el compuesto
 *
 * La tarjeta trae las marcas pero no quién las ofrece. Al abrir un compuesto
 * se pide su disponibilidad —el mismo `GET …/availability` del modal— una sola
 * vez, y se agrupa por marca. Pedirlas todas al cargar la vitrina serían 36
 * peticiones para un árbol que casi nadie abre entero.
 */
@Component({
  selector: 'app-medication-tree',
  imports: [AppButton, Badge],
  templateUrl: './medication-tree.html',
  styleUrl: './medication-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationTree {
  /** Los compuestos de la vitrina, en el orden en que la API los devolvió. */
  readonly medications = input.required<readonly TarjetaDeMedicamento[]>();

  /** Desde dónde medir, para que el pedido ordene por cercanía. */
  readonly origin = input<PuntoDeOrigen | null>(null);

  /** Pide abrir el modal de farmacias de un compuesto. */
  readonly pharmaciesRequested = output<TarjetaDeMedicamento>();

  private readonly vitrina = inject(PublicMarketplaceClient);

  /** Las ramas de proveedores ya pedidas, por concepto. */
  protected readonly ramas = signal<ReadonlyMap<string, EstadoDeRama>>(new Map());

  protected readonly cuantasMarcas = cuantasMarcas;
  protected readonly cuantosProveedores = cuantosProveedores;

  /** Las marcas con sus proveedores, o ninguna si todavía no llegaron. */
  protected marcasDe(medicamento: TarjetaDeMedicamento): readonly RamaDeMarca[] {
    const rama = this.ramas().get(medicamento.conceptId);
    return rama?.estado === 'datos' ? rama.marcas : [];
  }

  /** Al abrir un compuesto, pide sus proveedores si todavía no los tiene. */
  protected alAlternar(medicamento: TarjetaDeMedicamento, evento: Event): void {
    const abierto = evento.target instanceof HTMLDetailsElement && evento.target.open;
    const previo = this.ramas().get(medicamento.conceptId);
    if (!abierto || previo?.estado === 'datos' || previo?.estado === 'carga') {
      return;
    }
    this.cargar(medicamento);
  }

  protected cargar(medicamento: TarjetaDeMedicamento): void {
    this.fijar(medicamento.conceptId, { estado: 'carga' });
    const origen = this.origin();
    this.vitrina.getAvailability(medicamento.conceptId, { origin: origen ?? undefined }).subscribe({
      next: (disponibilidad) =>
        this.fijar(medicamento.conceptId, {
          estado: 'datos',
          marcas: ramasPorMarca(medicamento.brands, disponibilidad.offers),
        }),
      error: () => this.fijar(medicamento.conceptId, { estado: 'error' }),
    });
  }

  private fijar(conceptId: string, estado: EstadoDeRama): void {
    const siguiente = new Map(this.ramas());
    siguiente.set(conceptId, estado);
    this.ramas.set(siguiente);
  }
}
