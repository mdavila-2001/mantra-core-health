import { ChangeDetectionStrategy, Component, computed, effect, input, model, signal } from '@angular/core';

import { normalizePlace } from '@shared/geo/city-department';

import type { PuntoGeo } from '../map/map-pin.types';
import {
  BOLIVIA_VIEW_BOX,
  SILUETAS_DE_BOLIVIA,
  type SiluetaDeDepartamento,
} from './bolivia-departments.geometry';
import type { ContornoDeMunicipio } from './bolivia-municipalities.geometry';
import { LIMITES_DE_PROVINCIAS_DE_BOLIVIA } from './bolivia-provinces.geometry';

/**
 * Los contornos municipales se piden **la primera vez que hacen falta**, no al
 * cargar el mapa: son ~107 kB y el mapa vive en rutas públicas (el alta, los
 * directorios) donde casi siempre se mira sólo el departamento. La promesa se
 * comparte entre todas las instancias.
 */
let contornosEnCamino: Promise<readonly ContornoDeMunicipio[]> | null = null;

function cargarContornos(): Promise<readonly ContornoDeMunicipio[]> {
  contornosEnCamino ??= import('./bolivia-municipalities.geometry').then(
    (m) => m.CONTORNOS_DE_MUNICIPIOS,
  );
  return contornosEnCamino;
}

/** Lleva una latitud/longitud al `viewBox`, con la proyección de las siluetas. */
async function proyectar(punto: PuntoGeo): Promise<{ x: number; y: number }> {
  const { PROYECCION_DE_BOLIVIA: p } = await import('./bolivia-municipalities.geometry');
  return {
    x: (punto.lng - p.lng0) * p.coseno * p.escala,
    y: (p.lat1 - punto.lat) * p.escala,
  };
}

/** Un código INE de municipio: `DDPPMM`. */
const CODIGO_INE = /^\d{6}$/;

/** La caja que encierra un `d` hecho sólo de `M`, `L` y `Z` con pares `x y`. */
function cajaDe(d: string): { x: number; y: number; ancho: number; alto: number } {
  const cifras = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const xs = cifras.filter((_, i) => i % 2 === 0);
  const ys = cifras.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, ancho: Math.max(...xs) - x, alto: Math.max(...ys) - y };
}

/**
 * Un departamento que se puede elegir, tal como lo trajo el catálogo.
 *
 * El `conceptId` y el `nombre` salen de `VS_BO_DEPARTMENT` —el dueño del dato—
 * y la `sigla`, del código del concepto (`geo:bo:department:SC`). Acá no se
 * inventa ninguno de los tres: si el catálogo no llegó, no hay mapa que dibujar.
 */
export interface DepartamentoElegible {
  readonly conceptId: string;
  readonly sigla: string;
  readonly nombre: string;
}

/** Un departamento ya listo para pintar: su dato y su silueta, juntos. */
interface DepartamentoDibujable extends DepartamentoElegible {
  readonly d: string;
  readonly etiqueta: SiluetaDeDepartamento['etiqueta'];
}

/**
 * El mapa de Bolivia para elegir un departamento (AC-03-6, AC-05-8).
 *
 * ## Por qué un mapa y no un desplegable más
 *
 * Porque lo que sigue es elegir la ciudad, y son ~340 municipios: un
 * desplegable plano de 340 entradas no se recorre, y siete nombres se repiten
 * entre departamentos («San Pedro», «Santa Rosa»…), así que uno suelto no
 * identifica nada. El departamento es lo que vuelve inequívoco al municipio, y
 * el departamento propio se reconoce **antes** de leerlo: es dónde uno vive.
 *
 * ## El equivalente por teclado no es un añadido, es la mitad del control
 *
 * Cada departamento es un `<path>` con `role="button"`, su `tabindex`, su
 * `aria-label` con el nombre completo y su `aria-pressed`. Se recorre con el
 * tabulador en el orden del INE —el mismo que ya tienen los desplegables del
 * alta— y se activa con Enter o con la barra. No hay una «versión accesible»
 * aparte: es el mismo control, operado de dos maneras.
 *
 * **La elección no se comunica sólo por color.** Quien no distingue el relleno
 * ve el trazo grueso del elegido, y quien no ve nada de eso lee el nombre en la
 * línea de abajo y el `aria-pressed` del control. Tres señales para el mismo
 * dato, que es lo que WCAG 2.2 AA pide y lo que un mapa se olvida siempre.
 *
 * ## Qué NO hace
 *
 * No pide el catálogo, no lo cachea y no sabe de terminología: recibe los
 * departamentos ya resueltos. Un componente de `features/auth` que además
 * hablara con la API sería imposible de probar sin levantar media aplicación, y
 * las dos altas que lo montan ya tienen su lectura del catálogo con su
 * «Reintentar».
 *
 * ## Por qué vive acá y ya no en `shared-registration/`
 *
 * Vivía allá mientras sus dos únicos consumidores eran las dos altas —paciente
 * y profesional—, con la condición escrita de que subiera «el día que una
 * tercera pantalla lo necesite». Ese día llegó: los directorios de clínicas y
 * de farmacias lo usan como selector de departamento, y son cuatro
 * consumidores en dos áreas distintas del producto. Un organismo de `shared/`
 * es exactamente eso.
 *
 * Sigue sin saber de terminología: recibe los departamentos ya resueltos, y
 * quien lo monta se ocupa de leer el catálogo y de su «Reintentar».
 */
