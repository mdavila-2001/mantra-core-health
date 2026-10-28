/* ============================================================================
    Las reglas del bloque `medicalFacility`, en un solo sitio.

    Las usan la pantalla de alta (para frenar antes de salir a la red), el
    cliente y el simulador (para responder lo mismo que la API). La API sigue
    siendo la autoridad: esto sólo evita mandar lo que ya se sabe que se
    rechaza.
    ========================================================================== */

import { CORREO_CON_DOMINIO } from './strict-email';

/** El NIT boliviano: dígitos, con o sin guiones, de 4 a 20 caracteres. */
export const NIT_PATTERN = /^[0-9][0-9-]{3,19}$/;

/** El número de registro del establecimiento: letras, dígitos, punto, barra y guion. */
export const HEALTH_FACILITY_REGISTRATION_PATTERN = /^[A-Za-z0-9./-]+$/;
export const HEALTH_FACILITY_REGISTRATION_MIN = 3;
export const HEALTH_FACILITY_REGISTRATION_MAX = 50;

/** La matrícula profesional del director médico. */
export const PROFESSIONAL_LICENSE_MIN = 3;
export const PROFESSIONAL_LICENSE_MAX = 50;

/** Cuántas sucursales admite el alta. */
export const MAX_MEDICAL_FACILITY_BRANCHES = 50;

/** El nombre de la casa central cuando no se declara otro. */
export const DEFAULT_HEADQUARTERS_NAME = 'Casa central';

/** Los topes de texto del contrato (`MedicalDirectorDto`, `MedicalFacilitySiteDto`). */
export const MEDICAL_PERSON_PART_MAX = 100;
export const MEDICAL_SITE_NAME_MAX = 200;
export const MEDICAL_ADDRESS_LINES_MAX = 10;
export const MEDICAL_ADDRESS_LINE_MAX = 500;
export const MEDICAL_EMAIL_MAX = 320;
export const MEDICAL_PHONE_MIN = 7;
export const MEDICAL_PHONE_MAX = 30;

/** Un texto del cuerpo ya recortado, como lo deja el `@Transform` de la API; lo que no es texto es `null`. */
function recortado(valor: unknown): string | null {
  return typeof valor === 'string' ? valor.trim() : null;
}

/**
 * Los motivos por los que un bloque `medicalFacility` se rechaza, en el estilo de `class-validator`.
 *
 * Es la forma del cuerpo (`MedicalFacilityDto` y los suyos): lo que la API responde con un **400**
 * antes de mirar el negocio. Por eso el simulador la evalúa antes que el 422 del tipo de organización.
 */
export function medicalFacilityIssues(
  facility: unknown,
  prefijo = 'organization.medicalFacility',
): string[] {
  const issues: string[] = [];
  if (typeof facility !== 'object' || facility === null) {
    return [`${prefijo} must be an object`];
  }
  const f = facility as Record<string, unknown>;

  const nit = recortado(f['taxIdentifierNumber']) ?? '';
  if (!NIT_PATTERN.test(nit)) {
    issues.push(`${prefijo}.taxIdentifierNumber must match ${NIT_PATTERN} regular expression`);
  }

  const registro = recortado(f['healthFacilityRegistrationNumber']) ?? '';
  if (
    registro.length < HEALTH_FACILITY_REGISTRATION_MIN ||
    registro.length > HEALTH_FACILITY_REGISTRATION_MAX
  ) {
    issues.push(
      `${prefijo}.healthFacilityRegistrationNumber must be longer than or equal to ${HEALTH_FACILITY_REGISTRATION_MIN} and shorter than or equal to ${HEALTH_FACILITY_REGISTRATION_MAX} characters`,
    );
  } else if (!HEALTH_FACILITY_REGISTRATION_PATTERN.test(registro)) {
    issues.push(
      `${prefijo}.healthFacilityRegistrationNumber must match ${HEALTH_FACILITY_REGISTRATION_PATTERN} regular expression`,
    );
  }

  issues.push(...directorIssues(f['medicalDirector'], `${prefijo}.medicalDirector`));

  // La casa central es opcional en el contrato (la API le pone «Casa central» y exige sólo la dirección).
  const central = f['headquarters'];
  if (central !== undefined && central !== null) {
    issues.push(...siteIssues(central, `${prefijo}.headquarters`, true));
  }
  const branches = f['branches'];
  if (branches !== undefined && branches !== null) {
    if (!Array.isArray(branches)) {
      issues.push(`${prefijo}.branches must be an array`);
    } else {
      if (branches.length > MAX_MEDICAL_FACILITY_BRANCHES) {
        issues.push(
          `${prefijo}.branches must contain no more than ${MAX_MEDICAL_FACILITY_BRANCHES} elements`,
        );
      }
      branches.forEach((sucursal: unknown, indice: number) => {
        issues.push(...siteIssues(sucursal, `${prefijo}.branches.${indice}`, false));
      });
    }
  }
  return issues;
}

