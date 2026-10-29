import { conjunto, define } from './concepts';

// El catálogo `tenant-type` con los códigos REALES de la API
// (`directory.tenants.tenant_type_concept_id`): el alta pública de
// organización médica filtra sus opciones por código, y con los `ORG-*` de
// `VS_ORGANIZATION_TYPE` (`concepts.ts`) la maqueta no ofrecía ninguno y caía siempre en la lista de respaldo.
// Ése sigue sirviendo a los fixtures del directorio. Lo carga `misc.handlers.ts`.
conjunto('VS_TENANT_TYPE', 'Tipos de tenant', 'Los códigos de `CreateTenantDto`.');
define('VS_TENANT_TYPE', [
  ['PROVIDER', 'Prestador de salud'],
  ['HOSPITAL', 'Hospital'],
  ['MEDICAL_OFFICE', 'Consultorio médico'],
  ['NURSING', 'Centro de cuidados de enfermería'],
  ['PHARMACY', 'Farmacia'],
  ['UNIVERSITY', 'Universidad'],
  ['PAYER', 'Aseguradora'],
  ['BROKER', 'Corredor de seguros'],
  ['HEALTH_BUSINESS', 'Comercio de salud'],
  ['HEALTH_OTHER', 'Otra institución de salud'],
  ['CLINIC', 'Clínica'],
]);
