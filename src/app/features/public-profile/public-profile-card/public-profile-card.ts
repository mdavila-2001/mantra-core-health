import { DatePipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';

import { AppButton } from '@shared/components/atoms/button/button';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMapa } from '@shared/components/organisms/map/pin-mapa.types';
import { PublicPostCard } from '../public-post-card/public-post-card';

import {
  PUBLIC_PROFILE_PREFIX,
  type PublicProfileDetail,
} from '@core/data-access/public-directory/public-directory.types';
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
  imports: [AppButton, DatePipe, AppMap, PublicPostCard],
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
    const { location, displayName } = this.perfil();
    if (location === null) return [];
    return [{ id: 'ubicacion', lat: location.lat, lng: location.lng, titulo: displayName }];
  });

  protected readonly etiquetaDelMapa = computed(
    () => `Dónde atiende ${this.perfil().displayName}, en el mapa.`,
  );

  /* ==========================================================================
      La tira de pestañas.

      Es lo que hace que una ficha se lea como una PÁGINA de una organización y
      no como una nota larga: de un vistazo se sabe qué hay más abajo sin tener
      que desplazar hasta el final para descubrirlo.

      Las pestañas navegan DENTRO de la misma página —son anclas, no rutas—.
      Partir la ficha en cinco pantallas rompería el SEO que este carril existe
      para servir: el HTML del servidor tiene que traer la ficha entera.
      ====================================================================== */

  /** Las secciones que de verdad se van a pintar, en el orden en que caen. */
  protected readonly secciones = computed<readonly { id: string; rotulo: string }[]>(() => {
    const p = this.perfil();
    const previa = this.preview();

    // «Inicio» es el encabezado: existe siempre, así que la tira nunca queda
    // con una sola pestaña muerta.
    const tira = [{ id: 'resumen', rotulo: 'Inicio' }];

    if (p.biography || previa) tira.push({ id: 'acerca-de', rotulo: 'Acerca de' });
    if (p.specialties.length > 0) tira.push({ id: 'especialidades', rotulo: 'Especialidades' });
    if (p.trajectory.length > 0) tira.push({ id: 'trayectoria', rotulo: 'Trayectoria' });
    if (this.donde() || previa) {
      tira.push({ id: 'donde-queda', rotulo: this.esLugar() ? 'Dónde queda' : 'Dónde atiende' });
    }
    if (p.posts.length > 0 || previa) tira.push({ id: 'publicaciones', rotulo: 'Publicaciones' });

    // Con una sola sección la tira sobra: sería un rótulo disfrazado de
    // navegación, que es peor que no tener navegación.
    return tira.length > 1 ? tira : [];
  });

  private readonly anclas = viewChildren<ElementRef<HTMLElement>>('ancla');

  /** Qué pestaña está marcada. La decide dónde está la lectura, no el clic. */
  protected readonly seccionActiva = signal('resumen');

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

  constructor() {
    /* El marcador de la pestaña.

       `IntersectionObserver` y no un escucha de `scroll`: el escucha corre en
       cada píxel del hilo principal y esto es una página que se desplaza
       largo. El margen inferior del `rootMargin` recorta la zona útil al
       tercio superior de la ventana, que es donde uno mira mientras baja; sin
       él, la última sección quedaría marcada desde que asoma.

       El efecto se rearma solo cuando cambian las anclas —o sea, cuando el
       perfil cambia y aparecen o desaparecen secciones—. */
    effect((alLimpiar) => {
      const elementos = this.anclas().map((ref) => ref.nativeElement);
      const ventana = this.documento.defaultView;

      // En el servidor no hay observador, y sin secciones no hay nada que
      // observar. La pestaña se queda en «Inicio», que es lo correcto.
      if (!ventana || typeof ventana.IntersectionObserver === 'undefined') return;
      if (elementos.length === 0) return;

      const visibles = new Set<string>();
      const observador = new ventana.IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) {
            if (entrada.isIntersecting) visibles.add(entrada.target.id);
            else visibles.delete(entrada.target.id);
          }
          // La primera del orden del documento que esté a la vista, no la
          // última que disparó: si no, dos secciones cortas juntas hacen
          // parpadear la marca.
          const orden = this.secciones().map((seccion) => seccion.id);
          this.seccionActiva.set(orden.find((id) => visibles.has(id)) ?? orden[0] ?? 'resumen');
        },
        { rootMargin: '-88px 0px -62% 0px', threshold: 0 },
      );

      for (const elemento of elementos) observador.observe(elemento);
      alLimpiar(() => observador.disconnect());
    });
  }
}
