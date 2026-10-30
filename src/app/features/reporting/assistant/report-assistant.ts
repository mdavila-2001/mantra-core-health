import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import { errorToViewState } from '@core/http/error-to-view-state';
import { ETIQUETA_VERTICAL } from '@core/data-access/reporting/reporting-labels';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Badge } from '@shared/components/atoms/badge/badge';
import { Input } from '@shared/components/atoms/input/input';
import { Spinner } from '@shared/components/atoms/spinner/spinner';
import { Alert } from '@shared/components/molecules/alert/alert';

import { ReportContextStore } from '../state/report-context.store';
import { construirRespuesta } from './assistant-answer';
import { ReportAssistantData } from './assistant-data';
import {
  agregarAlHistorial,
  borrarHistorialGuardado,
  guardarHistorial,
  leerHistorial,
} from './assistant-history';
import type { Mensaje, MensajeAsistente, SugerenciaMedida } from './assistant.types';
import { SUGERENCIAS_INICIALES } from './question-lexicon';
import {
  construirCatalogo,
  MAX_CARACTERES_PREGUNTA,
  normalizar,
  pideDatosDePersonas,
  resolverPregunta,
  type CatalogoIndexado,
  type MedidaIndexada,
} from './question-resolver';

/**
 * «Pregúntale a tus reportes» (MAQUETA). Un chat dentro del portal de
 * reportería: no es el centro, es un atajo hacia la medida que ya vive en una
 * pestaña.
 *
 * Reglas que no se rompen aquí:
 *  · No escribe cifras: pide las pestañas al mismo `ReportingClient` y con el
 *    mismo contexto que el resto del portal, y cita el KPI tal cual.
 *  · No hay modelo de lenguaje: un resolvedor determinista busca la medida más
 *    parecida (`question-resolver.ts`) y la pantalla lo dice («Respuestas de
 *    ejemplo»).
 *  · Solo lectura: contesta o navega al reporte; no modifica nada.
 */
@Component({
  selector: 'app-report-assistant',
  imports: [Alert, AppButton, AppButtonLink, Badge, Input, RouterLink, Spinner],
  templateUrl: './report-assistant.html',
  styleUrl: './report-assistant.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown)': 'alTeclear($event)' },
})
export class ReportAssistant {
  private readonly store = inject(ReportContextStore);
  private readonly datos = inject(ReportAssistantData);
  private readonly session = inject(SessionStore);
  private readonly injector = inject(Injector);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly registro = viewChild<ElementRef<HTMLElement>>('registro');

  protected readonly sugerenciasIniciales = SUGERENCIAS_INICIALES;
  protected readonly maxCaracteres = MAX_CARACTERES_PREGUNTA;

  protected readonly mensajes = signal<readonly Mensaje[]>([]);
  protected readonly borrador = signal('');
  protected readonly respondiendo = signal(false);
  protected readonly avisoEntrada = signal<string | null>(null);
  protected readonly historial = signal<readonly string[]>([]);
  protected readonly hayMensajes = computed(() => this.mensajes().length > 0);

  private siguienteId = 1;

  constructor() {
    // Leer el almacenamiento al montar, no al construir: en el servidor no
    // existe y en el cliente cambiaría el HTML que ya se hidrató.
    afterNextRender(() => this.historial.set(leerHistorial(this.session.userId())));
  }

  /** Lleva el foco a la caja de la pregunta (el portal lo usa al abrir el panel). */
  focus(): void {
    this.anfitrion.nativeElement.querySelector<HTMLInputElement>('input.native-input')?.focus();
  }

  protected alEscribir(valor: string | number | null): void {
    this.borrador.set(String(valor ?? ''));
    this.avisoEntrada.set(null);
  }

  protected alTeclear(evento: KeyboardEvent): void {
    // Enter envía, pero solo desde la caja de la pregunta (en un botón, Enter ya es su clic);
    // durante una composición (IME) es solo "aceptar la palabra".
    const origen = evento.target;
    if (
      evento.key === 'Enter' &&
      !evento.isComposing &&
      origen instanceof HTMLInputElement &&
      origen.classList.contains('native-input')
    ) {
      evento.preventDefault();
      this.enviar();
    }
  }

  protected enviar(): void {
    if (this.respondiendo()) {
      return;
    }
    const texto = this.borrador().trim().slice(0, MAX_CARACTERES_PREGUNTA);
    if (texto === '') {
      this.avisoEntrada.set('Escriba una pregunta primero, por ejemplo «¿Cuál es el MRR?».');
      return;
    }
    this.borrador.set('');
    void this.preguntar(texto);
  }

  protected preguntarSugerencia(texto: string): void {
    if (!this.respondiendo()) {
      void this.preguntar(texto);
    }
  }

  protected elegirMedida(medida: SugerenciaMedida): void {
    if (!this.respondiendo()) {
      void this.preguntar(medida.titulo, medida);
    }
  }

  protected reintentar(mensaje: MensajeAsistente): void {
    if (this.respondiendo() || mensaje.tipo !== 'error' || mensaje.reintento === null) {
      return;
    }
    const { pregunta, medida } = mensaje.reintento;
    this.mensajes.update((lista) => lista.filter((m) => m.id !== mensaje.id));
    void this.responder(pregunta, medida);
  }

  protected borrarHistorial(): void {
    this.historial.set([]);
    borrarHistorialGuardado(this.session.userId());
  }

  protected nombres(verticales: readonly string[] | undefined): string {
    return (verticales ?? []).join(', ');
  }

  /* ---- flujo ------------------------------------------------------------------------ */

