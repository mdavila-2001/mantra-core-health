import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import type {
  ExplainAccessResponse,
  ExplainMyAccessRequest,
} from '../../../core/data-access/access-governance/access-explain.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';

/**
 * **«¿Por qué no puedo?»** (CONTRATO-GOBIERNO §5.4, §9.1 principio 3): toda negación o desafío ofrece una explicación con la
 * próxima acción concreta. Pregunta a la API (`POST /me/support-access/explain`, solo sobre uno mismo): lo que dice es lo que
 * decide, porque sale del mismo motor. Muestra la oración del servidor, lo que **usted** puede hacer para pasar y, si hace
 * falta, qué pedirle a su administrador. Nunca muestra códigos técnicos ni datos de otras personas.
 *
 * Lo usan los bloques «Reservado» de la agenda y de la bandeja, y los rechazos de búsqueda de pacientes y caja.
 */
@Component({
  selector: 'app-access-why-not',
  imports: [Alert, AppButton],
  templateUrl: './why-not.html',
  styleUrl: './why-not.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessWhyNot {
  private readonly explain = inject(AccessExplainClient);

  /** Qué se quiso hacer, sobre qué y cuándo (con la organización). */
  readonly request = input.required<ExplainMyAccessRequest>();
  readonly label = input('¿Por qué no puedo?');
  /** Prefijo de los `data-testid`. */
  readonly idPrefix = input('por-que');

  protected readonly trabajando = signal(false);
  protected readonly respuesta = signal<ExplainAccessResponse | null>(null);
  protected readonly fallo = signal<string | null>(null);
  protected readonly abierto = signal(false);

  protected readonly pasos = computed(() => this.respuesta()?.missing.map((m) => m.message) ?? []);

  protected preguntar(): void {
    if (this.trabajando()) return;
    this.abierto.set(true);
    this.trabajando.set(true);
    this.fallo.set(null);
    this.explain.explainMine(this.request()).subscribe({
      next: (respuesta) => {
        this.trabajando.set(false);
        this.respuesta.set(respuesta);
      },
      error: (failure: unknown) => {
        this.trabajando.set(false);
        this.respuesta.set(null);
        this.fallo.set(
          accessFailureOf(failure)?.message ??
            'No pudimos explicarlo ahora. Intente de nuevo en unos minutos.',
        );
      },
    });
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }
}
