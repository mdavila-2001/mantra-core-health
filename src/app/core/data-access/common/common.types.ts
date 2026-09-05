/** Tipos de la vista para `common`. Se mapean desde los DTOs, no son ellos. */

/**
 * Tipo de propietario polimórfico que acepta hoy `POST /common/addresses`.
 *
 * El backend no tiene un `PRACTITIONER` propio todavía: `common.identifiers`
 * y `common.contact_points` ya guardan los del profesional bajo `PATIENT`
 * —es el mismo `owner_type_concept_id` genérico de «persona», heredado del
 * alta de paciente— y este cliente sigue esa misma convención para no crear
 * una tercera forma de nombrar lo mismo.
 */
export type AddressOwnerType = 'USER' | 'PATIENT' | 'TENANT';

/** Una dirección nueva a registrar para una persona u organización. */
export interface NewAddress {
  readonly ownerType: AddressOwnerType;
  readonly ownerId: string;
  /** Líneas de la dirección (calle, número, referencia). */
  readonly lines: readonly string[];
  readonly city?: string;
  /** Departamento boliviano, miembro de `VS_BO_DEPARTMENT`. */
  readonly administrativeAreaConceptId?: string;
  /** Municipio boliviano, miembro de `VS_BO_MUNICIPALITY`. */
  readonly municipalityConceptId?: string;
  /**
   * Punto de la dirección, si se marcó en el mapa (ALV-006).
   *
   * El backend ya los aceptaba (`CreateAddressDto`); este tipo los omitía y
   * por eso ninguna pantalla podía mandarlos. Van siempre los dos o ninguno.
   */
  readonly latitude?: number;
  readonly longitude?: number;
}

/** La dirección ya registrada. */
export interface RegisteredAddress {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerType: AddressOwnerType;
  readonly lines: readonly string[];
  readonly city?: string;
  readonly administrativeAreaConceptId?: string;
}
