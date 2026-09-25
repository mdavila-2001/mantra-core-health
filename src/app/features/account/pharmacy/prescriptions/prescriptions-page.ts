import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';
import { PHARMACY_TESTIDS } from '../pharmacy.testids';

/** Mismo tope que la historia clínica: es la misma lectura del resumen. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** La pantalla que ya ordena una receta entera por precio y distancia. */
const DONDE_COMPRAR_ROUTE = '/my-account/medical-record/where-to-buy';

/** Un medicamento de la receta, ya con su nombre resuelto. */
interface MedicamentoVisible {
  readonly conceptId: string;
  readonly nombre: string;
  readonly indicacion: string;
}

/** Una receta, agrupada por la consulta en la que se prescribió. */
interface RecetaVisible {
  /** El `medicationRequests.id` con el que se abre «Dónde comprar». */
  readonly requestId: string;
  readonly cuando: Date;
  readonly emitida: boolean;
  readonly medicamentos: readonly MedicamentoVisible[];
}

/**
 * **Mis recetas** — elegir cuál comprar (carril 43, H4).
 *
 * ## De dónde salen las recetas
 *
 * Del resumen clínico (`ClinicalClient.getSummary`), con el mismo tope que la
 * historia. **No se inventa ninguna**: lo que no está en el expediente no
 * aparece acá, y no hay forma de cargar una receta externa desde esta pantalla.
 *
 * ## Por qué se agrupan por consulta
 *
 * El contrato devuelve una fila por medicamento, no por receta: tres
 * medicamentos prescritos en la misma consulta son tres `medicationRequests`
 * con el mismo `encounterId`. Lo que la persona recuerda es «la receta que me
 * dieron ese día», así que se agrupa por `encounterId` y la tarjeta enumera sus
 * medicamentos. Una receta sin `encounterId` —el contrato lo declara opcional—
 * es su propia tarjeta: agruparlas todas juntas mezclaría recetas de fechas
 * distintas.
 *
 * ## Qué significa «vigente» acá
 *
 * El mismo criterio que la historia clínica (`medical-record.ts`): se lista lo
 * que el resumen devuelve, sin filtrar por `validTo`. Decidir por cuenta propia
 * que una receta venció sería una regla clínica que el modelo no declara
 * (ambigüedad Q-J4, registrada en el plan). Lo que sí se dice es si está
 * **emitida**: una receta sin emitir todavía no se puede ir a comprar.
 *
 * ## Los nombres vienen de terminología, nunca el uuid
 *
 * `TerminologyClient.readConceptLabels`, igual que `where-to-buy.ts`. Si las
 * etiquetas no llegan, el medicamento sale como «Sin registrar» y la receta se
 * lista igual: perder el nombre no justifica perder la receta.
 */
@Component({
  selector: 'app-prescriptions-page',
  imports: [AppButtonLink, Badge, Card, DatePipe, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './prescriptions-page.html',
  styleUrl: './prescriptions-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionsPage {
  private readonly auth = inject(AuthService);
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);

  private readonly perfil = this.auth.patientProfileId();

  protected readonly sinPerfilDePaciente = this.perfil === null;
  protected readonly testids = PHARMACY_TESTIDS;
  protected readonly rutaDeHistoria = MI_HISTORIA_ROUTE;

  private readonly recetas = signal<ViewState<readonly RecetaVisible[]>>(loading());

  protected readonly estado = this.recetas.asReadonly();

  /** Las filas ya listas: una plantilla no estrecha la unión por `status`. */
  protected readonly filas = computed<readonly RecetaVisible[]>(
    () => dataOf(this.recetas()) ?? [],
  );

  constructor() {
    if (this.perfil === null) {
      // No es un vacío de datos ni un error: la pantalla no le corresponde a
      // esta cuenta, y el aviso lo dice con su propia salida.
      this.recetas.set(ready([]));
      return;
    }
    this.cargar();
  }

  protected cargar(): void {
    const perfil = this.perfil;
    if (perfil === null) {
      return;
    }

    this.recetas.set(loading());
    this.clinical
      .getSummary(perfil, TOPE)
      .pipe(
        switchMap((resumen) =>
          forkJoin({
            filas: of(resumen.medicationRequests),
            // Sin etiquetas la pantalla no puede nombrar nada, pero perderlas
            // tampoco justifica perder la lista: los renglones salen como
            // «Sin registrar».
            etiquetas: this.terminology
              .readConceptLabels(
                resumen.medicationRequests.map((fila) => fila.medicationConceptId),
              )
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
        map((carga) => {
          const recetas = agrupar(carga.filas, carga.etiquetas);
          return recetas.length === 0
            ? empty(
                { label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE },
                'Todavía no tenés recetas registradas. Las que te den tus médicos aparecen acá.',
              )
            : ready(recetas);
        }),
        catchError((error: unknown) => of(errorToViewState<readonly RecetaVisible[]>(error))),
      )
      .subscribe((estado) => this.recetas.set(estado));
  }

  /** «Dónde comprar mi receta», con el id de la receta elegida. */
  protected rutaDeCompra(receta: RecetaVisible): string {
    return `${DONDE_COMPRAR_ROUTE}/${receta.requestId}`;
  }

  protected readonly porId = (receta: RecetaVisible): string => receta.requestId;
}

/**
 * Agrupa las filas del resumen en recetas, por consulta.
 *
 * Exportada porque es pura y es la decisión que el spec tiene que fijar: qué
 * cuenta como «una receta» no se deduce del contrato, que devuelve una fila por
 * medicamento.
 */
export function agrupar(
  filas: readonly MedicationRequest[],
  etiquetas: ConceptLabels,
): readonly RecetaVisible[] {
  const porConsulta = new Map<string, MedicationRequest[]>();
  for (const fila of filas) {
    // Sin `encounterId` la fila es su propia receta: agruparlas todas bajo una
    // clave común juntaría prescripciones de días distintos.
    const clave = fila.encounterId ?? `suelta:${fila.id}`;
    const grupo = porConsulta.get(clave);
    if (grupo === undefined) {
      porConsulta.set(clave, [fila]);
    } else {
      grupo.push(fila);
    }
  }

  return [...porConsulta.values()]
    .map((grupo) => recetaDe(grupo, etiquetas))
    .sort(masRecienteAntes);
}

function recetaDe(
  grupo: readonly MedicationRequest[],
  etiquetas: ConceptLabels,
): RecetaVisible {
  // El id de la receta que abre «Dónde comprar» es el de una fila emitida si
  // hay alguna: es la que efectivamente se puede ir a comprar.
  const representante = grupo.find((fila) => fila.issuedAt !== undefined) ?? grupo[0];
  return {
    requestId: representante.id,
    cuando: representante.createdAt,
    emitida: grupo.some((fila) => fila.issuedAt !== undefined),
    medicamentos: grupo.map((fila) => ({
      conceptId: fila.medicationConceptId,
      nombre: etiquetas.get(fila.medicationConceptId)?.display ?? SIN_DATO,
      indicacion: [fila.doseText, fila.frequencyText].filter(Boolean).join(' · '),
    })),
  };
}

/** La más reciente arriba. `createdAt` es obligatorio en el contrato. */
function masRecienteAntes(a: RecetaVisible, b: RecetaVisible): number {
  return b.cuando.getTime() - a.cuando.getTime();
}
