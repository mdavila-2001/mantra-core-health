import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { SessionStore } from '../../core/auth/session.store';
import { FilesClient } from '../../core/data-access/files/files.client';
import { IdentityClient } from '../../core/data-access/identity/identity.client';
import type {
  VerificationCase,
  VerificationRequest,
  VerificationRequestResult,
} from '../../core/data-access/identity/identity.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import { AppButton } from '../../shared/components/atoms/button/button';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Select } from '../../shared/components/atoms/select/select';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FileInput } from '../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../shared/components/molecules/radio-group/radio-group';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../shared/components/organisms/status-seal/status-seal';
import { CaseStatusCatalog, toCaseStatusPresentation } from './case-status';

/** Lo máximo que admite una evidencia. Un documento no pesa más que esto. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Los cuatro trámites de autoservicio del M27. El backend resuelve el sujeto
 * del token en todos: el trámite solo elige el endpoint, nunca a quién.
 */
const TRAMITES = ['patient', 'practitioner', 'license', 'tenant'] as const;

type Tramite = (typeof TRAMITES)[number];

function esTramite(valor: unknown): valor is Tramite {
  return typeof valor === 'string' && (TRAMITES as readonly string[]).includes(valor);
}

interface TextosDelTramite {
  readonly titulo: string;
  readonly texto: string;
  readonly label: string;
}

const DOCUMENTO_DE_IDENTIDAD: TextosDelTramite = {
  titulo: 'Tu documento de identidad',
  texto:
    'Una foto o un PDF del documento, de hasta 10 MB. Se guarda como información ' +
    'de salud protegida: solo lo ve quien tiene que revisarlo.',
  label: 'Documento',
};

const TEXTOS_POR_TRAMITE: Record<Tramite, TextosDelTramite> = {
  patient: DOCUMENTO_DE_IDENTIDAD,
  practitioner: DOCUMENTO_DE_IDENTIDAD,
  license: {
    titulo: 'Tu constancia de matrícula',
    texto:
      'La constancia o el título que acredita tu matrícula, en foto o PDF de ' +
      'hasta 10 MB. Se guarda como información protegida.',
    label: 'Constancia',
  },
  tenant: {
    titulo: 'La documentación de la organización',
    texto: 'Un documento que acredite a la organización, en foto o PDF de hasta 10 MB.',
    label: 'Documentación',
  },
};

/**
 * Verificación de identidad del titular.
 *
 * Es la pantalla a la que apunta el estado **S5 «con acción»**: cuando la API
 * responde `IDENTITY_VERIFICATION_REQUIRED`, `errorToViewState` ofrece
 * «Verificar identidad» y esta ruta es su destino.
 *
 * ## El flujo, en dos peticiones
 *
 * ```text
 * FilesClient.upload(evidencia, 'DOCUMENT', 'PHI')  →  { id }
 *       ↓
 * IdentityClient.request…Verification({ evidenceFileId: id })   ← según el trámite
 *       ↓  caseId
 * IdentityClient.getVerificationCase(caseId)        →  estado del caso
 * ```
 *
 * Cubre los cuatro trámites de autoservicio (V27-14/15/16/17): la identidad
 * como paciente o como profesional, la matrícula y una organización propia.
 * Todos comparten el mismo flujo — subir evidencia, abrir caso, esperar el
 * veredicto —, así que son un selector y no cuatro pantallas.
 *
 * ## `PHI` no es opcional acá
 *
 * La evidencia es un documento de identidad: se sube con sensibilidad `PHI`,
 * que cambia cómo se guarda y quién puede descargarla. El parámetro es
 * obligatorio en `FilesClient.upload` justamente para que esta decisión se tome
 * en cada llamada en vez de heredarse de un valor por defecto.
 *
 * ## Nadie puede verificar a otro
 *
 * Ninguna ruta de `identity` recibe a quién se verifica: el backend lo resuelve
 * del usuario autenticado. Por eso esta pantalla no tiene selector de persona,
 * y no es un olvido. La única elección es **cuál de las organizaciones propias**
 * — las del token de sesión — se quiere verificar.
 */
