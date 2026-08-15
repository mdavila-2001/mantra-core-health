import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { HelpBlockDismissalStore } from '../../../../core/tutorials/help-block-dismissal.store';
import { TutorialEngine } from '../../../../core/tutorials/tutorial.engine';
import { AppButton } from '../../atoms/button/button';
import { Alert } from '../alert/alert';

/**
 * El bloque de ayuda que el carril 05 pide arriba de cada pestaña: para qué
 * sirve, un ejemplo concreto (ambos proyectados como contenido) y, si la
 * pantalla tiene un tutorial guiado registrado, un botón para verlo.
 *
 * No inventa un mecanismo de "cerrado" nuevo: compone `<app-alert
 * dismissible>` — ya usado así en el showcase de diseño — con
 * {@link HelpBlockDismissalStore}, que sigue el mismo patrón de persistencia
 * por cuenta que {@link TutorialProgressStore}. El tutorial lo dispara
 * {@link TutorialEngine.start}, el mismo motor que ya usa el resto de la app.
 *
 * ```html
 * <app-tab-help-block helpId="perfil-trayectoria-ayuda" tutorialId="perfil-profesional">
 *   <p>Acá se arma la línea de tiempo profesional: formación, dónde ejerció y dónde ejerce hoy.</p>
 *   <p><strong>Ejemplo:</strong> formación en la UMSA (2010), Hospital Obrero N.º 1 (2012–2016), hoy en Sede Central Sopocachi.</p>
 * </app-tab-help-block>
 * ```
 */
@Component({
  selector: 'app-tab-help-block',
  imports: [Alert, AppButton],
  templateUrl: './tab-help-block.html',
  styleUrl: './tab-help-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabHelpBlock {
  private readonly dismissals = inject(HelpBlockDismissalStore);
  private readonly tutorials = inject(TutorialEngine);

  /** Identificador único del bloque: la clave con la que se recuerda el cierre. */
  readonly helpId = input.required<string>();
  readonly title = input('Para qué sirve esta pestaña');
  /** Id del tutorial registrado en `core/tutorials/definitions`, si hay uno. */
  readonly tutorialId = input<string>();

  protected readonly oculto = computed(() => this.dismissals.isDismissed(this.helpId()));

  protected cerrar(): void {
    this.dismissals.dismiss(this.helpId());
  }

  protected verTutorial(): void {
    const id = this.tutorialId();
    if (id !== undefined) {
      void this.tutorials.start(id);
    }
  }
}
