import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  Injector,
  computed,
  createComponent,
  effect,
  inject,
  signal,
  viewChild,
  type ComponentRef,
  type ElementRef,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { valoresParaEntradas } from '../../core/mock/faker';

import { COMPONENTES } from './component-index.generated';
import { ETIQUETA_DE_NIVEL, type ComponenteDelStock, type NivelDeComponente } from './component-stock.types';

/* ============================================================================
    El stock de componentes.

    Una lista de los 444 componentes del proyecto y, para cada uno, una ficha
    que lo **monta de verdad** con datos generados. No es la vitrina de
    `/design-system`, que es una página escrita a mano con las piezas que
    alguien se acordó de poner: esto sale del código, así que lo que falta
    aparece solo.

    Para qué sirve, en concreto: recorrer los componentes uno por uno —con las
    flechas del teclado— y ver cuál revienta al montarse, cuál pide una entrada
    obligatoria que nadie le pasa, cuál usa un selector que no importó, cuál no
    tiene prueba. Eso es lo que la lista de «problemas» de cada ficha reúne.

    Vive detrás de `environment.mockBackend`, es decir, sólo en la rama
    `mockup`: monta componentes con datos falsos y no tiene nada que hacer en
    producción.
    ========================================================================== */

const NIVELES: readonly NivelDeComponente[] = [
  'atomo',
  'molecula',
  'organismo',
  'pantalla',
  'maqueta',
  'otro',
];

