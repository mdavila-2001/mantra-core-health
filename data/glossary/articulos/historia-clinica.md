---
slug: historia-clinica
image: historia-clinica.svg | Estructura de la historia clínica: el paciente en el centro y los componentes que la forman. | Esquema con el paciente en el centro y, a su alrededor, los componentes de la historia clínica: identificación, motivo de consulta, anamnesis, exploración física, pruebas complementarias, lista de problemas, evolución, plan y tratamiento, consentimientos, informes y documentos de alta.
image: historia-clinica-soap.svg | Flujo de la historia orientada por problemas de Weed y de la nota de evolución SOAP. | Diagrama de flujo en dos niveles. Arriba, la secuencia de la historia orientada por problemas: base de datos, lista de problemas, plan inicial y notas de evolución. Abajo, las cuatro partes de la nota SOAP: subjetivo, objetivo, evaluación y plan, con retroalimentación hacia la lista de problemas.
image: historia-clinica-interoperabilidad.svg | Capas de estándares que permiten que una historia clínica electrónica se entienda entre sistemas. | Pila de cuatro capas de abajo arriba: seguridad y gobernanza, terminologías y clasificaciones como SNOMED CT, CIE y LOINC, modelo de información y recursos como HL7 FHIR, y servicios de intercambio entre aplicaciones, portales y otros centros.
image: historia-clinica-acceso.svg | Quién puede acceder a la historia clínica y qué principios limitan ese acceso. | Esquema de círculos concéntricos: el paciente y su equipo asistencial en el centro, luego los servicios de apoyo con acceso limitado, y fuera los usos secundarios como investigación y gestión, que requieren anonimización o autorización. A un lado se listan los principios de mínimo necesario, finalidad y trazabilidad.
---

## [definition] Introducción

La historia clínica es el conjunto de documentos y registros, en papel o en formato electrónico, en el que se consignan de forma ordenada y cronológica los datos de salud de una persona y el proceso asistencial que ha recibido: lo que la persona refiere, lo que el profesional observa y mide, las pruebas que se piden y sus resultados, los diagnósticos que se plantean, las decisiones que se toman, los tratamientos que se indican y la evolución posterior. Es, a la vez, la memoria clínica de cada paciente, el instrumento con el que los profesionales se comunican entre sí a lo largo del tiempo y el documento sobre el que se apoyan la docencia, la investigación, la gestión de los servicios y la responsabilidad profesional.

En castellano se usan, con matices que varían según el país, otras denominaciones: expediente clínico, ficha clínica, historial médico, registro médico, carpeta de salud o simplemente «el expediente». En inglés se habla de medical record, patient record o health record, y de electronic health record (EHR) o electronic medical record (EMR) cuando el soporte es digital. Aunque en el lenguaje cotidiano se emplean como sinónimos, estos términos no siempre coinciden en su alcance, y los apartados siguientes los distinguen.

Dos ideas ordenan todo lo que sigue. La primera es que la historia clínica no es un archivo neutro de datos sino una herramienta de trabajo: su valor depende de que lo escrito sea veraz, comprensible, oportuno y completo para quien deba continuar la atención. La segunda es que contiene información especialmente íntima, de modo que su uso está limitado por el secreto profesional, por los derechos del paciente y por los principios de protección de datos personales. Entre esas dos exigencias —que la información circule para que la atención sea segura y que no circule más de lo necesario para proteger a la persona— se mueven la mayoría de los problemas prácticos, técnicos y éticos de la documentación clínica.

## [additional_information] Terminología y etimología

La palabra «historia» procede del griego historía, «indagación», «investigación», y de ahí «relato de lo averiguado». En medicina designa tanto el relato que el paciente hace de su enfermedad como, por extensión, el documento en que se recoge. «Clínica» viene del griego klinikós, «relativo al lecho» (klínē, «cama»): la medicina clínica es la que se ejerce junto a la cama del enfermo, y la historia clínica, por tanto, es el relato escrito de lo observado y hecho en esa cabecera.

El término anamnesis, también de origen griego (anámnēsis, «recuerdo», «reminiscencia»), nombra la parte de la historia que se obtiene interrogando al paciente o a sus allegados: motivo de consulta, historia de la enfermedad actual y antecedentes. Se opone a la exploración o examen físico, que recoge los signos que el profesional constata. La palabra «epicrisis», de uso habitual en varios países hispanohablantes, designa el resumen razonado de un episodio de atención, típicamente el de una hospitalización, y se trata en el artículo sobre el alta médica.

Conviene separar cuatro conceptos que suelen mezclarse. La historia clínica en sentido estricto es el registro del proceso asistencial de una persona en uno o varios centros. El expediente clínico, en algunos países, es el término jurídico u oficial para ese mismo conjunto. El registro de salud personal (PHR, por sus siglas en inglés) es el que mantiene la propia persona, con datos que ella aporta o recibe desde distintos servicios. Y la historia clínica compartida o longitudinal es la que integra información procedente de varios prestadores en una vista única por paciente. En inglés, algunas organizaciones reservan electronic medical record para el registro dentro de un centro y electronic health record para el que se pretende compartir entre organizaciones, pero la distinción no es universal y se usa de forma inconsistente.

Existe además una diferencia entre el documento y la información. Un sistema puede guardar la misma historia en formatos distintos, imprimirla, resumirla o convertirla a un estándar de intercambio sin que por ello deje de ser la misma historia. Lo que la define es su función —documentar la atención de una persona determinada— y su régimen de custodia y confidencialidad, no el soporte.

## [additional_information] Antecedentes históricos: de la observación al registro individual

Registrar casos clínicos es una práctica antigua. El papiro quirúrgico conocido como Edwin Smith, de hacia el segundo milenio antes de la era común, expone una serie de cuarenta y ocho casos de lesiones, cada uno con título, examen, diagnóstico y pronóstico, en una estructura que sorprende por su parecido con el razonamiento clínico posterior. En la Grecia clásica, el corpus atribuido a Hipócrates incluye en las Epidemias descripciones de unas cuatro decenas de enfermos con su día a día, su evolución y su desenlace, escritas con una finalidad de aprendizaje y de pronóstico más que de continuidad asistencial. En el mundo islámico medieval, médicos como al-Razi (siglos IX y X) dejaron casos anotados en sus obras para apoyar la enseñanza, y en la Italia de los siglos XIII a XVI circularon los consilia, escritos en los que un médico respondía por carta a la consulta sobre un paciente concreto, un antecedente remoto de la interconsulta escrita.

Estas fuentes tenían un rasgo en común: el registro era del médico, no del paciente ni de la institución. Servía para recordar, enseñar o dar a conocer una experiencia, y quedaba en cuadernos personales. No había una carpeta por persona que pudiera consultarse por otro profesional, ni obligación de escribir cada contacto asistencial.

En los siglos XVII y XVIII, con la enseñanza clínica en hospitales —en particular la que se asocia a Leiden y a la figura de Herman Boerhaave— y, después, con la escuela anatomoclínica de París a comienzos del siglo XIX, el registro de la historia del enfermo y su cotejo con los hallazgos de la autopsia se convirtió en el método central de la medicina hospitalaria. La atención empezó a organizarse alrededor de un relato estructurado: lo que refiere el enfermo, lo que se examina, lo que se concluye. A mediados del siglo XIX, Florence Nightingale insistió en la utilidad de recoger de manera uniforme datos hospitalarios para comparar resultados y mejorar la atención, una idea que reaparecerá siglo y medio después en los indicadores de calidad.

Con todo, durante mucho tiempo los hospitales conservaron los registros ordenados por médico o por servicio, o en libros cronológicos de ingresos, de modo que reunir lo ocurrido a un mismo paciente en distintos momentos era una tarea laboriosa. Ese es el problema que se resolvió en el siglo XX.

## [additional_information] El siglo XX: el registro unificado y los estándares institucionales

A comienzos del siglo XX se consolidó la idea de un único registro por paciente, accesible a todos los profesionales que lo atienden. Suele citarse como hito la organización de los registros en la clínica Mayo, en Rochester (Estados Unidos), impulsada por Henry Plummer hacia 1907: cada persona tenía una sola carpeta en la que se acumulaban las observaciones de todos los médicos y servicios, en lugar de dispersarse en libros por profesional. La medida facilitó la continuidad entre especialistas y permitió, además, el estudio sistemático de series de casos.

En 1917, el Colegio Americano de Cirujanos puso en marcha un programa de estandarización hospitalaria cuyos requisitos mínimos incluían que el hospital llevara registros exactos y completos de cada paciente, base de lo que más tarde sería la acreditación de hospitales. A partir de ahí, la exigencia de documentar la atención dejó de depender de la buena voluntad de cada profesional y pasó a ser un criterio de calidad institucional, y se profesionalizó la gestión de los archivos, con la figura del documentalista o técnico en documentación clínica encargado de custodiar, ordenar, codificar y recuperar las historias.

A lo largo del siglo se fueron incorporando otros elementos: los formularios normalizados para la hoja de ingreso, la hoja de órdenes médicas, las gráficas de constantes vitales, las notas de enfermería, el informe operatorio y el resumen de alta; la codificación de diagnósticos y procedimientos con la Clasificación Internacional de Enfermedades (CIE) de la OMS para fines estadísticos y de gestión; y, desde la segunda mitad del siglo, la discusión sobre quién es el dueño de la información y quién puede ver qué. En la década de 1990 la Clasificación se renovó con la décima revisión (CIE-10), y en 2019 la Asamblea Mundial de la Salud aprobó la undécima (CIE-11), vigente desde 2022 según la OMS.

Un informe del entonces Instituto de Medicina de Estados Unidos, publicado en 1991 con el título The Computer-Based Patient Record, planteó que el registro informatizado era una tecnología esencial para la atención y propuso metas de desarrollo; desde entonces, la historia clínica ha seguido un camino progresivo hacia lo electrónico, con ritmos muy desiguales entre países, sistemas de salud y niveles de atención.

## [additional_information] Lawrence Weed y la historia orientada por problemas

Hasta mediados del siglo XX la mayoría de las historias se ordenaban de manera cronológica o por fuentes: primero lo que había escrito el médico, luego las notas de enfermería, luego los laboratorios. Para quien leyera la historia después, reconstruir qué problemas tenía el paciente, cómo se pensaba abordarlos y en qué punto estaban era difícil. El médico estadounidense Lawrence L. Weed propuso en 1968, en dos artículos publicados en el New England Journal of Medicine («Medical records that guide and teach»), un modelo distinto: la historia orientada por problemas (problem-oriented medical record, POMR).

