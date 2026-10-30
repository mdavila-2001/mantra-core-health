import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ChatAutoReply,
  CONFIGURACION_POR_DEFECTO,
  HORAS_MAXIMO,
  HORAS_MINIMO,
  LARGO_MAXIMO,
  MINUTOS_MAXIMO,
  MINUTOS_MINIMO,
  type RespuestaAutomatica,
} from '../../../core/messaging/chat-auto-reply';
import {
  MessageTemplates,
  PLANTILLAS_POR_DEFECTO,
} from '../../../core/messaging/message-templates';
import { ChatStore } from '../../../core/messaging/chat.store';
import { SessionStore } from '../../../core/auth/session.store';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Switch } from '../../../shared/components/atoms/switch/switch';

/** Las esperas que se ofrecen de un toque. El campo admite cualquier otra. */
const ESPERAS = [5, 15, 30, 60, 120] as const;

/** La única decisión de arriba: qué pasa cuando le escriben y no está. */
export type ModoDeRespuesta = 'apagado' | 'fijo' | 'ia';

/**
 * El borrador de la pantalla: lo que se ve antes de tocar «Guardar».
 *
 * Es la configuración guardada más el modo como una sola elección. Antes cada
 * control guardaba al tocarlo; con tres modos excluyentes eso hacía que pasar
 * de «mensaje fijo» a «IA» dejara guardado un estado intermedio.
 */
interface Borrador {
  readonly modo: ModoDeRespuesta;
  readonly texto: string;
  readonly minutos: number;
  readonly horas: number;
  readonly soloFueraDeHorario: boolean;
  readonly desde: string;
  readonly hasta: string;
}

function borradorDe(config: RespuestaAutomatica): Borrador {
  return {
    modo: !config.activa ? 'apagado' : config.conIa ? 'ia' : 'fijo',
    texto: config.texto,
    minutos: config.minutosDeInactividad,
    horas: config.horasEntreAvisos,
    soloFueraDeHorario: config.soloFueraDeHorario,
    desde: config.horarioDesde,
    hasta: config.horarioHasta,
  };
}

function distintos(a: Borrador, b: Borrador): boolean {
  return (Object.keys(a) as (keyof Borrador)[]).some((clave) => a[clave] !== b[clave]);
}

/**
 * Lo que llega del servidor, campo por campo: lo que la persona tocó se queda,
 * lo que no tocó se actualiza. Así un cambio de modo hecho antes de que llegue
 * la lectura no sube, al guardar, la espera o la franja viejas de este
 * navegador encima de las que se pusieron desde otro dispositivo.
 */
function fusionar(editado: Borrador, base: Borrador, llegado: Borrador): Borrador {
  const resultado = { ...llegado } as Record<keyof Borrador, Borrador[keyof Borrador]>;
  for (const clave of Object.keys(editado) as (keyof Borrador)[]) {
    if (editado[clave] !== base[clave]) resultado[clave] = editado[clave];
  }
  return resultado as unknown as Borrador;
}

