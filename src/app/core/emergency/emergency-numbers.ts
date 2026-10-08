/**
 * Los números de emergencia que ofrece el botón de pánico (pedido del propietario, 2026-10-08).
 *
 * ## Sólo números con fuente oficial
 *
 * No se inventa un teléfono de emergencia: un número equivocado acá es peor que no tener botón. Cada
 * entrada cita la página oficial donde se leyó y la fecha. Las fuentes se contradicen entre sí —un
 * mismo «118» aparece como ambulancia en guías de viaje y como subalcaldía en la agenda municipal de
 * Santa Cruz—, así que quedaron sólo las que publica el propio Estado.
 *
 * **No hay una lista verificable de ambulancias privadas** de Santa Cruz: por eso existe la
 * «ambulancia de confianza», que carga la propia persona (ver `trusted-ambulance.store.ts`).
 *
 * Revisar cada año: el 168 se implementa departamento por departamento desde 2018.
 */
export interface NumeroDeEmergencia {
  readonly id: string;
  /** Cómo se lo nombra en el botón. */
  readonly nombre: string;
  /** Lo que se marca, sin espacios. */
  readonly numero: string;
  /** Dónde atiende. */
  readonly alcance: string;
  readonly fuente: string;
  readonly url: string;
}

/** Cuándo se leyeron las fuentes. */
export const NUMEROS_CONSULTADOS_EL = '2026-10-08';

const MINSALUD = 'Ministerio de Salud y Deportes de Bolivia';
const MINSALUD_URL = 'https://www.minsalud.gob.bo/3026-bolivia-presenta-numero-unico-de-emergencias-168-para-todo-el-pais';
const GAM_SCZ = 'Gobierno Autónomo Municipal de Santa Cruz de la Sierra, agenda telefónica';
const GAM_SCZ_URL = 'https://www.gmsantacruz.gob.bo/Agenda-Telefonica/';
const GAM_LPZ = 'Gobierno Autónomo Municipal de La Paz, números de emergencia';
const GAM_LPZ_URL = 'https://lapaz.bo/turismo/emergencia/';

export const NUMEROS_DE_EMERGENCIA: readonly NumeroDeEmergencia[] = [
  {
    id: 'emergencias-168',
    nombre: 'Emergencias de salud y ambulancias',
    numero: '168',
    alcance: 'Bolivia',
    fuente: MINSALUD,
    url: MINSALUD_URL,
  },
  {
    id: 'sisme-santa-cruz',
    nombre: 'SISME, servicios médicos municipales',
    numero: '160',
    alcance: 'Santa Cruz de la Sierra',
    fuente: GAM_SCZ,
    url: GAM_SCZ_URL,
  },
  {
    id: 'emergencia-municipal-santa-cruz',
    nombre: 'Departamento de Emergencia Municipal',
    numero: '800125050',
    alcance: 'Santa Cruz de la Sierra',
    fuente: GAM_SCZ,
    url: GAM_SCZ_URL,
  },
  {
    id: 'sema-la-paz',
    nombre: 'SEMA, ambulancias municipales',
    numero: '167',
    alcance: 'La Paz',
    fuente: GAM_LPZ,
    url: GAM_LPZ_URL,
  },
  {
    id: 'policia',
    nombre: 'Policía, radio patrullas',
    numero: '110',
    alcance: 'Bolivia',
    fuente: GAM_LPZ,
    url: GAM_LPZ_URL,
  },
  {
    id: 'bomberos',
    nombre: 'Bomberos',
    numero: '119',
    alcance: 'Bolivia',
    fuente: GAM_LPZ,
    url: GAM_LPZ_URL,
  },
];

/** El enlace que hace la llamada: sólo dígitos y el «+» inicial. */
export function enlaceDeLlamada(numero: string): string {
  const limpio = numero.trim().replace(/(?!^\+)[^\d]/g, '');
  return `tel:${limpio}`;
}
