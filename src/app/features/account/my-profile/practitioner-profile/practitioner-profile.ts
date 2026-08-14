import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  OwnPractitionerProfile,
  PractitionerCredential,
  PractitionerLanguage,
  PractitionerLicense,
  PractitionerSpecialty,
} from '../../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Avatar } from '../../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Card } from '../../../../shared/components/molecules/card/card';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/**
 * Códigos de terminología que significan «esto está en orden».
 *
 * Se comparan contra el **código** del concepto y no contra su etiqueta: la
 * etiqueta se traduce y se reescribe, el código es el contrato. Si el catálogo
 * no resuelve el concepto, no se afirma nada — el sello queda neutro, que es lo
 * honesto cuando no se sabe.
 */
const CODIGOS_EN_ORDEN = ['VERIFIED', 'ACTIVE', 'CRED_VERIFIED', 'AUTH_ACTIVE', 'PRACTICE_ACTIVE'];

/** Códigos que significan «todavía no». */
const CODIGOS_PENDIENTES = ['PENDING', 'ONBOARDING', 'CRED_PENDING', 'AUTH_PENDING', 'IN_REVIEW'];

/** Una fila de formación, ya traducida y con su vigencia resuelta. */
export interface FormacionVisible {
  readonly id: string;
  readonly tipo: string;
  readonly numero: string;
  readonly institucion: string;
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly estado: string;
  readonly sello: StatusSealVariant;
  /** Si venció. Se muestra igual: la formación cursada no deja de existir. */
  readonly vencida: boolean;
}

/** Una especialidad, ya traducida. */
export interface EspecialidadVisible {
  readonly id: string;
  readonly nombre: string;
  readonly principal: boolean;
  readonly certificada: boolean;
  readonly alcance: string;
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly estado: string;
}

/** Una matrícula, ya traducida. */
export interface MatriculaVisible {
  readonly id: string;
  readonly jurisdiccion: string;
  readonly numero: string;
  readonly autoridad: string;
  readonly estado: string;
  readonly sello: StatusSealVariant;
  readonly hasta: Date | null;
}

/** Un idioma, ya traducido. */
export interface IdiomaVisible {
  readonly id: string;
  readonly nombre: string;
  readonly nivel: string;
  readonly interpreta: boolean;
}

/**
 * **Perfil profesional propio** — `GET /profiles/practitioners/me/summary`.
 *
 * ## Qué problema resuelve
 *
 * «Mi perfil» llamaba a `GET /profiles/patients/me/summary` para todo el mundo.
 * A un profesional ese endpoint le responde `404` —no tiene perfil de paciente—
 * o `403` si además no verificó su identidad, así que la pantalla de perfil de
 * un médico no mostraba absolutamente nada. No era un defecto de la pantalla:
 * no existía la lectura que la sirviera. Ahora existe, y esto la muestra.
 *
 * ## Qué muestra, y por qué en ese orden
 *
 * Es una **trayectoria**, no una ficha de cuatro campos. El orden es el de las
 * preguntas que alguien se hace sobre un profesional:
 *
 * 1. **Quién es** — nombre, título, especialidad principal, si toma pacientes.
 * 2. **Cómo se presenta** — la biografía, en sus palabras.
 * 3. **Qué lleva hecho acá** — las cuentas de su actividad en la plataforma.
 * 4. **Qué ejerce** — especialidades, vigentes y pasadas.
 * 5. **Qué estudió** — credenciales, en línea de tiempo.
 * 6. **Dónde puede ejercer** — matrículas y su vigencia.
 * 7. **En qué idiomas atiende**.
 *
 * ## Lo vencido y lo pendiente se muestran igual
 *
 * Una certificación que caducó sigue siendo formación cursada, y esconderla
 * dejaría huecos inexplicables en la línea de tiempo. Lo que cambia es el sello,
 * no la presencia. Y lo que el catálogo no resuelve **no se afirma**: el sello
 * queda neutro en vez de inventar un «verificado».
 */
