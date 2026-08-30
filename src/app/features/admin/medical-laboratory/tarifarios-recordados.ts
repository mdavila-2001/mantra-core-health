import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import type { TarifarioDeLaUnidad } from './medical-laboratory.types';

/** Dónde se espeja lo recordado mientras la pestaña siga abierta. */
const CLAVE = 'alovida.tarifarios-recordados';

/**
 * Los tarifarios que se crearon desde acá y todavía no tienen ningún precio.
 *
 * ## Por qué hace falta recordarlos
 *
 * La plataforma no expone ninguna lectura de tarifarios: viajan dentro de cada
 * precio de la ficha de la unidad, así que la consola sólo puede deducir los
 * que ya tienen al menos uno. Un tarifario recién creado no tiene ninguno, y
 * sin esta memoria desaparecía de la pantalla en la primera recarga: quedaba
 * creado en el servidor, invisible acá, y con su código ocupado — la persona
 * no tenía más salida que crear otro.
 *
 * ## Por qué en la pestaña y no en la cuenta
 *
 * Es un **relleno de un hueco de lectura**, no un almacén de la aplicación: lo
 * que vale es lo que el servidor tiene, y en cuanto el tarifario reciba su
 * primer precio la ficha lo va a traer sola y esta copia deja de usarse.
 * Guardarlo más allá de la pestaña sostendría una lista propia que nadie
 * concilia y que envejecería en silencio.
 *
 * Sin almacenamiento —el servidor al pintar, una ventana privada, un permiso
 * denegado— sigue funcionando en memoria: se pierde al recargar, que es
 * exactamente lo que pasaba antes.
 */
@Injectable({ providedIn: 'root' })
export class TarifariosRecordados {
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly porUnidad = new Map<string, readonly TarifarioDeLaUnidad[]>();
  private hidratado = false;

  /** Anota un tarifario recién creado en la unidad donde se creó. */
  recordar(unitId: string, tarifario: TarifarioDeLaUnidad): void {
    this.hidratar();
    const previos = this.porUnidad.get(unitId) ?? [];
    // Recordarlo dos veces no lo duplica: es el mismo tarifario del servidor, y
    // la pantalla lo pinta una sola vez.
    this.porUnidad.set(unitId, [
      ...previos.filter((otro) => otro.id !== tarifario.id),
      tarifario,
    ]);
    this.espejar();
  }

  /** Lo recordado para esa unidad, en el orden en que se fue creando. */
  deLaUnidad(unitId: string): readonly TarifarioDeLaUnidad[] {
    this.hidratar();
    return this.porUnidad.get(unitId) ?? [];
  }

  /**
   * Recupera lo que dejó una carga anterior de la pantalla, una sola vez.
   *
   * En el primer uso y no al construirse: el servicio se instancia con la
   * aplicación, y leer el almacenamiento al arrancar costaría en todas las
   * pantallas que nunca abren esta consola.
   */
  private hidratar(): void {
    if (this.hidratado) {
      return;
    }
    this.hidratado = true;
    if (!this.esNavegador) {
      return;
    }
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      if (crudo === null) {
        return;
      }
      for (const [unitId, tarifarios] of leerRecordados(crudo)) {
        this.porUnidad.set(unitId, tarifarios);
      }
    } catch {
      // Sin almacenamiento o con contenido ilegible se sigue en memoria: esto
      // rellena un hueco de lectura, y no poder rellenarlo deja la pantalla
      // como estaba, no rota.
    }
  }

  private espejar(): void {
    if (!this.esNavegador) {
      return;
    }
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(this.porUnidad)));
    } catch {
      // Ídem: lo recordado vive igual en memoria hasta que se recargue.
    }
  }
}

/**
 * Lo espejado, sólo mientras conserve la forma con la que se guardó.
 *
 * Lo que hay en el almacenamiento no es un dato de la aplicación: lo pudo dejar
 * una versión anterior de la pantalla, o cualquiera con las herramientas del
 * navegador abiertas. Lo que no encaja se descarta en vez de llegar a la
 * pantalla como un tarifario a medio hacer.
 */
function leerRecordados(crudo: string): ReadonlyMap<string, readonly TarifarioDeLaUnidad[]> {
  const recordados = new Map<string, readonly TarifarioDeLaUnidad[]>();
  const cuerpo: unknown = JSON.parse(crudo);
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return recordados;
  }
  for (const [unitId, valor] of Object.entries(cuerpo as Record<string, unknown>)) {
    if (!Array.isArray(valor)) {
      continue;
    }
    const tarifarios = valor.filter(esTarifario);
    if (tarifarios.length > 0) {
      recordados.set(unitId, tarifarios);
    }
  }
  return recordados;
}

function esTarifario(valor: unknown): valor is TarifarioDeLaUnidad {
  if (valor === null || typeof valor !== 'object') {
    return false;
  }
  const fila = valor as Partial<Record<keyof TarifarioDeLaUnidad, unknown>>;
  return (
    typeof fila.id === 'string' &&
    typeof fila.code === 'string' &&
    typeof fila.esPublico === 'boolean' &&
    typeof fila.cantidadDePrecios === 'number'
  );
}