/** El director médico: nombre en partes (hasta 100 cada una), matrícula, correo y teléfono opcional. */
function directorIssues(director: unknown, prefijo: string): string[] {
  if (typeof director !== 'object' || director === null) return [`${prefijo} must be an object`];
  const d = director as Record<string, unknown>;
  const issues: string[] = [];

  for (const clave of ['name', 'lastName']) {
    const valor = recortado(d[clave]);
    if (valor === null || valor === '') issues.push(`${prefijo}.${clave} should not be empty`);
    else if (valor.length > MEDICAL_PERSON_PART_MAX) {
      issues.push(`${prefijo}.${clave} must be shorter than or equal to ${MEDICAL_PERSON_PART_MAX} characters`);
    }
  }
  for (const clave of ['middleName', 'motherLastName']) {
    if (d[clave] === undefined || d[clave] === null) continue;
    const valor = recortado(d[clave]);
    if (valor === null) issues.push(`${prefijo}.${clave} must be a string`);
    else if (valor.length > MEDICAL_PERSON_PART_MAX) {
      issues.push(`${prefijo}.${clave} must be shorter than or equal to ${MEDICAL_PERSON_PART_MAX} characters`);
    }
  }

  const matricula = recortado(d['professionalLicenseNumber']) ?? '';
  if (matricula.length < PROFESSIONAL_LICENSE_MIN || matricula.length > PROFESSIONAL_LICENSE_MAX) {
    issues.push(
      `${prefijo}.professionalLicenseNumber must be longer than or equal to ${PROFESSIONAL_LICENSE_MIN} and shorter than or equal to ${PROFESSIONAL_LICENSE_MAX} characters`,
    );
  }

  const correo = recortado(d['email']) ?? '';
  if (!CORREO_CON_DOMINIO.test(correo)) issues.push(`${prefijo}.email must be an email`);
  else if (correo.length > MEDICAL_EMAIL_MAX) {
    issues.push(`${prefijo}.email must be shorter than or equal to ${MEDICAL_EMAIL_MAX} characters`);
  }

  if (d['phone'] !== undefined && d['phone'] !== null) {
    const telefono = recortado(d['phone']);
    if (telefono === null) issues.push(`${prefijo}.phone must be a string`);
    else if (telefono.length < MEDICAL_PHONE_MIN || telefono.length > MEDICAL_PHONE_MAX) {
      issues.push(
        `${prefijo}.phone must be longer than or equal to ${MEDICAL_PHONE_MIN} and shorter than or equal to ${MEDICAL_PHONE_MAX} characters`,
      );
    }
  }
  return issues;
}

/**
 * Una casa central o sucursal: nombre (de 1 a 200; en la casa central es opcional),
 * de 1 a 10 líneas de dirección de hasta 500 caracteres, y coordenadas (ambas o ninguna, en rango).
 */
function siteIssues(site: unknown, prefijo: string, nombreOpcional: boolean): string[] {
  if (typeof site !== 'object' || site === null) return [`${prefijo} must be an object`];
  const issues: string[] = [];
  const s = site as Record<string, unknown>;

  if (!(nombreOpcional && (s['name'] === undefined || s['name'] === null))) {
    const nombre = recortado(s['name']);
    if (nombre === null || nombre === '') issues.push(`${prefijo}.name should not be empty`);
    else if (nombre.length > MEDICAL_SITE_NAME_MAX) {
      issues.push(`${prefijo}.name must be shorter than or equal to ${MEDICAL_SITE_NAME_MAX} characters`);
    }
  }

  const lines = s['addressLines'];
  if (!Array.isArray(lines)) {
    issues.push(`${prefijo}.addressLines must be an array`);
  } else {
    if (lines.length === 0) issues.push(`${prefijo}.addressLines must contain at least 1 elements`);
    if (lines.length > MEDICAL_ADDRESS_LINES_MAX) {
      issues.push(`${prefijo}.addressLines must contain no more than ${MEDICAL_ADDRESS_LINES_MAX} elements`);
    }
    for (const linea of lines) {
      const texto = recortado(linea);
      if (texto === null) issues.push(`${prefijo}.each value in addressLines must be a string`);
      else if (texto === '') issues.push(`${prefijo}.each value in addressLines should not be empty`);
      else if (texto.length > MEDICAL_ADDRESS_LINE_MAX) {
        issues.push(
          `${prefijo}.each value in addressLines must be shorter than or equal to ${MEDICAL_ADDRESS_LINE_MAX} characters`,
        );
      }
    }
  }

  const lat = s['latitude'];
  const lng = s['longitude'];
  if (lat !== undefined || lng !== undefined) {
    if (typeof lat !== 'number') {
      issues.push(`${prefijo}.latitude must be a number`);
    } else if (lat < -90 || lat > 90) {
      issues.push(`${prefijo}.latitude must not be greater than 90`);
    }
    if (typeof lng !== 'number') {
      issues.push(`${prefijo}.longitude must be a number`);
    } else if (lng < -180 || lng > 180) {
      issues.push(`${prefijo}.longitude must not be greater than 180`);
    }
  }
  return issues;
}
