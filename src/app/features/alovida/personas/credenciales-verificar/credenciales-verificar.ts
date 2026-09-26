/* V05-06·A · Verificar la credencial
   Portada de V05-profiles/security-admin/V05-06-credenciales-verificar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-alovida-personas-credenciales-verificar',
  templateUrl: './credenciales-verificar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasCredencialesVerificar {}
