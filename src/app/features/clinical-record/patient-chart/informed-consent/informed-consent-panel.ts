import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { EMPTY, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { InformedConsentsClient } from '../../../../core/data-access/informed-consents/informed-consents.client';
import {
  INFORMED_CONSENT_EXCEPTIONS,
  INFORMED_CONSENT_GRANTORS,
  violacionesDeLosCampos,
  violacionesDelConsentimiento,
  type CreateInformedConsentInput,
  type InformedConsent,
  type InformedConsentChannel,
  type InformedConsentDecision,
  type InformedConsentException,
  type InformedConsentGrantor,
  type InformedConsentRuleViolation,
  type InformedConsentTargetType,
} from '../../../../core/data-access/informed-consents/informed-consents.types';
import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../../core/http/api-error';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { AttachmentDialog } from '../../../../shared/components/organisms/attachment-dialog/attachment-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { mensajeDeEscritura, mensajeDeFalloDeEscritura } from '../../mensaje-de-escritura';
import { InformedConsentBadge } from './informed-consent-badge';
import {
  AYUDA_DERIVACION,
  AYUDA_EXPEDIENTE,
  AYUDA_TESTIGO,
  CITA_CPE_44,
  estadoDelConsentimiento,
  estadoDeLaFirma,
  IDIOMAS_DE_LA_INFORMACION,
  MENSAJE_DE_LA_REGLA,
  NOMBRE_DE_LA_EXCEPCION,
  NOMBRE_DEL_CANAL,
  NOMBRE_DEL_OBJETO,
  NOMBRE_DEL_OTORGANTE,
  PESTANA_DE_LA_REGLA,
} from './informed-consent.textos';

/** Las cuatro pestañas, en el orden en que se recorre el consentimiento. */
const PESTANAS = ['Información', 'Quién otorga', 'Decisión', 'Historial y revocación'] as const;

/** Cada regla, con la clave del campo que señala (para el foco y el `tocado`). */
const CAMPO_DE_LA_REGLA: Readonly<Record<InformedConsentRuleViolation, string>> = {
  TARGET_PAIR_INCOMPLETE: 'proposito',
  PURPOSE_REQUIRED: 'proposito',
  BENEFITS_REQUIRED: 'beneficios',
  RISKS_REQUIRED: 'riesgos',
  REPRESENTATIVE_NAME_REQUIRED: 'representante',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'parentesco',
  ASSENT_REQUIRED: 'asentimiento',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'justificacion',
  REVOCATION_RIGHT_REQUIRED: 'revocabilidad',
};

/**
 * **Consentimiento informado DIRIGIDO** a una indicación concreta: una receta,
 * una orden de análisis o estudio, una derivación, un procedimiento o un plan
 * de cuidados.
 *
 * ```html
 * <app-informed-consent-panel
 *   [patientProfileId]="paciente" [encounterId]="encuentro"
 *   targetType="MEDICATION_REQUEST" [targetId]="receta.id"
 *   [targetLabel]="receta.medicamento + ' · ' + receta.indicacion"
 *   [defaults]="{ purposeText: '…' }"
 *   (consentChanged)="consentimientos.incorporar($event)" />
 * ```
 *
 * ## Una tarjeta, cuatro pestañas, en el orden en que se conversa
 *
 * Información → quién otorga → decisión → historial. Es el orden de la
 * conversación clínica (fácil → exigente) y la regla de la casa
 * (composition-rules §5): UNA `app-card` con `app-tabs`. Como `app-tab` no
 * dibuja el panel cerrado, lo escrito vive en señales: cambiar de pestaña no
 * pierde nada.
 *
 * ## Validación igual a la de la API, y la API manda
 *
 * Las reglas son `violacionesDelConsentimiento`, la misma función que usa el
 * simulador y la copia exacta del contrato §2. Se muestran al salir del campo
 * o al intentar registrar —no a cada tecla—; al intentar, el foco va al primer
 * error y su pestaña se abre. Si el servidor igual rechaza, su motivo se
 * muestra tal cual (S4) y lo escrito se conserva.
 *
 * ## La decisión es libre
 *
 * Nada viene marcado. «Acepta» y «No acepta» son dos radios del mismo peso,
 * y el botón dice lo que va a registrar. Sin urgencias ni textos que empujen.
 * Revocar está a la vista desde la cabecera, igual de fácil que registrar.
 */
@Component({
  selector: 'app-informed-consent-panel',
  imports: [
    Alert,
    AppButton,
    AttachmentDialog,
    Badge,
    Card,
    Checkbox,
    DatePipe,
    EmptyState,
    FormField,
    InformedConsentBadge,
    Input,
    NgTemplateOutlet,
    Radio,
    RadioGroup,
    Select,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './informed-consent-panel.html',
  styleUrl: './informed-consent-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformedConsentPanel {
  private readonly client = inject(InformedConsentsClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  readonly targetType = input.required<InformedConsentTargetType>();
  readonly targetId = input.required<string>();
  readonly targetLabel = input.required<string>();
  readonly defaults = input<Partial<CreateInformedConsentInput>>({});

  /** El consentimiento vigente después de registrar o revocar. */
  readonly consentChanged = output<InformedConsent | null>();

  /* -- Textos ------------------------------------------------------------- */

  protected readonly citaCpe = CITA_CPE_44;
  protected readonly ayudaExpediente = AYUDA_EXPEDIENTE;
  protected readonly nombreDelCanal = NOMBRE_DEL_CANAL;
  protected readonly nombreDelOtorgante = NOMBRE_DEL_OTORGANTE;
  protected readonly nombreDeLaExcepcion = NOMBRE_DE_LA_EXCEPCION;
  protected readonly otorgantes = INFORMED_CONSENT_GRANTORS;
  protected readonly excepciones = INFORMED_CONSENT_EXCEPTIONS;
  protected readonly nombreDelObjeto = computed(() => NOMBRE_DEL_OBJETO[this.targetType()]);

  /* -- Lectura ------------------------------------------------------------ */

  protected readonly lectura = signal<ViewState<readonly InformedConsent[]>>(loading());
  private readonly version = signal(0);

  protected readonly historial = computed(() => dataOf(this.lectura()) ?? []);
  protected readonly vigente = computed(() => this.historial()[0] ?? null);
  protected readonly estado = computed(() => estadoDelConsentimiento(this.vigente()));
  /** Sólo un consentimiento activo se revoca; uno ya revocado devolvería 409. */
  protected readonly revocable = computed(() => this.vigente()?.status === 'ACTIVE');

  /* -- El formulario ------------------------------------------------------ */

  protected readonly pestana = signal(0);
  protected readonly diagnostico = signal('');
  protected readonly proposito = signal('');
  protected readonly beneficios = signal('');
  protected readonly riesgos = signal('');
  protected readonly riesgosPersonalizados = signal('');
  protected readonly alternativas = signal('');
  protected readonly consecuencias = signal('');
  protected readonly preguntas = signal('');
  protected readonly otorgante = signal<InformedConsentGrantor>('PATIENT');
  protected readonly representante = signal('');
  protected readonly documento = signal('');
  protected readonly parentesco = signal('');
  protected readonly incapacidad = signal('');
  protected readonly canal = signal<InformedConsentChannel>('IN_PERSON');
  protected readonly conExcepcion = signal(false);
  protected readonly excepcion = signal<InformedConsentException | null>(null);
  protected readonly justificacion = signal('');
  protected readonly testigo = signal('');
  protected readonly documentoDelTestigo = signal('');
  /** `null` = no se respondió; con representante, la regla exige sí o no. */
  protected readonly asentimiento = signal<boolean | null>(null);
  protected readonly notasDelAsentimiento = signal('');
  protected readonly idioma = signal<string | null>('es');
  protected readonly otroIdioma = signal('');
  /** Constancia, no premarcada: quien informa la marca después de decirlo. */
  protected readonly revocabilidadInformada = signal(false);
  /** Nada premarcado: la decisión es de la persona y se elige. */
  protected readonly decision = signal<InformedConsentDecision | null>(null);

  private readonly tocados = signal<ReadonlySet<string>>(new Set());
  private readonly intento = signal(false);

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));
  protected readonly revocacion = signal<ViewState<null>>(ready(null));
  /** El último registro de esta sesión, para decir qué pasó y qué sigue. */
  protected readonly recienRegistrado = signal<InformedConsent | null>(null);

  protected readonly esRepresentante = computed(() => this.otorgante() !== 'PATIENT');

  /** El idioma que viaja: el código elegido, o lo escrito si fue «Otro idioma». */
  protected readonly idiomaElegido = computed(() => {
    const elegido = this.idioma();
    if (elegido === null) return '';
    return elegido === 'OTRO' ? this.otroIdioma().trim() : elegido;
  });

  protected readonly idiomas = IDIOMAS_DE_LA_INFORMACION;
  protected readonly ayudaTestigo = AYUDA_TESTIGO;
  protected readonly ayudaDerivacion = AYUDA_DERIVACION;
  protected readonly firma = computed(() => estadoDeLaFirma(this.vigente()));
  /** Abre el adjuntador de la firma escaneada. */
  protected readonly adjuntandoFirma = signal(false);
  /** Liga el archivo subido como evidencia del consentimiento vigente. */
  protected readonly ligarFirma = (fileId: string): Observable<unknown> => {
    const vigente = this.vigente();
    return vigente === null ? EMPTY : this.client.addEvidence(vigente.id, fileId);
  };
  /** Urgencia sin informar todavía: se ofrece cerrarla. */
  protected readonly urgenciaPorInformar = computed(() => {
    const v = this.vigente();
    return v !== null && v.status === 'ACTIVE' && v.exceptionType === 'EMERGENCY' && v.postEmergencyInformedAt === null;
  });
  protected readonly informePosterior = signal<ViewState<null>>(ready(null));
  protected readonly errorDelInformePosterior = computed(() =>
    mensajeDeEscritura(this.informePosterior(), { accion: 'registrar que se informó' }),
  );

  /** S3 sin atención: la próxima acción es abrirla. */
  protected readonly sinEncuentro = empty(
    { label: 'Abrí un encuentro para registrar el consentimiento' },
    'El consentimiento se registra dentro de una atención: es la que queda en el expediente como el momento en que se informó.',
  );

  /** El encuentro al que se ata. Lo exige el contrato. */
  protected readonly encuentro = computed(
    () => this.encounterId() ?? this.defaults().encounterId ?? null,
  );

  /** Lo que viajaría si se registrara ahora. */
  private readonly borrador = computed<Partial<CreateInformedConsentInput>>(() => {
    const representa = this.esRepresentante();
    const excepcion = this.conExcepcion() ? this.excepcion() : null;
    return {
      patientProfileId: this.patientProfileId(),
      ...(this.encuentro() === null ? {} : { encounterId: this.encuentro()! }),
      ...(this.decision() === null ? {} : { decision: this.decision()! }),
      targetType: this.targetType(),
      targetId: this.targetId(),
      targetLabel: this.targetLabel(),
      diagnosisText: this.diagnostico(),
      purposeText: this.proposito(),
      benefitsText: this.beneficios(),
      risksText: this.riesgos(),
      personalizedRisksText: this.riesgosPersonalizados(),
      alternativesText: this.alternativas(),
      refusalConsequencesText: this.consecuencias(),
      patientQuestionsText: this.preguntas(),
      grantedBy: this.otorgante(),
      ...(representa
        ? {
            representativeName: this.representante(),
            representativeDocument: this.documento(),
            representativeRelationship: this.parentesco(),
            incapacityReason: this.incapacidad(),
            ...(this.asentimiento() === null ? {} : { assentObtained: this.asentimiento()! }),
            assentNotes: this.notasDelAsentimiento(),
          }
        : {}),
      witnessName: this.testigo(),
      witnessDocument: this.documentoDelTestigo(),
      ...(this.idiomaElegido() === '' ? {} : { informationLanguage: this.idiomaElegido() }),
      revocationRightInformed: this.revocabilidadInformada(),
      channel: this.canal(),
      ...(this.auth.practitionerProfileId() === null
        ? {}
        : { informedByProfileId: this.auth.practitionerProfileId()! }),
      ...(excepcion === null
        ? {}
        : { exceptionType: excepcion, exceptionJustification: this.justificacion() }),
    };
  });

  /**
   * Lo que el servidor rechazó campo por campo (`details.fields` del 400).
   * Se suma a lo que la pantalla ya valida: si las reglas divergieran, el
   * campo igual queda señalado con su mensaje.
   */
  private readonly violacionesDelServidor = signal<readonly InformedConsentRuleViolation[]>([]);

  protected readonly violaciones = computed(() => {
    const locales = violacionesDelConsentimiento(this.borrador());
    const delServidor = this.violacionesDelServidor().filter((v) => !locales.includes(v));
    return [...locales, ...delServidor];
  });

  /** Falta elegir cuál excepción: no es regla del servidor, es un control sin respuesta. */
  protected readonly faltaTipoDeExcepcion = computed(
    () => this.conExcepcion() && this.excepcion() === null,
  );

  protected readonly faltaDecision = computed(() => this.decision() === null);

  /** El error de un campo, si ya se tocó o se intentó registrar. */
  protected errorDe(campo: string): string {
    if (!this.intento() && !this.tocados().has(campo)) return '';
    if (campo === 'decision') return this.faltaDecision() ? 'Elegí si la persona acepta o no acepta.' : '';
    if (campo === 'excepcion') {
      return this.faltaTipoDeExcepcion() ? 'Elegí cuál excepción se aplica.' : '';
    }
    const regla = this.violaciones().find((v) => CAMPO_DE_LA_REGLA[v] === campo);
    return regla === undefined ? '' : MENSAJE_DE_LA_REGLA[regla];
  }

  protected tocar(campo: string): void {
    if (this.tocados().has(campo)) return;
    this.tocados.update((actuales) => new Set([...actuales, campo]));
  }

  /** Para el resumen de arriba: sólo después de intentar registrar. */
  protected readonly resumenDeErrores = computed<readonly { texto: string; pestana: number; campo: string }[]>(() => {
    if (!this.intento()) return [];
    const lista = this.violaciones().map((v) => ({
      texto: MENSAJE_DE_LA_REGLA[v],
      pestana: PESTANA_DE_LA_REGLA[v],
      campo: CAMPO_DE_LA_REGLA[v],
    }));
    if (this.faltaTipoDeExcepcion()) {
      lista.push({ texto: 'Elegí cuál excepción se aplica.', pestana: 2, campo: 'excepcion' });
    }
    if (this.faltaDecision()) {
      lista.push({ texto: 'Elegí si la persona acepta o no acepta.', pestana: 2, campo: 'decision' });
    }
    return lista.sort((a, b) => a.pestana - b.pestana);
  });

  /** «completa» / «falta algo», por pestaña: el progreso sin contar pasos. */
  private readonly pestanaCompleta = computed(() => {
    const porPestana = [true, true, true];
    for (const v of this.violaciones()) porPestana[PESTANA_DE_LA_REGLA[v]] = false;
    if (this.faltaDecision() || this.faltaTipoDeExcepcion()) porPestana[2] = false;
    return porPestana;
  });

  protected readonly rotulos = computed(() =>
    PESTANAS.map((nombre, i) => {
      if (i === 3) return `${i + 1} · ${nombre} (${this.historial().length})`;
      return `${i + 1} · ${nombre} · ${this.pestanaCompleta()[i] ? 'lista' : 'falta'}`;
    }),
  );

  /** Contrato del diálogo que lo envuelve: con algo escrito, cerrar pregunta. */
  readonly tieneCambiosPendientes = computed(
    () =>
      this.recienRegistrado() === null &&
      [
        this.riesgosPersonalizados(),
        this.alternativas(),
        this.consecuencias(),
        this.preguntas(),
        this.representante(),
        this.justificacion(),
        this.testigo(),
      ].some((t) => t.trim() !== '') ||
      this.decision() !== null,
  );

  protected readonly etiquetaDelEnvio = computed(() => {
    const d = this.decision();
    if (d === 'DECLINED') return 'Registrar rechazo';
    if (d === 'ACCEPTED') return 'Registrar consentimiento';
    return 'Registrar decisión';
  });

  protected readonly errorDelRegistro = computed(() =>
    mensajeDeEscritura(this.registro(), { accion: 'registrar el consentimiento' }),
  );

  protected readonly errorDeLaRevocacion = computed(() =>
    mensajeDeEscritura(this.revocacion(), { accion: 'revocar el consentimiento' }),
  );

  protected readonly errorDeLectura = computed(() => {
    const l = this.lectura();
    return l.status === 'validation' ? null : mensajeDeFalloDeEscritura(l as ViewState<null>, {
      accion: 'ver los consentimientos',
    });
  });

  constructor() {
    // La lectura sigue a sus tres claves: otro ítem es otro historial.
    effect((onCleanup) => {
      const filtro = {
        patientProfileId: this.patientProfileId(),
        targetType: this.targetType(),
        targetId: this.targetId(),
      };
      this.version();
      untracked(() => this.lectura.set(loading()));
      const sub = untracked(() =>
        this.client.list(filtro).subscribe({
          next: (lista) =>
            this.lectura.set(
              ready([...lista].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
            ),
          error: (error: unknown) => this.lectura.set(errorToViewState(error)),
        }),
      );
      onCleanup(() => sub.unsubscribe());
    });

    // Prellenado desde el ítem —diagnóstico, propósito, riesgos conocidos—,
    // sólo sobre lo que todavía nadie escribió.
    effect(() => {
      const d = this.defaults();
      untracked(() => {
        prellenar(this.diagnostico, d.diagnosisText);
        prellenar(this.proposito, d.purposeText);
        prellenar(this.beneficios, d.benefitsText);
        prellenar(this.riesgos, d.risksText);
        prellenar(this.riesgosPersonalizados, d.personalizedRisksText);
        prellenar(this.alternativas, d.alternativesText);
        prellenar(this.consecuencias, d.refusalConsequencesText);
        if (d.channel !== undefined) this.canal.set(d.channel);
      });
    });
  }

  /** Cerró la subida: se relee para que la insignia diga lo que hay de verdad. */
  protected firmaAdjuntada(): void {
    this.adjuntandoFirma.set(false);
    this.recargar();
    const vigente = this.vigente();
    if (vigente !== null) this.consentChanged.emit({ ...vigente, signatureStatus: 'SIGNED' });
  }

  protected async informarDespuesDeLaUrgencia(): Promise<void> {
    const vigente = this.vigente();
    if (vigente === null) return;
    const ok = await this.dialogs.confirm({
      title: 'Registrar que se informó después de la urgencia',
      message: 'Dejá constancia de que ya se le explicó a la persona o a su familia lo que se hizo y por qué. Queda con la fecha y hora de ahora.',
      confirmLabel: 'Registrar que se informó',
      cancelLabel: 'Todavía no',
    });
    if (!ok) return;
    this.informePosterior.set(loading());
    this.client.informPostEmergency(vigente.id, new Date()).subscribe({
      next: (actualizado) => {
        this.informePosterior.set(ready(null));
        this.consentChanged.emit(actualizado);
        this.recargar();
      },
      error: (error: unknown) => this.informePosterior.set(errorToViewState<null>(error)),
    });
  }

  protected recargar(): void {
    this.version.update((v) => v + 1);
  }

  protected irA(pestana: number, campo: string): void {
    this.pestana.set(pestana);
    this.enfocar(campo);
  }

  protected registrar(): void {
    if (this.registrando()) return;
    this.intento.set(true);
    this.violacionesDelServidor.set([]);
    const primero = this.resumenDeErrores()[0];
    if (primero !== undefined) {
      this.irA(primero.pestana, primero.campo);
      return;
    }
    const encuentro = this.encuentro();
    const decision = this.decision();
    if (encuentro === null || decision === null) return;

    this.registrando.set(true);
    this.registro.set(loading());
    this.client
      .create({ ...this.borrador(), encounterId: encuentro, decision } as CreateInformedConsentInput)
      .subscribe({
        next: (creado) => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.recienRegistrado.set(creado);
          this.decision.set(null);
          this.revocabilidadInformada.set(false);
          this.intento.set(false);
          this.tocados.set(new Set());
          this.consentChanged.emit(creado);
          // Se relee: lo que prueba el registro es que vuelva de la lectura.
          this.recargar();
          this.pestana.set(3);
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
          // El 400 de la API nombra los campos: se señalan y se va al primero.
          const cuerpo = error instanceof HttpErrorResponse ? readApiError(error) : null;
          const campos = cuerpo?.details?.['fields'];
          if (Array.isArray(campos)) {
            const reglas = violacionesDeLosCampos(campos.filter((c): c is string => typeof c === 'string'));
            this.violacionesDelServidor.set(reglas);
            const primera = reglas[0];
            if (primera !== undefined) this.irA(PESTANA_DE_LA_REGLA[primera], CAMPO_DE_LA_REGLA[primera]);
          }
        },
      });
  }

  protected async revocar(): Promise<void> {
    const vigente = this.vigente();
    if (vigente === null || vigente.status !== 'ACTIVE') return;
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Revocar el consentimiento',
        message: `${this.nombreDelObjeto()}: ${this.targetLabel()}. La revocación no afecta lo ya realizado y queda en el expediente con su motivo.`,
        confirmLabel: 'Revocar consentimiento',
        cancelLabel: 'No revocar',
        destructive: true,
      },
      {
        label: 'Motivo de la revocación',
        hint: 'En palabras de la persona, si es posible.',
        placeholder: 'Ej.: Prefiere consultar otra opinión antes de empezar',
        minLength: 3,
        maxLength: 1000,
      },
    );
    if (motivo === null) return;
    this.revocacion.set(loading());
    this.client.withdraw(vigente.id, motivo).subscribe({
      next: (revocado) => {
        this.revocacion.set(ready(null));
        this.consentChanged.emit(revocado);
        this.recargar();
      },
      error: (error: unknown) => this.revocacion.set(errorToViewState<null>(error)),
    });
  }

  /** Lleva el foco al control del campo, ya con su pestaña dibujada. */
  private enfocar(campo: string): void {
    afterNextRender(
      () => {
        const raiz = this.host.nativeElement;
        const control = raiz.querySelector<HTMLElement>(
          `[data-campo="${campo}"] :is(textarea, input, button)`,
        );
        control?.focus();
      },
      { injector: this.injector },
    );
  }

  protected nombreDelOtorganteDe(c: InformedConsent): string {
    return c.grantedBy === null ? '—' : NOMBRE_DEL_OTORGANTE[c.grantedBy];
  }

  protected estadoDe(c: InformedConsent) {
    return estadoDelConsentimiento(c);
  }
}

function prellenar(destino: ReturnType<typeof signal<string>>, valor: string | undefined): void {
  if (valor !== undefined && valor.trim() !== '' && destino().trim() === '') destino.set(valor);
}
