import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import {
  TENANT_TYPE_CODES,
  TENANT_TYPE_LABELS,
  TERRITORIAL_TENANT_TYPES,
  type NewTenant,
  type TenantTypeCode,
} from '../../../../core/data-access/directory/directory.types';
import { IamClient } from '../../../../core/data-access/iam/iam.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { CampoPersonalizado } from '../../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../../shared/forms/paginated/paginar-campos';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE } from '../organizations.routes';

/** Largos que declara `CreateTenantDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;
const MAX_ZONA_HORARIA = 100;
const MAX_CODIGO_ASEGURADORA = 60;
const MAX_REGULADOR = 100;
const MAX_SIGLA = 20;
const MAX_DIRECCION = 300;
const MAX_CODIGO_CORREDOR = 60;
const MAX_LICENCIA = 100;

/** Cuántos candidatos trae cada búsqueda del combobox de owner. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Alta de una organización raíz — vista **V04-01·F**
 * (`POST /admin/tenants`, UC-04-01). Sólo `SUPERADMIN`.
 *
 * ## El tipo manda sobre el formulario
 *
 * `PAYER` exige el bloque de aseguradora y `BROKER` el de corredor — y el
 * backend **rechaza** esos bloques en cualquier otro tipo. Por eso los
 * bloques aparecen y se validan sólo cuando el tipo elegido los pide, y al
 * enviar se manda únicamente el que corresponde.
 *
 * ## El selector de tipo usa los códigos del DTO
 *
 * Y **se quedan**, ahora que `dynamic-enums` existe. Se comparó (2026-08-11,
 * contra la API viva) `directory.tenants.tenant_type_concept_id` con la lista
 * de `CreateTenantDto`: **los diez códigos coinciden, en los dos sentidos**.
 *
 * Reemplazarla por una lectura habría cambiado una lista tipada por una obtenida
 * en tiempo de ejecución, y esa lista **no es sólo un selector**: alimenta
 * `TERRITORIAL_TENANT_TYPES`, la regla que decide si país y jurisdicción son
 * obligatorios. Con `TenantTypeCode` el compilador garantiza que las dos hablan
 * de lo mismo; con códigos traídos de la red, un valor nuevo entraría al
 * desplegable y saldría de la regla **en silencio**, y el alta fallaría con un
 * 422 que nadie relacionaría con esto.
 *
 * Además el endpoint recibe el **código**, no el concept id: la lectura no
 * ahorraría ninguna traducción. Se documenta la comparación en vez de hacer el
 * cambio.
 *
 * ## País y jurisdicción se ofrecen porque sin ellos no hay alta
 *
 * Verificado contra la API viva: para los ocho tipos territoriales el backend
 * responde `422 · «exige país y jurisdicción»`. Se resuelven con un buscador
 * sobre la búsqueda de conceptos de `terminology` — el mismo trato que
 * cualquier referencia: se elige una etiqueta, se guarda un uuid.
 * **Sigue sin poder acotarse, y está comprobado** (2026-08-11, contra la API
 * viva): `directory.tenants.country_concept_id` y `…jurisdiction_concept_id`
 * responden **404** en `dynamic-enums` — no tienen binding declarado, a
 * diferencia del tipo de organización, que sí lo tiene. Hasta que lo tengan, la
 * búsqueda es sobre el catálogo entero y el código es la pista.
 *
 * ## Los `*ConceptId` opcionales siguen afuera
 *
 * Entidad legal y región de datos son opcionales y sin value set publicado —
 * la misma deuda, y la misma decisión, que en el alta de paciente.
 */
/** Los cuatro campos que sólo pide una aseguradora. */
const CAMPOS_DE_ASEGURADORA = [
  'carrierCode',
  'regulatorIdentifier',
  'sigla',
  'address',
] as const;

/** Los dos que sólo pide un corredor. */
const CAMPOS_DE_CORREDOR = ['brokerCode', 'licenseNumber'] as const;

