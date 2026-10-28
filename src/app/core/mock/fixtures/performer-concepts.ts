import { conjunto, define, record } from './concepts';
import { uuid } from '../mock-store';

/* ============================================================================
    Conceptos de «Centros médicos» para el doble: el modo del ejecutor de la
    orden y los procedimientos de ejemplo.

    Van en un archivo propio y no en `concepts.ts` porque ése ya está por encima
    de su techo de líneas.
    ========================================================================== */

/* El modo del ejecutor que elige el médico. Son tres conceptos y el front los
   reconoce por su código (`SR_PERF_*`), nunca por su uuid ni por su texto. */
conjunto(
  'service-request-performer-selection',
  'Modo del ejecutor de la orden',
  'Quién hace el procedimiento que pidió el médico: él mismo, un centro o lo que elija el paciente.',
);
export const PERFORMER_MODE = define('service-request-performer-selection', [
  ['SR_PERF_SELF', 'El médico lo hace él mismo'],
  ['SR_PERF_ORGANIZATION', 'En un centro que sugiere el médico'],
  ['SR_PERF_PATIENT_CHOICE', 'Lo elige el paciente'],
]);

/*
 * Procedimientos de ejemplo. Llevan el id que todos los módulos derivan con
 * `uuid('<semilla>')`, no el de `define`, para que la orden, el centro y la
 * búsqueda hablen del mismo concepto.
 */
conjunto('VS_BO_MEDICAL_PROCEDURE', 'Nomenclador de procedimientos médicos', 'Procedimientos del nomenclador boliviano.');
[
  ['proc-endoscopia-alta', 'Endoscopia digestiva alta'],
  ['proc-colonoscopia', 'Colonoscopia'],
].forEach(([code, display], index) => {
  record.set(code!, {
    id: uuid(code!),
    code: code!,
    display: display!,
    valueSets: ['VS_BO_MEDICAL_PROCEDURE'],
    selectable: true,
    ordinal: index + 1,
  });
});
