export interface ProfesionalSimulado {
  readonly id: string;
  readonly personId: string;
  readonly userId: string;
  readonly practitionerCode: string;
  readonly displayName: string;
  readonly name: string;
  readonly lastName: string;
  readonly motherLastName: string;
  readonly professionalTitle: string;
  readonly professionalBio: string;
  readonly slug: string;
  readonly email: string;
  readonly phone: string;
  readonly especialidades: readonly string[];
  readonly ciudad: string;
  readonly municipioId: string;
  readonly departamentoId: string;
  readonly tenantId: string;
  readonly organizacion: string;
  readonly verified: boolean;
  readonly acceptsNewPatients: boolean;
  readonly telehealthAvailable: boolean;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly photoFileId: string;
  readonly matricula: string;
  readonly birthDate: string;
  readonly nationalId: string;
  readonly lat: number;
  readonly lng: number;
  readonly direccion: string;
  /**
   * `RED_ASEGURADORA`: un médico real del listado de una aseguradora, no una
   * cuenta de la maqueta. No tiene agenda, puntuación ni verificación, porque
   * inventárselas sería afirmar algo sobre alguien que existe.
   *
   * `DEMO`: un actor de demostración que no es nadie (ver
   * `PROFESIONALES_DEMO_REGISTRADOS`). Tiene agenda simulada y, como los de la
   * red, ni credenciales ni matrícula: no hay título que fingir.
   */
  readonly origen?: 'RED_ASEGURADORA' | 'USUARIO_PROPIETARIO' | 'DEMO';
  /**
   * Las redes de aseguradora en las que atiende, con sus planes, tal como las
   * publica cada aseguradora. Sólo `RED_ASEGURADORA`: al resto nadie le dio de
   * alta en una red, y ausente se lee como «sin convenios informados».
   */
  readonly insurerNetworks?: readonly {
    readonly insurer: string;
    readonly plans: readonly string[];
  }[];
  /**
   * Los registros que declara la planilla de usuarios médicos, tal cual.
   * Sólo `USUARIO_PROPIETARIO`.
   */
  readonly registros?: {
    readonly matriculaMinisterio: string | null;
    readonly fechaMatriculaMinisterio: string | null;
    readonly registroColegioOdontologos: string | null;
    readonly registroSedes: string | null;
    readonly fechaRegistroSedes: string | null;
  };
}

export interface PacienteSimulado {
  readonly id: string;
  readonly personId: string;
  readonly userId: string;
  readonly patientCode: string;
  readonly displayName: string;
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName: string;
  readonly birthDate: string;
  /**
   * Sexo y género son opcionales desde que existe el alta de mostrador: al
   * paciente que llega sin estar registrado se le piden nombre, cédula y
   * celular, no su sexo. Inventarlo para completar la fila sería peor que no
   * tenerlo — la ficha sabe mostrarse sin ellos.
   */
  readonly sexAtBirth?: 'MALE' | 'FEMALE';
  readonly generoId?: string;
  readonly sexoId?: string;
  readonly nationalId: string;
  readonly email: string;
  readonly phone: string;
  readonly municipioId: string;
  readonly departamentoId: string;
  readonly ocupacionId: string;
  readonly direccion: string;
  readonly deceased: boolean;
  readonly identityVerified: boolean;
  readonly photoFileId?: string;
  readonly aseguradora?: string;
  readonly plan?: string;
  /**
   * Grupo sanguíneo y factor Rh, casi siempre juntos porque un laboratorio
   * los tipifica en el mismo análisis. Opcionales: no todo paciente se hizo
   * ese estudio.
   */
  readonly aboGroupId?: string;
  readonly rhFactorId?: string;
  /** Idioma en el que hay que atenderlo clínicamente. */
  readonly idiomaClinicoId?: string;
  /**
   * El punto en el mapa de cada dirección, cuando el paciente lo declaró.
   *
   * Opcionales porque los datos de ejemplo no los traen: se llenan cuando
   * alguien edita su perfil y confirma la ubicación. Ver el PATCH de
   * `/profiles/patients/me`.
   *
   * `null` es «lo quitaron» (subtarea B.2), distinto de `undefined` —«nunca
   * se tocó»—: sin la distinción, quitar el pin de la casa y volver a leer el
   * perfil lo devolvía al punto de la plaza principal.
   */
  readonly homeLat?: number | null;
  readonly homeLng?: number | null;
  readonly workLat?: number | null;
  readonly workLng?: number | null;
  /** La dirección de trabajo, que antes no se guardaba en ningún lado. */
  readonly direccionTrabajo?: string;
  /** `USUARIO_PROPIETARIO`: una persona de `USUARIO_PACIENTES_1.md`. */
  readonly origen?: 'USUARIO_PROPIETARIO';
  /** La ocupación tal como la escribe la planilla, cuando es «Otra». */
  readonly ocupacionTexto?: string;
}
