import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import type {
  OnboardingStepKey,
  PractitionerOnboarding,
} from '../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Link } from '../../shared/components/atoms/link/link';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Stepper } from '../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../shared/components/molecules/stepper/stepper.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { AGENDA_CREATE_ROUTE } from '../agenda/agenda.routes';

/**
 * Lo que cada etapa le pide a la persona, en su idioma.
 *
 * La API devuelve claves (`license-number`, `photo`…) y no prosa a propósito:
 * el texto es del front. Acá vive esa traducción, en un solo lugar.
 */
const ETAPAS: Readonly<
  Record<
    OnboardingStepKey,
    {
      readonly titulo: string;
      readonly explica: string;
      readonly accion: string;
      readonly ruta: string;
    }
  >
> = {
  'professional-data': {
    titulo: 'Tus datos profesionales',
    explica: 'Tu matrícula y al menos una especialidad. Es lo que te identifica ante un paciente.',
    accion: 'Completar mis datos',
    ruta: '/my-account/edit',
  },
  photo: {
    titulo: 'Tu foto',
    explica: 'Una foto tuya. Quien busca médico elige a una persona, no a un nombre en una lista.',
    accion: 'Subir mi foto',
    // No es `/my-account/edit`: ahí no hay control de foto. El retrato de
    // «Mi perfil» (`/my-account`) es el disparador de la subida — el paso
    // enlaza a la pantalla que ya sabe hacer el trabajo, no duplica el control.
    ruta: '/my-account',
  },
  organizations: {
    titulo: 'Dónde atendés',
    explica: 'Tu consultorio propio o la organización donde trabajás.',
    accion: 'Publicar mi agenda',
    ruta: AGENDA_CREATE_ROUTE,
  },
  schedule: {
    titulo: 'Tus horarios',
    explica: 'Publicá tu agenda para que puedan pedirte turno. Sin esto no aparecés al reservar.',
    accion: 'Publicar mi agenda',
    ruta: AGENDA_CREATE_ROUTE,
  },
  review: {
    titulo: 'Listo',
    explica: 'Tu perfil está completo y ya podés recibir pacientes.',
    accion: 'Ver mi perfil',
    ruta: '/my-account',
  },
};

/** Una etapa ya lista para mostrarse. */
interface EtapaVisible {
  readonly key: OnboardingStepKey;
  readonly titulo: string;
  readonly explica: string;
  readonly accion: string;
  readonly ruta: string;
  readonly completa: boolean;
  /** Es la que hay que hacer ahora. */
  readonly actual: boolean;
}

/**
 * El alta del profesional, paso por paso.
 *
 * ## Por qué no guarda en qué paso va
 *
 * Porque el servidor lo **deriva** de los datos que ya existen. Volver a entrar
 * recalcula y aterriza donde corresponde, así que abandonar a mitad y retomar
 * mañana funciona sin que nadie persista un contador — y los profesionales que
 * ya estaban completos antes de que esta pantalla existiera no ven nada.
 *
 * ## Por qué no bloquea la aplicación
 *
 * El prompt original pedía redirigir a la fuerza hasta completar. Acá no: el
 * médico ya puede operar con lo que tiene, y encerrarlo en un asistente
 * rompería a todos los que se registraron antes. La presión es un aviso
 * persistente, no una puerta cerrada.
 *
 * ## Los pasos enlazan, no duplican
 *
 * Cada etapa manda a la pantalla que ya sabe hacer ese trabajo —el perfil
 * editable, el asistente de agenda de FX-1—. Rehacer esos formularios acá sería
 * mantener dos veces las mismas validaciones.
 */
@Component({
  selector: 'app-onboarding-practitioner',
  imports: [Alert, AppButton, AppButtonLink, Badge, Link, PageHeader, RouterLink, Stepper],
  templateUrl: './onboarding-practitioner.html',
  styleUrl: './onboarding-practitioner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPractitioner {
  private readonly profiles = inject(ProfilesClient);

  protected readonly estado = signal<ViewState<PractitionerOnboarding>>(loading());

  /** Las cinco etapas traducidas, con cuál es la actual. */
  protected readonly etapas = computed<readonly EtapaVisible[]>(() => {
    const actual = this.estado();
    if (actual.status !== 'ready') return [];

    return actual.data.steps.map((paso) => ({
      key: paso.key,
      ...ETAPAS[paso.key],
      completa: paso.complete,
      actual: paso.key === actual.data.firstIncomplete,
    }));
  });

  /** Lo que el indicador de avance necesita: rótulo y estado, nada más. */
  protected readonly pasosDelIndicador = computed<readonly StepperStep[]>(() =>
    this.etapas().map((etapa) => ({
      label: etapa.titulo,
      status: etapa.completa ? 'complete' : etapa.actual ? 'current' : 'upcoming',
    })),
  );

  /** Ya no falta nada. */
  protected readonly completo = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' && actual.data.firstIncomplete === 'done';
  });

  /** Cuántas etapas van, para el «paso X de 5». */
  protected readonly cumplidas = computed(
    () => this.etapas().filter((etapa) => etapa.completa).length,
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.profiles.getOwnOnboarding().subscribe({
      next: (avance) => this.estado.set(ready(avance)),
      error: (error: unknown) => this.estado.set(errorToViewState<PractitionerOnboarding>(error)),
    });
  }
}
