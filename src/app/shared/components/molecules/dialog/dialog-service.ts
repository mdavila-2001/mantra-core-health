import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  createComponent,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Injectable,
  isDevMode,
  PLATFORM_ID,
} from '@angular/core';

import { Dialog } from './dialog';
import type { DialogConfig, DialogReasonConfig, DialogResult } from './dialog.types';
import { CONFIRMAR_CAMBIOS, CONFIRMAR_DESCARTE } from './dialog.types';

/**
 * Abre confirmaciones sin que la pantalla tenga que declarar el diálogo.
 *
 * ```ts
 * const confirmado = await this.dialogs.confirm({
 *   title: 'Anular la orden',
 *   message: 'La orden queda anulada y el laboratorio deja de verla.',
 *   confirmLabel: 'Anular',
 *   destructive: true,
 * });
 * ```
 *
 * Devuelve una promesa y no un observable: una confirmación se responde **una
 * vez**, y el repo no usa RxJS fuera de lo que trae Angular.
 *
 * Al cerrar, el foco vuelve al elemento que lo abrió: sin eso, quien navega
 * con teclado queda parado en el `<body>` después de confirmar.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async confirm(config: DialogConfig): Promise<boolean> {
    const { confirmed } = await this.open(config);
    return confirmed;
  }

  /**
   * La confirmación de un **guardado** (D-08, ADR-0015): «¿Confirmás estos
   * cambios?», con los textos de {@link CONFIRMAR_CAMBIOS} y lo que se le pase
   * encima.
   *
   * Es azúcar sobre {@link confirm} y no otra cosa: mismo `<dialog>`, mismo
   * foco de vuelta, misma promesa. Existe para que los veintitantos «Guardar»
   * de la casa pregunten **lo mismo con las mismas palabras** sin que cada
   * pantalla copie el título; y para que `confirm()` —que veintiséis archivos
   * ya usan para destruir— no cambie de comportamiento para nadie.
   *
   * ```ts
   * protected async guardar(): Promise<void> {
   *   if (!(await this.dialogs.confirmarCambios())) {
   *     return;                       // el foco vuelve solo al botón «Guardar»
   *   }
   *   this.perfil.actualizar(this.borrador()).subscribe(…);
   * }
   * ```
   *
   * Llamado desde un botón dentro de un `app-content-dialog`, el `confirm` se
   * apila encima (dos `showModal()`; el navegador lo resuelve en la capa
   * superior) y al cerrarse devuelve el foco al botón que lo disparó, porque
   * {@link open} guarda `document.activeElement` antes de montar nada.
   */
  confirmarCambios(opciones: Partial<DialogConfig> = {}): Promise<boolean> {
    return this.confirm({ ...CONFIRMAR_CAMBIOS, ...opciones });
  }

  /**
   * La confirmación de un **descarte**: «¿Descartás lo que escribiste?», con
   * los textos de {@link CONFIRMAR_DESCARTE}. Es la respuesta a
   * `dismissAttempt` de `app-content-dialog` cuando hay cambios sin guardar:
   *
   * ```ts
   * protected async preguntarSiSeDescarta(): Promise<void> {
   *   if (!this.hayCambios() || (await this.dialogs.confirmarDescarte())) {
   *     this.cerrar();
   *   }
   * }
   * ```
   *
   * Sin cambios no se pregunta nada: un diálogo que confirma el descarte de
   * nada es un trámite, no una protección.
   */
  confirmarDescarte(opciones: Partial<DialogConfig> = {}): Promise<boolean> {
    return this.confirm({ ...CONFIRMAR_DESCARTE, ...opciones });
  }

  /**
   * Confirma **exigiendo un motivo**, y lo devuelve (corrección #14).
   *
   * ```ts
   * const motivo = await this.dialogs.confirmWithReason(
   *   { title: 'Cancelar el turno', message: '…', confirmLabel: 'Cancelar el turno' },
   *   { label: 'Motivo', hint: 'Tu médico lo va a ver' },
   * );
   * if (motivo === null) return;   // se arrepintió
   * ```
   *
   * Devuelve `null` si no se confirmó, y nunca una cadena vacía: el diálogo no
   * deja confirmar sin texto suficiente, así que quien recibe un `string` puede
   * mandarlo al servidor sin volver a comprobarlo.
   */
  async confirmWithReason(
    config: DialogConfig,
    reason: DialogReasonConfig,
  ): Promise<string | null> {
    const resultado = await this.open({ ...config, reason });
    return resultado.confirmed ? (resultado.reason ?? null) : null;
  }

  /**
   * Monta el diálogo, espera su resultado y lo desmonta.
   *
   * Es el único lugar que toca el DOM: las dos entradas públicas se distinguen
   * por lo que piden y por lo que devuelven, no por cómo se abren.
   */
  private open(config: DialogConfig): Promise<DialogResult> {
    if (!this.isBrowser) {
      // En el servidor no hay quién confirme: se resuelve que no y se avisa.
      if (isDevMode()) {
        console.warn(
          '[DialogService] diálogo en el servidor: no hay quién responda, devuelve «cancelado».',
        );
      }
      return Promise.resolve({ confirmed: false });
    }

    const origen = this.document.activeElement;

    return new Promise<DialogResult>((resolve) => {
      const dialog = createComponent(Dialog, {
        environmentInjector: this.environmentInjector,
      });
      dialog.setInput('config', config);

      const subscripcion = dialog.instance.resolved.subscribe((resultado: DialogResult) => {
        subscripcion.unsubscribe();
        this.applicationRef.detachView(dialog.hostView);
        dialog.destroy();
        dialog.location.nativeElement.remove();
        this.returnFocus(origen);
        resolve(resultado);
      });

      this.applicationRef.attachView(dialog.hostView);
      this.document.body.appendChild(dialog.location.nativeElement);
    });
  }

  private returnFocus(origen: Element | null): void {
    if (origen instanceof HTMLElement && origen.isConnected) {
      origen.focus();
    }
  }
}
