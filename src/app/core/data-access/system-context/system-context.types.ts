/* ============================================================================
    Tipos de la vista para `system_context` — las enumeraciones dinámicas.

    ## Qué resuelven

    La regla del modelo es taxativa: todo campo `*_concept_id` se llena desde un
    selector poblado por terminología, **nunca a mano**. Para poblarlo hace falta
    saber qué conjunto de valores gobierna ese campo, y hasta que existió esta
    lectura eso no estaba en ningún lado que un cliente pudiera leer: el único
    `GET` de conjuntos exigía su uuid, y los uuid no eran constantes publicadas.

    Por eso el alta de paciente salió sin género ni sexo al nacer, y el alta de
    organización con su tipo escrito a mano. Este es el contrato que lo arregla.

    ## `esquema.tabla.columna` es la clave, y no el nombre del conjunto

    Se pide por el campo que se va a llenar, no por el catálogo que lo llena. Es
    la diferencia entre «qué valores admite esta columna» —que es lo que un
    formulario sabe— y «cuál es el uuid del value set», que es justo lo que no
    sabe ni tiene por qué averiguar.
    ========================================================================== */

/** Una opción de un selector de catálogo. */
export interface DynamicEnumOption {
  /** Lo que se manda al backend. Nunca se muestra. */
  readonly conceptId: string;
  /**
   * Código estable del concepto, p. ej. `GENDER_FEMALE`.
   *
   * Es la identidad semántica del valor, y lo que permite traducirlo a la
   * palabra que ve la persona sin atarse a un uuid.
   */
  readonly code: string;
  /**
   * Etiqueta del catálogo. **Viene en inglés técnico** —«Administrative gender
   * female»— porque es terminología, no copy de producto.
   *
   * Sirve de reserva cuando la pantalla no tiene una palabra propia para ese
   * código: mostrar el término técnico es feo, pero es infinitamente mejor que
   * mostrar un uuid o dejar la opción sin nombre.
   */
  readonly display: string;
  /** Orden en el que se ofrecen. El backend ya las manda ordenadas. */
  readonly ordinal: number;
  /** Si el modelo lo sugiere como valor por defecto. */
  readonly isDefault: boolean;
}

/** Una enumeración dinámica resuelta, tal como la devuelve la API. */
export interface DynamicEnum {
  /** Código estable de la enumeración, p. ej. `administrative-gender`. */
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly definitionId: string;
  readonly valueSetId: string;
  readonly versionId?: string;
  /**
   * Huella de la versión publicada del conjunto.
   *
   * Es lo que hace que memoizar sea seguro **y** correcto: dos respuestas con el
   * mismo `cacheToken` son el mismo catálogo, y una que cambie avisa de que hay
   * que releer. Sin esto habría que elegir entre cachear a ciegas o no cachear.
   */
  readonly cacheToken?: string;
  /** Si el campo admite un valor fuera del conjunto. */
  readonly allowCustomValue: boolean;
  readonly options: readonly DynamicEnumOption[];
}
