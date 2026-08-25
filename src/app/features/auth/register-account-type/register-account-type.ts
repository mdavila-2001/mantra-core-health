import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AccountIcon } from '../../../shared/components/atoms/account-icon/account-icon';
import type { AccountIconName } from '../../../shared/components/atoms/account-icon/account-icon.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';

/** Una tarjeta de la rejilla: a dónde lleva y qué promete. */
interface TipoDeCuenta {
  readonly icono: AccountIconName;
  readonly titulo: string;
  readonly detalle: string;
  readonly ruta: string;
  readonly testId: string;
}

/**
 * Los tres tipos de cuenta que se dan de alta solos.
 *
 * **No hay «Otro».** La API tiene tres altas públicas —paciente, profesional y
 * organización aseguradora— y ninguna cuarta. Una tarjeta que no lleva a
 * ningún lado es peor que no ofrecerla: quien la pulsa ya decidió que ésa era
 * su opción, y descubrir que no existe lo deja sin ninguna.
 *
 * **Dice «Aseguradora» y no «Organización»** porque `register-organization`
 * crea un tenant `PAYER` y sólo ése. El día que el alta pública acepte clínicas
 * o farmacias, la etiqueta se amplía con el backend, no antes.
 */
const TIPOS: readonly TipoDeCuenta[] = [
  {
    icono: 'patient',
    titulo: 'Paciente',
    detalle: 'Tu historia clínica, tus turnos y tus estudios, siempre con vos.',
    ruta: '/auth/register/patient',
    testId: 'tipo-paciente',
  },
  {
    icono: 'practitioner',
    titulo: 'Médico',
    detalle: 'Atendé, recetá y llevá tu agenda. Necesitás matrícula y colegio.',
    ruta: '/auth/register/practitioner',
    testId: 'tipo-profesional',
  },
  {
    icono: 'insurer',
    titulo: 'Aseguradora',
    detalle: 'Registrá tu organización y administrá el padrón de tus afiliados.',
    ruta: '/auth/register/organization',
    testId: 'tipo-aseguradora',
  },
];

/**
 * **Elegir tipo de cuenta** — la primera pantalla de «crear cuenta».
 *
 * ## Por qué una rejilla y no las pestañas que había
 *
 * El registro presentaba los tipos como un `role="tablist"` **encima del
 * formulario**: se veía la primera pestaña ya cargada con sus trece campos, y la
 * elección quedaba compitiendo con ellos por la atención. Peor: al ser dos
 * pestañas de una misma pantalla, los dos formularios convivían en un componente
 * de 578 líneas de plantilla.
 *
 * Separarlo en una pantalla de elección y una por tipo hace tres cosas: la
 * decisión ocurre sin ruido, cada alta tiene su URL —se puede enlazar «registrate
 * como doctor» desde una campaña— y cada formulario vive en su archivo.
 *
 * ## Enlaces, no botones
 *
 * Cada tarjeta es un `<a routerLink>`. Un botón con `navigate()` haría lo mismo
 * al hacer clic y perdería todo lo demás: abrir en otra pestaña, copiar la
 * dirección, el menú contextual, y el anuncio de «enlace» del lector de
 * pantalla. Navegar es lo que hacen los enlaces.
 */
@Component({
  selector: 'app-register-account-type',
  imports: [RouterLink, AccountIcon, AuthSplit, Link],
  templateUrl: './register-account-type.html',
  styleUrl: './register-account-type.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterAccountType {
  protected readonly tipos = TIPOS;
}
