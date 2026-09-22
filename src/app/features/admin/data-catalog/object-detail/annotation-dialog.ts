import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type {
  Annotation,
  AnnotationContent,
  AnnotationPatch,
} from '../../../../core/data-access/admin-portal/data-catalog.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../../shared/forms/paginated/paginar-campos';
import { SENSITIVITY_OPTIONS, errorDeApi } from '../../platform/platform-labels';

/** Campos de texto de la ficha de una tabla. */
const CAMPOS = [
  'businessName',
  'purpose',
  'existenceRationale',
  'rowGrain',
  'deletionImpact',
  'businessOwner',
  'dataSteward',
  'technicalOwner',
] as const;
type Campo = (typeof CAMPOS)[number];

/** Rótulo visible de cada campo: también nombra el campo en los errores. */
const ETIQUETA: Readonly<Record<Campo, string>> = {
  businessName: 'Nombre de negocio',
  purpose: 'Propósito',
  existenceRationale: 'Por qué existe',
  rowGrain: 'Qué significa una fila',
  deletionImpact: 'Qué pasa si se elimina',
  businessOwner: 'Dueño de negocio',
  dataSteward: 'Steward',
  technicalOwner: 'Responsable técnico',
};

/**
 * El servidor explica cada rechazo con un código (`reason`) y un texto que
 * nombra el campo por su clave técnica. Acá se habla con el rótulo de la
 * pantalla; un código que no se conoce muestra el texto del servidor con la
 * clave cambiada por el rótulo.
 */
function motivo(campo: Campo, reason: string | undefined, mensaje: string): string {
  const codigo = (reason ?? '').split(':')[0];
  switch (codigo) {
    case 'FILLER_TEXT':
      return 'No explica nada que el nombre técnico no diga ya.';
    case 'REQUIRED_OR_OPEN_QUESTION':
      return 'Hace falta completarlo o declararlo como pregunta abierta para enviar a revisión.';
    case 'FIELD_NOT_APPLICABLE':
      return 'No aplica a este tipo de objeto.';
    default:
      return mensaje.replaceAll(`"${campo}"`, `«${ETIQUETA[campo]}»`);
  }
}

/**
 * Edición de la ficha de justificación de una tabla, en páginas de a cuatro
 * campos (`<app-paginated-form>`, regla de formularios de la casa).
 *
 * Envía siempre la versión leída (`expectedVersion`): si otra persona la
 * cambió, el servidor responde 409 y este modal NO pisa nada — conserva lo
 * escrito y ofrece recargar. Un 422 marca cada campo con el motivo del
 * servidor (p. ej. texto de relleno).
 */
