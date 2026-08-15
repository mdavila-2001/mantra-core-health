import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { FilesClient } from '../../../core/data-access/files/files.client';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type {
  OwnPractitionerProfile,
  PractitionerAffiliation,
  PractitionerCredential,
  PractitionerLanguage,
  PractitionerLicense,
  PractitionerSpecialty,
} from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { conceptosDe } from '../../account/my-profile/practitioner-profile/practitioner-profile';
import { PractitionerProfileView } from '../../account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view';
import type {
  AfiliacionVisible,
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  MatriculaVisible,
  PerfilProfesionalVisible,
} from '../../account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view.types';

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Códigos de terminología que significan «esto está en orden». */
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
 * **La ficha de un profesional** — el destino del clic en la guía.
 *
 * ## No pinta el perfil por su cuenta
 *
 * Importa `practitioner-profile-view` —el componente presentacional que dejó
 * el carril R2-4— y le pasa el perfil que trajo
 * `GET /profiles/practitioners/:id/summary`. Es el **mismo** dibujo con el que
 * un doctor ve su propio perfil.
 *
 * Reimplementarlo acá daría dos perfiles de doctor distintos en el producto,
 * que es exactamente lo que el punto 4 del reclamo señaló. Lo único que cambia
 * es `esPropio`, en `false`: no hay botones de dueño ni se tutea a nadie.
 *
 * ## Por qué repite la resolución y no la comparte
 *
 * El contenedor propio pide `me/summary`; éste pide por id. Son dos lecturas
 * distintas del mismo contrato, y lo que sigue —traducir conceptos, resolver
 * la foto, decidir sellos— es idéntico. Se comparte lo que ya estaba
 * exportado (`conceptosDe`); el resto son funciones puras de traducción, y
 * extraerlas a un tercer archivo sólo para no repetir treinta líneas ataría
 * dos pantallas por un módulo que no describe nada del dominio.
 */
@Component({
  selector: 'app-practitioner-detail',
  imports: [PageHeader, PractitionerProfileView, ViewStateHost],
  templateUrl: './practitioner-detail.html',
  styleUrl: './practitioner-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly files = inject(FilesClient);

  protected readonly estado = signal<ViewState<PerfilResuelto>>(loading());

  protected readonly visible = computed<PerfilProfesionalVisible | null>(() => {
    const resuelto = dataOf(this.estado());
    return resuelto === null ? null : convertir(resuelto);
  });

  protected readonly titulo = computed(() => this.visible()?.nombre ?? 'Profesional');

  private profileId: string | null = null;

  constructor() {
    // Por `paramMap` y no por `snapshot`: al navegar de una ficha a otra el
    // router reutiliza el componente, y con el snapshot quedaría mostrando al
    // profesional anterior.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.profileId = params.get('profileId');
      this.cargar();
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  protected cargar(): void {
    const profileId = this.profileId;
    if (profileId === null || profileId === '') {
      // Sin id no hay a quién consultar: es «no encontrado» con salida a la
      // guía, no un error de red que invite a reintentar.
      this.estado.set(notFound({ label: 'Volver a la guía', route: '/directory' }));
      return;
    }
    this.estado.set(loading());

    this.profiles
      .getPractitionerProfile(profileId)
      .pipe(
        switchMap((perfil) =>
          forkJoin({
            perfil: of(perfil),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(perfil))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
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
        next: (resuelto) => this.estado.set(ready(resuelto)),
        error: (error: unknown) => this.estado.set(errorToViewState<PerfilResuelto>(error)),
      });
  }
}

/* -- Del perfil crudo al contrato de la vista ------------------------------ */

function convertir(resuelto: PerfilResuelto): PerfilProfesionalVisible {
  const { perfil, etiquetas, fotoUrl } = resuelto;
  const especialidades = especialidadesDe(perfil, etiquetas);
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
      { clave: 'recetas', rotulo: 'Recetas emitidas', valor: perfil.activity.medicationRequests },
      { clave: 'notas', rotulo: 'Notas clínicas', valor: perfil.activity.clinicalNotes },
      { clave: 'documentos', rotulo: 'Documentos publicados', valor: perfil.activity.documents },
    ],
    especialidades,
    formacion: formacionDe(perfil, etiquetas),
    matriculas: matriculasDe(perfil, etiquetas),
    idiomas: idiomasDe(perfil, etiquetas),
    actividadActual: afiliaciones.actual,
    experienciaHistorica: afiliaciones.historica,
    perfilId: perfil.profileId,
    personaId: perfil.personId,
    desde: perfil.createdAt ?? null,
  };
}

function especialidadesDe(
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

function formacionDe(
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

function matriculasDe(
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

function idiomasDe(
  perfil: OwnPractitionerProfile,
  etiquetas: ConceptLabels,
): readonly IdiomaVisible[] {
  return perfil.languages.map((idioma: PractitionerLanguage) => ({
    id: idioma.languageConceptId,
    nombre: label(etiquetas, idioma.languageConceptId),
    nivel:
      idioma.proficiencyConceptId === undefined ? '' : label(etiquetas, idioma.proficiencyConceptId),
    interpreta: idioma.clinicalInterpretationAllowed,
  }));
}

/** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
function label(etiquetas: ConceptLabels, conceptId: string | undefined): string {
  if (conceptId === undefined) {
    return SIN_DATO;
  }
  return etiquetas.get(conceptId)?.display ?? SIN_DATO;
}

/**
 * El sello de un concepto de estado, decidido por el **código** y no por la
 * etiqueta. Lo que el catálogo no resuelve queda neutro: afirmar «verificado»
 * sobre lo que no se pudo leer sería inventar la habilitación de alguien.
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

/** La principal vigente; sin ninguna vigente, ninguna. */
function especialidadPrincipal(especialidades: readonly EspecialidadVisible[]): string {
  return (
    especialidades.find((e) => e.principal && e.hasta === null)?.nombre ??
    especialidades.find((e) => e.hasta === null)?.nombre ??
    ''
  );
}

/** Milisegundos de una fecha opcional; las ausentes van al fondo del orden. */
function fecha(valor: Date | undefined): number {
  return valor?.getTime() ?? 0;
}

/** El historial laboral (UC-05-16), separado en fase actual e histórica. */
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
