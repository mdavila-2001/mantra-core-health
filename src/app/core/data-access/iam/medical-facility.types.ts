/* ============================================================================
    El bloque `organization.medicalFacility` del alta de una organización médica
    (`POST /iam/auth/register-organization`, tenantType HOSPITAL | CLINIC |
    MEDICAL_OFFICE | NURSING | HEALTH_OTHER).

    Es ADITIVO y opcional en el contrato (compatibilidad con clientes viejos);
    lo obligatorio lo impone el formulario. Con cualquier otro `tenantType` la
    API responde 422. Los tipos y las reglas viven acá, y no en el formulario,
    porque los usan tres: la pantalla, el cliente y el simulador. Un tope que
    cada uno escribe por su cuenta termina valiendo distinto en cada uno.

    Fuente del contrato: `docs/…/CONTRATO-medical-facility.md` (28/10/2026).
    ========================================================================== */

/**
 * El director médico o responsable técnico del establecimiento.
 *
 * No es una cuenta de la plataforma: es un registro de contacto y de
 * responsabilidad, como las gerencias. La norma sanitaria exige uno por
 * establecimiento.
 */
export interface MedicalDirector {
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
  /** La matrícula profesional del director (3 a 50 caracteres). */
  readonly professionalLicenseNumber: string;
  readonly email: string;
  readonly phone?: string;
}

/** Una dirección declarada del establecimiento: la casa central o una sucursal. */
export interface MedicalFacilitySite {
  readonly name: string;
  readonly addressLines: readonly string[];
  /** Ambas coordenadas o ninguna. */
  readonly latitude?: number;
  readonly longitude?: number;
}

/** Lo que identifica al establecimiento de salud como tal, más allá de la empresa. */
export interface MedicalFacility {
  /** El NIT de la empresa (`^[0-9][0-9-]{3,19}$`). */
  readonly taxIdentifierNumber: string;
  /** El número de registro/habilitación ante la autoridad sanitaria (SEDES en Bolivia). */
  readonly healthFacilityRegistrationNumber: string;
  readonly medicalDirector: MedicalDirector;
  /** La casa central. */
  readonly headquarters: MedicalFacilitySite;
  /** Sucursales declaradas; hasta {@link MAX_MEDICAL_FACILITY_BRANCHES}. */
  readonly branches?: readonly MedicalFacilitySite[];
}
