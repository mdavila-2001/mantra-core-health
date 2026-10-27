import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import type { AnatomyLayer, AnatomyPart, AnatomySex } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';

type Three = typeof import('three');
type Mesh = import('three').Mesh<import('three').BufferGeometry, import('three').MeshStandardMaterial>;

/** Estado de la carga del modelo, para que quien monta el visor lo cuente. */
export type AnatomyViewerStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

/**
 * El token de color de cada capa; se leen en tiempo de ejecución.
 *
 * Elegidos para que ni la pieza elegida (verde) ni sus relacionadas (ocre)
 * se confundan con una capa en ningún tema: los tokens de marca cambian con
 * el tema oscuro y `--brand-accent` llegaba a ser el mismo ámbar del sistema
 * nervioso. Además del color, lo que no está en foco se atenúa: la diferencia
 * no depende sólo del tono (WCAG 1.4.1).
 */
export const COLOR_DE_CAPA: Readonly<Record<AnatomyLayer, string>> = {
  skeleton: '--c-amber-200',
  muscles: '--c-error-400',
  vessels: '--c-error-600',
  nervous: '--c-ivory-700',
  organs: '--c-petrol-300',
};
export const COLOR_ELEGIDO = '--c-success-500';
export const COLOR_RELACIONADO = '--c-amber-600';
/** Cuánto se ve lo que no es la pieza ni sus relacionadas cuando hay una elegida. */
const OPACIDAD_DE_FONDO = 0.16;
/** Paso de giro con el teclado, en radianes, y factor de acercamiento. */
const PASO_DE_GIRO = Math.PI / 24;
const PASO_DE_ZOOM = 0.88;
/** Un arrastre de más de estos píxeles es girar, no elegir. */
const TOLERANCIA_DE_CLIC = 5;

/**
 * El cuerpo en 3D, con las piezas que se pueden tocar.
 *
 * ## Qué hace y qué no
 *
 * Dibuja las capas que se le pidan (`layers`), resalta la pieza elegida
 * (`selected`) y sus relacionadas (`related`) y avisa qué malla se tocó
 * (`picked`). No sabe de fichas ni de ontologías: recibe ids de malla, y quien
 * lo monta decide qué significan.
 *
 * ## SSR y peso
 *
 * three.js se importa con `import()` dentro de `afterNextRender`, que sólo
 * corre en el navegador: en el servidor el visor es un recuadro inerte y el
 * motor no entra en ningún bundle inicial. Cada capa es un GLB aparte que se
 * baja la primera vez que se enciende.
 *
 * ## Accesibilidad
 *
 * El lienzo toma foco y se gira con las flechas (más y menos acercan, Inicio
 * vuelve a la vista inicial). Elegir una pieza con teclado se hace desde la
 * lista que acompaña al visor en la página: un lienzo no puede anunciar sus
 * piezas, y la lista sí. Con `prefers-reduced-motion` no hay inercia.
 */
