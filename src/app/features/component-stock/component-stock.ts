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
  linkedSignal,
  signal,
  viewChild,
  type ComponentRef,
  type ElementRef,
  type OnDestroy,
  type Type,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { SessionStore, type SessionTokens } from '../../core/auth/session.store';
import { generarEntradas, type ValorGenerado } from '../../core/mock/faker';
import { apiRealForzada } from '../../core/mock/modo-api';
import { MOCK_USERS, emitirAccessToken, emitirRefreshToken } from '../../core/mock/mock-session';

import { COMPONENTES } from './component-index.generated';
import type { AnfitrionDeEscenario, EscenarioDeComponente } from './escenarios/escenario.types';
import { escenariosDe } from './escenarios/escenarios';
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

type Pestana = 'props' | 'composicion' | 'salidas' | 'problemas' | 'red' | 'accesibilidad';

/**
 * La opción del selector de escenarios que monta «a ciegas», con los valores
 * del generador. Sigue existiendo para comparar: es lo que se ve cuando nadie
 * escribió un anfitrión.
 */
const VALORES_GENERADOS = 'valores-generados';

/**
 * Una dimensión de la acreditación de un componente. El estado va en palabras
 * y con marca propia: la ficha tiene que leerse igual en escala de grises.
 */
export interface DimensionDeAcreditacion {
  readonly clave: 'descubierto' | 'escenario' | 'monto' | 'interactuado' | 'visual' | 'bloqueado';
  readonly nombre: string;
  readonly estado: 'si' | 'no' | 'parcial' | 'sin-medir';
  readonly detalle: string;
}

const MARCA_DE_ESTADO: Readonly<Record<DimensionDeAcreditacion['estado'], string>> = {
  si: '✓ sí',
  no: '✗ no',
  parcial: '◐ parcial',
  'sin-medir': '— sin medir',
};

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
export class ComponentStock implements OnDestroy {
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

  /* ---- escenarios --------------------------------------------------------- */

  protected readonly valoresGenerados = VALORES_GENERADOS;

  /** Los anfitriones escritos a mano para el componente elegido; vacío si no hay. */
  protected readonly escenarios = computed<readonly EscenarioDeComponente[]>(() => {
    const componente = this.elegido();
    return componente === null ? [] : escenariosDe(componente.clave);
  });

  /**
   * Qué escenario montar: un id del registro, o {@link VALORES_GENERADOS} para
   * el montaje a ciegas. `null` es «el primero». Se olvida al cambiar de
   * componente, que es lo que `linkedSignal` hace solo.
   */
  private readonly escenarioPedido = linkedSignal<ComponenteDelStock | null, string | null>({
    source: this.elegido,
    computation: () => null,
  });

  /** El escenario vigente, o `null` cuando se monta con valores generados. */
  protected readonly escenario = computed<EscenarioDeComponente | null>(() => {
    const lista = this.escenarios();
    const pedido = this.escenarioPedido();
    if (lista.length === 0 || pedido === VALORES_GENERADOS) return null;
    return lista.find((candidato) => candidato.id === pedido) ?? lista[0] ?? null;
  });

  /** El anfitrión montado, para leerle lo que el componente emitió. */
  private readonly anfitrion = signal<AnfitrionDeEscenario | null>(null);
  protected readonly salidas = computed(() => this.anfitrion()?.salidas() ?? []);

  /**
   * Entradas cuyo valor generado el componente rechazó al montarse.
   *
   * Antes se tragaban en silencio y la ficha decía «montado»: un contrato que
   * se probó con la mitad de sus entradas quedaba acreditado como entero.
   */
  protected readonly entradasRechazadas = signal<readonly string[]>([]);

  /**
   * Entradas que el generador llenó sin poder cumplir su tipo (`[]`, `''`, un
   * texto adivinado por el nombre). El componente monta, pero ese montaje no
   * acredita su contrato: la ficha lo dice y nombra la entrada.
   */
  protected readonly entradasSinVerificar = signal<readonly { nombre: string; motivo: string }[]>([]);
  /** De dónde salió cada valor del montaje a ciegas, para la tabla de entradas. */
  protected readonly procedencias = signal<Readonly<Record<string, Omit<ValorGenerado, 'valor'>>>>({});

