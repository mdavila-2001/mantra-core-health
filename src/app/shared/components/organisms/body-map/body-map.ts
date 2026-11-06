import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  signal,
  untracked,
} from '@angular/core';

import { ShareService } from '../../../utils/share/share.service';
import { AppButton } from '../../atoms/button/button';
import { SegmentedControl } from '../../molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../molecules/segmented-control/segmented-control.types';
import { ShareMenu, type ShareFormat } from '../../molecules/share-menu/share-menu';
import { ToastService } from '../../molecules/toast/toast.service';
import { deliverBodyMap, readBodyMapColors, type BodyMapSnapshot } from './body-map.export';
import { VisorDelCuerpo } from './body-map.viewer';
import { BodyMapPaint } from './body-map.paint';
import { ImagenesDelCuerpo } from './body-map.images';
import {
  VISTAS_DEL_CUERPO,
  VISTAS_DEL_CUERPO_FEMENINA,
  VISTAS_DEL_CUERPO_MASCULINA,
  type IdDeVista,
  type VistaDelCuerpo,
} from './body-zones.geometry';
import {
  ESPERAR_IMAGEN_DE_VISTA,
  PARAMETRO_VISTA,
  PARAMETRO_ZONA,
  type PuntoTocado,
  type SexoDeLaSilueta,
  type VistaDibujable,
  type ZonaDibujable,
  type ZonaElegible,
} from './body-map.types';

export * from './body-map.types';

/** Interactive body map organism for clinical symptom localization. */
@Component({
  selector: 'app-body-map',
  imports: [AppButton, SegmentedControl, ShareMenu, BodyMapPaint],
  templateUrl: './body-map.html',
  styleUrl: './body-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown)': 'alPresionar($event)' },
})
export class BodyMap {
  /** Available body zones. Empty array renders empty state. */
  readonly zonas = input.required<readonly ZonaElegible[]>();

  /** Selected zone identifier or null. */
  readonly value = model<string | null>(null);

  /** Accessible label for screen readers. */
  readonly etiqueta = input('Silueta del cuerpo: toque dónde le pasa');

  /** Base test-id prefix. */
  readonly testId = input('body-map');

  /** Zones mentioned in voice or free text input to highlight without selecting. */
  readonly marcadas = input<readonly string[]>([]);

  /** Biological sex silhouette model (MALE, FEMALE, or undefined for neutral). */
  readonly sexo = input<SexoDeLaSilueta | undefined>(undefined);

  /** Available views based on selected sex model. */
  private readonly vistasDelSexo = computed<readonly VistaDelCuerpo[]>(() => {
    switch (this.sexo()) {
      case 'MALE':
        return VISTAS_DEL_CUERPO_MASCULINA;
      case 'FEMALE':
        return VISTAS_DEL_CUERPO_FEMENINA;
      default:
        return VISTAS_DEL_CUERPO;
    }
  });


  /** Currently hovered or focused zone ID. */
  private readonly apuntada = signal<string | null>(null);

  /** User requested view. */
  private readonly vistaPedida = signal<IdDeVista>('frente');

  /** Zone selected at the moment view was requested. */
  private readonly elegidaAlPedirVista = signal<string | null | undefined>(undefined);

  /** Renderable views with valid zone geometries. */
  protected readonly vistas = computed<readonly VistaDibujable[]>(() => {
    const byId = new Map(this.zonas().map((z) => [z.id, z]));
    return this.vistasDelSexo().flatMap((v) => {
      const zones = v.zonas.flatMap((s) => {
        const z = byId.get(s.id);
        if (!z) return [];
        return [{ ...z, d: s.d, centros: s.centros, madre: s.madre, acercaA: s.acercaA }];
      });
      return zones.length > 0 ? [{ vista: v, zonas: zones }] : [];
    });
  });

  /** Target view based on user selection or active selected zone. */
  protected readonly vista = computed<VistaDibujable | null>(() => {
    const list = this.vistas();
    const target = list.find((v) => v.vista.id === this.vistaPedida()) ?? list[0] ?? null;
    const selected = this.value();
    if (!target || !selected || selected === this.elegidaAlPedirVista()) return target;
    if (target.zonas.some((z) => z.id === selected)) return target;
    return list.find((v) => v.zonas.some((z) => z.id === selected)) ?? target;
  });

  private readonly esperaLaImagen =
    isPlatformBrowser(inject(PLATFORM_ID)) && inject(ESPERAR_IMAGEN_DE_VISTA);

  /** Preloaded and decoded body images. */
  protected readonly imagenes = new ImagenesDelCuerpo(inject(DestroyRef));

  /** Active visible view waiting on image readiness when enabled. */
  protected readonly vistaVisible = linkedSignal<
    { objetivo: VistaDibujable | null; listas: ReadonlySet<string> },
    VistaDibujable | null
  >({
    source: () => ({ objetivo: this.vista(), listas: this.imagenes.listas() }),
    computation: ({ objetivo, listas }, prev) => {
      if (!objetivo) return null;
      if (!this.esperaLaImagen || listas.has(objetivo.vista.image)) return objetivo;
      return prev?.value ?? objetivo;
    },
  });

