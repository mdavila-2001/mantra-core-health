import { CARE_PLAN_SIMULATOR_EXTENSIONS } from '../../data-access/chart-care-plans/chart-care-plans.types';
import { CHART_NOTE_SIMULATOR_EXTENSIONS } from '../../data-access/chart-notes/chart-notes.types';
import { BRANCH_SIMULATOR_EXTENSIONS } from '../../data-access/directory/directory.types';
import {
  FIELD_DEFINITION_SIMULATOR_EXTENSIONS,
  FIELD_DEFINITION_UPDATE_SIMULATOR_EXTENSIONS,
} from '../../data-access/forms/forms.types';
import { PHARMACY_PRODUCT_SIMULATOR_EXTENSIONS } from '../../data-access/pharmacy/pharmacy.types';
import {
  PATIENT_SEARCH_SIMULATOR_EXTENSIONS,
  PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS,
} from '../../data-access/profiles/profiles.types';
import { SCHEDULE_TEMPLATE_SIMULATOR_EXTENSIONS } from '../../data-access/scheduling/scheduling.types';

/* ============================================================================
    Claves que la maqueta acepta aunque el DTO de la API no las declare.

    Cada entrada es una función «pendiente de backend» que la pantalla ya
    ofrece: la maqueta la guarda, y el cliente **no** la manda a la API real
    (`withSimulatorExtensions()` en `core/data-access/simulator-only.ts`). Las
    listas de claves salen del cliente, no se repiten acá: si el cliente deja
    de mandar una, este registro deja de aceptarla.

    Fuera de este registro, toda clave que el contrato no declara es un 400.
    ========================================================================== */

/** `MÉTODO /ruta/:param` (como en `api-contract.generated.ts`) → claves extra. */
export const SIMULATOR_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  // P47 · catálogo de la farmacia (informe B, C1 y C2).
  'POST /pharmacies/:pharmacyId/products': PHARMACY_PRODUCT_SIMULATOR_EXTENSIONS,
  'PATCH /pharmacies/:pharmacyId/products/:productId': PHARMACY_PRODUCT_SIMULATOR_EXTENSIONS,
  // P39 · filas campo/valor de la nota médica (C6).
  'POST /charts/notes': CHART_NOTE_SIMULATOR_EXTENSIONS,
  'PUT /charts/notes/:noteId/versions': CHART_NOTE_SIMULATOR_EXTENSIONS,
  // Motivo escrito del plan de cuidados (C7).
  'POST /charts/care-plans': CARE_PLAN_SIMULATOR_EXTENSIONS,
  // Preguntas de opción y de cuadrícula del constructor (C8).
  'POST /forms/field-definitions': FIELD_DEFINITION_SIMULATOR_EXTENSIONS,
  'PATCH /forms/field-definitions/:id': FIELD_DEFINITION_UPDATE_SIMULATOR_EXTENSIONS,
  // P36 · horario flexible (C12).
  'POST /scheduling/resources/:id/templates': SCHEDULE_TEMPLATE_SIMULATOR_EXTENSIONS,
  // Idiomas y frecuencia de facturación del perfil profesional (C13).
  'PATCH /profiles/practitioners/me': PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS,
  // Filtros de sangre e idioma, sólo en una rama de la API sin mergear (C14).
  'POST /profiles/patients/search': PATIENT_SEARCH_SIMULATOR_EXTENSIONS,
  // P54 · descripción y enlace de mapa de la sucursal (C15).
  'POST /tenants/:tenantId/branches': BRANCH_SIMULATOR_EXTENSIONS,
};
