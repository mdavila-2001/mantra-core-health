import { InjectionToken } from '@angular/core';
import { of, type Observable } from 'rxjs';

import {
  aCentavos,
  aTexto,
  conDescuento,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type {
  BorradorDePedido,
  LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';

/**
 * **Los datos de ejemplo de la orden médica como pedido** (T-E1 · F2.1.3,
 * F2.1.5, F2.2.4).
 *
 * Tres cosas que la pantalla dibuja no tienen contrato todavía:
 *
 * - **La cabecera de la receta.** El borrador que deja «dónde comprar mi
 *   receta» no trae quién la emitió ni cuándo (`BorradorDePedido`), y el
 *   prescriptor del pedido es `null` hasta FAR-E2.
 * - **Las alternativas por renglón.** La búsqueda real contra el sistema de la
 *   farmacia es F2.1.2 y está fuera de este slice.
 * - **La aprobación del seguro por renglón.** No existe en el borrador; la
 *   liquidación real del seguro llega recién sobre un pedido ya creado.
 *
 * Así que **no se inventa un campo en `core/`**: se declara acá, junto a la
 * pantalla, y la pantalla lo rotula con {@link NOTA_DE_DATOS_DE_EJEMPLO}.
 *
 * Reglas que este archivo respeta:
 *
 * - **Nada de pedidos.** Ni `orderId`, ni respuesta de `POST /pharmacy/orders`,
 *   ni pedido persistido: el pedido real lo crea la confirmación final del
 *   checkout con el cliente real (D-FARMOCK-T-E1-01).
 * - **Una alternativa no tiene `productId`.** Tiene un `id` propio de ejemplo,
 *   así que no puede viajar por error en el cuerpo de un pedido real.
 * - **Se deriva por renglón, no por `productId`.** Los productos del backend
 *   simulado y los de la API real tienen identificadores distintos; derivar de
 *   la línea hace que la demostración funcione con cualquier borrador.
 * - **Los importes son texto**, y la aritmética va en centavos con la misma
 *   biblioteca que las promociones.
 *
 * TODO(FAR-E2 / F2.1.2): cuando la receta llegue completa y la farmacia
 * publique alternativas, {@link DATOS_DE_EJEMPLO_DE_LA_RECETA} se reemplaza por
 * la fuente real y este archivo se queda con los datos de las pruebas.
 */

/** El cartel único: quien mira la pantalla sabe qué parte es maqueta. */
export const NOTA_DE_DATOS_DE_EJEMPLO = 'Datos de ejemplo';

/** Quién emitió la receta y cuándo. */
export interface CabeceraDeReceta {
  readonly emitidaPor: string;
  readonly especialidad: string;
  readonly emitidaEl: Date;
}

/** Otra marca del mismo genérico, más económica que la recetada. */
export interface AlternativaDeEjemplo {
  /** Identificador de ejemplo. **No** es un `productId`. */
  readonly id: string;
  readonly nombre: string;
  readonly presentacion: string | null;
  /** Precio unitario, texto exacto. */
  readonly precio: string;
  /** Recetada menos alternativa, por unidad, texto exacto. */
  readonly ahorro: string;
}

/** Lo que la demostración sabe de un renglón del borrador. */
export interface RenglonDeEjemplo {
  /** El techo de la cantidad editable. */
  readonly cantidadRecetada: number;
  readonly aprobadoPorSeguro: boolean;
  readonly alternativas: readonly AlternativaDeEjemplo[];
}

export interface DatosDeEjemploDeLaReceta {
  readonly cabecera: CabeceraDeReceta;
  /** Uno por renglón del borrador, en el mismo orden. */
  readonly renglones: readonly RenglonDeEjemplo[];
}

export type FuenteDeDatosDeEjemplo = (
  borrador: BorradorDePedido,
) => Observable<DatosDeEjemploDeLaReceta>;

export const CABECERA_DE_EJEMPLO: CabeceraDeReceta = {
  emitidaPor: 'Dra. Mariana Suárez Rivero',
  especialidad: 'Medicina familiar',
  // Por componentes y no por texto ISO: la fecha no se corre de día por huso.
  emitidaEl: new Date(2026, 8, 12, 10, 30),
};

/** Cuántas unidades «recetó» la demostración por renglón. */
export const CANTIDAD_RECETADA_DE_EJEMPLO = 3;

/**
 * El criterio fijo de aprobación: se recorre por posición del renglón. Con dos
 * o más renglones siempre se ven las dos etiquetas.
 */
export const PATRON_DE_APROBACION: readonly boolean[] = [true, false];

/** Descuentos sobre la recetada: de ahí salen hasta tres alternativas. */
const DESCUENTOS_DE_EJEMPLO = [15, 30, 45] as const;

/** Rótulos neutros: una marca real con un precio inventado sería engañosa. */
const MARCAS_DE_EJEMPLO = ['Genérico', 'Marca de ejemplo A', 'Marca de ejemplo B'] as const;

/**
 * Las alternativas de un renglón. Vacío si el renglón no se puede comparar:
 * sin producto publicado, sin existencia en la sede o sin precio.
 */
export function alternativasDeEjemplo(
  linea: LineaDePedido,
  indice: number,
): readonly AlternativaDeEjemplo[] {
  const precioRecetado = linea.precio;
  if (linea.productId === null || !linea.disponible || precioRecetado === null) {
    return [];
  }
  const recetada = aCentavos(precioRecetado);
  if (recetada === null) {
    return [];
  }
  const generico = linea.medicamento.trim().split(/\s+/)[0] ?? linea.medicamento;
  return DESCUENTOS_DE_EJEMPLO.flatMap((porcentaje, n): AlternativaDeEjemplo[] => {
    const precio = conDescuento(precioRecetado, porcentaje);
    const centavos = precio === null ? null : aCentavos(precio);
    if (precio === null || centavos === null || centavos >= recetada) {
      return [];
    }
    return [
      {
        id: `ejemplo-${indice}-${n}`,
        nombre: `${generico} · ${MARCAS_DE_EJEMPLO[n] ?? MARCAS_DE_EJEMPLO[0]}`,
        presentacion: linea.presentacion,
        precio,
        ahorro: aTexto(recetada - centavos),
      },
    ];
  });
}

/** Los datos de ejemplo de un borrador, renglón por renglón. */
export function datosDeEjemploPara(borrador: BorradorDePedido): DatosDeEjemploDeLaReceta {
  return {
    cabecera: CABECERA_DE_EJEMPLO,
    renglones: borrador.lineas.map((linea, indice) => ({
      cantidadRecetada: Math.max(linea.cantidad, CANTIDAD_RECETADA_DE_EJEMPLO),
      aprobadoPorSeguro: PATRON_DE_APROBACION[indice % PATRON_DE_APROBACION.length] ?? false,
      alternativas: alternativasDeEjemplo(linea, indice),
    })),
  };
}

/**
 * De dónde lee la pantalla los datos de ejemplo.
 *
 * Es asíncrono a propósito aunque hoy responda en el acto: la fuente real
 * (receta completa, búsqueda de alternativas) lo va a ser, y la pantalla ya
 * cubre cargando y error sobre esta costura. Las pruebas la sustituyen.
 */
export const DATOS_DE_EJEMPLO_DE_LA_RECETA = new InjectionToken<FuenteDeDatosDeEjemplo>(
  'DATOS_DE_EJEMPLO_DE_LA_RECETA',
  {
    providedIn: 'root',
    factory: () => (borrador) => of(datosDeEjemploPara(borrador)),
  },
);
