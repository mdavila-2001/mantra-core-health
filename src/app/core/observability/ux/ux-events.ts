import type { ActivityEventProperty } from '../../data-access/telemetry/telemetry.types';

/**
 * Catálogo de eventos de interacción para los mapas de calor.
 *
 * Funciones puras: reciben medidas ya tomadas del navegador y devuelven el
 * nombre y las propiedades. Así las reglas de qué sale y con qué forma se
 * prueban sin DOM, y el servicio solo mide y manda.
 *
 * Nombres y propiedades siguen la convención de
 * `docs/observability/analytics-events.md`: español, `snake_case`,
 * booleanos con `es_`.
 *
 * ## Por qué las coordenadas van normalizadas
 *
 * Un mapa de calor suma clics de pantallas de 360 y de 1920 píxeles. En
 * píxeles absolutos no se pueden sumar; como fracción del ancho del documento
 * sí. El eje vertical va en píxeles del documento porque la altura de la página
 * no depende del ancho de la misma forma, y se manda `alto_doc_px` para poder
 * normalizarlo al consultar si hace falta.
 */

export const EVENTOS_UX = {
  paginaVista: 'pagina_vista',
  paginaAbandonada: 'pagina_abandonada',
  clic: 'clic',
  campoEnfocado: 'campo_enfocado',
} as const;

export type NombreDeEventoUx = (typeof EVENTOS_UX)[keyof typeof EVENTOS_UX];

export interface EventoUx {
  readonly nombre: NombreDeEventoUx;
  readonly propiedades: readonly ActivityEventProperty[];
}

/** Tamaño de la ventana y del documento en el momento del evento. */
export interface Lienzo {
  readonly anchoVentana: number;
  readonly altoVentana: number;
  readonly anchoDocumento: number;
  readonly altoDocumento: number;
}

/** Medidas de un clic, en píxeles CSS. */
export interface MedidasDeClic {
  /** `pageX`/`pageY`: relativos al documento. */
  readonly xDocumento: number;
  readonly yDocumento: number;
  /** `clientX`/`clientY`: relativos a la ventana. */
  readonly xVentana: number;
  readonly yVentana: number;
  /** `getBoundingClientRect()` del control tocado. */
  readonly rectangulo: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** `event.detail === 0`: lo activó el teclado y no hay coordenadas reales. */
  readonly porTeclado: boolean;
}

/**
 * Corte de tamaños para segmentar el mapa. Coinciden con los tres viewports con
 * los que se revisa el portal (móvil estrecho, tableta, escritorio).
 */
export function tamanoDePantalla(anchoVentana: number): 'movil' | 'tableta' | 'escritorio' {
  if (anchoVentana < 600) return 'movil';
  if (anchoVentana < 1024) return 'tableta';
  return 'escritorio';
}

export function paginaVista(lienzo: Lienzo, rutaAnterior: string | null): EventoUx {
  return {
    nombre: EVENTOS_UX.paginaVista,
    propiedades: [
      ...propiedadesDeLienzo(lienzo),
      ...(rutaAnterior === null ? [] : [texto('ruta_anterior', rutaAnterior)]),
    ],
  };
}

export function paginaAbandonada(
  lienzo: Lienzo,
  pagina: { readonly profundidadMaxima: number; readonly msEnPagina: number; readonly clics: number },
): EventoUx {
  return {
    nombre: EVENTOS_UX.paginaAbandonada,
    propiedades: [
      ...propiedadesDeLienzo(lienzo),
      numero('profundidad_max', fraccion(pagina.profundidadMaxima)),
      numero('ms_en_pagina', Math.max(0, Math.round(pagina.msEnPagina))),
      numero('clics', pagina.clics),
    ],
  };
}