  /**
   * Un escenario cuyo contrato no se cumple: no se monta, y lo que estaba
   * montado sigue ahí. `conservado` dice qué es eso, o `null` si no había nada.
   */
  protected readonly contratoRechazado = signal<{
    readonly escenario: string;
    readonly violaciones: readonly string[];
    readonly conservado: string | null;
  } | null>(null);

  /**
   * Lo que está montado en el marco ahora, que puede no ser lo elegido: un
   * escenario rechazado deja en pantalla el último montaje que terminó bien.
   * La acreditación describe ESTO, no el pedido.
   */
  private readonly montajeVigente = signal<{ readonly etiqueta: string; readonly porEscenario: boolean } | null>(
    null,
  );

  /** Cuántos `ComponentRef` tiene vivos el banco ahora mismo. Debería ser 0 o 1+matriz. */
  protected readonly monturasVivas = signal(0);

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

  /**
   * Cada montaje saca un turno y sólo el último puede tocar el marco.
   *
   * `montar` espera la carga diferida del componente; si mientras tanto se
   * eligió otro, la ejecución vieja llegaba tarde, vaciaba el marco y montaba
   * encima: con B elegido quedaba A a la vista y B vivo sin DOM (medido con
   * una carga demorada de verdad, `evidencia/runtime-antes/`).
   */
  private turno = 0;

