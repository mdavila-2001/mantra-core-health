import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { IdentityClient } from '../../../../core/data-access/identity/identity.client';
import type { VerificationCase } from '../../../../core/data-access/identity/identity.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  OwnPatientSummary,
  OwnPractitionerProfile,
} from '../../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import {
  errorToViewState,
  IDENTITY_VERIFICATION_ROUTE,
} from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { WorkHistoryTable } from './work-history-table/work-history-table';
import {
  CaseStatusCatalog,
  toCaseStatusPresentation,
} from '../../../identity-verification/case-status';

/** Largo máximo de la biografía. Es el mismo que ya usaba la pantalla de edición. */
const BIO_LARGO_MAXIMO = 2000;

/** El texto exacto del modal de confirmación, acordado con god y con Dwight. */
const CONFIRMACION = '¿Estás seguro de aplicar estos cambios?';

/**
 * **Configurar mi Perfil** — el contenido de la segunda pestaña de `/my-account`.
 *
 * ## Por qué es un formulario de sólo lectura y no una pantalla aparte
 *
 * Hasta ahora ver el perfil y configurarlo eran dos rutas (`/my-account` y
 * `/my-account/edit`): había que salir de la página, cambiar cuatro campos y
 * volver, y en el medio se perdía de vista lo que se estaba cambiando. El
 * pedido del cliente es el patrón de ficha de siempre: **se ve el perfil como
 * está, y un lápiz lo abre a edición en el mismo lugar**.
 *
 * Los campos NO se ocultan en modo lectura ni se reemplazan por párrafos: son
 * los mismos controles con `readonly`. Cambiar la estructura del DOM al entrar
 * en edición hace saltar la página justo cuando alguien apunta al campo que
 * quiere corregir, y además obliga a mantener dos maquetas del mismo dato.
 *
 * ## Guardar y cancelar pasan los dos por el modal
 *
 * Confirmar al guardar es obvio; confirmar al cancelar lo es menos, pero es lo
 * que pidió el cliente y tiene razón: la X **descarta** lo escrito, y descartar
 * sin preguntar es la forma más barata de perder diez minutos de trabajo. Los
 * dos usan el mismo `DialogService.confirm` con el mismo texto —es la misma
 * pregunta— y el aviso de éxito sale por `ToastService`, que es el patrón que
 * ya usa el resto de la aplicación (y el que la tabla de registros históricos
 * replica).
 *
 * ## Dos sujetos, un componente
 *
 * Un profesional tiene presentación editable (`PATCH /profiles/practitioners/me`);
 * un paciente no tiene ningún campo propio que el backend deje escribir desde
 * acá, así que ve sus datos en la misma mini-tabla **sin lápiz**. Ofrecerle un
 * botón de editar que no puede guardar nada sería una promesa falsa.
 */
