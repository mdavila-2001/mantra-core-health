/**
 * Datos de prueba.
 *
 * Ninguno de estos valores abre nada: la API de la suite está simulada
 * (`fixtures/escenarios.ts`) y acepta cualquier credencial cuando el escenario
 * dice que el login es válido. Aun así se leen del entorno, porque la misma
 * suite puede apuntarse a un entorno de ensayo con `E2E_BASE_URL`, y ahí las
 * credenciales sí importan y **no pueden estar en el repositorio**.
 *
 * Los datos que se dan de alta se generan únicos por corrida: dos ejecuciones
 * seguidas no pueden chocar entre sí, que es el requisito de poder correr la
 * suite dos veces sin limpiar nada en el medio.
 */

export interface UsuarioPrueba {
  /** Correo o documento: el campo de acceso acepta los dos. */
  readonly identificador: string;
  readonly password: string;
  /** Nombre que el token declara y el encabezado muestra. */
  readonly nombre: string;
}

function delEntorno(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  return valor === undefined || valor.trim() === '' ? porDefecto : valor.trim();
}

/** Paciente con una sola organización. Es el usuario de la mayoría de las pruebas. */
export const PACIENTE: UsuarioPrueba = {
  identificador: delEntorno('E2E_TEST_USER_EMAIL', 'ana@mantra.test'),
  password: delEntorno('E2E_TEST_USER_PASSWORD', 'secreto-de-prueba'),
  nombre: 'Ana Salas',
};

/** Alguien que entra con documento en vez de correo: el otro camino del login. */
export const PACIENTE_CON_DOCUMENTO: UsuarioPrueba = {
  identificador: delEntorno('E2E_TEST_USER_NATIONAL_ID', '1234567'),
  password: PACIENTE.password,
  nombre: 'Ana Salas',
};

/** Sufijo único de la corrida: mismo valor en todos los trabajadores. */
const SUFIJO = (process.env['E2E_RUN_ID'] ?? String(Date.now())).replace(/[^0-9a-z]/gi, '').slice(-10);

let contador = 0;

/** Un valor irrepetible dentro de la corrida y entre corridas. */
function unico(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${SUFIJO}-${process.pid}-${contador}`;
}

export interface AltaPaciente {
  readonly documento: string;
  readonly nombre: string;
  readonly password: string;
  readonly correo: string;
}

/** Datos de alta nuevos cada vez: evitan colisiones entre pruebas y corridas. */
export function nuevoPaciente(): AltaPaciente {
  const id = unico('p');
  return {
    documento: id.replace(/\D/g, '').slice(-9).padStart(9, '7'),
    nombre: `Paciente ${id}`,
    password: 'contrasena-de-prueba',
    correo: `${id}@mantra.test`,
  };
}
