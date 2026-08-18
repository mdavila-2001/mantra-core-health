/**
 * Etiquetas visibles de los roles del token. Texto de la interfaz, no del
 * catálogo: la API guarda el `name` de cada rol en `authz.roles`, pero en el
 * token sólo viaja el código, y un código como `SECURITY_ADMIN` es vocabulario
 * de sistema que la persona no tiene por qué leer.
 *
 * `USER` no está a propósito: es el rol base de toda cuenta y no informa nada.
 */
export const ROLE_LABELS: Readonly<Record<string, string>> = {
  PATIENT: 'Paciente',
  SUPERADMIN: 'Superadministración',
  SECURITY_ADMIN: 'Administración de seguridad',
  CLINICIAN: 'Clínico',
  PRACTITIONER: 'Profesional sanitario',
  SURGEON: 'Cirujano',
  ANESTHESIOLOGIST: 'Anestesiólogo',
  PERIOP_NURSE: 'Enfermería perioperatoria',
  PERIOP_ADMIN: 'Administración perioperatoria',
  SURGERY_SCHEDULER: 'Programación quirúrgica',
  CLINICAL_APPROVER: 'Aprobador clínico',
  CLINICAL_INFORMATICIAN: 'Informático clínico',
  PRINCIPAL_INVESTIGATOR: 'Investigador principal',
  SCHEDULING_ADMIN: 'Administración de agenda',
  SCHEDULING_AGENT: 'Agente de agenda',
  MEDICAL_VISITOR: 'Visitador médico',
  IDENTITY_ADMIN: 'Administración de identidad',
  PLATFORM_ADMIN: 'Administración de plataforma',
  BUSINESS_ADMIN: 'Administración comercial',
  PAYMENTS_ADMIN: 'Administración de pagos',
  PHARMA_LAB_ADMIN: 'Administración de farmacia y laboratorio',
  ACCOUNTING_APPROVER: 'Aprobación contable',
  BILLING: 'Facturación',
  FINANCE: 'Finanzas',
  CASHIER: 'Caja',
};

/**
 * La etiqueta de un rol, o `null` si no tiene.
 *
 * Un código sin entrada se omite en vez de pintarse crudo: mostrar
 * `PERIOP_NURSE` a quien no sabe qué es no le da información, y a un paciente
 * le muestra las tripas del sistema. Un rol que un admin componga en
 * `authz.roles` sin entrada acá no aparece hasta que se agregue.
 */
export function etiquetaDeRol(codigo: string): string | null {
  return Object.hasOwn(ROLE_LABELS, codigo) ? ROLE_LABELS[codigo] : null;
}

/** Un rol del token con su etiqueta visible. */
export interface RolLegible {
  readonly codigo: string;
  readonly etiqueta: string;
}

/**
 * Los roles que tienen etiqueta, con su código: para las insignias que pintan la
 * etiqueta y llevan el código en `data-role`, para quien lo lea por máquina.
 *
 * Sin códigos repetidos, en el orden de entrada: las insignias se rastrean por
 * código, y dos iguales serían dos claves iguales en la misma lista.
 */
export function rolesConEtiqueta(codigos: readonly string[]): readonly RolLegible[] {
  const vistos = new Set<string>();
  const roles: RolLegible[] = [];
  for (const codigo of codigos) {
    const etiqueta = etiquetaDeRol(codigo);
    if (etiqueta !== null && !vistos.has(codigo)) {
      vistos.add(codigo);
      roles.push({ codigo, etiqueta });
    }
  }
  return roles;
}

/** Las etiquetas de una lista de roles: sin las que faltan, sin repetidas, en el orden de entrada. */
export function etiquetasDeRoles(codigos: readonly string[]): readonly string[] {
  return [...new Set(rolesConEtiqueta(codigos).map((rol) => rol.etiqueta))];
}

/** Si la sesión es la de un paciente: es lo que decide qué herramientas no se le ofrecen. */
export function esPaciente(codigos: readonly string[]): boolean {
  return codigos.includes('PATIENT');
}