@Component({
  selector: 'app-organization-new',
  imports: [
    Alert,
    AnnounceOnAppear,
    CampoPersonalizado,
    PageHeader,
    PaginatedForm,
    ReferenceCombobox,
  ],
  templateUrl: './organization-new.html',
  styleUrl: './organization-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationNew {
  private readonly directory = inject(DirectoryClient);
  private readonly iam = inject(IamClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** El último escalón se reemplaza: desde el alta, se vuelve al listado. */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: ORGANIZATIONS_ROUTE },
      { label: 'Nueva' },
    ];
  });

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO)],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    tradeName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NOMBRE)],
    }),
    timeZone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_ZONA_HORARIA)],
    }),
    /**
     * El tipo vivía en una señal aparte porque el selector trabajaba con el
     * valor tipado; con el motor todo escribe en el grupo, y de él dependen las
     * páginas que existen.
     */
    tipo: new FormControl<TenantTypeCode | null>(null, {
      validators: [Validators.required],
    }),

    /* -- Bloque de aseguradora. Sólo cuenta cuando el tipo es `PAYER`. ------ */
    carrierCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO_ASEGURADORA)],
    }),
    regulatorIdentifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_REGULADOR)],
    }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SIGLA)],
    }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),

    /* -- Bloque de corredor. Sólo cuenta cuando el tipo es `BROKER`. -------- */
    brokerCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODIGO_CORREDOR)],
    }),
    licenseNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_LICENCIA)],
    }),
  });

  constructor() {
    // Se engancha al `valueChanges` y no a un `effect`: el efecto corre en la
    // cola de Angular, así que entre elegir el tipo y enviar habría un instante
    // con el bloque equivocado habilitado. Acá el cambio es inmediato.
    this.form.controls.tipo.valueChanges.subscribe((tipo) => this.aplicarTipo(tipo));
    this.aplicarTipo(this.form.controls.tipo.value);
  }

  /**
   * Apaga los bloques que el tipo no pide.
   *
   * Vivían en dos `FormGroup` aparte y sólo se validaban si el tipo coincidía;
   * ahora están en el mismo grupo —el motor escribe siempre en uno— y la misma
   * regla se consigue deshabilitándolos: un control deshabilitado no cuenta
   * para la validez del grupo, y `getRawValue()` lo sigue leyendo. Sin esto, un
   * alta de farmacia nunca sería válida por faltarle el NIT de una aseguradora.
   */
  private aplicarTipo(tipo: TenantTypeCode | null): void {
    for (const nombre of CAMPOS_DE_ASEGURADORA) {
      const control = this.form.controls[nombre];
      if (tipo === 'PAYER') control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    for (const nombre of CAMPOS_DE_CORREDOR) {
      const control = this.form.controls[nombre];
      if (tipo === 'BROKER') control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
  }



  /** El tipo elegido, como señal, para que las páginas reaccionen a él. */
  protected readonly tipo = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });

  /**
   * Las páginas, que **dependen del tipo elegido**.
   *
   * El tipo decide qué exige el alta: una aseguradora declara su NIT y su
   * sigla, un corredor su licencia, y los territoriales dónde operan. Preguntar
   * todo siempre sería pedir catorce datos de los que sobran seis, y el backend
   * **rechaza** los bloques que no corresponden.
   *
   * Los tres buscadores —país, jurisdicción y owner— van como campos `custom`:
   * son comboboxes con búsqueda contra la API, no controles de texto.
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'Identificación',
        hint: 'Con qué se la encuentra y cómo se presenta.',
        campos: [
          {
            key: 'code',
            label: 'Código',
            hint: 'Único en toda la plataforma. Es sobre lo que ordena el listado.',
            control: 'text' as const,
            required: true,
            testId: 'alta-organizacion-codigo',
            mensajeDeError: this.codigoEnConflicto()
              ? 'Ya existe una organización con este código. Probá con otro.'
              : 'Escribí el código de la organización.',
          },
          {
            key: 'legalName',
            label: 'Razón social',
            control: 'text' as const,
            required: true,
            testId: 'alta-organizacion-razon',
            mensajeDeError: 'Escribí la razón social (hasta 300 caracteres).',
          },
          {
            key: 'tradeName',
            label: 'Nombre comercial',
            hint: 'Opcional. Cómo la conoce la gente, si difiere de la razón social.',
            control: 'text' as const,
            testId: 'alta-organizacion-comercial',
            mensajeDeError: 'El nombre comercial no puede superar los 300 caracteres.',
          },
        ],
      },
      {
        titulo: 'Clasificación',
        hint: 'El tipo decide qué datos exige el alta y cómo opera la organización.',
        campos: [
          {
            key: 'tipo',
            label: 'Tipo de organización',
            control: 'select' as const,
            required: true,
            options: this.opcionesDeTipo,
            placeholder: 'Elegí un tipo',
            mensajeDeError: 'Elegí el tipo de organización.',
          },
        ],
      },
      ...(this.esTerritorial()
        ? [
            {
              titulo: 'Dónde opera',
              hint: 'El backend lo exige para este tipo: determina bajo qué regulador presta atención.',
              campos: [
                {
                  key: 'pais',
                  label: 'País',
                  hint: 'Buscá por nombre; el código acompaña para distinguir homónimos.',
                  control: 'custom' as const,
                  required: true,
                },
                {
                  key: 'jurisdiccion',
                  label: 'Jurisdicción',
                  hint: 'La jurisdicción regulatoria, por ejemplo «Bolivia · JUR_BO».',
                  control: 'custom' as const,
                  required: true,
                },
              ],
            },
          ]
        : []),
      ...(this.esAseguradora()
        ? [
            {
              titulo: 'Datos de la aseguradora',
              hint: 'El backend los exige para este tipo: identifican a la aseguradora ante su regulador.',
              campos: [
                {
                  key: 'carrierCode',
                  label: 'Código de aseguradora',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Escribí el código de aseguradora.',
                },
                {
                  key: 'regulatorIdentifier',
                  label: 'NIT',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Escribí el NIT ante el regulador.',
                },
                {
                  key: 'sigla',
                  label: 'Sigla',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Escribí la sigla (hasta 20 caracteres).',
                },
                {
                  key: 'address',
                  label: 'Dirección',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Escribí la dirección (hasta 300 caracteres).',
                },
              ],
            },
          ]
        : []),
      ...(this.esCorredor()
        ? [
            {
              titulo: 'Datos del corredor',
              hint: 'El backend los exige para este tipo: identifican al corredor ante su regulador.',
              campos: [
                {
                  key: 'brokerCode',
                  label: 'Código de corredor',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Escribí el código de corredor.',
                },
                {
                  key: 'licenseNumber',
                  label: 'Número de licencia',
                  control: 'text' as const,
                  required: true,
                  mensajeDeError: 'Escribí el número de licencia.',
                },
              ],
            },
          ]
        : []),
      {
        titulo: 'Titularidad',
        hint: 'Quién queda como owner inicial. La membresía se crea en la misma operación.',
        campos: [
          {
            key: 'owner',
            label: 'Usuario owner',
            hint: 'Buscá por nombre o correo. Debe existir antes del alta.',
            control: 'custom' as const,
            required: true,
          },
        ],
      },
      {
        titulo: 'Datos operativos',
        hint: 'Se pueden completar después.',
        campos: [
          {
            key: 'timeZone',
            label: 'Zona horaria',
            hint: 'Opcional, en formato IANA (por ejemplo, America/La_Paz).',
            control: 'text' as const,
            testId: 'alta-organizacion-zona',
            mensajeDeError: 'La zona horaria no puede superar los 100 caracteres.',
          },
        ],
      },
    ]),
  );

  /** Marca que el envío ya se intentó, para mostrar los faltantes no tocados. */
  private readonly enviado = signal(false);

  protected readonly opcionesDeTipo: readonly SelectOption<TenantTypeCode>[] =
    TENANT_TYPE_CODES.map((code) => ({ value: code, label: TENANT_TYPE_LABELS[code] }));

  protected readonly esAseguradora = computed(() => this.tipo() === 'PAYER');
  protected readonly esCorredor = computed(() => this.tipo() === 'BROKER');

  /** Prestadores, farmacias, hospitales…: los que declaran dónde operan. */
  protected readonly esTerritorial = computed(() => {
    const tipo = this.tipo();
    return tipo !== null && TERRITORIAL_TENANT_TYPES.includes(tipo);
  });

  protected readonly tipoFaltante = computed(() => this.enviado() && this.tipo() === null);

  /* ---- país y jurisdicción: obligatorios para los tipos territoriales ---- */

  protected readonly pais = signal<ReferenceOption | null>(null);
  protected readonly candidatosPais = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoPais = signal(false);

  protected readonly jurisdiccion = signal<ReferenceOption | null>(null);
  protected readonly candidatosJurisdiccion = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoJurisdiccion = signal(false);

  protected readonly paisFaltante = computed(
    () => this.enviado() && this.esTerritorial() && this.pais() === null,
  );
  protected readonly jurisdiccionFaltante = computed(
    () => this.enviado() && this.esTerritorial() && this.jurisdiccion() === null,
  );

  protected buscarPais(texto: string): void {
    this.buscarConcepto(texto, this.candidatosPais, this.buscandoPais);
  }

  protected buscarJurisdiccion(texto: string): void {
    this.buscarConcepto(texto, this.candidatosJurisdiccion, this.buscandoJurisdiccion);
  }

  /**
   * Busca conceptos y los traduce a opciones, con el **código como pista**:
   * la búsqueda es sobre el catálogo entero —estas dos columnas no tienen
   * binding en `dynamic-enums`, comprobado— así que «Bolivia» también trae la
   * moneda: el código `JUR_BO`
   * contra `BOB` es lo que permite elegir el correcto.
   */
  private buscarConcepto(
    texto: string,
    destino: { set: (opciones: readonly ReferenceOption[]) => void },
    cargando: { set: (valor: boolean) => void },
  ): void {
    if (texto === '') {
      destino.set([]);
      return;
    }

    cargando.set(true);
    this.terminology.searchConcepts({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        destino.set(
          pagina.items.map((concepto) => ({
            value: concepto.conceptId,
            label: concepto.display,
            hint: concepto.code,
          })),
        );
        cargando.set(false);
      },
      error: () => {
        destino.set([]);
        cargando.set(false);
      },
    });
  }

  /* ---- owner: se elige, nunca se tipea ---------------------------------- */

  protected readonly owner = signal<ReferenceOption | null>(null);
  protected readonly candidatosOwner = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoOwner = signal(false);

  protected readonly ownerFaltante = computed(() => this.enviado() && this.owner() === null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Sólo una cuenta SUPERADMIN puede dar de alta organizaciones.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /**
   * Si el fallo apunta al código: es el único campo con clave única global,
   * así que un `409` sólo puede venir de él.
   */
  protected readonly codigoEnConflicto = computed(() => {
    const state = this.state();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  /**
   * Busca usuarios y los traduce a opciones. El `hint` distingue una cuenta
   * sin verificar: elegir de owner a alguien que nunca activó su correo es un
   * error que conviene ver antes de guardar.
   */
  protected buscarOwner(texto: string): void {
    if (texto === '') {
      this.candidatosOwner.set([]);
      return;
    }

    this.buscandoOwner.set(true);
    this.iam.searchUsers({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.candidatosOwner.set(
          pagina.items.map((usuario) => ({
            value: usuario.id,
            label: usuario.displayName,
            ...(usuario.emailVerified ? {} : { hint: 'Correo sin verificar' }),
          })),
        );
        this.buscandoOwner.set(false);
      },
      error: () => {
        // El combobox muestra «sin resultados»; el error general de la
        // pantalla se reserva para el envío.
        this.candidatosOwner.set([]);
        this.buscandoOwner.set(false);
      },
    });
  }

  protected cambiarTipo(tipo: TenantTypeCode | null): void {
    this.form.controls.tipo.setValue(tipo);
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    this.enviado.set(true);

    if (!this.puedeEnviar()) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.directory.createTenant(this.datos()).subscribe({
      next: (creada) => {
        this.state.set(ready(null));
        this.toast.success(
          `«${creada.legalName}» quedó registrada y pendiente de verificación.`,
          'Organización creada',
        );
        // Al listado: la verificación que sigue es de otro rol y otra pantalla.
        void this.router.navigateByUrl(ORGANIZATIONS_ROUTE);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(ORGANIZATIONS_ROUTE);
  }

  private puedeEnviar(): boolean {
    if (this.form.invalid || this.tipo() === null || this.owner() === null) {
      return false;
    }
    if (this.esTerritorial() && (this.pais() === null || this.jurisdiccion() === null)) {
      return false;
    }
    // Los bloques por tipo ya entran en `this.form.invalid`: el efecto de
    // arriba apaga el que no corresponde, y un control apagado no cuenta.
    return true;
  }

  /**
   * El cuerpo de la petición. Los opcionales vacíos no se mandan, y de los
   * bloques por tipo viaja **sólo** el que el tipo exige: el backend rechaza
   * un bloque `payer` en una farmacia.
   */
  private datos(): NewTenant {
    const valores = this.form.getRawValue();
    const { code, legalName, tradeName, timeZone } = valores;
    // `puedeEnviar` ya garantizó ambos; el `?? ''` de abajo nunca corre y sólo
    // le consta al compilador.
    const tipo = this.tipo() ?? 'PROVIDER';
    const owner = this.owner();

    // De los campos por tipo viaja sólo lo que el tipo exige: el backend
    // rechaza un bloque `payer` —o un país— donde no corresponde.
    const territorial = this.esTerritorial();
    const pais = this.pais();
    const jurisdiccion = this.jurisdiccion();

    return {
      code: code.trim(),
      legalName: legalName.trim(),
      ownerUserId: owner?.value ?? '',
      tenantType: tipo,
      ...(tradeName.trim() === '' ? {} : { tradeName: tradeName.trim() }),
      ...(timeZone.trim() === '' ? {} : { timeZone: timeZone.trim() }),
      ...(territorial && pais !== null ? { countryConceptId: pais.value } : {}),
      ...(territorial && jurisdiccion !== null
        ? { jurisdictionConceptId: jurisdiccion.value }
        : {}),
      ...(tipo === 'PAYER'
        ? {
            payer: {
              carrierCode: valores.carrierCode.trim(),
              regulatorIdentifier: valores.regulatorIdentifier.trim(),
              sigla: valores.sigla.trim(),
              address: valores.address.trim(),
            },
          }
        : {}),
      ...(tipo === 'BROKER'
        ? {
            broker: {
              brokerCode: valores.brokerCode.trim(),
              licenseNumber: valores.licenseNumber.trim(),
            },
          }
        : {}),
    };
  }
}
