import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

import { jsonLdDePerfil, serializarJsonLd } from './public-profile.jsonld';
import { PublicProfileCard } from './public-profile-card/public-profile-card';
import { PublicProfileReviews } from './public-profile-reviews/public-profile-reviews';
import type { PerfilPublicoResuelto } from './public-profile.resolver';

/**
 * El identificador del `<script>` de datos estructurados.
 *
 * Fijo y único: el router reutiliza este componente al navegar de un slug a
 * otro, y sin un identificador estable cada ficha visitada dejaría su JSON-LD
 * en la cabeza. Una página con cinco `Physician` distintos declarados no es
 * una página con más datos: es una que ningún rastreador sabe leer.
 */
const ID_JSON_LD = 'perfil-publico-jsonld';

/**
 * Los tratamientos que no aportan una inicial.
 *
 * Se comparan sin punto y sin mayúsculas, así que cubren «Dr», «Dr.», «DRA» y
 * «dra.» con una sola entrada. La lista es corta a propósito: es la que
 * aparece en el directorio de este país, y agregar tratamientos de otros
 * idiomas sin verlos en los datos sería adivinar.
 */
const TRATAMIENTOS = new Set(['dr', 'dra', 'lic', 'mgr', 'prof', 'sr', 'sra', 'srta']);

/** Si una parte del nombre es un tratamiento y no un nombre propio. */
function esTratamiento(parte: string): boolean {
  return TRATAMIENTOS.has(parte.replace(/\./g, '').toLowerCase());
}

/** Cómo se rotula cada clase de sujeto en la insignia junto al nombre. */
const ROTULO_POR_TIPO: Readonly<Record<PublicProfileDetail['kind'], string>> = {
  PRACTITIONER: 'Profesional',
  ORGANIZATION: 'Organización',
  PHARMACY: 'Farmacia',
  DIAGNOSTIC_UNIT: 'Laboratorio',
  INSURER: 'Aseguradora',
};

/**
 * La ficha pública de `/p/:slug` y sus cuatro hermanas.
 *
 * ## Qué pinta, y por qué no pinta todo lo que muestra la maqueta
 *
 * La maqueta de la bóveda (`V65-07-perfil-profesional-detalle`) dibuja además
 * trayectoria verificada, sedes con horarios, convenios con aseguradoras y
 * cifras de años de ejercicio. **Ninguno de esos datos existe en la respuesta
 * pública de la API**: `PublicProfileDetailDto` sirve nombre, titular,
 * biografía, foto, verificación, ciudad, dirección, especialidades, puntuación
 * y publicaciones. Nada más.
 *
 * Así que esta pantalla pinta lo que hay y **omite** las secciones sin fuente,
 * en vez de rellenarlas con los valores de la maqueta. Un horario inventado en
 * una ficha de salud no es un detalle de diseño pendiente: es alguien que se
 * cruza la ciudad a las 14:00 porque la pantalla se lo dijo. Las secciones
 * faltantes están registradas en el reporte del carril con el dato que les
 * falta a cada una.
 *
 * ## Por qué el dato entra por la ruta y no se pide acá
 *
 * Porque el criterio del carril es que el **HTML del servidor** ya traiga el
 * nombre. Ver `public-profile.resolver.ts`.
 */
