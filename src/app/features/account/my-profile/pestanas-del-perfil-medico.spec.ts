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

  it('la contraseña es la única ausencia, y está justificada', () => {
    expect(Object.keys(CAMPOS_DEL_ALTA_SIN_PESTANA)).toEqual(['password']);
    expect(CAMPOS_DEL_ALTA_SIN_PESTANA['password']).toContain('Cambiar contraseña');
    expect(CAMPO_DEL_ALTA_EN_PESTANA['password']).toBeUndefined();
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
  it('el editor también pide la facturación, y sigue sin ofrecer «Actividad»', () => {
    expect(PESTANAS_DEL_EDITOR_MEDICO[PESTANA_EDITOR.facturacion]).toBe('Facturación');
    expect([...PESTANAS_DEL_EDITOR_MEDICO]).not.toContain('Actividad');
  });
});
