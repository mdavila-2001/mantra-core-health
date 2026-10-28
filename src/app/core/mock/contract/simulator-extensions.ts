import { CARE_PLAN_SIMULATOR_EXTENSIONS } from '../../data-access/chart-care-plans/chart-care-plans.types';
import {
  FIELD_DEFINITION_SIMULATOR_EXTENSIONS,
  FIELD_DEFINITION_UPDATE_SIMULATOR_EXTENSIONS,
} from '../../data-access/forms/forms.types';
import {
  PATIENT_SEARCH_SIMULATOR_EXTENSIONS,
  PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS,
} from '../../data-access/profiles/profiles.types';
import { REFERRAL_CONTRACT_PENDING_KEYS } from '../../data-access/referrals/referrals.types';

/* ============================================================================
    Claves que la maqueta acepta aunque el DTO de la API no las declare.

    Cada entrada es una función que la pantalla ofrece y el DTO de la API no
    declara: la maqueta la guarda, y el cliente **no** la manda a la API real
    (`withSimulatorExtensions()` en `core/data-access/simulator-only.ts`). Las
    listas de claves salen del cliente, no se repiten acá: si el cliente deja
    de mandar una, este registro deja de aceptarla.

    Fuera de este registro, toda clave que el contrato no declara es un 400.
    ========================================================================== */

/** `MÉTODO /ruta/:param` (como en `api-contract.generated.ts`) → claves extra. */
export const SIMULATOR_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  // P47 · catálogo de la farmacia: desde 2026-10-26 el DTO de la API declara
  // todas las claves del portal; ya no hay extensión que registrar.
  // Motivo escrito del plan de cuidados (C7).
  'POST /charts/care-plans': CARE_PLAN_SIMULATOR_EXTENSIONS,
  // Preguntas de cuadrícula del constructor (C8).
  'POST /forms/field-definitions': FIELD_DEFINITION_SIMULATOR_EXTENSIONS,
  'PATCH /forms/field-definitions/:id': FIELD_DEFINITION_UPDATE_SIMULATOR_EXTENSIONS,
  // Frecuencia de facturación del perfil profesional (C13).
  'PATCH /profiles/practitioners/me': PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS,
  // Filtros de sangre e idioma, sólo en una rama de la API sin mergear (C14).
  'POST /profiles/patients/search': PATIENT_SEARCH_SIMULATOR_EXTENSIONS,
  // Derivación por servicio concreto (pedido del cliente, 28/10/2026): la API
  // las agrega en la misma entrega y el `openapi.json` todavía no las trae.
  // A diferencia del resto, el cliente SÍ las manda a la API real — ver
  // `REFERRAL_CONTRACT_PENDING_KEYS` —; se borra al regenerar el contrato.
  'POST /referrals': REFERRAL_CONTRACT_PENDING_KEYS,
};
