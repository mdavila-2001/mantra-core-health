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

import { SessionStore } from '../../core/auth/session.store';
import { valoresParaEntradas } from '../../core/mock/faker';
import { apiRealForzada } from '../../core/mock/modo-api';
import { MOCK_USERS, emitirAccessToken, emitirRefreshToken } from '../../core/mock/mock-session';

import { COMPONENTES } from './component-index.generated';
import {
  ETIQUETA_DE_NIVEL,
  type ComponenteDelStock,
  type NivelDeComponente,
} from './component-stock.types';

/* ============================================================================
    El stock de componentes: el banco de pruebas de la aplicación.

    La lista de todos los componentes del proyecto —sacada del código, no
    escrita a mano— y, para cada uno, un banco donde se monta de verdad:

      · dentro de un `iframe` con el tamaño de un móvil, una tableta o un
        escritorio. El iframe no es un capricho: un `<div>` de 390 px de ancho
        **no** dispara las media queries, porque las consulta el viewport y no
        el elemento. Sin iframe no se ve el diseño adaptable, se ve un
        componente estrecho.
      · con datos generados que se pueden regenerar con otra semilla o editar a
        mano, entrada por entrada;
      · como cualquiera de las cinco cuentas de prueba;
      · y, si se enciende el interruptor, contra la API de verdad en vez del
        backend simulado, para comparar los dos lados.

    Lo que se recoge de cada montaje —errores, avisos, peticiones, accesibilidad
    y tiempo— es la parte que sirve para depurar: está en la ficha y no hay que
    abrir la consola ni la pestaña de red del navegador.
    ========================================================================== */

const NIVELES: readonly NivelDeComponente[] = [
  'atomo',
  'molecula',
  'organismo',
  'pantalla',
  'maqueta',
  'otro',
];

export interface Dispositivo {
  readonly clave: string;
  readonly nombre: string;
  readonly ancho: number;
  readonly alto: number;
}

/** Tamaños reales de dispositivos, no números redondos. */
const DISPOSITIVOS: readonly Dispositivo[] = [
  { clave: 'movil-chico', nombre: 'Móvil chico', ancho: 320, alto: 568 },
  { clave: 'movil', nombre: 'Móvil', ancho: 390, alto: 844 },
  { clave: 'tableta', nombre: 'Tableta', ancho: 768, alto: 1024 },
  { clave: 'portatil', nombre: 'Portátil', ancho: 1280, alto: 800 },
  { clave: 'escritorio', nombre: 'Escritorio', ancho: 1600, alto: 900 },
];

type Pestana = 'props' | 'composicion' | 'problemas' | 'red' | 'accesibilidad';

