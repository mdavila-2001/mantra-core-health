import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ChatAutoReply,
  HORAS_MAXIMO,
  HORAS_MINIMO,
  LARGO_MAXIMO,
  MINUTOS_MAXIMO,
  MINUTOS_MINIMO,
} from '../../../core/messaging/chat-auto-reply';
import {
  MessageTemplates,
  PLANTILLAS_POR_DEFECTO,
} from '../../../core/messaging/message-templates';
import { AppButton } from '../../../shared/components/atoms/button/button';

/** Las esperas que se ofrecen de un toque. El campo admite cualquier otra. */
const ESPERAS = [5, 15, 30, 60, 120] as const;

/**
 * Lo que se configura del chat: la respuesta automática y las plantillas.
 *
 * ## Por qué acá y no en el chat
 *
 * Porque se toca una vez y se olvida, que es la definición de una preferencia.
 * Meterlo en un menú del hilo obligaría a abrir una conversación cualquiera
 * para cambiar algo que no es de esa conversación.
 *
 * ## Lo que la pantalla tiene que decir en voz alta
 *
 * Que la respuesta automática **sólo sale con AloVida abierto**. Vive en este
 * navegador —no hay dónde guardarla en el modelo, ver `ChatAutoReply`—, así que
 * prometer un contestador que funciona con la pestaña cerrada sería mentir. Se
 * dice en la pantalla, no sólo en un comentario del código.
 */
@Component({
  selector: 'app-chat-preferences',
  imports: [AppButton, FormsModule],
  templateUrl: './chat-preferences.html',
  styleUrl: './chat-preferences.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPreferences {
  private readonly autoReply = inject(ChatAutoReply);
  private readonly plantillas = inject(MessageTemplates);

  protected readonly config = this.autoReply.configuracion;

  protected readonly esperas = ESPERAS;
  protected readonly minutosMinimo = MINUTOS_MINIMO;
  protected readonly minutosMaximo = MINUTOS_MAXIMO;
  protected readonly horasMinimo = HORAS_MINIMO;
  protected readonly horasMaximo = HORAS_MAXIMO;
  protected readonly largoMaximo = LARGO_MAXIMO;

  /** «Guardado» un momento después de guardar, para que el gesto se acuse. */
  protected readonly guardado = signal(false);

  /** Las propias, que son las únicas que se pueden quitar. */
  protected readonly plantillasPropias = this.plantillas.mias;
  protected readonly plantillasDeFabrica = PLANTILLAS_POR_DEFECTO;
  protected readonly plantillaNueva = signal('');

  /** El texto mientras se edita, antes de guardarlo. */
  protected readonly texto = signal(this.autoReply.configuracion().texto);

  protected readonly restantes = computed(
    () => this.largoMaximo - this.texto().length,
  );

  protected alternarActiva(activa: boolean): void {
    this.autoReply.guardar({ activa });
    this.acusar();
  }

  protected elegirEspera(minutos: number): void {
    this.autoReply.guardar({ minutosDeInactividad: minutos });
    this.acusar();
  }

  protected cambiarEspera(valor: string): void {
    this.autoReply.guardar({ minutosDeInactividad: Number(valor) });
  }

  protected cambiarDescanso(valor: string): void {
    this.autoReply.guardar({ horasEntreAvisos: Number(valor) });
  }

  protected alternarHorario(soloFueraDeHorario: boolean): void {
    this.autoReply.guardar({ soloFueraDeHorario });
    this.acusar();
  }

  protected cambiarDesde(horarioDesde: string): void {
    this.autoReply.guardar({ horarioDesde });
  }

  protected cambiarHasta(horarioHasta: string): void {
    this.autoReply.guardar({ horarioHasta });
  }

  protected guardarTexto(): void {
    this.autoReply.guardar({ texto: this.texto() });
    // Se relee de la configuración: el servicio acota y limpia, y el campo
    // tiene que mostrar lo que quedó guardado, no lo que se tecleó.
    this.texto.set(this.autoReply.configuracion().texto);
    this.acusar();
  }

  protected restablecer(): void {
    this.autoReply.restablecer();
    this.texto.set(this.autoReply.configuracion().texto);
    this.acusar();
  }

  /** Usa una plantilla como texto de la respuesta automática. */
  protected usarPlantilla(plantilla: string): void {
    this.texto.set(plantilla);
  }

  protected agregarPlantilla(): void {
    this.plantillas.agregar(this.plantillaNueva());
    this.plantillaNueva.set('');
  }

  protected quitarPlantilla(texto: string): void {
    this.plantillas.quitar(texto);
  }

  private acusar(): void {
    this.guardado.set(true);
    setTimeout(() => this.guardado.set(false), 2000);
  }
}
