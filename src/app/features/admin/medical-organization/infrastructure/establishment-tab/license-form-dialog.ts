import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import type {
  ClinicalUnitNode,
  InfrastructureCatalog,
  LicenseInput,
  SiteLicense,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { PaginatedForm } from '../../../../../shared/components/organisms/paginated-form/paginated-form';
import type { PaginaDeFormulario } from '../../../../../shared/forms/paginated/paginated-form.types';
import { InfraIssueAlert } from '../issue-alert';

const SIN_UNIDAD: SelectOption<string> = { value: '', label: 'Todo el establecimiento' };

function aDia(d: Date | null): string | undefined {
  if (d === null) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deDia(v: string | null): Date | null {
  if (v === null || v === '') return null;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * **Alta y edición de una habilitación** ante el SEDES u otra autoridad
 * (CODELAB, municipio…): resolución, emisión, vencimiento, estado y alcance
 * opcional por unidad. No se borra nunca: se cambia su estado o vence. El
 * vencimiento (`LIC_EXPIRED`) lo calcula el servidor al leer; aquí sólo se
 * eligen los estados que una persona declara.
 *
 * El documento de respaldo (`documentFileId`) NO se ofrece en esta franja:
 * subirlo exige el flujo de archivos, que el contrato F1 no describe para esta
 * ruta. Queda anotado en el reporte.
 */
@Component({
  selector: 'app-license-form-dialog',
  imports: [ContentDialog, InfraIssueAlert, PaginatedForm],
  template: `
    <app-content-dialog
      [heading]="license() ? 'Editar habilitación' : 'Registrar habilitación'"
      [description]="siteName()"
      closeLabel="Cancelar"
      size="lg"
      (closed)="closed.emit()"
    >
      <div data-testid="habilitacion-dialogo">
        <app-infra-issue-alert [state]="serverState()" heading="No se pudo guardar la habilitación" />
        <app-paginated-form
          [paginas]="paginas()"
          [form]="form"
          label="Habilitación"
          [submitLabel]="license() ? 'Guardar cambios' : 'Registrar habilitación'"
          submitTestId="habilitacion-guardar"
          cancelLabel="Cancelar"
          [pending]="pending()"
          (enviado)="guardar()"
          (cancelado)="closed.emit()"
        />
      </div>
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseFormDialog implements OnInit {
  readonly siteId = input.required<string>();
  readonly siteName = input.required<string>();
  readonly catalog = input.required<InfrastructureCatalog>();
  readonly units = input<readonly ClinicalUnitNode[]>([]);
  readonly license = input<SiteLicense | null>(null);

  readonly saved = output<SiteLicense>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);

  protected readonly form = new FormGroup({
    authorityName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    resolutionNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    issuedOn: new FormControl<Date | null>(null),
    expiresOn: new FormControl<Date | null>(null),
    statusCode: new FormControl('LIC_IN_PROCESS', { nonNullable: true, validators: [Validators.required] }),
    clinicalUnitId: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => [
    {
      titulo: 'Autoridad y resolución',
      clave: 'resolucion',
      campos: [
        { key: 'authorityName', label: 'Autoridad', control: 'text', required: true, placeholder: 'SEDES Santa Cruz', testId: 'habilitacion-autoridad' },
        { key: 'resolutionNumber', label: 'Número de resolución', control: 'text', testId: 'habilitacion-resolucion' },
        { key: 'issuedOn', label: 'Fecha de emisión', control: 'date' },
        { key: 'expiresOn', label: 'Fecha de vencimiento', control: 'date', hint: 'Si ya pasó, la habilitación se lee como vencida aunque se guarde como vigente.' },
      ],
      disposicion: 'dos-columnas',
    },
    {
      titulo: 'Estado y alcance',
      clave: 'estado',
      campos: [
        {
          key: 'statusCode',
          label: 'Estado',
          control: 'select',
          required: true,
          options: this.catalog().regulatory.licenseStatus.filter((s) => s.code !== 'LIC_EXPIRED').map((s) => ({ value: s.code, label: s.display })),
          hint: '«Vencida» no se elige: la calcula el sistema con la fecha de vencimiento.',
        },
        { key: 'clinicalUnitId', label: 'Alcance', control: 'select', options: [SIN_UNIDAD, ...this.units().map((u) => ({ value: u.id, label: u.name }))] },
        { key: 'notes', label: 'Notas', control: 'textarea' },
      ],
      disposicion: 'dos-columnas',
    },
  ]);

  ngOnInit(): void {
    const l = this.license();
    if (l === null) return;
    this.form.patchValue({
      authorityName: l.authorityName,
      resolutionNumber: l.resolutionNumber ?? '',
      issuedOn: deDia(l.issuedOn),
      expiresOn: deDia(l.expiresOn),
      statusCode: l.status.code === 'LIC_EXPIRED' ? 'LIC_VALID' : l.status.code,
      clinicalUnitId: l.clinicalUnitId ?? '',
      notes: l.notes ?? '',
    });
  }

  protected guardar(): void {
    if (this.pending()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const emision = aDia(v.issuedOn);
    const vencimiento = aDia(v.expiresOn);
    if (emision !== undefined && vencimiento !== undefined && vencimiento < emision) {
      this.serverState.set({ status: 'validation', issues: [{ field: 'expiresOn', message: 'El vencimiento no puede ser anterior a la emisión.' }] });
      return;
    }
    const cuerpo: LicenseInput = {
      authorityName: v.authorityName.trim(),
      statusCode: v.statusCode,
      ...(v.resolutionNumber.trim() === '' ? {} : { resolutionNumber: v.resolutionNumber.trim() }),
      ...(emision === undefined ? {} : { issuedOn: emision }),
      ...(vencimiento === undefined ? {} : { expiresOn: vencimiento }),
      ...(v.clinicalUnitId === '' ? {} : { clinicalUnitId: v.clinicalUnitId }),
      ...(v.notes.trim() === '' ? {} : { notes: v.notes.trim() }),
    };
    this.pending.set(true);
    this.serverState.set(null);
    const actual = this.license();
    const peticion = actual === null ? this.client.createLicense(this.siteId(), cuerpo) : this.client.updateLicense(actual.id, actual.rowVersion, cuerpo);
    peticion.subscribe({
      next: (l) => {
        this.pending.set(false);
        this.saved.emit(l);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }
}
