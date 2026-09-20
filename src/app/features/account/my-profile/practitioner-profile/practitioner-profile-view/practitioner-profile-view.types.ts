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
  /** Vacío cuando el vínculo no declara cargo (ALV-007). */
  readonly cargo: string;
  readonly desde: Date;
  readonly hasta: Date | null;
  readonly actual: boolean;
}

/**
 * Una sede donde atiende hoy (ALV-005) — la mitad que a la ficha le faltaba:
 * la trayectoria decía dónde trabajó, no dónde encontrarlo.
 */
export interface SedeVisible {
  readonly id: string;
  readonly nombre: string;
  /** Dirección en una línea, ya normalizada para mostrar (ALV-010). Vacía si no tiene. */
  readonly direccion: string;
  /** Punto en el mapa, si la dirección lo trae (ALV-006). */
  readonly punto: { readonly lat: number; readonly lng: number } | null;
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

/**
 * A nombre de quién factura el profesional.
 *
 * Los dos campos van juntos porque son **un solo hecho**: un NIT sin razón
 * social no dice a nombre de quién sale el comprobante, y una razón social sin
 * NIT no sirve para emitirlo. Vacío es «no lo declaró», y la ficha lo dice con
 * palabras en vez de dejar el hueco.
 */
export interface FacturacionVisible {
  /** El NIT, tal como lo declaró. Vacío si no lo cargó. */
  readonly nit: string;
  /** A nombre de quién sale el comprobante. Vacío si no lo cargó. */
  readonly razonSocial: string;
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
   * Dónde atiende hoy (ALV-005). Opcional: la ficha del directorio y los
   * fixtures viejos no lo traen, y ausente se lee como «sin sedes», no como
   * dato roto.
   */
  readonly sedes?: readonly SedeVisible[];
  /**
   * Los datos personales, **sólo en la ficha propia**.
   *
   * `null` cuando se mira la ficha de otro profesional: su documento y su
   * fecha de nacimiento no son de quien la mira. La ficha pública sigue
   * mostrando lo que siempre mostró.
   */
  readonly datosPersonales: DatosPersonalesVisibles | null;
  /**
   * Sus datos de facturación, **sólo en la ficha propia**.
   *
   * `null` cuando se mira la ficha de otro profesional, por la misma razón que
   * {@link datosPersonales}: el NIT de alguien no es de quien lo mira. La ficha
   * de la guía nunca lo mostró y no empieza a mostrarlo ahora.
   */
  readonly facturacion: FacturacionVisible | null;
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
  /**
   * Los cuatro contactos que el registro pregunta por separado, y la calle.
   *
   * La ficha mostraba **un** teléfono y **un** correo, cuando el alta declara
   * cinco datos de contacto distintos —celular personal, celular del trabajo,
   * fijo del trabajo, correo personal y correo de trabajo— y la API los
   * devuelve todos. El pedido es que la ficha muestre los mismos campos del
   * registro, y estos faltaban aunque el dato estuviera.
   *
   * Vacío es «no lo declaró»: la ficha no dibuja el renglón.
   */
  readonly celularPersonal: string;
  readonly celularTrabajo: string;
  readonly fijoTrabajo: string;
  readonly correoPersonal: string;
  /** La calle del domicilio. El municipio sigue en `domicilio`. */
  readonly direccion: string;
  /**
   * El enlace al mapa del domicilio, o `null` si no declaró coordenadas.
   *
   * Se arma en el contenedor y no en la vista para que ésta siga sin saber de
   * dónde salió el dato: acá llega un enlace listo o nada. Mismo criterio que
   * la ficha del paciente, que ya lo hacía — el alta de médico pregunta la
   * «Ubicación GPS» del domicilio y la ficha no la mostraba.
   */
  readonly mapaDomicilio: string | null;
}
