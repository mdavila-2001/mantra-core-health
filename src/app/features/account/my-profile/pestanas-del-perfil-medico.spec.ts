import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CAMPO_DEL_ALTA_EN_PESTANA,
  CAMPOS_DEL_ALTA_SIN_PESTANA,
  PESTANAS_DEL_EDITOR_MEDICO,
  PESTANAS_DEL_PERFIL_MEDICO,
  PESTANA_EDITOR,
  PESTANA_MEDICO,
} from './pestanas-del-perfil-medico';

/**
 * El alta de médico, leída del archivo y no importada.
 *
 * Importar el componente traería su árbol entero de dependencias —catálogos,
 * clientes HTTP, el picker de mapa— a un spec que sólo quiere la lista de
 * campos. Leer el archivo es además lo que hace que esta prueba SIRVA: si
 * mañana alguien agrega un paso al alta, el `key:` nuevo aparece acá aunque
 * nadie se acuerde de tocar el mapa, y la prueba se pone roja.
 *
 * Mismo patrón que `core/tokens/design-tokens.types.spec.ts`, que lee
 * `styles.css` con `node:fs` para detectar deriva en las dos direcciones.
 */
const ALTA = 'src/app/features/auth/register-practitioner/register-practitioner.ts';

function camposDelAlta(): readonly string[] {
  const fuente = readFileSync(ALTA, 'utf8');
  const claves = new Set<string>();
  for (const linea of fuente.split(/\r?\n/)) {
    const encontrado = /^\s*key: '([A-Za-z0-9_]+)',?\s*$/.exec(linea);
    if (encontrado !== null) {
      claves.add(encontrado[1]);
    }
  }
  return [...claves].sort();
}

