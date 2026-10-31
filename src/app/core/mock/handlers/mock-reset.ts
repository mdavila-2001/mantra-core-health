import { ajustesDeAgenda, delegados, permisos, vinculos } from '../fixtures/support-hospital';
import { reiniciarGobierno } from '../fixtures/support-hospital-governance';
import { factores } from './iam-mfa.store';
import { redesDeLaOrganizacion } from './iam-security.handlers';
import { olvidarPasosExtra } from './support-access.governance.core';
import { olvidarLotesDeNormalizacion } from './support-access.governance.rules.handlers';
import { reiniciarTopeDeBusquedas } from './support-access.patients.handlers';
import { olvidarSimulaciones } from './support-access.governance.tokens';
import { olvidarLasSesionesDeCuenta } from './auth.handlers';
import { dispositivos, politicasDeSesion } from './support-access.session.handlers';

/**
 * Deja la **sesión** del simulador (políticas, dispositivos, factores de segundo paso, redes, sesiones abiertas por cuenta) como la trae de fábrica.
 *
 * Solo lo usan las pruebas: el corredor no aísla los módulos entre archivos de un mismo worker (`isolate: false`), así que lo
 * que un archivo guardó en estas tablas lo ve el siguiente, y cuál llegaba cambiada dependía del orden. Un archivo que supone
 * «Ana tiene sus dos pasos, Lucía un dispositivo nuevo y la política de arranque» lo pide acá en su `beforeAll`.
 *
 * Son solo las tablas que **nacen con sus filas de fábrica** o vacías. Las de vínculos, permisos y conversaciones reciben
 * filas de otros módulos al cargarse, así que volver a «las del constructor» las dejaría sin ellas: esas pruebas fijan lo que
 * necesitan ellas mismas.
 */
export function reiniciarLaSesionDelSimulador(): void {
  for (const tabla of [
    politicasDeSesion,
    dispositivos,
    factores,
    redesDeLaOrganizacion,
    ajustesDeAgenda,
  ]) {
    tabla.reiniciar();
  }
  // Las sesiones abiertas por cuenta y las contraseñas vigentes son memoria del módulo de auth, no una tabla.
  olvidarLasSesionesDeCuenta();
}

/**
 * Deja el **gobierno de accesos** como lo trae de fábrica: reglas, ajustes, SoD, banderas, aprobaciones, campañas, anomalías,
 * casos de ciclo de vida, pasos extra y simulaciones, **y** los vínculos, permisos y aceptaciones de los doctores del piloto (que el gobierno cambia al
 * dar de baja, suspender o mover). Solo lo usan las pruebas, por lo mismo que la función de arriba.
 */
export function reiniciarElGobiernoDeAccesos(): void {
  reiniciarGobierno();
  vinculos.reiniciar();
  permisos.reiniciar();
  // Terminar un vínculo revoca la aceptación de cada doctor (caso 12): volver el vínculo sin ella dejaba a Ana activa pero sin
  // poder responder por Pérez, un estado que la API no produce.
  delegados.reiniciar();
  olvidarPasosExtra();
  olvidarSimulaciones();
  olvidarLotesDeNormalizacion();
  // El tope de búsquedas por persona es memoria pura (no tiene filas de fábrica): se vacía. Las tablas de la bandeja (asignaciones, notas,
  // autorías…) reciben filas de los módulos de chat al cargarse: reiniciarlas las dejaría sin ellas, así que NO se tocan acá.
  reiniciarTopeDeBusquedas();
}