@Component({
  selector: 'app-department-map',
  templateUrl: './department-map.html',
  styleUrl: './department-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentMap {
  /** Los departamentos del catálogo. Vacío no dibuja nada: ver la plantilla. */
  readonly departamentos = input.required<readonly DepartamentoElegible[]>();

  /** El `conceptId` del departamento elegido, o `null`. */
  readonly value = model<string | null>(null);

  /** Nombre accesible del mapa entero. */
  readonly etiqueta = input('Mapa de Bolivia: elija su departamento');

  /** Prefijo del `data-testid` de cada departamento; el sufijo es la sigla. */
  readonly testId = input('department-map');

  /**
   * El municipio a marcar dentro del departamento elegido: su código INE
   * (`DDPPMM`) o su nombre. Se sombrea más oscuro que el departamento.
   *
   * Acepta el nombre porque no todos los que montan el mapa tienen el INE: los
   * directorios sólo traen la ciudad como texto, y la maqueta siembra códigos
   * legados (`SC-SCZ`). El nombre se busca **dentro del departamento
   * elegido**, así que los siete nombres repetidos entre departamentos no se
   * confunden. Si no casa con ningún contorno, no se dibuja nada —el
   * departamento sigue marcado— en vez de marcar otro municipio.
   */
  readonly municipio = input<string | null>(null);

  /**
   * El lugar exacto, si se conoce (la dirección marcada en el mapa, la sede).
   * Va como un punto rojo. Sin él, el punto cae en el centro del municipio.
   */
  readonly punto = input<PuntoGeo | null>(null);

  /** Los contornos, una vez que llegaron. */
  private readonly contornos = signal<readonly ContornoDeMunicipio[] | null>(null);

  /** El punto exacto ya proyectado al `viewBox`. */
  private readonly puntoProyectado = signal<{ x: number; y: number } | null>(null);

  constructor() {
    effect(() => {
      if (this.municipio() === null || this.contornos() !== null) return;
      void cargarContornos().then((c) => this.contornos.set(c));
    });
    effect(() => {
      const punto = this.punto();
      if (punto === null) {
        this.puntoProyectado.set(null);
        return;
      }
      void proyectar(punto).then((p) => {
        if (this.punto() === punto) this.puntoProyectado.set(p);
      });
    });
  }

  /** La sigla del departamento elegido, para buscar el municipio adentro. */
  private readonly siglaElegida = computed<string | null>(() => {
    const elegido = this.value();
    return this.departamentos().find((d) => d.conceptId === elegido)?.sigla ?? null;
  });

  /** El contorno del municipio a marcar, si existe y es del departamento elegido. */
  protected readonly municipioDibujable = computed<ContornoDeMunicipio | null>(() => {
    const buscado = this.municipio();
    const contornos = this.contornos();
    const sigla = this.siglaElegida();
    if (buscado === null || contornos === null || sigla === null) return null;
    if (CODIGO_INE.test(buscado)) {
      return contornos.find((c) => c.ine === buscado && c.sigla === sigla) ?? null;
    }
    const nombre = normalizePlace(buscado);
    return contornos.find((c) => c.sigla === sigla && normalizePlace(c.nombre) === nombre) ?? null;
  });

  /**
   * Dónde va el punto rojo: el lugar exacto si se conoce; si no, el centro del
   * municipio. Sin ninguno de los dos, no hay punto —el departamento solo no
   * dice «dónde»—.
   */
  protected readonly marca = computed<{ x: number; y: number } | null>(() => {
    if (this.value() === null) return null;
    return this.puntoProyectado() ?? this.municipioDibujable() ?? null;
  });

  /**
   * El acercamiento al departamento elegido, cuando hay municipio que mostrar.
   *
   * A escala país un municipio es chico —Santa Cruz de la Sierra ocupa unos
   * 10 px— y el punto lo tapa: el sombreado más oscuro no se llega a ver. Al
   * lado del país se dibuja entonces el departamento solo, con todos sus
   * municipios en trazo fino, el elegido oscuro y el punto encima. El país
   * sigue diciendo «dónde en Bolivia» y el acercamiento, «dónde en el
   * departamento».
   *
   * Los tamaños del punto van en unidades del `viewBox` del acercamiento, así
   * que se calculan con su lado mayor para que se vean igual en todos los
   * departamentos, del chico (Tarija) al grande (Santa Cruz).
   */
  protected readonly acercamiento = computed(() => {
    const municipio = this.municipioDibujable();
    const contornos = this.contornos();
    const sigla = this.siglaElegida();
    if (municipio === null || contornos === null || sigla === null) return null;
    const silueta = SILUETAS_DE_BOLIVIA.find((s) => s.sigla === sigla);
    if (silueta === undefined) return null;

    // El encuadre se centra en el municipio, no en el departamento: en Santa
    // Cruz —un tercio del país— el departamento entero deja a la capital otra
    // vez en unos pocos píxeles. El lado es 3 veces el del municipio, con un
    // piso del 20 % del departamento para que siempre haya vecinos alrededor
    // y un techo en el departamento entero para los municipios muy grandes.
    const departamento = cajaDe(silueta.d);
    const propio = cajaDe(municipio.d);
    const ladoDepartamento = Math.max(departamento.ancho, departamento.alto);
    const lado = Math.min(
      Math.max(Math.max(propio.ancho, propio.alto) * 3, ladoDepartamento * 0.2),
      ladoDepartamento * 1.1,
    );
    const marca = this.marca();
    const cx = propio.x + propio.ancho / 2;
    const cy = propio.y + propio.alto / 2;

    return {
      viewBox: `${cx - lado / 2} ${cy - lado / 2} ${lado} ${lado}`,
      departamento: silueta.d,
      otrosDepartamentos: SILUETAS_DE_BOLIVIA.filter((s) => s.sigla !== sigla).map((s) => s.d),
      vecinos: contornos.filter((c) => c.sigla === sigla && c.ine !== municipio.ine),
      municipio,
      marca:
        marca === null
          ? null
          : { ...marca, radio: lado * 0.028, halo: lado * 0.06, aro: lado * 0.01 },
    };
  });

  protected readonly viewBox = BOLIVIA_VIEW_BOX;

  /** Las provincias se trazan dentro de cada departamento; no se eligen. */
  protected readonly limitesDeProvincias = LIMITES_DE_PROVINCIAS_DE_BOLIVIA;

  /**
   * Los departamentos que se dibujan: los del catálogo que además tienen
   * silueta, en el orden del INE.
   *
   * El recorrido es sobre las **siluetas** y no sobre el catálogo para que el
   * orden del tabulador sea siempre el mismo —el del INE— venga como venga la
   * expansión. Un departamento del catálogo sin silueta no se dibuja (no puede)
   * y una silueta que el catálogo no trajo tampoco (no tendría a qué
   * `conceptId` apuntar, y el `conceptId` es lo único que viaja al backend).
   */
  protected readonly dibujables = computed<readonly DepartamentoDibujable[]>(() => {
    const porSigla = new Map(this.departamentos().map((d) => [d.sigla, d]));
    return SILUETAS_DE_BOLIVIA.flatMap((silueta) => {
      const dato = porSigla.get(silueta.sigla);
      if (dato === undefined) return [];
      return [{ ...dato, d: silueta.d, etiqueta: silueta.etiqueta }];
    });
  });

  /** El nombre del elegido, para decirlo con palabras además de con el dibujo. */
  protected readonly nombreElegido = computed<string | null>(() => {
    const elegido = this.value();
    if (elegido === null) return null;
    return this.departamentos().find((d) => d.conceptId === elegido)?.nombre ?? null;
  });

  /**
   * Elige un departamento, o lo deselecciona si ya estaba elegido.
   *
   * Deselecciona a propósito: es un grupo de botones de dos estados, no un
   * grupo de radios, y sin la vuelta atrás no habría forma de decir «me
   * equivoqué de departamento» sin elegir otro.
   */
  protected elegir(conceptId: string): void {
    this.value.set(this.value() === conceptId ? null : conceptId);
  }

  /**
   * La barra espaciadora activa, y **no** desplaza la página.
   *
   * Un `<path>` con `role="button"` no hereda el comportamiento del botón
   * nativo: sin este `preventDefault`, la barra haría scroll y el mapa se
   * movería fuera de la vista en el momento exacto en que alguien lo está
   * usando con el teclado.
   */
  protected elegirConBarra(evento: Event, conceptId: string): void {
    evento.preventDefault();
    this.elegir(conceptId);
  }
}
