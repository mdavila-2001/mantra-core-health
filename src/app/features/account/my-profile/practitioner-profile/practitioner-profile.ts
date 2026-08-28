import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  OwnPractitionerProfile,
  PractitionerAffiliation,
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
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { PractitionerProfileView } from './practitioner-profile-view/practitioner-profile-view';
import type {
  AfiliacionVisible,
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  MatriculaVisible,
  PerfilProfesionalVisible,
} from './practitioner-profile-view/practitioner-profile-view.types';

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

/** El perfil crudo junto a lo que se resolvió aparte para pintarlo. */
interface PerfilResuelto {
  readonly perfil: OwnPractitionerProfile;
  readonly etiquetas: ConceptLabels;
  readonly fotoUrl: string | null;
}

/**
 * **Perfil profesional propio** — el contenedor de «Mi perfil».
 *
 * ## Qué quedó acá y qué se fue (carril R2-4)
 *
 * Este componente ya no dibuja nada: pide `me/summary`, resuelve las etiquetas
 * de terminología y la URL de la foto, arma el `PerfilProfesionalVisible` y se
 * lo pasa a `practitioner-profile-view`, que es quien pinta. La separación no
 * es refactor por gusto: la guía de profesionales (carril R2-1) pinta el perfil
 * de OTRO doctor con la misma vista, y sin esto habría dos perfiles de doctor
 * con dos criterios distintos — exactamente lo que generó el reclamo del
 * punto 4.
 *
 * ## Qué problema resolvía ya
 *
 * «Mi perfil» llamaba a `GET /profiles/patients/me/summary` para todo el mundo.
 * A un profesional ese endpoint le responde `404` —no tiene perfil de paciente—
 * o `403` si además no verificó su identidad, así que la pantalla de perfil de
 * un médico no mostraba absolutamente nada. No era un defecto de la pantalla:
 * no existía la lectura que la sirviera. Ahora existe, y esto la muestra.
 *
 * ## Los fallos laterales degradan, no tumban
 *
 * El catálogo caído deja las etiquetas en «sin registrar»; la foto que no se
 * pudo resolver deja el avatar de iniciales. Ninguno de los dos puede tumbar la
 * pantalla que muestra la trayectoria de alguien.
 */

/**
 * La edad, calculada de la fecha de nacimiento.
 *
 * Es derivada: el registro del cliente la pide «de manera automática», así que
 * no se guarda ni se pide al servidor. `null` si no declaró la fecha o si el
 * resultado no es una edad creíble.
 */
function edadDe(nacimiento?: Date): number | null {
  if (!nacimiento) return null;
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) anios -= 1;
  return anios >= 0 && anios < 130 ? anios : null;
}

