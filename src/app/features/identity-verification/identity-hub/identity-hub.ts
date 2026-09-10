import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { VerificationCases } from '../../identity-assurance/verification-cases/verification-cases';
import { IdentityVerification } from '../identity-verification';

/** Las dos pestañas, en el orden en que se usan: primero se pide, después se sigue. */
const PESTANAS = ['Verificar', 'Mis trámites'] as const;

/** El índice con nombre, para no escribir `1` donde se quiere decir «trámites». */
const PESTANA = { verificar: 0, tramites: 1 } as const;

/**
 * **Verificación de identidad** — el trámite y su seguimiento, en una pantalla.
 *
 * ## Por qué existe
 *
 * Eran dos rutas —`my-account/identity/verify` y `my-account/identity/cases`—
 * que mostraban **los mismos tres trámites**: la primera los repetía abajo del
 * formulario en una tarjeta «Tus trámites anteriores», y la segunda era la
 * tabla completa. Quien entraba por una no sabía que existía la otra, y quien
 * entraba por las dos veía lo mismo dos veces. El propietario lo dijo el
 * 2026-09-10: «debe estar unido en uno solo».
 *
 * ## Qué NO se reescribió
 *
 * Las dos pantallas siguen siendo las mismas clases, con su lógica, sus
 * pruebas y sus rutas propias intactas. Acá se montan como pestañas y se les
 * pide, con `embedded`, que no dibujen su membrete — el membrete es uno solo y
 * es de esta pantalla. Reescribir 660 líneas de lógica de subida de archivos y
 * de tabla para lograr un cambio de disposición habría sido cambiar el riesgo
 * de lugar sin necesidad.
 *
 * ## La pestaña vive en la URL
 *
 * `?tab=cases` abre directamente el seguimiento, y las dos rutas viejas
 * redirigen acá con ese parámetro puesto: un enlace guardado en un correo de
 * hace tres meses tiene que seguir abriendo lo que abría.
 */
@Component({
  selector: 'app-identity-hub',
  imports: [Card, IdentityVerification, PageHeader, Tab, Tabs, VerificationCases],
  templateUrl: './identity-hub.html',
  styleUrl: './identity-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityHub {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  protected readonly pestanas = PESTANAS;
  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly pestana = signal<number>(
    this.route.snapshot.queryParamMap.get('tab') === 'cases'
      ? PESTANA.tramites
      : PESTANA.verificar,
  );

  /**
   * Cambia de pestaña y lo deja escrito en la URL.
   *
   * `replaceUrl` para no llenar el historial: volver atrás desde acá tiene que
   * salir de la pantalla, no recorrer las pestañas que se miraron.
   */
  protected elegirPestana(indice: number): void {
    this.pestana.set(indice);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: indice === PESTANA.tramites ? 'cases' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
