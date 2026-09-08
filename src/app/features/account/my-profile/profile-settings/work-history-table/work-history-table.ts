import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../../core/auth/auth.service';
import { ProfilesClient } from '../../../../../core/data-access/profiles/profiles.client';
import type {
  NewPractitionerAffiliation,
  PractitionerAffiliation,
  UpdatePractitionerAffiliation,
} from '../../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { HistoricalRecordsTable } from '../../../../../shared/components/organisms/historical-records-table/historical-records-table';
import type {
  HistoricalColumn,
  HistoricalRecordPersistence,
} from '../../../../../shared/components/organisms/historical-records-table/historical-records-table.types';

/**
 * Una afiliación laboral como fila de la tabla: sólo texto por celda, con las
 * fechas en ISO `YYYY-MM-DD` —lo que `NewPractitionerAffiliation` espera— y
 * no como `Date`, que la tabla pintaría cruda.
 */
export interface WorkHistoryRow {
  readonly id: string;
  readonly organizationName: string;
  readonly roleTitle: string;
  readonly departmentText: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly [key: string]: string | number | null | undefined;
}

/** Las columnas son también los campos del modal: la tabla y el formulario van a la par. */
export const WORK_HISTORY_COLUMNS: readonly HistoricalColumn[] = [
  { key: 'organizationName', header: 'Institución', type: 'text', required: true },
  { key: 'roleTitle', header: 'Cargo', type: 'text', required: true },
  { key: 'departmentText', header: 'Área', type: 'text' },
  { key: 'startDate', header: 'Desde', type: 'date', required: true },
  { key: 'endDate', header: 'Hasta', type: 'date' },
];

/**
 * El historial laboral del profesional como tabla editable, dentro de
 * «Configurar mi perfil».
 *
 * - Lectura y **alta reales**: `listAffiliations` / `addAffiliation`.
 * - Edición y baja reales: `updateAffiliation` / `removeAffiliation`
 *   (`PATCH`/`DELETE …/affiliations/:id`, carril backend-affiliation-crud).
 *
 * `409` (mismo vínculo ya cargado) y `422` (período invertido) son cosas que
 * corregir en el formulario, no fallos: se devuelven como mensaje para que la
 * tabla los muestre en el toast de error.
 */
