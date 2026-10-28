/* ============================================================================
    Las reglas del bloque `medicalFacility`, en un solo sitio.

    Las usan la pantalla de alta (para frenar antes de salir a la red), el
    cliente y el simulador (para responder lo mismo que la API). La API sigue
    siendo la autoridad: esto sólo evita mandar lo que ya se sabe que se
    rechaza.
    ========================================================================== */

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

/** Los motivos por los que un bloque `medicalFacility` se rechaza, en el estilo de `class-validator`. */
export function medicalFacilityIssues(
  facility: unknown,
  prefijo = 'organization.medicalFacility',
): string[] {
  const issues: string[] = [];
  if (typeof facility !== 'object' || facility === null) {
    return [`${prefijo} must be an object`];
  }
  const f = facility as Record<string, unknown>;

  const nit = typeof f['taxIdentifierNumber'] === 'string' ? f['taxIdentifierNumber'].trim() : '';
  if (!NIT_PATTERN.test(nit)) {
    issues.push(`${prefijo}.taxIdentifierNumber must match ${NIT_PATTERN} regular expression`);
  }

  const registro =
    typeof f['healthFacilityRegistrationNumber'] === 'string'
      ? f['healthFacilityRegistrationNumber'].trim()
      : '';
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

  const director = f['medicalDirector'];
  if (typeof director !== 'object' || director === null) {
    issues.push(`${prefijo}.medicalDirector must be an object`);
  } else {
    const d = director as Record<string, unknown>;
    const texto = (clave: string): string =>
      typeof d[clave] === 'string' ? (d[clave] as string).trim() : '';
    if (texto('name') === '') issues.push(`${prefijo}.medicalDirector.name should not be empty`);
    if (texto('lastName') === '') {
      issues.push(`${prefijo}.medicalDirector.lastName should not be empty`);
    }
    const matricula = texto('professionalLicenseNumber');
    if (
      matricula.length < PROFESSIONAL_LICENSE_MIN ||
      matricula.length > PROFESSIONAL_LICENSE_MAX
    ) {
      issues.push(
        `${prefijo}.medicalDirector.professionalLicenseNumber must be longer than or equal to ${PROFESSIONAL_LICENSE_MIN} and shorter than or equal to ${PROFESSIONAL_LICENSE_MAX} characters`,
      );
    }
    if (!texto('email').includes('@')) {
      issues.push(`${prefijo}.medicalDirector.email must be an email`);
    }
  }

  issues.push(...siteIssues(f['headquarters'], `${prefijo}.headquarters`));
  const branches = f['branches'];
  if (branches !== undefined) {
    if (!Array.isArray(branches)) {
      issues.push(`${prefijo}.branches must be an array`);
    } else {
      if (branches.length > MAX_MEDICAL_FACILITY_BRANCHES) {
        issues.push(
          `${prefijo}.branches must contain no more than ${MAX_MEDICAL_FACILITY_BRANCHES} elements`,
        );
      }
      branches.forEach((sucursal: unknown, indice: number) => {
        issues.push(...siteIssues(sucursal, `${prefijo}.branches.${indice}`));
      });
    }
  }
  return issues;
}

/** Una casa central o sucursal: nombre, líneas de dirección y coordenadas (ambas o ninguna, en rango). */
function siteIssues(site: unknown, prefijo: string): string[] {
  if (typeof site !== 'object' || site === null) return [`${prefijo} must be an object`];
  const issues: string[] = [];
  const s = site as Record<string, unknown>;
  if (typeof s['name'] !== 'string' || s['name'].trim() === '') {
    issues.push(`${prefijo}.name should not be empty`);
  }
  const lines = s['addressLines'];
  if (!Array.isArray(lines) || lines.length === 0 || lines.some((l) => typeof l !== 'string' || l.trim() === '')) {
    issues.push(`${prefijo}.addressLines should not be empty`);
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
