import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { LecturasComprobadas } from '../lecturas/red-clinica-lecturas';
import type { PrioridadDeAlerta } from '../red-clinica-alertas';
import type { AlertaDeApoyo, TipoDeAlerta } from '../red-clinica-alertas.types';

/** Cuántas se ven antes de «Ver todas». */
export const ALERTAS_A_LA_VISTA = 5;

const ICONO_DE_TIPO: Readonly<Record<TipoDeAlerta, NavIconName>> = {
  'resultado-critico': 'flask',
  'resultado-fuera-de-rango': 'flask',
  'presuntivo-sin-resolver': 'heart',
  'estudio-sin-resultado': 'clock',
  'derivacion-sin-respuesta': 'route',
  'derivacion-sin-contrarreferencia': 'route',
  'diagnostico-repetido': 'history',
  'motivo-repetido': 'history',
};

const TEXTO_DE_PRIORIDAD: Readonly<Record<PrioridadDeAlerta, string>> = {
  alta: 'Prioridad alta',
  media: 'Prioridad media',
  baja: 'Para tener presente',
};

/**
 * **Alertas de apoyo de la red clínica.**
 *
 * Lista lo que `alertasDeApoyo()` encontró. Cada alerta es un botón: el clic
 * emite `nodoElegido` (el padre abre ese nodo en el panel y lo centra en el
 * mapa); pasar el puntero o el foco emite `resaltar` con todos sus nodos, y
 * salir emite `[]`.
 *
 * Las alertas no sugieren diagnósticos: señalan registros abiertos, repetidos
 * o fuera de rango. El pie lo dice, para que nadie las lea como otra cosa.
 *
 * ```html
 * <app-red-clinica-alertas-lista [alertas]="alertas()"
 *   (nodoElegido)="abrir($event)" (resaltar)="resaltados.set($event)" />
 * ```
 */
@Component({
  selector: 'app-red-clinica-alertas-lista',
  imports: [AppButton, NavIcon],
  templateUrl: './red-clinica-alertas-lista.html',
  styleUrl: './red-clinica-alertas-lista.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaAlertasLista {
  readonly alertas = input<readonly AlertaDeApoyo[]>([]);
  /** Título de la sección; el padre puede cambiarlo («Pendientes del episodio»). */
  readonly titulo = input('Para revisar');
  /**
   * Plegada en un resumen («5 alertas · 2 de prioridad alta») que se despliega
   * con un botón (`aria-expanded`), y sin recuadro propio: para ir dentro de
   * otra superficie sin empujar lo que viene debajo (el mapa del Recorrido).
   */
  readonly compacta = input(false, { transform: booleanAttribute });
  /** Which readings arrived whole: the empty text only asserts absences over those. */
  readonly comprobadas = input<LecturasComprobadas>({ ordenes: true, informes: true, derivaciones: true });

  readonly nodoElegido = output<string>();
  /** Los nodos a resaltar en la red mientras la alerta tiene puntero o foco. */
  readonly resaltar = output<readonly string[]>();

  protected readonly todas = signal(false);
  /** Compacta: si la lista está desplegada. Arranca plegada. */
  protected readonly abierta = signal(false);
  /** Lo que se ve: siempre, salvo compacta y plegada. */
  protected readonly lista = computed(() => !this.compacta() || this.abierta());
  protected readonly icono = ICONO_DE_TIPO;
  protected readonly prioridad = TEXTO_DE_PRIORIDAD;

  protected readonly aLaVista = computed(() =>
    this.todas() ? this.alertas() : this.alertas().slice(0, ALERTAS_A_LA_VISTA),
  );
  protected readonly ocultas = computed(() => Math.max(0, this.alertas().length - ALERTAS_A_LA_VISTA));
  protected readonly altas = computed(() => this.alertas().filter((a) => a.prioridad === 'alta').length);

  /** «Nothing open» says only what was checked; what could not be read is named. */
  protected readonly textoVacio = computed(() => {
    const { informes, derivaciones } = this.comprobadas();
    const revisado = [
      'sin presuntivos por resolver',
      ...(informes ? ['estudios sin resultado'] : []),
      ...(derivaciones ? ['derivaciones pendientes'] : []),
    ].join(', ');
    const sinLeer = [...(informes ? [] : ['los estudios']), ...(derivaciones ? [] : ['las derivaciones'])];
    return (
      `Nada abierto en los registros a la vista: ${revisado} ni valores fuera de rango en los informes abiertos.` +
      (sinLeer.length === 0 ? '' : ` Sin revisar ${sinLeer.join(' ni ')}: no se pudieron leer completos.`)
    );
  });

  protected elegir(alerta: AlertaDeApoyo): void {
    this.nodoElegido.emit(alerta.nodoId);
  }

  protected entrar(alerta: AlertaDeApoyo): void {
    this.resaltar.emit(alerta.nodoIds);
  }

  protected salir(): void {
    this.resaltar.emit([]);
  }
}
