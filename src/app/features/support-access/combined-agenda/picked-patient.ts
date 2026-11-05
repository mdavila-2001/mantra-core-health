import type { PatientRepresentative, SupportPatientMatch } from '../../../core/data-access/support-access/support-patients.types';

/*
 * Vive aparte de `patient-finder.ts` para que `patient-register.ts` —que el
 * buscador monta— no tenga que importar del buscador: eso era un ciclo que
 * `check-architecture` rechaza. `patient-finder.ts` lo reexporta.
 */

/** El paciente elegido y, si es menor, quién actúa por él. */
export interface PickedPatient {
  readonly patient: SupportPatientMatch;
  readonly representative: PatientRepresentative | null;
  /**
   * Solo si se lo acaba de **registrar** en el mostrador: la identidad nace sin verificar y, con
   * un menor, el representante queda anotado como contacto pendiente de verificación (no como
   * representante legal). Quien lo eligió de una búsqueda no trae esto.
   */
  readonly registration?: {
    readonly identityVerified: false;
    readonly guardianPending: boolean;
  };
}
