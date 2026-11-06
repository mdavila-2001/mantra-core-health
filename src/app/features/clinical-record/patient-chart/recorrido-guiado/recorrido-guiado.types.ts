/* ============================================================================
    Los contratos del recorrido guiado: qué entra (registros de
    `core/data-access/` y cómo leer sus conceptos) y qué sale (pasos con frases
    rastreables). Ver `recorrido-guiado.model.ts` y ADR-0022.
    ========================================================================== */

import type {
  CareEpisode,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { SurgicalCase } from '../../../../core/data-access/procedures/procedures.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';

/* -- Contrato de entrada --------------------------------------------------- */

/** Los registros del expediente que el recorrido sabe contar. Todos opcionales. */
export interface RegistrosDelRecorrido {
  readonly atenciones?: readonly Encounter[];
  readonly citas?: readonly Booking[];
  readonly derivaciones?: readonly Referral[];
  readonly diagnosticos?: readonly Condition[];
  readonly ordenes?: readonly DiagnosticOrder[];
  readonly informes?: readonly DiagnosticReport[];
  readonly recetas?: readonly MedicationRequest[];
  readonly internaciones?: readonly CareEpisode[];
  readonly procedimientos?: readonly SurgicalCase[];
}

/**
 * Cómo se leen los datos que llegan como identificador.
 *
 * `etiqueta` traduce un concepto de terminología a su nombre; devuelve
 * `undefined` si no lo conoce. Lo que parezca un identificador (uuid, código
 * de catálogo) se descarta igual: la narración prefiere «sin nombre
 * disponible» a un uuid.
 */
export interface LectorDelRecorrido {
  readonly etiqueta: (conceptId: string | undefined) => string | undefined;
  /** El código de catálogo de un concepto (`COND_CONFIRMED`…), para la verificación. */
  readonly codigo?: (conceptId: string | undefined) => string | undefined;
  /** El servicio o especialidad de una atención («Medicina general»), si se sabe. */
  readonly servicioDeAtencion?: (atencion: Encounter) => string | undefined;
  /** El nombre de un profesional por su perfil, si se sabe. */
  readonly profesional?: (profileId: string | undefined) => string | undefined;
}

/* -- Contrato de salida ---------------------------------------------------- */

/** Una frase de la narración y los registros de los que sale. */
export interface FraseDelPaso {
  readonly texto: string;
  /** Ids reales de los registros que sostienen la frase. Nunca vacío. */
  readonly fuentes: readonly string[];
  /** `true` si la frase une registros por coincidencia (misma atención), no por un vínculo del contrato. */
  readonly inferida: boolean;
}

export interface PasoDelRecorrido {
  /** Stable across reads: the clinical day (`2026-02-03`, `dia-clinico.ts`) or `sin-fecha`. */
  readonly clave: string;
  readonly fecha: Date | null;
  /** «3 feb 2026», o «Sin fecha». */
  readonly fechaTexto: string;
  readonly titulo: string;
  /** Las frases unidas: lo que se lee y lo que anuncia el lector de pantalla. */
  readonly narracion: string;
  readonly frases: readonly FraseDelPaso[];
  /** Los nodos de la red que este paso trae al frente. */
  readonly enfocar: readonly string[];
  /** Todos los nodos revelados hasta este paso, incluido. */
  readonly revelados: readonly string[];
}
