import type { NewOwnSite } from '../../../core/data-access/practice-sites/practice-sites.types';
import { componerDireccion } from '../shared-registration/address-line';
import type { Coordinates } from '../shared-registration/map-location-picker/map-location-picker';

/**
 * Cómo se llama un consultorio al que nadie le puso nombre.
 *
 * `NewOwnSite.name` es obligatorio del lado del backend, y el alta no lo exige:
 * quien deja el rótulo vacío igual tiene un consultorio. Se renombra desde el
 * perfil cuando quiera.
 */
export const DEFAULT_OWN_SITE_NAME = 'Mi consultorio';

/** Lo que la página «Su consultorio propio» respondió, tal como sale del formulario. */
export interface OwnSiteAnswers {
  readonly name: string;
  readonly addressLines: string;
  readonly district: string;
  readonly contactPhone: string;
  /** Deducido del punto del mapa, o `null` si no se confirmó ninguno. */
  readonly municipalityConceptId: string | null;
  readonly point: Coordinates | null;
  /** El logo ya pre-cargado (`PracticeLogoClient.uploadForRegistration`), o `null`. */
  readonly logoFileId: string | null;
}

/**
 * El consultorio propio tal como viaja en el alta, o `null` si no declaró
 * ninguno.
 *
 * ## Qué cuenta como «declaró uno»
 *
 * **Cualquiera de sus piezas**: un nombre, un teléfono, una localidad, una
 * calle, un punto o un logo. La página entera es opcional, así que lo que
 * decide no es un campo obligatorio sino que haya algo que guardar. Exigir el
 * nombre habría hecho que quien completa la dirección —o sube su logo— y se
 * olvida del rótulo pierda lo cargado sin que nadie se lo diga.
 *
 * Sin nombre se manda el genérico: el backend lo exige (`NewOwnSite.name`) y
 * un consultorio sin rótulo se sigue pudiendo renombrar desde el perfil.
 *
 * ## La forma es la de `NewOwnSite`, no una nueva
 *
 * Es exactamente el cuerpo que ya recibe `POST /practitioners/me/sites`
 * (ALV-005/006) y que arma «Mi perfil → dónde trabajo». No se inventa un
 * contrato: el alta pública no puede llamar a esa ruta —no hay sesión
 * todavía, el registro termina en el login— así que el dato viaja adentro del
 * alta y el backend reutiliza el mismo servicio.
 */
export function ownSiteFromAnswers(answers: OwnSiteAnswers): NewOwnSite | null {
  const name = answers.name.trim();
  const contactPhone = answers.contactPhone.trim();
  const hasAddress = hasAddressAnswer(answers);

  if (name === '' && contactPhone === '' && !hasAddress && answers.logoFileId === null) {
    return null;
  }

  return {
    name: name === '' ? DEFAULT_OWN_SITE_NAME : name,
    ...(contactPhone === '' ? {} : { contactPhone }),
    // La dirección sólo viaja si tiene algo adentro: una dirección vacía no es
    // «sin dirección», es una fila vacía en `common.addresses`. Es la misma
    // regla que ya aplica `work-history.ts` al registrar una sede.
    ...(hasAddress ? { address: addressOf(answers) } : {}),
    ...(answers.logoFileId === null ? {} : { logoFileId: answers.logoFileId }),
  };
}

function hasAddressAnswer(answers: OwnSiteAnswers): boolean {
  return (
    answers.addressLines.trim() !== '' ||
    answers.district.trim() !== '' ||
    answers.municipalityConceptId !== null ||
    answers.point !== null
  );
}

function addressOf(answers: OwnSiteAnswers): NonNullable<NewOwnSite['address']> {
  // El distrito no tiene columna propia: viaja dentro de la línea de dirección.
  const street = componerDireccion(answers.addressLines, answers.district);
  const { municipalityConceptId, point } = answers;
  return {
    lines: street === '' ? [] : [street],
    ...(municipalityConceptId === null ? {} : { municipalityConceptId }),
    ...(point === null ? {} : { latitude: point.lat, longitude: point.lng }),
  };
}