@Component({
  selector: 'app-public-profile',
  imports: [PublicProfileCard, PublicProfileReviews, RouterLink],
  templateUrl: './public-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfile implements OnInit {
  /**
   * La ficha resuelta, o `null` si no hay.
   *
   * ## Por qué se lee de la ruta y no como `input.required`
   *
   * Porque ligar los `resolve` a inputs exige `withComponentInputBinding()` en
   * `provideRouter`, y eso no está activo en esta aplicación. Se probó: el
   * servidor renderizaba **el cascarón vacío** y dejaba dos `NG0950` en el log
   * —«el input requerido todavía no tiene valor»—, con los datos del perfil
   * presentes en el estado transferido y ausentes del HTML. Exactamente el
   * fallo que el SSR de este carril existe para evitar, y silencioso: la
   * respuesta seguía siendo 200.
   *
   * Encender esa opción lo arreglaría, pero es un cambio de comportamiento del
   * router **para las 141 pantallas** —todo parámetro de ruta pasa a ligarse a
   * cualquier input que coincida de nombre— y esto es una rama de carril que
   * corre en paralelo con otras cuatro. Leer de la ruta no le cambia nada a
   * nadie más.
   *
   * De `data` y no de `snapshot.data`: el router reutiliza el componente al
   * navegar de un slug a otro dentro de la misma configuración, y un snapshot
   * leído una vez dejaría la ficha anterior en pantalla.
   */
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly perfil = toSignal(
    this.ruta.data.pipe(map((data) => (data['perfil'] ?? null) as PerfilPublicoResuelto)),
    { requireSync: true },
  );

  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly documento = inject(DOCUMENT);

  /** El rótulo del tipo, para la insignia junto al nombre. */
  protected readonly rotuloTipo = computed(() => {
    const p = this.perfil();
    return p === null ? '' : ROTULO_POR_TIPO[p.kind];
  });

  /**
   * Las iniciales del cuadrado cuando no hay foto.
   *
   * La degradación es a iniciales reales y no a un icono genérico: la maqueta
   * lo dibuja así, y un directorio de personas donde todas las fichas sin foto
   * se ven idénticas es más difícil de recorrer que uno donde cada una lleva
   * las suyas.
   *
   * **El tratamiento no cuenta.** «Dra. Marisol Quispe Ticona» da `MQ`, no
   * `DM`: en un directorio médico casi todos los nombres empiezan con «Dr.» o
   * «Dra.», así que tomarlo como primera inicial pondría la misma letra en
   * media pantalla y dejaría de distinguir a nadie, que es lo único que las
   * iniciales tienen que hacer.
   */
  protected readonly iniciales = computed(() => {
    const p = this.perfil();
    if (p === null) return '';
    return p.displayName
      .split(/\s+/)
      .filter((parte) => /^[\p{L}]/u.test(parte) && !esTratamiento(parte))
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  });

  /** La puntuación con coma decimal, como se lee en castellano. */
  protected readonly puntuacion = computed(() => {
    const media = this.perfil()?.ratingAverage;
    return media == null ? null : media.toFixed(1).replace('.', ',');
  });

  /**
   * Fija título y metadatos.
   *
   * En `ngOnInit` y no en un efecto: tienen que estar en el HTML **que devuelve
   * el servidor**, y el servidor serializa después de que la aplicación se
   * estabiliza, no después de que se vacíe la cola de efectos. `ngOnInit` corre
   * en la primera detección de cambios, que es antes de las dos cosas.
   *
   * Tampoco en el constructor: un input requerido todavía no tiene valor ahí.
   */
  ngOnInit(): void {
    const p = this.perfil();
    if (p === null) {
      this.title.setTitle('AloVida — perfil no encontrado');
      return;
    }

    const descripcion = p.headline ?? p.biography ?? `Perfil público de ${p.displayName}`;
    this.title.setTitle(`${p.displayName} — AloVida`);
    this.publicarDatosEstructurados(p);
    this.meta.updateTag({ name: 'description', content: descripcion.slice(0, 300) });
    this.meta.updateTag({ property: 'og:title', content: p.displayName });
    this.meta.updateTag({ property: 'og:description', content: descripcion.slice(0, 300) });
    this.meta.updateTag({ property: 'og:type', content: 'profile' });
    this.meta.updateTag({
      property: 'og:updated_time',
      content: p.updatedAt.toISOString(),
    });
  }

  /**
   * Escribe el JSON-LD de la ficha en la cabeza del documento.
   *
   * ## Por qué por DOM y no en la plantilla
   *
   * Porque Angular **elimina** los `<script>` que aparecen en una plantilla:
   * es una defensa del compilador, no un descuido, y no tiene interruptor.
   * Escribirlo con `[innerHTML]` obligaría a marcar la cadena como segura y a
   * confiar en texto que escribe cada prestador en su propia vitrina.
   *
   * Por DOM funciona en el servidor igual que en el navegador: el motor de SSR
   * serializa el documento entero después de estabilizar, así que el `<script>`
   * viaja dentro del HTML que devuelve la petición — que es la única forma de
   * que un rastreador lo lea.
   *
   * Se reemplaza el nodo anterior en vez de agregar uno: ver {@link ID_JSON_LD}.
   */
  private publicarDatosEstructurados(perfil: PublicProfileDetail): void {
    const doc = this.documento;
    const anterior = doc.getElementById(ID_JSON_LD);
    anterior?.remove();

    // El origen sale del documento y no de una constante: en desarrollo es
    // `localhost:4300`, detrás del proxy es el dominio real, y una URL canónica
    // que apunte al host equivocado es peor que no declararla.
    const origen = doc.location?.origin ?? '';
    const script = doc.createElement('script');
    script.id = ID_JSON_LD;
    script.type = 'application/ld+json';
    script.textContent = serializarJsonLd(jsonLdDePerfil(perfil, origen));
    doc.head.appendChild(script);
  }

  /**
   * «Enviar mensaje»: lleva a los chats con a quién escribirle.
   *
   * No abre la conversación acá. La ficha es **anónima** —se sirve sin sesión,
   * y el SSR la pinta para buscadores—, así que crear un hilo desde esta
   * pantalla exigiría resolver quién es uno antes de saber si hay sesión. La
   * bandeja ya sabe hacerlo: recibe el slug, resuelve la ficha, abre el hilo si
   * no existía, y si a quien llega le falta el perfil público le ofrece
   * crearlo. El guard de sesión de `/messaging` se encarga del resto.
   */
  protected escribirle(slug: string): void {
    void this.router.navigate(['/messaging'], {
      queryParams: { escribirA: slug },
    });
  }
}
