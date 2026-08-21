import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { CUADRANTES_FDI, estadoPorCodigo } from './odontogram.types';
import type { EstadoDental, MapaDental } from './odontogram.types';

/** Una pieza ya resuelta para dibujar: su estado, su marca y cómo se anuncia. */
interface PiezaDibujable {
  readonly fdi: string;
  readonly estado?: EstadoDental;
  /** Tratamientos registrados sobre la pieza. 0 = ninguno. */
  readonly marcas: number;
  readonly seleccionada: boolean;
  /** Lo que lee un lector de pantalla. Dice todo lo que el color muestra. */
  readonly anuncio: string;
  /** Las clases del botón, ya compuestas. */
  readonly clases: string;
}

/** Una fila del dibujo: el cuadrante con sus ocho piezas resueltas. */
interface CuadranteDibujable {
  readonly nombre: string;
  readonly piezas: readonly PiezaDibujable[];
}

/**
 * **Odontograma** — las 32 piezas permanentes en notación FDI.
 *
 * ## Un componente, dos usos
 *
 * Lo consumen los dos bloques dentales del expediente y no sabe de ninguno:
 *
 * - En la **receta de tratamientos** (`procedures-block`) pinta `marcas` —
 *   cuántos tratamientos tiene registrada cada pieza— y al elegir una, el
 *   bloque la precarga en su formulario de alta.
 * - En el **formulario OMS** (`specialty-form-block`) pinta `estados` — el
 *   código de la OMS de cada pieza— y al elegir una, el bloque ofrece los
 *   estados posibles.
 *
 * Por eso emite el **código FDI** y no un `conceptId`: la traducción a
 * terminología es asunto de quien lo consume, y el mismo componente sirve para
 * un dato que no es de terminología en absoluto (el mapa del formulario).
 *
 * ## El color nunca va solo
 *
 * Cada pieza muestra su número y, cuando tiene estado, el código de la OMS
 * encima del tono. Un odontograma que sólo se lee por color no lo lee quien no
 * distingue esos colores, y acá el dato es clínico. Por el mismo motivo el
 * `aria-label` dice el estado con palabras y no deja que lo cuente el tono.
 *
 * ## Botones de verdad
 *
 * Cada pieza es un `<button type="button">`: entra en el orden de tabulación,
 * responde a Enter y Espacio sin código propio, y `aria-pressed` cuenta cuál
 * está elegida. En modo lectura quedan deshabilitados —no hay nada que elegir—
 * pero se siguen anunciando, que es lo que permite leer la boca con un lector
 * de pantalla.
 */
@Component({
  selector: 'app-odontogram',
  imports: [Badge, Tooltip],
  templateUrl: './odontogram.html',
  styleUrl: './odontogram.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Odontogram {
  /** El estado de cada pieza, por código FDI. Vacío = boca sin registrar. */
  readonly estados = input<MapaDental>({});

  /** Tratamientos registrados por pieza, por código FDI. */
  readonly marcas = input<Readonly<Record<string, number>>>({});

  /** La pieza elegida, por código FDI. */
  readonly seleccionada = input<string | null>(null);

  /** Sin elección posible: la boca se lee, no se edita. */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** Se eligió una pieza. Viaja su código FDI. */
  readonly pieza = output<string>();

  protected readonly cuadrantes = computed<readonly CuadranteDibujable[]>(() => {
    const estados = this.estados();
    const marcas = this.marcas();
    const elegida = this.seleccionada();

    return CUADRANTES_FDI.map((cuadrante) => ({
      nombre: cuadrante.nombre,
      piezas: cuadrante.piezas.map((fdi) => {
        const estado = estadoPorCodigo(estados[fdi] ?? '');
        const cuantas = marcas[fdi] ?? 0;
        const seleccionada = elegida === fdi;
        const clases = ['odontograma__pieza'];
        if (estado !== undefined) {
          clases.push(`odontograma__pieza--${estado.tono}`);
        }
        if (seleccionada) {
          clases.push('odontograma__pieza--elegida');
        }
        return {
          fdi,
          estado,
          marcas: cuantas,
          seleccionada,
          anuncio: anunciar(fdi, estado, cuantas),
          clases: clases.join(' '),
        };
      }),
    }));
  });

  /** Si hay algo registrado: decide si el pie con la referencia tiene sentido. */
  protected readonly hayRegistro = computed(
    () =>
      Object.keys(this.estados()).length > 0 ||
      Object.keys(this.marcas()).length > 0,
  );

  protected elegir(fdi: string): void {
    if (this.readonly()) return;
    this.pieza.emit(fdi);
  }
}

/**
 * Lo que se lee en voz alta de una pieza.
 *
 * Dice el estado con palabras y cuenta los tratamientos, que es exactamente lo
 * que el tono y la insignia muestran a quien mira.
 */
function anunciar(
  fdi: string,
  estado: EstadoDental | undefined,
  marcas: number,
): string {
  const partes = [`Pieza ${fdi}`];
  partes.push(estado === undefined ? 'sin registrar' : estado.etiqueta.toLowerCase());
  if (marcas === 1) {
    partes.push('1 tratamiento');
  } else if (marcas > 1) {
    partes.push(`${marcas} tratamientos`);
  }
  return partes.join(', ');
}