@Component({
  selector: 'app-anatomy-viewer',
  templateUrl: './anatomy-viewer.html',
  styleUrl: './anatomy-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnatomyViewer {
  readonly parts = input.required<readonly AnatomyPart[]>();
  /** URL del GLB de cada capa. */
  readonly modelUrls = input.required<Readonly<Record<AnatomyLayer, string>>>();
  readonly layers = input.required<readonly AnatomyLayer[]>();
  readonly sex = input<AnatomySex>('male');
  readonly selected = input<readonly string[]>([]);
  readonly related = input<readonly string[]>([]);
  /** Qué se ve, dicho para quien no ve el lienzo. */
  readonly label = input.required<string>();

  readonly picked = output<string | null>();
  readonly statusChange = output<AnatomyViewerStatus>();

  protected readonly status = signal<AnatomyViewerStatus>('idle');
  protected readonly hovered = signal<string | null>(null);

  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private motor: Motor | null = null;
  private destruido = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      this.motor?.liberar();
    });

    afterNextRender(() => {
      void this.arrancar();
    });

    // Las piezas pueden llegar después que el motor: se le pasan cada vez.
    effect(() => {
      const partes = this.parts();
      untracked(() => this.motor?.ponerPartes(partes));
    });

    effect(() => {
      const capas = this.layers();
      const sexo = this.sex();
      const elegidas = this.selected();
      const relacionadas = this.related();
      untracked(() => this.motor?.aplicar(capas, sexo, elegidas, relacionadas));
    });
  }

  /** Vuelve a la vista inicial. */
  resetView(): void {
    this.motor?.encuadrar();
  }

  private ponerEstado(estado: AnatomyViewerStatus): void {
    this.status.set(estado);
    this.statusChange.emit(estado);
  }

  private async arrancar(): Promise<void> {
    const lienzo = this.lienzo().nativeElement;
    if (!soportaWebGl(lienzo)) {
      this.ponerEstado('unsupported');
      return;
    }
    this.ponerEstado('loading');
    try {
      const [THREE, { OrbitControls }, { GLTFLoader }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
      ]);
      if (this.destruido) return;
      this.motor = new Motor(THREE, OrbitControls, new GLTFLoader(), lienzo, this.host.nativeElement, {
        partes: this.parts(),
        urls: this.modelUrls(),
        alElegir: (id) => this.picked.emit(id),
        alPasar: (id) => this.hovered.set(id),
        alCargar: (estado) => this.ponerEstado(estado),
      });
      this.motor.aplicar(this.layers(), this.sex(), this.selected(), this.related());
    } catch {
      this.ponerEstado('error');
    }
  }

  /** El nombre inglés de la malla bajo el puntero, para el rótulo flotante. */
  protected hoveredLabel(): string | null {
    const id = this.hovered();
    if (id === null) return null;
    return this.parts().find((p) => p.meshId === id)?.labelEn ?? null;
  }

  protected onKeydown(evento: KeyboardEvent): void {
    if (this.motor?.teclado(evento.key) === true) evento.preventDefault();
  }
}

