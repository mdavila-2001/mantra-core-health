/**
 * Los tipos de cuenta que la plataforma da de alta **sin intervención de nadie**.
 *
 * Cerrado a propósito, igual que `NavIconName`: un string libre acabaría en un
 * nombre que no existe y en una tarjeta muda. Y cerrado por otra razón, que es
 * la que importa acá: cada uno tiene una pantalla de alta de verdad detrás
 * (`register-patient`, `register-practitioner`, `register-organization`,
 * `register-laboratory`). Agregar un ícono sin su alta sería prometer una
 * puerta que no abre.
 *
 * `laboratory` entró con el alta del laboratorio de sangre (proceso 4.1 del
 * registro del stakeholder). Es la primera cuyo formulario **todavía no tiene
 * endpoint**: la pantalla existe, se recorre entera y cierra con una solicitud
 * — ver el JSDoc de `RegisterLaboratory`. La puerta abre; lo que hay del otro
 * lado es la maqueta.
 */
export const ACCOUNT_ICON_NAMES = ['patient', 'practitioner', 'insurer', 'laboratory'] as const;

export type AccountIconName = (typeof ACCOUNT_ICON_NAMES)[number];
