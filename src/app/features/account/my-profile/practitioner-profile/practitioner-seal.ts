import type { OwnPractitionerProfile } from '../../../../core/data-access/profiles/profiles.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';

/* ============================================================================
    El sello de cada dato del perfil profesional, leído de sus conceptos.

    Vive aparte de la ficha porque lo usan también «Mis verificaciones» y el
    directorio: importarlo del componente arrastraba sus 1100 líneas al
    fragmento de quien sólo necesitaba esto.
    ========================================================================== */

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

/**
 * El sello de un concepto de estado.
 *
 * Se decide por el **código**, no por la etiqueta: la etiqueta se traduce y se
 * reescribe, el código es el contrato. Lo que el catálogo no resuelve queda en
 * neutro — afirmar «verificado» sobre un concepto que no se pudo leer sería
 * inventar, y acá lo que se afirma es la habilitación de alguien para ejercer.
 */
export function sello(etiquetas: ConceptLabels, conceptId: string | undefined): StatusSealVariant {
  const crudo = conceptId === undefined ? undefined : etiquetas.get(conceptId)?.code;
  if (crudo === undefined) {
    return 'unknown';
  }
  // «ST-VERIFIED» (catálogo de registros) y «PRACT_VERIF_VERIFIED» (el estado del
  // profesional) dicen lo mismo que «VERIFIED»: sin esto quedaban en `unknown` y el
  // sello mostraba un «?» junto a la palabra «Verificado».
  const codigo = crudo.replace(/^ST-/, '').replace(/-/g, '_');
  if (/(^|_)VERIFIED$/.test(codigo) && !/(^|_)UNVERIFIED$/.test(codigo)) {
    return 'approved';
  }
  if (
    codigo === 'REJECTED' ||
    codigo === 'REVOKED' ||
    codigo.endsWith('_REJECTED') ||
    codigo.endsWith('_REVOKED')
  )
    return 'rejected';
  if (codigo === 'EXPIRED' || codigo.endsWith('_EXPIRED')) return 'expired';
  if (codigo.endsWith('_PENDING') || codigo === 'PENDING') return 'pending';
  if (CODIGOS_EN_ORDEN.includes(codigo)) {
    return 'approved';
  }
  if (CODIGOS_PENDIENTES.includes(codigo)) {
    return 'in-review';
  }
  return 'unknown';
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
    // Los dos conceptos de la filiación. La ficha los dibuja desde que existe
    // —el departamento como sufijo del documento, «5414404 Santa Cruz», y la
    // localidad de residencia—, pero nadie pedía sus etiquetas: el `Map`
    // llegaba sin ellos, `etiquetaOpcional` devolvía cadena vacía y los dos
    // renglones se veían como si el dato no estuviera. El dato estaba; faltaba
    // pedir cómo se llama.
    perfil.issuerAdministrativeAreaConceptId,
    perfil.residenceMunicipalityConceptId,
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
    // Los opcionales que no vinieron se descartan acá: mandar `undefined` en
    // la lista de ids lo convertiría en la cadena «undefined» dentro del
    // `?ids=` de la petición.
  ].filter((id): id is string => id !== undefined);
}
