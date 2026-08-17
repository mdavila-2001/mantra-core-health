import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

import type { PerfilPublicoResuelto } from './public-profile.resolver';

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
  imports: [DatePipe, RouterLink],
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

  readonly perfil = toSignal(
    this.ruta.data.pipe(map((data) => (data['perfil'] ?? null) as PerfilPublicoResuelto)),
    { requireSync: true },
  );

  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

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
    this.meta.updateTag({ name: 'description', content: descripcion.slice(0, 300) });
    this.meta.updateTag({ property: 'og:title', content: p.displayName });
    this.meta.updateTag({ property: 'og:description', content: descripcion.slice(0, 300) });
    this.meta.updateTag({ property: 'og:type', content: 'profile' });
    this.meta.updateTag({
      property: 'og:updated_time',
      content: p.updatedAt.toISOString(),
    });
  }
}
