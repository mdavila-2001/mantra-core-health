/**
 * Grupos de primer nivel del menú. Son **dominios funcionales**, no pantallas.
 *
 * El orden del array es el orden en que se dibujan: lo que se usa todos los
 * días arriba, lo administrativo después, lo propio al final. `Mi cuenta` va
 * último y separado porque el vault lo exige explícitamente — mezclar «mis
 * datos» con «los datos que administro» es lo que hace que alguien edite el
 * registro equivocado.
 */
export const NAV_GROUPS = [
  'General',
  'Atención',
  'Administración',
  'Facturación',
  // 17/10/2026 · la plataforma misma —cuánto se usa, qué datos guarda y por qué,
  // qué flujos existen y cómo se prueban—. Antes vivía como bloque «Plataforma»
  // dentro de «Administración»; pedido del propietario: un dominio propio. Va
  // antes de «Mi cuenta», que sigue siendo el último.
  'Superadministración',
  'Mi cuenta',
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];
