/* V02-05·A · Verificar el punto de contacto
   Portada de V02-common/sesion-autenticada/V02-05-puntos-de-contacto-verificar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-puntos-de-contacto-verificar',
  imports: [RouterLink],
  templateUrl: './puntos-de-contacto-verificar.html',
})
export class DatosCompartidosPuntosDeContactoVerificar {}
