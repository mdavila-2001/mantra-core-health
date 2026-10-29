/* ============================================================================
    Con qué sombrero se arma el menú lateral.

    El menú lateral de quien trabaja en una organización (administración,
    enfermería, agenda, facturación, quien atiende…) no ofrece el autoservicio
    del paciente —«Mis citas», «Mi historia clínica», «Mis resultados», «Mis
    órdenes»…—: no son herramientas de su trabajo y le ensucian la barra. Y el
    paciente sigue viendo lo suyo.

    Queda el caso de la persona que es **las dos cosas** (un médico que también
    es paciente de su propia clínica). Decisión de producto (29/10/2026,
    corrección 1 del cliente):

    - **Conmutador de contexto en el menú de la cuenta**, no ítems mezclados. La
      persona tiene dos contextos, «Trabajo» y «Mi salud», y el menú lateral
      muestra los de uno solo. Empieza en «Trabajo» (el menú del rol laboral
      queda limpio) y recuerda lo que eligió en este navegador.
    - En «Mi salud» el menú es **el de un paciente**: se arma con los roles
      `USER` y `PATIENT` y nada más, así que ningún ítem laboral ni el comodín
      de `SUPERADMIN` se cuela.
    - Es sólo **qué se ofrece**. La puerta (`seccionRolesGuard`) sigue mirando
      los roles reales, y la autoridad sigue siendo la API.

    Límite que se declara: el token no trae la membresía de la organización
    (dueño, administrador, personal) —`tenant_memberships` no viaja—, así que
    «personal laboral» se deduce de los roles del token. Quien es paciente y
    sólo administra por membresía, sin ningún rol laboral en el token, se ve
    como paciente.
    ========================================================================== */

/** Contextos del menú de una persona que es paciente y personal a la vez. */
export type ContextoDelMenu = 'TRABAJO' | 'PACIENTE';

/** Roles base de toda cuenta: no dicen a qué se dedica quien entra. */
const ROLES_BASE: readonly string[] = ['USER', 'PATIENT'];

/** Dónde recuerda el navegador el contexto elegido (sólo comodidad, nunca permiso). */
export const CLAVE_CONTEXTO_DEL_MENU = 'alovida.menu.contexto';

/** Los roles de la sesión que no son los base: es personal laboral, de cualquier clase. */
export function rolesLaborales(roles: readonly string[]): readonly string[] {
  return roles.filter((rol) => !ROLES_BASE.includes(rol));
}

/** La sesión es de un paciente. */
export function esPaciente(roles: readonly string[]): boolean {
  return roles.includes('PATIENT');
}

/** La sesión es de personal laboral (plataforma, organización, quien atiende…). */
export function esPersonalLaboral(roles: readonly string[]): boolean {
  return rolesLaborales(roles).length > 0;
}

/** Es paciente **y** personal: la única sesión a la que se le ofrece conmutar. */
export function tieneDosContextos(roles: readonly string[]): boolean {
  return esPaciente(roles) && esPersonalLaboral(roles);
}

/**
 * Los roles con los que se arma el menú lateral.
 *
 * - Sin dos contextos: los de la sesión, tal cual (un paciente ve lo del
 *   paciente; el personal, lo suyo; las exigencias de `audiencia` hacen el resto).
 * - Con dos contextos: en «Trabajo», los roles sin `PATIENT`; en «Mi salud»,
 *   sólo los base que la sesión tiene.
 */
export function rolesDelMenu(
  roles: readonly string[],
  contexto: ContextoDelMenu,
): readonly string[] {
  if (!tieneDosContextos(roles)) {
    return roles;
  }
  return contexto === 'PACIENTE'
    ? roles.filter((rol) => ROLES_BASE.includes(rol))
    : roles.filter((rol) => rol !== 'PATIENT');
}

/** El contexto guardado, o `TRABAJO`: el menú del rol laboral es el que queda limpio. */
export function leerContextoGuardado(): ContextoDelMenu {
  try {
    return globalThis.localStorage?.getItem(CLAVE_CONTEXTO_DEL_MENU) === 'PACIENTE'
      ? 'PACIENTE'
      : 'TRABAJO';
  } catch {
    return 'TRABAJO';
  }
}

/** Recuerda el contexto; si el navegador no deja guardar, la elección vale igual en esta pestaña. */
export function guardarContexto(contexto: ContextoDelMenu): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_CONTEXTO_DEL_MENU, contexto);
  } catch {
    /* sin almacenamiento: la elección vive sólo en memoria */
  }
}
