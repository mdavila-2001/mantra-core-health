import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { PracticeSite } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type { PractitionerAffiliation } from '../../../../core/data-access/profiles/profiles.types';
import { AuthService } from '../../../../core/auth/auth.service';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';

/**
 * **Historial laboral** del profesional — punto 9 del reclamo del cliente.
 *
 * ## Lo que el perfil no sabía decir
 *
 * El perfil ya mostraba dónde se **formó** alguien (credenciales), qué puede
 * **ejercer** (matrículas) y en qué (especialidades). No tenía **dónde
 * trabajó**, que es lo que el cliente pidió con esas palabras: «hospitales o
 * entidades médicas». No era un campo escondido: no existía ni la tabla.
 *
 * ## La institución se escribe, no se elige
 *
 * Es un campo de texto y no un selector, y es deliberado: la mayoría de los
 * hospitales donde alguien trabajó **no están en la plataforma**. Un selector
 * obligaría a darlos de alta como organizaciones para poder mencionarlos, que
 * es convertir un dato de currículum en un trámite. Cuando la institución sí
 * está dentro, el desplegable de consultorios la ata por identificador.
 *
 * ## «Sigue ahí» se dice dejando la fecha vacía
 *
 * Sin fin, el vínculo es vigente. No hay casilla de «actual» porque sería un
 * segundo lugar donde decir lo mismo, y el día que discreparan —fecha de fin
 * cargada y casilla marcada— no habría forma de saber cuál manda.
 *
 * ## Un `403` acá no es un muro, es que la pregunta no aplica
 *
 * `GET /profiles/practitioners/me/affiliations` responde `403` a una cuenta sin
 * perfil profesional. No es un fallo: es que esta persona no es profesional. El
 * bloque se esconde entero en vez de pintar un error rojo en el perfil de un
 * paciente.
 */
