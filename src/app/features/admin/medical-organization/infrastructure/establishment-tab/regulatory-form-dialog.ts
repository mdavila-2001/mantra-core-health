import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState, readInfrastructureError } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import type {
  InfrastructureCatalog,
  RegulatoryUpdateRequest,
  SiteSummary,
  TypologyConflict,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { PaginatedForm } from '../../../../../shared/components/organisms/paginated-form/paginated-form';
import type { PaginaDeFormulario } from '../../../../../shared/forms/paginated/paginated-form.types';
import { rutaDeEspacio } from '../infrastructure.view';
import { InfraIssueAlert } from '../issue-alert';

const SIN_DEFINIR: SelectOption<string> = { value: '', label: 'Sin definir' };

/**
 * **Datos regulatorios del establecimiento** (Bolivia): código SNIS, subsector,
 * nivel, tipología, ente gestor, red y SEDES.
 *
 * Cambiar la tipología la valida la API contra **todos** los espacios no
 * clausurados: si alguno la incumple responde 409 `TYPOLOGY_CONFLICT` con la
 * lista, y este diálogo la muestra con un enlace a cada espacio y la salida
 * («clausúrelo o revise la tipología») — no cambia nada en silencio. El código
 * SNIS es texto sin formato inventado; si pertenece a otro establecimiento ya
 * verificado, la respuesta es genérica a propósito y no dice de quién es.
 */
@Component({
  selector: 'app-regulatory-form-dialog',
  imports: [Alert, ContentDialog, InfraIssueAlert, PaginatedForm, RouterLink],
  template: `
    <app-content-dialog heading="Editar datos regulatorios" [description]="site().name" closeLabel="Cancelar" size="lg" (closed)="closed.emit()">
      <div data-testid="regulatorio-dialogo">
        <app-infra-issue-alert [state]="serverState()" heading="No se pudo guardar" />
        @if (conflictos().length > 0) {
          <app-alert tone="error" title="La tipología elegida no admite estos espacios" data-testid="regulatorio-conflictos">
            <ul class="conflictos">
              @for (c of conflictos(); track c.spaceId) {
                <li>
                  <a [routerLink]="rutaDeEspacio(c.spaceId)" target="_blank" rel="noopener">{{ c.name }} ({{ c.code }})</a>: {{ c.rule }}
                </li>
              }
            </ul>
            <p>Qué hacer: clausure o reubique esos espacios, o elija otra tipología.</p>
          </app-alert>
        }
        <app-paginated-form
          [paginas]="paginas()"
          [form]="form"
          label="Datos regulatorios"
          submitLabel="Guardar datos regulatorios"
          submitTestId="regulatorio-guardar"
          cancelLabel="Cancelar"
          [pending]="pending()"
          (enviado)="guardar()"
          (cancelado)="closed.emit()"
        />
      </div>
    </app-content-dialog>
  `,
  styles: `
    .conflictos {
      margin: 0 0 var(--sp-2);
      padding-inline-start: var(--sp-5);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegulatoryFormDialog implements OnInit {
  readonly site = input.required<SiteSummary>();
  readonly catalog = input.required<InfrastructureCatalog>();

  readonly saved = output<SiteSummary>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);
  protected readonly conflictos = signal<readonly TypologyConflict[]>([]);
  protected readonly rutaDeEspacio = rutaDeEspacio;

  protected readonly form = new FormGroup({
    snisCode: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    subsectorCode: new FormControl('', { nonNullable: true }),
    careLevelCode: new FormControl('', { nonNullable: true }),
    typologyCode: new FormControl('', { nonNullable: true }),
    managingEntityName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    healthNetworkName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    sedesCode: new FormControl('', { nonNullable: true }),
    municipalityName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
  });

  private opciones(lista: readonly { code: string; display: string }[]): readonly SelectOption<string>[] {
    return [SIN_DEFINIR, ...lista.map((c) => ({ value: c.code, label: c.display }))];
  }

  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => {
    const r = this.catalog().regulatory;
    return [
      {
        titulo: 'Identificación y clasificación',
        clave: 'clasificacion',
        hint: 'Como figura ante el SNIS y el SEDES.',
        campos: [
          { key: 'snisCode', label: 'Código SNIS / SUIS', control: 'text', hint: 'Texto tal como lo asigna el SNIS; la plataforma lo verifica aparte.', testId: 'regulatorio-snis' },
          { key: 'subsectorCode', label: 'Subsector', control: 'select', options: this.opciones(r.subsector) },
          { key: 'careLevelCode', label: 'Nivel de atención', control: 'select', options: this.opciones(r.careLevel) },
          { key: 'typologyCode', label: 'Tipología', control: 'select', options: this.opciones(r.typology), hint: 'Decide qué tipos de espacio se pueden crear.', testId: 'regulatorio-tipologia' },
        ],
        disposicion: 'dos-columnas',
      },
      {
        titulo: 'Gestión y ubicación',
        clave: 'gestion',
        campos: [
          { key: 'managingEntityName', label: 'Ente gestor', control: 'text', hint: 'Caja de salud, municipio, razón social…' },
          { key: 'healthNetworkName', label: 'Red de salud', control: 'text' },
          { key: 'sedesCode', label: 'SEDES (departamento)', control: 'select', options: this.opciones(r.sedes) },
          { key: 'municipalityName', label: 'Municipio', control: 'text' },
        ],
        disposicion: 'dos-columnas',
      },
    ];
  });

  ngOnInit(): void {
    const g = this.site().regulatory;
    this.form.patchValue({
      snisCode: g.snisCode ?? '',
      subsectorCode: g.subsector?.code ?? '',
      careLevelCode: g.careLevel?.code ?? '',
      typologyCode: g.typology?.code ?? '',
      managingEntityName: g.managingEntityName ?? '',
      healthNetworkName: g.healthNetworkName ?? '',
      sedesCode: g.sedes?.code ?? '',
      municipalityName: g.municipalityName ?? '',
    });
  }

  protected guardar(): void {
    if (this.pending()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const g = this.site().regulatory;
    // Sólo viaja lo que cambió: el SNIS cambiado pierde la verificación, así que no se reenvía en vano.
    const cuerpo: RegulatoryUpdateRequest = {
      ...(v.snisCode.trim() !== (g.snisCode ?? '') ? { snisCode: v.snisCode.trim() } : {}),
      ...(v.subsectorCode !== (g.subsector?.code ?? '') ? { subsectorCode: v.subsectorCode } : {}),
      ...(v.careLevelCode !== (g.careLevel?.code ?? '') ? { careLevelCode: v.careLevelCode } : {}),
      ...(v.typologyCode !== (g.typology?.code ?? '') ? { typologyCode: v.typologyCode } : {}),
      ...(v.managingEntityName.trim() !== (g.managingEntityName ?? '') ? { managingEntityName: v.managingEntityName.trim() } : {}),
      ...(v.healthNetworkName.trim() !== (g.healthNetworkName ?? '') ? { healthNetworkName: v.healthNetworkName.trim() } : {}),
      ...(v.sedesCode !== (g.sedes?.code ?? '') ? { sedesCode: v.sedesCode } : {}),
      ...(v.municipalityName.trim() !== (g.municipalityName ?? '') ? { municipalityName: v.municipalityName.trim() } : {}),
    };
    if (Object.keys(cuerpo).length === 0) {
      this.closed.emit();
      return;
    }
    this.pending.set(true);
    this.serverState.set(null);
    this.conflictos.set([]);
    this.client.updateRegulatory(this.site().id, this.site().rowVersion, cuerpo).subscribe({
      next: (sitio) => {
        this.pending.set(false);
        this.saved.emit(sitio);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        const detalle = readInfrastructureError(error);
        if (detalle?.reason === 'TYPOLOGY_CONFLICT') {
          this.conflictos.set(detalle.conflicts);
          return;
        }
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }
}