  private async preguntar(texto: string, medida: SugerenciaMedida | null = null): Promise<void> {
    this.agregar({ id: this.siguienteId++, rol: 'usuario', texto });
    // Una pregunta por personas se rechaza y NO se recuerda: no hay motivo para
    // guardar en el navegador un intento de pedir datos que el reporte no tiene.
    if (!(medida === null && pideDatosDePersonas(normalizar(texto)))) {
      this.historial.update((h) => agregarAlHistorial(h, texto));
      guardarHistorial(this.session.userId(), this.historial());
    }
    await this.responder(texto, medida);
  }

  private async responder(pregunta: string, medida: SugerenciaMedida | null): Promise<void> {
    this.respondiendo.set(true);
    const contexto = this.store.contexto();
    try {
      // Una pregunta por personas no necesita ir a buscar nada: se rechaza antes de pedir datos.
      if (medida === null && pideDatosDePersonas(normalizar(pregunta))) {
        this.agregar({ id: this.siguienteId++, rol: 'asistente', tipo: 'personas' });
        return;
      }
      const { pestanas, faltantes } = await this.datos.todas(contexto);
      const noRevisadas = faltantes.length > 0 ? faltantes.map((v) => ETIQUETA_VERTICAL[v]) : undefined;
      const catalogo = construirCatalogo(pestanas);
      const id = this.siguienteId++;
      const base = { id, rol: 'asistente' as const, ...(noRevisadas === undefined ? {} : { noRevisadas }) };

      if (catalogo.length === 0) {
        this.agregar({ ...base, tipo: 'catalogo-vacio' });
        return;
      }
      const resolucion = medida === null ? resolverPregunta(pregunta, catalogo) : this.directa(medida, catalogo);
      switch (resolucion.tipo) {
        case 'vacia':
          this.agregar({ ...base, tipo: 'sin-pregunta' });
          break;
        case 'personas':
          this.agregar({ ...base, tipo: 'personas' });
          break;
        case 'ambigua':
          this.agregar({ ...base, tipo: 'ambigua', medidas: resolucion.opciones.map((m) => this.sugerencia(m)) });
          break;
        case 'sin-medida':
          this.agregar({ ...base, tipo: 'sin-medida', medidas: resolucion.sugerencias.map((m) => this.sugerencia(m)) });
          break;
        case 'medida': {
          const pestana = pestanas.find((p) => p.pestana === resolucion.medida.pestana);
          const kpi = pestana?.kpis.find((k) => k.id === resolucion.medida.kpiId);
          if (pestana === undefined || kpi === undefined) {
            this.agregar({ ...base, tipo: 'sin-medida', medidas: [] });
          } else {
            this.agregar({ ...base, tipo: 'respuesta', respuesta: construirRespuesta(kpi, pestana, contexto) });
          }
          break;
        }
      }
    } catch (error) {
      this.agregar(this.mensajeDeError(error, pregunta, medida));
    } finally {
      this.respondiendo.set(false);
    }
  }

  private directa(medida: SugerenciaMedida, catalogo: CatalogoIndexado) {
    const encontrada = catalogo.find((m) => m.pestana === medida.pestana && m.kpiId === medida.kpiId);
    return encontrada === undefined
      ? ({ tipo: 'sin-medida', sugerencias: [] } as const)
      : ({ tipo: 'medida', medida: encontrada, puntaje: 0 } as const);
  }

  private sugerencia(m: MedidaIndexada): SugerenciaMedida {
    return {
      pestana: m.pestana,
      kpiId: m.kpiId,
      titulo: m.titulo,
      etiquetaPestana: ETIQUETA_VERTICAL[m.pestana],
    };
  }

  /** El error crudo nunca llega a la pantalla: se traduce a qué pasó y qué hacer. */
  private mensajeDeError(error: unknown, pregunta: string, medida: SugerenciaMedida | null): MensajeAsistente {
    const base = { id: this.siguienteId++, rol: 'asistente' as const, tipo: 'error' as const };
    const reintento = { pregunta, medida };
    const estado = errorToViewState<never>(error);
    if (estado.status === 'forbidden') {
      return {
        ...base,
        estado: 'forbidden',
        mensaje: 'Su cuenta no tiene permiso para consultar estos reportes. Pida acceso a quien administra su organización.',
        requestId: estado.requestId ?? null,
        reintento: null,
      };
    }
    if (estado.status === 'offline') {
      return {
        ...base,
        estado: 'offline',
        mensaje: 'No hay conexión con el servidor. Revise su conexión e inténtelo de nuevo.',
        requestId: null,
        reintento,
      };
    }
    return {
      ...base,
      estado: 'error',
      mensaje: 'No pude buscar en sus reportes. Inténtelo de nuevo; si sigue igual, comparte el código de la petición con soporte.',
      requestId: estado.status === 'error' && estado.requestId !== 'sin-id' ? estado.requestId : null,
      reintento,
    };
  }

  private agregar(mensaje: Mensaje): void {
    this.mensajes.update((lista) => [...lista, mensaje]);
    // Que se vea el principio de lo nuevo (una respuesta larga no debe
    // arrancar a media tarjeta). Solo se desplaza el registro, nunca la página.
    afterNextRender(
      () => {
        const registro = this.registro()?.nativeElement;
        const todos = registro?.querySelectorAll<HTMLElement>('[data-mensaje]');
        const ultimo = todos?.item(todos.length - 1) ?? null;
        if (registro !== undefined && ultimo !== null) {
          registro.scrollTop = ultimo.offsetTop - registro.offsetTop;
        }
      },
      { injector: this.injector },
    );
  }
}