describe('las pestañas de la ficha del médico', () => {
  it('lee de verdad el alta: si no encuentra campos, la prueba no prueba nada', () => {
    // Fusible. Sin esto, un cambio de formato en el alta dejaría la lista vacía
    // y las dos pruebas de abajo pasarían felices sin comprobar nada.
    expect(camposDelAlta().length).toBeGreaterThan(25);
  });

  it('todos los campos del alta tienen pestaña, salvo los declarados sin ella', () => {
    const huerfanos = camposDelAlta().filter(
      (campo) => !(campo in CAMPO_DEL_ALTA_EN_PESTANA) && !(campo in CAMPOS_DEL_ALTA_SIN_PESTANA),
    );

    expect(huerfanos).toEqual([]);
  });

  /**
   * Eran una y son dos desde el 21/09/2026: se sumó `sexAtBirth`, que estaba
   * declarado como si viviera en «Datos personales» y ahí no está —la lectura
   * del perfil médico no devuelve el dato, así que no hay nada que mostrar—.
   *
   * La lista se sigue fijando entera a propósito. Es el freno a que ausentarse
   * de la ficha sea la salida fácil: sumar un campo acá exige tocar esta
   * prueba y escribir el motivo, que es exactamente la fricción que se quiere.
   */
  it('las dos ausencias son las declaradas, y las dos dicen por qué', () => {
    expect(Object.keys(CAMPOS_DEL_ALTA_SIN_PESTANA).sort()).toEqual(['password', 'sexAtBirth']);
    expect(CAMPOS_DEL_ALTA_SIN_PESTANA['password']).toContain('Cambiar contraseña');
    expect(CAMPOS_DEL_ALTA_SIN_PESTANA['sexAtBirth']).toContain('no lo devuelve');
  });

  /** Un campo no puede estar en los dos mapas: sería mostrarse y no mostrarse. */
  it('ninguna ausencia aparece además con pestaña', () => {
    for (const campo of Object.keys(CAMPOS_DEL_ALTA_SIN_PESTANA)) {
      expect(CAMPO_DEL_ALTA_EN_PESTANA[campo]).toBeUndefined();
    }
  });

  it('no mapea campos que el alta ya no pregunta', () => {
    const delAlta = new Set(camposDelAlta());
    const sobrantes = Object.keys(CAMPO_DEL_ALTA_EN_PESTANA).filter((campo) => !delAlta.has(campo));

    expect(sobrantes).toEqual([]);
  });

  it('cada pestaña mapeada existe en la tira', () => {
    for (const [campo, indice] of Object.entries(CAMPO_DEL_ALTA_EN_PESTANA)) {
      expect(
        PESTANAS_DEL_PERFIL_MEDICO[indice],
        `«${campo}» apunta a la pestaña ${indice}, que no existe`,
      ).toBeDefined();
    }
  });

  it('los índices con nombre coinciden con el orden de la tira', () => {
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.personales]).toBe('Datos personales');
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.contacto]).toBe('Contacto');
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.facturacion]).toBe('Facturación');
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.dondeAtiendo]).toBe('Dónde atiendo');
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.trayectoria]).toBe('Trayectoria');
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.credenciales]).toBe('Credenciales');
    expect(PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.actividad]).toBe('Actividad');
  });

  it('las tres primeras pestañas se llaman igual que las del paciente', async () => {
    // El pedido es que las dos fichas se lean igual. Donde el dato es el mismo,
    // el rótulo tiene que ser el mismo: «Datos personales», «Contacto» y
    // «Facturación» no pueden llamarse distinto de un lado y del otro, ni caer
    // en otro lugar de la tira.
    const { PESTANAS_DEL_PERFIL, PESTANA } = await import('./pestanas-del-perfil');

    expect(PESTANAS_DEL_PERFIL_MEDICO[0]).toBe(PESTANAS_DEL_PERFIL[0]);
    expect(PESTANAS_DEL_PERFIL_MEDICO[1]).toBe(PESTANAS_DEL_PERFIL[1]);
    expect(PESTANAS_DEL_PERFIL_MEDICO[2]).toBe(PESTANAS_DEL_PERFIL[2]);
    expect(PESTANA_MEDICO.facturacion).toBe(PESTANA.facturacion);
  });

  /**
   * El editor tiene que ofrecer la pestaña, no sólo la ficha: el NIT no se
   * pregunta en el alta, así que si el editor no lo pide no hay ningún lugar
   * donde cargarlo.
   */
  it('el editor también pide la facturación', () => {
    expect(PESTANAS_DEL_EDITOR_MEDICO[PESTANA_EDITOR.facturacion]).toBe('Facturación');
  });

  /**
   * Esta prueba decía lo contrario hasta el 20/09/2026: exigía que el editor
   * **no** tuviera «Actividad», porque los contadores no se editan.
   *
   * El doctor pidió que «TODAS las pestañas sean editables, o sea su
   * información» (C-05), y su kill-test es contar: menos pestañas que la ficha
   * y la corrección no está hecha. Los contadores siguen sin editarse —eso no
   * cambió y está fijado abajo—; lo que cambió es que ya no se resuelve
   * sacando la pestaña, sino teniéndola y diciendo en ella por qué no hay nada
   * que escribir.
   *
   * Se reemplaza por la invariante FUERTE, no por ninguna: las dos listas son
   * la misma, en el mismo orden. Con la anterior, el editor podía perder tres
   * pestañas sin que nadie se enterara.
   */
  it('el editor tiene exactamente las mismas pestañas que la ficha, en el mismo orden', () => {
    expect([...PESTANAS_DEL_EDITOR_MEDICO]).toEqual([...PESTANAS_DEL_PERFIL_MEDICO]);
  });

  /** Y los índices con nombre no se pueden desincronizar de las dos listas. */
  it('los índices del editor y los de la ficha nombran la misma pestaña', () => {
    for (const [nombre, indice] of Object.entries(PESTANA_EDITOR)) {
      expect(PESTANAS_DEL_EDITOR_MEDICO[indice]).toBe(
        PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO[nombre as keyof typeof PESTANA_MEDICO]],
      );
    }
  });
});
