import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { LecturasComprobadas } from '../lecturas/red-clinica-lecturas';
import type { PrioridadDeAlerta } from '../red-clinica-alertas';
import type { AlertaDeApoyo, TipoDeAlerta } from '../red-clinica-alertas.types';

/** How many show before «Ver todas». */
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
 * **The clinical network's support alerts.**
 *
 * Lists what `alertasDeApoyo()` found. Each alert is a button: the click emits
 * `nodoElegido` (the parent opens that node in the panel and centres it on the
 * map); pointer or focus over it emits `resaltar` with all its nodes, and
 * leaving emits `[]`.
 *
 * The alerts do not suggest diagnoses: they point at open, repeated or
 * out-of-range records. The footer says so, so nobody reads them otherwise.
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
  /** The section title; the parent can change it («Pendientes del episodio»). */
  readonly titulo = input('Para revisar');
  /**
   * Folded into a summary («5 alertas · 2 de prioridad alta») that unfolds
   * with a button (`aria-expanded`), and with no box of its own: to sit inside
   * another surface without pushing what comes below (the Tour's map).
   */
  readonly compacta = input(false, { transform: booleanAttribute });
  /** Which readings arrived whole: the empty text only asserts absences over those. */
  readonly comprobadas = input<LecturasComprobadas>({ ordenes: true, informes: true, derivaciones: true });

  readonly nodoElegido = output<string>();
  /** The nodes to highlight on the network while the alert has pointer or focus. */
  readonly resaltar = output<readonly string[]>();

  protected readonly todas = signal(false);
  /** Compact: whether the list is unfolded. It starts folded. */
  protected readonly abierta = signal(false);
  /** What shows: always, except compact and folded. */
  protected readonly lista = computed(() => !this.compacta() || this.abierta());
  protected readonly icono = ICONO_DE_TIPO;
  protected readonly prioridad = TEXTO_DE_PRIORIDAD;

  protected readonly aLaVista = computed(() =>
    this.todas() ? this.alertas() : this.alertas().slice(0, ALERTAS_A_LA_VISTA),
  );
  protected readonly ocultas = computed(() => Math.max(0, this.alertas().length - ALERTAS_A_LA_VISTA));
  protected readonly altas = computed(() => this.alertas().filter((a) => a.prioridad === 'alta').length);
  /**
   * Out-of-range alerts only exist once a report is opened (its values are
   * read on opening): the summary names them, or the count grows unexplained.
   */
  protected readonly deInformes = computed(() => this.alertas().filter((a) => a.tipo.startsWith('resultado-')).length);

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
