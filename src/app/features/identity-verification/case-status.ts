import { inject, Injectable, signal } from '@angular/core';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { StatusSealVariant } from '../../shared/components/organisms/status-seal/status-seal.types';

/** Cómo se muestra el estado de un caso: variante del sello + el estado en palabras. */
export interface CaseStatusPresentation {
  readonly variant: StatusSealVariant;
  readonly label: string;
}

/**
 * Prefijo de los códigos de estado de caso en el catálogo. Es lo que se busca
 * para traerlos todos de una vez, y lo que los agrupa: son los nueve estados de
 * `identity_assurance` y ningún otro concepto empieza así.
 */
const PREFIJO_DE_CODIGO = 'identity_assurance:CASE_';

/**
 * Cómo se ve cada estado, por **código de catálogo**.
 *
 * ## Por qué el código y no el identificador
 *
 * Antes esto era un mapa de nueve UUID escritos a mano. Funcionaba —los
 * identificadores son UUIDv5 deterministas— pero decía dos mentiras: que la
 * interfaz conoce los identificadores del catálogo, y que ese conocimiento no
 * caduca. Un estado nuevo o un cambio de terminología se manifestaban como
 * «Desconocido» en pantalla, sin que nadie se enterara. El código es la
 * identidad semántica del concepto; el UUID es lo que se deriva de ella.
 *
 * ## Por qué la etiqueta sigue viviendo acá
 *
 * El catálogo trae su `display` en inglés —«Case verified»— porque es
 * terminología técnica, no copy de producto. Lo que ve el titular de un trámite
 * es una decisión de la interfaz, y estas nueve frases son esa decisión.
 */
const PRESENTACION_POR_CODIGO: Readonly<Record<string, CaseStatusPresentation>> =
  Object.freeze({
    CASE_OPEN: { variant: 'pending', label: 'Pendiente' },
    CASE_IN_VERIFICATION: { variant: 'in-review', label: 'En revisión' },
    // A la persona verificada no se le revela la marca de riesgo: para ella el
    // caso sigue «en revisión».
    CASE_AT_RISK: { variant: 'in-review', label: 'En revisión' },
    CASE_MANUAL_REVIEW: { variant: 'in-review', label: 'En revisión' },
    CASE_VERIFIED: { variant: 'approved', label: 'Aprobado' },
    CASE_ASSERTED: { variant: 'approved', label: 'Aprobado' },
    CASE_REJECTED: { variant: 'rejected', label: 'Rechazado' },
    CASE_REVOKED: { variant: 'rejected', label: 'Revocado' },
    CASE_EXPIRED: { variant: 'expired', label: 'Vencido' },
  });

const UNKNOWN_PRESENTATION: CaseStatusPresentation = Object.freeze({
  variant: 'unknown',
  label: 'Desconocido',
});

/**
 * El catálogo resuelto: identificador de concepto → cómo se muestra.
 *
 * Es una señal de módulo y no del servicio a propósito. Uno de los consumidores
 * —el armado de filas de `verification-cases`— es una función pura fuera de la
 * inyección de dependencias, así que `toCaseStatusPresentation` tiene que poder
 * llamarse sin inyector. Al leer una señal, todo `computed` y toda expresión de
 * plantilla que la llame vuelve a evaluarse sola cuando el catálogo llega: las
 * pantallas se actualizan sin que ninguna se entere de que hubo una carga.
 *
 * Que sea estado compartido del módulo es correcto acá: el catálogo de
 * terminología es público e idéntico para todo el mundo, así que compartirlo
 * entre peticiones durante el render del servidor no filtra nada de nadie.
 */
const catalogo = signal<ReadonlyMap<string, CaseStatusPresentation>>(new Map());

/**
 * Vacía el catálogo. **Sólo para pruebas.**
 *
 * Ser estado de módulo es lo correcto en producción —el catálogo es público e
 * idéntico para todos— pero en pruebas tiene un costo: sobrevive entre specs
 * del mismo grafo de módulos, así que un archivo que lo resuelve deja el
 * siguiente con el catálogo ya lleno. Eso hace que una prueba sobre «cuántas
 * veces se pide» dependa del orden en que corrieron los archivos, que es
 * exactamente el tipo de fragilidad que nadie quiere depurar a las tres de la
 * mañana.
 *
 * Con esto, quien afirme algo sobre la carga arranca de un estado conocido.
 */
export function resetCaseStatusCatalog(): void {
  catalogo.set(new Map());
}

/**
 * Cómo mostrar el estado de un caso.
 *
 * Jamás lanza ni devuelve null: un estado que el catálogo todavía no resolvió
 * —o que esta versión de la interfaz no sabe pintar— se muestra en neutro, no
 * rompe la pantalla del titular.
 *
 * @param statusConceptId - El estado tal como lo emite el backend.
 * @returns La variante del sello y el estado en palabras.
 */
export function toCaseStatusPresentation(
  statusConceptId: string | null | undefined,
): CaseStatusPresentation {
  if (statusConceptId === null || statusConceptId === undefined) {
    return UNKNOWN_PRESENTATION;
  }
  return catalogo().get(statusConceptId) ?? UNKNOWN_PRESENTATION;
}

/**
 * Resuelve los estados de caso contra terminología, una vez por sesión de la
 * aplicación.
 *
 * Lo inyecta cada pantalla que muestra un estado de caso. No expone métodos: su
 * trabajo es llenar el catálogo que lee `toCaseStatusPresentation`, y depender
 * de él es declarar «esta pantalla necesita los estados resueltos».
 *
 * Un fallo se traga: sin catálogo los estados se ven en neutro, que es
 * exactamente lo que pasaba antes de que existiera esta resolución. Perder la
 * etiqueta no justifica perder la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class CaseStatusCatalog {
  private readonly terminology = inject(TerminologyClient);

  /** Evita que ocho pantallas disparen ocho veces la misma búsqueda. */
  private pedido = false;

  constructor() {
    this.resolver();
  }

  private resolver(): void {
    if (this.pedido || catalogo().size > 0) {
      return;
    }
    this.pedido = true;

    this.terminology
      .searchConcepts({ query: PREFIJO_DE_CODIGO, limit: 50 })
      .subscribe({
        next: (pagina) => {
          const resuelto = new Map<string, CaseStatusPresentation>();
          for (const concepto of pagina.items) {
            const sufijo = concepto.code.startsWith(PREFIJO_DE_CODIGO)
              ? concepto.code.slice('identity_assurance:'.length)
              : concepto.code;
            const presentacion = PRESENTACION_POR_CODIGO[sufijo];
            if (presentacion !== undefined) {
              resuelto.set(concepto.conceptId, presentacion);
            }
          }
          if (resuelto.size > 0) {
            catalogo.set(resuelto);
          }
        },
        // Sin catálogo, neutro. Se reintenta en el próximo arranque.
        error: () => {
          this.pedido = false;
        },
      });
  }
}