El modelo tiene cuatro componentes. Una base de datos inicial, definida y completa para cada paciente, que incluye historia, examen físico y estudios básicos. Una lista de problemas, numerados y actualizados, que sirve como índice de la historia. Un plan inicial para cada problema, con lo que se va a estudiar, tratar y explicar al paciente. Y notas de evolución organizadas por problema, que permiten seguir cada uno desde su aparición hasta su resolución. La lógica es la de una auditoría constante del razonamiento: cualquier colega puede ver qué se decidió, por qué y con qué datos, y detectar lagunas, como un problema anotado sin plan o un plan sin problema que lo justifique.

De ese modelo deriva la nota de evolución SOAP, acrónimo de Subjetivo, Objetivo, Evaluación (assessment) y Plan, hoy una de las estructuras más difundidas en la formación médica, con variantes como SOAPIE (que añade intervención y evaluación de resultados) o APSO (que invierte el orden para poner la evaluación y el plan al principio, pensando en el lector con prisa). Weed fue también uno de los primeros en vincular la historia con sistemas informáticos de apoyo a la decisión y en plantear que el registro debía ser un medio para hacer mejor medicina, no un trámite posterior a ella.

La historia orientada por problemas ha recibido críticas razonables: puede fragmentar el cuadro cuando una persona tiene muchas enfermedades interrelacionadas, y el listado de problemas tiende a desactualizarse si no hay una disciplina de mantenimiento. Aun así, su idea central —que la historia debe reflejar el razonamiento, no sólo los datos— sigue vigente, y la «lista de problemas» es hoy un componente habitual de casi cualquier sistema de historia electrónica.

## [purpose] Para qué sirve: la función asistencial

La función primaria de la historia clínica es sostener la atención de la persona. Cumple esa tarea de al menos cuatro maneras.

La primera es la memoria. Ningún profesional recuerda el detalle de cada paciente, y ninguno atiende a todos los pacientes en todos los episodios. La historia permite que quien ve a la persona por primera vez, o por décima, sepa qué se ha hecho, qué se descartó, qué se intentó y qué falló, sin que el paciente tenga que repetirlo todo, ni lo recuerde con exactitud.

La segunda es la comunicación entre profesionales. Medicina, enfermería, farmacia, laboratorio, imagen, rehabilitación, trabajo social y otros servicios intervienen sobre una misma persona, muchas veces sin coincidir en el tiempo. La historia es el canal asincrónico por el que se transmiten hallazgos, hipótesis, indicaciones y dudas. En los cambios de turno, los traslados y las altas, esa comunicación es crítica: los estudios sobre seguridad del paciente identifican la transferencia deficiente de información como una de las causas frecuentes de daño evitable.

La tercera es el apoyo al razonamiento clínico. Escribir el motivo de consulta, ordenar los hechos, formular una impresión diagnóstica y nombrar los diagnósticos diferenciales obliga a pensar de forma explícita. Una historia bien hecha deja ver cómo se llegó a una decisión y permite que otros la revisen o la discutan.

La cuarta es la continuidad en el tiempo. Los problemas crónicos, los controles periódicos, las vacunas, las alergias, los antecedentes de cirugías y las preferencias del paciente sobre su atención sólo se gestionan bien si hay un registro longitudinal. Por eso la historia no es sólo un documento de «lo que pasó hoy», sino la base de la atención programada y de la prevención.

## [function] Otras funciones: docencia, investigación, gestión, calidad y evidencia legal

Además de sostener la atención directa, la historia clínica cumple funciones secundarias, que exigen más cautela por la privacidad.

La función docente se apoya en que los casos reales son el material de aprendizaje más rico para estudiantes y residentes: sesiones clínicas, discusión de casos, auditorías de decisiones. Estos usos requieren, como regla general, que la información sea presentada sin identificar a la persona o con su consentimiento.

La función de investigación utiliza datos de historias clínicas para estudiar la frecuencia de enfermedades, los resultados de tratamientos en la práctica real, los efectos adversos poco comunes o la evolución natural de condiciones raras. Estos estudios, cuando son bien diseñados, complementan a los ensayos clínicos, pero plantean preguntas sobre consentimiento, anonimización y supervisión ética, que se tratan más adelante.

La función de gestión y planificación incluye la codificación de diagnósticos y procedimientos para financiar y evaluar servicios, la medición de listas de espera, el seguimiento de estancias y reingresos, la asignación de recursos y la vigilancia epidemiológica. Se sirve sobre todo de los datos estructurados y codificados, y es la razón por la cual la calidad de la codificación tiene consecuencias administrativas importantes.

La función de calidad y seguridad consiste en revisar la atención prestada —auditorías, análisis de incidentes, evaluación de adecuación—, para lo cual la historia es la fuente principal de lo ocurrido.

Finalmente, la función de constancia legal y de rendición de cuentas: la historia es el documento que acredita lo que se hizo y lo que se informó al paciente, y en caso de reclamación o de controversia suele ser la prueba central. De ahí la máxima conocida en la práctica clínica: lo que no está escrito es difícil de demostrar que se hizo. Esta función no debe convertirse en el principal objetivo del registro; una historia escrita sólo «para defenderse» tiende a ser larga, defensiva y poco útil, y a perder su sentido asistencial.

## [scope] Qué es y qué no es historia clínica

No todo documento relacionado con la salud de una persona forma parte de su historia clínica, ni todo lo que está en ella tiene el mismo carácter. Algunas distinciones prácticas:

• Forman parte de la historia los documentos y datos generados en la atención: anamnesis, exploración, órdenes, resultados de laboratorio e imagen, informes de procedimientos, notas de enfermería, consentimientos informados, interconsultas, informes de alta, prescripciones y certificados emitidos.

• Las anotaciones subjetivas del profesional, es decir, reflexiones personales, hipótesis provisionales no destinadas a otros o juicios sobre el paciente que no tienen utilidad asistencial, son objeto de debate. Algunos marcos de derechos de los pacientes las reconocen como reservadas y no accesibles; otros exigen que se evite escribirlas en la historia y que, si están, se traten con sobriedad. La regla de prudencia profesional es no escribir nada que no pueda sostenerse con datos y que el paciente no pudiera leer sin que se vulnerara su dignidad.

• Las imágenes y señales (radiografías, tomografías, electrocardiogramas, registros de monitorización) son parte de la historia, pero suelen almacenarse en sistemas especializados, con formatos propios como DICOM para imagen médica, y se vinculan a la historia mediante referencias.

• Los datos administrativos (facturación, autorizaciones, seguros) pueden relacionarse con la historia pero no son, en rigor, clínicos; deben mantenerse separados en lo posible, porque su acceso responde a otros fines.

• Los registros de dispositivos personales (relojes, sensores, aplicaciones) pertenecen a la persona hasta que ella decide incorporarlos a la atención.

La delimitación importa porque de ella dependen los derechos de acceso, rectificación y conservación, y la responsabilidad del centro sobre cada tipo de dato.

## [classification] Tipos de historia clínica

La historia clínica admite varias clasificaciones, según el criterio que se adopte.

Por el ámbito de atención se distinguen la historia de atención primaria (longitudinal, con foco en el seguimiento de la persona y de su familia durante años), la hospitalaria (centrada en el episodio de ingreso, con gran volumen de documentos), la de urgencias (breve y rápida, con registro de clasificación o triaje, tiempos y desenlace), la de consulta externa especializada, la de atención domiciliaria y la de atención sociosanitaria. Cada una pone el acento en datos distintos y utiliza plantillas propias.

Por la especialidad existen formatos que incluyen elementos específicos: la historia obstétrica con gráficas de seguimiento del embarazo y del parto, la pediátrica con curvas de crecimiento y calendario de vacunación, la psiquiátrica con examen del estado mental, la quirúrgica con registro de consentimiento, listado de verificación y parte operatorio, la oncológica con estadificación y esquemas terapéuticos, la odontológica con odontograma.

Por el soporte, la historia puede estar en papel, ser electrónica o ser mixta, una situación todavía común durante la transición. En el soporte electrónico se distingue, además, entre la historia que reside en un solo centro, la que se comparte en una red y la que se construye como un conjunto de enlaces a registros de diversos prestadores.

Por la organización interna, hay historias cronológicas (todo en orden de fecha), orientadas por fuentes (cada servicio con su sección), orientadas por problemas (Weed) y orientadas por episodios. Los sistemas electrónicos permiten ver la misma información de varias maneras sin duplicarla.

Por el sujeto de la historia cabe mencionar la historia individual y la historia familiar o de núcleo, esta última usada en algunos modelos de atención primaria con enfoque comunitario; en ese caso se separan con cuidado los datos de cada integrante para no vulnerar su confidencialidad.

## [structure] Estructura básica de la historia clínica

Aunque cada país, institución y especialidad tiene sus formatos, la mayoría de las historias comparten un esqueleto reconocible, que sigue el orden natural de un encuentro clínico. La tabla resume sus bloques principales y la pregunta a la que responde cada uno.

Bloque | Qué contiene | Pregunta que responde
Identificación y datos administrativos | Nombre, fecha de nacimiento, sexo, número de historia, contacto, persona de referencia, cobertura | ¿De quién se trata y cómo se localiza sin confusión?
Motivo de consulta | La razón del contacto, preferiblemente con las palabras del paciente | ¿Por qué acude o es traído?
Enfermedad actual | Relato cronológico del problema: inicio, evolución, factores que modifican, síntomas asociados | ¿Qué le ocurre y desde cuándo?
Antecedentes | Personales, familiares, quirúrgicos, alergias, medicación habitual, hábitos, entorno social | ¿Qué contexto condiciona este problema?
Revisión por sistemas | Síntomas por aparatos que el paciente no mencionó | ¿Hay otros datos relevantes que no surgieron espontáneamente?
Examen físico | Constantes vitales y hallazgos por regiones o sistemas | ¿Qué se constata objetivamente?
Pruebas complementarias | Laboratorio, imagen, electrofisiología, anatomía patológica | ¿Qué aportan los estudios?
Impresión diagnóstica y diagnóstico diferencial | Síntesis razonada y alternativas consideradas | ¿Qué se piensa y por qué?
Plan | Estudios pendientes, tratamiento, derivaciones, información dada, seguimiento | ¿Qué se hará a continuación?
Evolución | Notas fechadas y firmadas que actualizan el cuadro | ¿Cómo va la situación?
Documentos asociados | Consentimientos, informes, certificados, alta | ¿Qué consta de manera formal?