@Component({
  selector: 'app-practitioner-profile',
  imports: [
    Avatar,
    Badge,
    AppButtonLink,
    Card,
    Chip,
    DatePipe,
    RouterLink,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './practitioner-profile.html',
  styleUrl: './practitioner-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfile {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly perfil = signal<ViewState<OwnPractitionerProfile>>(loading());

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly datos = computed(() => dataOf(this.perfil()));

  /* -- Cabecera ----------------------------------------------------------- */

  protected readonly nombre = computed(() => this.datos()?.displayName ?? SIN_DATO);

  protected readonly titulo = computed(() => this.datos()?.professionalTitle ?? '');

  /**
   * La especialidad con la que se presenta.
   *
   * La marcada como principal; si ninguna lo está, la primera vigente. Sin
   * ninguna vigente no se cae a una pasada: presentar a alguien con una
   * especialidad que dejó de ejercer es decir algo falso.
   */
  protected readonly especialidadPrincipal = computed(() => {
    const especialidades = this.especialidades();
    return (
      especialidades.find((especialidad) => especialidad.principal && especialidad.hasta === null)
        ?.nombre ??
      especialidades.find((especialidad) => especialidad.hasta === null)?.nombre ??
      ''
    );
  });

  /** El estado de verificación del profesional, con su sello. */
  protected readonly verificacion = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return null;
    }
    return {
      label: this.label(datos.verificationStatusConceptId),
      variant: this.sello(datos.verificationStatusConceptId),
    };
  });

  protected readonly estadoDePractica = computed(() => {
    const datos = this.datos();
    return datos === null ? '' : this.label(datos.practiceStatusConceptId);
  });

  /* -- Actividad ----------------------------------------------------------- */

  /**
   * Las cuentas de lo que dejó asentado.
   *
   * No son un ranking y no hay nada comparativo: sirven para que quien mira su
   * perfil sepa qué registró. El detalle de cada encuentro o receta vive en el
   * expediente de la persona atendida, con sus permisos, y traerlo acá sacaría
   * datos clínicos de su control de acceso.
   */
  protected readonly actividad = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return [];
    }
    return [
      { clave: 'encuentros', rotulo: 'Encuentros atendidos', valor: datos.activity.encounters },
      { clave: 'recetas', rotulo: 'Recetas emitidas', valor: datos.activity.medicationRequests },
      { clave: 'notas', rotulo: 'Notas clínicas', valor: datos.activity.clinicalNotes },
      { clave: 'documentos', rotulo: 'Documentos publicados', valor: datos.activity.documents },
    ];
  });

  /* -- Trayectoria --------------------------------------------------------- */

  protected readonly especialidades = computed<readonly EspecialidadVisible[]>(() =>
    (this.datos()?.specialties ?? []).map((especialidad: PractitionerSpecialty) => ({
      id: especialidad.id,
      nombre: this.label(especialidad.specialtyConceptId),
      principal: especialidad.isPrimary,
      certificada: especialidad.boardCertified,
      alcance: especialidad.practiceScopeText ?? '',
      desde: especialidad.validFrom ?? null,
      hasta: especialidad.validTo ?? null,
      estado: this.label(especialidad.verificationStatusConceptId),
    })),
  );

  /**
   * La formación, de la más reciente a la más antigua.
   *
   * El backend ya la ordena, pero el orden es parte de lo que hace legible una
   * línea de tiempo y no puede depender de que la consulta no cambie.
   */
  protected readonly formacion = computed<readonly FormacionVisible[]>(() => {
    const ahora = new Date();
    return [...(this.datos()?.credentials ?? [])]
      .sort((a, b) => fecha(b.issueDate) - fecha(a.issueDate))
      .map((credencial: PractitionerCredential) => {
        const vencida = credencial.expiryDate !== undefined && credencial.expiryDate < ahora;
        return {
          id: credencial.id,
          tipo: this.label(credencial.credentialTypeConceptId),
          numero: credencial.number,
          institucion: credencial.issuingInstitutionText ?? '',
          desde: credencial.issueDate ?? null,
          hasta: credencial.expiryDate ?? null,
          estado: this.label(credencial.stateConceptId),
          // El vencimiento manda sobre todo lo demás —una credencial vencida no
          // habilita, por más verificada que esté—; después la verificación
          // manda sobre el estado del catálogo, porque una credencial con fecha
          // de comprobación está verificada aunque el concepto no se resuelva.
          sello: vencida
            ? ('expired' as StatusSealVariant)
            : credencial.verifiedAt !== undefined
              ? ('approved' as StatusSealVariant)
              : this.sello(credencial.stateConceptId),
          vencida,
        };
      });
  });

  protected readonly matriculas = computed<readonly MatriculaVisible[]>(() =>
    (this.datos()?.licenses ?? []).map((matricula: PractitionerLicense) => ({
      id: matricula.id,
      jurisdiccion: this.label(matricula.jurisdictionConceptId),
      numero: matricula.licenseNumber,
      autoridad: matricula.regulatoryAuthority ?? '',
      estado: this.label(matricula.stateConceptId),
      sello: this.sello(matricula.stateConceptId),
      hasta: matricula.validTo ?? null,
    })),
  );

  protected readonly idiomas = computed<readonly IdiomaVisible[]>(() =>
    (this.datos()?.languages ?? []).map((idioma: PractitionerLanguage) => ({
      id: idioma.languageConceptId,
      nombre: this.label(idioma.languageConceptId),
      nivel:
        idioma.proficiencyConceptId === undefined ? '' : this.label(idioma.proficiencyConceptId),
      interpreta: idioma.clinicalInterpretationAllowed,
    })),
  );

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.etiquetas.set(new Map());

    this.profiles
      .getOwnPractitionerProfile()
      .pipe(
        switchMap((perfil) =>
          forkJoin({
            perfil: of(perfil),
            // El fallo del catálogo degrada las etiquetas a «sin registrar»; no
            // puede tumbar la pantalla que muestra la trayectoria de alguien.
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(perfil))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ perfil, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.perfil.set(ready(perfil));
        },
        error: (error: unknown) => this.perfil.set(errorToViewState<OwnPractitionerProfile>(error)),
      });
  }

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * El sello de un concepto de estado.
   *
   * Se decide por el **código**, no por la etiqueta: la etiqueta se traduce y se
   * reescribe, el código es el contrato. Lo que el catálogo no resuelve queda en
   * neutro — afirmar «verificado» sobre un concepto que no se pudo leer sería
   * inventar, y acá lo que se afirma es la habilitación de alguien para ejercer.
   */
  private sello(conceptId: string | undefined): StatusSealVariant {
    const codigo = conceptId === undefined ? undefined : this.etiquetas().get(conceptId)?.code;
    if (codigo === undefined) {
      return 'unknown';
    }
    if (CODIGOS_EN_ORDEN.some((esperado) => codigo.includes(esperado))) {
      return 'approved';
    }
    if (CODIGOS_PENDIENTES.some((esperado) => codigo.includes(esperado))) {
      return 'in-review';
    }
    return 'unknown';
  }
}

