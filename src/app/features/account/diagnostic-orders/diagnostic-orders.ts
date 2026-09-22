import { PatientInsuranceSettlement } from '../../../shared/components/molecules/patient-insurance-settlement/patient-insurance-settlement';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import type { PatientSettlementFields } from '../../../core/data-access/insurance/patient-insurance-settlement.types';
import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import type { PatientOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Tope de órdenes que se traen. Nadie arrastra cien pedidos abiertos. */
const TOPE_DE_ORDENES = 50;

/** Una orden ya lista para mostrarse, sin un solo uuid. */
interface OrdenVisible extends PatientSettlementFields {
  readonly id: string;
  /** La atención en que se pidió. Vacío = se pidió fuera de una consulta.
      Nunca llega a la pantalla: agrupa, y el encabezado es la fecha. */
  readonly encounterId: string;
  readonly estudio: string;
  readonly categoria: string;
  readonly estado: string;
  readonly pedida: Date;
  /** Ayunas, horarios, qué llevar. Vacío = nadie publicó preparación. */
  readonly preparacion: string;
  readonly tieneResultado: boolean;
  readonly reportId: string;
  /** Los uuid del catálogo, sólo para reetiquetar cuando llegue. */
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly statusConceptId: string;
}

/**
 * Las órdenes de una misma atención.
 *
 * El carril pide la lista **por atención** y no por fecha suelta: un médico que
 * pide hemograma, orina y placa en la misma consulta generó tres órdenes que
 * para la persona son *un* pedido. Verlas como tres filas sueltas hace pensar
 * que son tres trámites.
 *
 * El título es la **fecha**, no el identificador de la atención: `encounterId`
 * es un uuid y la regla 1 del carril prohíbe que uno llegue a la pantalla. Las
 * órdenes de una misma atención se emiten en la misma transacción, así que
 * comparten fecha.
 */
interface GrupoDeOrdenes {
  /** Clave de agrupación. Es el `encounterId`, o `sueltas` si no hubo. */
  readonly clave: string;
  /** Lo que se lee como encabezado del grupo. */
  readonly titulo: string;
  readonly ordenes: readonly OrdenVisible[];
}

/**
 * Las órdenes de laboratorio e imagen que le dieron a la persona.
 *
 * ## Por qué es una pantalla aparte de «Mis resultados»
 *
 * Porque contestan preguntas distintas en momentos distintos. «Mis resultados»
 * es el pasado: qué me volvió. Ésta es el futuro inmediato: qué me pidieron y
 * qué tengo que hacer para cumplirlo. Mezclarlas obligaría a la persona a leer
 * una lista donde la mitad de las filas no requieren nada de ella.
 *
 * ## Por qué la preparación es lo más visible
 *
 * Porque es lo único de esta pantalla que cambia lo que la persona hace mañana
 * a la mañana. Un hemograma con ayuno de 8 horas que se lee después de
 * desayunar es un viaje perdido al laboratorio. Va en un aviso, no en letra
 * chica.
 *
 * Cuando ningún centro publicó preparación **no se dice nada**: inventar un
 * «no requiere preparación» tranquilizador sería afirmar algo que el catálogo
 * no dice, y en un ayuno esa afirmación tiene consecuencias.
 */
@Component({
  selector: 'app-diagnostic-orders',
  imports: [PatientInsuranceSettlement, Alert, AppButton, Badge, DatePipe, Link, PageHeader, RouterLink],
  templateUrl: './diagnostic-orders.html',
  styleUrl: './diagnostic-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticOrders {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);

  /** Sin perfil de paciente no hay órdenes que leer: la API respondería 412. */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  /** El estado de la lista. */
  protected readonly ordenes = signal<ViewState<readonly OrdenVisible[]>>(loading());

  /** Etiquetas del catálogo, que llegan después de la lista. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** Las órdenes ya listas, para que la plantilla no destipe el estado. */
  protected readonly listas = computed(() => {
    const estado = this.ordenes();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** Las órdenes agrupadas por la atención en que se pidieron. */
  protected readonly grupos = computed<readonly GrupoDeOrdenes[]>(() => {
    const porAtencion = new Map<string, OrdenVisible[]>();
    for (const orden of this.listas()) {
      const clave = orden.encounterId === '' ? 'sueltas' : orden.encounterId;
      const lista = porAtencion.get(clave) ?? [];
      lista.push(orden);
      porAtencion.set(clave, lista);
    }
    return [...porAtencion].map(([clave, ordenes]) => ({
      clave,
      titulo:
        clave === 'sueltas'
          ? 'Pedidas fuera de una consulta'
          : this.tituloDeAtencion(ordenes[0].pedida),
      ordenes,
    }));
  });

  /** El encabezado de un grupo, en lenguaje de paciente y sin identificadores. */
  private tituloDeAtencion(fecha: Date): string {
    const dia = fecha.toLocaleDateString('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `Atención del ${dia}`;
  }

  /** La salida que ofrece el estado vacío (contrato S3 del M34). */
  protected readonly salidaDelVacio = computed(() => {
    const estado = this.ordenes();
    return estado.status === 'empty' ? estado.nextAction : undefined;
  });

  /** El mensaje del vacío, que la plantilla no puede sacar del estado tipada. */
  protected readonly mensajeDeVacio = computed(() => {
    const estado = this.ordenes();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  constructor() {
    if (!this.sinPerfilDePaciente) {
      this.cargar();
    }
  }

  /* ---- lectura ------------------------------------------------------------- */

  protected cargar(): void {
    this.ordenes.set(loading());
    this.diagnostics.getOwnOrders(TOPE_DE_ORDENES).subscribe({
      next: (pagina) => {
        if (pagina.items.length === 0) {
          this.ordenes.set(
            empty(
              // El camino de salida es la consulta, no el laboratorio: sin
              // orden de un médico no hay estudio que reservar, así que mandar
              // a la persona al directorio de laboratorios sería mandarla a una
              // puerta que no puede abrir todavía.
              { label: 'Ver mis turnos', route: '/my-account/appointments' },
              'No tenés órdenes de laboratorio ni de imagen. Cuando un médico te pida un estudio en una consulta, aparece acá con las indicaciones para hacértelo.',
            ),
          );
          return;
        }
        this.traducirConceptos(pagina.items);
        this.ordenes.set(ready(pagina.items.map((item) => this.aVisible(item))));
      },
      error: (error: unknown) => this.ordenes.set(errorToViewState<readonly OrdenVisible[]>(error)),
    });
  }

  /* ---- etiquetas ----------------------------------------------------------- */

  private traducirConceptos(items: readonly PatientOrder[]): void {
    const ids = [
      ...new Set(
        items.flatMap((item) =>
          [item.codeConceptId, item.categoryConceptId, item.statusConceptId].filter(
            (id): id is string => id !== undefined,
          ),
        ),
      ),
    ];
    if (ids.length === 0) {
      return;
    }

    this.terminology
      .readConceptLabels(ids)
      // Si el catálogo no responde, las órdenes igual se muestran con su texto
      // neutro. Perder la etiqueta no justifica perder la lista — y menos la
      // preparación, que no depende del catálogo de conceptos.
      .pipe(catchError(() => of(new Map<string, ValueSetOption>())))
      .subscribe((etiquetas) => {
        this.etiquetas.set(new Map([...this.etiquetas(), ...etiquetas]));
        const estado = this.ordenes();
        if (estado.status === 'ready') {
          this.ordenes.set(ready(estado.data.map((item) => this.reetiquetar(item))));
        }
      });
  }

  private aVisible(item: PatientOrder): OrdenVisible {
    return {
      id: item.id,
      insuranceSettlement: item.insuranceSettlement,
      insuranceSettlementAvailability: item.insuranceSettlementAvailability,
      encounterId: item.encounterId ?? '',
      estudio: this.etiqueta(item.codeConceptId, 'Estudio'),
      categoria: this.etiqueta(item.categoryConceptId ?? '', 'Sin clasificar'),
      estado: this.etiqueta(item.statusConceptId, 'Pendiente'),
      pedida: item.createdAt,
      preparacion: item.preparationInstructions ?? '',
      tieneResultado: item.hasReleasedResult,
      reportId: item.reportId ?? '',
      codeConceptId: item.codeConceptId,
      categoryConceptId: item.categoryConceptId ?? '',
      statusConceptId: item.statusConceptId,
    };
  }

  private reetiquetar(item: OrdenVisible): OrdenVisible {
    return {
      ...item,
      estudio: this.etiqueta(item.codeConceptId, 'Estudio'),
      categoria: this.etiqueta(item.categoryConceptId, 'Sin clasificar'),
      estado: this.etiqueta(item.statusConceptId, 'Pendiente'),
    };
  }

  private etiqueta(conceptId: string, neutro: string): string {
    if (conceptId === '') {
      return neutro;
    }
    const opcion = this.etiquetas().get(conceptId);
    return opcion?.display ?? opcion?.code ?? neutro;
  }
}