Este orden no es una camisa de fuerza. En una urgencia vital se actúa antes de escribir, y la historia se completa después con el relato de lo hecho y de la hora en que se hizo. En una consulta de control de una enfermedad crónica se parte de la historia previa y sólo se documenta lo nuevo y lo modificado. Lo importante no es la plantilla en sí sino que, con ella, quien lea pueda responder las preguntas de la tercera columna.

## [structure] La anamnesis: obtener y registrar el relato

La anamnesis es la parte de la historia que se obtiene mediante la entrevista clínica. Su calidad depende más de la habilidad comunicativa que de la memoria del profesional: abrir con una pregunta amplia, dejar hablar sin interrumpir demasiado pronto, pedir precisiones cuando hacen falta, resumir para confirmar que se ha entendido y cerrar preguntando si queda algo por decir. La literatura sobre comunicación clínica ha mostrado de forma consistente que los pacientes son interrumpidos pronto cuando empiezan a contar su problema, y que dejarlos hablar un breve lapso mejora la información que se obtiene sin alargar mucho la consulta.

El motivo de consulta se anota de forma breve y, si es posible, textual. Anotar «dolor torácico» y «siente que se le aprieta el pecho cuando sube la cuesta» no transmite lo mismo; la segunda formulación ya orienta sobre su naturaleza.

La enfermedad actual narra el problema: cuándo empezó, si fue brusco o gradual, cómo ha evolucionado, qué lo mejora o empeora, qué síntomas lo acompañan, qué ha hecho el paciente por su cuenta, qué consultas previas hubo. Para caracterizar un síntoma se utilizan mnemotecnias como localización, cualidad, intensidad, duración, factores moduladores y síntomas asociados; son ayudas, no fórmulas obligatorias.

Los antecedentes personales cubren enfermedades previas, ingresos, cirugías, traumatismos, vacunas, hábitos (tabaco, alcohol, otras sustancias, actividad física, alimentación, sueño), situación laboral y social, y, en las mujeres, los datos ginecológicos y obstétricos pertinentes. Los antecedentes familiares recogen enfermedades de interés hereditario o con agregación familiar, normalmente en padres, hermanos e hijos; muchos servicios los representan con un árbol genealógico o genograma. Capítulo propio merece la medicación: qué fármacos, suplementos y productos naturales usa la persona, desde cuándo y con qué regularidad, y cuáles abandonó y por qué; es un dato que luego se retomará en la conciliación al ingreso, en los traslados y en el alta. También las alergias y reacciones adversas se anotan en un lugar visible, con la descripción de la reacción y no sólo el nombre del agente, porque «alergia» se usa con sentidos distintos (alergia verdadera, intolerancia, efecto secundario).

La revisión por sistemas es un repaso dirigido, sistema por sistema, de síntomas que el paciente no mencionó, para detectar problemas que no se asociaron al motivo principal. Su rendimiento es variable y su extensión debe ajustarse a la situación; recitar una lista interminable en cada consulta no suele aportar.

Un principio importante es registrar con fidelidad la fuente de la información. Si el relato lo hace un familiar, un acompañante o el servicio de emergencias porque el paciente no puede hablar, debe constar quién lo aportó. Y los datos de terceros (por ejemplo, información sobre la pareja o los hijos) deben manejarse con particular cuidado.

## [structure] Examen físico y datos objetivos

El examen físico recoge los hallazgos que el profesional constata con sus sentidos y con instrumentos sencillos: observación, palpación, percusión y auscultación, además de la medición de las constantes vitales. Se organiza por regiones (cabeza y cuello, tórax, abdomen, extremidades) o por sistemas (cardiovascular, respiratorio, neurológico), y se acompaña de una descripción general del paciente: aspecto, estado de conciencia, hidratación, coloración, marcha.

Al escribirlo, conviene separar lo observado de lo interpretado. «Soplo sistólico en foco aórtico» es un hallazgo; «estenosis aórtica» es una interpretación. Anotar sólo la conclusión impide a otro profesional comprobar el dato, y anotar sólo el hallazgo sin evaluación obliga al lector a repetir el razonamiento. El equilibrio es consignar ambos, señalando cuál es cuál. También es importante dejar constancia de los hallazgos negativos relevantes («no hay signos meníngeos»), porque documentan que se buscaron, y de lo que no se pudo examinar, con la razón.

Las constantes vitales —presión arterial, frecuencia cardíaca, frecuencia respiratoria, temperatura, saturación de oxígeno— se registran con fecha y hora, y en el hospital suelen representarse en gráficas que permiten ver su tendencia. En pediatría se suman el peso, la talla y el perímetro cefálico, comparados con curvas de referencia de crecimiento, entre ellas las de la OMS.

Cuando el examen se hace a una persona con quien el profesional no comparte plenamente la lengua o la cultura, o cuando se examina a un menor, a una persona con discapacidad o en situaciones de intimidad, los protocolos de buena práctica recomiendan registrar quién estuvo presente (acompañante, intérprete, persona de apoyo para el examen) y el consentimiento para la exploración. Un registro mínimo de estas circunstancias protege a todas las partes.

Las pruebas complementarias se documentan indicando qué se pidió, cuándo, por qué, y cuál fue el resultado y su interpretación. Un resultado pendiente debe quedar identificado como tal, con responsable de seguimiento, porque la omisión de resultados que llegan después del alta o de la consulta es una causa conocida de daño evitable.

## [structure] Impresión diagnóstica, lista de problemas y plan

Tras los datos viene el paso intelectual central: sintetizar. La impresión diagnóstica resume en pocas líneas qué cree el clínico que le ocurre a la persona, cómo lo vincula con los hallazgos y qué alternativas considera. Cuando el diagnóstico no está claro, es preferible escribir una descripción sindrómica o sintomática («dolor torácico de características atípicas, en estudio») que forzar una etiqueta diagnóstica que luego se propaga por el resto de la historia. Un diagnóstico provisional se marca como tal, y se actualiza cuando hay datos nuevos; es una de las fuentes de error más sutiles que una etiqueta inicial quede fijada y todos los profesionales posteriores la hereden sin cuestionarla.

El diagnóstico diferencial explicita las hipótesis alternativas, con los argumentos a favor y en contra. No hace falta enumerar todo lo imaginable; basta con las razonables y con las peligrosas que no deben pasarse por alto. En una historia electrónica, esta parte suele ser texto libre y es donde más se aprecia el razonamiento.

La lista de problemas, heredera de Weed, es un listado dinámico de las condiciones activas y de los antecedentes relevantes de la persona. Los sistemas electrónicos permiten asociarle códigos (CIE, SNOMED CT), fechas de inicio y resolución, y estado (activo, en remisión, resuelto). Su utilidad se pierde si no se mantiene: problemas ya resueltos que siguen listados, o problemas importantes que nunca se añadieron, hacen que el panorama sea engañoso.

El plan traduce el razonamiento en acciones: qué estudios se piden, qué tratamiento se indica (con su fundamento y metas), qué se explica al paciente, con quién se coordina, cuándo se vuelve a ver y qué situaciones obligarían a consultar antes. Un plan completo incluye una conducta de seguimiento («si no mejora en tal plazo, se reevalúa») y las instrucciones dadas a la persona sobre signos de alarma. Documentar qué información se dio y si el paciente la comprendió es especialmente importante cuando se trata de decisiones con riesgos.

## [structure] Notas de evolución y formatos de registro

Las notas de evolución actualizan el estado de la persona a lo largo del tiempo. En la hospitalización se escriben al menos una vez por jornada, y con más frecuencia en situaciones inestables; en la consulta ambulatoria, en cada contacto. Su propósito no es repetir lo ya escrito sino registrar lo que cambió: nuevos síntomas, hallazgos, resultados, decisiones y razones.

El formato SOAP, derivado de Weed, ordena la nota en cuatro apartados. El Subjetivo recoge lo que el paciente cuenta y cómo se siente; el Objetivo, lo que se observa, mide y recibe de pruebas; la Evaluación, la interpretación del conjunto y el estado de cada problema; el Plan, lo que se hará. Ventajas: fuerza a separar datos de interpretación y es fácil de enseñar. Limitaciones: en pacientes complejos puede resultar rígido y repetitivo.

Otros formatos responden a necesidades específicas. El SOAPIE añade Intervención y Evaluación de la respuesta, habitual en enfermería. El formato APSO pone la evaluación y el plan al comienzo, porque quien lee suele buscar primero qué se piensa y qué se hará. El formato DAR (datos, acción, respuesta) se usa en notas de enfermería. En la comunicación entre profesionales, sobre todo en los traspasos de turno, se utilizan marcos como SBAR (situación, antecedentes, evaluación, recomendación), que estructuran una comunicación breve.

Las notas de procedimientos (por ejemplo, un cateterismo, una cirugía, una intubación) tienen su propio contenido: indicación, consentimiento, técnica, hallazgos, incidencias, material utilizado, muestras enviadas y estado del paciente tras el procedimiento. Las notas de enfermería registran cuidados, vigilancias, administración de medicamentos y educación al paciente; son parte de la historia y a menudo la fuente más precisa sobre lo que realmente ocurrió en cada turno.

## [structure] Documentos que integran la historia

Una historia hospitalaria completa incluye, además de lo ya descrito, un conjunto de documentos formales cuya existencia y contenido son importantes para la seguridad y la rendición de cuentas.

• Consentimiento informado: documento (o registro) que acredita que la persona recibió información comprensible sobre un procedimiento, sus beneficios, riesgos y alternativas, y aceptó o rechazó. El documento firmado no sustituye al proceso: lo relevante es la conversación, de la cual el formulario es la constancia.

• Hoja de órdenes y prescripciones: las indicaciones médicas (tratamiento, dieta, actividad, estudios) y su administración. En sistemas electrónicos corresponde a la prescripción electrónica y a la hoja de administración.

• Informes de pruebas complementarias: laboratorio, radiología, anatomía patológica, estudios funcionales.

• Informe quirúrgico o parte operatorio, hoja de anestesia y registro de recuperación.

• Interconsultas: solicitud de opinión a otro servicio y respuesta del consultor, descritas en el artículo sobre la interconsulta.

• Informe o resumen de alta, o epicrisis: síntesis del episodio y de lo que debe hacerse después, desarrollado en el artículo sobre el alta médica.

• Prescripciones y recetas emitidas, descritas en el artículo sobre la receta médica.

• Certificados y partes: de enfermedad, de incapacidad, de defunción, de lesiones. Son documentos con efectos jurídicos y administrativos, de contenido cuidadoso y de acuerdo con la normativa local.

• Voluntades anticipadas o instrucciones previas, documento de designación de representante y orden de no reanimar, cuando existen y se han discutido con la persona.

• Registro de comunicaciones relevantes con la familia o el paciente, como una conversación sobre pronóstico o una decisión de limitar tratamientos.