function soportaWebGl(lienzo: HTMLCanvasElement): boolean {
  try {
    return typeof WebGLRenderingContext !== 'undefined' && lienzo.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

interface OpcionesDelMotor {
  readonly partes: readonly AnatomyPart[];
  readonly urls: Readonly<Record<AnatomyLayer, string>>;
  readonly alElegir: (id: string | null) => void;
  readonly alPasar: (id: string | null) => void;
  readonly alCargar: (estado: AnatomyViewerStatus) => void;
}

/**
 * Todo lo que toca three.js, fuera del componente: escena, cámara, carga por
 * capas, colores, selección por rayo y teclado. Dibuja sólo cuando algo cambió.
 */
class Motor {
  private readonly renderer: import('three').WebGLRenderer;
  private readonly escena: import('three').Scene;
  private readonly camara: import('three').PerspectiveCamera;
  private readonly controles: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;
  private readonly rayo: import('three').Raycaster;
  private readonly mallas = new Map<string, Mesh>();
  private readonly capasCargadas = new Map<AnatomyLayer, Promise<void>>();
  private readonly listas = new Set<AnatomyLayer>();
  private readonly fallidas = new Set<AnatomyLayer>();
  private readonly punteros = new Set<number>();
  private partePorMalla: ReadonlyMap<string, AnatomyPart>;
  private liberado = false;
  private readonly observador: ResizeObserver;
  private readonly temaObservado: MutationObserver;
  private readonly movimiento: MediaQueryList;
  private readonly esquemaOscuro: MediaQueryList;
  private pendiente = 0;
  /**
   * La persona ya movió la cámara. Mientras no lo haga, el encuadre sigue a lo
   * que se carga y al tamaño del lienzo: encuadrar sólo con la primera capa
   * —los órganos, que no llegan a la cabeza— dejaba el esqueleto cortado.
   */
  private camaraMovida = false;
  private estado: { capas: readonly AnatomyLayer[]; sexo: AnatomySex; elegidas: Set<string>; relacionadas: Set<string> } = {
    capas: [],
    sexo: 'male',
    elegidas: new Set(),
    relacionadas: new Set(),
  };
  private inicio: { x: number; y: number } | null = null;

  constructor(
    private readonly THREE: Three,
    OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
    private readonly cargador: import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader,
    private readonly lienzo: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly opciones: OpcionesDelMotor,
  ) {
    this.partePorMalla = new Map(opciones.partes.map((p) => [p.meshId, p]));
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    this.escena.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    const luz = new THREE.DirectionalLight(0xffffff, 1.4);
    luz.position.set(1, 2, 3);
    this.camara.add(luz);
    this.escena.add(this.camara);

    this.movimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.esquemaOscuro = window.matchMedia('(prefers-color-scheme: dark)');
    this.controles = new OrbitControls(this.camara, lienzo);
    this.controles.enableDamping = !this.movimiento.matches;
    this.controles.enablePan = true;
    this.controles.addEventListener('change', () => this.pedirDibujo());
    this.controles.addEventListener('start', () => {
      this.camaraMovida = true;
    });

    this.rayo = new THREE.Raycaster();
    lienzo.addEventListener('pointerdown', this.alBajar);
    lienzo.addEventListener('pointerup', this.alSoltar);
    lienzo.addEventListener('pointermove', this.alMover);
    lienzo.addEventListener('pointerleave', this.alSalir);
    lienzo.addEventListener('pointercancel', this.alSalir);

    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(lienzo);
    this.redimensionar();

    // El tema cambia por atributo en <html> o por el sistema: los colores de
    // las piezas salen de tokens, así que se vuelven a leer en los dos casos.
    this.temaObservado = new MutationObserver(() => this.pintar());
    this.temaObservado.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-tema'] });
    this.esquemaOscuro.addEventListener('change', this.alCambiarTema);
    this.movimiento.addEventListener('change', this.alCambiarMovimiento);
  }

  ponerPartes(partes: readonly AnatomyPart[]): void {
    this.partePorMalla = new Map(partes.map((p) => [p.meshId, p]));
    this.pintar();
  }

  aplicar(capas: readonly AnatomyLayer[], sexo: AnatomySex, elegidas: readonly string[], relacionadas: readonly string[]): void {
    if (this.liberado) return;
    this.estado = { capas, sexo, elegidas: new Set(elegidas), relacionadas: new Set(relacionadas) };
    for (const capa of capas) {
      if (!this.capasCargadas.has(capa)) {
        this.fallidas.delete(capa);
        void this.cargarCapa(capa).then(
          () => this.informarCarga(),
          () => {
            this.fallidas.add(capa);
            this.informarCarga();
          },
        );
      }
    }
    this.informarCarga();
    this.pintar();
  }

  /**
   * El estado de carga sale de TODAS las capas pedidas, no de la última
   * tanda: un éxito posterior no tapa un fallo, ni una capa lista oculta
   * otra que sigue bajando.
   */
  private informarCarga(): void {
    if (this.liberado) return;
    const pedidas = this.estado.capas;
    if (pedidas.some((c) => this.fallidas.has(c))) this.opciones.alCargar('error');
    else if (pedidas.some((c) => !this.listas.has(c))) this.opciones.alCargar('loading');
    else this.opciones.alCargar('ready');
    this.pintar();
  }

  private cargarCapa(capa: AnatomyLayer): Promise<void> {
    const pedido = this.cargador.loadAsync(this.opciones.urls[capa]).then((gltf) => {
      // Una capa que termina de bajar después de salir de la pantalla no se
      // agrega a un renderer ya liberado: se libera ella también.
      if (this.liberado) {
        gltf.scene.traverse((objeto) => {
          const malla = objeto as Mesh;
          if (!malla.isMesh) return;
          malla.geometry.dispose();
          malla.material.dispose();
        });
        return;
      }
      gltf.scene.traverse((objeto) => {
        const malla = objeto as Mesh;
        if (!malla.isMesh) return;
        malla.geometry.computeVertexNormals();
        malla.material.dispose();
        malla.material = new this.THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
        malla.userData['meshId'] = malla.name;
        this.mallas.set(malla.name, malla);
      });
      this.escena.add(gltf.scene);
      this.listas.add(capa);
      if (!this.camaraMovida) this.encuadrar();
    });
    // Un fallo no queda guardado: volver a encender la capa reintenta.
    this.capasCargadas.set(capa, pedido);
    pedido.catch(() => this.capasCargadas.delete(capa));
    return pedido;
  }

  /** Aplica capas, sexo y resaltado a cada malla, con los colores del tema vigente. */
  private pintar(): void {
    if (this.liberado) return;
    const estilo = getComputedStyle(this.host);
    const color = (token: string) => new this.THREE.Color(estilo.getPropertyValue(token).trim() || '#999999');
    const colores = Object.fromEntries(
      Object.entries(COLOR_DE_CAPA).map(([capa, token]) => [capa, color(token)]),
    ) as Record<AnatomyLayer, import('three').Color>;
    const elegido = color(COLOR_ELEGIDO);
    const relacionado = color(COLOR_RELACIONADO);
    const capas = new Set(this.estado.capas);
    // Hay foco sólo si la pieza elegida se está dibujando: una elegida en una
    // capa apagada no debe atenuar el resto sin resaltar nada.
    const hayFoco = [...this.estado.elegidas].some((id) => {
      const parte = this.partePorMalla.get(id);
      return parte !== undefined && capas.has(parte.layer) && this.mallas.has(id);
    });

    for (const [id, malla] of this.mallas) {
      const parte = this.partePorMalla.get(id);
      if (parte === undefined) {
        malla.visible = false;
        continue;
      }
      // «Mujer» esconde lo que es exclusivo del cuerpo masculino de referencia;
      // no agrega nada, porque no existe malla libre de órganos femeninos.
      malla.visible = capas.has(parte.layer) && !(this.estado.sexo === 'female' && parte.sex === 'male');
      const material = malla.material;
      const esElegida = this.estado.elegidas.has(id);
      const esRelacionada = this.estado.relacionadas.has(id);
      material.color.copy(esElegida ? elegido : esRelacionada ? relacionado : colores[parte.layer]);
      material.emissive.copy(esElegida ? elegido : esRelacionada ? relacionado : new this.THREE.Color(0x000000));
      material.emissiveIntensity = esElegida ? 0.35 : esRelacionada ? 0.2 : 0;
      const atenuada = hayFoco && !esElegida && !esRelacionada;
      // Cambiar `transparent` cambia el programa del material: sin
      // `needsUpdate`, three.js sigue dibujándolo opaco.
      if (material.transparent !== atenuada) material.needsUpdate = true;
      material.transparent = atenuada;
      material.opacity = atenuada ? OPACIDAD_DE_FONDO : 1;
      material.depthWrite = !atenuada;
      malla.renderOrder = atenuada ? 1 : 0;
    }
    this.pedirDibujo();
  }

  /**
   * Centra la cámara en lo que haya cargado, de frente.
   *
   * Se mide con todas las mallas cargadas, estén o no visibles: la vista no
   * cambia de escala al apagar una capa. La distancia hace entrar el alto y el
   * ancho en el lienzo —según su proporción— y suma la mitad de la profundidad,
   * porque la cara más cercana al ojo se ve más grande que el centro.
   */
  encuadrar(): void {
    const caja = new this.THREE.Box3();
    for (const malla of this.mallas.values()) caja.expandByObject(malla);
    if (caja.isEmpty()) return;
    this.camaraMovida = false;
    const centro = caja.getCenter(new this.THREE.Vector3());
    const tamano = caja.getSize(new this.THREE.Vector3());
    const tangente = Math.tan((this.camara.fov * Math.PI) / 360);
    const paraElAlto = tamano.y / 2 / tangente;
    const paraElAncho = tamano.x / 2 / (tangente * this.camara.aspect);
    const distancia = (Math.max(paraElAlto, paraElAncho) + tamano.z / 2) * 1.08;
    this.controles.target.copy(centro);
    this.camara.position.set(centro.x, centro.y, centro.z + distancia);
    this.camara.near = distancia / 100;
    this.camara.far = distancia * 10;
    this.camara.updateProjectionMatrix();
    this.controles.update();
    this.pedirDibujo();
  }

  /** Flechas giran, +/− acercan, Inicio encuadra. Devuelve si usó la tecla. */
  teclado(tecla: string): boolean {
    const desplazamiento = this.camara.position.clone().sub(this.controles.target);
    const esfera = new this.THREE.Spherical().setFromVector3(desplazamiento);
    switch (tecla) {
      case 'ArrowLeft':
        esfera.theta -= PASO_DE_GIRO;
        break;
      case 'ArrowRight':
        esfera.theta += PASO_DE_GIRO;
        break;
      case 'ArrowUp':
        esfera.phi = Math.max(0.1, esfera.phi - PASO_DE_GIRO);
        break;
      case 'ArrowDown':
        esfera.phi = Math.min(Math.PI - 0.1, esfera.phi + PASO_DE_GIRO);
        break;
      case '+':
      case '=':
        esfera.radius *= PASO_DE_ZOOM;
        break;
      case '-':
        esfera.radius /= PASO_DE_ZOOM;
        break;
      case 'Home':
        this.encuadrar();
        return true;
      default:
        return false;
    }
    this.camaraMovida = true;
    this.camara.position.copy(this.controles.target).add(new this.THREE.Vector3().setFromSpherical(esfera));
    this.controles.update();
    this.pedirDibujo();
    return true;
  }

  private mallaEn(evento: PointerEvent): string | null {
    const caja = this.lienzo.getBoundingClientRect();
    const punto = new this.THREE.Vector2(
      ((evento.clientX - caja.left) / caja.width) * 2 - 1,
      -((evento.clientY - caja.top) / caja.height) * 2 + 1,
    );
    this.rayo.setFromCamera(punto, this.camara);
    const visibles = [...this.mallas.values()].filter((m) => m.visible);
    const hayFoco = visibles.some((m) => this.estado.elegidas.has(m.name));
    // Con una pieza elegida, lo atenuado no tapa: se elige lo que se ve entero.
    const enFoco = hayFoco ? visibles.filter((m) => !m.material.transparent) : visibles;
    const impacto = this.rayo.intersectObjects(enFoco, false)[0] ?? this.rayo.intersectObjects(visibles, false)[0];
    return (impacto?.object.userData['meshId'] as string | undefined) ?? null;
  }

  private readonly alBajar = (evento: PointerEvent) => {
    this.punteros.add(evento.pointerId);
    // Sólo un toque o el botón principal elige; un pellizco o el clic
    // derecho son para mover la cámara.
    this.inicio = evento.button === 0 && this.punteros.size === 1 ? { x: evento.clientX, y: evento.clientY } : null;
  };

  private readonly alSoltar = (evento: PointerEvent) => {
    this.punteros.delete(evento.pointerId);
    if (this.inicio === null || evento.button !== 0) return;
    const movido = Math.hypot(evento.clientX - this.inicio.x, evento.clientY - this.inicio.y);
    this.inicio = null;
    if (movido > TOLERANCIA_DE_CLIC) return;
    this.opciones.alElegir(this.mallaEn(evento));
  };

  private cuadroDePaso = 0;
  private readonly alMover = (evento: PointerEvent) => {
    if (evento.pointerType !== 'mouse' || this.cuadroDePaso !== 0) return;
    this.cuadroDePaso = requestAnimationFrame(() => {
      this.cuadroDePaso = 0;
      this.opciones.alPasar(this.mallaEn(evento));
    });
  };

  private readonly alSalir = (evento: PointerEvent) => {
    this.punteros.delete(evento.pointerId);
    this.opciones.alPasar(null);
  };
  private readonly alCambiarTema = () => this.pintar();
  private readonly alCambiarMovimiento = () => {
    this.controles.enableDamping = !this.movimiento.matches;
  };

  private redimensionar(): void {
    const { clientWidth: ancho, clientHeight: alto } = this.lienzo;
    if (ancho === 0 || alto === 0) return;
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    if (!this.camaraMovida && this.mallas.size > 0) this.encuadrar();
    this.pedirDibujo();
  }

  private pedirDibujo(): void {
    if (this.pendiente !== 0 || this.liberado) return;
    this.pendiente = requestAnimationFrame(() => {
      this.pendiente = 0;
      // Con inercia, `update` sigue moviendo la cámara unos cuadros y vuelve a
      // disparar `change`, que pide el siguiente dibujo.
      this.controles.update();
      this.renderer.render(this.escena, this.camara);
    });
  }

  liberar(): void {
    this.liberado = true;
    cancelAnimationFrame(this.pendiente);
    cancelAnimationFrame(this.cuadroDePaso);
    this.observador.disconnect();
    this.temaObservado.disconnect();
    this.esquemaOscuro.removeEventListener('change', this.alCambiarTema);
    this.movimiento.removeEventListener('change', this.alCambiarMovimiento);
    this.lienzo.removeEventListener('pointerdown', this.alBajar);
    this.lienzo.removeEventListener('pointerup', this.alSoltar);
    this.lienzo.removeEventListener('pointermove', this.alMover);
    this.lienzo.removeEventListener('pointerleave', this.alSalir);
    this.lienzo.removeEventListener('pointercancel', this.alSalir);
    this.controles.dispose();
    for (const malla of this.mallas.values()) {
      malla.geometry.dispose();
      malla.material.dispose();
    }
    this.renderer.dispose();
    // Sin esto el contexto WebGL vive hasta que pase el recolector, y Chromium
    // corta en unos 16 contextos: volver varias veces al atlas los agotaría.
    this.renderer.forceContextLoss();
  }
}
