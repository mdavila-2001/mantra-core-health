import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ENROLLMENT_IN_TAB_FIELD,
  ENROLLMENT_WITHOUT_TAB_FIELDS,
  EDITOR_DOCTOR_TABS,
  DOCTOR_PROFILE_TABS,
  TAB_EDITOR,
  DOCTOR_TAB,
} from './doctor-profile-tabs';

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
  // País, universidad y ciudad del título ya no son descripciones `key: '…'`
  // (02/10/2026: son desplegables en árbol con su propio manejo) pero el alta los
  // sigue preguntando. Se leen de la unión que los nombra, en vez de dejarlos
  // fuera y que parezca que el alta dejó de pedirlos.
  const estudio = /type ClaveDeEstudioDelTitulo\s*=([^;]+);/.exec(fuente);
  for (const clave of estudio?.[1].matchAll(/'([A-Za-z0-9_]+)'/g) ?? []) {
    claves.add(clave[1]);
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
      (campo) => !(campo in ENROLLMENT_IN_TAB_FIELD) && !(campo in ENROLLMENT_WITHOUT_TAB_FIELDS),
    );

    expect(huerfanos).toEqual([]);
  });

  /**
   * Eran una y pasaron a dos el 21/09/2026: se sumó `sexAtBirth`, que estaba
   * declarado como si viviera en «Datos personales» y ahí no está —la lectura
   * del perfil médico no devuelve el dato, así que no hay nada que mostrar—.
   * Fueron cinco el 23/09/2026: los tres contactos del trabajo, que el médico
   * pidió sacar de «Contacto» (D-03). Siete cuando el alta sumó la dirección
   * laboral y su punto en el mapa, que la ficha todavía no lee. Y seis desde
   * el 24/09/2026, cuando el correo de trabajo volvió a «Contacto» (#645).
   *
   * La lista se sigue fijando entera a propósito. Es el freno a que ausentarse
   * de la ficha sea la salida fácil: sumar un campo acá exige tocar esta
   * prueba y escribir el motivo, que es exactamente la fricción que se quiere.
   */
  it('las seis ausencias son las declaradas, y las seis dicen por qué', () => {
    expect(Object.keys(ENROLLMENT_WITHOUT_TAB_FIELDS).sort()).toEqual([
      'gpsTrabajo',
      'password',
      'sexAtBirth',
      'workAddressLines',
      'workLandline',
      'workMobilePhone',
    ]);
    expect(ENROLLMENT_WITHOUT_TAB_FIELDS['password']).toContain('Cambiar contraseña');
    expect(ENROLLMENT_WITHOUT_TAB_FIELDS['sexAtBirth']).toContain('no lo devuelve');
    for (const campo of ['workMobilePhone', 'workLandline']) {
      expect(ENROLLMENT_WITHOUT_TAB_FIELDS[campo], campo).toContain('(D-03)');
      expect(ENROLLMENT_WITHOUT_TAB_FIELDS[campo], campo).toContain('«Contacto»');
    }
    // El correo de trabajo es un contacto y se corrige en «Contacto» (#645).
    expect(ENROLLMENT_IN_TAB_FIELD['email']).toBe(DOCTOR_TAB.contacto);
    expect(ENROLLMENT_WITHOUT_TAB_FIELDS['workAddressLines']).toContain('dirección laboral');
    expect(ENROLLMENT_WITHOUT_TAB_FIELDS['gpsTrabajo']).toContain('lugar de trabajo');
  });

  /** Un campo no puede estar en los dos mapas: sería mostrarse y no mostrarse. */
  it('ninguna ausencia aparece además con pestaña', () => {
    for (const campo of Object.keys(ENROLLMENT_WITHOUT_TAB_FIELDS)) {
      expect(ENROLLMENT_IN_TAB_FIELD[campo]).toBeUndefined();
    }
  });

  it('no mapea campos que el alta ya no pregunta', () => {
    const delAlta = new Set(camposDelAlta());
    const sobrantes = Object.keys(ENROLLMENT_IN_TAB_FIELD).filter((campo) => !delAlta.has(campo));

    expect(sobrantes).toEqual([]);
  });

  it('cada pestaña mapeada existe en la tira', () => {
    for (const [campo, indice] of Object.entries(ENROLLMENT_IN_TAB_FIELD)) {
      expect(
        DOCTOR_PROFILE_TABS[indice],
        `«${campo}» apunta a la pestaña ${indice}, que no existe`,
      ).toBeDefined();
    }
  });

  it('los índices con nombre coinciden con el orden de la tira', () => {
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.personales]).toBe('Datos personales');
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.contacto]).toBe('Contacto');
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.facturacion]).toBe('Facturación');
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.dondeAtiendo]).toBe('Dónde atiendo');
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.trayectoria]).toBe('Trayectoria');
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.credenciales]).toBe('Credenciales');
    expect(DOCTOR_PROFILE_TABS[DOCTOR_TAB.actividad]).toBe('Actividad');
  });

  /**
   * «Las especialidades deben estar en "datos personales" ... no en
   * credenciales» (pedido del propietario, 24/09/2026). Contestan «¿de qué es
   * médico?», la misma pregunta que el título profesional, no «¿con qué
   * habilitación ejerce?» que es lo que queda en Credenciales.
   */
  it('las especialidades viven en Datos personales, no en Credenciales', () => {
    expect(ENROLLMENT_IN_TAB_FIELD['especialidadesExtra']).toBe(DOCTOR_TAB.personales);
    // Y no hay «principal» que ubicar: el alta dejó de preguntarla (D-01, 23/09/2026).
    expect(ENROLLMENT_IN_TAB_FIELD['specialtyPrimary']).toBeUndefined();
  });

  it('las tres primeras pestañas se llaman igual que las del paciente', async () => {
    // El pedido es que las dos fichas se lean igual. Donde el dato es el mismo,
    // el rótulo tiene que ser el mismo: «Datos personales», «Contacto» y
    // «Facturación» no pueden llamarse distinto de un lado y del otro, ni caer
    // en otro lugar de la tira.
    const { PROFILE_TABS: PESTANAS_DEL_PERFIL, TAB: PESTANA } = await import('./profile-tabs');

    expect(DOCTOR_PROFILE_TABS[0]).toBe(PESTANAS_DEL_PERFIL[0]);
    expect(DOCTOR_PROFILE_TABS[1]).toBe(PESTANAS_DEL_PERFIL[1]);
    expect(DOCTOR_PROFILE_TABS[2]).toBe(PESTANAS_DEL_PERFIL[2]);
    expect(DOCTOR_TAB.facturacion).toBe(PESTANA.facturacion);
  });

  /**
   * El editor tiene que ofrecer la pestaña, no sólo la ficha: el NIT no se
   * pregunta en el alta, así que si el editor no lo pide no hay ningún lugar
   * donde cargarlo.
   */
  it('el editor también pide la facturación', () => {
    expect(EDITOR_DOCTOR_TABS[TAB_EDITOR.facturacion]).toBe('Facturación');
  });

  /**
   * Esta prueba cambió dos veces. Hasta el 20/09/2026 exigía que el editor
   * **no** tuviera «Actividad»; ese día el doctor pidió «TODAS las pestañas
   * editables» (C-05) y pasó a exigir las mismas siete de la ficha. El
   * 24/09/2026 el cliente pidió sacarla otra vez: «no debe poder editarse
   * actividad, porque es solo estadísticas».
   *
   * Se conserva la invariante FUERTE: las listas son la misma, en el mismo
   * orden, con UNA sola diferencia declarada. Así el editor no puede perder
   * otra pestaña sin que nadie se entere.
   */
  it('el editor tiene las pestañas de la ficha, en el mismo orden, menos «Actividad»', () => {
    expect([...EDITOR_DOCTOR_TABS]).toEqual(
      DOCTOR_PROFILE_TABS.filter((pestana) => pestana !== 'Actividad'),
    );
  });

  /** Y los índices con nombre no se pueden desincronizar de las dos listas. */
  it('los índices del editor y los de la ficha nombran la misma pestaña', () => {
    for (const [nombre, indice] of Object.entries(TAB_EDITOR)) {
      expect(EDITOR_DOCTOR_TABS[indice]).toBe(
        DOCTOR_PROFILE_TABS[DOCTOR_TAB[nombre as keyof typeof DOCTOR_TAB]],
      );
    }
  });
});