/**
 * Lo que se configura del chat: la respuesta automática y las frases guardadas.
 *
 * ## Una decisión arriba, lo demás plegado
 *
 * Arriba hay **una sola pregunta** con tres respuestas excluyentes —no
 * responder, responder con un mensaje fijo, responder con IA—, cada una con
 * una línea que dice qué pasa. La espera, el descanso entre avisos y la franja
 * horaria van en «Más opciones», con valores de fábrica que ya sirven: quien
 * no toca nada queda bien configurado.
 *
 * Al lado, la **vista previa** muestra cómo lo va a ver la otra persona, con la
 * misma etiqueta que lleva la burbuja en el chat. Nada se guarda hasta tocar
 * «Guardar», y al guardar se dice con palabras qué quedó configurado.
 *
 * ## La misma pieza para un consultorio y una organización
 *
 * Cambia sólo el sujeto («su consultorio» / «su organización»), no la
 * estructura. Una cuenta de organización (farmacia, laboratorio, aseguradora)
 * entra con su propia vitrina y configura la suya desde acá.
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
  private readonly session = inject(SessionStore);

  protected readonly config = this.autoReply.configuracion;

  /** `true` si lo que se ve está guardado en el servidor y no sólo acá. */
  protected readonly enElServidor = this.autoReply.enElServidor;

  /** Si se puede elegir «Responder con IA» en este entorno. */
  protected readonly iaDisponible = this.autoReply.iaDisponible();

  /**
   * A quién representa la respuesta. Sin valor se toma de la sesión: una
   * cuenta de organización habla por «su organización».
   */
  readonly audiencia = input<'consultorio' | 'organizacion' | null>(null);

  /** A quién le llega la respuesta, según quién la manda. */
  protected readonly destinatario = computed(() =>
    this.sujeto() === 'su organización' ? 'quien le escribe' : 'el paciente',
  );

  /** El sujeto de los textos: lo único que cambia entre profesional y organización. */
  protected readonly sujeto = computed(() => {
    const audiencia =
      this.audiencia() ?? (this.session.isOrganizationAccount() ? 'organizacion' : 'consultorio');
    return audiencia === 'organizacion' ? 'su organización' : 'su consultorio';
  });

  /**
   * Lo que se está editando. Sigue a la configuración —cuando llega la del
   * servidor, la pantalla la muestra— y se aparta de ella al tocar un control.
   *
   * Si la configuración cambia **mientras hay cambios sin guardar** (la del
   * servidor llega tarde), se fusiona campo por campo ({@link fusionar}):
   * lo que la persona tocó se queda y lo demás se actualiza.
   */
  protected readonly borrador = linkedSignal<RespuestaAutomatica, Borrador>({
    source: this.config,
    computation: (config, anterior) =>
      anterior === undefined
        ? borradorDe(config)
        : fusionar(anterior.value, borradorDe(anterior.source), borradorDe(config)),
  });

  protected readonly modo = computed(() => this.borrador().modo);

  /** Hay cambios en pantalla que todavía no se guardaron. */
  protected readonly sinGuardar = computed(() => distintos(this.borrador(), borradorDe(this.config())));

  protected readonly esperas = ESPERAS;
  protected readonly minutosMinimo = MINUTOS_MINIMO;
  protected readonly minutosMaximo = MINUTOS_MAXIMO;
  protected readonly horasMinimo = HORAS_MINIMO;
  protected readonly horasMaximo = HORAS_MAXIMO;
  protected readonly largoMaximo = LARGO_MAXIMO;

  protected readonly restantes = computed(() => this.largoMaximo - this.borrador().texto.length);

  /** La confirmación de «Guardar», con palabras, o vacío. */
  protected readonly confirmacion = signal('');
  protected readonly errorDelTexto = signal('');
  /** El guardado está en vuelo, o falló. */
  protected readonly guardando = signal(false);
  protected readonly errorAlGuardar = signal('');

  /** Mientras se lee o se sube no se puede volver a guardar. */
  protected readonly ocupado = computed(() => this.guardando() || this.autoReply.sincronizando());
  protected readonly errorDeLectura = this.autoReply.errorDeLectura;

  /** Las propias, que son las únicas que se pueden quitar. */
  protected readonly plantillasPropias = this.plantillas.mias;
  protected readonly plantillasDeFabrica = PLANTILLAS_POR_DEFECTO;
  protected readonly plantillaNueva = signal('');

  /**
   * Enciende la mensajería para saber el perfil propio.
   *
   * La configuración cuelga del perfil público, así que sin él sólo se puede
   * guardar en este navegador — y eso cambia lo que la pantalla promete.
   */
  ngOnInit(): void {
    this.chat.iniciar();
  }

  constructor() {
    // El perfil se resuelve de forma asíncrona. Se espera a que esté resuelto
    // —con o sin perfil— para traer lo del servidor, que es lo que se está
    // aplicando de verdad. Antes se pedía en una microtarea, cuando el perfil
    // todavía era `null`: la pantalla nunca leía la configuración guardada.
    let cargado = false;
    effect(() => {
      if (cargado || !this.chat.perfilResuelto()) return;
      cargado = true;
      const perfil = this.perfil();
      untracked(() => this.autoReply.cargar(perfil));
    });
  }

  /**
   * El perfil **propio**, o `null` mientras no se resolvió.
   *
   * Nunca la vitrina con la que se esté escribiendo (`ChatStore.perfil()`):
   * esta pantalla configura la respuesta automática **de la persona** («estoy
   * de vacaciones») y su copia local es de la persona. La API también deja
   * configurar la de la farmacia (`PUT /community/profiles/:vitrina/auto-reply`),
   * pero esa es de la organización y no se edita desde las preferencias de
   * nadie: antes, con «Escribiendo como» en la farmacia, esta pantalla leía la
   * de la farmacia y le subía la personal encima.
   */
  private perfil(): string | null {
    return this.chat.perfilPropio();
  }

  /**
   * El nombre de la vitrina con la que se está escribiendo, si alguna: la
   * pantalla aclara que lo que se configura acá no se manda en su nombre.
   */
  protected readonly comoOrganizacion = computed<string | null>(() =>
    this.chat.actuandoComoOrganizacion()
      ? (this.chat.vitrinaDeOrganizacion()?.nombre ?? null)
      : null,
  );

  /* --- Borrador ------------------------------------------------------------ */

  protected elegirModo(modo: ModoDeRespuesta): void {
    if (modo === 'ia' && !this.iaDisponible) {
      return;
    }
    this.errorDelTexto.set('');
    this.cambiar({ modo });
  }

  protected escribirTexto(texto: string): void {
    this.cambiar({ texto });
    if (texto.trim() !== '') {
      this.errorDelTexto.set('');
    }
  }

  protected elegirEspera(minutos: number): void {
    this.cambiar({ minutos });
  }

  protected cambiarEspera(valor: string): void {
    this.cambiar({ minutos: Number(valor) });
  }

  protected cambiarDescanso(valor: string): void {
    this.cambiar({ horas: Number(valor) });
  }

  protected alternarHorario(soloFueraDeHorario: boolean): void {
    this.cambiar({ soloFueraDeHorario });
  }

  protected cambiarDesde(desde: string): void {
    this.cambiar({ desde });
  }

  protected cambiarHasta(hasta: string): void {
    this.cambiar({ hasta });
  }

  /** Usa una frase guardada como texto del mensaje. */
  protected usarPlantilla(plantilla: string): void {
    this.escribirTexto(plantilla);
  }

  /**
   * Vuelve lo avanzado —espera, descanso, franja— a lo recomendado, sin
   * guardarlo todavía. No toca la decisión de arriba ni el mensaje: el botón
   * vive dentro de «Más opciones» y promete eso.
   */
  protected restablecer(): void {
    const recomendado = borradorDe(CONFIGURACION_POR_DEFECTO);
    this.cambiar({
      minutos: recomendado.minutos,
      horas: recomendado.horas,
      soloFueraDeHorario: recomendado.soloFueraDeHorario,
      desde: recomendado.desde,
      hasta: recomendado.hasta,
    });
  }

  /** Vuelve a pedir lo guardado, después de una lectura fallida. */
  protected reintentarLectura(): void {
    this.autoReply.cargar(this.perfil());
  }

  /* --- Guardar ------------------------------------------------------------- */

  protected guardar(): void {
    if (this.ocupado()) return;
    const borrador = this.borrador();
    // Con mensaje fijo o con IA hace falta un texto: es lo que se manda, o lo
    // que se manda si la IA no responde. Sin él no hay respuesta posible.
    if (borrador.modo !== 'apagado' && borrador.texto.trim() === '') {
      this.errorDelTexto.set(
        borrador.modo === 'ia'
          ? 'Escriba el mensaje de respaldo: es el que se envía si la IA no está disponible.'
          : 'Escriba el mensaje que se va a enviar.',
      );
      return;
    }
    this.confirmacion.set('');
    this.errorAlGuardar.set('');
    this.guardando.set(true);
    this.autoReply.guardar(
      {
        activa: borrador.modo !== 'apagado',
        conIa: borrador.modo === 'ia',
        texto: borrador.texto,
        minutosDeInactividad: borrador.minutos,
        horasEntreAvisos: borrador.horas,
        soloFueraDeHorario: borrador.soloFueraDeHorario,
        horarioDesde: borrador.desde,
        horarioHasta: borrador.hasta,
      },
      this.perfil(),
      (llego) => {
        this.guardando.set(false);
        if (llego) {
          this.confirmacion.set(this.resumen(this.borrador().modo));
        } else {
          this.errorAlGuardar.set(
            'No pudimos guardar los cambios en su cuenta. Revise su conexión e intente de nuevo.',
          );
        }
      },
    );
    // La configuración guardada vuelve acotada (minutos fuera de rango, texto
    // con espacios): el borrador la sigue y muestra lo que de verdad quedó.
    this.borrador.set(borradorDe(this.config()));
  }

  private resumen(modo: ModoDeRespuesta): string {
    switch (modo) {
      case 'apagado':
        return 'Cambios guardados. No se responderá automáticamente.';
      case 'fijo':
        return 'Cambios guardados. Cuando no esté, se enviará su mensaje fijo.';
      case 'ia':
        return `Cambios guardados. Cuando no esté, la IA responderá en nombre de ${this.sujeto()}.`;
    }
  }

  private cambiar(cambios: Partial<Borrador>): void {
    this.borrador.update((actual) => ({ ...actual, ...cambios }));
    this.confirmacion.set('');
    this.errorAlGuardar.set('');
  }

  /* --- Frases guardadas ---------------------------------------------------- */

  protected agregarPlantilla(): void {
    this.plantillas.agregar(this.plantillaNueva());
    this.plantillaNueva.set('');
  }

  protected quitarPlantilla(texto: string): void {
    this.plantillas.quitar(texto);
  }
}