@Component({
  selector: 'app-practitioner-profile',
  imports: [PractitionerProfileView, ViewStateHost],
  templateUrl: './practitioner-profile.html',
  styleUrl: './practitioner-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfile {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly files = inject(FilesClient);

  protected readonly perfil = signal<ViewState<PerfilResuelto>>(loading());

  /** El perfil ya convertido al contrato de la vista. */
  protected readonly visible = computed<PerfilProfesionalVisible | null>(() => {
    const resuelto = dataOf(this.perfil());
    return resuelto === null ? null : this.convertir(resuelto);
  });

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());

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
            // La foto es un adorno con el mismo criterio: si la URL no sale,
            // queda el avatar de iniciales, que es el caso vacío correcto.
            fotoUrl:
              perfil.photoFileId === undefined
                ? of<string | null>(null)
                : this.files.downloadUrl(perfil.photoFileId).pipe(
                    map((descarga) => descarga.url),
                    catchError(() => of<string | null>(null)),
                  ),
          }),
        ),
      )
      .subscribe({
        next: (resuelto) => this.perfil.set(ready(resuelto)),
        error: (error: unknown) => this.perfil.set(errorToViewState<PerfilResuelto>(error)),
      });
  }

  /* -- Del perfil crudo al contrato de la vista --------------------------- */

  private convertir(resuelto: PerfilResuelto): PerfilProfesionalVisible {
    const { perfil, etiquetas, fotoUrl } = resuelto;
    const especialidades = this.especialidades(perfil, etiquetas);
    const afiliaciones = afiliacionesDe(perfil);
    return {
      nombre: perfil.displayName || SIN_DATO,
      titulo: perfil.professionalTitle ?? '',
      especialidadPrincipal: especialidadPrincipal(especialidades),
      codigo: perfil.practitionerCode,
      fotoUrl,
      verificacion: {
        label: label(etiquetas, perfil.verificationStatusConceptId),
        variant: sello(etiquetas, perfil.verificationStatusConceptId),
      },
      estadoDePractica: label(etiquetas, perfil.practiceStatusConceptId),
      aceptaPacientesNuevos: perfil.acceptsNewPatients,
      telemedicina: perfil.telehealthAvailable,
      bio: perfil.professionalBio ?? '',
      actividad: [
        { clave: 'encuentros', rotulo: 'Encuentros atendidos', valor: perfil.activity.encounters },
        {
          clave: 'recetas',
          rotulo: 'Recetas emitidas',
          valor: perfil.activity.medicationRequests,
        },
        { clave: 'notas', rotulo: 'Notas clínicas', valor: perfil.activity.clinicalNotes },
        { clave: 'documentos', rotulo: 'Documentos publicados', valor: perfil.activity.documents },
      ],
      especialidades,
      formacion: this.formacion(perfil, etiquetas),
      matriculas: this.matriculas(perfil, etiquetas),
      idiomas: this.idiomas(perfil, etiquetas),
      // Sólo en la ficha propia: el documento y la fecha de nacimiento de un
      // colega no son de quien mira su ficha. Este componente ES la ficha
      // propia, así que siempre se arman; la del directorio pasa `null`.
      datosPersonales: {
        documento: perfil.nationalId ?? '',
        departamento: perfil.issuerAdministrativeAreaConceptId
          ? label(etiquetas, perfil.issuerAdministrativeAreaConceptId)
          : '',
        fechaNacimiento: perfil.birthDate ?? null,
        edad: edadDe(perfil.birthDate),
        telefono: perfil.phone ?? '',
        correo: perfil.email ?? '',
        domicilio: perfil.residenceMunicipalityConceptId
          ? label(etiquetas, perfil.residenceMunicipalityConceptId)
          : '',
      },
      actividadActual: afiliaciones.actual,
      experienciaHistorica: afiliaciones.historica,
      desde: perfil.createdAt ?? null,
    };
  }

  private especialidades(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly EspecialidadVisible[] {
    return perfil.specialties.map((especialidad: PractitionerSpecialty) => ({
      id: especialidad.id,
      nombre: label(etiquetas, especialidad.specialtyConceptId),
      principal: especialidad.isPrimary,
      certificada: especialidad.boardCertified,
      alcance: especialidad.practiceScopeText ?? '',
      desde: especialidad.validFrom ?? null,
      hasta: especialidad.validTo ?? null,
      estado: label(etiquetas, especialidad.verificationStatusConceptId),
      sello: sello(etiquetas, especialidad.verificationStatusConceptId),
    }));
  }

  /**
   * La formación, de la más reciente a la más antigua.
   *
   * El backend ya la ordena, pero el orden es parte de lo que hace legible una
   * línea de tiempo y no puede depender de que la consulta no cambie.
   */
  private formacion(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly FormacionVisible[] {
    const ahora = new Date();
    return [...perfil.credentials]
      .sort((a, b) => fecha(b.issueDate) - fecha(a.issueDate))
      .map((credencial: PractitionerCredential) => {
        const vencida = credencial.expiryDate !== undefined && credencial.expiryDate < ahora;
        return {
          id: credencial.id,
          tipo: label(etiquetas, credencial.credentialTypeConceptId),
          numero: credencial.number,
          institucion: credencial.issuingInstitutionText ?? '',
          desde: credencial.issueDate ?? null,
          hasta: credencial.expiryDate ?? null,
          estado: label(etiquetas, credencial.stateConceptId),
          // El vencimiento manda sobre todo lo demás —una credencial vencida no
          // habilita, por más verificada que esté—; después la verificación
          // manda sobre el estado del catálogo, porque una credencial con fecha
          // de comprobación está verificada aunque el concepto no se resuelva.
          sello: vencida
            ? ('expired' as StatusSealVariant)
            : credencial.verifiedAt !== undefined
              ? ('approved' as StatusSealVariant)
              : sello(etiquetas, credencial.stateConceptId),
          vencida,
          fuenteVerificacion: credencial.verificationSourceUri,
        };
      });
  }

  private matriculas(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly MatriculaVisible[] {
    return perfil.licenses.map((matricula: PractitionerLicense) => ({
      id: matricula.id,
      jurisdiccion: label(etiquetas, matricula.jurisdictionConceptId),
      numero: matricula.licenseNumber,
      autoridad: matricula.regulatoryAuthority ?? '',
      estado: label(etiquetas, matricula.stateConceptId),
      sello: sello(etiquetas, matricula.stateConceptId),
      hasta: matricula.validTo ?? null,
    }));
  }

  private idiomas(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly IdiomaVisible[] {
    return perfil.languages.map((idioma: PractitionerLanguage) => ({
      id: idioma.languageConceptId,
      nombre: label(etiquetas, idioma.languageConceptId),
      nivel:
        idioma.proficiencyConceptId === undefined
          ? ''
          : label(etiquetas, idioma.proficiencyConceptId),
      interpreta: idioma.clinicalInterpretationAllowed,
    }));
  }
}

/** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
function label(etiquetas: ConceptLabels, conceptId: string | undefined): string {
  if (conceptId === undefined) {
    return SIN_DATO;
  }
  return etiquetas.get(conceptId)?.display ?? SIN_DATO;
}

/**
 * El sello de un concepto de estado.
 *
 * Se decide por el **código**, no por la etiqueta: la etiqueta se traduce y se
 * reescribe, el código es el contrato. Lo que el catálogo no resuelve queda en
 * neutro — afirmar «verificado» sobre un concepto que no se pudo leer sería
 * inventar, y acá lo que se afirma es la habilitación de alguien para ejercer.
 */
function sello(etiquetas: ConceptLabels, conceptId: string | undefined): StatusSealVariant {
  const codigo = conceptId === undefined ? undefined : etiquetas.get(conceptId)?.code;
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

/**
 * La especialidad con la que se presenta.
 *
 * La marcada como principal; si ninguna lo está, la primera vigente. Sin
 * ninguna vigente no se cae a una pasada: presentar a alguien con una
 * especialidad que dejó de ejercer es decir algo falso.
 */
function especialidadPrincipal(especialidades: readonly EspecialidadVisible[]): string {
  return (
    especialidades.find((especialidad) => especialidad.principal && especialidad.hasta === null)
      ?.nombre ??
    especialidades.find((especialidad) => especialidad.hasta === null)?.nombre ??
    ''
  );
}

/** Milisegundos de una fecha opcional; las ausentes van al fondo del orden. */
function fecha(valor: Date | undefined): number {
  return valor?.getTime() ?? 0;
}

/**
 * El historial laboral (UC-05-16), separado en fase actual e histórica.
 *
 * `current` ya viene derivado del backend por `endDate`: acá sólo se traduce
 * al contrato de la vista y se reparte en los dos grupos que pide la pestaña
 * Trayectoria — «actividad actual» primero, por ser lo más relevante hoy.
 */
function afiliacionesDe(perfil: OwnPractitionerProfile): {
  readonly actual: readonly AfiliacionVisible[];
  readonly historica: readonly AfiliacionVisible[];
} {
  const visibles = [...perfil.affiliations]
    .sort((a, b) => fecha(b.startDate) - fecha(a.startDate))
    .map((afiliacion: PractitionerAffiliation) => ({
      id: afiliacion.id,
      organizacion: afiliacion.organizationName,
      cargo: afiliacion.roleTitle,
      area: afiliacion.departmentText ?? '',
      desde: afiliacion.startDate,
      hasta: afiliacion.endDate,
      actual: afiliacion.current,
    }));
  return {
    actual: visibles.filter((afiliacion) => afiliacion.actual),
    historica: visibles.filter((afiliacion) => !afiliacion.actual),
  };
}

/**
 * Todos los conceptos del perfil, de una sola pasada.
 *
 * Se juntan para pedir el catálogo **una vez**: son hasta seis colecciones y una
 * lectura por colección multiplicaría por seis las peticiones de una pantalla
 * que ya hizo la suya.
 */
export function conceptosDe(perfil: OwnPractitionerProfile): readonly string[] {
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
