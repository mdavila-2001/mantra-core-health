/* ============================================================================
    Las rutas de la sección de pacientes, en un solo lugar.

    Están acá y no sueltas en cada plantilla porque son **cuatro pantallas que
    se enlazan entre sí** —el listado ofrece el alta, el alta vuelve al listado,
    la ficha cuelga de una fila— y una ruta escrita a mano en un `routerLink` es
    exactamente el enlace que sobrevive a un renombre y deja de funcionar.

    La sección padre la declara `core/navigation/navigation.map.ts`; estas son
    sus pantallas hijas, que no son entradas de menú.
    ========================================================================== */

/** Listado de pacientes (V05-01·L). Coincide con la sección del menú. */
export const PATIENTS_ROUTE = '/administracion/pacientes';

/** Alta de persona y perfil de paciente (V05-01·F). */
export const PATIENT_NEW_ROUTE = `${PATIENTS_ROUTE}/nuevo`;

/**
 * Alta asistida (`iam`), que ya existía como pantalla de la sección.
 *
 * Se mueve acá desde la raíz de la sección para dejarle el lugar al listado,
 * que es lo que el vault declara como pantalla principal de V05-01. La ruta
 * cambia; la pantalla no.
 */
export const PATIENT_ASSISTED_ROUTE = `${PATIENTS_ROUTE}/alta-asistida`;

/** Ficha de filiación F-01 (UC-05-14) de un paciente concreto. */
export function patientDetailRoute(profileId: string): string {
  return `${PATIENTS_ROUTE}/${profileId}`;
}
