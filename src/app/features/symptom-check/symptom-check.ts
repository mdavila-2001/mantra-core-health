import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, timer, type Observable } from 'rxjs';

import { ProfilesClient } from '@core/data-access/profiles/profiles.client';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '@core/data-access/terminology/terminology.types';
import { TriageIaClient } from '@core/data-access/triage-ia/triage-ia.client';
import { ZONAS_DEL_CUERPO, type ZonaDelCuerpo } from './zonas.datos';
import { AppButton } from '@shared/components/atoms/button/button';
import { Chip } from '@shared/components/atoms/chip/chip';
import { Textarea } from '@shared/components/atoms/textarea/textarea';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import {
  BodyMap,
  ZONAS_CON_SILUETA,
  type ZonaElegible,
} from '@shared/components/organisms/body-map/body-map';

import {
  enumerar,
  explicar,
  normalizar,
  precalentar,
  reconocer,
  reconocerAlarmas,
  reconocerNegados,
  recomendar,
  sugerir,
  type Recomendacion,
  type Sintoma,
  TODOS_LOS_SINTOMAS,
} from './sintomas';
import { Dictado } from './dictado';
import {
  combinar,
  lecturaVigente,
  sintomasDeLaLectura,
  zonasDeLaLectura,
  type LecturaDelTexto,
} from './lectura-ia';
import { ultimaFrase } from './texto';

/**
 * Cuánto se espera a que la persona haga una pausa antes de preguntarle al
 * servicio de triage. Mientras tanto el motor local ya pintó lo suyo: esto sólo
 * evita una petición por tecla.
 */
const PAUSA_PARA_LEER_MS = 600;

/** Tope por página del listado de profesionales. */
const POR_PAGINA = 50;

/**
 * Sin especialidades conocidas.
 *
 * Una sola instancia: el mapa vacío es el estado inicial y el de todos los
 * fallos, y crear uno nuevo en cada rama haría que la señal se considere
 * cambiada cada vez que algo falla.
 */
const VACIO: ReadonlyMap<string, string> = new Map();

/**
 * **¿Qué te pasa?** — el punto de entrada del paciente (Frente C del plan de UX
 * del 22/08/2026).
 *
 * ## Qué problema resuelve
 *
 * Un paciente entraba y veía un lanzador de secciones: «Directorio»,
 * «Laboratorios», «Mensajes». Para usarlo hay que saber de antemano a qué
 * especialidad se va, que es justo lo que no sabe quien está con dolor de
 * cabeza hace tres días. El cliente lo pidió como «flujo como ClinicApp»: la
 * primera pantalla es de síntomas, y de ahí sale la recomendación.
 *
 * ## Cómo funciona, y por qué así
 *
 * 1. Se escribe en lenguaje corriente.
 * 2. Mientras se escribe, los síntomas reconocidos **se pintan como chips**.
 *    Ese es el corazón del flujo: es el acuse de recibo de «te entendí esto», y
 *    es lo que hace que la recomendación de después no se sienta adivinanza.
 * 3. Cada chip se puede quitar —un falso positivo no puede quedar atrapado— y
 *    se pueden agregar por autocompletado los que el texto no dijo.
 * 4. Con los chips puestos, se recomiendan especialidades **con su porqué**, y
 *    de ahí se salta al directorio de médicos ya filtrado.
 *
 * ## Lo que esta pantalla NO hace, y lo dice
 *
 * **No diagnostica.** Orienta hacia una especialidad, que es una decisión sobre
 * a quién consultar. El aviso es fijo y no depende de que nadie se acuerde de
 * ponerlo.
 *
 * Y frente a un **síntoma de alarma** deja de recomendar: manda a urgencias.
 * Ofrecerle a alguien que escribió «me duele el pecho y no puedo respirar» un
 * turno de cardiología para el jueves sería el peor resultado posible de esta
 * pantalla.
 *
 * ## Por qué las especialidades salen del directorio y no del catálogo
 *
 * Porque el catálogo de terminología tiene especialidades que en esta
 * plataforma no ejerce nadie, y recomendar una que lleva a un directorio vacío
 * es peor que no recomendar. Se cruzan las de la tabla con las que **de verdad
 * tienen profesionales publicados**.
 */