Cada documento debe estar identificado con el paciente, la fecha y hora, el autor y su cargo, y, si procede, el servicio. La atribución es fundamental: una nota sin autor identificable no puede ser interpretada ni verificada.

## [additional_information] Cómo se redacta una buena historia

La calidad de una historia clínica no se mide por su longitud sino por su utilidad para quien la lee. Distintas organizaciones y la literatura sobre documentación coinciden en un conjunto de atributos, que aquí se formulan como principios.

• Veracidad: lo escrito corresponde a lo que ocurrió. No se anota como realizado lo que no se hizo ni se copian hallazgos de días anteriores sin comprobarlos.

• Oportunidad: la nota se escribe cerca del momento de la atención. Cuanto más se demora, más se pierde en precisión y más se corre el riesgo de que otros decidan sin conocerla. Cuando se escribe tarde, se indica que es una nota diferida y se anota la hora real de redacción.

• Legibilidad: la letra ilegible fue durante décadas un problema documentado; la historia electrónica lo reduce pero introduce otros, como notas largas pobladas de texto automático.

• Claridad: lenguaje preciso, frases cortas, términos estándar, abreviaturas sólo si son de uso aceptado en la institución. Las listas de abreviaturas peligrosas publicadas por organizaciones de seguridad (por ejemplo, el Instituto para las Prácticas Seguras en Medicación, ISMP) existen porque abreviaturas ambiguas, como una «U» por unidades que se lee como un cero, han causado errores graves.

• Objetividad: se describen hechos y observaciones, no juicios de valor sobre la persona. Términos como «paciente conflictivo» o «poco colaborador» etiquetan sin informar; es preferible describir la conducta observada y el contexto.

• Completitud proporcional: cubrir lo necesario para la continuidad y para entender las decisiones, sin saturar con datos irrelevantes.

• Atribución y trazabilidad: quién escribió, cuándo, y qué cambió. Las correcciones se hacen mediante enmiendas fechadas y firmadas, sin borrar el texto original, de manera que el historial de modificaciones sea visible.

• Respeto: el lenguaje de la historia debe ser el de un documento que el propio paciente podría leer. Esta idea, que a veces se resiste, ha ganado fuerza con el acceso de los pacientes a sus notas.

Hay también reglas negativas de uso común: no escribir comentarios sobre otros profesionales o conflictos de equipo, no alterar registros después de un evento adverso, no dejar espacios en blanco que pudieran rellenarse después y no usar la historia para discusiones que corresponden a otros canales.

## [considerations] Errores frecuentes en la documentación clínica

Los problemas de la documentación se repiten en todos los sistemas y niveles. La tabla agrupa los más habituales, su consecuencia y la medida que suele reducirlos.

Error | Consecuencia típica | Medida habitual de mitigación
Identificar mal al paciente (homónimos, historias duplicadas o fusionadas) | Información de una persona en la historia de otra; decisiones erróneas | Dos identificadores en cada acto, pulseras con código, índice maestro de pacientes
Copiar y pegar notas anteriores sin revisar | Datos desactualizados que parecen vigentes; contradicciones | Plantillas que obligan a revisar, formación, auditoría de notas clonadas
Abreviaturas ambiguas | Malinterpretación de órdenes y diagnósticos | Listas de abreviaturas autorizadas y prohibidas, alertas del sistema
Alergias no registradas o registradas sin detalle | Reexposición a un agente que causó reacción | Campo obligatorio con tipo de reacción y fecha, revisión en cada transición
Resultados pendientes no seguidos | Hallazgos importantes que nadie conoce ni actúa | Lista de pruebas pendientes con responsable, avisos automáticos
Medicación desactualizada | Duplicidades, omisiones, interacciones no detectadas | Conciliación en cada transición, lista única de medicación
Diagnósticos fijados que se heredan sin cuestionar | Sesgo de anclaje en todos los profesionales posteriores | Distinguir diagnóstico provisional de confirmado, revisión periódica
Información sensible en lugares no controlados | Fugas de confidencialidad | Control de acceso por roles, notas protegidas, formación
Notas escritas mucho después del acto | Datos imprecisos o de reconstrucción | Documentar en el momento, marcar como diferida si procede
Alteraciones o borrados sin trazabilidad | Pérdida de confianza y de valor probatorio | Registros inmodificables con enmiendas y pista de auditoría

Muchos de estos errores no son individuales sino sistémicos: nacen de interfaces que premian la rapidez, de plantillas que producen texto sin pensar, de falta de tiempo o de formación. La estrategia eficaz combina diseño del sistema, formación y auditoría con retroalimentación a los profesionales, no sólo sanciones.

## [additional_information] La historia clínica electrónica

La historia clínica electrónica (HCE) es la que se genera, almacena, consulta y transmite en soporte digital mediante sistemas de información. No es sólo un «papel escaneado»: un sistema de HCE bien diseñado almacena datos estructurados (campos, códigos, fechas) que pueden buscarse, compararse, representarse en gráficas y usarse para apoyar decisiones, junto con documentos y texto libre.

La OMS, en su Estrategia mundial sobre salud digital 2020–2025 (extendida posteriormente), sitúa los sistemas de información sanitaria y los registros electrónicos entre los cimientos de la transformación digital de la salud, y subraya que deben desarrollarse con gobernanza, estándares abiertos, protección de datos y participación de los usuarios. En las Américas, la Organización Panamericana de la Salud ha promovido igualmente la adopción de sistemas de información interoperables y la transformación digital basada en principios como la centralidad de la persona y la equidad.

Entre las ventajas documentadas de la HCE se cuentan: legibilidad y disponibilidad simultánea para varios profesionales; acceso desde distintos lugares; integración de resultados de laboratorio e imagen; avisos de alergias y de duplicidades; prescripción electrónica que reduce errores de transcripción; posibilidad de auditar accesos; y reutilización de datos con fines de gestión, calidad e investigación. Entre sus riesgos y desventajas figuran: costes de implantación y mantenimiento; dependencia de la conectividad y de los servicios técnicos; riesgos de ciberseguridad; interfaces que desplazan la atención del paciente a la pantalla; sobrecarga de alertas; documentación inflada por texto automático; y, de forma importante, nuevos tipos de error propios de los sistemas, como seleccionar al paciente equivocado en una lista desplegable.

El efecto de la HCE sobre la carga de trabajo de los profesionales ha sido objeto de numerosos estudios observacionales que, en su conjunto, muestran que una parte considerable del tiempo clínico se dedica a tareas de documentación y gestión en pantalla, lo que se ha asociado con el agotamiento profesional. Este hallazgo ha motivado esfuerzos de simplificación, delegación de tareas administrativas y, más recientemente, herramientas de apoyo a la redacción, cuyas ventajas y riesgos se discuten más adelante.

## [how_it_works] Cómo funciona un sistema de historia clínica electrónica

Un sistema de HCE moderno puede entenderse como un conjunto de módulos sobre un repositorio común de datos. Aunque los productos comerciales difieren, la arquitectura conceptual es parecida.

El repositorio guarda los datos de cada paciente: demografía, problemas, alergias, medicación, resultados, notas, documentos. Debe ofrecer garantías de integridad (que lo guardado no se altere sin rastro), disponibilidad (que esté accesible cuando se necesita) y confidencialidad (que sólo lo vea quien corresponde). Detrás hay bases de datos, copias de seguridad, planes de recuperación ante fallos y, cada vez más, infraestructura en la nube administrada con garantías contractuales.

El índice maestro de pacientes (MPI) resuelve quién es quién. Asocia los distintos identificadores que una persona puede tener en diferentes servicios y evita duplicados. Es una pieza crítica: si dos historias de la misma persona no se vinculan, se pierde información; si dos personas se fusionan por error, se mezclan datos de dos individuos con consecuencias graves.

Las órdenes electrónicas (CPOE) permiten solicitar medicamentos, pruebas y procedimientos directamente en el sistema, que los valida frente a reglas: alergias, duplicidades, función renal si la tiene registrada, protocolos. Los sistemas de apoyo a la decisión clínica emiten alertas, recordatorios y sugerencias; su utilidad depende de su precisión: demasiadas alertas poco relevantes producen «fatiga de alertas» y la gente aprende a ignorarlas, incluso las importantes.

Los módulos de resultados reciben información de laboratorio, imagen y anatomía patológica, normalmente mediante mensajes entre sistemas (históricamente en el formato HL7 versión 2, aún muy extendido) y la presentan al profesional asociados a la orden correspondiente. La interfaz con sistemas de imagen utiliza DICOM y, para la visualización, visores específicos.

La documentación clínica se apoya en plantillas, formularios y, en ocasiones, reconocimiento de voz o dictado. Los datos estructurados capturados en formularios facilitan luego el análisis; el texto libre conserva matices pero es difícil de explotar de forma automática, salvo con técnicas de procesamiento del lenguaje natural.

Los portales de pacientes permiten a la persona ver parte de su historia, resultados, citas y medicación, comunicarse con el equipo y, en algunos casos, aportar datos propios. Su diseño requiere decisiones de política: qué se muestra de inmediato, qué se retiene brevemente, cómo se protege a quien comparte dispositivo con otras personas.

Por debajo de todo ello están los servicios transversales: autenticación (quién eres), autorización (qué puedes ver y hacer), registro de auditoría (qué hiciste y cuándo), cifrado de datos en tránsito y en reposo, y mecanismos de acceso de emergencia con justificación y revisión posterior.

## [additional_information] Terminologías y clasificaciones

Para que los datos de una historia puedan compararse y reutilizarse, el significado de lo que se escribe tiene que ser inequívoco. Para eso existen las terminologías y las clasificaciones, que cumplen funciones distintas y se complementan.

Una clasificación agrupa conceptos en categorías mutuamente excluyentes y exhaustivas, con fines estadísticos y de gestión. La Clasificación Internacional de Enfermedades (CIE), mantenida por la OMS, es la principal. La CIE-10 se utiliza desde los años noventa en la mayoría de los países para la mortalidad y la morbilidad; la CIE-11, aprobada en 2019 y en vigor desde 2022 según la OMS, es una versión digital, con una estructura de contenido ampliada que admite combinaciones de códigos (postcoordinación) y una mejor representación de la medicina tradicional, la salud sexual y otros ámbitos. Existen versiones específicas de procedimientos y de intervenciones en distintos países, no siempre equivalentes. La Clasificación Internacional de la Atención Primaria (CIAP-2/ICPC-2), de la organización mundial de médicos de familia, codifica motivos de consulta, problemas y procesos en ese ámbito.

