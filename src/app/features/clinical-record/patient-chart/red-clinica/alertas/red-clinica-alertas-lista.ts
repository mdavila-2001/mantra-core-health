import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type {
  AlertaDeApoyo,
  PrioridadDeAlerta,
  TipoDeAlerta,
} from '../red-clinica-alertas';

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

  readonly nodoElegido = output<string>();
  /** Los nodos a resaltar en la red mientras la alerta tiene puntero o foco. */
  readonly resaltar = output<readonly string[]>();

  protected readonly todas = signal(false);
  protected readonly icono = ICONO_DE_TIPO;
  protected readonly prioridad = TEXTO_DE_PRIORIDAD;

  protected readonly aLaVista = computed(() =>
    this.todas() ? this.alertas() : this.alertas().slice(0, ALERTAS_A_LA_VISTA),
  );
  protected readonly ocultas = computed(() => Math.max(0, this.alertas().length - ALERTAS_A_LA_VISTA));
  protected readonly altas = computed(() => this.alertas().filter((a) => a.prioridad === 'alta').length);

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
