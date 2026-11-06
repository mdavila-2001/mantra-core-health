/* ============================================================================
    Los tipos de `core/data-access` de F2/F3 **contra el openapi de la API**.

    Sólo tipos: no genera código. `tsc` (`yarn typecheck`) falla si una
    interfaz de la web tiene una clave que el DTO de la API no declara, le
    falta una, o difiere en cuáles son obligatorias. Las claves y las
    obligatorias salen de `infra-f2f3-contract.generated.ts`
    (`scripts/gen-infra-contract.mjs`).

    Las respuestas que la API no tipa en el `openapi.json` (estancia, censo,
    indicadores, compatibilidad con encuentro, revisión de incidente) las fija
    `infra-f2f3-contract.spec.ts` contra la forma de su use case.
    ========================================================================== */

import type { AdmissionRequest, AdtResult, AttendingPractitioner, BedAssignmentRequest, BedCompatibility, CensusAdjustmentRequest, CloseCensusRequest, CompatibilityRuleResult, DischargeRequest, PlacementOverride, ProspectiveCompatibilityRequest, ReviewIncidentRequest, SwapRequest, TransferRequest } from '../../data-access/adt/adt.types';
import type {
  AccessGrant,
  AccessSite,
  AvailabilityRequest,
  AvailabilityResult,
  BedBoard,
  BedBoardCell,
  BedBoardCounts,
  BedBoardUnit,
  BedPathStep,
  BedPatient,
  BlockReason,
  CareSpaceBlock,
  CareSpaceStatusEvent,
  CleaningOrder,
  CleaningOrderPage,
  CreateCleaningOrderRequest,
  HygieneRequest,
  HygieneResult,
  InfrastructureAccess,
  IsolationRequest,
  IsolationResult,
  OperationalState,
  StatusEventPage,
  V2MapRule,
  WithRequestId,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import type { InfraSchemaKeys } from './infra-f2f3-contract.generated';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];
/** `true` sólo si las claves y las obligatorias coinciden con el DTO. */
type Matches<T, S extends keyof InfraSchemaKeys> = Same<keyof T, InfraSchemaKeys[S]['keys']> extends true
  ? Same<RequiredKeys<T>, InfraSchemaKeys[S]['required']>
  : false;
type Ok<T extends true> = T;

/** Cada línea es una aserción: si la forma de la web se aparta del DTO, no compila. */
export type InfraContractTypeChecks = [
  Ok<Matches<InfrastructureAccess, 'InfraAccessMeDto'>>,
  Ok<Matches<AccessSite, 'InfraAccessSiteDto'>>,
  Ok<Matches<AccessGrant, 'InfraAccessGrantDto'>>,
  Ok<Matches<BedBoard, 'BedBoardDto'>>,
  Ok<Matches<BedBoardUnit, 'BedBoardUnitDto'>>,
  Ok<Matches<BedBoardCounts, 'BedBoardCountsDto'>>,
  Ok<Matches<BedBoardCell, 'BedBoardCellDto'>>,
  Ok<Matches<BedPathStep, 'SpacePathItemDto'>>,
  Ok<Matches<BedPatient, 'BedPatientDto'>>,
  Ok<Matches<BedBoardCell['availability'], 'AvailabilityAxisDto'>>,
  Ok<Matches<BedBoardCell['hygiene'], 'HygieneAxisDto'>>,
  Ok<Matches<BedBoardCell['isolation'], 'IsolationAxisDto'>>,
  Ok<Matches<BedBoardCell['occupancy'], 'OccupancyAxisDto'>>,
  Ok<Matches<OperationalState, 'OperationalStateDto'>>,
  Ok<Matches<CareSpaceBlock & WithRequestId, 'CareSpaceBlockDto'>>,
  Ok<Matches<CleaningOrder & WithRequestId, 'CleaningOrderDto'>>,
  Ok<Matches<CleaningOrderPage, 'CleaningOrderListDto'>>,
  Ok<Matches<CareSpaceStatusEvent, 'StatusEventDto'>>,
  Ok<Matches<StatusEventPage, 'StatusEventListDto'>>,
  Ok<Matches<AvailabilityRequest, 'AvailabilityChangeDto'>>,
  Ok<Matches<AvailabilityResult, 'AvailabilityResultDto'>>,
  Ok<Matches<HygieneRequest, 'HygieneActionDto'>>,
  Ok<Matches<HygieneResult, 'HygieneResultDto'>>,
  Ok<Matches<IsolationRequest, 'IsolationChangeDto'>>,
  Ok<Matches<IsolationResult, 'IsolationResultDto'>>,
  Ok<Matches<CreateCleaningOrderRequest, 'CreateCleaningOrderDto'>>,
  Ok<Matches<ProspectiveCompatibilityRequest, 'ProspectiveCompatibilityDto'>>,
  Ok<Matches<BedCompatibility, 'CompatibilityResultDto'>>,
  Ok<Matches<CompatibilityRuleResult, 'CompatibilityRuleDto'>>,
  Ok<Matches<AdmissionRequest, 'CreateAdmissionDto'>>,
  Ok<Matches<PlacementOverride, 'PlacementOverrideDto'>>,
  Ok<Matches<BedAssignmentRequest, 'BedAssignmentDto'>>,
  Ok<Matches<TransferRequest, 'TransferDto'>>,
  Ok<Matches<SwapRequest, 'BedSwapDto'>>,
  Ok<Matches<DischargeRequest, 'DischargeDto'>>,
  Ok<Matches<AdtResult, 'AdtResultDto'>>,
  Ok<Matches<AttendingPractitioner, 'AttendingPractitionerDto'>>,
  Ok<Matches<ReviewIncidentRequest, 'ReviewIncidentDto'>>,
  Ok<Matches<CloseCensusRequest, 'CloseCensusDto'>>,
  Ok<Matches<CensusAdjustmentRequest, 'CensusAdjustmentDto'>>,
  Ok<Matches<BlockReason, 'BlockReasonConceptDto'>>,
  Ok<Matches<V2MapRule, 'V2MapRuleDto'>>,
];
