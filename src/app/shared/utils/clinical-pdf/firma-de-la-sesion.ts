/* ============================================================================
    Quién firma un documento clínico.

    Vivía duplicado dentro del expediente, que era la única pantalla que
    generaba papeles. Cuando la atención se separó en su propia pantalla —y se
    llevó la receta— hubo por un momento dos copias de la misma regla, que es
    exactamente la forma en que una matrícula termina imprimiéndose distinto en
    dos documentos del mismo acto clínico. La regla vive acá, una sola vez.
    ========================================================================== */

import type {
  OwnPractitionerProfile,
  PractitionerLicense,
} from '../../../core/data-access/profiles/profiles.types';
import type { ContextoDelDocumento } from './from-summary';

/** Lo que hace falta saber de la sesión para encabezar un papel. */
export interface SesionQueFirma {
  /** El nombre del paciente, tal como lo pudo leer la pantalla. */
  readonly paciente: string;

  /** El perfil profesional de la sesión, o `null` si la cuenta no ejerce. */
  readonly practitionerProfileId: string | null;

  /** El nombre del claim del token, si lo trae. */
  readonly displayName: string | null;

  /** El perfil profesional ya leído: de ahí salen las matrículas. */
  readonly perfilPropio: OwnPractitionerProfile | null;

  /** La organización activa, que es la que emite. */
  readonly tenantId: string | null;

  /** Cómo se llama esa organización. Cae al identificador si el token no lo trae. */
  readonly tenantName: (id: string) => string;
}

/**
 * Quién es quién en el papel: paciente, profesional, matrícula y organización.
 *
 * Los cuatro datos van juntos porque el papel se lee como una sola cosa: una
 * receta sin matrícula ni origen no es rastreable, y la farmacia no tiene
 * contra qué contrastarla. Los dos opcionales se omiten cuando no se saben —el
 * motor no imprime la línea— en vez de viajar vacíos: un renglón «Matrícula:»
 * sin número afirma que no tiene, que es distinto de no haberla podido leer.
 */
export function contextoDeLaSesion(sesion: SesionQueFirma): ContextoDelDocumento {
  const matricula = matriculaDe(sesion.perfilPropio);
  const organizacion = organizacionDe(sesion.tenantId, sesion.tenantName);
  return {
    paciente: sesion.paciente,
    profesional: profesionalDe(sesion),
    ...(matricula === undefined ? {} : { matricula }),
    ...(organizacion === undefined ? {} : { organizacion }),
  };
}

/**
 * Quién firma el documento.
 *
 * Hoy es el perfil profesional de la sesión, que es quien está mirando y quien
 * registró la atención. Devuelve vacío cuando la cuenta no tiene perfil
 * profesional —administración, por ejemplo—: el documento lo imprime como «No
 * registrado» en vez de atribuirle la atención a alguien.
 *
 * El nombre sale del token y, si éste no lo trae, del perfil profesional ya
 * leído: son la misma persona, y el papel no puede quedarse sin firma porque el
 * emisor del token haya omitido un claim cosmético.
 */
function profesionalDe(sesion: SesionQueFirma): string {
  if (sesion.practitionerProfileId === null) {
    return '';
  }
  return sesion.displayName ?? sesion.perfilPropio?.displayName ?? '';
}

/**
 * La matrícula con la que quien atiende está habilitado a ejercer.
 *
 * **Vigente es una ventana, no una bandera** —el mismo criterio con el que la
 * ficha de filiación lee sus vínculos—: sin `validTo` no caduca, y con
 * `validTo` en el futuro sigue habilitando. Descartar toda matrícula que
 * declare vencimiento dejaría sin firma a quien tiene la suya en regla, que es
 * el caso normal: una matrícula real se renueva y por eso trae fecha. Vencida
 * sí se descarta: firmar con ella es peor que no imprimir el renglón.
 *
 * Y la ventana tiene **dos** extremos: una matrícula cuyo `validFrom` todavía
 * no llegó —la que ya se cargó porque el trámite salió, pero habilita recién el
 * mes que viene— no habilita hoy, y firmar con ella afirma una habilitación que
 * aún no existe.
 *
 * Si hay varias vigentes —quien ejerce en más de una jurisdicción— se toma la
 * primera que declara el perfil, que es el orden en que el backend las
 * devuelve; elegir por jurisdicción exigiría saber dónde se está atendiendo, y
 * eso el documento no lo sabe.
 */
function matriculaDe(perfil: OwnPractitionerProfile | null): string | undefined {
  const licencias = perfil?.licenses ?? [];
  const ahora = Date.now();
  const vigente = licencias.find((licencia: PractitionerLicense) =>
    vigenciaCubre(licencia.validFrom, licencia.validTo, ahora),
  );
  const numero = (vigente?.licenseNumber ?? '').trim();
  return numero === '' ? undefined : numero;
}

/**
 * La organización que emite el papel: la del tenant activo de la sesión, que es
 * el mismo custodio bajo el que se registra el encuentro.
 *
 * Se imprime **el nombre o nada**. `tenantName` cae al identificador cuando el
 * token no trae el nombre: en pantalla es feo, pero en un documento clínico es
 * un uuid impreso donde debería decir de dónde salió la receta.
 */
function organizacionDe(
  tenantId: string | null,
  tenantName: (id: string) => string,
): string | undefined {
  if (tenantId === null) {
    return undefined;
  }
  const nombre = tenantName(tenantId);
  return nombre === tenantId || nombre.trim() === '' ? undefined : nombre;
}

/**
 * Si una vigencia declarada cubre el instante dado.
 *
 * Los dos extremos son opcionales y la ausencia de cada uno significa «no
 * empieza» y «no termina», que es cómo el contrato de `profiles` declara sus
 * ventanas. Mirar sólo el final trataría como habilitada a una credencial que
 * todavía no entró en vigencia.
 */
function vigenciaCubre(
  desde: Date | undefined,
  hasta: Date | undefined,
  instante: number,
): boolean {
  if (desde !== undefined && desde.getTime() > instante) {
    return false;
  }
  return hasta === undefined || hasta.getTime() > instante;
}
