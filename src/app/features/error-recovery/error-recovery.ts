import { ChangeDetectionStrategy, Component, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { BUILD_INFO, buildLabel } from '../../core/build/build-info';
import { ErrorReporter } from '../../core/errors/error-reporter';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';

/**
 * Lo que se ve cuando algo se rompió y no hubo petición que culpar.
 *
 * Es la contraparte del estado **S9** para los fallos que no son de red: un
 * error de render no produce `requestId` porque nunca hubo petición, y hasta
 * ahora dejaba la pantalla en blanco sin nada que reportar.
 *
 * Muestra las dos cosas que hacen falta para que el fallo sea accionable:
 *
 * - el **código de soporte** que generó {@link ErrorReporter}, copiable como el
 *   de S9;
 * - la **versión del artefacto**, porque un código sin versión no dice contra
 *   qué código comparar.
 *
 * Y ofrece recargar, que es lo que resuelve el caso más frecuente en
 * producción: un fragmento diferido que ya no existe tras un despliegue.
 */
@Component({
  selector: 'app-error-recovery',
  imports: [AppButton, Alert],
  templateUrl: './error-recovery.html',
  styleUrl: './error-recovery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorRecovery {
  private readonly reporter = inject(ErrorReporter);
  private readonly build = inject(BUILD_INFO);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly ultimo = this.reporter.ultimo;
  protected readonly version = buildLabel(this.build);

  /** El código de soporte, o `null` si se llegó acá sin un fallo registrado. */
  protected readonly codigo = computed(() => this.ultimo()?.id ?? null);

  /**
   * Recarga desde el servidor.
   *
   * Es lo que resuelve el chunk fallido: baja el `index.html` nuevo, que apunta
   * a los fragmentos que sí existen. Una navegación del router no alcanzaría,
   * porque el problema está en el paquete ya cargado.
   */
  protected recargar(): void {
    if (this.isBrowser) {
      location.reload();
    }
  }

  /**
   * Copia el código al portapapeles.
   *
   * Mismo criterio que en `ViewStateHost`: si el navegador no deja (contexto no
   * seguro), el código sigue visible y seleccionable. Copiar es comodidad,
   * verlo es el requisito.
   */
  protected async copiar(): Promise<void> {
    const codigo = this.codigo();
    if (codigo === null || !this.isBrowser || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${codigo} · ${this.version}`);
    } catch {
      // El código queda visible: no hay nada que recuperar acá.
    }
  }
}
