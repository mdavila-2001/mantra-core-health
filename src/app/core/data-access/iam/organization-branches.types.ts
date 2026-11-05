import type { OrganizationExecutives, OrganizationLegalDocuments } from './iam.types';

/**
 * Un turno del horario de atención (`OpeningHoursShiftDto`): día ISO 1 = lunes
 * … 7 = domingo, `HH:MM`, y `24:00` como cierre del día completo.
 */
export interface OpeningHoursShift {
  readonly dayOfWeek: number;
  readonly opensAt: string;
  readonly closesAt: string;
}

/**
 * Una sucursal declarada en el alta pública de farmacia (1.18).
 *
 * Sólo lo que el mapa confirma: una sucursal sin punto no viaja (la del
 * enlace de ubicación cuenta como punto cuando lo trae escrito).
 * `description` y `locationUrl` los suma la carga masiva de sucursales
 * (2026-09-30); la API los guarda en `directory.branches`.
 */
export interface PharmacyBranchRegistration {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly description?: string;
  readonly locationUrl?: string;
  readonly openingHours?: readonly OpeningHoursShift[];
}

/**
 * Alta pública de una farmacia por sí misma (`POST /iam/auth/register-organization`
 * con `tenantType: 'PHARMACY'`).
 *
 * Mismo endpoint que {@link OrganizationRegistration} (la aseguradora): el
 * registro de procesos repite el mismo onboarding de tenant —empresa,
 * papeles, representante legal, gerencias, cuenta de acceso— para farmacia,
 * laboratorio e imagenología (Módulo Farmacia §1). Es una interfaz aparte y
 * no una unión con `OrganizationRegistration` porque el bloque específico del
 * tipo de tenant no coincide: la aseguradora exige `payer` siempre; la
 * farmacia manda su bloque `pharmacy` (`RegisterPharmacyBlockDto`), con las
 * coordenadas de la casa matriz y las sucursales que la persona cargó (P49).
 *
 * A diferencia de la aseguradora, acá **lo obligatorio es lo más básico**
 * (decisión D2 del carril de farmacia): razón social, tipo societario, NIT,
 * dirección legal de la central, nombre y correo del representante, correo de
 * acceso y contraseña. Los seis papeles en PDF, el GPS de la central, las
 * sucursales y las tres gerencias se completan después, desde la Ficha.
 */
export interface PharmacyOrganizationRegistration {
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string;
  /** Tipo societario del diccionario `VS_LEGAL_ENTITY_TYPE`, p. ej. `SRL`. */
  readonly legalEntityType: string;
  /** País y jurisdicción (conceptos): la API los exige a toda organización territorial. */
  readonly countryConceptId: string;
  readonly jurisdictionConceptId: string;
  /** El NIT: viaja como `organization.taxIdentifier` y numera el documento tributario. */
  readonly taxIdentifier: string;
  /** Dirección legal: es la de la casa central (`organization.pharmacy.address`). */
  readonly legalAddress: string;
  /** Coordenadas de la central, ambas o ninguna. Obligatorias para operar, no para registrarse. */
  readonly headquarters?: { readonly latitude: number; readonly longitude: number };
  readonly branches?: readonly PharmacyBranchRegistration[];
  /** Horario de atención de la casa central (`organization.openingHours`). */
  readonly openingHours?: readonly OpeningHoursShift[];
  /**
   * El acceso: mismo correo del representante legal, según decide el molde
   * de esta alta (`RegisterLaboratory`, «Con este correo se entra») — el
   * registro de procesos no pide un correo de acceso distinto del
   * representante. `displayName` es la forma que
   * `RegisterOrganizationOwnerDto` acepta sin partir el nombre en
   * `name`/`lastName` (deprecada pero vigente): partirlo a mano inventaría
   * un apellido que el registro de procesos no pregunta.
   */
  readonly owner: {
    readonly email: string;
    readonly password: string;
    readonly displayName: string;
  };
  /**
   * Nombre completo, cédula y correo del representante legal (1.8, 1.8.2).
   * `powerOfAttorneyFileId` es opcional para registrarse —a diferencia del
   * alta de aseguradora, la API no lo exige a una farmacia (P50)— y
   * obligatorio para operar, salvo en una unipersonal.
   */
  readonly legalRepresentative: {
    readonly fullName: string;
    readonly email: string;
    /** Obligatorio: la API exige el documento del representante (4 a 50 caracteres). */
    readonly idNumber: string;
    readonly powerOfAttorneyFileId?: string;
  };
  readonly legalDocuments?: OrganizationLegalDocuments;
  readonly executives?: OrganizationExecutives;
}