@Component({
  selector: 'app-symptom-check',
  imports: [Alert, AppButton, BodyMap, Card, Chip, FormField, RouterLink, Textarea],
  templateUrl: './symptom-check.html',
  // El dictado vive y muere con la pantalla: ver `Dictado`.
  providers: [Dictado],
  styleUrl: './symptom-check.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SymptomCheck {
  private readonly profiles = inject(ProfilesClient);
  private readonly publico = inject(PublicDirectoryClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly router = inject(Router);
  private readonly triageIa = inject(TriageIaClient);
  protected readonly dictado = inject(Dictado);

  constructor() {
    /* El índice del motor se arma la primera vez que se lo usa, y armarlo
       cuesta unas decenas de milisegundos. Si esa primera vez es la primera
       tecla, se siente. Se arma acá, después de que la pantalla ya se pintó y
       cuando el navegador no tiene nada mejor que hacer, así que para cuando
       alguien empieza a escribir ya está. */
    afterNextRender(() => {
      const cuandoPueda = globalThis.requestIdleCallback;
      if (typeof cuandoPueda === 'function') {
        cuandoPueda(() => precalentar());
      } else {
        setTimeout(() => precalentar());
      }
    });
  }

  /**
   * Si esta instancia trabaja **sin sesión**.
   *
   * Cambia de dónde salen las especialidades: con sesión, del directorio
   * interno (`GET /profiles/practitioners`); sin ella, del buscador público,
   * que es el único que responde a quien no entró. Sin esta distinción la
   * pantalla pública pedía un endpoint autenticado, se comía un 401 y quedaba
   * sin filtro — funcionaba, pero recomendando especialidades que no tienen a
   * nadie detrás.
   */
  readonly sinSesion = input(false);

  /**
   * A dónde lleva «ver profesionales». Con sesión, a la guía interna; sin
   * ella, al buscador público, que es la única que alguien sin cuenta puede
   * abrir.
   */
  readonly rutaDeResultados = input('/directory');

  /** Lo que la persona escribió, tal cual. */
  protected readonly texto = signal('');

  /** Los que se agregaron a mano por el autocompletado. */
  private readonly agregados = signal<readonly Sintoma[]>([]);

  /** Los que se quitaron a mano aunque el texto los nombre. */
  private readonly quitados = signal<ReadonlySet<string>>(new Set());

  /**
   * Si ya hace falta saber qué especialidades existen.
   *
   * **No se pide al abrir.** Esta pantalla encabeza el panel del paciente, que
   * es el destino del login: una lectura de cincuenta profesionales ahí la
   * pagaría todo el mundo, incluido quien entró a mirar cuándo era su turno y
   * no va a escribir una palabra. Se pide en cuanto alguien empieza a
   * escribir, que es bastante antes de que el dato haga falta.
   */
  private readonly haceFalta = signal(false);

  /**
   * Las especialidades que de verdad tienen profesionales, ya normalizadas.
   *
   * Un fallo **no rompe el flujo**: sin la lista no se filtra nada y se
   * recomiendan todas las de la tabla, que es peor que lo ideal y mucho mejor
   * que una pantalla que no funciona.
   */
  private readonly especialidadesDisponibles = toSignal(
    toObservable(this.haceFalta).pipe(
      switchMap((hace) => (hace ? this.leerEspecialidades() : of(VACIO))),
      catchError(() => of(VACIO)),
    ),
    { initialValue: VACIO },
  );

  /**
   * Los síntomas de alarma: los que dice el texto **y los que se tocaron**.
   *
   * Las zonas del cuerpo ofrecen «dolor de pecho» y «dificultad para respirar»
   * como pastillas, y mirando sólo el texto tocarlas no hacía nada: el chip
   * quedaba puesto, sin especialidad detrás y sin aviso — el único camino de la
   * pantalla que terminaba en la nada era justo el de las urgencias.
   */
  protected readonly alarmas = computed<readonly Sintoma[]>(() => {
    const delTexto = reconocerAlarmas(this.texto());
    const puestas = this.sintomas().filter((sintoma) => sintoma.alarma === true);
    const yaEstan = new Set(delTexto.map((sintoma) => sintoma.id));
    return [...delTexto, ...puestas.filter((sintoma) => !yaEstan.has(sintoma.id))];
  });

  /**
   * Lo que entendió el servicio de triage (AlovidaAIService) del último texto
   * en el que la persona hizo una pausa, junto con ese texto.
   *
   * El motor local reconoce las filas de la tabla al instante; el servicio suma
   * lo que la tabla no tiene —«me duele la pantorrilla», «manchas en la
   * espalda»— y ubica lo que sí tiene («hormigueo · mano izquierda»). Ver
   * `lectura-ia.ts`.
   *
   * Con menos de tres letras no se pregunta nada, y así en el servidor (texto
   * vacío) no se programa ni un temporizador. Si el servicio falla o tarda,
   * `TriageIaClient` devuelve `null` y la pantalla sigue con lo local.
   */
  private readonly lecturaGuardada = toSignal(
    toObservable(this.texto).pipe(
      map((texto) => texto.trim()),
      switchMap((texto) =>
        texto.length < 3
          ? of(null)
          : timer(PAUSA_PARA_LEER_MS).pipe(
              switchMap(() => this.triageIa.analizar(texto)),
              map((lectura): LecturaDelTexto | null => (lectura === null ? null : { texto, lectura })),
            ),
      ),
    ),
    { initialValue: null },
  );

  /** La lectura del servicio que todavía vale para lo escrito. */
  private readonly lecturaVigente = computed(() =>
    lecturaVigente(this.lecturaGuardada(), this.texto()),
  );

  /** Los hallazgos del servicio que todavía valen para lo escrito. */
  private readonly deLaLectura = computed(() => sintomasDeLaLectura(this.lecturaVigente()));

  /**
   * Las zonas del cuerpo de lo que se contó: la silueta las ilumina mientras
   * la persona escribe o dicta, y las pastillas «Piel», «Ánimo» y «General»
   * también.
   *
   * Manda la ubicación del servicio cuando la hay («hormigueo · mano» es la
   * mano); si no, la primera zona de la tabla que ofrece ese síntoma.
   */
  protected readonly zonasMarcadas = computed<readonly string[]>(() => {
    const delServicio = zonasDeLaLectura(this.lecturaVigente());
    const marcadas = new Set<string>();
    for (const sintoma of this.sintomas()) {
      const ubicadas = delServicio.get(sintoma.id);
      if (ubicadas !== undefined && ubicadas.length > 0) {
        ubicadas.forEach((zona) => marcadas.add(zona));
        continue;
      }
      const deLaTabla = ZONAS_DEL_CUERPO.find((zona) => zona.sintomas.includes(sintoma.id));
      if (deLaTabla !== undefined) marcadas.add(deLaTabla.id);
    }
    return [...marcadas];
  });

  protected estaMarcada(idDeZona: string): boolean {
    return this.zonasMarcadas().includes(idDeZona);
  }

  /**
   * Los chips: lo reconocido en el texto —acá y por el servicio—, menos lo
   * quitado, más lo agregado.
   *
   * El orden es el de aparición en el texto, después lo que sólo vio el
   * servicio y al final los agregados: ver el porqué en `reconocer` y en
   * `combinar`.
   */
  protected readonly sintomas = computed<readonly Sintoma[]>(() => {
    const quitados = this.quitados();
    const delTexto = combinar(reconocer(this.texto()), this.deLaLectura()).filter(
      (s) => !quitados.has(s.id),
    );
    const yaEstan = new Set(delTexto.map((s) => s.id));
    return [...delTexto, ...this.agregados().filter((s) => !yaEstan.has(s.id))];
  });

  /** Lo que el autocompletado ofrece para la última palabra que se escribe. */
  protected readonly sugerencias = computed(() =>
    sugerir(ultimaFrase(this.texto()), this.sintomas()),
  );

  protected readonly recomendaciones = computed<readonly Recomendacion[]>(() =>
    // Con una alarma en el texto no se recomienda nada: la pantalla entera pasa
    // a decir «andá a urgencias», y una lista de especialidades debajo
    // competiría con ese mensaje.
    this.alarmas().length > 0
      ? []
      : recomendar(this.sintomas(), new Set(this.especialidadesDisponibles().keys())),
  );

  /**
   * Qué decirle a quien escribió una urgencia.
   *
   * Casi siempre alcanza el aviso general —«andá a una guardia»—, pero no
   * siempre: a quien escribe que se quiere morir, mandarlo a una guardia y
   * nada más es contestarle con un trámite. Esa fila trae su propio mensaje.
   */
  protected readonly mensajeDeAlarma = computed(
    () => this.alarmas().find((alarma) => alarma.mensaje !== undefined)?.mensaje ?? null,
  );

  /**
   * Lo que la persona escribió **para decir que no lo tiene**.
   *
   * Quien escribe «no tengo fiebre, solo tos» y ve «no reconocimos ningún
   * síntoma» concluye, con razón, que la pantalla no lo leyó. Devolverle lo que
   * sí se entendió —aunque sea lo que descartó— es la diferencia entre una
   * pantalla que escucha y un buscador que no encontró nada.
   */
  protected readonly descartados = computed(() =>
    enumerar(reconocerNegados(this.texto()).map((sintoma) => sintoma.nombre)),
  );

  /** Lo que la región viva le anuncia a un lector de pantalla. */
  protected readonly anuncio = computed(() => {
    const nombres = this.sintomas().map((s) => s.nombre);
    if (nombres.length === 0) {
      return '';
    }
    return `Reconocimos: ${nombres.join(', ')}.`;
  });

  protected readonly explicacionDe = explicar;

  /* --- Elegir sin escribir ---------------------------------------------- */

  /** Las zonas del cuerpo, tal cual la tabla. */
  protected readonly zonas = signal(ZONAS_DEL_CUERPO);

  /**
   * Las pastillas: sólo lo que no tiene un lugar en la figura («piel»,
   * «ánimo», «general»).
   *
   * Con la figura partida en veinte zonas, repetirlas todas como pastillas
   * sería una segunda lista de veinte botones al lado del dibujo. Cada zona de
   * la figura ya es un botón con nombre, alcanzable con el tabulador: lo que
   * necesita una pastilla es lo que no se puede señalar.
   */
  protected readonly zonasSinSilueta = computed(() =>
    this.zonas().filter((zona) => !ZONAS_CON_SILUETA.has(zona.id)),
  );

  /** El nombre de la zona abierta, para titular sus síntomas al lado de la figura. */
  protected readonly nombreDeLaZonaAbierta = computed<string | null>(() => {
    const abierta = this.zonaAbierta();
    return this.zonas().find((zona) => zona.id === abierta)?.nombre ?? null;
  });

  /** Qué zona está abierta, o `null` si ninguna. Una sola a la vez. */
  protected readonly zonaAbierta = signal<string | null>(null);

  /**
   * Los síntomas de la zona abierta, resueltos contra `SINTOMAS`.
   *
   * Un `id` de la tabla de zonas que no exista allá **se ignora**: la zona
   * ofrece uno menos y la pantalla sigue en pie. Es la única forma de que dos
   * listas convivan sin que una rompa a la otra.
   */
  protected readonly sintomasDeLaZona = computed<readonly Sintoma[]>(() => {
    const abierta = this.zonaAbierta();
    if (abierta === null) {
      return [];
    }
    const zona = ZONAS_DEL_CUERPO.find((z) => z.id === abierta);
    if (zona === undefined) {
      return [];
    }
    return zona.sintomas
      .map((id) => TODOS_LOS_SINTOMAS.find((s) => s.id === id))
      .filter((s): s is Sintoma => s !== undefined);
  });

  /** Abre una zona, o la cierra si ya lo estaba. */
  protected alternarZona(zona: ZonaDelCuerpo): void {
    this.zonaAbierta.update((previa) => (previa === zona.id ? null : zona.id));
  }

  /**
   * Las zonas tal como las entiende la silueta: `id` y nombre, nada más.
   *
   * La figura no conoce síntomas ni especialidades (ver `BodyMap`): se le da
   * lo justo para dibujar y nombrar, y devuelve un `id`. Las que no tienen
   * forma («piel», «ánimo», «general») viajan igual y la silueta las ignora:
   * siguen en las pastillas.
   */
  protected readonly zonasParaLaSilueta = computed<readonly ZonaElegible[]>(() =>
    this.zonas().map(({ id, nombre }) => ({ id, nombre })),
  );

  /**
   * La silueta y las pastillas son dos puertas al **mismo** estado (P-01,
   * doctor 22/09/2026): tocar el pecho en la figura abre lo mismo que tocar la
   * pastilla «Pecho», y la figura resalta la zona que se abrió desde la
   * pastilla. La silueta ya resuelve el alternar (volver a tocar suelta), así
   * que acá sólo se copia lo que devuelve.
   */
  protected elegirZonaDesdeLaSilueta(id: string | null): void {
    this.zonaAbierta.set(id);
  }

  /** Si un síntoma ya está elegido, para pintarlo distinto. */
  protected estaElegido(sintoma: Sintoma): boolean {
    return this.sintomas().some((s) => s.id === sintoma.id);
  }

  /** Tocar una pastilla lo agrega o lo quita: es un interruptor. */
  protected alternarSintoma(sintoma: Sintoma): void {
    if (this.estaElegido(sintoma)) {
      this.quitar(sintoma);
    } else {
      this.agregar(sintoma);
    }
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    if (valor.trim() !== '') {
      this.haceFalta.set(true);
    }
  }

  /**
   * Dictar o dejar de dictar (P-02): un solo botón que alterna.
   *
   * Lo dictado **se agrega al final** de lo que ya había, con un espacio: la
   * persona pudo haber empezado a escribir y seguir hablando, y pisarle el
   * texto sería perderle lo que cargó (regla 95.3.3). Pasa por `escribir`
   * como si lo hubiera tecleado: mismo reconocimiento, misma alarma, mismo
   * pedido del catálogo.
   */
  protected alternarDictado(): void {
    if (this.dictado.escuchando()) {
      this.dictado.detener();
      return;
    }
    this.dictado.empezar((final) => {
      const previo = this.texto().trimEnd();
      this.escribir(previo === '' ? final : `${previo} ${final}`);
    });
  }

  /** Quita un chip. Un falso positivo no puede quedar atrapado. */
  protected quitar(sintoma: Sintoma): void {
    this.quitados.update((previos) => new Set([...previos, sintoma.id]));
    this.agregados.update((previos) => previos.filter((s) => s.id !== sintoma.id));
  }

  /** Agrega uno del autocompletado. */
  protected agregar(sintoma: Sintoma): void {
    this.quitados.update((previos) => {
      const copia = new Set(previos);
      copia.delete(sintoma.id);
      return copia;
    });
    this.agregados.update((previos) =>
      previos.some((s) => s.id === sintoma.id) ? previos : [...previos, sintoma],
    );
  }

  protected empezarDeNuevo(): void {
    this.texto.set('');
    this.agregados.set([]);
    this.quitados.set(new Set());
  }

  /**
   * Salta al directorio de médicos con esa especialidad puesta.
   *
   * Va por `conceptId` cuando se lo sabe. Antes iba por nombre, y el comentario
   * de entonces daba la razón correcta para entonces: el directorio filtraba en
   * memoria por su chip, así que el texto alcanzaba. **Eso cambió**: ahora el
   * directorio acota por `?especialidad=<conceptId>` contra el servidor, y una
   * búsqueda de texto sólo funciona de rebote, porque el buscador matchea el
   * encabezado del grupo.
   *
   * El identificador no cuesta una consulta: la lista de especialidades con
   * gente ya se lee para no recomendar una vacía, y lo único que faltaba era no
   * tirar el concepto al quedarse con el nombre.
   *
   * Sin identificador —sesión pública, o un nombre de la tabla de síntomas que
   * el catálogo no tiene— se cae al texto, que es como funcionaba hasta ahora:
   * peor destino, nunca una pantalla rota.
   */
  protected verProfesionales(nombre: string): void {
    const conceptId = this.especialidadesDisponibles().get(normalizar(nombre));
    void this.router.navigate([this.rutaDeResultados()], {
      queryParams:
        conceptId === undefined || conceptId === '' ? { q: nombre } : { especialidad: conceptId },
    });
  }

  /**
   * Las especialidades con profesionales publicados, normalizadas.
   *
   * Una sola página: alcanza para saber **qué especialidades existen** en la
   * plataforma, que es lo único que hace falta acá. Recorrer el cursor entero
   * sería traerse el directorio para leer una lista de nombres.
   */
  private leerEspecialidades(): Observable<ReadonlyMap<string, string>> {
    if (this.sinSesion()) {
      return this.leerEspecialidadesPublicas();
    }
    return this.profiles.listPractitioners({ limit: POR_PAGINA }).pipe(
      switchMap((pagina) => {
        const ids = [
          ...new Set(
            pagina.items.flatMap((fila) => fila.specialties.map((e) => e.specialtyConceptId)),
          ),
        ];
        if (ids.length === 0) {
          return of(VACIO);
        }
        // El catálogo traduce los conceptos a nombres; sin él no hay con qué
        // cruzar la tabla, y se devuelve vacío, que desactiva el filtro.
        return this.terminology.readConceptLabels(ids).pipe(
          map(
            (etiquetas: ConceptLabels) =>
              new Map(
                [...etiquetas.entries()].map(([conceptId, opcion]) => [
                  normalizar(opcion.display),
                  conceptId,
                ]),
              ) as ReadonlyMap<string, string>,
          ),
          catchError(() => of(VACIO)),
        );
      }),
    );
  }

  /**
   * Las especialidades que se ven **sin sesión**, sacadas del buscador público.
   *
   * El buscador no publica los conceptos de especialidad —no expone
   * identificadores internos—, así que se leen del `headline`, que es donde el
   * profesional escribe qué hace («Cardióloga · Arritmias y prevención»). Se
   * parte por el separador y se normaliza cada parte: es una aproximación, y
   * alcanza para lo único que hace falta acá, que es no recomendar una
   * especialidad sin nadie detrás.
   */
  private leerEspecialidadesPublicas(): Observable<ReadonlyMap<string, string>> {
    return this.publico.searchPractitioners({ limit: POR_PAGINA }).pipe(
      map(
        (pagina) =>
          // Sin concepto: el buscador público no expone identificadores
          // internos. El valor vacío es lo que hace caer la navegación al
          // texto, que sin sesión es el único destino posible.
          new Map(
            pagina.items
              .flatMap((fila) => (fila.headline ?? '').split(/[·,|]/))
              .map((parte) => normalizar(parte))
              .filter((parte) => parte !== '')
              .map((nombre) => [nombre, '']),
          ) as ReadonlyMap<string, string>,
      ),
      catchError(() => of(VACIO)),
    );
  }
}
