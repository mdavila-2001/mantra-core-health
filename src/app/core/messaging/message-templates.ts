import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Dónde se guardan las plantillas propias del navegador. */
const CLAVE = 'alovida.plantillas-mensaje';

/** Tope de plantillas propias. Más que esto deja de ser una lista útil. */
const TOPE = 20;

/**
 * Las plantillas que trae el producto, en castellano.
 *
 * Salen del registro del cliente —MÓDULO MÉDICO 6.1.1 y 6.1.3.1— y de lo que
 * un médico escribe todos los días. Son ocho y no cuarenta a propósito: una
 * lista que no se puede recorrer de un vistazo no se usa, se ignora.
 */
export const PLANTILLAS_POR_DEFECTO: readonly string[] = [
  'Recordá venir en ayunas de 8 horas.',
  'Tus resultados están listos, pasá a retirarlos.',
  'Tu receta ya está emitida y disponible en tu historia clínica.',
  'Te espero en la consulta a la hora acordada. Traé tus estudios previos.',
  'Seguí con la medicación indicada y avisame si aparece algún efecto.',
  'Necesito que te hagas los estudios antes del próximo control.',
  'Vamos a reprogramar tu turno. ¿Qué día te queda cómodo?',
  'Ante cualquier síntoma nuevo, escribime por acá.',
];

/**
 * Las plantillas del profesional — carril P9.
 *
 * ## Por qué en el navegador y no en el modelo
 *
 * Porque **no hay tabla**, y el carril prohíbe esquema nuevo. La primera
 * versión vive en `localStorage`: es de quien escribe, no del paciente, y
 * perderlas al cambiar de máquina es un costo aceptable frente a pedirle una
 * migración a Marcelo por un texto de dos líneas. El día que existan en el
 * modelo, esta clase cambia de origen y ninguna pantalla se entera — por eso
 * las expone como señal y no como acceso directo al almacenamiento.
 *
 * ## Las de fábrica no se guardan
 *
 * Sólo se guarda lo que la persona agregó. Si se copiaran al almacenamiento la
 * primera vez, mejorar el texto de una plantilla del producto no llegaría
 * nunca a quien ya abrió la pantalla.
 *
 * ## SSR
 *
 * Sin `localStorage` en el servidor, la lista es la de fábrica. Es la respuesta
 * correcta: el servidor no sabe de quién es la sesión que va a hidratar.
 */
@Injectable({
  providedIn: 'root',
})
export class MessageTemplates {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Las que agregó la persona, en orden de creación. */
  private readonly propias = signal<readonly string[]>(this.leer());

  /** Las de fábrica más las propias. Es lo que el composer ofrece. */
  readonly todas = signal<readonly string[]>([
    ...PLANTILLAS_POR_DEFECTO,
    ...this.leer(),
  ]);

  /**
   * Olvida las plantillas propias, en memoria y en el navegador (TX-31).
   *
   * Lo corre `AuthService.logout` vía `SESSION_CLEANERS`: en un dispositivo
   * compartido, las frases que escribió un médico no deben quedar para el
   * siguiente. Las de fábrica no se tocan.
   */
  olvidar(): void {
    this.propias.set([]);
    this.todas.set([...PLANTILLAS_POR_DEFECTO]);
    if (!this.isBrowser) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.removeItem(CLAVE);
    } catch {
      // Bloqueado: no hay nada que borrar ni forma de hacerlo.
    }
  }

  /** Sólo las propias, para la pantalla que las administra. */
  readonly mias = this.propias.asReadonly();

  /**
   * Agrega una plantilla propia.
   *
   * Ignora las repetidas y las vacías: una lista con la misma frase dos veces
   * obliga a leer las dos para descubrir que son iguales.
   *
   * @param texto - La frase a guardar.
   */
  agregar(texto: string): void {
    const limpio = texto.trim();
    if (limpio === '' || this.todas().includes(limpio)) {
      return;
    }
    this.guardar([...this.propias(), limpio].slice(-TOPE));
  }

  /**
   * Quita una plantilla propia.
   *
   * Las de fábrica no se pueden quitar: son del producto, no de la persona.
   *
   * @param texto - La frase a olvidar.
   */
  quitar(texto: string): void {
    this.guardar(this.propias().filter((propia) => propia !== texto));
  }

  private guardar(propias: readonly string[]): void {
    this.propias.set(propias);
    this.todas.set([...PLANTILLAS_POR_DEFECTO, ...propias]);
    if (!this.isBrowser) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(
        CLAVE,
        JSON.stringify(propias),
      );
    } catch {
      // Almacenamiento lleno o bloqueado por el navegador. Las plantillas
      // siguen funcionando en esta sesión; no vale un cartel de error por algo
      // que la persona no puede arreglar desde acá.
    }
  }

  private leer(): readonly string[] {
    if (!this.isBrowser) {
      return [];
    }
    try {
      const crudo = this.document.defaultView?.localStorage.getItem(CLAVE);
      const guardado: unknown = crudo === null || crudo === undefined
        ? []
        : JSON.parse(crudo);
      return Array.isArray(guardado)
        ? guardado.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      // Un valor corrupto no puede dejar sin composer a nadie.
      return [];
    }
  }
}
