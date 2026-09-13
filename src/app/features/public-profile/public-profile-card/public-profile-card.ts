import { DatePipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMapa } from '@shared/components/organisms/map/pin-mapa.types';
import { PublicPostCard } from '../public-post-card/public-post-card';
import { PublicProfilePager } from '../public-profile-pager/public-profile-pager';
import {
  PublicProfileReviews,
  type PestanaDeOpiniones,
} from '../public-profile-reviews/public-profile-reviews';

import {
  PUBLIC_PROFILE_PREFIX,
  type PublicProfileDetail,
} from '@core/data-access/public-directory/public-directory.types';
import { inicialesDe } from '@shared/text/iniciales';

/** Cuántas publicaciones se ven por página en la ficha. */
export const PUBLICACIONES_POR_PAGINA = 3;

/** Cuántas sedes se ven por página en «Dónde atiende». */
export const SEDES_POR_PAGINA = 2;

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
  imports: [
    AppButton,
    Badge,
    DatePipe,
    AppMap,
    PublicPostCard,
    PublicProfilePager,
    PublicProfileReviews,
  ],
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

  /**
   * Si la ficha es de un **lugar** y no de una persona.
   *
   * Cambia tres cosas, y las tres importan: el retrato deja de ser redondo —un
   * círculo es la convención de «foto de alguien», y una clínica no es
   * alguien—, el rótulo pasa de «dónde atiende» a «dónde queda», y aparece
   * «Cómo llegar», que es lo que se quiere hacer con un lugar y no con una
   * persona.
   */
  protected readonly esLugar = computed(() => this.perfil().kind !== 'PRACTITIONER');

  /**
   * La tira de datos de cabecera: lo que se mira antes de leer nada.
   *
   * Sale **entera** de la respuesta pública, dato por dato. Lo que la maqueta
   * pone además —camas libres, precio de consulta, aseguradoras en convenio—
   * la API no lo sirve, así que no está. Un horario o un precio inventado en
   * una ficha de salud no es un pendiente de diseño: es alguien que se cruza la
   * ciudad para encontrarse con otra cosa.
   */
  protected readonly datosClave = computed(() => {
    const p = this.perfil();
    const datos: { rotulo: string; valor: string }[] = [];

    if (p.city) datos.push({ rotulo: 'Ciudad', valor: p.city });
    if (p.address) datos.push({ rotulo: 'Dirección', valor: p.address });

    // «Sin calificar» y no un cero: `ratingCount: 0` es el estado normal de un
    // directorio recién publicado, y «0,0 ★» diría que la atención se calificó
    // mal cuando nadie la calificó todavía.
    const media = this.puntuacion();
    datos.push({
      rotulo: 'Calificación',
      valor:
        media === null
          ? 'Sin calificar'
          : `${media} · ${p.ratingCount} ${p.ratingCount === 1 ? 'opinión' : 'opiniones'}`,
    });

    datos.push({
      rotulo: 'Identidad',
      valor: p.verified ? 'Verificada por AloVida' : 'Declarada por el prestador',
    });

    return datos;
  });

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
    const { location, displayName, practiceSites } = this.perfil();
    // Un pin por sede: son lugares distintos, y quien elige a quién consultar
    // los compara entre sí. Con una sola coordenada el mapa contestaba «dónde
    // está» cuando la pregunta es «dónde puedo verlo».
    const deSedes = practiceSites
      .filter((sede) => sede.location !== null)
      .map((sede) => ({
        id: sede.id,
        lat: sede.location!.lat,
        lng: sede.location!.lng,
        titulo: sede.name,
      }));
    if (deSedes.length > 0) return deSedes;

    // El respaldo de siempre: la ficha que no tiene sedes cargadas —o la de un
    // lugar, que no las tiene por definición— sigue mostrando su punto.
    if (location === null) return [];
    return [{ id: 'ubicacion', lat: location.lat, lng: location.lng, titulo: displayName }];
  });

  /**
   * Los lugares donde atiende, con el propio primero.
   *
   * Lo ordena el servidor (ver `sedesDe` en el simulador); acá no se reordena
   * para que las dos superficies digan lo mismo. Vacío en una ficha de lugar y
   * en la que todavía no cargó ninguna: ahí manda {@link donde}.
   */
  protected readonly sedes = computed(() => this.perfil().practiceSites);

  protected readonly etiquetaDelMapa = computed(
    () => `Dónde atiende ${this.perfil().displayName}, en el mapa.`,
  );

  /* ==========================================================================
      La tira de pestañas.

      Antes eran anclas `href="#seccion"`, y con `<base href="/">` el navegador
      resolvía `#acerca-de` contra la raíz del sitio: tocar «Acerca de» sacaba
      de la ficha en vez de llevar a la sección. Ahora son pestañas de verdad
      (`role="tab"`) que muestran su panel.

      Las secciones **siguen todas en el HTML** —las ocultas van con `hidden`—,
      así que el HTML del servidor sigue trayendo la ficha entera para los
      buscadores. «Inicio» muestra todas; cada otra pestaña, sólo la suya.
      ====================================================================== */

  /** Las secciones que de verdad se van a pintar, en el orden en que caen. */
  protected readonly secciones = computed<readonly { id: string; rotulo: string }[]>(() => {
    const p = this.perfil();
    const previa = this.preview();

    // «Inicio» es el encabezado con todo: existe siempre, así que la tira nunca
    // queda con una sola pestaña muerta.
    const tira = [{ id: 'resumen', rotulo: 'Inicio' }];

    if (p.biography || previa) tira.push({ id: 'acerca-de', rotulo: 'Acerca de' });
    if (p.specialties.length > 0) tira.push({ id: 'especialidades', rotulo: 'Especialidades' });
    if (p.trajectory.length > 0) tira.push({ id: 'trayectoria', rotulo: 'Trayectoria' });
    // Las mismas condiciones que la sección: con sedes y sin dirección la
    // sección se pintaba y la pestaña no aparecía.
    if (this.donde() || this.sedes().length > 0 || previa) {
      tira.push({ id: 'donde-queda', rotulo: this.esLugar() ? 'Dónde queda' : 'Dónde atiende' });
    }
    if (p.posts.length > 0 || previa) tira.push({ id: 'publicaciones', rotulo: 'Publicaciones' });

    // Con una sola sección la tira sobra: sería un rótulo disfrazado de
    // navegación, que es peor que no tener navegación.
    return tira.length > 1 ? tira : [];
  });

  /** La pestaña elegida. */
  protected readonly pestanaActiva = signal('resumen');

  protected seleccionar(id: string): void {
    this.pestanaActiva.set(id);
  }

  /** Si la sección se ve con la pestaña actual. «Inicio» las muestra todas. */
  protected mostrar(id: string): boolean {
    const activa = this.pestanaActiva();
    // Si la pestaña elegida dejó de existir (otro perfil), se cae a «Inicio».
    const existe = this.secciones().some((seccion) => seccion.id === activa);
    return !existe || activa === 'resumen' || activa === id;
  }

  /** Flechas izquierda/derecha entre pestañas, como pide el patrón ARIA de tabs. */
  protected moverConTeclado(evento: KeyboardEvent, indice: number): void {
    const tira = this.secciones();
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    evento.preventDefault();
    const paso = evento.key === 'ArrowRight' ? 1 : -1;
    const destino = tira[(indice + paso + tira.length) % tira.length]!;
    this.seleccionar(destino.id);
    this.documento.getElementById(`pestana-${destino.id}`)?.focus();
  }

  /* ==========================================================================
      Paginado de publicaciones y sedes.

      Con la misma lógica de botones que el carrusel de una publicación:
      anterior / siguiente y «n de N» (ver `public-profile-pager`).
      ====================================================================== */

  protected readonly publicacionesPorPagina = PUBLICACIONES_POR_PAGINA;
  protected readonly sedesPorPagina = SEDES_POR_PAGINA;
  protected readonly paginaPublicaciones = signal(0);
  protected readonly paginaSedes = signal(0);

  protected readonly publicacionesVisibles = computed(() =>
    recortar(this.perfil().posts, this.paginaPublicaciones(), PUBLICACIONES_POR_PAGINA),
  );

  protected readonly sedesVisibles = computed(() =>
    recortar(this.sedes(), this.paginaSedes(), SEDES_POR_PAGINA),
  );

  /**
   * Cambia de página y, si el comienzo de la sección quedó arriba de la
   * pantalla, la trae a la vista: sin eso, «siguiente» al pie de una lista
   * larga deja a quien lee mirando el final de la página nueva.
   */
  protected cambiarPagina(seccion: 'publicaciones' | 'donde-queda', pagina: number): void {
    (seccion === 'publicaciones' ? this.paginaPublicaciones : this.paginaSedes).set(pagina);
    const elemento = this.documento.getElementById(seccion);
    if (elemento && elemento.getBoundingClientRect().top < 0) {
      elemento.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  /* ==========================================================================
      Las opiniones: quién opinó y quién dio estrellas, en un modal.
      ====================================================================== */

  /** Qué pestaña del modal está abierta, o `null` si el modal está cerrado. */
  protected readonly opinionesAbiertas = signal<PestanaDeOpiniones | null>(null);

  protected abrirOpiniones(pestana: PestanaDeOpiniones): void {
    this.opinionesAbiertas.set(pestana);
  }

  protected cerrarOpiniones(): void {
    this.opinionesAbiertas.set(null);
  }

  /* ==========================================================================
      Compartir la ficha.
      ====================================================================== */

  private readonly documento = inject(DOCUMENT);

  /**
   * La URL pública de esta ficha, armada del slug y no de la barra de
   * direcciones.
   *
   * Importa en la vista previa: ahí la barra dice `/my-account/public-preview`,
   * y copiar eso le daría a quien lo pega la pantalla de configuración de otra
   * persona —un enlace roto— en vez de la ficha. El prefijo sale de
   * `PUBLIC_PROFILE_PREFIX`, que es el mismo que arma las rutas.
   */
  protected readonly urlPublica = computed(() => {
    const p = this.perfil();
    const origen = this.documento.defaultView?.location.origin ?? '';
    return `${origen}/${PUBLIC_PROFILE_PREFIX[p.kind]}/${p.slug}`;
  });

  /** Si el enlace se acaba de copiar, para confirmarlo en el propio botón. */
  protected readonly copiado = signal(false);

  protected async compartir(): Promise<void> {
    try {
      await this.documento.defaultView?.navigator.clipboard.writeText(this.urlPublica());
      this.copiado.set(true);
      this.documento.defaultView?.setTimeout(() => this.copiado.set(false), 2400);
    } catch {
      // Sin permiso de portapapeles no hay nada que avisar: el enlace sigue
      // siendo la barra de direcciones. Un error acá sería ruido.
    }
  }
}

/** La página `pagina` (desde 0) de una lista, acotada al rango real. */
function recortar<T>(lista: readonly T[], pagina: number, porPagina: number): readonly T[] {
  const ultima = Math.max(0, Math.ceil(lista.length / porPagina) - 1);
  const desde = Math.min(Math.max(0, pagina), ultima) * porPagina;
  return lista.slice(desde, desde + porPagina);
}