Una terminología clínica, en cambio, pretende cubrir con granularidad el vocabulario que los profesionales usan al documentar: hallazgos, diagnósticos, procedimientos, estructuras corporales, organismos, sustancias, situaciones. SNOMED CT (Systematized Nomenclature of Medicine – Clinical Terms), mantenida por la organización SNOMED International, es la terminología clínica multilingüe más extensa: sus conceptos se organizan en jerarquías, tienen descripciones en varios idiomas y se relacionan entre sí mediante vínculos lógicos, lo que permite consultas del tipo «todos los pacientes con alguna forma de enfermedad pulmonar». Su uso se declara en más de ochenta países según la propia organización, y su edición internacional incluye más de trescientos mil conceptos.

LOINC (Logical Observation Identifiers Names and Codes) identifica pruebas de laboratorio, mediciones clínicas y documentos, de modo que «el mismo análisis» en dos laboratorios pueda reconocerse como tal. Para medicamentos se utilizan la Clasificación Anatómica, Terapéutica y Química (ATC) de la OMS, que agrupa los fármacos por órgano diana y mecanismo, los nombres comunes internacionales (DCI/INN) que establece la OMS, y, en el plano de identificación de productos, estándares como los de la serie ISO IDMP. Para unidades de medida se emplea UCUM. Para dispositivos hay sistemas de identificación propios.

En la práctica clínica conviven la clasificación, que se asigna al final del episodio (a menudo por codificadores especializados) para gestión y estadística, y la terminología, que se utiliza en el momento de la atención para capturar los datos con precisión. Un sistema bien diseñado permite que el profesional escriba con sus palabras, o elija un término de una terminología, y que el sistema derive después los códigos de clasificación necesarios. Esa separación evita pedir a los clínicos que piensen en códigos de facturación al hacer clínica.

## [additional_information] Interoperabilidad: estándares para que los sistemas se entiendan

Interoperar significa que sistemas distintos intercambien datos y que el receptor pueda interpretarlos y usarlos. La bibliografía distingue varios niveles. La interoperabilidad técnica garantiza que los datos se puedan transportar. La sintáctica, que tengan una estructura acordada. La semántica, que el significado sea el mismo en origen y destino, para lo cual se usan terminologías. Y la organizativa, que haya acuerdos sobre quién comparte qué con quién, bajo qué condiciones y con qué responsabilidades. Muchos proyectos fracasan en este último nivel, no en el técnico.

Entre los estándares más relevantes se encuentran:

• HL7 versión 2: familia de mensajes nacida a finales de los años ochenta, muy extendida en el intercambio interno de hospitales (admisiones, resultados, órdenes). Es eficaz pero flexible hasta la ambigüedad: cada implantación la adapta, lo que obliga a configurar cada interfaz.

• CDA (Clinical Document Architecture) de HL7: estándar de documentos clínicos estructurados en XML, usado para resúmenes de alta, informes y resúmenes de paciente.

• HL7 FHIR (Fast Healthcare Interoperability Resources): estándar más reciente, que se describe en el apartado siguiente.

• openEHR y la norma ISO 13606: enfoques basados en separar el modelo de referencia de la información de los «arquetipos», modelos de contenido clínico definidos por la comunidad profesional, de modo que los sistemas puedan evolucionar el contenido sin cambiar el software.

• DICOM: estándar de imagen médica, de la visualización a la transmisión y almacenamiento.

• IHE (Integrating the Healthcare Enterprise): perfiles de integración que combinan estándares existentes para resolver problemas concretos, como compartir documentos entre instituciones.

• Resumen internacional del paciente (International Patient Summary, IPS): conjunto mínimo de datos clínicos esenciales (alergias, problemas, medicación, vacunas, procedimientos, dispositivos) pensado para la atención no planificada y transfronteriza; existe como norma europea y como estándar internacional, y se ha publicado una guía de implementación sobre FHIR.

La existencia de estándares no basta. Hacen falta perfiles que acoten las opciones, conjuntos de valores acordados, pruebas de conformidad, gobernanza y, en cada país, una decisión política sobre qué estándares son obligatorios. La interoperabilidad se construye con decisiones sostenidas, no con una sola tecnología.

## [additional_information] HL7 FHIR en detalle

FHIR, pronunciado «fire», es un marco de estándares creado por la organización HL7 que, según su propia documentación, busca combinar lo mejor de HL7 v2, v3 y CDA apoyándose en tecnologías web modernas. Su unidad básica es el recurso: un bloque modular de información con una estructura definida, como Paciente (Patient), Encuentro (Encounter), Condición (Condition), Observación (Observation), Alergia o intolerancia (AllergyIntolerance), Solicitud de medicación (MedicationRequest), Procedimiento (Procedure), Informe diagnóstico (DiagnosticReport), Solicitud de servicio (ServiceRequest) o Consentimiento (Consent). Cada recurso tiene campos, tipos de datos y reglas, y puede enlazarse con otros. La especificación se publica en versiones sucesivas: la cuarta (R4) incorporó contenido normativo estable, y la quinta (R5) se publicó en 2023, conforme a su sitio oficial.

Un sistema que expone sus datos mediante FHIR ofrece una interfaz de programación (API) de tipo REST: otra aplicación puede pedir «las observaciones de este paciente de los últimos meses» y recibir una respuesta estructurada en formatos como JSON. Los recursos pueden agruparse en paquetes (Bundle) para transmitir documentos completos, que también tienen una estructura propia: el recurso Composition organiza las secciones de un documento clínico, por ejemplo un resumen de alta.

Una de las claves de FHIR es la noción de perfil. El recurso base es deliberadamente general; cada comunidad (un país, una red, una especialidad) define perfiles que restringen y especifican qué campos son obligatorios, qué terminologías deben usarse y qué extensiones se admiten. Así, se pueden compartir datos entre sistemas que cumplen el mismo perfil. Los «conjuntos de valores» enlazan campos con terminologías como SNOMED CT, LOINC o CIE.

Otra pieza es la autorización. Estándares abiertos de autenticación y autorización (OAuth 2.0 y OpenID Connect) se combinan con perfiles como SMART on FHIR, que define cómo lanzar aplicaciones dentro de una historia electrónica y cómo obtener permisos limitados a los datos necesarios, lo que posibilita ecosistemas de aplicaciones de terceros sin que cada una requiera una integración a medida.

Conviene tener presente que FHIR es un instrumento y no una garantía de calidad: datos mal capturados siguen siendo mal datos aunque se transmitan en formato estándar; y la existencia de una API no implica que se exponga lo que el paciente o el profesional necesitan. Además, la flexibilidad de los recursos exige pactar los perfiles con cuidado, porque dos implantaciones «FHIR» pueden ser incompatibles si usan opciones distintas.

## [considerations] Retos de la interoperabilidad y de la historia compartida

Compartir historias clínicas entre prestadores plantea dificultades que no son sólo técnicas.

La identificación de las personas es la primera. En muchos sistemas no existe un identificador único y confiable, y se recurre a datos demográficos (nombre, fecha de nacimiento) que varían por errores, cambios legales de nombre, grafías o transliteraciones, y que producen tanto duplicados como falsas coincidencias. La solución depende del contexto: identificadores nacionales cuando existen y su uso está permitido, algoritmos de emparejamiento probabilístico, verificación con el paciente.

La calidad y el significado de los datos son la segunda dificultad. Un diagnóstico escrito en texto libre, una unidad de medida mal indicada o un código usado con criterios distintos hacen que la información compartida sea ambigua. A mayor volumen de intercambio, mayor necesidad de curación y de mapeo entre terminologías, que es un trabajo especializado y costoso.

La sobrecarga de información es la tercera. Una historia compartida con décadas de datos de muchas fuentes no es más útil por ser más grande: puede volverse inmanejable si no hay resúmenes, filtros y vistas por problemas. El resumen internacional del paciente nace precisamente de la idea de que, en la atención no planificada, unos pocos datos esenciales bien elegidos valen más que una masa de documentos.

La cuarta es la gobernanza: quién decide qué se comparte, quién custodia, quién responde ante una fuga, cómo se informa al paciente de quién ve su historia, cómo se gestionan la oposición y las excepciones para datos especialmente sensibles. Los modelos varían: consentimiento explícito para compartir, aviso con posibilidad de oposición, acceso solo en el contexto de una relación asistencial y con justificación. Cada uno responde a un equilibrio distinto entre utilidad y control, y debe constar con claridad ante los pacientes.

La quinta es la equidad. La digitalización puede ampliar las brechas si la historia electrónica sólo existe en centros con recursos, si los portales exigen habilidades o dispositivos que no todos tienen, o si los datos de ciertas poblaciones están peor representados. La OMS insiste en que la salud digital debe diseñarse para reducir y no profundizar las desigualdades.

## [importance] Secreto médico y confidencialidad: los principios

La confidencialidad de lo que una persona revela a un profesional de la salud es una de las normas éticas más antiguas de la medicina. El juramento hipocrático ya prometía callar lo visto u oído en el ejercicio profesional que no debiera divulgarse. La Declaración de Ginebra de la Asociación Médica Mundial (WMA), la formulación moderna del compromiso del médico, incluye la promesa de respetar los secretos confiados, incluso después de la muerte del paciente. El Código Internacional de Ética Médica de la WMA recoge el mismo deber y precisa que la divulgación sólo es admisible con consentimiento informado o en circunstancias excepcionales, y que debe limitarse a lo mínimo necesario.

La Declaración de Lisboa de la WMA sobre los derechos del paciente, adoptada en 1981 y revisada después, afirma que toda la información identificable sobre el estado de salud, la condición médica, el diagnóstico, el pronóstico y el tratamiento, y toda otra de carácter personal, debe mantenerse confidencial, incluso tras la muerte. Admite que los descendientes puedan tener derecho de acceso a información que los informe de sus riesgos de salud, y señala que la información confidencial sólo se debe dar a terceros con el consentimiento explícito del paciente o cuando la ley lo prevea expresamente, y que los datos solamente pueden darse a otros proveedores de salud sobre la base de la «necesidad de saber», salvo consentimiento. Estas ideas son la base ética de la protección de la historia clínica.

La razón del secreto no es un fetiche profesional. Funciona porque la persona que teme que sus datos se divulguen puede ocultar información, evitar la consulta o abandonar el tratamiento, lo que daña su salud y la salud pública. Es particularmente evidente en condiciones asociadas a estigma: infección por VIH y otras infecciones de transmisión sexual, salud mental, uso de sustancias, violencia, salud sexual y reproductiva. Proteger la confidencialidad es, por tanto, una condición de eficacia de la atención.

