import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  filtrarResultados,
  ordenarResultados,
  type CotizacionResultado,
  type OrdenCotizacion,
  type VerticalCotizacion,
} from './cotizaciones.logic';

const RESULTADOS_DE_MAQUETA: readonly CotizacionResultado[] = [
  { id: 'farmacia-paracetamol', vertical: 'MEDICAMENTOS', que: 'Paracetamol', donde: 'Farmacia Central', price: { amount: 12, currency: 'BOB', source: 'Maqueta · disponibilidad de farmacia' }, distanceKm: 2 },
  { id: 'laboratorio-hemograma', vertical: 'ANALISIS', que: 'Hemograma', donde: 'Laboratorio Central', price: { amount: 45, currency: 'BOB', source: 'Maqueta · catálogo de diagnóstico' }, distanceKm: 3 },
  { id: 'imagen-tomografia', vertical: 'IMAGENOLOGIA', que: 'Tomografía', donde: 'Centro Imagen', price: null, distanceKm: 1 },
  { id: 'consulta-medica', vertical: 'SERVICIOS_MEDICOS', que: 'Consulta médica', donde: 'Clínica Norte', price: { amount: 5, currency: 'UMA', source: 'Maqueta · referencia UMA' }, distanceKm: 5 },
];

@Component({
  selector: 'app-cotizaciones',
  imports: [FormsModule, PageHeader],
  templateUrl: './cotizaciones.html',
  styleUrl: './cotizaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cotizaciones {
  protected readonly termino = signal('');
  protected readonly vertical = signal<VerticalCotizacion>('TODAS');
  protected readonly orden = signal<OrdenCotizacion>('PRECIO');
  protected readonly resultados = computed(() => ordenarResultados(
    filtrarResultados(RESULTADOS_DE_MAQUETA, this.termino(), this.vertical()),
    this.orden(),
  ));

  protected cambiarTermino(value: string): void { this.termino.set(value); }
  protected cambiarVertical(value: string): void { this.vertical.set(value as VerticalCotizacion); }
  protected cambiarOrden(value: string): void { this.orden.set(value as OrdenCotizacion); }
  protected precioDe(resultado: CotizacionResultado): string {
    return resultado.price === null ? 'Precio no publicado' : `${resultado.price.amount} ${resultado.price.currency}`;
  }
}