@Component({
  selector: 'app-work-history',
  imports: [Alert, Card, DatePicker, DatePipe, FormActions, FormField, Input, Select],
  templateUrl: './work-history.html',
  styleUrl: './work-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkHistory {
  private readonly profiles = inject(ProfilesClient);
  private readonly sites = inject(PracticeSitesClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /**
   * `'flat'` (por defecto): la lista propia, tal como vive hoy al pie de «Mi
   * perfil». `'timeline'`: la pestaña Trayectoria del perfil ya pinta el
   * mismo historial como línea de tiempo por fases — acá se suprime el
   * listado propio y sólo queda el formulario de alta, para no mostrar el
   * mismo dato dos veces con dos formas distintas.
   */
  readonly layout = input<'flat' | 'timeline'>('flat');

  /** Se emite tras un alta exitosa, para que quien embebe el formulario recargue lo que ya tenía leído. */
  readonly added = output<void>();

  /**
   * Si esta cuenta tiene perfil profesional.
   *
   * `null` mientras se pregunta. Sale del claim de la sesión y no de la
   * respuesta del backend porque decide si el bloque **se dibuja**: preguntarlo
   * a la API significaría pintar y despintar una sección del perfil.
   */
  protected readonly esProfesional = computed(
    () => this.auth.practitionerProfileId() !== null,
  );

  protected readonly historial = signal<ViewState<readonly PractitionerAffiliation[]>>(
    loading(),
  );

  protected readonly afiliaciones = computed<readonly PractitionerAffiliation[]>(() => {
    const state = this.historial();
    return state.status === 'ready' ? state.data : [];
  });

  /**
   * Los consultorios de la plataforma donde ya atiende.
   *
   * Sirven para atar la afiliación a una sede real cuando corresponde. Si la
   * lectura falla, la lista queda vacía y el campo simplemente no se ofrece: es
   * opcional en el contrato y nada del alta depende de él.
   */
  protected readonly sedes = signal<readonly PracticeSite[]>([]);

  /** Las mismas sedes como opciones del desplegable. */
  protected readonly opcionesDeSede = computed<readonly SelectOption<string>[]>(() =>
    this.sedes().map((sede) => ({
      value: sede.id,
      label: sede.addressText === null ? sede.name : `${sede.name} · ${sede.addressText}`,
    })),
  );

  /* -- El formulario ------------------------------------------------------- */

  protected readonly institucion = signal('');
  protected readonly cargo = signal('');
  protected readonly area = signal('');
  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);
  protected readonly sede = signal<string | null>(null);

  protected readonly registrando = signal(false);

  /** El resultado de la última escritura. */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /**
   * Si el período está invertido.
   *
   * Se comprueba acá y no sólo en el backend porque es lo único que quien
   * escribe puede ver mientras lo escribe: mandar el formulario para que el
   * servidor conteste que las fechas están al revés es hacerle pagar una vuelta
   * completa por un error que ya estaba en pantalla.
   */
  protected readonly periodoInvertido = computed(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    return desde !== null && hasta !== null && hasta < desde;
  });

  protected readonly puedeRegistrar = computed(
    () =>
      this.institucion().trim() !== '' &&
      this.cargo().trim() !== '' &&
      this.desde() !== null &&
      !this.periodoInvertido() &&
      !this.registrando(),
  );

  /**
   * El aviso del duplicado, en palabras.
   *
   * Separado del error porque **no es un error**: el `409` es el historial
   * negándose a decir dos veces lo mismo. Volver a un hospital años después es
   * cierto y se registra; lo que se rechaza es el doble envío, que se reconoce
   * porque empieza el mismo día.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.registro();
    if (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT')
    ) {
      return 'Ese vínculo ya está en tu historial: misma institución, mismo cargo y misma fecha de inicio.';
    }
    return null;
  });

  /** El fallo de la escritura, en palabras. */
  protected readonly errorDelRegistro = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) {
      return null;
    }

    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu cuenta no tiene un perfil profesional asociado.';
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
    if (this.esProfesional()) {
      this.cargar();
      this.cargarSedes();
    } else {
      // No hay historial que pedir, y dejarlo en `loading()` haría girar un
      // esqueleto para siempre en el perfil de un paciente.
      this.historial.set(ready([]));
    }
  }

  protected recargar(): void {
    this.cargar();
  }

  /**
   * Registra un vínculo laboral (UC-05-16).
   *
   * Sin confirmación previa: agregar una línea al propio currículum no cierra
   * ni sella nada. Después se relee, porque la lista sale del servidor y no de
   * lo que acabamos de escribir.
   */
  protected registrar(): void {
    const desde = this.desde();
    if (!this.puedeRegistrar() || desde === null) {
      return;
    }

    const hasta = this.hasta();
    const area = this.area().trim();
    const sede = this.sede();

    this.registrando.set(true);
    this.registro.set(loading());

    this.profiles
      .addAffiliation({
        organizationName: this.institucion().trim(),
        roleTitle: this.cargo().trim(),
        startDate: soloFecha(desde),
        // Los opcionales sin valor se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave vacía no es «sin especificar».
        ...(area === '' ? {} : { departmentText: area }),
        ...(hasta === null ? {} : { endDate: soloFecha(hasta) }),
        ...(sede === null || sede === '' ? {} : { practiceSiteId: sede }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.toasts.success('Quedó en tu historial laboral.', 'Vínculo registrado');
          this.cargar();
          this.added.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /** El período de una afiliación, en palabras. */
  protected periodo(afiliacion: PractitionerAffiliation): string {
    return afiliacion.current ? 'En curso' : 'Finalizado';
  }

  /** El nombre de la sede atada, si la afiliación ata alguna. */
  protected nombreDeSede(afiliacion: PractitionerAffiliation): string | null {
    if (afiliacion.practiceSiteId === null) {
      return null;
    }
    return (
      this.sedes().find((sede) => sede.id === afiliacion.practiceSiteId)?.name ?? null
    );
  }

  private cargar(): void {
    this.historial.set(loading());
    this.profiles.listAffiliations().subscribe({
      next: (pagina) => this.historial.set(ready(pagina.items)),
      error: (error: unknown) =>
        this.historial.set(errorToViewState<readonly PractitionerAffiliation[]>(error)),
    });
  }

  /**
   * Pide los consultorios propios.
   *
   * Va por su lado y su fallo no se muestra: atar la afiliación a una sede es
   * opcional, y perder el formulario entero porque no se pudo leer una lista
   * opcional sería cambiar una comodidad por una funcionalidad.
   */
  private cargarSedes(): void {
    const profileId = this.auth.practitionerProfileId();
    if (profileId === null) {
      return;
    }
    this.sites.listSitesOfPractitioner(profileId).subscribe({
      next: (pagina) => this.sedes.set(pagina.items),
      error: () => this.sedes.set([]),
    });
  }

  /** Vacía el formulario tras un alta. El siguiente vínculo arranca limpio. */
  private limpiar(): void {
    this.institucion.set('');
    this.cargo.set('');
    this.area.set('');
    this.desde.set(null);
    this.hasta.set(null);
    this.sede.set(null);
  }
}

/**
 * La fecha como el `YYYY-MM-DD` que el contrato pide, con los componentes
 * **locales**.
 *
 * `toISOString()` la pasa por UTC y en cualquier huso al oeste de Greenwich
 * devuelve el día anterior: quien declara que entró a un hospital el 1 de marzo
 * lo vería guardado como 28 de febrero. Es el espejo de `maybeDateOnly`, que
 * hace el camino de vuelta.
 */
function soloFecha(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
