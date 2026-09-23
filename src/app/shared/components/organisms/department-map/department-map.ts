import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import {
  BOLIVIA_VIEW_BOX,
  SILUETAS_DE_BOLIVIA,
  type SiluetaDeDepartamento,
} from './bolivia-departments.geometry';

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
 * ## Por qué vive acá y ya no en `registro-compartido/`
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
  readonly etiqueta = input('Mapa de Bolivia: elegí tu departamento');

  /** Prefijo del `data-testid` de cada departamento; el sufijo es la sigla. */
  readonly testId = input('department-map');

  protected readonly viewBox = BOLIVIA_VIEW_BOX;

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