Los códigos éticos reconocen que el secreto no es absoluto. Existen excepciones tradicionales y limitadas: la persona consiente; hay un riesgo grave e inminente para ella misma o para terceros identificables que sólo puede evitarse revelando información; hay una obligación legal de notificar determinados eventos, como ciertas enfermedades de declaración obligatoria o sospechas de maltrato a menores; o el requerimiento de una autoridad judicial en los términos que establezca el ordenamiento aplicable. En todos los casos la regla es compartir lo mínimo necesario, con el destinatario adecuado, y dejar constancia de la decisión y su fundamento. La normativa concreta varía de un país a otro y no se detalla aquí.

## [considerations] Protección de datos personales de salud

Además de la ética profesional, los datos de salud están protegidos por el derecho a la protección de los datos personales, reconocido en instrumentos internacionales y en normas de muchos países. En el plano internacional, el Convenio 108 del Consejo de Europa, abierto a firma en 1981 y modernizado en 2018 (Convenio 108+), es el único tratado vinculante de alcance global en la materia, según el propio Consejo, y ha servido de base a numerosas legislaciones nacionales. Los datos relativos a la salud se tratan en él como una categoría que merece garantías reforzadas.

Sin entrar en la normativa de ningún país concreto, los principios generales que organizan esa protección son bastante estables:

• Licitud, lealtad y transparencia: se tratan datos sólo con una base legítima y se informa al titular de qué se hace con ellos.

• Limitación de la finalidad: los datos recogidos para atender a la persona no se reutilizan para fines incompatibles sin una base adecuada.

• Minimización: se recoge y se accede sólo a lo necesario para el fin perseguido.

• Exactitud: los datos deben ser correctos y actualizados; el titular puede pedir su rectificación.

• Limitación del plazo de conservación: no se guardan más tiempo del necesario, con plazos que cada ordenamiento fija según el tipo de documento y que en historia clínica suelen ser largos.

• Integridad y confidencialidad: medidas técnicas y organizativas proporcionales al riesgo.

• Responsabilidad proactiva: el responsable debe poder demostrar que cumple, mediante políticas, registros, evaluaciones de impacto y designación de responsables de protección de datos.

Los titulares tienen, en general, derechos de información, acceso a sus datos, rectificación, oposición en ciertos supuestos y, con matices en el ámbito sanitario, supresión y portabilidad. La supresión choca a menudo con las obligaciones de conservación de la historia, por lo que suele aplicarse de forma limitada; el derecho de acceso, en cambio, tiene en salud un lugar central.

Las normas de ámbito regional más conocidas, como el Reglamento General de Protección de Datos de la Unión Europea, tratan los datos de salud como categoría especial cuyo tratamiento está en principio prohibido salvo excepciones definidas, entre ellas la atención sanitaria prestada por profesionales sujetos a secreto, la salud pública y la investigación con garantías. No se pretende aquí resumir la legislación de ningún Estado, y quien deba aplicarla debe consultar la norma vigente en su jurisdicción.

## [safe_use] Seguridad de la información en la historia clínica

La protección de los datos descansa en un conjunto de medidas técnicas y organizativas. La seguridad de la información se suele describir mediante tres propiedades: confidencialidad (sólo accede quien debe), integridad (los datos no se alteran sin autorización ni rastro) y disponibilidad (los datos están disponibles cuando se necesitan). En sanidad la tercera es tan crítica como las otras: una historia electrónica inaccesible durante un ataque informático o una caída del sistema puede detener la atención.

Entre las medidas más habituales figuran las siguientes.

• Control de acceso basado en roles y en relación asistencial: cada usuario accede a lo que su función y su relación con el paciente justifican. Un administrativo no necesita ver las notas clínicas; un profesional que no atiende a una persona no tiene motivo para abrir su historia.

• Autenticación robusta, con credenciales personales e intransferibles y, cuando es posible, un segundo factor. Compartir contraseñas, práctica frecuente en entornos con prisa, destruye la trazabilidad.

• Registro de auditoría: cada acceso, consulta, modificación o impresión queda registrado con quién, cuándo y desde dónde. Su utilidad depende de que alguien lo revise, con herramientas que detecten patrones anómalos, como accesos a historias de personas conocidas o famosas sin relación asistencial.

• Acceso de emergencia («romper el cristal», break the glass): un usuario sin permiso habitual puede abrir una historia en una urgencia, justificándolo, y ese acceso se revisa luego.

• Cifrado de datos almacenados y transmitidos, y protección de los dispositivos móviles y portátiles que puedan contener datos.

• Copias de seguridad y planes de continuidad: una historia que se pierde es un daño grave para la atención y para la responsabilidad del centro. Los ataques de secuestro de datos (ransomware) contra hospitales han provocado desvíos de pacientes y atención en papel durante días o semanas en varios países, lo que ha convertido la ciberseguridad en un asunto de seguridad del paciente.

• Seudonimización y anonimización para usos secundarios.

• Formación continua del personal, porque gran parte de las fugas proceden de errores humanos: correos mal dirigidos, documentos olvidados, curiosidad indebida, engaños de suplantación (phishing).

• Privacidad desde el diseño y por defecto: las configuraciones iniciales de un sistema deben ser las más protectoras, y las funciones nuevas evaluarse en su impacto sobre la privacidad antes de desplegarse.

Un aspecto práctico, con frecuencia olvidado, es el uso de canales no oficiales como aplicaciones de mensajería, correo personal o fotografías clínicas con teléfonos particulares. Aunque a menudo se emplean con buena intención, escapan al control del centro, a su trazabilidad y a su seguridad, y deben ser sustituidos por canales institucionales aprobados.

## [considerations] Acceso del paciente a su historia

Con el paso del tiempo, la idea de que la historia pertenece sólo al profesional ha cedido ante la de que es información sobre la persona y que ésta tiene derecho a conocerla. La Declaración de Lisboa reconoce el derecho del paciente a ser informado de su estado de salud, incluidos los datos médicos de su condición, y el de no recibir información si no la desea. Las normas de protección de datos de muchos países reconocen, además, un derecho de acceso a los datos personales. La forma concreta —plazos, costes, formatos, límites— depende de cada ordenamiento.

La experiencia más conocida de apertura es la iniciativa OpenNotes. En un estudio publicado en 2012 por Delbanco y colaboradores en Annals of Internal Medicine, más de un centenar de médicos de atención primaria invitaron a más de veinte mil pacientes a leer en línea las notas de sus consultas. La mayoría de los pacientes que las abrieron refirió beneficios, como mayor comprensión de su situación, mejor preparación para la visita y más adherencia a los tratamientos, y pocos expresaron preocupaciones; en la práctica, los médicos refirieron un impacto modesto en su trabajo y la gran mayoría de los participantes quiso continuar. Estudios posteriores confirmaron en general ese patrón, aunque también señalaron dilemas: cómo escribir notas honestas y respetuosas, cómo comunicar un resultado grave antes de que el equipo lo explique, y cómo proteger a quien vive con alguien que podría presionarle para revelar lo que lee.

Existen límites legítimos al acceso. La información que identifica a terceros (por ejemplo, relatos de familiares que pidieron confidencialidad) puede ocultarse. Algunos ordenamientos contemplan una excepción llamada privilegio terapéutico, que permite retener temporalmente información cuando su revelación inmediata causaría un daño grave; su uso es controvertido, debe ser excepcional y razonado y se documenta. En el caso de los menores y de las personas con capacidad limitada, el acceso corresponde a sus representantes, con respeto a la progresiva autonomía del menor.

Los pacientes tienen también derecho a pedir que se corrijan datos erróneos. Dado que el contenido clínico es una apreciación profesional, lo habitual es que no se borre el texto cuestionado sino que se anexe la aclaración o la discrepancia del paciente, de manera que ambas versiones queden visibles. Esa práctica concilia la integridad de la historia con el derecho a la exactitud.

## [considerations] Usos secundarios de la historia: investigación, gestión e inteligencia artificial

El uso de datos de historias clínicas para fines distintos de la atención —investigación, evaluación de servicios, planificación, docencia, desarrollo de herramientas— es valioso y arriesgado a la vez. Valioso, porque permite estudiar a gran escala lo que ocurre en la práctica real. Arriesgado, porque supone reutilizar información íntima sin que la persona haya sido consultada sobre cada uso.

La Declaración de Taipei de la Asociación Médica Mundial, sobre consideraciones éticas relativas a las bases de datos de salud y los biobancos, es un documento de referencia: afirma que la autonomía, la privacidad y la confidencialidad de las personas deben respetarse, que el uso de datos identificables requiere en principio información y consentimiento, y que el uso con otros fines exige supervisión de comités de ética de la investigación, gobernanza transparente y medidas de protección. También reconoce que, cuando el consentimiento específico no es posible, pueden admitirse modelos alternativos con garantías proporcionales.

En la práctica se utilizan varias estrategias, que se combinan. La anonimización elimina o transforma los identificadores de modo que la reidentificación no sea razonablemente posible; no obstante, con datos ricos y longitudinales (fechas, diagnósticos raros, geografía fina, genética) el riesgo de reidentificación no es nulo y se evalúa caso a caso. La seudonimización sustituye los identificadores por códigos, manteniendo la posibilidad de reunir datos de la misma persona; sigue considerándose dato personal. Los entornos de acceso seguro permiten analizar los datos sin sacarlos de la institución. La gobernanza incluye comités de acceso a datos, acuerdos de uso, auditorías y transparencia pública sobre quién usa qué. Y existen modelos de participación como el consentimiento amplio, el consentimiento dinámico o los registros de oposición.

Con el auge de la inteligencia artificial, el uso de historias para entrenar modelos añade preguntas: la representatividad de los datos (si algunos grupos están infrarrepresentados, el modelo funcionará peor para ellos), la posibilidad de que los modelos memoricen y revelen fragmentos, la responsabilidad por los errores y la necesidad de supervisión humana. La OMS ha publicado orientaciones sobre ética y gobernanza de la inteligencia artificial en salud, incluida una guía de 2024 sobre grandes modelos multimodales, que subraya la transparencia, la rendición de cuentas, la protección de datos y la participación de los afectados.

## [special_populations] Poblaciones y situaciones especiales

Algunos grupos y situaciones exigen cuidados particulares en la elaboración y el uso de la historia clínica.

