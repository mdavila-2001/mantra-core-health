import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AccountIcon } from '../../../shared/components/atoms/account-icon/account-icon';
import type { AccountIconName } from '../../../shared/components/atoms/account-icon/account-icon.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';

/**
 * El tono de una tarjeta. Son los cuatro tríos de estado del sistema
 * (`--st-*-bg|fg|bd`), que ya traen su versión oscura y su contraste medido:
 * cada tipo tiene su color sin que esta pantalla elija un solo valor. El ámbar
 * no está a propósito: es el punto de acción único del producto.
 */
type TypeTone = 'primary' | 'secondary' | 'success' | 'info';

/** Una tarjeta de la rejilla: a dónde lleva y qué promete. */
interface TipoDeCuenta {
  readonly icono: AccountIconName;
  readonly tone: TypeTone;
  readonly titulo: string;
  readonly detalle: string;
  readonly ruta: string;
  readonly testId: string;
}

/**
 * Las cuentas de persona que se dan de alta solas: paciente, médico y
 * secretaria (personal de apoyo).
 *
 * **No hay «Otro».** Cada tarjeta lleva a una pantalla de alta que existe. Una
 * que no llevara a ningún lado sería peor que no ofrecerla: quien la pulsa ya
 * decidió que ésa era su opción, y descubrir que no existe lo deja sin ninguna.
 *
 * **Dice «Aseguradora» y no «Organización»** porque `register-organization`
 * crea un tenant `PAYER` y sólo ése. El día que el alta pública acepte clínicas
 * o farmacias, la etiqueta se amplía con el backend, no antes.
 *
 * **«Laboratorio» es la primera cuyo formulario todavía no tiene endpoint.** Es
 * el alta del proceso 4.1 del registro del stakeholder: se recorre entera y
 * cierra dejando una solicitud, no una cuenta —ver el JSDoc de
 * `RegisterLaboratory`—. Se ofrece igual porque la pantalla es de verdad y es
 * lo que hay que poder mirar y corregir; la tarjeta no promete nada que la
 * pantalla no cumpla.
 *
 * **«Imagenología» es la segunda en esa misma situación** —módulo «ANÁLISIS
 * MÉDICOS (RAYOS X, RESONANCIA, ETC.)» del mismo registro, ver el JSDoc de
 * `RegisterImagingCenter`—, y va **separada del laboratorio** por lo mismo que
 * la fuente las escribe como dos módulos: son dos empresas distintas, con
 * papeles distintos y equipos distintos. Una sola tarjeta «Laboratorio o centro
 * de estudios» obligaría a preguntar cuál de las dos es adentro del formulario,
 * que es la misma decisión movida a un peor lugar.
 *
 * **«Farmacia» es la sexta, y la primera que sí sale a la red** después de la
 * aseguradora: `POST /iam/auth/register-organization` con
 * `tenantType: 'PHARMACY'` — ver el JSDoc de `RegisterPharmacy`. Va última
 * porque es la más nueva; no hay otro criterio de orden entre las seis.
 */
const CUENTAS_PERSONALES: readonly TipoDeCuenta[] = [
  {
    icono: 'patient',
    tone: 'secondary',
    titulo: 'Paciente',
    detalle: 'Su historia clínica, sus citas y sus estudios, siempre con usted.',
    ruta: '/auth/register/patient',
    testId: 'tipo-paciente',
  },
  {
    icono: 'practitioner',
    tone: 'primary',
    titulo: 'Médico',
    detalle: 'Atienda, recete y lleve su agenda. Necesita matrícula y colegio.',
    ruta: '/auth/register/practitioner',
    testId: 'tipo-profesional',
  },
  {
    // La secretaria (personal de apoyo). La cuenta se crea sola; trabajar para un
    // hospital o un doctor llega después, cuando la invitan y acepta o pide
    // sumarse y la aceptan.
    icono: 'support',
    tone: 'info',
    titulo: 'Secretaria o personal de apoyo',
    detalle: 'Lleve la agenda y reciba a los pacientes de los doctores y pisos que le asignen.',
    ruta: '/auth/register/support-staff',
    testId: 'tipo-personal-apoyo',
  },
];

