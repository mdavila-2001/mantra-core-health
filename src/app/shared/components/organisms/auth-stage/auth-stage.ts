import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Una mota de luz del escenario: columna, tamaño, retardo y duración. */
interface StageMote {
  x: number;
  size: number;
  delay: number;
  duration: number;
}

/**
 * Las motas que suben por el escenario.
 *
 * Fijas y no `Math.random()`: el servidor y el navegador tienen que pintar la
 * misma escena, o la hidratación encuentra otro DOM y lo rehace. Las columnas
 * salen de la sucesión de Weyl (paso 0,618…, la proporción áurea): se reparten
 * parejas por el ancho sin formar filas, que es justo lo que un azar a mano no
 * consigue. Las duraciones alternan cuatro valores primos entre sí para que
 * dos motas no vuelvan a coincidir a la vista.
 */
const STAGE_MOTES: readonly StageMote[] = Array.from({ length: 22 }, (_, i) => ({
  x: Math.round(((i * 0.618034 + 0.13) % 1) * 1000) / 10,
  size: 2 + (i % 4),
  delay: -((i * 1.7) % 19),
  duration: [17, 19, 23, 29][i % 4],
}));

/** Las capas del latido, de atrás hacia adelante. Ver `auth-stage.css`. */
const ECG_LAYERS = ['base', 'aura', 'halo', 'comet', 'spark'] as const;

/**
 * Escenario del latido: el fondo de arte de la pantalla de acceso.
 *
 * Una tira de ECG de punta a punta de la ventana —con anatomía real: onda P,
 * complejo QRS, onda T, sobre el gesto del logotipo— que se dibuja sola al
 * entrar y después la recorre un cometa de luz. Cuando el cometa pasa por el
 * pico R protagonista, de ahí salen ondas y un destello. Detrás: auroras de la
 * paleta, rayos que giran muy despacio, la cuadrícula del papel de ECG, motas
 * que suben y un grano fino.
 *
 * Es **puro CSS y SVG**: ni un `requestAnimationFrame`, y renderiza igual
 * bajo SSR. Entero `aria-hidden` —lo pone el host—, porque no dice nada que
 * la pantalla no diga con palabras.
 *
 * ## Lo que espera de quien lo monta
 *
 * - `--beat` y `--beat-start`: el ciclo del monitor. Los declara el que lo
 *   monta (`app-auth-split` en `scene="stage"`) porque también sincroniza con
 *   ellos piezas suyas —el logotipo que late, el resplandor de la tarjeta—, y
 *   a esas no les llegaría una variable declarada acá adentro.
 * - `--pointer-tilt-x` / `--pointer-tilt-y`: el paralaje, que publica
 *   `appPointerScene` en un ancestro. Sin él, la escena se queda quieta.
 */
@Component({
  selector: 'app-auth-stage',
  templateUrl: './auth-stage.html',
  styleUrl: './auth-stage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class AuthStage {
  /** Titular grande del escenario. Entra palabra por palabra. */
  readonly claim = input.required<string>();

  /** Bajada del titular. */
  readonly tagline = input<string>('');

  /**
   * El titular partido en palabras, para que cada una entre por su cuenta.
   * Se parte por espacios y nada más: la puntuación viaja pegada a su palabra
   * («salud,»), que es como se lee.
   */
  protected readonly claimWords = computed(() => this.claim().split(/\s+/).filter(Boolean));

  protected readonly motes = STAGE_MOTES;
  protected readonly ecgLayers = ECG_LAYERS;
}