interface FalloDeAccesibilidad {
  readonly impacto: string;
  readonly descripcion: string;
  readonly nodos: number;
}

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
  private readonly session = inject(SessionStore);

  protected readonly todos = COMPONENTES;
  protected readonly niveles = NIVELES;
  protected readonly dispositivos = DISPOSITIVOS;
  protected readonly etiquetaDeNivel = ETIQUETA_DE_NIVEL;
  protected readonly cuentas = MOCK_USERS;
  protected readonly apiReal = apiRealForzada;

  /* ---- navegación --------------------------------------------------------- */

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

  /* ---- filtros y árbol ---------------------------------------------------- */

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

  /** El árbol de la izquierda, agrupado por nivel, que es como se busca. */
  protected readonly grupos = computed(() =>
    NIVELES.map((nivel) => ({
      nivel,
      etiqueta: ETIQUETA_DE_NIVEL[nivel],
      componentes: this.filtrados().filter((c) => c.nivel === nivel),
    })).filter((grupo) => grupo.componentes.length > 0),
  );

  protected readonly recuento = computed(() => ({
    total: this.todos.length,
    filtrados: this.filtrados().length,
    conProblemas: this.todos.filter((c) => c.problemas.length > 0).length,
  }));

  protected readonly posicion = computed(() => {
    const actual = this.elegido();
    if (actual === null) return null;
    const lista = this.filtrados();
    const indice = lista.findIndex((c) => c.clave === actual.clave);
    if (indice === -1) return { indice: 0, total: lista.length, anterior: null, siguiente: null };
    return {
      indice: indice + 1,
      total: lista.length,
      anterior: indice > 0 ? lista[indice - 1]!.clave : null,
      siguiente: indice < lista.length - 1 ? lista[indice + 1]!.clave : null,
    };
  });

  /* ---- controles del banco ------------------------------------------------ */

  protected readonly dispositivo = signal<Dispositivo>(DISPOSITIVOS[3]!);
  protected readonly apaisado = signal(false);
  protected readonly zoom = signal(1);
  protected readonly semilla = signal(0);
  protected readonly matriz = signal(false);
  protected readonly pestana = signal<Pestana>('props');
  protected readonly cuenta = signal<string | null>(null);

  protected readonly ancho = computed(() =>
    this.apaisado() ? this.dispositivo().alto : this.dispositivo().ancho,
  );
  protected readonly alto = computed(() =>
    this.apaisado() ? this.dispositivo().ancho : this.dispositivo().alto,
  );

  /* ---- resultado del montaje ---------------------------------------------- */

  protected readonly estado = signal<'vacío' | 'montando' | 'montado' | 'falló'>('vacío');
  protected readonly error = signal<string | null>(null);
  protected readonly consola = signal<readonly string[]>([]);
  protected readonly peticiones = signal<readonly string[]>([]);
  protected readonly valores = signal<Record<string, unknown>>({});
  protected readonly editados = signal<Record<string, unknown>>({});
  protected readonly accesibilidad = signal<readonly FalloDeAccesibilidad[] | null>(null);
  protected readonly auditando = signal(false);
  protected readonly milisegundos = signal<number | null>(null);

  private readonly marco = viewChild<ElementRef<HTMLIFrameElement>>('marco');
  private montados: ComponentRef<unknown>[] = [];

  /** Las ramas de la primera entrada que sea una unión: la matriz de variantes. */
  protected readonly variantes = computed(() => {
    const componente = this.elegido();
    if (componente === null) return null;
    for (const entrada of componente.entradas) {
      const ramas = [...entrada.tipo.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
      if (ramas.length > 1) return { entrada: entrada.nombre, ramas };
    }
    return null;
  });

  protected readonly totalDeProblemas = computed(() => {
    const componente = this.elegido();
    if (componente === null) return 0;
    return (
      componente.problemas.length +
      this.consola().length +
      (this.estado() === 'falló' ? 1 : 0) +
      (this.accesibilidad()?.length ?? 0)
    );
  });

  protected readonly valorDe = computed(() => (nombre: string) => {
    const valor = this.valores()[nombre];
    if (valor === undefined) return '';
    return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  });

  constructor() {
    effect(() => {
      const componente = this.elegido();
      const marco = this.marco();
      // Estas lecturas son las que hacen que el efecto vuelva a correr.
      this.semilla();
      this.matriz();
      this.editados();
      this.cuenta();
      this.apiReal();
      this.ancho();
      if (componente === null || marco === undefined) return;
      void this.montar(componente, marco.nativeElement);
    });
  }

  /* ---- el montaje --------------------------------------------------------- */

  private async montar(componente: ComponenteDelStock, marco: HTMLIFrameElement): Promise<void> {
    const documento = marco.contentDocument;
    if (documento === null) return;

    this.desmontar();
    this.estado.set('montando');
    this.error.set(null);
    this.accesibilidad.set(null);

    const capturados: string[] = [];
    const restaurarConsola = this.capturarConsola(capturados);
    const pedidas: string[] = [];
    const dejarDeMirarLaRed = this.mirarLaRed(pedidas);
    const arranque = performance.now();

    try {
      this.aplicarCuenta();
      const clase = await componente.cargar();

      this.prepararDocumento(documento);
      const cuerpo = documento.body;

      const variantes = this.matriz() ? this.variantes() : null;
      const instancias =
        variantes === null
          ? [{ extra: {} as Record<string, unknown>, rotulo: null as string | null }]
          : variantes.ramas.map((rama) => ({
              extra: { [variantes.entrada]: rama } as Record<string, unknown>,
              rotulo: `${variantes.entrada} = ${rama}`,
            }));

      const generados = valoresParaEntradas(
        componente.entradas.map((e) => ({ nombre: e.nombre, tipo: e.tipo, requerido: e.requerido })),
        `${componente.clave}-${this.semilla()}`,
      );
      const valores = { ...generados, ...this.editados() };
      this.valores.set(valores);

      for (const instancia of instancias) {
        if (instancia.rotulo !== null) {
          const rotulo = documento.createElement('p');
          rotulo.textContent = instancia.rotulo;
          rotulo.setAttribute(
            'style',
            'margin:14px 0 4px;font:600 11px/1.4 system-ui,sans-serif;opacity:.5',
          );
          cuerpo.appendChild(rotulo);
        }
        const anfitrion = documento.createElement('div');
        cuerpo.appendChild(anfitrion);

        const referencia = createComponent(clase, {
          environmentInjector: this.entorno,
          elementInjector: this.injector,
          hostElement: anfitrion,
        });
        for (const [nombre, valor] of Object.entries({ ...valores, ...instancia.extra })) {
          try {
            referencia.setInput(nombre, valor);
          } catch {
            // Una entrada que no acepta el valor generado no tumba la ficha: se
            // monta con el resto y el valor se ve en la pestaña de entradas.
          }
        }
        this.app.attachView(referencia.hostView);
        referencia.changeDetectorRef.detectChanges();
        this.montados.push(referencia);
      }

      // Angular inyecta los estilos del componente en la cabecera del documento
      // **principal** al crearlo, no en la del iframe. Sin volver a copiarlos
      // después de montar, el componente aparece sin una sola regla propia.
      this.copiarEstilos(documento);

      this.estado.set('montado');
    } catch (error) {
      this.estado.set('falló');
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.milisegundos.set(Math.round(performance.now() - arranque));
      restaurarConsola();
      dejarDeMirarLaRed();
      this.consola.set(capturados);
      this.peticiones.set(pedidas);
    }
  }

  private desmontar(): void {
    for (const referencia of this.montados) {
      this.app.detachView(referencia.hostView);
      referencia.destroy();
    }
    this.montados = [];
  }

  /** Deja el iframe con los estilos de la aplicación y el cuerpo vacío. */
  private prepararDocumento(documento: Document): void {
    documento.body.replaceChildren();
    documento.documentElement.lang = 'es';
    this.copiarEstilos(documento);
    documento.body.setAttribute('style', 'margin:0;padding:16px;background:var(--color-bg,#fff)');
  }

  private copiarEstilos(documento: Document): void {
    const yaCopiados = new Set(
      [...documento.head.querySelectorAll('[data-copiado]')].map((nodo) =>
        nodo.getAttribute('data-copiado'),
      ),
    );
    document.head.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]').forEach((nodo, indice) => {
      const marca = `${indice}-${nodo.tagName}-${nodo.textContent?.length ?? 0}`;
      if (yaCopiados.has(marca)) return;
      const copia = nodo.cloneNode(true) as HTMLElement;
      copia.setAttribute('data-copiado', marca);
      documento.head.appendChild(copia);
    });
  }

  /**
   * Entra como la cuenta elegida.
   *
   * Emite los mismos tokens que emitiría el backend simulado al iniciar sesión,
   * así que la pantalla montada ve exactamente la sesión que vería de verdad:
   * roles, organización y perfil incluidos. Es lo que hace que se pueda mirar
   * la misma pantalla como médica y como paciente sin salir del banco.
   */
  private aplicarCuenta(): void {
    const clave = this.cuenta();
    if (clave === null) return;
    const usuario = MOCK_USERS.find((u) => u.key === clave);
    if (usuario === undefined) return;
    this.session.start({
      accessToken: emitirAccessToken(usuario),
      refreshToken: emitirRefreshToken(usuario),
    });
    const tenant = usuario.tenants[0];
    if (tenant !== undefined) this.session.selectTenant(tenant);
  }

  private capturarConsola(destino: string[]): () => void {
    const avisoOriginal = console.warn;
    const errorOriginal = console.error;
    console.warn = (...args: unknown[]) => {
      destino.push(`aviso · ${args.map(String).join(' ')}`);
      avisoOriginal(...args);
    };
    console.error = (...args: unknown[]) => {
      destino.push(`error · ${args.map(String).join(' ')}`);
      errorOriginal(...args);
    };
    return () => {
      console.warn = avisoOriginal;
      console.error = errorOriginal;
    };
  }

  /**
   * Qué pidió a la red mientras se montaba.
   *
   * Con `PerformanceObserver` y no con un interceptor de Angular: así se ven
   * **todas** las peticiones, salgan del `HttpClient` o no, y sin tocar la
   * cadena de interceptores de la aplicación, que es justo lo que se está
   * poniendo a prueba.
   */
  private mirarLaRed(destino: string[]): () => void {
    if (typeof PerformanceObserver === 'undefined') return () => undefined;
    const observador = new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) {
        const url = entrada.name;
        if (/\.(js|css|woff2?|png|jpe?g|svg|webp|ico)(\?|$)/.test(url)) continue;
        if (url.startsWith('data:') || url.startsWith('blob:')) continue;
        destino.push(url.replace(location.origin, ''));
      }
    });
    observador.observe({ entryTypes: ['resource'] });
    // Se deja mirando después del montaje: las lecturas del backend simulado
    // llegan con latencia a propósito (120–300 ms) y sin esta espera la lista
    // salía vacía justo en las pantallas que más piden.
    return () => setTimeout(() => observador.disconnect(), 1500);
  }

  /* ---- acciones ----------------------------------------------------------- */

  protected otrosDatos(): void {
    this.editados.set({});
    this.semilla.update((n) => n + 1);
  }

  protected editar(nombre: string, valor: string): void {
    const entrada = this.elegido()?.entradas.find((e) => e.nombre === nombre);
    const convertido =
      entrada?.tipo === 'number'
        ? Number(valor)
        : entrada?.tipo === 'boolean'
          ? valor === 'true'
          : valor;
    this.editados.update((previos) => ({ ...previos, [nombre]: convertido }));
  }

  protected elegirDispositivo(clave: string): void {
    const encontrado = DISPOSITIVOS.find((d) => d.clave === clave);
    if (encontrado !== undefined) this.dispositivo.set(encontrado);
  }

  protected irA(clave: string | null): void {
    if (clave === null) return;
    void this.router.navigate(['/design-system/stock', clave]);
  }

  protected irAClase(clase: string): void {
    const destino = this.todos.find((c) => c.clase === clase);
    if (destino !== undefined) this.irA(destino.clave);
  }

  protected teclado(evento: KeyboardEvent): void {
    if (evento.target instanceof HTMLInputElement || evento.target instanceof HTMLSelectElement) {
      return;
    }
    const posicion = this.posicion();
    if (posicion === null) return;
    if (evento.key === 'ArrowLeft') this.irA(posicion.anterior);
    if (evento.key === 'ArrowRight') this.irA(posicion.siguiente);
  }

  /** Pasa axe por lo que hay montado dentro del iframe. */
  protected async auditar(): Promise<void> {
    const documento = this.marco()?.nativeElement.contentDocument;
    if (documento === null || documento === undefined) return;
    this.auditando.set(true);
    this.pestana.set('accesibilidad');
    try {
      const axe = await import('axe-core');
      const resultado = await axe.default.run(documento.body);
      this.accesibilidad.set(
        resultado.violations.map((v) => ({
          impacto: v.impact ?? 'sin clasificar',
          descripcion: v.help,
          nodos: v.nodes.length,
        })),
      );
    } catch (error) {
      this.accesibilidad.set([
        { impacto: 'error', descripcion: `no se pudo auditar: ${String(error)}`, nodos: 0 },
      ]);
    } finally {
      this.auditando.set(false);
    }
  }

  protected informe(): string {
    const c = this.elegido();
    if (c === null) return '';
    const lista = (titulo: string, valores: readonly string[]): string =>
      valores.length === 0 ? '' : `**${titulo}:** ${valores.join(', ')}`;
    return [
      `## ${c.clase} \`<${c.selector}>\``,
      `- Archivo: \`${c.path}\``,
      `- Nivel: ${ETIQUETA_DE_NIVEL[c.nivel]} · Prueba: ${c.tieneSpec ? 'sí' : 'no'}`,
      `- Montado en ${this.ancho()}×${this.alto()} px (${this.dispositivo().nombre}) en ${this.milisegundos()} ms`,
      this.cuenta() === null ? '' : `- Cuenta: ${this.cuenta()}`,
      this.apiReal() ? '- **Contra la API real**' : '',
      lista('Átomos', c.usa.atomos),
      lista('Moléculas', c.usa.moleculas),
      lista('Organismos', c.usa.organismos),
      lista('Clientes de API', c.clientes),
      '',
      `### Problemas (${this.totalDeProblemas()})`,
      ...c.problemas.map((p) => `- **${p.tipo}**: ${p.detalle}`),
      this.estado() === 'falló' ? `- **no monta**: ${this.error()}` : '',
      ...this.consola().map((a) => `- **consola**: ${a}`),
      ...(this.accesibilidad() ?? []).map(
        (a) => `- **a11y (${a.impacto})**: ${a.descripcion} · ${a.nodos} nodo(s)`,
      ),
      this.peticiones().length === 0
        ? ''
        : `\n### Peticiones\n${this.peticiones().map((p) => `- \`${p}\``).join('\n')}`,
    ]
      .filter((linea) => linea !== '')
      .join('\n');
  }

  protected copiarInforme(): void {
    void navigator.clipboard?.writeText(this.informe());
  }
}