export function clic(
  lienzo: Lienzo,
  objetivo: { readonly selector: string; readonly interactivo: boolean },
  medidas: MedidasDeClic,
  esRepetido: boolean,
): EventoUx {
  const base = [
    ...propiedadesDeLienzo(lienzo),
    texto('objetivo', objetivo.selector),
    booleano('es_interactivo', objetivo.interactivo),
    booleano('es_teclado', medidas.porTeclado),
    booleano('es_clic_repetido', esRepetido),
  ];

  // Un clic de teclado llega con coordenadas 0,0: pintarlo sería un punto
  // caliente falso en la esquina. Se cuenta para el control, sin posición.
  if (medidas.porTeclado) {
    return { nombre: EVENTOS_UX.clic, propiedades: base };
  }

  const { rectangulo } = medidas;
  return {
    nombre: EVENTOS_UX.clic,
    propiedades: [
      ...base,
      numero('x_doc', fraccion(medidas.xDocumento / divisor(lienzo.anchoDocumento))),
      numero('y_doc_px', Math.round(medidas.yDocumento)),
      numero('x_vp', fraccion(medidas.xVentana / divisor(lienzo.anchoVentana))),
      numero('y_vp', fraccion(medidas.yVentana / divisor(lienzo.altoVentana))),
      numero('objetivo_x', fraccion((medidas.xVentana - rectangulo.left) / divisor(rectangulo.width))),
      numero('objetivo_y', fraccion((medidas.yVentana - rectangulo.top) / divisor(rectangulo.height))),
    ],
  };
}

export function campoEnfocado(
  lienzo: Lienzo,
  objetivo: { readonly selector: string },
  tipoCampo: string,
): EventoUx {
  return {
    nombre: EVENTOS_UX.campoEnfocado,
    propiedades: [
      ...propiedadesDeLienzo(lienzo),
      texto('objetivo', objetivo.selector),
      texto('tipo_campo', tipoCampo),
    ],
  };
}

/**
 * Detector de clics repetidos («rage clicks»): tres o más clics en menos de
 * 700 ms y a menos de 30 px entre sí. Es la señal más directa de un control que
 * no responde o de algo que parece un botón y no lo es.
 */
export class DetectorDeClicRepetido {
  private static readonly VENTANA_MS = 700;
  private static readonly RADIO_PX = 30;
  private static readonly UMBRAL = 3;

  private recientes: { readonly t: number; readonly x: number; readonly y: number }[] = [];

  registrar(t: number, x: number, y: number): boolean {
    this.recientes = this.recientes.filter(
      (clic) =>
        t - clic.t <= DetectorDeClicRepetido.VENTANA_MS &&
        Math.hypot(clic.x - x, clic.y - y) <= DetectorDeClicRepetido.RADIO_PX,
    );
    this.recientes.push({ t, x, y });
    return this.recientes.length >= DetectorDeClicRepetido.UMBRAL;
  }
}

function propiedadesDeLienzo(lienzo: Lienzo): ActivityEventProperty[] {
  return [
    numero('ancho_vp', Math.round(lienzo.anchoVentana)),
    numero('alto_vp', Math.round(lienzo.altoVentana)),
    numero('alto_doc_px', Math.round(lienzo.altoDocumento)),
    texto('tamano_pantalla', tamanoDePantalla(lienzo.anchoVentana)),
  ];
}

/** Entre 0 y 1, con cuatro decimales: medio píxel en una pantalla de 4K. */
function fraccion(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round(Math.min(1, Math.max(0, valor)) * 10_000) / 10_000;
}

/** Un elemento de ancho cero no puede dividir por cero. */
function divisor(valor: number): number {
  return valor > 0 ? valor : 1;
}

function texto(propertyName: string, valueString: string): ActivityEventProperty {
  return { propertyName, valueType: 'STRING', valueString };
}

function numero(propertyName: string, valueNumber: number): ActivityEventProperty {
  return { propertyName, valueType: 'NUMBER', valueNumber };
}

function booleano(propertyName: string, valueBoolean: boolean): ActivityEventProperty {
  return { propertyName, valueType: 'BOOLEAN', valueBoolean };
}