  /** El observador de red del montaje vigente y su corte diferido. */
  private red: { readonly observador: PerformanceObserver; corte: ReturnType<typeof setTimeout> | null } | null = null;

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
      this.entradasRechazadas().length +
      this.entradasSinVerificar().length +
      (this.contratoRechazado() === null ? 0 : 1) +
      (this.estado() === 'falló' ? 1 : 0) +
      (this.accesibilidad()?.length ?? 0)
    );
  });

  /**
   * La marca de una dimensión. En «Bloqueado» el «sí» es lo malo, así que no
   * lleva el tilde de «bien»: en escala de grises se leería al revés.
   */
  protected marca(dimension: DimensionDeAcreditacion): string {
    if (dimension.clave === 'bloqueado') return dimension.estado === 'si' ? '⚠ bloqueado' : '✓ libre';
    return MARCA_DE_ESTADO[dimension.estado];
  }

  /**
   * Las seis dimensiones de la ficha. Cuatro vienen del índice generado
   * (`acreditacion`) y dos de lo que pasó en ESTE banco: nada está escrito a
   * mano, y «descubierto» no alcanza para acreditar nada.
   */
  protected readonly acreditacion = computed<readonly DimensionDeAcreditacion[]>(() => {
    const c = this.elegido();
    if (c === null) return [];
    const estatica = c.acreditacion;
    const escenarios = this.escenarios();
    const rechazo = this.contratoRechazado();
    const sinVerificar = this.entradasSinVerificar().length + this.entradasRechazadas().length;
    // «Montó» e «Interactuado» hablan de lo que está en el marco. Si el escenario
    // pedido se rechazó, lo que está es el montaje conservado: se acredita ése y
    // el rechazo se dice aparte, sin hacer creer que no hay nada montado.
    const vigente = this.montajeVigente();
    const porEscenario = vigente?.porEscenario ?? this.escenario() !== null;

    const montoDelVigente = ((): Pick<DimensionDeAcreditacion, 'estado' | 'detalle'> => {
      switch (this.estado()) {
        case 'falló':
          return { estado: 'no', detalle: this.error() ?? 'no monta' };
        case 'montado':
          if (porEscenario) return { estado: 'si', detalle: 'por escenario, con un contrato escrito a mano' };
          return sinVerificar > 0
            ? { estado: 'parcial', detalle: `con valores generados: ${sinVerificar} entrada(s) sin verificar` }
            : { estado: 'si', detalle: 'con valores generados que cumplen su tipo declarado' };
        default:
          return { estado: 'sin-medir', detalle: 'todavía no terminó de montarse' };
      }
    })();
    const monto =
      rechazo === null
        ? montoDelVigente
        : {
            estado: montoDelVigente.estado,
            detalle:
              `montaje vigente: ${rechazo.conservado ?? 'ninguno'} (${montoDelVigente.detalle}). ` +
              `El escenario pedido «${rechazo.escenario}» no se montó: contrato inválido.`,
          };

    const salidas = this.salidas().length;
    return [
      { clave: 'descubierto', nombre: 'Descubierto', estado: estatica.descubierto ? 'si' : 'no', detalle: c.path },
      {
        clave: 'escenario',
        nombre: 'Escenario',
        estado: estatica.escenario === null ? 'no' : 'si',
        detalle:
          estatica.escenario === null
            ? 'sin anfitrión escrito a mano: sólo valores generados'
            : `${escenarios.length} variante(s) en ${estatica.escenario}`,
      },
      { clave: 'monto', nombre: 'Montó', ...monto },
      {
        clave: 'interactuado',
        nombre: 'Interactuado',
        estado: !porEscenario ? 'sin-medir' : salidas > 0 ? 'si' : 'no',
        detalle:
          !porEscenario
            ? 'con valores generados nadie escucha sus salidas'
            : salidas > 0
              ? `${salidas} salida(s) registradas en esta sesión`
              : 'todavía no emitió nada: tocá el componente en el marco',
      },
      {
        clave: 'visual',
        nombre: 'Verificado visualmente',
        estado: estatica.capturasVisuales.length > 0 ? 'si' : 'no',
        detalle:
          estatica.capturasVisuales.length > 0
            ? `${estatica.capturasVisuales.length} captura(s) versionada(s) de sus escenarios`
            : 'sin capturas versionadas de un escenario',
      },
      {
        clave: 'bloqueado',
        nombre: 'Bloqueado',
        estado: estatica.bloqueos.length > 0 ? 'si' : 'no',
        detalle: estatica.bloqueos[0] ?? 'nada externo impide acreditarlo',
      },
    ];
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
      this.escenario();
      if (componente === null || marco === undefined) return;
      void this.montar(componente, marco.nativeElement);
    });
  }

  ngOnDestroy(): void {
    // Un montaje que todavía esté cargando ya no es vigente.
    this.turno++;
    this.desmontar();
    this.dejarDeMirarLaRed();
    this.restaurarSesion();
  }

  /* ---- el montaje --------------------------------------------------------- */

  private async montar(componente: ComponenteDelStock, marco: HTMLIFrameElement): Promise<void> {
    const documento = marco.contentDocument;
    if (documento === null) return;
    const turno = ++this.turno;
    const escenario = this.escenario();

    // Un escenario inválido a propósito no se monta: se dice qué viola y lo que
    // estaba montado sigue ahí. Ver `EscenarioDeComponente.verificarContrato`.
    const violaciones = escenario?.verificarContrato?.() ?? [];
    if (escenario !== null && violaciones.length > 0) {
      this.contratoRechazado.set({
        escenario: escenario.titulo,
        violaciones,
        conservado: this.montajeVigente()?.etiqueta ?? null,
      });
      // Si había una carga en curso, el turno nuevo la cancela antes de que toque
      // el marco: lo que se ve sigue siendo el montaje vigente, y el estado lo dice.
      if (this.estado() === 'montando') this.estado.set(this.montajeVigente() === null ? 'vacío' : 'montado');
      // La observación de red NO se toca: pertenece al montaje vigente, que sigue.
      return;
    }
    this.contratoRechazado.set(null);

    this.estado.set('montando');
    this.error.set(null);
    this.accesibilidad.set(null);
    const arranque = performance.now();

    let clase: Type<unknown>;
    try {
      this.aplicarCuenta();
      // El componente se carga aunque se monte por su anfitrión: es la prueba
      // de que la ficha apunta al mismo archivo que el escenario importa.
      clase = await componente.cargar();
    } catch (error) {
      if (turno !== this.turno) return;
      this.fallar(documento, error, arranque);
      return;
    }
    // Mientras cargaba se eligió otra cosa: esta ejecución ya no es la vigente
    // y no toca el marco. Lo que está montado es de la vigente.
    if (turno !== this.turno) return;

    // De acá en adelante todo es síncrono: la consola y la red se miran sólo
    // durante ESTE montaje, sin solaparse con uno que siga pendiente.
    const capturados: string[] = [];
    const restaurarConsola = this.capturarConsola(capturados);
    this.mirarLaRed();
    try {
      this.desmontar();
      this.prepararDocumento(documento);
      const inyector = this.inyectorDelMarco(documento);

      if (escenario !== null) {
        this.montarEscenario(escenario, inyector, documento);
      } else {
        this.montarConValoresGenerados(componente, clase, inyector, documento);
      }

      // Angular inyecta los estilos del componente en la cabecera del documento
      // **principal** al crearlo, no en la del iframe. Sin volver a copiarlos
      // después de montar, el componente aparece sin una sola regla propia.
      this.copiarEstilos(documento);

      this.estado.set('montado');
      this.montajeVigente.set({
        etiqueta: `${componente.clase} · ${escenario?.titulo ?? 'valores generados'}`,
        porEscenario: escenario !== null,
      });
    } catch (error) {
      this.fallar(documento, error, arranque);
    } finally {
      restaurarConsola();
      this.consola.set(capturados);
      this.milisegundos.set(Math.round(performance.now() - arranque));
    }
  }

  /**
   * Un montaje que falla no deja nada detrás: ni una vista rota adjunta al
   * `ApplicationRef` —que volvía a fallar en cada ciclo y sumaba vistas vivas—
   * ni el nodo huérfano en el marco.
   */
  private fallar(documento: Document, error: unknown, arranque: number): void {
    this.desmontar();
    // El observador de red y su corte de 1,5 s eran del intento fallido: no
    // quedan vivos después de él.
    this.dejarDeMirarLaRed();
    documento.body.replaceChildren();
    this.montajeVigente.set(null);
    this.estado.set('falló');
    this.error.set(error instanceof Error ? error.message : String(error));
    this.milisegundos.set(Math.round(performance.now() - arranque));
  }

  /**
   * El inyector de elemento de lo montado: el del banco, pero con el `DOCUMENT`
   * del marco.
   *
   * Sin esto, un organismo que usa `DOCUMENT` —`ContentDialog` bloquea el
   * scroll del `body` y devuelve el foco al `activeElement`— actuaba sobre el
   * documento del ANFITRIÓN: bloqueaba el scroll del banco y el foco no volvía
   * al botón que abrió el modal dentro del marco (medido en
   * `evidencia/h3-antes/sonda-dialogo-descartable.json`). Es aislamiento
   * parcial: los servicios `providedIn: 'root'` siguen siendo los del anfitrión.
   */
  private inyectorDelMarco(documento: Document): Injector {
    return Injector.create({ providers: [{ provide: DOCUMENT, useValue: documento }], parent: this.injector });
  }

  /**
   * Monta el componente a través de su anfitrión, con un contrato válido.
   *
   * El anfitrión es quien sabe qué `ViewState`, qué columnas o qué contenido
   * proyectado necesita el organismo; el banco solo le fija la variante y le
   * lee las salidas. No hay valores generados que editar: las entradas las
   * decide el escenario, y eso es lo que lo hace reproducible.
   */
  private montarEscenario(escenario: EscenarioDeComponente, inyector: Injector, documento: Document): void {
    const anfitrion = documento.createElement('div');
    documento.body.appendChild(anfitrion);

    const referencia = createComponent(escenario.host, {
      environmentInjector: this.entorno,
      elementInjector: inyector,
      hostElement: anfitrion,
    });
    // Se registra ANTES de adjuntar y detectar: si el primer ciclo falla, el
    // desmontaje lo encuentra y lo destruye.
    this.registrar(referencia);
    referencia.setInput('variante', escenario.variante);
    this.app.attachView(referencia.hostView);
    referencia.changeDetectorRef.detectChanges();

    this.anfitrion.set(referencia.instance);
    this.valores.set({ variante: escenario.variante });
    this.entradasRechazadas.set([]);
    this.entradasSinVerificar.set([]);
    this.procedencias.set({});
  }

  private registrar(referencia: ComponentRef<unknown>): void {
    this.montados.push(referencia);
    this.monturasVivas.set(this.montados.length);
  }

  /**
   * El montaje a ciegas: cada entrada recibe lo que el generador adivina por
   * su nombre y su tipo. Alcanza para un botón; para un organismo, no —y por
   * eso existen los escenarios—.
   */
  private montarConValoresGenerados(
    componente: ComponenteDelStock,
    clase: Type<unknown>,
    inyector: Injector,
    documento: Document,
  ): void {
    const cuerpo = documento.body;

    const variantes = this.matriz() ? this.variantes() : null;
    const instancias =
      variantes === null
        ? [{ extra: {} as Record<string, unknown>, rotulo: null as string | null }]
        : variantes.ramas.map((rama) => ({
            extra: { [variantes.entrada]: rama } as Record<string, unknown>,
            rotulo: `${variantes.entrada} = ${rama}`,
          }));

    const generados = generarEntradas(
      componente.entradas.map((e) => ({ nombre: e.nombre, tipo: e.tipo, requerido: e.requerido })),
      `${componente.clave}-${this.semilla()}`,
    );
    const editados = this.editados();
    const valores = { ...generados.valores, ...editados };
    this.valores.set(valores);
    this.anfitrion.set(null);
    // Lo que se escribió a mano deja de ser «sin verificar»: lo decidió alguien.
    this.entradasSinVerificar.set(generados.sinVerificar.filter((s) => !(s.nombre in editados)));
    this.procedencias.set(generados.procedencias);

    const rechazadas: string[] = [];
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
        elementInjector: inyector,
        hostElement: anfitrion,
      });
      this.registrar(referencia);
      for (const [nombre, valor] of Object.entries({ ...valores, ...instancia.extra })) {
        try {
          referencia.setInput(nombre, valor);
        } catch (error) {
          // Una entrada que no acepta el valor generado no tumba la ficha: se
          // monta con el resto. Pero no se calla: figura entre los problemas,
          // porque «montado» con una entrada descartada no acredita el contrato.
          rechazadas.push(`${nombre}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      this.app.attachView(referencia.hostView);
      referencia.changeDetectorRef.detectChanges();
    }
    this.entradasRechazadas.set(rechazadas);
  }

  private desmontar(): void {
    for (const referencia of this.montados) {
      this.app.detachView(referencia.hostView);
      referencia.destroy();
    }
    this.montados = [];
    this.monturasVivas.set(0);
    this.anfitrion.set(null);
  }

  /** Deja el iframe con los estilos de la aplicación y el cuerpo vacío. */
  private prepararDocumento(documento: Document): void {
    documento.body.replaceChildren();
    documento.documentElement.lang = 'es';
    // El tema vive en atributos del `<html>` del anfitrión (`data-theme` y el
    // `data-tema` que lee la hoja de ALOVIDA). Sin copiarlos, en oscuro el marco
    // mezclaba tokens de los dos temas: fondo blanco y cabeceras casi invisibles
    // (`evidencia/h6/h6-tema-oscuro.png`, antes de esta corrección).
    for (const atributo of ['data-theme', 'data-tema']) {
      const valor = document.documentElement.getAttribute(atributo);
      if (valor === null) documento.documentElement.removeAttribute(atributo);
      else documento.documentElement.setAttribute(atributo, valor);
    }
    this.copiarEstilos(documento);
    // Los mismos tokens que el `body` de la aplicación (styles.css). El anterior,
    // `--color-bg`, no existe: el marco caía siempre al blanco de respaldo.
    documento.body.setAttribute(
      'style',
      'margin:0;padding:16px;background:var(--bg-base,#fff);color:var(--text-primary,inherit)',
    );
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
    if (clave === null) {
      this.restaurarSesion();
      return;
    }
    const usuario = MOCK_USERS.find((u) => u.key === clave);
    if (usuario === undefined) return;

    // Se guarda la sesión con la que se entró al banco —una sola vez, antes de
    // pisarla— para poder devolverla al salir. Ver `restaurarSesion`.
    if (this.sesionAnfitriona === null) {
      const accessToken = this.session.accessToken();
      const refreshToken = this.session.refreshToken();
      this.sesionAnfitriona = {
        tokens:
          accessToken !== null && refreshToken !== null ? { accessToken, refreshToken } : null,
        tenant: this.session.activeTenantId(),
      };
    }

    this.session.start({
      accessToken: emitirAccessToken(usuario),
      refreshToken: emitirRefreshToken(usuario),
    });
    const tenant = usuario.tenants[0];
    if (tenant !== undefined) this.session.selectTenant(tenant);
  }

  /** La sesión de la aplicación antes de entrar como una cuenta de prueba. */
  private sesionAnfitriona: { tokens: SessionTokens | null; tenant: string | null } | null = null;

  /**
   * Devuelve la sesión que tenía la aplicación al entrar al banco.
   *
   * El iframe usa los inyectores del padre, así que `SessionStore` es **el
   * mismo** que el de la aplicación anfitriona: «entrar como la médica» pisaba
   * la sesión de quien estaba mirando, y al salir del banco seguía siendo la
   * médica. Una cuenta sintética no tiene que cambiar la sesión anfitriona;
   * mientras el banco no tenga un documento y un inyector propios, lo que se
   * puede hacer es devolverla.
   */
  private restaurarSesion(): void {
    const previa = this.sesionAnfitriona;
    if (previa === null) return;
    this.sesionAnfitriona = null;
    if (previa.tokens === null) {
      this.session.clear();
      return;
    }
    this.session.start(previa.tokens);
    if (previa.tenant !== null) this.session.selectTenant(previa.tenant);
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
   *
   * Lo que **no** ve: las peticiones que el backend simulado responde en
   * proceso. El interceptor las resuelve antes de que salgan, así que en la
   * rama `mockup` esta pestaña vacía significa «nada salió a la red», no
   * «el componente no pidió nada». Con «API real» encendida sí se ve todo.
   */
  private mirarLaRed(): void {
    this.dejarDeMirarLaRed();
    this.peticiones.set([]);
    if (typeof PerformanceObserver === 'undefined') return;
    const observador = new PerformanceObserver((lista) => {
      // Sólo anota el observador del montaje vigente. Lo reemplaza el próximo
      // montaje REAL; un escenario rechazado no monta nada y no lo toca (antes el
      // turno del intento rechazado lo apagaba: evidencia/cierre-hallazgos/antes/).
      if (this.red?.observador !== observador) return;
      const nuevas: string[] = [];
      for (const entrada of lista.getEntries()) {
        const url = entrada.name;
        if (/\.(js|css|woff2?|png|jpe?g|svg|webp|ico)(\?|$)/.test(url)) continue;
        if (url.startsWith('data:') || url.startsWith('blob:')) continue;
        // Lo que pide el servidor de desarrollo por su cuenta —componentes
        // por HMR, el cliente de Vite— no es del componente.
        if (/\/@(ng|vite|fs|id)\//.test(url)) continue;
        nuevas.push(url.replace(location.origin, ''));
      }
      if (nuevas.length > 0) this.peticiones.update((previas) => [...previas, ...nuevas]);
    });
    observador.observe({ entryTypes: ['resource'] });
    // Se deja mirando después del montaje: las lecturas del backend simulado
    // llegan con latencia a propósito (120–300 ms) y sin esta espera la lista
    // salía vacía justo en las pantallas que más piden. El corte es de este
    // montaje: el siguiente, o salir del banco, lo adelanta.
    const red = { observador, corte: null as ReturnType<typeof setTimeout> | null };
    red.corte = setTimeout(() => this.dejarDeMirarLaRed(), 1500);
    this.red = red;
  }

  private dejarDeMirarLaRed(): void {
    if (this.red === null) return;
    if (this.red.corte !== null) clearTimeout(this.red.corte);
    this.red.observador.disconnect();
    this.red = null;
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

  protected elegirEscenario(id: string): void {
    this.escenarioPedido.set(id);
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
      `- Nivel: ${ETIQUETA_DE_NIVEL[c.nivel]} (${c.nivelOrigen}) · Prueba: ${c.tieneSpec ? 'sí' : 'no'}`,
      `- Montado en ${this.ancho()}×${this.alto()} px (${this.dispositivo().nombre}) en ${this.milisegundos()} ms`,
      this.escenario() === null
        ? '- Montaje: valores generados (a ciegas)'
        : `- Escenario: ${this.escenario()?.id} · anfitrión \`${this.escenario()?.fuente}\``,
      this.cuenta() === null ? '' : `- Cuenta: ${this.cuenta()}`,
      this.apiReal() ? '- **Contra la API real**' : '',
      lista('Átomos', c.usa.atomos),
      lista('Moléculas', c.usa.moleculas),
      lista('Organismos', c.usa.organismos),
      lista('Clientes de API', c.clientes),
      lista('Importado sin instanciar', c.relaciones.disponibleSinInstanciar),
      lista('Sólo sus tipos', c.relaciones.soloTipo),
      lista('Carga dinámicamente', c.relaciones.cargaDinamica),
      ...c.unresolvedEvidence.map((u) => `- **sin resolver (${u.causa})**: ${u.detalle}`),
      '',
      `### Problemas (${this.totalDeProblemas()})`,
      ...c.problemas.map((p) => `- **${p.tipo}**: ${p.detalle}`),
      this.estado() === 'falló' ? `- **no monta**: ${this.error()}` : '',
      ...this.entradasRechazadas().map((r) => `- **entrada rechazada**: ${r}`),
      ...this.consola().map((a) => `- **consola**: ${a}`),
      this.salidas().length === 0
        ? ''
        : `\n### Salidas\n${this.salidas().map((s) => `- \`${s.salida}\` ${s.detalle}`).join('\n')}`,
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
