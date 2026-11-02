import { computed, signal } from '@angular/core';

/** Cuánto se puede acercar la figura: el render HD alcanza para leer el detalle a 5×. */
export const ZOOM_MINIMO = 1;
export const ZOOM_MAXIMO = 5;
/** Cada toque de «Acercar» multiplica el aumento por este factor. */
export const ZOOM_PASO = 1.5;
/** Cuánto debe moverse el puntero para que un toque pase a ser un arrastre. */
const UMBRAL_DE_ARRASTRE_PX = 5;

/** Lo que el visor necesita saber de la figura que se está mirando. */
export interface EntornoDelVisor {
  /** Ancho y alto del dibujo de la vista, en unidades del `viewBox`. */
  readonly caja: () => readonly [number, number];
  /** El `viewBox` de la vista entera. */
  readonly viewBoxBase: () => string;
  /** Dónde queda la zona elegida, si hay una en esta vista. */
  readonly centroDeLaElegida: () => readonly [number, number] | undefined;
}

interface Arrastre {
  readonly x: number;
  readonly y: number;
  readonly centro: readonly [number, number];
  movido: boolean;
}

/**
 * El acercamiento y el arrastre de la figura.
 *
 * Mueve el `viewBox` del SVG, no la imagen: acercar muestra más píxeles reales
 * del mismo render, y las zonas (vectores en las mismas unidades) siguen
 * calzando y siguen siendo pulsables.
 *
 * No sabe de zonas ni de síntomas: `BodyMap` le dice dónde está la elegida y
 * cuándo cambia la vista.
 */
export class VisorDelCuerpo {
  /** El aumento actual: 1 es la figura entera. */
  readonly zoom = signal(ZOOM_MINIMO);
  readonly puedeAcercar = computed(() => this.zoom() < ZOOM_MAXIMO);
  readonly puedeAlejar = computed(() => this.zoom() > ZOOM_MINIMO);
  readonly zoomEnTexto = computed(() => `${Math.round(this.zoom() * 100)} %`);

  /** Hacia dónde mira el acercamiento, en unidades del dibujo (`null` = el centro). */
  private readonly centro = signal<readonly [number, number] | null>(null);

  /** El `viewBox` con el acercamiento aplicado; sin acercar, el de la vista tal cual. */
  readonly viewBox = computed<string>(() => {
    const zoom = this.zoom();
    if (zoom === ZOOM_MINIMO) return this.entorno.viewBoxBase();
    const [ancho, alto] = this.entorno.caja();
    const anchoVisible = ancho / zoom;
    const altoVisible = alto / zoom;
    const [cx, cy] = this.centro() ?? [ancho / 2, alto / 2];
    const x = Math.min(Math.max(cx - anchoVisible / 2, 0), ancho - anchoVisible);
    const y = Math.min(Math.max(cy - altoVisible / 2, 0), alto - altoVisible);
    return `${x} ${y} ${anchoVisible} ${altoVisible}`;
  });

  private arrastre: Arrastre | null = null;
  /** Un arrastre que termina sobre una zona no la elige: el clic que sigue se descarta. */
  private huboArrastre = false;

  constructor(private readonly entorno: EntornoDelVisor) {}

  acercar(): void {
    this.cambiarZoom(this.zoom() * ZOOM_PASO);
  }

  alejar(): void {
    this.cambiarZoom(this.zoom() / ZOOM_PASO);
  }

  restablecer(): void {
    this.zoom.set(ZOOM_MINIMO);
    this.centro.set(null);
  }

  private cambiarZoom(valor: number, foco?: readonly [number, number]): void {
    const nuevo = Math.min(Math.max(valor, ZOOM_MINIMO), ZOOM_MAXIMO);
    if (nuevo === ZOOM_MINIMO) {
      this.restablecer();
      return;
    }
    if (foco !== undefined) this.centro.set(foco);
    // Sin un punto pedido, el primer acercamiento va a la zona elegida: quien
    // señaló el pecho quiere ver el pecho, no el ombligo.
    else if (this.zoom() === ZOOM_MINIMO) {
      const centroDeLaZona = this.entorno.centroDeLaElegida();
      if (centroDeLaZona !== undefined) this.centro.set(centroDeLaZona);
    }
    this.zoom.set(nuevo);
  }

  /** Ctrl + rueda (o el pellizco del trackpad) acerca hacia donde apunta el puntero. */
  alGirarLaRueda(evento: WheelEvent): void {
    if (!evento.ctrlKey && !evento.metaKey) return;
    evento.preventDefault();
    const punto = this.aCoordenadasDelDibujo(evento.currentTarget as SVGSVGElement, evento.clientX, evento.clientY);
    this.cambiarZoom(this.zoom() * (evento.deltaY < 0 ? ZOOM_PASO : 1 / ZOOM_PASO), punto);
  }

  empezarArrastre(evento: PointerEvent): void {
    this.huboArrastre = false;
    if (this.zoom() === ZOOM_MINIMO || evento.button !== 0) return;
    const [ancho, alto] = this.entorno.caja();
    this.arrastre = {
      x: evento.clientX,
      y: evento.clientY,
      centro: this.centro() ?? [ancho / 2, alto / 2],
      movido: false,
    };
  }

  arrastrar(evento: PointerEvent): void {
    const arrastre = this.arrastre;
    if (arrastre === null) return;
    const dx = evento.clientX - arrastre.x;
    const dy = evento.clientY - arrastre.y;
    if (!arrastre.movido && Math.hypot(dx, dy) < UMBRAL_DE_ARRASTRE_PX) return;
    arrastre.movido = true;
    const { width, height } = (evento.currentTarget as SVGSVGElement).getBoundingClientRect();
    const [ancho, alto] = this.entorno.caja();
    this.centro.set([
      arrastre.centro[0] - dx * (ancho / this.zoom() / width),
      arrastre.centro[1] - dy * (alto / this.zoom() / height),
    ]);
  }

  terminarArrastre(): void {
    this.huboArrastre = this.arrastre?.movido ?? false;
    this.arrastre = null;
  }

  /** `true` una sola vez después de un arrastre: el clic que lo cierra no debe elegir nada. */
  consumirArrastre(): boolean {
    const hubo = this.huboArrastre;
    this.huboArrastre = false;
    return hubo;
  }

  /** Lleva la mirada a una zona, para que el foco del teclado nunca quede fuera de cuadro. */
  centrarEn(centros: readonly (readonly [number, number])[], evento: FocusEvent): void {
    // Sólo el foco del teclado mueve la mirada: tocar una zona con el dedo o el
    // ratón también la enfoca, y entonces la figura saltaba bajo el puntero.
    if (!(evento.target as Element).matches(':focus-visible')) return;
    if (this.zoom() === ZOOM_MINIMO || centros.length === 0) return;
    this.centro.set(centros[0]);
  }

  private aCoordenadasDelDibujo(lienzo: SVGSVGElement, clientX: number, clientY: number): readonly [number, number] {
    const [vx, vy, vancho, valto] = this.viewBox().split(' ').map(Number);
    const caja = lienzo.getBoundingClientRect();
    return [vx + ((clientX - caja.left) / caja.width) * vancho, vy + ((clientY - caja.top) / caja.height) * valto];
  }
}
