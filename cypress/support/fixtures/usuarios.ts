/**
 * Datos de prueba.
 *
 * Ninguno de estos valores abre nada: la API de la suite está simulada
 * (`escenarios.ts`) y acepta cualquier credencial cuando el escenario dice que
 * el login es válido. Aun así se leen del entorno, porque la misma suite puede
 * apuntarse a un entorno de ensayo con `E2E_BASE_URL`, y ahí las credenciales
 * sí importan y **no pueden estar en el repositorio**.
 *
 * Los datos que se dan de alta se generan únicos por corrida: dos ejecuciones
 * seguidas no pueden chocar entre sí, que es el requisito de poder correr la
 * suite dos veces sin limpiar nada en el medio.
 *
 * ## Por qué `Cypress.expose()` y no `process.env`
 *
 * Este archivo lo importan las pruebas, que corren **dentro del navegador**,
 * donde `process.env` no existe. `cypress.config.ts` lee el entorno de Node en
 * `credenciales()` y lo publica en su bloque `expose`, que es el canal de
 * Cypress 15 para **configuración pública** — y nada de esto es un secreto: la
 * API de la suite está simulada y acepta cualquier credencial.
 */

export interface UsuarioPrueba {
  /** Correo o documento: el campo de acceso acepta los dos. */
  readonly identificador: string;
  readonly password: string;
  /** Nombre que el token declara y el encabezado muestra. */
  readonly nombre: string;
}

function delEntorno(nombre: string, porDefecto: string): string {
  const valor = Cypress.expose(nombre) as unknown;
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : porDefecto;
}

/** Paciente con una sola organización. Es el usuario de la mayoría de las pruebas. */
export function paciente(): UsuarioPrueba {
  return {
    identificador: delEntorno('E2E_TEST_USER_EMAIL', 'ana@mantra.test'),
    password: delEntorno('E2E_TEST_USER_PASSWORD', 'secreto-de-prueba'),
    nombre: 'Ana Salas',
  };
}

/** Alguien que entra con documento en vez de correo: el otro camino del login. */
export function pacienteConDocumento(): UsuarioPrueba {
  return {
    identificador: delEntorno('E2E_TEST_USER_NATIONAL_ID', '1234567'),
    password: paciente().password,
    nombre: 'Ana Salas',
  };
}

/**
 * Sufijo único de la corrida.
 *
 * Sale del identificador de la corrida, que `cypress.config.ts` publica en su
 * bloque `expose`: así todas las pruebas de una misma ejecución comparten sufijo y
 * dos ejecuciones distintas nunca lo comparten.
 */
function sufijo(): string {
  const runId = Cypress.expose('E2E_RUN_ID') as unknown;
  const crudo = typeof runId === 'string' && runId !== '' ? runId : String(Date.now());
  return crudo.replace(/[^0-9a-z]/gi, '').slice(-10);
}

let contador = 0;

/** Un valor irrepetible dentro de la corrida y entre corridas. */
function unico(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${sufijo()}-${contador}`;
}

export interface AltaPaciente {
  readonly documento: string;
  /** Nombre de pila. El formulario pide el nombre en partes, no completo. */
  readonly nombre: string;
  /** Segundo nombre. Opcional en el formulario. */
  readonly segundoNombre: string;
  readonly apellidoPaterno: string;
  /** Apellido materno. Opcional en el formulario. */
  readonly apellidoMaterno: string;
  readonly password: string;
  readonly correo: string;
}

/** Datos de alta nuevos cada vez: evitan colisiones entre pruebas y corridas. */
export function nuevoPaciente(): AltaPaciente {
  const id = unico('p');
  return {
    documento: id.replace(/\D/g, '').slice(-9).padStart(9, '7'),
    // El identificador único va en el apellido paterno y no en el nombre: así
    // el nombre para mostrar sigue leyéndose como un nombre en las capturas.
    nombre: 'Paciente',
    segundoNombre: 'De',
    apellidoPaterno: `Prueba ${id}`,
    apellidoMaterno: 'Automatizada',
    password: 'contrasena-de-prueba',
    correo: `${id}@mantra.test`,
  };
}