@Component({
  selector: 'app-identity-verification',
  imports: [
    AnnounceOnAppear,
    AppButton,
    Alert,
    Card,
    FileInput,
    FormField,
    PageHeader,
    Radio,
    RadioGroup,
    Select,
    StatusSeal,
  ],
  templateUrl: './identity-verification.html',
  styleUrl: './identity-verification.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityVerification {
  private readonly files = inject(FilesClient);
  private readonly identity = inject(IdentityClient);
  private readonly session = inject(SessionStore);

  /**
   * Resuelve los estados de caso contra terminología.
   *
   * **No se usa: se inyecta.** El catálogo no expone métodos —su trabajo es
   * llenar el mapa que lee `toCaseStatusPresentation`— así que inyectarlo es
   * cómo una pantalla declara «necesito los estados en palabras».
   *
   * Faltaba, y era un defecto de verdad, no de forma: esta pantalla llamaba a
   * `toCaseStatusPresentation` sin que nadie hubiera llenado el catálogo, así
   * que el sello del titular decía **«Desconocido»** en lugar de «Aprobado».
   * Todas las demás pantallas con sello sí lo inyectaban; ésta —la que mira la
   * persona sobre su propio trámite— era la única que no.
   */
  private readonly estadosDeCaso = inject(CaseStatusCatalog);

  protected readonly maxBytes = MAX_BYTES;

  protected readonly tramite = signal<Tramite>('patient');

  protected readonly textos = computed(() => TEXTOS_POR_TRAMITE[this.tramite()]);

  /** Las organizaciones del token: las únicas que se pueden pedir verificar. */
  protected readonly organizaciones = computed<readonly SelectOption<string>[]>(() =>
    this.session.tenants().map((id) => ({ value: id, label: this.session.tenantName(id) })),
  );

  /** Con una sola organización no hay nada que elegir: queda elegida. */
  protected readonly organizacionId = linkedSignal<string | null>(() => {
    const organizaciones = this.organizaciones();
    return organizaciones.length === 1 ? (organizaciones[0]?.value ?? null) : null;
  });

  /** La evidencia elegida. Una sola: el backend espera un archivo. */
  protected readonly evidencia = signal<readonly File[]>([]);

  /** Motivo del último archivo rechazado por los límites del componente. */
  protected readonly rechazo = signal<string | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));

  /** El caso abierto, cuando el envío salió bien. */
  protected readonly caso = signal<VerificationCase | null>(null);

  /** El estado del caso, traducido de UUID de concepto a sello + palabra. */
  protected readonly caseStatus = computed(() => toCaseStatusPresentation(this.caso()?.status));

  /**
   * Los casos anteriores del titular — `GET /identity/me/verification-cases`.
   *
   * El backend lo publica desde siempre y la pantalla no lo pedía: mostraba el
   * caso **de este envío**, así que quien ya se había verificado antes entraba y
   * veía un formulario en blanco, sin ninguna señal de que el trámite ya estaba
   * hecho. Con el historial, la primera pregunta que trae la gente —«¿esto ya lo
   * mandé?»— se responde sin que nadie tenga que preguntar.
   *
   * Del más nuevo al más viejo: el backend no garantiza orden y lo que importa
   * es el último.
   */
  protected readonly historial = signal<readonly VerificationCase[]>([]);

  protected readonly historialOrdenado = computed<readonly VerificationCase[]>(() =>
    [...this.historial()].sort((a, b) => fechaDeCaso(b) - fechaDeCaso(a)),
  );

  /** La presentación de un caso del historial. */
  protected sello(caso: VerificationCase): ReturnType<typeof toCaseStatusPresentation> {
    return toCaseStatusPresentation(caso.status);
  }

  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly sinOrganizaciones = computed(
    () => this.tramite() === 'tenant' && this.organizaciones().length === 0,
  );

  protected readonly puedeEnviar = computed(
    () =>
      this.evidencia().length === 1 &&
      !this.enviando() &&
      (this.tramite() !== 'tenant' || this.organizacionId() !== null),
  );

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No podés iniciar esta verificación.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    this.cargarHistorial();
  }

  /**
   * Pide el historial de casos.
   *
   * El fallo se traga: es contexto, y romper la pantalla del trámite porque el
   * historial no cargó dejaría a la persona sin poder hacer justamente lo que
   * vino a hacer.
   */
  protected cargarHistorial(): void {
    this.identity.listVerificationCases().subscribe({
      next: (casos) => this.historial.set(casos),
      error: () => this.historial.set([]),
    });
  }

  /** El grupo de radios emite `unknown`: solo pasa lo que es un trámite. */
  protected alElegirTramite(valor: unknown): void {
    if (esTramite(valor)) {
      this.tramite.set(valor);
    }
  }

  /**
   * Traduce el rechazo del componente a algo que la persona pueda accionar.
   *
   * `app-file-input` avisa **qué** rechazó y por qué, y deja el mensaje a la
   * pantalla: el componente no sabe qué límite es razonable en este contexto.
   */
  protected alRechazar(rechazados: readonly { file: File; reason: string }[]): void {
    const primero = rechazados[0];
    if (primero === undefined) {
      return;
    }

    this.rechazo.set(
      primero.reason === 'tamaño'
        ? `«${primero.file.name}» pesa más de 10 MB. Probá con una foto más liviana.`
        : primero.reason === 'tipo'
          ? `«${primero.file.name}» no es una imagen ni un PDF.`
          : `No pudimos usar «${primero.file.name}».`,
    );
  }

  /**
   * Sube la evidencia y abre el caso.
   *
   * Las dos peticiones van encadenadas porque la segunda necesita el
   * identificador de la primera. Un fallo en cualquiera de las dos se traduce
   * con el mapeo compartido: esta pantalla no escribe una línea sobre errores
   * de HTTP.
   */
  protected enviar(): void {
    const archivo = this.evidencia()[0];
    if (archivo === undefined || !this.puedeEnviar()) {
      return;
    }

    this.rechazo.set(null);
    this.state.set(loading());

    this.files.upload(archivo, 'DOCUMENT', 'PHI').subscribe({
      next: ({ id }) => this.abrirCaso(id),
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private abrirCaso(evidenceFileId: string): void {
    this.solicitar({ evidenceFileId }).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.caso.set({ id: resultado.caseId, status: resultado.status });
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /** Despacha la solicitud al endpoint del trámite elegido. */
  private solicitar(request: VerificationRequest): Observable<VerificationRequestResult> {
    switch (this.tramite()) {
      case 'patient':
        return this.identity.requestPatientIdentityVerification(request);
      case 'practitioner':
        return this.identity.requestPractitionerIdentityVerification(request);
      case 'license':
        // `jurisdictionAuthorizationId` no se pide: no hay endpoint para buscar
        // matrículas, y omitido el backend usa la única del profesional.
        return this.identity.requestPractitionerLicenseVerification(request);
      case 'tenant':
        return this.identity.requestTenantVerification(this.organizacionRequerida(), request);
    }
  }

  /** `puedeEnviar` exige la organización antes de llegar acá. */
  private organizacionRequerida(): string {
    const organizacion = this.organizacionId();
    if (organizacion === null) {
      throw new Error('No hay organización elegida para verificar.');
    }
    return organizacion;
  }

  /** Vuelve a consultar el caso, para ver si la autoridad ya se expidió. */
  protected actualizarCaso(): void {
    const abierto = this.caso();
    if (abierto === null || this.enviando()) {
      return;
    }

    this.state.set(loading());

    this.identity.getVerificationCase(abierto.id).subscribe({
      next: (caso) => {
        this.state.set(ready(null));
        this.caso.set(caso);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Vuelve al formulario para iniciar otro trámite — un profesional verifica
   * su identidad **y** su matrícula, y son dos casos. La evidencia se descarta:
   * cada trámite lleva su propio documento.
   */
  protected nuevaSolicitud(): void {
    if (this.enviando()) {
      return;
    }

    this.caso.set(null);
    this.evidencia.set([]);
    this.rechazo.set(null);
    this.state.set(ready(null));
  }
}

/**
 * La fecha por la que se ordena un caso del historial.
 *
 * El cierre manda sobre la apertura —un caso resuelto ayer es más reciente que
 * uno abierto la semana pasada y todavía en trámite— y sin ninguna de las dos el
 * caso va al fondo en vez de romper la comparación con un `NaN`.
 */
function fechaDeCaso(caso: VerificationCase): number {
  return caso.completedAt?.getTime() ?? caso.openedAt?.getTime() ?? 0;
}