/** Un punto confirmado sobre el mapa: ambas coordenadas o ninguna. */
export interface RegistrationCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Una sucursal declarada en el alta pública de laboratorio (4.1.18): el nombre
 * y la calle, y el punto sólo si se confirmó sobre el mapa.
 */
export interface DiagnosticUnitBranchRegistration {
  readonly name: string;
  readonly addressLines: readonly string[];
  readonly location?: RegistrationCoordinates;
  /**
   * Suma de la carga masiva de sucursales (2026-09-30). La API la guarda en la
   * fila de `directory.branches` de la sucursal (P51, D-4; hasta 1000 caracteres).
   */
  readonly description?: string;
  /** El enlace de mapa tal como lo pegaron; la API sólo acepta `http(s)` (400 si no). */
  readonly locationUrl?: string;
  readonly openingHours?: readonly OpeningHoursShift[];
}

/**
 * Alta pública de un laboratorio de sangre por sí mismo
 * (`POST /iam/auth/register-organization` con `tenantType: 'DIAGNOSTIC_CENTER'`),
 * carril A de la cuenta de laboratorio, 2026-09-30.
 *
 * `DIAGNOSTIC_CENTER` es el código que la API emite para un laboratorio
 * (`TENANT_TYPES` de `mock-session.ts`). A diferencia de la farmacia, el DTO
 * real **sí** tiene bloque propio para este tipo: `diagnosticUnit`
 * (`DiagnosticUnitProfileDto`, con `name`, `primarySite.address` y
 * `branches[]`). Se usa ése y no uno inventado (P51 cerrado el 26/10/2026).
 *
 * Mismo criterio de obligatoriedad que la farmacia (D2): sólo lo básico para
 * nacer. Los seis papeles, el punto de la central, las sucursales y las tres
 * gerencias son opcionales y viajan sólo cuando están completos.
 */
export interface LaboratoryOrganizationRegistration {
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string;
  /** Tipo societario del diccionario `VS_LEGAL_ENTITY_TYPE`, p. ej. `SRL`. */
  readonly legalEntityType: string;
  /** País y jurisdicción (conceptos): la API los exige a toda organización territorial. */
  readonly countryConceptId: string;
  readonly jurisdictionConceptId: string;
  readonly taxIdentifier: string;
  /** La unidad diagnóstica que nace con el alta: la central y, si hay, sus sucursales. */
  readonly diagnosticUnit: {
    readonly name: string;
    /** `DU_TYPE_LAB` y `DU_MODALITY_LAB`, resueltos del catálogo. */
    readonly diagnosticUnitTypeConceptId: string;
    readonly modalityConceptIds: readonly string[];
    readonly primarySite: {
      readonly name: string;
      readonly address: {
        readonly lines: readonly string[];
        readonly latitude?: number;
        readonly longitude?: number;
      };
    };
    readonly branches?: readonly DiagnosticUnitBranchRegistration[];
  };
  /** Horario de atención de la casa central (`organization.openingHours`). */
  readonly openingHours?: readonly OpeningHoursShift[];
  /** Mismo acceso que la farmacia: el correo del representante legal. */
  readonly owner: {
    readonly email: string;
    readonly password: string;
    readonly displayName: string;
  };
  /**
   * Nombre, correo y cédula. El poder es obligatorio salvo para `UNIPERSONAL`:
   * la API responde 422 `powerOfAttorneyFileId` si falta (P51, D-3).
   */
  readonly legalRepresentative: {
    readonly fullName: string;
    readonly email: string;
    /** Obligatorio: la API exige el documento del representante (4 a 50 caracteres). */
    readonly idNumber: string;
    readonly powerOfAttorneyFileId?: string;
  };
  readonly legalDocuments?: OrganizationLegalDocuments;
  readonly executives?: OrganizationExecutives;
}
