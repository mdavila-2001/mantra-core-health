import { simularApiTotal } from '../../support/recorrido/api-total';
import { capturar, esperarEstable, reiniciarContadores } from '../../support/recorrido/evidencia';
import { EVITAR_POR_DEFECTO, recorrer } from '../../support/recorrido/explorador';

/**
 * La vitrina del sistema de diseño.
 *
 * Es la pantalla más densa de la aplicación por lejos: reúne los treinta y pico
 * de componentes con todas sus variantes, y sola tiene más controles que el
 * resto del producto junto. Por eso va en su propio archivo y con su propio
 * tope: mezclada con las demás, se llevaría el tiempo de la corrida y su
 * evidencia taparía la del producto en el reporte.
 *
 * El tope existe igual, y cuando corta **queda anotado**. Está puesto por encima
 * de la cuenta de controles de la vitrina —eran 226 en la última medición— para
 * que no corte nada hoy, y que siga siendo un tope por si alguien agrega una
 * galería que se descontrole: sin él, un bucle de controles que se generan al
 * accionarlos colgaría la corrida entera en vez de recortar y avisar.
 */
/**
 * Los días del calendario del selector de fecha.
 *
 * Son treinta y pico de controles con el mismo aspecto, y accionarlos uno por
 * uno no agrega evidencia: la captura del 27 de agosto no dice nada que no diga
 * la del 26. Peor todavía, cada clic cambia la dirección, y el explorador vuelve
 * a entrar a la pantalla cuando eso pasa — cincuenta recargas de la página más
 * pesada de la aplicación, que terminaban venciendo el techo de carga.
 *
 * El selector **sí** queda en la evidencia: el clic que lo abre no está
 * excluido, así que el calendario desplegado se captura igual.
 */
const DIAS_DEL_CALENDARIO =
  /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo),?\s+\d+ de /i;

describe('Recorrido · vitrina de diseño', () => {
  beforeEach(() => {
    reiniciarContadores();
    simularApiTotal();
  });

  it('vitrina completa', () => {
    recorrer(
      { ruta: '/design-system', carpeta: '40-vitrina', titulo: 'Vitrina de diseño' },
      // Sólo lo visible, y sólo acá: la vitrina mide más de veinte mil píxeles
      // de alto, así que cada captura de página completa pesa dos megas y medio
      // y doscientas serían medio giga de imágenes casi idénticas. El clic ya
      // dejó el control accionado a la vista, que es lo que hay que ver.
      {
        /**
         * El tope, y por qué es 150 y no 300.
         *
         * Con 300 la prueba pasaba de los veinte minutos y a veces ni terminaba:
         * cada acción que navega obliga al explorador a volver a entrar, y
         * recargar una pantalla de veinte mil píxeles doscientas veces es lo que
         * domina el tiempo. Con 150 la vitrina se recorre entera en un rato
         * razonable y **la evidencia sigue siendo la misma en lo que importa**:
         * las variantes repetidas de un mismo componente producen capturas casi
         * idénticas.
         *
         * Cuando el tope corta **queda anotado** en `omisiones.jsonl` y el
         * reporte lo muestra con los nombres de lo que quedó sin accionar. Un
         * recorte silencioso se leería como cobertura completa, que es la
         * conclusión equivocada; éste se lee como lo que es.
         */
        maxAcciones: 150,
        evitar: [...EVITAR_POR_DEFECTO, DIAS_DEL_CALENDARIO],
        paginaCompleta: false,
      },
    );
  });

  /**
   * Los estados que la vitrina sólo muestra si se le pide.
   *
   * El diálogo de confirmación y los avisos emergentes viven detrás de un botón
   * y desaparecen solos. El explorador captura el clic que los abre, pero no
   * garantiza que la captura los agarre montados: acá se los espera.
   */
  it('diálogo de confirmación', () => {
    const pantalla = { carpeta: '41-vitrina-dialogo', titulo: 'Vitrina · diálogo' };

    cy.visit('/design-system');
    esperarEstable();

    cy.porTestId('demo-confirmar-guardado').scrollIntoView().click();
    cy.porTestId('dialogo').should('be.visible');
    esperarEstable();
    capturar(pantalla, 'diálogo de confirmación abierto');

    // Los dos desenlaces del diálogo, no sólo el de aceptar.
    cy.porTestId('dialogo-cancelar').click();
    cy.porTestId('dialogo').should('not.exist');
    esperarEstable();
    capturar(pantalla, 'diálogo cancelado');
  });

  it('galería de estados de vista', () => {
    const pantalla = { carpeta: '42-estados-vista', titulo: 'Galería de estados de vista' };

    cy.visit('/design-system');
    esperarEstable();

    capturar(pantalla, 'estado inicial');

    /**
     * La galería recorre los estados S1…S5 con un botón que avanza al siguiente:
     * cada clic es un estado distinto y todos merecen su captura.
     *
     * El bucle comprueba primero que el botón exista: si la galería cambiara de
     * forma, esto tiene que dejar de capturar, no hacer fallar el recorrido.
     */
    cy.get('body').then(($cuerpo) => {
      const hayBoton = $cuerpo.find('button:contains("Siguiente estado")').length > 0;
      if (!hayBoton) {
        return;
      }
      for (let paso = 1; paso <= 6; paso += 1) {
        cy.contains('button', /siguiente estado/i).click();
        esperarEstable();
        capturar(pantalla, `estado ${paso}`);
      }
    });
  });
});