/**
 * Las organizaciones que se dan de alta solas. Cuelgan de «Registrá tu
 * organización» en el acceso, **no** de «Crear cuenta»: una persona que busca
 * su cuenta no tiene por qué leer «Aseguradora» ni «Farmacia», y quien viene a
 * registrar la suya no debería tener que adivinar que está escondida entre las
 * cuentas de paciente y de médico.
 */
const CUENTAS_DE_ORGANIZACION: readonly TipoDeCuenta[] = [
  {
    icono: 'insurer',
    tone: 'primary',
    titulo: 'Aseguradora',
    detalle: 'Registre su organización y administre el padrón de sus afiliados.',
    ruta: '/auth/register/organization',
    testId: 'tipo-aseguradora',
  },
  {
    icono: 'laboratory',
    tone: 'info',
    titulo: 'Laboratorio',
    detalle: 'Reciba las órdenes médicas de la red y entregue los resultados por la app.',
    ruta: '/auth/register/laboratory',
    testId: 'tipo-laboratorio',
  },
  {
    icono: 'imaging',
    tone: 'secondary',
    titulo: 'Imagenología',
    detalle: 'Rayos X, ecografía, tomografía y resonancia. Reciba las órdenes de la red.',
    ruta: '/auth/register/imaging-center',
    testId: 'tipo-imagenologia',
  },
  {
    icono: 'pharmacy',
    tone: 'success',
    titulo: 'Farmacia',
    detalle: 'Publique su catálogo, reciba pedidos con receta y atienda desde un solo lugar.',
    ruta: '/auth/register/pharmacy',
    testId: 'tipo-farmacia',
  },
  {
    icono: 'clinic',
    tone: 'primary',
    titulo: 'Organización médica',
    detalle:
      'Hospitales, clínicas, consultorios y centros de enfermería: publique sus procedimientos y afilie a sus médicos.',
    ruta: '/auth/register/medical-center',
    testId: 'account-type-medical-center',
  },
];

/** Qué se está eligiendo: una cuenta de persona o el alta de una organización. */
type Audiencia = 'people' | 'organizations';

/** Lo que cambia entre las dos elecciones; la rejilla y su estilo son los mismos. */
interface CatalogoDeAltas {
  readonly claim: string;
  readonly tagline: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly tipos: readonly TipoDeCuenta[];
}

const CATALOGOS: Readonly<Record<Audiencia, CatalogoDeAltas>> = {
  people: {
    claim: 'Su salud, en un solo lugar',
    tagline: 'Cree su cuenta y empiece a usar AloVida en un par de minutos.',
    titulo: 'Crear cuenta',
    subtitulo: '¿Qué tipo de cuenta necesita?',
    tipos: CUENTAS_PERSONALES,
  },
  organizations: {
    claim: 'Su organización, dentro de la red',
    tagline: 'Registre su organización y empiece a recibir a sus pacientes y afiliados.',
    titulo: 'Registre su organización',
    subtitulo: '¿Qué tipo de organización es?',
    tipos: CUENTAS_DE_ORGANIZACION,
  },
};

/** La ruta de organizaciones declara `data: { audience: 'organizations' }`; sin dato, personas. */
function audienciaDe(valor: unknown): Audiencia {
  return valor === 'organizations' ? 'organizations' : 'people';
}

/**
 * **Elegir tipo de cuenta** — la primera pantalla de «crear cuenta» y, con
 * `data.audience = 'organizations'`, la de «registrá tu organización».
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
  protected readonly catalogo =
    CATALOGOS[audienciaDe(inject(ActivatedRoute).snapshot.data['audience'])];

  /**
   * Cuántas columnas tiene la rejilla en pantalla ancha.
   *
   * Sale de cuántas tarjetas hay y no de un número fijo: con tres columnas
   * fijas, dos tarjetas dejaban la tercera vacía y la fila pegada a la
   * izquierda, que es un hueco que se lee como «algo no cargó». Dos o cuatro se
   * reparten de a dos —cuatro en 2×2, no 3+1—; el resto, de a tres.
   */
  protected readonly columns =
    this.catalogo.tipos.length <= 2 || this.catalogo.tipos.length === 4 ? 2 : 3;
}
