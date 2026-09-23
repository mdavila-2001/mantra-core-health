import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
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

/** Un estudio propio para iniciar una cotización, sin llevar IDs al DOM. */
interface EstudioDeDocumento {
  readonly id: string;
  readonly nombre: string;
}

type EstadoDeOrdenes = 'CARGANDO' | 'LISTO' | 'ERROR' | 'SIN_PERFIL';

@Component({
  selector: 'app-cotizaciones',
  imports: [FormsModule, PageHeader],
  templateUrl: './cotizaciones.html',
  styleUrl: './cotizaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cotizaciones {
  private readonly auth = inject(AuthService);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly termino = signal('');
  protected readonly vertical = signal<VerticalCotizacion>('TODAS');
  protected readonly orden = signal<OrdenCotizacion>('PRECIO');
  protected readonly estudiosDeDocumentos = signal<readonly EstudioDeDocumento[]>([]);
  protected readonly estadoDeOrdenes = signal<EstadoDeOrdenes>('CARGANDO');
  protected readonly ordenesTruncadas = signal(false);
  protected readonly resultados = computed(() => ordenarResultados(
    filtrarResultados(RESULTADOS_DE_MAQUETA, this.termino(), this.vertical()),
    this.orden(),
  ));

  constructor() {
    // La API fija el titular a partir de la sesión: no se acepta ni se muestra
    // un perfil ajeno. El catálogo sólo traduce IDs a nombres antes de pintar.
    if (this.auth.patientProfileId() === null) {
      this.estadoDeOrdenes.set('SIN_PERFIL');
      return;
    }

    this.diagnostics
      .getOwnOrders(20)
      .pipe(
        switchMap((respuesta) => {
          this.ordenesTruncadas.set(respuesta.truncated);
          return this.terminology.readConceptLabels(respuesta.items.map((orden) => orden.codeConceptId)).pipe(
            // Un catálogo caído no borra las órdenes propias: quedan sin
            // nombre hasta poder volver a resolverlas, nunca como datos falsos.
            catchError(() => of(new Map())),
            map((etiquetas) => respuesta.items.map((orden) => ({
              id: orden.id,
              nombre: etiquetas.get(orden.codeConceptId)?.display ?? 'Estudio sin nombre disponible',
            }))),
          );
        }),
      )
      .subscribe({
        next: (estudios) => {
          this.estudiosDeDocumentos.set(estudios);
          this.estadoDeOrdenes.set('LISTO');
        },
        error: () => this.estadoDeOrdenes.set('ERROR'),
      });
  }

  protected cambiarTermino(value: string): void { this.termino.set(value); }
  protected cambiarVertical(value: string): void { this.vertical.set(value as VerticalCotizacion); }
  protected cambiarOrden(value: string): void { this.orden.set(value as OrdenCotizacion); }
  protected precioDe(resultado: CotizacionResultado): string {
    return resultado.price === null ? 'Precio no publicado' : `${resultado.price.amount} ${resultado.price.currency}`;
  }
}
