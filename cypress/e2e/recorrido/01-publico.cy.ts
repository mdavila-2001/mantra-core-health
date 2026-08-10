import { simularApiTotal } from '../../support/recorrido/api-total';
import { reiniciarContadores } from '../../support/recorrido/evidencia';
import { EVITAR_POR_DEFECTO, recorrer } from '../../support/recorrido/explorador';

/**
 * Las pantallas a las que se llega **sin sesión**.
 *
 * Van primero porque son las que ve alguien que todavía no entró, y porque
 * ninguna necesita preparar estado: se entra por la URL y ya están.
 *
 * Cada prueba es una pantalla. Podrían ser una sola con un bucle, y sería peor:
 * cuando una falla, el reporte nombra la que falló en vez de decir «recorrido» y
 * obligar a leer el registro para saber dónde se cortó.
 */
describe('Recorrido · pantallas públicas', () => {
  beforeEach(() => {
    reiniciarContadores();
    simularApiTotal();
  });

  it('login', () => {
    recorrer({ ruta: '/auth', carpeta: '01-login', titulo: 'Iniciar sesión' });
  });

  it('login con credenciales rechazadas', () => {
    simularApiTotal({ loginValido: false });

    recorrer(
      { ruta: '/auth', carpeta: '02-login-error', titulo: 'Login · credenciales inválidas' },
      {
        // El estado que interesa capturar es el de después del rechazo, así que
        // se llega a él antes de empezar a explorar.
        preparar: () => {
          cy.porTestId('login-identifier').clear().type('ana@mantra.test');
          cy.porTestId('login-password').clear().type('clave-incorrecta');
          cy.porTestId('login-submit').click();
          cy.porTestId('login-error').should('be.visible');
        },
        maxAcciones: 12,
      },
    );
  });

  it('crear cuenta', () => {
    // Es el formulario más largo de la aplicación —tiene dos ramas, paciente y
    // profesional— y cada rama muestra sus propios campos.
    recorrer(
      { ruta: '/auth/registro', carpeta: '03-registro', titulo: 'Crear cuenta' },
      { maxAcciones: 60, evitar: EVITAR_POR_DEFECTO },
    );
  });

  it('recuperar contraseña', () => {
    recorrer({
      ruta: '/auth/recuperar',
      carpeta: '04-recuperar',
      titulo: 'Recuperar contraseña',
    });
  });

  it('nueva contraseña', () => {
    // El enlace del correo trae el token por query string; sin él la pantalla
    // muestra el estado de enlace inválido, que también vale la pena capturar.
    recorrer({
      ruta: '/auth/nueva-clave?token=token-de-prueba',
      carpeta: '05-nueva-clave',
      titulo: 'Nueva contraseña',
    });
  });

  it('nueva contraseña sin token', () => {
    recorrer({
      ruta: '/auth/nueva-clave',
      carpeta: '06-nueva-clave-sin-token',
      titulo: 'Nueva contraseña · enlace inválido',
    });
  });

  it('verificar correo', () => {
    recorrer({
      ruta: '/auth/verificar?token=token-de-prueba',
      carpeta: '07-verificar-correo',
      titulo: 'Verificar correo',
    });
  });

  it('verificar correo sin token', () => {
    recorrer({
      ruta: '/auth/verificar',
      carpeta: '08-verificar-sin-token',
      titulo: 'Verificar correo · enlace inválido',
    });
  });

  it('elegir organización', () => {
    simularApiTotal({
      claims: {
        tenants: ['t-1', 't-2'],
        tenantNames: { 't-1': 'Clínica Norte', 't-2': 'Centro Sur' },
      },
    });

    recorrer(
      { ruta: '/auth', carpeta: '09-elegir-organizacion', titulo: 'Elegir organización' },
      {
        // A esta pantalla no se entra por la URL: la sesión tiene que existir y
        // tener más de una organización, o el guard manda al login.
        preparar: () => {
          cy.porTestId('login-identifier').clear().type('ana@mantra.test');
          cy.porTestId('login-password').clear().type('secreto-de-prueba');
          cy.porTestId('login-submit').click();
          cy.location('pathname').should('match', /\/auth\/organizacion$/);
        },
      },
    );
  });

  it('página no encontrada', () => {
    recorrer({
      ruta: '/esta-ruta-no-existe',
      carpeta: '10-no-encontrada',
      titulo: 'Página no encontrada',
    });
  });

  it('recuperación de error', () => {
    recorrer({
      ruta: '/error',
      carpeta: '11-error',
      titulo: 'Recuperación de error',
    });
  });
});
