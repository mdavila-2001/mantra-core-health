import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { leerErrorDeInfraestructura } from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  InfraConcept,
  InfrastructureCatalog,
  SiteSummary,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** Un espacio que la tipología nueva no admite (409 `TYPOLOGY_CONFLICT`). */
interface Conflicto {
  readonly spaceId: string;
  readonly code: string;
  readonly name: string;
  readonly function: InfraConcept | null;
}

export const opcionesDe = (conceptos: readonly InfraConcept[]): SelectOption<string>[] =>
  conceptos.map((c) => ({ value: c.code, label: c.display }));

/**
 * Datos regulatorios del establecimiento (Bolivia): SNIS, subsector, nivel,
 * tipología, ente gestor, red, SEDES y municipio — `PATCH /sites/:id/regulatory`.
 *
 * Cambiar la tipología puede chocar con espacios existentes: la API responde
 * 409 `TYPOLOGY_CONFLICT` con la lista, y el modal la muestra en vez de un
 * «no se pudo» que no dice qué tocar.
 */
@Component({
  selector: 'app-regulatorio-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Input, ReactiveFormsModule, Select, ViewStateHost],
  template: `
    <app-content-dialog
      size="lg"
      heading="Datos regulatorios del establecimiento"
      description="Lo que exige el registro del SNIS y el SEDES. La tipología define qué espacios se pueden tener."
      [dismissible]="!enviando()"
      (closed)="cerrado.emit()"
    >
      @if (conflictos().length > 0) {
        <app-alert tone="warning" title="La tipología elegida no admite estos espacios" data-testid="regulatorio-conflictos">
          <ul class="dialogo__lista">
            @for (c of conflictos(); track c.spaceId) {
              <li><strong>{{ c.code }}</strong> · {{ c.name }} ({{ c.function?.display ?? 'sin función' }})</li>
            }
          </ul>
          Retiralos o cambiales la función antes de cambiar la tipología.
        </app-alert>
      } @else if (fallo(); as estado) {
        <app-view-state-host [state]="estado" (retry)="guardar()" />
      }
      <form class="dialogo__rejilla" [formGroup]="form" (ngSubmit)="guardar()" id="form-regulatorio">
        <app-form-field label="Código SNIS" hint="Entre 6 y 12 dígitos.">
          <app-input formControlName="snisCode" inputMode="numeric" />
        </app-form-field>
        <app-form-field label="Subsector">
          <app-select formControlName="subsectorCode" [options]="opciones().subsector" placeholder="Sin declarar" />
        </app-form-field>
        <app-form-field label="Nivel de atención">
          <app-select formControlName="careLevelCode" [options]="opciones().careLevel" placeholder="Sin declarar" />
        </app-form-field>
        <app-form-field label="Tipología">
          <app-select formControlName="typologyCode" [options]="opciones().typology" placeholder="Sin declarar" />
        </app-form-field>
        <app-form-field label="Ente gestor">
          <app-input formControlName="managingEntityName" />
        </app-form-field>
        <app-form-field label="Red de salud">
          <app-input formControlName="healthNetworkName" />
        </app-form-field>
        <app-form-field label="SEDES">
          <app-select formControlName="sedesCode" [options]="opciones().sedes" placeholder="Sin declarar" />
        </app-form-field>
        <app-form-field label="Municipio">
          <app-input formControlName="municipalityName" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="enviando()" (clicked)="cerrado.emit()">Cancelar</button>
        <button app-button type="submit" form="form-regulatorio" [disabled]="enviando()" data-testid="regulatorio-guardar">
          {{ enviando() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </app-content-dialog>
  `,
  styleUrl: './dialogos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegulatorioDialog implements OnInit {
  private readonly client = inject(InfrastructureClient);

  readonly sitio = input.required<SiteSummary>();
  readonly catalogo = input.required<InfrastructureCatalog>();
  readonly guardado = output<SiteSummary>();
  readonly cerrado = output<void>();

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);
  protected readonly conflictos = signal<readonly Conflicto[]>([]);

  protected readonly opciones = computed(() => {
    const r = this.catalogo().regulatory;
    return {
      subsector: opcionesDe(r.subsector),
      careLevel: opcionesDe(r.careLevel),
      typology: opcionesDe(r.typology),
      sedes: opcionesDe(r.sedes),
    };
  });

  protected readonly form = new FormGroup({
    snisCode: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d{6,12}$/)] }),
    subsectorCode: new FormControl<string | null>(null),
    careLevelCode: new FormControl<string | null>(null),
    typologyCode: new FormControl<string | null>(null),
    managingEntityName: new FormControl('', { nonNullable: true }),
    healthNetworkName: new FormControl('', { nonNullable: true }),
    sedesCode: new FormControl<string | null>(null),
    municipalityName: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const r = this.sitio().regulatory;
    this.form.setValue({
      snisCode: r.snisCode ?? '',
      subsectorCode: r.subsector?.code ?? null,
      careLevelCode: r.careLevel?.code ?? null,
      typologyCode: r.typology?.code ?? null,
      managingEntityName: r.managingEntityName ?? '',
      healthNetworkName: r.healthNetworkName ?? '',
      sedesCode: r.sedes?.code ?? null,
      municipalityName: r.municipalityName ?? '',
    });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const vacio = (t: string) => (t.trim() === '' ? null : t.trim());
    this.enviando.set(true);
    this.fallo.set(null);
    this.conflictos.set([]);
    this.client
      .updateRegulatory(this.sitio().id, {
        snisCode: vacio(v.snisCode),
        subsectorCode: v.subsectorCode,
        careLevelCode: v.careLevelCode,
        typologyCode: v.typologyCode,
        managingEntityName: vacio(v.managingEntityName),
        healthNetworkName: vacio(v.healthNetworkName),
        sedesCode: v.sedesCode,
        municipalityName: vacio(v.municipalityName),
      })
      .subscribe({
        next: (sitio) => {
          this.enviando.set(false);
          this.guardado.emit(sitio);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          const leido = leerErrorDeInfraestructura(error);
          const lista = leido?.reason === 'TYPOLOGY_CONFLICT' ? leido.details['conflicts'] : null;
          if (Array.isArray(lista)) {
            this.conflictos.set(lista as Conflicto[]);
            return;
          }
          this.fallo.set(errorToViewState<never>(error));
        },
      });
  }
}
