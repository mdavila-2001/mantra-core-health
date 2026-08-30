import type { StatusSealVariant } from '../../../../../shared/components/organisms/status-seal/status-seal.types';

/* ============================================================================
    El contrato del perfil profesional YA RESUELTO.

    Todo lo que estas formas transportan viene traducido: etiquetas de
    terminología convertidas a texto, `photoFileId` convertido a URL, sellos ya
    decididos. La vista que lo recibe no inyecta ningún cliente — así el mismo
    componente pinta el perfil propio («Mi perfil») y el ajeno (el detalle de la
    guía de profesionales, carril R2-1) sin saber de dónde salió el dato.

    Acordado en COORDINACION-AGENTES.md el 2026-08-14 (carriles R2-4/R2-1).
    ========================================================================== */

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
  /**
   * Contra qué se comprobó. Presente **sólo** si se verificó — el backend lo
   * exige al verificar — así que es la señal más directa de «esto pasó de
   * declarado a verificado», más confiable que inferirlo del sello.
   */
  readonly fuenteVerificacion?: string;
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
  readonly sello: StatusSealVariant;
}

/** Un vínculo laboral, ya traducido — historial de dónde ejerció (UC-05-16). */
export interface AfiliacionVisible {
  readonly id: string;
  readonly organizacion: string;
  readonly cargo: string;
  readonly area: string;
  readonly desde: Date;
  readonly hasta: Date | null;
  readonly actual: boolean;
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

/** Una cuenta de actividad en la plataforma. */
export interface ActividadVisible {
  readonly clave: string;
  readonly rotulo: string;
  readonly valor: number;
}

/** El estado de habilitación, con su sello ya decidido. */
export interface VerificacionVisible {
  readonly label: string;
  readonly variant: StatusSealVariant;
}

/**
 * El perfil profesional completo, listo para pintar.
 *
 * Es el `input()` de `practitioner-profile-view`. Quien lo arma (el contenedor
 * propio o el detalle de la guía) resuelve etiquetas, foto y sellos ANTES de
 * pasarlo — la vista no vuelve a preguntar nada.
 */
export interface PerfilProfesionalVisible {
  readonly nombre: string;
  readonly titulo: string;
  readonly especialidadPrincipal: string;
  readonly codigo: string;
  /** URL servible de la foto, o `null` para el avatar de iniciales. */
  readonly fotoUrl: string | null;
  readonly verificacion: VerificacionVisible | null;
  readonly estadoDePractica: string;
  readonly aceptaPacientesNuevos: boolean;
  readonly telemedicina: boolean;
  readonly bio: string;
  readonly actividad: readonly ActividadVisible[];
  readonly especialidades: readonly EspecialidadVisible[];
  readonly formacion: readonly FormacionVisible[];
  readonly matriculas: readonly MatriculaVisible[];
  readonly idiomas: readonly IdiomaVisible[];
  /** Hospitales/centros donde ejerce ahora (UC-05-16, `endDate` ausente). */
  readonly actividadActual: readonly AfiliacionVisible[];
  /** Hospitales/centros anteriores (UC-05-16, `endDate` presente). */
  readonly experienciaHistorica: readonly AfiliacionVisible[];
  /**
   * Los datos personales, **sólo en la ficha propia**.
   *
   * `null` cuando se mira la ficha de otro profesional: su documento y su
   * fecha de nacimiento no son de quien la mira. La ficha pública sigue
   * mostrando lo que siempre mostró.
   */
  readonly datosPersonales: DatosPersonalesVisibles | null;
  readonly desde: Date | null;
}

/** Lo que el profesional declaró de sí mismo, para su propia ficha. */
export interface DatosPersonalesVisibles {
  readonly documento: string;
  /** Departamento emisor, ya en palabras. Vacío si el catálogo no llegó. */
  readonly departamento: string;
  readonly fechaNacimiento: Date | null;
  /** Calculada de la fecha; `null` si no la declaró. */
  readonly edad: number | null;
  readonly telefono: string;
  readonly correo: string;
  /** Municipio de residencia, en palabras. */
  readonly domicilio: string;
}