  /** True when target view image is still loading. */
  protected readonly cambiandoDeVista = computed(() => {
    const target = this.vista();
    return target !== null && target !== this.vistaVisible();
  });

  /** Exact tapped coordinate inside zone. */
  private readonly puntoTocado = signal<PuntoTocado | null>(null);

  /** Active tapped coordinates valid for current selection and view. */
  private readonly puntoDeLaElegida = computed<readonly [number, number] | null>(() => {
    const p = this.puntoTocado();
    const v = this.vistaVisible();
    if (!p || !v || p.zona !== this.value() || p.vista !== v.vista.id) return null;
    return [p.x, p.y];
  });

  /** Pin marker coordinates for selected zone. */
  protected readonly centrosDeLaElegida = computed<readonly (readonly [number, number])[]>(() => {
    const selected = this.value();
    if (!selected) return [];
    const tapped = this.puntoDeLaElegida();
    if (tapped) return [tapped];
    return this.vistaVisible()?.zonas.find((z) => z.id === selected)?.centros ?? [];
  });

  protected readonly opcionesDeVista = computed<readonly SegmentedOption<IdDeVista>[]>(() =>
    this.vistas().map(({ vista }) => ({ value: vista.id, label: vista.nombre })),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly compartir = inject(ShareService);
  private readonly avisos = inject(ToastService);

  /** Fullscreen view mode toggle. */
  protected readonly ampliado = signal(false);

  /** Share export in progress flag. */
  protected readonly exportando = signal(false);

  /** Natural viewBox width and height dimensions. */
  protected readonly caja = computed<readonly [number, number]>(() => {
    const [, , w, h] = (this.vistaVisible()?.vista.viewBox ?? '0 0 240 440')
      .split(' ')
      .map(Number);
    return [w, h];
  });

  /** Zoom and pan viewport controller. */
  protected readonly visor = new VisorDelCuerpo({
    caja: () => this.caja(),
    viewBoxBase: () => this.vistaVisible()?.vista.viewBox ?? '0 0 240 440',
    centroDeLaElegida: () => this.centrosDeLaElegida()[0],
  });

  /** Shareable deep link URL for current zone and view. */
  protected readonly enlaceParaCompartir = computed<string | null>(() => {
    const v = this.vista();
    if (!this.navegador || !v) return null;
    return this.compartir.linkWith({
      [PARAMETRO_ZONA]: this.value(),
      [PARAMETRO_VISTA]: v.vista.id,
    });
  });

  protected readonly tituloParaCompartir = computed(() => {
    const v = this.vistaVisible();
    const zone = this.nombreElegido();
    if (!v) return 'Mapa corporal';
    return zone ? `Mapa corporal · ${zone}` : `Mapa corporal · ${v.vista.nombre}`;
  });

  protected readonly marcadasPorId = computed(() => new Set(this.marcadas()));

  /** Highlighted zones formatted as descriptive text. */
  protected readonly nombresMarcados = computed<string | null>(() => {
    const ids = this.marcadasPorId();
    const names = this.zonas().filter((z) => ids.has(z.id)).map((z) => z.nombre);
    if (names.length === 0) return null;
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
  });

  /** Display name of hovered zone if distinct from selected. */
  protected readonly nombreApuntado = computed<string | null>(() => {
    const id = this.apuntada();
    if (!id || id === this.value()) return null;
    return this.zonas().find((z) => z.id === id)?.nombre ?? null;
  });

  protected estaMarcada(zona: ZonaDibujable): boolean {
    return this.marcadasPorId().has(zona.id) || this.marcadasPorId().has(zona.madre);
  }

  /** Accessible label including text match announcement. */
  protected nombreAccesible(zona: ZonaDibujable): string {
    return this.estaMarcada(zona) ? `${zona.nombre} (por lo que contó)` : zona.nombre;
  }

  constructor() {
    // Preload views in memory for instant switching.
    effect(() => {
      if (!this.esperaLaImagen) return;
      for (const v of this.vistasDelSexo()) void this.imagenes.precargar(v.image);
    });

    // Reset zoom when view changes.
    effect(() => {
      const v = this.vistaVisible()?.vista.id;
      untracked(() => {
        if (v !== undefined) this.visor.restablecer();
      });
    });

    // Restore deep linked view and zone if present.
    let linkParsed = false;
    effect(() => {
      const zones = this.zonas();
      if (linkParsed || !this.navegador || zones.length === 0) return;
      linkParsed = true;
      untracked(() => this.abrirDesdeElEnlace());
    });

    // Follow what was told: when nothing marked shows in the current view and no
    // zone is chosen, turn to a view that shows it («me duelen los ojos» → Cara).
    effect(() => {
      const ids = this.marcadasPorId();
      untracked(() => {
        const muestra = (v: VistaDibujable) => v.zonas.some((z) => ids.has(z.id) || ids.has(z.madre));
        const actual = this.vista();
        if (ids.size === 0 || this.value() || !actual || muestra(actual)) return;
        const otra = this.vistas().find(muestra);
        if (otra) this.vistaPedida.set(otra.vista.id);
      });
    });

    // Clear pinned tap coordinates when active zone selection changes.
    effect(() => {
      const selected = this.value();
      untracked(() => {
        if (this.puntoTocado()?.zona !== selected) this.puntoTocado.set(null);
      });
    });

    // Prevent background scrolling when expanded to full screen.
    effect((onCleanup) => {
      if (!this.ampliado() || !this.navegador) return;
      const body = this.document.body;
      const prev = body.style.overflow;
      body.style.overflow = 'hidden';
      onCleanup(() => (body.style.overflow = prev));
    });
  }

  /** Restores view and zone from the URL; only drawn zones (an old coarse link has nothing to pin). */
  private abrirDesdeElEnlace(): void {
    const params = new URLSearchParams(this.document.location.search);
    const z = params.get(PARAMETRO_ZONA);
    const v = params.get(PARAMETRO_VISTA);
    if (v && this.vistas().some((item) => item.vista.id === v)) {
      this.vistaPedida.set(v as IdDeVista);
    }
    if (z && !this.value() && this.vistas().some((v) => v.zonas.some((item) => item.id === z))) {
      this.value.set(z);
      this.elegidaAlPedirVista.set(z);
    }
  }

  /** Zone click handler. Distinguishes drag release and pins exact coordinate. */
  protected clicEnZona(zona: ZonaDibujable, event: MouseEvent): void {
    if (this.visor.consumirArrastre()) return;
    const v = this.vistaVisible();
    const svg = (event.currentTarget as SVGElement | null)?.ownerSVGElement;
    if (event.detail === 0 || !v || !svg || this.acercaOtraVista(zona)) {
      this.elegir(zona);
      return;
    }
    const pt = this.visor.puntoEnElDibujo(svg, event.clientX, event.clientY);
    if (!pt) {
      this.elegir(zona);
      return;
    }
    this.apuntada.set(null);
    this.puntoTocado.set({
      zona: zona.id,
      vista: v.vista.id,
      x: Math.round(pt[0] * 10) / 10,
      y: Math.round(pt[1] * 10) / 10,
    });
    this.value.set(zona.id);
  }

  /** Clears selected zone and pinned point. */
  protected quitar(): void {
    this.puntoTocado.set(null);
    this.value.set(null);
  }

  /** Checks if zone zooms into another view. */
  private acercaOtraVista(zona: ZonaDibujable): boolean {
    return zona.acercaA !== undefined && this.vistas().some((v) => v.vista.id === zona.acercaA);
  }

  protected alternarAmpliado(): void {
    this.ampliado.update((open) => !open);
  }

  /** Keyboard shortcuts: zoom keys go to the viewer; Escape closes the full-screen view. */
  protected alPresionar(event: KeyboardEvent): void {
    if (this.visor.alPresionar(event) || event.key !== 'Escape' || !this.ampliado()) return;
    event.preventDefault();
    this.alternarAmpliado();
  }

  private instantanea(v: VistaDibujable): BodyMapSnapshot {
    const z = v.zonas.find((cand) => cand.id === this.value());
    return {
      image: v.vista.image,
      box: this.caja(),
      viewName: v.vista.nombre,
      zoneName: z?.nombre ?? null,
      zonePath: z?.d ?? null,
      zoneCenters: z ? this.centrosDeLaElegida() : [],
      colors: readBodyMapColors(this.host.nativeElement),
    };
  }

  protected async exportar(format: ShareFormat): Promise<void> {
    const v = this.vistaVisible();
    if (!v || this.exportando()) return;
    this.exportando.set(true);
    try {
      await deliverBodyMap(format, this.instantanea(v), this.compartir);
    } catch {
      this.avisos.show({
        type: 'error',
        message: 'No pudimos preparar el archivo. Intente de nuevo en unos segundos.',
      });
    } finally {
      this.exportando.set(false);
    }
  }

  protected apuntar(id: string | null): void {
    this.apuntada.set(id);
  }

  /** Display name of active selected zone. */
  protected readonly nombreElegido = computed<string | null>(() => {
    const id = this.value();
    if (!id) return null;
    return this.zonas().find((z) => z.id === id)?.nombre ?? null;
  });

  protected cambiarVista(id: IdDeVista): void {
    this.apuntada.set(null);
    this.vistaPedida.set(id);
    this.elegidaAlPedirVista.set(this.value());
  }

  /** Selects or toggles active zone selection. */
  protected elegir(zona: ZonaDibujable): void {
    this.puntoTocado.set(null);
    const dest = zona.acercaA;
    if (dest !== undefined && this.acercaOtraVista(zona)) {
      this.apuntada.set(null);
      this.vistaPedida.set(dest);
      this.value.set(zona.id);
      this.elegidaAlPedirVista.set(zona.id);
      return;
    }
    this.value.set(this.value() === zona.id ? null : zona.id);
  }

  /** Spacebar activation without scrolling. */
  protected elegirConBarra(event: Event, zona: ZonaDibujable): void {
    event.preventDefault();
    this.elegir(zona);
  }
}
