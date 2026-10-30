/* V06-07·A · Invalidar la caché del PDP
   Portada de V06-authz/security-admin/V06-07-cache-invalidar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-cache-invalidar',
  imports: [RouterLink],
  templateUrl: './cache-invalidar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosCacheInvalidar {}