Niños y adolescentes. La historia pediátrica incorpora datos del embarazo y parto, crecimiento, desarrollo, vacunas y entorno familiar y escolar. En la adolescencia surge la tensión entre el derecho de los progenitores a ser informados y la confidencialidad del joven, en temas como salud sexual y reproductiva, salud mental o consumo de sustancias. Los marcos de derechos de la infancia y las recomendaciones de las sociedades pediátricas coinciden en que el menor, según su madurez, tiene derecho a ser escuchado y a cierta confidencialidad, con límites cuando hay riesgo grave. Cuando el portal de pacientes lo permite, es práctica común configurar el acceso de los progenitores de acuerdo con la edad.

Salud mental. Las notas psiquiátricas y psicoterapéuticas son especialmente sensibles. Algunos sistemas separan las «notas de psicoterapia» de la historia general, con acceso más restringido. Permanece el deber de documentar riesgos (por ejemplo, ideación suicida) y planes de seguridad. El acceso del paciente a estas notas es un tema debatido y puede requerir mediación del equipo.

Violencia y maltrato. La historia puede ser un documento clave para proteger a una persona y, a la vez, un riesgo si el agresor accede a ella. Hay que registrar de forma objetiva y literal lo que la persona relata, las lesiones observadas, y las medidas de protección y coordinación adoptadas, sin comentarios interpretativos; y cuidar quién accede, incluido el portal del paciente.

Infecciones de transmisión sexual, VIH y otros diagnósticos estigmatizantes. Requieren máximo cuidado con el acceso, con la comunicación a terceros (pareja, familia) y con el etiquetado en listas visibles en pantalla, de modo que no se expongan a personas que no tienen necesidad de saberlo.

Información genética. Los datos genéticos tienen implicaciones para familiares biológicos. Los códigos éticos discuten cuándo y cómo informar a los parientes en riesgo, con el principio general de animar a la propia persona a comunicarlo y de reservar la revelación directa a casos excepcionales y con salvaguardas.

Personas con deterioro cognitivo o capacidad limitada. La historia debe registrar quién es su representante o persona de apoyo, qué preferencias manifestó la persona cuando podía hacerlo y qué decisiones se tomaron con su participación en la medida posible. La evaluación de la capacidad es específica para cada decisión y se documenta como tal.

Personas fallecidas. El deber de confidencialidad continúa. Los familiares pueden tener acceso a información cuando esté justificado por una razón legítima y el fallecido no lo hubiera prohibido, según las normas aplicables.

Personas migrantes y poblaciones con barreras idiomáticas. Se debe registrar el idioma preferido, la necesidad de intérprete y su identidad (evitando recurrir a familiares o a menores), y documentar que la información se entendió. Para quienes se desplazan entre países, la falta de historia compartida es un problema práctico, y de ahí el interés por los resúmenes portables del paciente.

## [risks] La historia clínica y la seguridad del paciente

La documentación clínica es una pieza de la seguridad del paciente en dos sentidos. Por un lado, es una barrera: lo que se registra bien previene errores, desde la alergia anotada hasta el resultado pendiente señalado. Por otro, puede ser una fuente de errores, y ese riesgo ha crecido con la historia electrónica porque los fallos ya no son sólo individuales sino que se replican con facilidad.

Los análisis de incidentes en distintos países describen modos de fallo recurrentes. La selección del paciente equivocado al abrir una historia o al emitir una orden; la información que estaba en el sistema pero no se mostró en la pantalla donde se decidía; las alertas tan frecuentes que se ignoran; las listas desplegables que inducen a elegir la opción vecina; las notas clonadas que propagan datos falsos o desactualizados; la fragmentación de la información en distintos módulos que nadie revisa en conjunto; y las interfaces que no reflejan cómo trabajan los equipos. En todos ellos, la causa de fondo suele estar en el diseño y la organización más que en la falta de atención de un individuo, y las estrategias de mejora siguen el enfoque de sistemas que popularizó el informe To Err Is Human del Instituto de Medicina (1999) y la obra de James Reason sobre el error humano y el «modelo del queso suizo».

Para reducirlos se aplican principios de diseño centrado en el usuario y en el flujo de trabajo, pruebas de usabilidad con profesionales reales, evaluación de seguridad antes y después de cada cambio importante, canales para notificar problemas con el sistema, y la recomendación de tratar los fallos de la historia electrónica como incidentes de seguridad con análisis y retroalimentación. La OMS, en el reto mundial de seguridad del paciente «Medicación sin daños», señala además la importancia de la información medicamentosa precisa y la conciliación en los traspasos, que dependen de la calidad de la documentación.

Un riesgo menos evidente es la carga de documentación. Un estudio observacional en cuatro especialidades de atención ambulatoria (Sinsky y colaboradores, Annals of Internal Medicine, 2016) estimó que, por cada hora de contacto directo con pacientes, los médicos dedicaban casi dos horas adicionales a la historia electrónica y a tareas de escritorio. Un tiempo así de elevado compite con la atención, aumenta el agotamiento y puede llevar a la escritura apresurada o al uso de plantillas que producen volumen sin información. La respuesta que recomiendan las organizaciones profesionales es redistribuir tareas, simplificar los requisitos de documentación que no benefician al paciente, mejorar la usabilidad y evitar que la historia clínica se utilice como vehículo de todos los requisitos de facturación y auditoría.

## [importance] Calidad de la historia clínica: cómo se evalúa y se mejora

Medir la calidad de la documentación es difícil porque sus dimensiones son múltiples y en parte subjetivas. Los enfoques usados combinan evaluaciones de estructura, de proceso y de resultado.

La evaluación estructurada de la historia revisa la presencia de elementos esenciales: identificación correcta, motivo de consulta, antecedentes y alergias, examen físico, diagnóstico, plan, firma y fecha, y coherencia entre ellos. Las auditorías internas, realizadas por comisiones de historias clínicas o equivalentes, muestrean historias y las puntúan con listas de comprobación, con retroalimentación a los servicios.

La evaluación de la calidad percibida de las notas se ha abordado con instrumentos como el Physician Documentation Quality Instrument (PDQI-9), desarrollado por Stetson y colaboradores a comienzos de la década de 2010, que valora nueve atributos de una nota (entre ellos exactitud, utilidad, organización, concisión y consistencia interna) con evaluadores clínicos. Muestra que una nota puede ser completa y a la vez inútil, o breve y muy útil, y por eso la longitud no es un buen indicador.

La evaluación de proceso incluye indicadores como el porcentaje de altas con informe entregado al paciente en el momento de salir, el tiempo hasta la disponibilidad del informe para el siguiente profesional, la proporción de pacientes con lista de medicación conciliada al ingreso y al alta, el porcentaje de consentimientos informados correctamente cumplimentados o el de resultados críticos comunicados y registrados. Los indicadores de resultado, como los reingresos evitables o los eventos adversos relacionados con información incompleta, son más relevantes pero más difíciles de atribuir a la documentación en exclusiva.

Las estrategias de mejora más consistentes combinan: definición clara de lo que se espera documentar en cada situación; plantillas diseñadas con clínicos que reduzcan la carga en lugar de multiplicarla; formación de profesionales en documentación (incluida la de estudiantes y residentes, a quienes se enseña a menudo con modelos de nota defectuosos); retroalimentación periódica con ejemplos concretos; apoyo de documentalistas clínicos y de personal de codificación; y participación de los pacientes, cuya lectura de las notas permite detectar errores de hecho y de tono.

## [additional_information] Aspectos jurídicos y de responsabilidad: principios sin entrar en normativa nacional

La historia clínica está regulada en prácticamente todos los países, pero cada uno lo hace a su manera: quién es el titular o custodio, durante cuánto tiempo debe conservarse, cómo se accede y cómo se rectifica. Este artículo no entra en esas reglas; sólo recoge principios comunes y conocidos de las buenas prácticas, que quien aplique la norma de su jurisdicción debe cotejar con ella.

Primero, el deber de documentar. Los códigos de ética y los estándares de acreditación de hospitales consideran que registrar la atención es parte del acto profesional, no un trámite accesorio. La ausencia o insuficiencia de historia puede constituir por sí misma una falta de calidad asistencial.

Segundo, la custodia. El centro o la organización que presta la atención es responsable de custodiar la historia, garantizar su conservación, integridad y confidencialidad durante el plazo que se establezca, y permitir el acceso legítimo. La historia no es propiedad privada del profesional que la escribe ni se lleva consigo al cambiar de trabajo.

Tercero, la integridad del registro. No se debe alterar, borrar ni reemplazar lo escrito para ocultar un error o mejorar la posición legal. Las correcciones se hacen con enmiendas visibles y fechadas. Los sistemas electrónicos deben conservar versiones y mostrar la pista de auditoría. La alteración deliberada de registros es una falta grave en los códigos profesionales y puede tener consecuencias legales.

Cuarto, el valor como prueba. Dado que la historia se redacta en el momento de la atención y por quien la presta, suele tener un peso importante en la valoración de lo ocurrido. Ello refuerza la importancia de una documentación honesta y contemporánea, y también de que los registros electrónicos tengan firma, sellado de tiempo y mecanismos que garanticen la autenticidad.

Quinto, la autoría y la responsabilidad compartida. En la atención en equipo, cada profesional responde de lo que registra. Las notas de estudiantes y residentes se revisan y refrendan por el supervisor responsable según las reglas del centro. El uso de plantillas, dictado automático o asistentes de escritura no exime al firmante de revisar el contenido antes de validarlo.

Sexto, los conflictos de interés. El Código Internacional de Ética Médica de la WMA establece que los médicos deben evitar conflictos de interés y no deben recibir beneficios por derivar pacientes o prescribir productos específicos; la historia debe reflejar la indicación clínica real, no consideraciones ajenas.

## [additional_information] Mitos y errores frecuentes sobre la historia clínica

Alrededor de la historia clínica circulan ideas equivocadas, tanto entre pacientes como entre profesionales. Algunas de las más comunes:

• «La historia es del médico». No. La custodia corresponde al centro o servicio que la genera y, aunque su titularidad legal varía según el país, la información que contiene es información sobre la persona, que tiene derechos sobre ella. El médico es su autor, no su propietario.

• «Si algo no está escrito, no ocurrió». Es una regla práctica de prudencia y una consecuencia probatoria habitual, pero no una verdad absoluta: la falta de registro no demuestra que no se hiciera, ni el registro garantiza que se hiciera bien. Por eso conviene escribir con cuidado lo que se hace y se informa, y no escribir lo que no se hizo.

• «Más larga es mejor». Lo contrario suele ser cierto. Las historias largas por acumulación de texto automático ocultan los datos relevantes. La calidad es utilidad.

• «Una historia electrónica es más segura por ser electrónica». Aporta ventajas (trazabilidad, copias, control de acceso) y trae riesgos propios (ciberataques, accesos indebidos masivos, errores replicados). Su seguridad depende de cómo se diseñe, gestione y use.