/** Milisegundos de una fecha opcional; las ausentes van al fondo del orden. */
function fecha(valor: Date | undefined): number {
  return valor?.getTime() ?? 0;
}

/**
 * Todos los conceptos del perfil, de una sola pasada.
 *
 * Se juntan para pedir el catálogo **una vez**: son hasta seis colecciones y una
 * lectura por colección multiplicaría por seis las peticiones de una pantalla
 * que ya hizo la suya.
 */
function conceptosDe(perfil: OwnPractitionerProfile): readonly string[] {
  return [
    perfil.practitionerCategoryConceptId,
    perfil.verificationStatusConceptId,
    perfil.practiceStatusConceptId,
    ...perfil.specialties.flatMap((especialidad) => [
      especialidad.specialtyConceptId,
      especialidad.verificationStatusConceptId,
    ]),
    ...perfil.credentials.flatMap((credencial) => [
      credencial.credentialTypeConceptId,
      credencial.stateConceptId,
    ]),
    ...perfil.licenses.flatMap((matricula) => [
      matricula.jurisdictionConceptId,
      matricula.stateConceptId,
    ]),
    ...perfil.languages.flatMap((idioma) =>
      idioma.proficiencyConceptId === undefined
        ? [idioma.languageConceptId]
        : [idioma.languageConceptId, idioma.proficiencyConceptId],
    ),
  ];
}
