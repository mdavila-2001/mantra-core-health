import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
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
import { ChatStore } from '../../../core/messaging/chat.store';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Switch } from '../../../shared/components/atoms/switch/switch';

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
  imports: [AppButton, FormsModule, Switch],
  templateUrl: './chat-preferences.html',
  styleUrl: './chat-preferences.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPreferences implements OnInit {
  private readonly autoReply = inject(ChatAutoReply);
  private readonly plantillas = inject(MessageTemplates);
  private readonly chat = inject(ChatStore);

  protected readonly config = this.autoReply.configuracion;

  /** `true` si lo que se ve está guardado en el servidor y no sólo acá. */
  protected readonly enElServidor = this.autoReply.enElServidor;

  /**
   * Enciende la mensajería para saber el perfil propio.
   *
   * La configuración cuelga del perfil público, así que sin él sólo se puede
   * guardar en este navegador — y eso cambia lo que la pantalla promete.
   */
  ngOnInit(): void {
    this.chat.iniciar();
    // El perfil se resuelve de forma asíncrona; cuando llega se trae lo que
    // haya en el servidor, que es lo que se está aplicando de verdad.
    queueMicrotask(() => this.autoReply.cargar(this.chat.perfil()));
  }

  /** El perfil propio, o `null` mientras no se resolvió. */
  private perfil(): string | null {
    return this.chat.perfil();
  }

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
    this.autoReply.guardar({ activa }, this.perfil());
    this.acusar();
  }

  protected elegirEspera(minutos: number): void {
    this.autoReply.guardar({ minutosDeInactividad: minutos }, this.perfil());
    this.acusar();
  }

  protected cambiarEspera(valor: string): void {
    this.autoReply.guardar({ minutosDeInactividad: Number(valor) }, this.perfil());
  }

  protected cambiarDescanso(valor: string): void {
    this.autoReply.guardar({ horasEntreAvisos: Number(valor) }, this.perfil());
  }

  protected alternarHorario(soloFueraDeHorario: boolean): void {
    this.autoReply.guardar({ soloFueraDeHorario }, this.perfil());
    this.acusar();
  }

  protected cambiarDesde(horarioDesde: string): void {
    this.autoReply.guardar({ horarioDesde }, this.perfil());
  }

  protected cambiarHasta(horarioHasta: string): void {
    this.autoReply.guardar({ horarioHasta }, this.perfil());
  }

  protected guardarTexto(): void {
    this.autoReply.guardar({ texto: this.texto() }, this.perfil());
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