@Component({
  selector: 'app-component-stock',
  imports: [RouterLink],
  templateUrl: './component-stock.html',
  styleUrl: './component-stock.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComponentStock {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly entorno = inject(EnvironmentInjector);
  private readonly app = inject(ApplicationRef);

  protected readonly todos = COMPONENTES;
  protected readonly niveles = NIVELES;
  protected readonly etiquetaDeNivel = ETIQUETA_DE_NIVEL;

  /* ---- filtros del listado ------------------------------------------------ */

  protected readonly texto = signal('');
  protected readonly nivel = signal<NivelDeComponente | 'todos'>('todos');
  protected readonly soloConProblemas = signal(false);

  protected readonly filtrados = computed(() => {
    const busca = this.texto().trim().toLowerCase();
    const nivel = this.nivel();
    const soloProblemas = this.soloConProblemas();
    return this.todos.filter((c) => {
      if (nivel !== 'todos' && c.nivel !== nivel) return false;
      if (soloProblemas && c.problemas.length === 0) return false;
      if (busca === '') return true;
      return (
        c.clase.toLowerCase().includes(busca) ||
        c.selector.toLowerCase().includes(busca) ||
        c.clave.toLowerCase().includes(busca)
      );
    });
  });

  protected readonly recuento = computed(() => {
    const porNivel = new Map<NivelDeComponente, number>();
    for (const c of this.todos) porNivel.set(c.nivel, (porNivel.get(c.nivel) ?? 0) + 1);
    return {
      total: this.todos.length,
      conProblemas: this.todos.filter((c) => c.problemas.length > 0).length,
      porNivel: NIVELES.map((n) => ({ nivel: n, cuantos: porNivel.get(n) ?? 0 })).filter(
        (x) => x.cuantos > 0,
      ),
    };
  });

  /* ---- la ficha ----------------------------------------------------------- */

  /**
   * La clave que viene en la URL: `/design-system/stock/<clave>`.
   *
   * Se lee de la URL entera y no de `paramMap` porque la clave es una ruta de
   * archivo con barras y la ruta se declara con comodín: `paramMap` no trae
   * nada. `NavigationEnd` y no `router.url` a secas para que sea una señal que
   * cambie con cada navegación.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly elegido = computed<ComponenteDelStock | null>(() => {
    const prefijo = '/design-system/stock/';
    const url = this.url().split('?')[0]!.split('#')[0]!;
    if (!url.startsWith(prefijo)) return null;
    const clave = decodeURIComponent(url.slice(prefijo.length));
    return this.todos.find((c) => c.clave === clave) ?? null;
  });

  /** Posición dentro de la lista filtrada, para el «anterior / siguiente». */
  protected readonly posicion = computed(() => {
    const actual = this.elegido();
    if (actual === null) return null;
    const lista = this.filtrados().length > 0 ? this.filtrados() : this.todos;
    const indice = lista.findIndex((c) => c.clave === actual.clave);
    if (indice === -1) return { indice: 0, total: lista.length, anterior: null, siguiente: null };
    return {
      indice: indice + 1,
      total: lista.length,
      anterior: indice > 0 ? lista[indice - 1]!.clave : null,
      siguiente: indice < lista.length - 1 ? lista[indice + 1]!.clave : null,
    };
  });

  /**
   * La semilla con la que se generan los datos de la ficha.
   *
   * Cambiarla es el botón «otros datos»: el componente se vuelve a montar con
   * valores distintos. Sirve para lo que una sola tirada no muestra —un texto
   * largo que desborda, una lista vacía, un nombre con tilde— y es la diferencia
   * entre ver el componente y probarlo.
   */
  protected readonly semilla = signal(0);

  protected readonly estadoDelMontaje = signal<'vacío' | 'montando' | 'montado' | 'falló'>('vacío');
  protected readonly errorDelMontaje = signal<string | null>(null);
  protected readonly avisosDeConsola = signal<readonly string[]>([]);
  protected readonly valoresUsados = signal<Record<string, unknown>>({});

  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');
  private montado: ComponentRef<unknown> | null = null;

  constructor() {
    // Monta —y vuelve a montar— cada vez que cambia el componente elegido o la
    // semilla. `effect` y no un `ngOnChanges` porque las dos cosas son señales.
    effect(() => {
      const componente = this.elegido();
      const semilla = this.semilla();
      const destino = this.lienzo();
      if (componente === null || destino === undefined) return;
      void this.montar(componente, semilla, destino.nativeElement);
    });
  }

  private async montar(
    componente: ComponenteDelStock,
    semilla: number,
    destino: HTMLElement,
  ): Promise<void> {
    this.destruirMontado(destino);
    this.estadoDelMontaje.set('montando');
    this.errorDelMontaje.set(null);
    this.avisosDeConsola.set([]);

    const capturados: string[] = [];
    const warnOriginal = console.warn;
    const errorOriginal = console.error;
    console.warn = (...args: unknown[]) => {
      capturados.push(`aviso: ${args.map(String).join(' ')}`);
      warnOriginal(...args);
    };
    console.error = (...args: unknown[]) => {
      capturados.push(`error: ${args.map(String).join(' ')}`);
      errorOriginal(...args);
    };

    try {
      const clase = await componente.cargar();
      const valores = valoresParaEntradas(
        componente.entradas.map((e) => ({ nombre: e.nombre, tipo: e.tipo, requerido: e.requerido })),
        `${componente.clave}-${semilla}`,
      );
      this.valoresUsados.set(valores);

      const referencia = createComponent(clase, {
        environmentInjector: this.entorno,
        elementInjector: this.injector,
        hostElement: destino,
      });

      for (const [nombre, valor] of Object.entries(valores)) {
        try {
          referencia.setInput(nombre, valor);
        } catch {
          // Una entrada que no acepta el valor generado no tumba la ficha: se
          // ve en la lista de valores y el componente se monta con el resto.
        }
      }

      // Se engancha a la aplicación para que el componente reciba detección de
      // cambios como cualquier otro: sin esto, lo que dependa de una señal
      // asíncrona —una lectura del backend simulado— nunca se repinta y la
      // ficha muestra un esqueleto para siempre.
      this.app.attachView(referencia.hostView);
      referencia.changeDetectorRef.detectChanges();
      this.montado = referencia;
      this.estadoDelMontaje.set('montado');
    } catch (error) {
      this.estadoDelMontaje.set('falló');
      this.errorDelMontaje.set(error instanceof Error ? error.message : String(error));
    } finally {
      console.warn = warnOriginal;
      console.error = errorOriginal;
      this.avisosDeConsola.set(capturados);
    }
  }

  private destruirMontado(destino: HTMLElement): void {
    if (this.montado !== null) {
      this.app.detachView(this.montado.hostView);
      this.montado.destroy();
    }
    this.montado = null;
    destino.replaceChildren();
  }

  protected otrosDatos(): void {
    this.semilla.update((n) => n + 1);
  }

  protected irA(clave: string | null): void {
    if (clave === null) return;
    void this.router.navigate(['/design-system/stock', clave]);
  }

  protected teclado(evento: KeyboardEvent): void {
    const posicion = this.posicion();
    if (posicion === null) return;
    if (evento.key === 'ArrowLeft') this.irA(posicion.anterior);
    if (evento.key === 'ArrowRight') this.irA(posicion.siguiente);
  }

  protected informe(): string {
    const c = this.elegido();
    if (c === null) return '';
    const lista = (titulo: string, valores: readonly string[]): string =>
      valores.length === 0 ? '' : `\n**${titulo}:** ${valores.join(', ')}`;
    return [
      `## ${c.clase} \`<${c.selector}>\``,
      `- Archivo: \`${c.path}\``,
      `- Nivel: ${ETIQUETA_DE_NIVEL[c.nivel]}`,
      `- Entradas: ${c.entradas.length} · Salidas: ${c.salidas.length} · Prueba: ${c.tieneSpec ? 'sí' : 'no'}`,
      lista('Átomos', c.usa.atomos),
      lista('Moléculas', c.usa.moleculas),
      lista('Organismos', c.usa.organismos),
      lista('Clientes de API', c.clientes),
      `\n### Problemas (${c.problemas.length})`,
      ...c.problemas.map((p) => `- **${p.tipo}**: ${p.detalle}`),
      this.estadoDelMontaje() === 'falló' ? `- **no monta**: ${this.errorDelMontaje()}` : '',
      ...this.avisosDeConsola().map((a) => `- **consola**: ${a}`),
    ]
      .filter((linea) => linea !== '')
      .join('\n');
  }

  protected copiarInforme(): void {
    void navigator.clipboard?.writeText(this.informe());
  }
}