• «Si el paciente pide su historia, hay que dársela entera sin más». El derecho de acceso es amplio pero no ilimitado: puede haber datos de terceros que proteger, y el modo de entrega (formato, acompañamiento, explicación) también cuenta. El criterio general es facilitarlo y justificar cualquier restricción.

• «Con el consentimiento firmado ya está todo hecho». El formulario es sólo la constancia; lo esencial es el proceso de información y decisión. Un consentimiento firmado sin comprensión no cumple su función ética.

• «Compartir la historia con otros profesionales siempre vulnera la confidencialidad». No si es necesario para la atención de esa persona y el acceso se limita a quienes forman parte de su cuidado; el secreto compartido dentro del equipo asistencial es admisible, con el límite de lo necesario.

• «Los datos anonimizados no tienen riesgo». El riesgo es bajo si se hace bien, pero la reidentificación es posible con datos ricos o cruzando bases; por eso se evalúa y se combina con otras salvaguardas.

• «Nadie lee las historias». Los profesionales leen mucho menos de lo que se escribe, de ahí la importancia de resúmenes, listas de problemas actualizadas y de una escritura que ponga lo importante donde pueda encontrarse.

## [additional_information] Preguntas habituales

¿Quién puede ver una historia clínica? Los profesionales que atienden a la persona, en la medida en que lo necesiten para hacerlo; el personal de apoyo con funciones concretas y acceso limitado; la propia persona y, en su caso, su representante; y terceros sólo con base legal o consentimiento. Todo acceso debería quedar registrado.

¿Se puede pedir una copia? En la mayor parte de los marcos de derechos del paciente, sí, con procedimientos y condiciones que dependen del lugar; la Declaración de Lisboa respalda el derecho a la información sobre la propia salud.

¿Qué hacer si hay un dato erróneo? Solicitar su corrección o la incorporación de una aclaración. El centro suele conservar el original y añadir la rectificación, de modo que consten ambas.

¿Por cuánto tiempo se conserva? Lo fija cada ordenamiento y suele ser largo, con reglas especiales para ciertos documentos (por ejemplo, de menores, de procedimientos con implicaciones prolongadas o de imágenes). Esta información debe buscarse en la normativa local.

¿Existe una historia única para todo un país? Algunos sistemas de salud han desarrollado historias clínicas compartidas o resúmenes nacionales; otros funcionan con historias por institución y mecanismos de intercambio. Ninguno es único modelo válido; lo decisivo es el equilibrio entre acceso para la atención y control del paciente.

¿Quién escribe en la historia? Médicos, enfermeras y otros profesionales sanitarios, cada uno en su ámbito; y, en menor medida, estudiantes bajo supervisión. En registros de salud personales, la propia persona.

¿La historia clínica sirve para reclamar o denunciar? Es habitualmente la principal fuente de información sobre lo ocurrido, y por ello se solicita en procedimientos de revisión de la atención. Su valor depende de que sea verídica y no esté alterada.

## [additional_information] Inteligencia artificial y documentación clínica

La documentación es el terreno donde más rápido se está aplicando la inteligencia artificial generativa. Las herramientas llamadas «escribas ambientales» graban, con consentimiento, la conversación de la consulta y redactan un borrador de nota que el profesional revisa y firma. Otras resumen historias extensas, proponen códigos de clasificación a partir del texto, redactan cartas de derivación o informes de alta, o traducen documentos a un lenguaje comprensible para el paciente.

Las ventajas posibles son claras: reducir el tiempo de pantalla, devolver atención al paciente, mejorar la legibilidad y la uniformidad. Los riesgos, también. Los modelos de lenguaje pueden inventar datos plausibles (las llamadas alucinaciones), omitir lo importante, mezclar el contexto de varios pacientes o reflejar sesgos de los datos con los que se entrenaron. Existe el peligro de la complacencia: un profesional que revisa a toda prisa un borrador bien redactado puede firmar errores sutiles. La grabación de consultas plantea cuestiones de consentimiento, de custodia del audio y de ubicación de los datos. Y la responsabilidad por el contenido de la nota sigue siendo de quien la firma.

La guía de la OMS de 2024 sobre ética y gobernanza de los grandes modelos multimodales en salud insiste en el diseño con participación de profesionales y pacientes, la transparencia sobre el funcionamiento, la protección de datos, la evaluación antes y después del despliegue y la supervisión humana. En la práctica, las instituciones prudentes establecen reglas claras: qué herramientas están aprobadas, qué datos pueden procesarse, cómo se informa al paciente, cómo se audita la calidad de las notas generadas y cómo se notifican los fallos. Hasta que existan evidencias sólidas de beneficio y seguridad en entornos reales, estas herramientas se consideran un apoyo y no una sustitución del juicio clínico.

## [additional_information] Relación con otras disciplinas y profesiones

La historia clínica es un objeto compartido entre muchas disciplinas, y su buen funcionamiento depende de su colaboración.

Enfermería registra valoraciones, planes de cuidados, administración de medicación, educación y evolución; sus clasificaciones propias (diagnósticos de enfermería, intervenciones y resultados) buscan hacer visible la contribución de los cuidados. La farmacia hospitalaria concilia la medicación, valida las prescripciones y registra intervenciones. El laboratorio y la imagen generan los resultados y los informes, con sus controles de calidad y sus sistemas propios. El trabajo social documenta la situación familiar y de apoyos, esencial para el alta. La fisioterapia, la terapia ocupacional, la nutrición, la psicología y otras profesiones añaden valoraciones y planes.

La documentación clínica y la codificación son una disciplina propia: los documentalistas y codificadores revisan la historia para asignar códigos de diagnósticos y procedimientos, mantienen archivos y gestionan solicitudes de acceso; su tarea incluye detectar inconsistencias y devolver consultas a los clínicos. La informática de la salud, con perfiles clínicos y técnicos, diseña, configura y mantiene los sistemas; los directores médicos de sistemas de información sirven de puente. La gestión de calidad y de riesgos analiza incidentes y audita la documentación. La bioética y los comités de ética asistencial asesoran en dilemas de acceso, confidencialidad y uso secundario. La epidemiología y la salud pública explotan los datos agregados para vigilancia y planificación.

Cada una de estas profesiones ve la historia desde una necesidad distinta, y uno de los desafíos del diseño es que una misma entrada de datos sirva a varias sin imponer a quien la escribe la carga de repetirla.

## [additional_information] Perspectivas: hacia una historia centrada en la persona

Las tendencias que se consideran más relevantes para la historia clínica en los próximos años se describen aquí con cautela, porque combinan avances técnicos con decisiones sociales aún abiertas.

La primera es la centralidad de la persona. Los registros de salud personales, los portales con acceso a notas y resultados, la posibilidad de añadir datos propios y de decidir con quién se comparten apuntan a un modelo en el que la historia es una herramienta compartida con el paciente y no sólo un archivo del sistema. La Estrategia mundial de salud digital de la OMS formula entre sus objetivos sistemas de salud centrados en las personas, apoyados por la tecnología.

La segunda es la interoperabilidad efectiva. FHIR y los perfiles de resumen del paciente permiten pensar en intercambios que acompañen a la persona entre centros, regiones y países. Los espacios de datos de salud, que se están desarrollando en distintos lugares, buscan combinar acceso a la atención con reutilización gobernada para investigación e innovación, bajo reglas de transparencia y control.

La tercera es la incorporación de nuevos tipos de datos: dispositivos portátiles y sensores, datos de entornos domiciliarios, información genómica, imágenes con análisis automatizado y determinantes sociales de la salud. Cada uno plantea retos de calidad, de validación clínica, de equidad y de privacidad, y obliga a decidir qué merece estar en la historia y qué se queda en otros sistemas.

La cuarta es la mejora de la usabilidad y la reducción de la carga documental, con herramientas de apoyo a la escritura, interfaces más inteligentes y reducción de requisitos burocráticos. La experiencia indica que la tecnología por sí sola no resuelve el problema si no cambia a la vez la organización del trabajo.

La quinta es el fortalecimiento de la seguridad y la resiliencia frente a ciberataques, con planes de continuidad que permitan seguir atendiendo cuando el sistema falla.

Y la sexta es la reflexión ética permanente. La digitalización multiplica la capacidad de usar los datos y, con ella, la responsabilidad de preservar la confianza. Una historia clínica merece esa confianza cuando cumple su finalidad original: ayudar a que la persona reciba la mejor atención posible con el respeto debido a su intimidad.

## [references]

- Weed LL. Medical records that guide and teach. N Engl J Med 1968;278:593–600 y 652–657 | https://www.nejm.org/doi/full/10.1056/NEJM196803142781105 | New England Journal of Medicine
- Lawrence L. Weed and the problem-oriented medical record (PubMed) | https://pubmed.ncbi.nlm.nih.gov/8469095/ | PubMed (NLM)
- Declaración de Lisboa de la Asociación Médica Mundial sobre los derechos del paciente (WMA Declaration of Lisbon on the Rights of the Patient) | https://www.wma.net/policies-post/wma-declaration-of-lisbon-on-the-rights-of-the-patient/ | Asociación Médica Mundial
- Declaración de Ginebra de la Asociación Médica Mundial (WMA Declaration of Geneva) | https://www.wma.net/policies-post/wma-declaration-of-geneva/ | Asociación Médica Mundial
- Código Internacional de Ética Médica (WMA International Code of Medical Ethics) | https://www.wma.net/policies-post/wma-international-code-of-medical-ethics/ | Asociación Médica Mundial
- Global strategy on digital health 2020–2025 (Organización Mundial de la Salud, 2021) | https://iris.who.int/handle/10665/344249 | OMS
- HL7 FHIR — Overview (HL7 International) | https://hl7.org/fhir/overview.html | HL7 International
- What is SNOMED CT (SNOMED International) | https://www.snomed.org/what-is-snomed-ct | SNOMED International
- Convention 108+ — Convention for the protection of individuals with regard to the processing of personal data (Council of Europe, 2018) | https://rm.coe.int/convention-108-convention-for-the-protection-of-individuals-with-regar/16808b36f1 | Consejo de Europa
- Delbanco T, et al. Inviting patients to read their doctors' notes: a quasi-experimental study and a look ahead. Ann Intern Med 2012;157:461–470 | https://www.acpjournals.org/doi/10.7326/0003-4819-157-7-201210020-00002 | Annals of Internal Medicine (ACP)
- Kripalani S, et al. Deficits in communication and information transfer between hospital-based and primary care physicians. JAMA 2007;297:831–841 | https://doi.org/10.1001/jama.297.8.831 | JAMA
