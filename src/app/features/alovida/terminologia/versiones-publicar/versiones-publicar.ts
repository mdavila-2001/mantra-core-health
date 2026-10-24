/* V03-01·A · Publicar la versión
   Portada de V03-terminology/security-admin/V03-01-versiones-publicar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-alovida-terminologia-versiones-publicar',
  templateUrl: './versiones-publicar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaVersionesPublicar {}
