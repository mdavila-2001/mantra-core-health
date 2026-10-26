import {
  MEDICAL_ORGANIZATION_TYPES,
  type MedicalOrganizationType,
} from '../../../core/data-access/iam/medical-center-registration.client';
import type { DynamicEnum } from '../../../core/data-access/system-context/system-context.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/** El campo cuyo catálogo publica la API: `GET /system-context/dynamic-enums?target=…`. */
export const DESTINO_TIPO_DE_ORGANIZACION = 'directory.tenants.tenant_type_concept_id';

/**
 * Cómo se nombra cada tipo en la pantalla.
 *
 * Texto de la interfaz, no del catálogo: el catálogo trae `displayEs`, pero
 * su redacción es la del modelo («Centro de cuidados de enfermería») y no la
 * que pidió el negocio para esta elección. El código es lo que viaja.
 */
export const MEDICAL_ORGANIZATION_TYPE_LABELS: Readonly<Record<MedicalOrganizationType, string>> = {
  HOSPITAL: 'Hospital',
  CLINIC: 'Clínica',
  MEDICAL_OFFICE: 'Consultorio médico',
  NURSING: 'Centro de enfermería',
  HEALTH_OTHER: 'Otra institución de salud',
};

/**
 * Las opciones del tipo de institución, en el orden de
 * `MEDICAL_ORGANIZATION_TYPES`.
 *
 * - **Con catálogo**, sólo los tipos que la API publica en `tenant-type`: una
 *   API que todavía no tiene `CLINIC` no lo ofrece, y nadie elige algo que el
 *   servidor rechazaría con 400.
 * - **Sin catálogo** (falló la lectura o no trae ninguno de los cinco), la
 *   lista tipada entera: la pantalla no se queda sin opciones, y si la API no
 *   aceptara alguno, su 400 llega a la pantalla con su mensaje.
 *
 * @param catalogo - El catálogo leído, o `null` si no se pudo leer.
 * @returns Una opción por tipo, con su rótulo.
 */
export function medicalOrganizationTypeOptions(
  catalogo: DynamicEnum | null,
): readonly SelectOption<MedicalOrganizationType>[] {
  const publicados = new Set(catalogo?.options.map((opcion) => opcion.code) ?? []);
  const disponibles = MEDICAL_ORGANIZATION_TYPES.filter((tipo) => publicados.has(tipo));
  const tipos = disponibles.length === 0 ? MEDICAL_ORGANIZATION_TYPES : disponibles;
  return tipos.map((tipo) => ({ value: tipo, label: MEDICAL_ORGANIZATION_TYPE_LABELS[tipo] }));
}
