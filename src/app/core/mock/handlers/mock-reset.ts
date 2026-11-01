import { ajustesDeAgenda, bitacora, delegados, permisos, vinculos } from '../fixtures/support-hospital';
import { reiniciarGobierno } from '../fixtures/support-hospital-governance';
import { registrarLaOtraSecretaria, reiniciarLaBandeja } from '../fixtures/support-hospital-inbox';
import { reiniciarTablasDeAdt } from './adt.handlers';
import { reiniciarTablasDeInfraestructura } from './infrastructure.handlers';
import { reiniciarTablasDeOperacion } from './infrastructure-ops.handlers';
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
 * casos de ciclo de vida, pasos extra y simulaciones, **y** los vínculos, permisos y delegaciones del piloto (que el gobierno cambia al
 * dar de baja, suspender o mover). Solo lo usan las pruebas, por lo mismo que la función de arriba.
 */
export function reiniciarElGobiernoDeAccesos(): void {
  reiniciarGobierno();
  vinculos.reiniciar();
  permisos.reiniciar();
  // Las delegaciones («responder en nombre de») también las revoca el gobierno al dar de baja o mover: sin volverlas a la
  // semilla, una secretaria con vínculo y permiso de fábrica seguía sin poder atender al doctor.
  delegados.reiniciar();
  // Mariela no está en la semilla de `vinculos` ni de `permisos`: la registra el módulo de la bandeja al cargarse.
  registrarLaOtraSecretaria();
  olvidarPasosExtra();
  olvidarSimulaciones();
  olvidarLotesDeNormalizacion();
  // El tope de búsquedas por persona es memoria pura (no tiene filas de fábrica): se vacía. Las tablas de la bandeja (asignaciones, notas,
  // autorías…) reciben filas de los módulos de chat al cargarse: reiniciarlas las dejaría sin ellas, así que NO se tocan acá.
  reiniciarTopeDeBusquedas();
}

/**
 * Deja la **bandeja compartida** del piloto (conversaciones de semilla, mensajes, asignaciones, autorías y notas) como la trae
 * de fábrica. Solo lo usan las pruebas, por lo mismo que las de arriba: una conversación que otro archivo del mismo worker
 * tomó, resolvió o respondió llegaba así al siguiente.
 */
export function reiniciarLaBandejaDeApoyo(): void {
  reiniciarLaBandeja();
}

/**
 * Deja la **bitácora** del personal de apoyo con sus asientos de fábrica. Solo lo usan las pruebas: los asientos que
 * escribía otro archivo del mismo worker cambiaban la cuenta y la paginación del siguiente.
 */
export function reiniciarLaBitacoraDeApoyo(): void {
  bitacora.reiniciar();
}

/**
 * Deja la **infraestructura** del simulador (sitios, espacios, unidades, licencias, historial), su **operación** (estados
 * operativos, bloqueos, órdenes de limpieza, eventos, asignaciones por sitio) y la **internación** (encuentros, ubicaciones,
 * censo) como las trae de fábrica. Solo lo usan las pruebas: una cama que otro archivo del mismo worker dejó sucia, ocupada o
 * en mantenimiento cambiaba los recuentos del tablero del siguiente.
 */
export function reiniciarLaInfraestructuraDelSimulador(): void {
  reiniciarTablasDeInfraestructura();
  reiniciarTablasDeOperacion();
  reiniciarTablasDeAdt();
}
