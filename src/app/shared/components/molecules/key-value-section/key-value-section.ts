import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import type { KeyValueRow } from './key-value-section.types';

/**
 * Sección clave–valor de una ficha: cabecera con título y descripción, y debajo
 * una lista cebra con el rótulo en mayúsculas y el valor a la derecha.
 *
 * A diferencia de `app-fact-list`, no oculta lo que falta: una fila sin valor
 * dice «Sin dato». En un catálogo, saber qué no se sabe es parte de la ficha.
 */
@Component({
  selector: 'app-key-value-section',
  imports: [AppButton],
  templateUrl: './key-value-section.html',
  styleUrl: './key-value-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kv' },
})
export class KeyValueSection {
  readonly heading = input.required<string>();
  readonly description = input('');
  readonly rows = input.required<readonly KeyValueRow[]>();

  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  /** Etiqueta de la última fila copiada, para avisarlo una vez. */
  protected readonly copiada = signal<string | null>(null);

  protected hasValue(row: KeyValueRow): boolean {
    return row.value !== null && row.value.trim() !== '';
  }

  protected async copiar(row: KeyValueRow): Promise<void> {
    if (!this.esNavegador || !this.hasValue(row)) return;
    try {
      await navigator.clipboard.writeText(row.value as string);
      this.copiada.set(row.label);
    } catch {
      this.copiada.set(null);
    }
  }
}