@Component({
  selector: 'app-profile-settings',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DatePipe,
    FormField,
    Input,
    RouterLink,
    StatusSeal,
    Switch,
    Textarea,
    Tooltip,
    ViewStateHost,
    WorkHistoryTable,
  ],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettings {
  private readonly profiles = inject(ProfilesClient);
  private readonly identity = inject(IdentityClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  // Igual que en «Mi perfil»: al inyectarlo se resuelven los estados de caso
  // contra terminología. Sin esto los sellos quedarían en neutro.
  private readonly estadosDeCaso = inject(CaseStatusCatalog);

  protected readonly bioLargoMaximo = BIO_LARGO_MAXIMO;
  protected readonly rutaDeVerificacion = IDENTITY_VERIFICATION_ROUTE;

  /** Si la sesión tiene perfil profesional detrás (claim `hpid`, no el rol). */
  protected readonly esProfesional = computed(() => this.auth.practitionerProfileId() !== null);

  /** El perfil profesional. `null` **listo** = esta sesión no es profesional. */
  protected readonly perfil = signal<ViewState<OwnPractitionerProfile | null>>(loading());

  /** El resumen de paciente. Mismo criterio con el `null` listo. */
  protected readonly resumen = signal<ViewState<OwnPatientSummary | null>>(loading());

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly datosProfesional = computed(() => dataOf(this.perfil()));
  protected readonly datosPaciente = computed(() => dataOf(this.resumen()));

  /**
   * El estado que se le muestra al host de estados.
   *
   * Es el del sujeto que corresponde y no los dos: pedirle al profesional el
   * resumen de paciente devuelve 404, y mostrar ese fallo sería inventarle un
   * problema a quien no lo tiene.
   */
  protected readonly estadoVisible = computed<ViewState<unknown>>(() =>
    this.esProfesional() ? this.perfil() : this.resumen(),
  );

  /** Si «Tus datos» está cerrado sólo porque falta verificar la identidad. */
  protected readonly verificacionPendiente = computed(() => {
    const estado = this.resumen();
    return estado.status === 'forbidden' && estado.nextAction?.route === IDENTITY_VERIFICATION_ROUTE;
  });

  /** El mensaje de un 403 que no es el de identidad. */
  protected readonly motivoDelMuro = computed(() => {
    const estado = this.resumen();
    return estado.status === 'forbidden' ? (estado.message ?? null) : null;
  });

  /**
   * El estado de la persona, en palabras. Nunca el uuid: para quien mira su
   * propia cuenta un identificador interno no es información, es ruido.
   */
  protected readonly estadoPersona = computed(() => {
    const datos = this.datosPaciente();
    if (datos === null) {
      return '';
    }
    return this.etiquetas().get(datos.personStatus)?.display ?? 'Sin determinar';
  });

  // ─── Modo edición ────────────────────────────────────────────────────────

  /**
   * Si el formulario está abierto a edición.
   *
   * Arranca en `false` **siempre**: entrar a la pestaña no es querer cambiar
   * nada, y un formulario abierto invita a tocar campos que no se venía a tocar.
   */
  protected readonly editando = signal(false);

  protected readonly guardando = signal(false);

  /** Sólo el dueño de un perfil profesional tiene algo que editar acá. */
  protected readonly puedeEditar = computed(
    () => this.esProfesional() && this.datosProfesional() !== null,
  );

  protected readonly titulo = signal('');
  protected readonly bio = signal('');
  protected readonly aceptaNuevos = signal(false);
  protected readonly telemedicina = signal(false);

  /**
   * Lo que cambió respecto de lo guardado.
   *
   * Se calcula acá y no dentro de `guardar()` porque también decide si hace
   * falta preguntar al cancelar: descartar un formulario intacto no es una
   * decisión, es cerrar una ficha, y frenar eso con un modal es ruido.
   */
  protected readonly cambios = computed<Partial<PresentacionEditable>>(() => {
    const original = this.datosProfesional();
    if (original === null) {
      return {};
    }

    const cambios: Partial<PresentacionEditable> = {};
    if (this.titulo() !== (original.professionalTitle ?? '')) {
      cambios.professionalTitle = this.titulo();
    }
    if (this.bio() !== (original.professionalBio ?? '')) {
      cambios.professionalBio = this.bio();
    }
    if (this.aceptaNuevos() !== original.acceptsNewPatients) {
      cambios.acceptsNewPatients = this.aceptaNuevos();
    }
    if (this.telemedicina() !== original.telehealthAvailable) {
      cambios.telehealthAvailable = this.telemedicina();
    }
    return cambios;
  });

  protected readonly hayCambios = computed(() => Object.keys(this.cambios()).length > 0);

  // ─── Verificación de identidad ───────────────────────────────────────────

  protected readonly casos = signal<readonly VerificationCase[]>([]);

  protected readonly casosOrdenados = computed<readonly VerificationCase[]>(() =>
    [...this.casos()].sort((a, b) => fecha(b) - fecha(a)),
  );

  protected readonly casoVigente = computed<VerificationCase | null>(
    () => this.casosOrdenados()[0] ?? null,
  );

  protected readonly selloVigente = computed(() => {
    const caso = this.casoVigente();
    return caso === null ? null : toCaseStatusPresentation(caso.status);
  });

  protected sello(caso: VerificationCase): ReturnType<typeof toCaseStatusPresentation> {
    return toCaseStatusPresentation(caso.status);
  }

  constructor() {
    this.cargar();
    this.cargarCasos();
  }

  protected recargar(): void {
    this.cargar();
    this.cargarCasos();
  }

  // ─── El lápiz, la X y el guardar ─────────────────────────────────────────

  /** El lápiz. Siembra el formulario con lo guardado y lo abre. */
  protected empezarAEditar(): void {
    const original = this.datosProfesional();
    if (original === null) {
      return;
    }
    this.sembrar(original);
    this.editando.set(true);
  }

  /**
   * La X. Descarta lo escrito, con la misma pregunta que guardar.
   *
   * Sin cambios no pregunta nada: no hay nada que perder, y un modal en ese
   * caso enseña a la gente a apretar «sí» sin leer, que es justamente lo que
   * hace inútil al modal cuando de verdad importa.
   */
  protected async cancelar(): Promise<void> {
    if (this.guardando()) {
      return;
    }

    if (this.hayCambios()) {
      const confirmado = await this.dialogs.confirm({
        title: 'Descartar los cambios',
        message: CONFIRMACION,
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        destructive: true,
      });
      if (!confirmado) {
        return;
      }
    }

    const original = this.datosProfesional();
    if (original !== null) {
      this.sembrar(original);
    }
    this.editando.set(false);
  }

  /** Guardar. Confirma, manda el `PATCH` y avisa por toast. */
  protected async guardar(): Promise<void> {
    const cambios = this.cambios();
    if (this.guardando() || this.datosProfesional() === null) {
      return;
    }

    if (Object.keys(cambios).length === 0) {
      // No se manda un PATCH vacío: el servidor lo aceptaría y devolvería el
      // mismo registro, y el toast de éxito mentiría diciendo que algo cambió.
      this.toasts.info('No había ningún cambio para aplicar.', 'Perfil');
      this.editando.set(false);
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: 'Aplicar los cambios',
      message: CONFIRMACION,
      confirmLabel: 'Aplicar',
      cancelLabel: 'Volver',
    });
    if (!confirmado) {
      return;
    }

    this.guardando.set(true);
    this.profiles.updateOwnPractitionerProfile(cambios).subscribe({
      next: (perfil) => {
        this.guardando.set(false);
        this.perfil.set(ready(perfil));
        this.sembrar(perfil);
        this.editando.set(false);
        this.toasts.success('Los cambios se aplicaron.', 'Perfil');
      },
      error: () => {
        this.guardando.set(false);
        // El formulario NO se cierra: lo escrito sigue ahí para reintentar.
        this.toasts.error('No se pudieron aplicar los cambios. Probá de nuevo.', 'Perfil');
      },
    });
  }

  // ─── Lecturas ────────────────────────────────────────────────────────────

  private sembrar(perfil: OwnPractitionerProfile): void {
    this.titulo.set(perfil.professionalTitle ?? '');
    this.bio.set(perfil.professionalBio ?? '');
    this.aceptaNuevos.set(perfil.acceptsNewPatients);
    this.telemedicina.set(perfil.telehealthAvailable);
  }

  private cargar(): void {
    this.editando.set(false);

    if (this.esProfesional()) {
      // Sin resumen de paciente que pedir: se deja listo en nulo para que el
      // host de estados no quede girando para siempre.
      this.resumen.set(ready(null));
      this.perfil.set(loading());
      this.profiles.getOwnPractitionerProfile().subscribe({
        next: (perfil) => {
          this.sembrar(perfil);
          this.perfil.set(ready(perfil));
        },
        error: (error: unknown) => this.perfil.set(errorToViewState<OwnPractitionerProfile>(error)),
      });
      return;
    }

    this.perfil.set(ready(null));
    this.resumen.set(loading());
    this.etiquetas.set(new Map());
    this.profiles
      .getOwnSummary()
      .pipe(
        switchMap((resumen) =>
          forkJoin({
            resumen: of(resumen),
            // El catálogo caído degrada un campo; no puede tumbar la pantalla
            // que muestra los datos propios de alguien.
            etiquetas: this.terminology
              .readConceptLabels([resumen.personStatus])
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ resumen, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.resumen.set(ready(resumen));
        },
        error: (error: unknown) => this.resumen.set(errorToViewState<OwnPatientSummary>(error)),
      });
  }

  /**
   * El historial de verificaciones, aparte del perfil y **sin compartir su
   * estado de vista**: el resumen falla con 403 justo cuando falta verificar la
   * identidad, que es cuando el historial más tiene para decir.
   */
  private cargarCasos(): void {
    this.identity.listVerificationCases().subscribe({
      next: (casos) => this.casos.set(casos),
      error: () => this.casos.set([]),
    });
  }
}

/** Los cuatro campos que el backend deja corregir desde acá. */
interface PresentacionEditable {
  professionalTitle: string;
  professionalBio: string;
  acceptsNewPatients: boolean;
  telehealthAvailable: boolean;
}

/**
 * La fecha por la que se ordena un caso: el cierre manda sobre la apertura, y
 * sin ninguna de las dos el caso va al fondo en vez de romper con un `NaN`.
 */
function fecha(caso: VerificationCase): number {
  return caso.completedAt?.getTime() ?? caso.openedAt?.getTime() ?? 0;
}
