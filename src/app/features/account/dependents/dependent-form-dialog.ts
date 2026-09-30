import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type {
  DependentCandidate,
  DependentLinkTarget,
} from '../../../core/data-access/profiles/profiles.types';
import { readApiError } from '../../../core/http/api-error';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * El documento admite letras, dígitos, punto y guion; lo mismo que el alta.
 * Los espacios de los bordes se toleran porque se recortan al enviar: un CI
 * pegado desde otro lado suele traerlos.
 */
const DOCUMENTO = /^\s*[A-Za-z0-9.-]+\s*$/;

/** Cómo se señala a la persona: escribiendo su CI o buscándola por nombre. */
type Modo = 'ci' | 'nombre';

/** Lo que se le cuenta a la pantalla cuando la solicitud salió. */
export interface SolicitudEnviada {
  /** A quién, dicho para una frase: «la cuenta con CI 5009871» o «Ana Pérez». */
  readonly destinatario: string;
}

/** Con menos letras la búsqueda devolvería medio padrón. */
const MINIMO_BUSQUEDA = 3;

/**
 * Alta de un dependiente: se señala a la persona por su CI o buscándola por
 * nombre.
 *
 * Si hay una cuenta registrada, a esa cuenta le llega una notificación y el
 * vínculo nace cuando la acepta. Si no la hay, se dice acá, junto al campo.
 *
 * La búsqueda por nombre devuelve pocas cuentas con el CI enmascarado y nunca
 * dice si ya hay una solicitud en curso: eso se entera recién al enviarla.
 */
@Component({
  selector: 'app-dependent-form-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Input,
    Alert,
    FormField,
    ContentDialog,
    SearchField,
    SegmentedControl,
  ],
  templateUrl: './dependent-form-dialog.html',
  styleUrl: './dependents.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DependentFormDialog {
  /** A quién se le envió la solicitud. */
  readonly sent = output<SolicitudEnviada>();
  readonly closed = output<void>();

  private readonly profiles = inject(ProfilesClient);
  private readonly fb = inject(FormBuilder);

  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** El error del servidor que es sobre el CI escrito, para mostrarlo en el campo. */
  protected readonly errorDelCampo = signal<string | null>(null);

  protected readonly modos: readonly SegmentedOption<Modo>[] = [
    { value: 'ci', label: 'Por CI' },
    { value: 'nombre', label: 'Por nombre' },
  ];
  protected readonly modo = signal<Modo>('ci');

  /** Lo escrito en la búsqueda por nombre. */
  protected readonly consulta = signal('');
  protected readonly buscando = signal(false);
  /** `null` mientras no se buscó nada; `[]` es «buscó y no hay». */
  protected readonly candidatos = signal<readonly DependentCandidate[] | null>(null);
  protected readonly elegido = signal<DependentCandidate | null>(null);
  protected readonly errorBusqueda = signal<string | null>(null);
  private busqueda: Subscription | null = null;

  protected readonly form = this.fb.nonNullable.group({
    nationalId: [
      '',
      [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(40),
        Validators.pattern(DOCUMENTO),
      ],
    ],
  });

  constructor() {
    this.form.controls.nationalId.valueChanges.subscribe(() => this.errorDelCampo.set(null));
    inject(DestroyRef).onDestroy(() => this.busqueda?.unsubscribe());
  }

  protected mensajeDelCampo(): string {
    const control = this.form.controls.nationalId;
    if (this.errorDelCampo() !== null) return this.errorDelCampo()!;
    if (!control.touched || control.valid) return '';
    if (control.hasError('required')) return 'Escribí el CI de la persona.';
    return 'El CI sólo admite letras, dígitos, punto y guion (4 a 40 caracteres).';
  }

  protected cambiarModo(modo: Modo): void {
    this.modo.set(modo);
    this.errorMessage.set(null);
  }

  /**
   * Busca cuentas por nombre. Una búsqueda nueva descarta la anterior: si la
   * respuesta lenta de «An» llegara después de la de «Ana», pisaría la buena.
   */
  protected buscar(texto: string): void {
    this.busqueda?.unsubscribe();
    this.elegido.set(null);
    this.errorBusqueda.set(null);
    const consulta = texto.trim();
    if (consulta.length < MINIMO_BUSQUEDA) {
      this.buscando.set(false);
      this.candidatos.set(null);
      return;
    }
    this.buscando.set(true);
    this.busqueda = this.profiles.searchDependentCandidates(consulta).subscribe({
      next: (filas) => {
        this.buscando.set(false);
        this.candidatos.set(filas);
      },
      error: () => {
        this.buscando.set(false);
        this.candidatos.set(null);
        this.errorBusqueda.set('No pudimos buscar en este momento. Intentá de nuevo.');
      },
    });
  }

  protected elegir(candidato: DependentCandidate): void {
    this.elegido.set(candidato);
    this.errorMessage.set(null);
  }

  protected submit(): void {
    if (this.saving()) return;
    let destino: DependentLinkTarget;
    let destinatario: string;
    if (this.modo() === 'nombre') {
      const candidato = this.elegido();
      // Enter en el buscador también dispara el envío del formulario: sin
      // nadie elegido no hay nada que enviar.
      if (candidato === null) return;
      destino = { patientProfileId: candidato.patientProfileId };
      destinatario = candidato.displayName;
    } else {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }
      const documento = this.form.controls.nationalId.value.trim();
      destino = { nationalId: documento };
      destinatario = `la cuenta con CI ${documento}`;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.errorDelCampo.set(null);

    this.profiles.requestDependentLink(destino).subscribe({
      next: () => {
        this.saving.set(false);
        this.sent.emit({ destinatario });
        this.dialog().close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const { mensaje, delCampo } = mensajeDeError(error);
        if (delCampo && this.modo() === 'ci') {
          this.errorDelCampo.set(mensaje);
          this.form.controls.nationalId.markAsTouched();
        } else {
          this.errorMessage.set(mensaje);
        }
      },
    });
  }
}

/**
 * Qué decirle a quien no pudo enviar la solicitud, y si es sobre el CI.
 *
 * «No hay cuenta», «es tu propio CI» y «ya es tu dependiente» hablan del dato
 * escrito, así que van al campo. Lo demás es un fallo de la operación.
 */
function mensajeDeError(error: unknown): { mensaje: string; delCampo: boolean } {
  if (error instanceof HttpErrorResponse) {
    const api = readApiError(error);
    if (error.status === 404) {
      return {
        mensaje: api?.message ?? 'No hay ninguna cuenta registrada con ese CI.',
        delCampo: true,
      };
    }
    if (api !== null && (error.status === 409 || error.status === 422 || error.status === 400)) {
      return { mensaje: api.message, delCampo: true };
    }
    return {
      mensaje: api?.message ?? 'No se pudo enviar la solicitud. Intentá de nuevo.',
      delCampo: false,
    };
  }
  return { mensaje: 'No se pudo enviar la solicitud. Intentá de nuevo.', delCampo: false };
}
