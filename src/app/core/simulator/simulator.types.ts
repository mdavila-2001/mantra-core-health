/* ============================================================================
    Los tipos que comparten el simulador y la aplicación (O3-4).

    Viven acá, fuera del simulador, para que una pieza de la aplicación pueda
    nombrar la forma de una cuenta de prueba o de un valor generado sin
    importar el simulador. El simulador los reexporta con su nombre de siempre
    (`MockUser` en `mock-session.ts`, `ValorGenerado` y compañía en
    `faker/props.ts`), así que su código no cambia.
    ========================================================================== */

/** Una cuenta de prueba del backend simulado. */
export interface MockUser {
  /** La clave con la que se identifica en el login (correo) y dentro del token. */
  readonly key: string;
  readonly id: string;
  readonly email: string;
  readonly nationalId: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly tenants: readonly string[];
  readonly tenantNames: Readonly<Record<string, string>>;
  /**
   * Roles con ámbito de organización, por tenant: el claim `scopedRoles` que firma
   * la API (un código que figura acá sólo vale en esos tenants; uno que no, es
   * global). El simulador firma exactamente las claves de la API: no hay
   * `ownTenantId`.
   */
  readonly scopedRoles?: Readonly<Record<string, readonly string[]>>;
  readonly patientProfileId?: string;
  readonly practitionerProfileId?: string;
  readonly personId: string;
  /**
   * Clase de cuenta que firmaría la API. Sin valor, el token no trae el claim y
   * la sesión lo deduce (cuentas de paciente, que no pasan por esta lista).
   */
  readonly accountKind?: 'PERSON' | 'ORGANIZATION';
}

/** Una entrada de componente para la que el generador del stock inventa un valor. */
export interface EntradaAGenerar {
  readonly nombre: string;
  readonly tipo: string;
  readonly requerido: boolean;
}

export type ProcedenciaDelValor = 'del-tipo' | 'sin-verificar' | 'por-omision';

export interface ValorGenerado {
  readonly valor: unknown;
  readonly procedencia: ProcedenciaDelValor;
  /** Por qué no es `del-tipo`, en una línea legible. `null` si lo es. */
  readonly motivo: string | null;
}

export interface EntradasGeneradas {
  /** Lo que se le pasa al componente: sin las que quedan por omisión. */
  readonly valores: Record<string, unknown>;
  /** La procedencia de cada entrada, incluidas las que no se pasaron. */
  readonly procedencias: Readonly<Record<string, Omit<ValorGenerado, 'valor'>>>;
  /** Las que se pasaron sin poder verificar el contrato, con su motivo. */
  readonly sinVerificar: readonly { readonly nombre: string; readonly motivo: string }[];
}
