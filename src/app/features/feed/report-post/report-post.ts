import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type { ReportReason } from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';

/**
 * Los cinco motivos del contrato, con el texto que lee quien reporta.
 *
 * Los códigos son los del enum del DTO. La redacción importa: «Expone datos de
 * un paciente» y no «PHI», porque quien reporta no tiene por qué saber qué
 * significa esa sigla — y es justamente el motivo que más se usa mal cuando no
 * se entiende.
 */
export const MOTIVOS: readonly {
  readonly code: ReportReason;
  readonly label: string;
}[] = [
  { code: 'PHI', label: 'Expone datos de un paciente' },
  { code: 'MISINFORMATION', label: 'Información médica engañosa' },
  { code: 'ABUSE', label: 'Agresión o acoso' },
  { code: 'SPAM', label: 'Spam o publicidad' },
  { code: 'OTHER', label: 'Otro motivo' },
];

/**
 * El formulario para reportar una publicación.
 *
 * ## Por qué es un componente y no un diálogo de confirmación
 *
 * `app-dialog` sabe pedir un motivo **de texto libre**, y acá el motivo es una
 * de cinco categorías que el servidor entiende más un detalle opcional.
 * Forzarlo dentro del diálogo dejaría la categoría fuera del contrato o
 * escondida en el texto libre, que es donde la moderación no la puede filtrar.
 *
 * ## Qué promete esta pantalla y qué no
 *
 * Promete que el reporte llegó. **No** promete que el contenido se vaya a bajar,
 * ni cuándo: eso lo decide una persona en la cola de moderación, y anticiparlo
 * sería prometer en nombre de alguien que todavía no miró.
 *
 * ## El detalle es opcional, y con aviso
 *
 * Lo escribe quien reporta y lo lee un moderador. Se avisa, porque la tentación
 * de pegar ahí la captura de una conversación con datos de un paciente es real —
 * y sería agregar al sistema justo lo que se está denunciando.
 */
@Component({
  selector: 'app-report-post',
  imports: [Alert, AppButton, Card, FormField, Textarea],
  templateUrl: './report-post.html',
  styleUrl: './report-post.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportPost {
  private readonly community = inject(CommunityClient);

  /** La publicación que se reporta. */
  readonly postId = input.required<string>();

  /** Se emite cuando el reporte quedó registrado. */
  readonly reportado = output<void>();

  /** Se emite al cancelar, sin haber reportado nada. */
  readonly cancelado = output<void>();

  protected readonly motivos = MOTIVOS;
  protected readonly elegido = signal<ReportReason | null>(null);
  protected readonly detalle = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly listo = signal(false);

  protected readonly puedeEnviar = computed(
    () => this.elegido() !== null && !this.enviando(),
  );

  protected elegir(code: ReportReason): void {
    this.elegido.set(code);
  }

  protected enviar(): void {
    const reason = this.elegido();
    // La guarda está acá y no sólo en el `disabled`: reportar dos veces crea dos
    // filas, y la cola las deduplica por contenido pero el recuento sube igual.
    if (reason === null || !this.puedeEnviar()) {
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    const detalle = this.detalle().trim();
    this.community
      .report({
        targetType: 'POST',
        targetId: this.postId(),
        reason,
        ...(detalle.length > 0 ? { detailText: detalle } : {}),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.listo.set(true);
          this.reportado.emit();
        },
        error: () => {
          this.enviando.set(false);
          this.error.set('No pudimos enviar el reporte. Reintentá.');
        },
      });
  }

  protected cancelar(): void {
    this.cancelado.emit();
  }
}
