import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, map, switchMap, type Observable } from 'rxjs';

import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import {
  MedicalCenterRegistrationClient,
  type MedicalCenterRegistration,
} from '../../../core/data-access/iam/medical-center-registration.client';
import { readApiError } from '../../../core/http/api-error';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import {
  MENSAJE_CONTRASENA_CORTA,
  MIN_CARACTERES_CONTRASENA,
} from '../registro-compartido/politica-de-contrasena';
import { RegistrationBadge } from '../registro-compartido/registration-badge';
import { codigoDelCentroMedico } from './medical-center-code';

/** Dónde se leen el país y la jurisdicción: los mismos catálogos públicos del alta de laboratorio. */
const DESTINO_PAIS = 'directory.tenants.country_concept_id';
const DESTINO_JURISDICCION = 'profiles.jurisdiction_authorizations.jurisdiction_concept_id';

/** Los códigos estables de esos conceptos. */
const CODIGO_PAIS = 'BO';
const CODIGO_JURISDICCION = 'JURISDICTION_NATIONAL';

/** Lo que dice la pantalla cuando un catálogo no sirve. */
const AVISO_CATALOGO = 'No pudimos cargar los catálogos del alta. Revise su conexión y vuelva a enviar.';

const MAX_RAZON_SOCIAL = 300;
const MAX_CORREO = 320;
const MAX_NOMBRE = 200;

/** Lo que se escribe, todavía como texto. */
interface FormularioDelAlta {
  readonly legalName: string;
  readonly legalEntityType: string;
  readonly ownerName: string;
  readonly email: string;
  readonly password: string;
}

const VACIO: FormularioDelAlta = {
  legalName: '',
  legalEntityType: '',
  ownerName: '',
  email: '',
  password: '',
};

/** Un error de la API, en castellano y sin tecnicismos. */
export function mensajeDelAlta(error: unknown): string {
  if (error instanceof Error && error.message === AVISO_CATALOGO) {
    return AVISO_CATALOGO;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No pudimos conectarnos. Revise su conexión e intente de nuevo.';
    }
    if (error.status === 409) {
      return 'Ya existe una cuenta con ese correo o una organización con ese nombre. Pruebe con otros datos.';
    }
    if (error.status === 400 || error.status === 422) {
      return readApiError(error)?.message ?? 'Revise los datos del formulario.';
    }
  }
  return 'No pudimos completar el registro. Intente de nuevo en unos segundos.';
}

/**
 * **Alta de un centro médico** (CM-11): una clínica u hospital crea su cuenta.
 *
 * ## Qué manda y por qué así
 *
 * `POST /iam/auth/register-organization` con `tenantType: 'HOSPITAL'`, un tipo
 * de salud que la API ya tiene: no hay un tipo nuevo en IAM. Como `HOSPITAL` es
 * territorial, la API exige país y jurisdicción; se leen de los catálogos
 * públicos y se resuelven **por código**, igual que el alta del laboratorio.
 *
 * El código de la organización no se pide: sale de la razón social.
 *
 * ## Qué pasa después
 *
 * La organización nace **pendiente de verificación**. Hasta que la plataforma
 * la verifique no puede abrir su práctica ni su primera sede
 * (`medical-center-setup`), y la pantalla de éxito se lo dice.
 */
@Component({
  selector: 'app-register-medical-center',
  imports: [Alert, AnnounceOnAppear, AppButton, AuthSplit, FormField, Input, RegistrationBadge, Select],
  templateUrl: './register-medical-center.html',
  styleUrls: ['../registro-compartido/registro.css', './register-medical-center.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterMedicalCenter {
  private readonly client = inject(MedicalCenterRegistrationClient);
  private readonly context = inject(SystemContextClient);
  private readonly legalEntityTypes = inject(LegalEntityTypesCatalog);
  private readonly router = inject(Router);

  protected readonly claim = 'Sume su centro médico a la red';
  protected readonly tagline =
    'Publique sus procedimientos y afilie a sus médicos para que los pacientes lo encuentren.';

  protected readonly razonMax = MAX_RAZON_SOCIAL;
  protected readonly correoMax = MAX_CORREO;
  protected readonly nombreMax = MAX_NOMBRE;
  protected readonly claveMin = MIN_CARACTERES_CONTRASENA;

  protected readonly form = signal<FormularioDelAlta>(VACIO);
  protected readonly submitted = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly registered = signal(false);
  protected readonly verificationSent = signal(false);

  /** Los tipos societarios de Bolivia, del mismo catálogo que las demás altas. */
  private readonly tiposCrudos = signal<readonly SelectOption<string>[]>([]);
  protected readonly opcionesTipoSocietario = computed<readonly SelectOption<string>[]>(() =>
    this.tiposCrudos(),
  );

  protected readonly errores = computed(() => {
    const f = this.form();
    return {
      legalName: f.legalName.trim() === '' ? 'Escriba la razón social del centro.' : '',
      legalEntityType: f.legalEntityType === '' ? 'Elija el tipo societario.' : '',
      ownerName: f.ownerName.trim() === '' ? 'Escriba el nombre de quien administra la cuenta.' : '',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? '' : 'Escriba un correo válido.',
      password: f.password.length >= MIN_CARACTERES_CONTRASENA ? '' : MENSAJE_CONTRASENA_CORTA,
    };
  });

  protected readonly valido = computed(() => Object.values(this.errores()).every((e) => e === ''));

  constructor() {
    this.legalEntityTypes.listar().subscribe({
      next: (opciones) => this.tiposCrudos.set(this.legalEntityTypes.opcionesPorPais(opciones, 'BO')),
      error: () => this.tiposCrudos.set([]),
    });
  }

  protected set<K extends keyof FormularioDelAlta>(campo: K, valor: string | number | null): void {
    this.form.update((f) => ({ ...f, [campo]: String(valor ?? '') }));
  }

  protected mostrar(campo: keyof FormularioDelAlta): string {
    return this.submitted() ? this.errores()[campo] : '';
  }

  submit(): void {
    if (this.isSubmitting()) return;
    this.submitted.set(true);
    if (!this.valido()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.catalogos()
      .pipe(switchMap((ids) => this.client.register(this.datos(ids))))
      .subscribe({
        next: (resultado) => {
          this.isSubmitting.set(false);
          this.verificationSent.set(resultado.emailVerificationSent);
          this.registered.set(true);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(mensajeDelAlta(error));
        },
      });
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  /** Lee los dos catálogos y resuelve los ids por código. Un fallo corta con el aviso. */
  private catalogos(): Observable<{ pais: string; jurisdiccion: string }> {
    const porCodigo = (destino: string, codigo: string) =>
      this.context.dynamicEnum(destino).pipe(
        map((enumeracion) => {
          const id = enumeracion.options.find((opcion) => opcion.code === codigo)?.conceptId;
          if (id === undefined) throw new Error(AVISO_CATALOGO);
          return id;
        }),
      );
    return forkJoin({
      pais: porCodigo(DESTINO_PAIS, CODIGO_PAIS),
      jurisdiccion: porCodigo(DESTINO_JURISDICCION, CODIGO_JURISDICCION),
    });
  }

  private datos(ids: { pais: string; jurisdiccion: string }): MedicalCenterRegistration {
    const f = this.form();
    return {
      code: codigoDelCentroMedico(f.legalName),
      legalName: f.legalName.trim(),
      legalEntityType: f.legalEntityType,
      countryConceptId: ids.pais,
      jurisdictionConceptId: ids.jurisdiccion,
      owner: {
        email: f.email.trim(),
        password: f.password,
        displayName: f.ownerName.trim(),
      },
    };
  }
}