@Component({
  selector: 'app-annotation-dialog',
  imports: [AppButton, Alert, ContentDialog, PaginatedForm],
  templateUrl: './annotation-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationDialog implements OnInit {
  private readonly catalog = inject(DataCatalogClient);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly objectId = input.required<string>();
  readonly technicalName = input.required<string>();
  readonly annotation = input<Annotation | null>(null);

  readonly saved = output<Annotation>();
  readonly closed = output<void>();
  readonly reloadRequested = output<void>();

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly conflicto = signal(false);
  protected readonly errores = signal<Partial<Record<Campo, string>>>({});

  protected readonly form = this.fb.group({
    businessName: this.fb.control(''),
    purpose: this.fb.control(''),
    existenceRationale: this.fb.control(''),
    rowGrain: this.fb.control(''),
    deletionImpact: this.fb.control(''),
    businessOwner: this.fb.control(''),
    dataSteward: this.fb.control(''),
    technicalOwner: this.fb.control(''),
    sensitivity: this.fb.control('UNKNOWN'),
    changeReason: this.fb.control(''),
    submit: this.fb.control(true),
  });

  protected readonly titulo = computed(() =>
    this.annotation() ? `Editar la ficha de ${this.technicalName()}` : `Crear la ficha de ${this.technicalName()}`,
  );

  protected readonly paginas = computed(() => {
    const e = this.errores();
    return paginarCampos([
      {
        titulo: 'Por qué existe',
        hint: 'Lo que nadie sabe se deja vacío y se declara como pregunta abierta: no se inventa.',
        campos: [
          { key: 'purpose', label: ETIQUETA.purpose, hint: 'Qué proceso o decisión habilita.', control: 'textarea' as const, mensajeDeError: e.purpose },
          {
            key: 'existenceRationale',
            label: ETIQUETA.existenceRationale,
            hint: 'Por qué hace falta persistencia propia y no una vista o un cálculo. «Almacena los datos de…» no cuenta.',
            control: 'textarea' as const,
            testId: 'annotation-rationale',
            mensajeDeError: e.existenceRationale,
          },
          { key: 'rowGrain', label: ETIQUETA.rowGrain, hint: 'La identidad de una fila, en lenguaje de negocio.', control: 'textarea' as const, mensajeDeError: e.rowGrain },
          { key: 'deletionImpact', label: ETIQUETA.deletionImpact, hint: 'Consecuencias conocidas de borrar, alterar o retrasar estos datos.', control: 'textarea' as const },
        ],
      },
      {
        titulo: 'Nombre y responsables',
        campos: [
          { key: 'businessName', label: ETIQUETA.businessName, hint: 'Cómo lo llama la gente que lo usa.', control: 'text' as const, testId: 'annotation-business-name' },
          {
            key: 'sensitivity',
            label: 'Sensibilidad',
            hint: '«Sin determinar» no es lo mismo que «No sensible».',
            control: 'select' as const,
            options: SENSITIVITY_OPTIONS.map((o) => ({ value: o.value as string, label: o.label })),
          },
          { key: 'businessOwner', label: ETIQUETA.businessOwner, control: 'text' as const },
          { key: 'dataSteward', label: ETIQUETA.dataSteward, control: 'text' as const },
        ],
      },
      {
        titulo: 'Cierre',
        campos: [
          { key: 'technicalOwner', label: ETIQUETA.technicalOwner, control: 'text' as const },
          { key: 'changeReason', label: 'Motivo del cambio', hint: 'Queda en el historial de revisiones.', control: 'text' as const },
          {
            key: 'submit',
            label: 'Enviar a revisión',
            hint: 'Apagado guarda un borrador. Encendido exige propósito, razón y grano (o una pregunta abierta), y otra persona tiene que aprobarla.',
            control: 'switch' as const,
            testId: 'annotation-submit-switch',
          },
        ],
      },
    ]);
  });

  ngOnInit(): void {
    const contenido = this.annotation()?.content;
    if (contenido) {
      for (const campo of CAMPOS) {
        this.form.controls[campo].setValue((contenido[campo as keyof AnnotationContent] as string | null) ?? '');
      }
      this.form.controls.sensitivity.setValue(contenido.sensitivity);
    }
  }

  protected guardar(): void {
    this.guardando.set(true);
    this.error.set(null);
    this.errores.set({});
    const valores = this.form.getRawValue();
    const patch: Record<string, unknown> = {
      expectedVersion: this.annotation()?.version ?? 0,
      submit: valores.submit,
      sensitivity: valores.sensitivity,
    };
    for (const campo of CAMPOS) {
      const valor = valores[campo].trim();
      // `null` borra en el servidor; una cadena vacía también es ausencia.
      patch[campo] = valor === '' ? null : valor;
    }
    if (valores.changeReason.trim()) patch['changeReason'] = valores.changeReason.trim();

    this.catalog.saveObjectAnnotation(this.objectId(), patch as unknown as AnnotationPatch).subscribe({
      next: (guardada) => {
        this.guardando.set(false);
        this.saved.emit(guardada);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        const api = errorDeApi(err);
        if (api.status === 409) {
          this.conflicto.set(true);
          this.error.set(
            'Otra persona cambió esta ficha mientras la editabas. Tus cambios siguen acá: recargá para ver la versión vigente.',
          );
          return;
        }
        if (api.status === 422) {
          const violaciones =
            (api.details?.['violations'] as { field?: string; reason?: string; message: string }[] | undefined) ?? [];
          const porCampo: Partial<Record<Campo, string>> = {};
          for (const v of violaciones) {
            if (v.field && (CAMPOS as readonly string[]).includes(v.field)) {
              porCampo[v.field as Campo] = motivo(v.field as Campo, v.reason, v.message);
              // El motor muestra `mensajeDeError` sobre un control inválido.
              this.form.controls[v.field as Campo].setErrors({ servidor: true });
              this.form.controls[v.field as Campo].markAsTouched();
            }
          }
          this.errores.set(porCampo);
          this.error.set(
            [
              api.message ?? 'Revisá los campos marcados.',
              ...Object.entries(porCampo).map(([campo, texto]) => `${ETIQUETA[campo as Campo]}: ${texto}`),
            ].join(' · '),
          );
          return;
        }
        this.error.set(api.status === 403 ? 'Tu rol no permite editar fichas.' : 'No se pudo guardar la ficha.');
      },
    });
  }
}
