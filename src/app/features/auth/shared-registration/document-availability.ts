import { HttpErrorResponse } from '@angular/common/http';
import { inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import type { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, map, merge, of, startWith, switchMap, timer, type Observable } from 'rxjs';

import { readApiError } from '../../../core/http/api-error';
import {
  DocumentAvailabilityClient,
  type DocumentHolderKind,
} from '../../../core/data-access/iam/document-availability.client';
import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/**
 * C-10 / MD-01 · ¿El CI ya está registrado para este tipo de usuario?
 *
 * ## Qué pidió el cliente
 *
 * El mismo carnet —número y departamento de expedición— no se registra dos
 * veces para el mismo tipo de usuario: dos médicos no, dos pacientes no. Un
 * médico sí puede ser además paciente con su mismo CI. La regla vive en la API
 * (409 `DOCUMENT_ALREADY_REGISTERED` y un índice único); esto sólo la adelanta
 * para que la persona no se entere al final de un alta de seis pasos.
 *
 * ## Por qué un validador asíncrono y no una consulta al enviar
 *
 * El control queda `invalid` con su propio mensaje, en el campo, que es donde
 * el motor de páginas muestra los errores y a donde vuelve al enviar. Angular
 * cancela la consulta anterior cuando el valor cambia, así que el `timer` hace
 * de antirrebote sin estado propio.
 *
 * Si la consulta falla —sin red, límite por IP— el campo **no** se bloquea:
 * decide el alta, que aplica la misma regla. El estado lo dice.
 */

/** Lo que se le muestra a la persona debajo del documento. */
export type EstadoDeDocumento =
  'sin-dato' | 'falta-departamento' | 'comprobando' | 'libre' | 'tomado' | 'sin-respuesta';

/** Clave del error en el control: el motor muestra `mensajePropio` tal cual. */
export const DOCUMENTO_TOMADO = 'documentoTomado';

const MENSAJE_TOMADO: Readonly<Record<DocumentHolderKind, string>> = {
  PRACTITIONER:
    'Ya hay un médico registrado con este documento y este departamento. Si la cuenta es suya, inicie sesión con su correo o use «¿Olvidó su contraseña?».',
  PATIENT:
    'Ya hay un paciente registrado con este documento y este departamento. Si la cuenta es suya, inicie sesión con su documento o use «¿Olvidó su contraseña?».',
};

/** Espera tras la última tecla antes de preguntar. */
const ANTIRREBOTE_MS = 400;

/** El 409 del alta con el motivo del contrato C-10. */
export function esDocumentoYaRegistrado(
  details: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return details?.['reason'] === 'DOCUMENT_ALREADY_REGISTERED';
}

/** Lo mismo, a partir de lo que llegó al `error` de un `subscribe`. */
export function esErrorDeDocumentoYaRegistrado(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 409 &&
    esDocumentoYaRegistrado(readApiError(error)?.details)
  );
}

/** El mensaje del documento repetido, el mismo en el campo y en el aviso del envío. */
export function mensajeDocumentoTomado(kind: DocumentHolderKind): string {
  return MENSAJE_TOMADO[kind];
}

/** Los dos controles del documento, como los declaran las altas. */
interface ControlesDelDocumento {
  readonly nationalId: AbstractControl<string>;
  readonly issuerAdministrativeAreaConceptId: AbstractControl<string | null>;
}

/**
 * La forma corta de construirlo desde una pantalla de alta (inicializador de
 * campo): toma el cliente del inyector y los controles por su nombre.
 */
export function vigilarDocumento(
  kind: DocumentHolderKind,
  controles: ControlesDelDocumento,
): DisponibilidadDeDocumento {
  return new DisponibilidadDeDocumento(
    inject(DocumentAvailabilityClient),
    kind,
    controles.nationalId,
    controles.issuerAdministrativeAreaConceptId,
  );
}

/**
 * Engancha la consulta de disponibilidad al par documento + departamento.
 *
 * Se construye en contexto de inyección (inicializador de campo del
 * componente): usa `takeUntilDestroyed` y `toSignal`.
 */
export class DisponibilidadDeDocumento {
  /** Para dibujar el estado debajo del campo (`data-testid="documento-disponibilidad"`). */
  readonly estado: Signal<EstadoDeDocumento>;

  private readonly sinRespuesta = signal(false);

  constructor(
    private readonly cliente: DocumentAvailabilityClient,
    private readonly kind: DocumentHolderKind,
    private readonly documento: AbstractControl<string>,
    private readonly departamento: AbstractControl<string | null>,
  ) {
    documento.addAsyncValidators(this.validador());

    // El departamento es la otra mitad del documento: cambiarlo vuelve a
    // preguntar por el mismo número.
    departamento.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      documento.updateValueAndValidity();
    });

    this.estado = toSignal(
      merge(documento.statusChanges, departamento.valueChanges).pipe(
        startWith(null),
        map(() => this.calcular()),
      ),
      { initialValue: 'sin-dato' },
    );
  }

  /**
   * El campo del motor que dibuja la línea de estado, debajo del par número +
   * departamento. Sin control propio: la pantalla proyecta
   * `app-document-availability-status` con esta misma clave.
   */
  readonly campo: CampoDeFormulario = {
    key: 'documentoDisponibilidad',
    label: '',
    control: 'custom',
  };

  /** Tras un 409 del envío por CI repetido, vuelve a preguntar y marca el campo. */
  trasError(error: unknown): void {
    if (!esErrorDeDocumentoYaRegistrado(error)) return;
    this.documento.markAsTouched();
    this.documento.updateValueAndValidity();
  }

  private validador(): AsyncValidatorFn {
    return (control): Observable<ValidationErrors | null> => {
      const numero = String(control.value ?? '').trim();
      const departamento = this.departamento.value;
      this.sinRespuesta.set(false);
      if (numero === '' || departamento === null || departamento === '') return of(null);

      return timer(ANTIRREBOTE_MS).pipe(
        switchMap(() =>
          this.cliente.check({ number: numero, issuer: departamento, userType: this.kind }),
        ),
        map(({ available }) =>
          available ? null : { [DOCUMENTO_TOMADO]: true, mensajePropio: MENSAJE_TOMADO[this.kind] },
        ),
        catchError(() => {
          this.sinRespuesta.set(true);
          return of(null);
        }),
      );
    };
  }

  private calcular(): EstadoDeDocumento {
    const control = this.documento;
    const numero = String(control.value ?? '').trim();
    // Un formato inválido ya lo dice el campo: no hay nada que consultar.
    if (numero === '' || control.hasError('pattern') || control.hasError('required')) {
      return 'sin-dato';
    }
    const departamento = this.departamento.value;
    if (departamento === null || departamento === '') return 'falta-departamento';
    if (control.pending) return 'comprobando';
    if (control.hasError(DOCUMENTO_TOMADO)) return 'tomado';
    if (this.sinRespuesta()) return 'sin-respuesta';
    return 'libre';
  }
}
