import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';

import {
  PrimaryPractitionerClient,
  type PrimaryPatient,
  type PrimaryPatientsPage,
} from '../../../core/data-access/profiles/primary-practitioner.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Filas por página: una consulta normal de un médico de cabecera cabe en una. */
export const PAGE_SIZE = 50;

/** Una fila de la tabla, ya legible. */
interface FilaDePaciente {
  readonly id: string;
  readonly nombre: string;
  readonly codigo: string;
  readonly desde: string;
}

/**
 * **Mis pacientes de cabecera** — los pacientes que eligieron al profesional
 * de la sesión como su médico de cabecera (28/10/2026).
 *
 * Es una lista de quiénes lo eligieron y desde cuándo, nada más: elegir a un
 * médico de cabecera no le abre la historia clínica. La autoridad es la API
 * (`GET /profiles/practitioners/me/primary-patients`), que resuelve al
 * profesional de la sesión.
 */
@Component({
  selector: 'app-my-primary-patients',
  imports: [AppButton, DataTable, PageHeader, ViewStateHost],
  templateUrl: './my-primary-patients.html',
  styleUrl: './my-primary-patients.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPrimaryPatients {
  private readonly client = inject(PrimaryPractitionerClient);
  private readonly locale = inject(LOCALE_ID);

  protected readonly state = signal<ViewState<PrimaryPatientsPage>>(loading());
  protected readonly pagina = computed(() => dataOf(this.state()));
  private readonly offset = signal(0);

  protected readonly filas = computed<ViewState<readonly FilaDePaciente[]>>(() => {
    const pagina = this.pagina();
    if (pagina === null) return loading();
    return ready(pagina.items.map((p) => this.fila(p)));
  });

  protected readonly columnas: readonly ColumnDef<FilaDePaciente>[] = [
    { key: 'nombre', header: 'Paciente', priority: 1 },
    { key: 'desde', header: 'Lo eligió el', priority: 1 },
    { key: 'codigo', header: 'Código de paciente', priority: 2 },
  ];

  protected readonly resumen = computed(() => {
    const pagina = this.pagina();
    if (pagina === null) return '';
    return pagina.total === 1
      ? '1 paciente lo tiene como médico de cabecera.'
      : `${pagina.total} pacientes lo tienen como médico de cabecera.`;
  });

  protected readonly hayAnterior = computed(() => (this.pagina()?.offset ?? 0) > 0);
  protected readonly haySiguiente = computed(() => {
    const p = this.pagina();
    return p !== null && p.offset + p.items.length < p.total;
  });

  protected readonly porId = (fila: FilaDePaciente): string => fila.id;
  protected readonly nombreDeFila = (fila: FilaDePaciente): string => fila.nombre;

  constructor() {
    this.cargar();
  }

  protected retry(): void {
    this.cargar();
  }

  protected anterior(): void {
    this.offset.set(Math.max(0, this.offset() - PAGE_SIZE));
    this.cargar();
  }

  protected siguiente(): void {
    this.offset.set(this.offset() + PAGE_SIZE);
    this.cargar();
  }

  private cargar(): void {
    this.state.set(loading());
    this.client.listOwnPatients({ limit: PAGE_SIZE, offset: this.offset() }).subscribe({
      next: (pagina) =>
        this.state.set(
          pagina.total === 0
            ? empty(
                { label: 'Revisar mi perfil', route: '/my-account' },
                'Todavía ningún paciente lo eligió como médico de cabecera. Los pacientes lo hacen desde su ficha en la guía de médicos; mantener su perfil completo ayuda a que lo encuentren.',
              )
            : ready(pagina),
        ),
      error: (error: unknown) => this.state.set(errorToViewState<PrimaryPatientsPage>(error)),
    });
  }

  private fila(p: PrimaryPatient): FilaDePaciente {
    const nombre = p.displayName?.trim();
    return {
      id: p.patientProfileId,
      nombre: nombre === undefined || nombre === '' ? 'Paciente sin nombre registrado' : nombre,
      codigo: p.patientCode ?? '—',
      desde: formatDate(p.since, "d 'de' MMMM 'de' y", this.locale),
    };
  }
}
