import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppButton } from '@shared/components/atoms/button/button';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMapa } from '@shared/components/organisms/map/pin-mapa.types';

import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';

/** Cómo se rotula cada clase de sujeto en la insignia junto al nombre. */
const ROTULO_POR_TIPO: Readonly<Record<PublicProfileDetail['kind'], string>> = {
  PRACTITIONER: 'Profesional',
  ORGANIZATION: 'Organización',
  PHARMACY: 'Farmacia',
  DIAGNOSTIC_UNIT: 'Laboratorio',
  INSURER: 'Aseguradora',
};

/**
 * **El cuerpo de la ficha pública, una sola vez.**
 *
 * ## Por qué existe (B1 del plan de UX del 22/08/2026)
 *
 * El cliente lo dijo así: «el perfil público debe ser el mismo que se ve el
 * preview, si no no tiene ningún sentido tener preview». Y tenía razón —eran
 * dos dibujos distintos del mismo concepto:
 *
 * - `/p/:slug` pintaba una página entera: insignia de tipo, sello de
 *   verificación, ciudad, especialidades, calificación, opiniones,
 *   presentación, dónde atiende y publicaciones.
 * - «Tu perfil público» pintaba a mano una tarjetita con avatar, nombre,
 *   titular, biografía y la URL.
 *
 * O sea: el preview no se parecía a lo que prometía previsualizar. No era una
 * divergencia que se hubiera colado — eran dos implementaciones, y dos
 * implementaciones del mismo concepto **divergen siempre**.
 *
 * Ahora la ficha se dibuja **acá y sólo acá**, y las dos pantallas la
 * instancian. Que preview y público sean iguales dejó de ser una promesa que
 * hay que recordar y pasó a ser algo que no se puede romper sin borrar este
 * archivo.
 *
 * ## Por qué recibe `PublicProfileDetail` y no un tipo propio
 *
 * Porque es **la forma que la API pública sirve de verdad**. El preview arma
 * uno con lo que hay escrito en su formulario en este mismo instante; si el
 * tipo fuera más laxo, el preview podría mostrar campos que la respuesta
 * pública no trae, que es exactamente la mentira que esta unificación viene a
 * terminar.
 *
 * ## Lo que no pinta, y no es un pendiente de diseño
 *
 * La maqueta `V65-07-perfil-profesional-detalle` dibuja además trayectoria
 * verificada, **sedes con horarios**, convenios con aseguradoras y años de
 * ejercicio. Ninguno de esos datos existe en la respuesta pública. Un horario
 * inventado en una ficha de salud no es un detalle pendiente: es alguien que se
 * cruza la ciudad a las 14:00 porque la pantalla se lo dijo.
 *
 * Lo de «los lugares donde atiende» que el cliente pidió está a medias por eso
 * mismo: se muestra la ciudad y la dirección, que es lo que la API sirve. Las
 * sedes con sus días viven detrás de `GET /scheduling/slots`, que exige sesión,
 * y esta ficha es anónima. Queda anotado en `PENDIENTES-BACKEND.md`.
 */
@Component({
  selector: 'app-public-profile-card',
  imports: [AppButton, DatePipe, AppMap],
  templateUrl: './public-profile-card.html',
  styleUrl: './public-profile-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfileCard {
  readonly perfil = input.required<PublicProfileDetail>();

  /**
   * Si se está mirando en modo vista previa.
   *
   * Lo único que cambia: los estados vacíos hablan **en segunda persona** —«no
   * cargaste una presentación»— en vez de en tercera. Cambiar más que el
   * lenguaje volvería a separar las dos pantallas, que es lo que este
   * componente existe para impedir.
   */
  readonly preview = input(false);

  /**
   * Quien mira quiere escribirle.
   *
   * Es una salida y no una navegación de acá porque la ficha se dibuja en dos
   * pantallas y sólo una tiene sentido: abrir un chat desde la **vista previa**
   * sería escribirse a uno mismo. La pantalla que sí corresponde es la que lo
   * escucha; la otra simplemente no lo ata, y por eso el botón tampoco se pinta
   * en modo preview.
   */
  readonly escribir = output<void>();

  protected readonly rotuloTipo = computed(() => ROTULO_POR_TIPO[this.perfil().kind]);

  /** Las iniciales del cuadrado cuando no hay foto. Ver `shared/text/iniciales`. */
  protected readonly iniciales = computed(() => inicialesDe(this.perfil().displayName));

  /** La puntuación con coma decimal, como se lee en castellano. */
  protected readonly puntuacion = computed(() => {
    const media = this.perfil().ratingAverage;
    return media == null ? null : media.toFixed(1).replace('.', ',');
  });

  /**
   * Dónde atiende, en una línea.
   *
   * Ciudad y dirección son dos campos y una sola respuesta: mostrarlos en dos
   * renglones separados hacía que una ficha con ciudad y sin dirección se
   * leyera como si le faltara algo.
   */
  protected readonly donde = computed(() => {
    const { city, address } = this.perfil();
    return [address, city].filter((parte) => parte !== null && parte !== '').join(' · ');
  });

  /**
   * El mapa, aparte del texto.
   *
   * «Dónde atiende» ya lo dice en palabras (`donde`); esto es el mismo dato
   * mostrado como mapa, no una fuente distinta. Va por `app-map`
   * (Leaflet + OpenStreetMap, el mismo organismo de «Dónde comprar mi
   * receta») y no por un *embed* de Google: la política de seguridad de
   * contenido de la aplicación sólo abre `frame-src` para nada —bloquea
   * cualquier `iframe` ajeno— y sólo permite imágenes de
   * `tile.openstreetmap.org`. Sin coordenadas no hay pin que dibujar: a
   * diferencia de un *embed* de Google, Leaflet no busca por texto.
   */
  protected readonly pines = computed<readonly PinMapa[]>(() => {
    const { location, displayName } = this.perfil();
    if (location === null) return [];
    return [{ id: 'ubicacion', lat: location.lat, lng: location.lng, titulo: displayName }];
  });

  protected readonly etiquetaDelMapa = computed(
    () => `Dónde atiende ${this.perfil().displayName}, en el mapa.`,
  );
}