@Component({
  selector: 'app-work-history-table',
  imports: [Alert, HistoricalRecordsTable],
  templateUrl: './work-history-table.html',
  styleUrl: './work-history-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkHistoryTable {
  private readonly profiles = inject(ProfilesClient);
  private readonly auth = inject(AuthService);

  protected readonly columnas = WORK_HISTORY_COLUMNS;
  protected readonly filas = signal<readonly WorkHistoryRow[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly esProfesional = computed(() => this.auth.practitionerProfileId() !== null);

  protected readonly persistencia: HistoricalRecordPersistence<WorkHistoryRow> = {
    create: (borrador) => this.crear(borrador),
    update: (fila) => this.corregir(fila),
    remove: (fila) => this.borrar(fila),
  };

  constructor() {
    if (this.esProfesional()) {
      this.cargar();
    } else {
      this.cargando.set(false);
    }
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.profiles.listAffiliations().subscribe({
      next: (pagina) => {
        this.filas.set(pagina.items.map(comoFila));
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        const estado = errorToViewState<null>(error);
        this.error.set(
          estado.status === 'error' || estado.status === 'forbidden'
            ? (estado.message ?? 'No pudimos cargar tu historial laboral.')
            : 'No pudimos cargar tu historial laboral.',
        );
        this.cargando.set(false);
      },
    });
  }

  private async crear(borrador: Omit<WorkHistoryRow, 'id'>): Promise<WorkHistoryRow> {
    // `Omit` sobre una fila con firma de índice pierde las claves con nombre:
    // se lee por clave y se normaliza a texto.
    const campo = (key: keyof WorkHistoryRow & string): string => {
      const valor = borrador[key];
      return valor === null || valor === undefined ? '' : String(valor);
    };
    const area = campo('departmentText');
    const hasta = campo('endDate');
    const nueva: NewPractitionerAffiliation = {
      organizationName: campo('organizationName'),
      roleTitle: campo('roleTitle'),
      startDate: campo('startDate'),
      ...(area === '' ? {} : { departmentText: area }),
      ...(hasta === '' ? {} : { endDate: hasta }),
    };
    try {
      return comoFila(await firstValueFrom(this.profiles.addAffiliation(nueva)));
    } catch (error: unknown) {
      // El `cause` conserva el fallo original: el mensaje que sube es para la
      // persona, y sin la causa adjunta el error del servidor se pierde para
      // quien después mire la consola o el reporte.
      throw new Error(mensajeDeAlta(error), { cause: error });
    }
  }

  /**
   * Viaja la fila entera (menos `id`): la tabla ya mezcló el borrador con la
   * fila original, y mandar todo es más simple que calcular el diff — el
   * backend ignora lo igual. `endDate` vacío viaja como `null`: es la forma de
   * volver a marcar el vínculo vigente.
   */
  private async corregir(fila: WorkHistoryRow): Promise<WorkHistoryRow> {
    const cambios: UpdatePractitionerAffiliation = {
      organizationName: fila.organizationName,
      roleTitle: fila.roleTitle,
      departmentText: fila.departmentText ?? '',
      startDate: fila.startDate,
      endDate: fila.endDate === null || fila.endDate === '' ? null : fila.endDate,
    };
    try {
      return comoFila(await firstValueFrom(this.profiles.updateAffiliation(fila.id, cambios)));
    } catch (error: unknown) {
      throw new Error(mensajeDeCambio(error, 'guardar'), { cause: error });
    }
  }

  private async borrar(fila: WorkHistoryRow): Promise<void> {
    try {
      await firstValueFrom(this.profiles.removeAffiliation(fila.id));
    } catch (error: unknown) {
      throw new Error(mensajeDeCambio(error, 'eliminar'), { cause: error });
    }
  }
}

function comoFila(afiliacion: PractitionerAffiliation): WorkHistoryRow {
  return {
    id: afiliacion.id,
    organizationName: afiliacion.organizationName,
    roleTitle: afiliacion.roleTitle,
    departmentText: afiliacion.departmentText,
    startDate: soloFecha(afiliacion.startDate),
    endDate: afiliacion.endDate === null ? null : soloFecha(afiliacion.endDate),
  };
}

/** `409` y `422` son del formulario; el resto, del sistema. */
function mensajeDeAlta(error: unknown): string {
  return mensajeDeCambio(error, 'guardar');
}

/**
 * Traduce el fallo de un `POST`/`PATCH`/`DELETE` a qué corregir o qué pasó.
 * `404` es «ya no está o no es tuyo»: el backend responde igual en los dos
 * casos a propósito, así que acá tampoco se distingue.
 */
function mensajeDeCambio(error: unknown, verbo: 'guardar' | 'eliminar'): string {
  const estado = errorToViewState<null>(error);
  if (estado.status === 'not-found') {
    return 'Ese vínculo ya no está en tu historial. Recargá la lista.';
  }
  if (estado.status === 'validation') {
    if (estado.issues.some((issue) => issue.code === 'CONFLICT')) {
      return 'Ese vínculo ya está en tu historial: misma institución, mismo cargo y misma fecha de inicio.';
    }
    return estado.issues.map((issue) => issue.message).join(' ') || 'Revisá los datos del vínculo.';
  }
  if (estado.status === 'forbidden') {
    return estado.message ?? 'Tu cuenta no tiene un perfil profesional asociado.';
  }
  if (estado.status === 'offline') {
    return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
  }
  return `No pudimos ${verbo} el vínculo. Probá de nuevo.`;
}

/** `YYYY-MM-DD` en hora local: el día en que alguien entró a un hospital no tiene hora. */
function soloFecha(fecha: Date): string {
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
