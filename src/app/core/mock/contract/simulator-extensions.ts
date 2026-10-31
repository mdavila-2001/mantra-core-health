import { CARE_PLAN_SIMULATOR_EXTENSIONS } from '../../data-access/chart-care-plans/chart-care-plans.types';
import {
  FIELD_DEFINITION_SIMULATOR_EXTENSIONS,
  FIELD_DEFINITION_UPDATE_SIMULATOR_EXTENSIONS,
} from '../../data-access/forms/forms.types';
import {
  PATIENT_SEARCH_SIMULATOR_EXTENSIONS,
  PRACTITIONER_PROFILE_SIMULATOR_EXTENSIONS,
} from '../../data-access/profiles/profiles.types';
import { INFORMED_CONSENT_CONTRACT_PENDING_KEYS } from '../../data-access/informed-consents/informed-consents.types';
import {
  REFERRAL_CONTRACT_PENDING_KEYS,
  REFERRAL_RESPOND_CONTRACT_PENDING_KEYS,
} from '../../data-access/referrals/referrals.types';
import {
  CHAT_AUTO_REPLY_SIMULATOR_EXTENSIONS,
  DIRECT_MESSAGE_CONTRACT_PENDING_KEYS,
} from '../../data-access/community/community.types';
import { EQUIPMENT_LOCATION_CONTRACT_PENDING_KEYS } from '../../data-access/diagnostic-units/equipment-location.types';
import { INVENTORY_LOCATION_CONTRACT_PENDING_KEYS } from '../../data-access/pharmacy/inventory-locations.types';

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
  'PATCH /referrals/:id/respond': REFERRAL_RESPOND_CONTRACT_PENDING_KEYS,
  // Consentimiento informado DIRIGIDO (v4266): mismo caso que el de arriba.
  'POST /consent/treatment-informed-consents': INFORMED_CONSENT_CONTRACT_PENDING_KEYS,
  // Respuesta automática redactada por la IA: falta la columna del modo en el modelo.
  'PUT /community/profiles/:profileId/auto-reply': CHAT_AUTO_REPLY_SIMULATOR_EXTENSIONS,
  // Personal de apoyo que responde en nombre del doctor (ronda «personal de
  // apoyo»): la API lo acepta, el `openapi.json` aún no lo trae. El cliente SÍ
  // lo manda a la API real; se borra al regenerar el contrato.
  'POST /community/conversations/:conversationId/messages': DIRECT_MESSAGE_CONTRACT_PENDING_KEYS,
  // Infraestructura hospitalaria F5a/F5c (`CONTRATO-F2-F5.md`): sala, AE Title
  // y botiquín por unidad. El cliente SÍ las manda; se borran al regenerar.
  'PATCH /diagnostic-equipment/:id': EQUIPMENT_LOCATION_CONTRACT_PENDING_KEYS,
  'POST /pharmacy/:siteId/inventory-locations': INVENTORY_LOCATION_CONTRACT_PENDING_KEYS,
};
