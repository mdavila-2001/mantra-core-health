import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';
import { ThemeService } from '../../../../core/tokens/theme.service';
import { PointerScene } from '../../../motion/pointer-scene.directive';
import { AppButton } from '../../atoms/button/button';
import { AuthStage } from '../auth-stage/auth-stage';

/** Las tres medidas del hueco del formulario. Ver `AuthSplit.contentWidth`. */
export type AuthSplitWidth = 'form' | 'wide' | 'full';

/** Las dos puestas en escena. Ver `AuthSplit.scene`. */
export type AuthSplitScene = 'split' | 'stage';

/**
 * Estructura partida de las pantallas de acceso: columna de marca a la
 * izquierda y panel de formulario a la derecha.
 *
 * Es la forma del diseño que entregó el diseñador para el alta de profesional,
 * adoptada como estructura común de login y registro para que las dos pantallas
 * se vean de la misma familia.
 *
 * ```html
 * <app-auth-split claim="Tu salud, conectada" tagline="La red más grande…">
 *   <h1>Iniciar sesión</h1>
 *   <form>…</form>
 * </app-auth-split>
 * ```
 *
 * ## El fondo vivo
 *
 * Las dos columnas llevan una aurora —masas de color que derivan solas— y toda
 * la escena se corre con el puntero a través de `appPointerScene`, que publica
 * las variables `--pointer-*` en el nodo raíz. La composición es enteramente
 * CSS: acá no hay ni un `requestAnimationFrame` propio. Se apaga sola con
 * `prefers-reduced-motion` y el paralaje ni siquiera se engancha en pantallas
 * táctiles.
 *
 * **No sabe qué es un token**: es puro layout. El único servicio que toca es el
 * de tema, porque una persona ajusta claro/oscuro **antes** de entrar y ese
 * control tiene que existir también fuera de la aplicación autenticada — hasta
 * ahora solo vivía en la vitrina.
 */
@Component({
  selector: 'app-auth-split',
  imports: [AppButton, AuthStage, PointerScene],
  templateUrl: './auth-split.html',
  styleUrl: './auth-split.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSplit {
  private readonly themeService = inject(ThemeService);

  /** Titular grande de la columna de marca. */
  readonly claim = input.required<string>();

  /** Bajada del titular. */
  readonly tagline = input<string>('');

  /**
   * Cuánto ancho puede ocupar el formulario proyectado.
   *
   * `form` (27 rem) es la medida de un formulario de acceso: pocos campos, uno
   * debajo del otro. `wide` (40 rem) es para altas largas que agrupan campos
   * cortos de a dos por fila —el registro— y que a 27 rem quedarían con dos
   * columnas de menos de 200 px.
   *
   * `full` es otra cosa, y por eso no es «otro número»: **se lleva la columna
   * de marca** y le da la ventana entera al formulario. Es para las altas que
   * sirve el motor por partes, donde el contenido de una página son cuatro
   * campos y una barra de avance: encerrado en 40 rem contra media pantalla,
   * el paso se leía como una tarjetita en una esquina en vez de como la tarea
   * que la persona vino a hacer. Sin la columna, el fondo vivo y el selector de
   * tema siguen ahí —pasan a ocupar toda la escena—, y la marca la sostiene la
   * píldora de `__marca-mini`, que en este modo se muestra también en
   * escritorio.
   *
   * Existe como entrada y no como una regla suelta porque la limitación **tiene
   * que vivir en esta plantilla**: con encapsulación emulada, un selector de
   * este componente no alcanza al contenido proyectado, así que la pantalla de
   * adentro no puede fijarse el ancho a sí misma.
   */
  readonly contentWidth = input<AuthSplitWidth>('form');

  /**
   * Cómo se pone en escena la pantalla.
   *
   * `split` es la estructura partida de siempre: columna de marca a la
   * izquierda, formulario sobre la superficie del tema a la derecha. La usan
   * las altas, que proyectan formularios SIN tarjeta propia y necesitan esa
   * superficie clara debajo para leerse.
   *
   * `stage` convierte la ventana entera en el escenario del latido: el trazo
   * de ECG cruza de punta a punta —por detrás de la tarjeta—, con auroras,
   * cuadrícula de monitor y motas detrás. Solo sirve para contenido que trae
   * su propia tarjeta opaca (el acceso): el escenario es oscuro en los dos
   * temas, como lo era la columna de marca, y un texto suelto encima no se
   * leería en claro.
   */
  readonly scene = input<AuthSplitScene>('split');

  /**
   * El titular y la bajada, envueltos en una lista de un solo elemento para
   * poder recorrerlos con `@for … track`.
   *
   * No es adorno: en el registro el texto cambia al elegir paciente o
   * profesional, y una interpolación a secas lo reemplazaría de golpe, sin
   * transición. Con `track` sobre el propio texto, cambiarlo destruye el nodo y
   * crea otro, así que la animación de entrada vuelve a correr y el titular
   * nuevo aparece en vez de aparecer ya puesto.
   *
   * Van como `computed` y no como literal en la plantilla para no alojar un
   * arreglo nuevo en cada detección de cambios.
   */
  protected readonly claimKeyed = computed(() => [this.claim()]);
  protected readonly taglineKeyed = computed(() => {
    const texto = this.tagline();
    return texto === '' ? [] : [texto];
  });

  protected readonly theme = this.themeService.currentTheme;

  protected readonly themeOptions: readonly { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: 'Claro' },
    { mode: 'dark', label: 'Oscuro' },
    { mode: 'system', label: 'Sistema' },
  ];

  protected setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }
}
