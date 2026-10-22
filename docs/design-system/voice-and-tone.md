# Voz y tono de AloVida

AloVida es una aplicación de salud. Quien la abre suele estar preocupado, apurado o cuidando a
otra persona. Cada texto tiene que transmitir lo mismo que un buen consultorio: **seriedad,
claridad y calidez**, en ese orden.

> Pedido del propietario (2026-10-08): «Que suene humano y marketeable, pero serio. Al usuario se
> le habla de **usted**. Somos una app de salud.»

Referencias de oficio en las que se apoya esta guía (consultadas como principios, no copiadas):
la guía de contenido de Mailchimp (voz constante, tono que cambia según el momento), el manual de
estilo de GOV.UK (frases cortas, la tarea primero) y las pautas de UX writing de Material Design y
de Nielsen Norman Group (etiquetas que describen el resultado de la acción).

---

## 1. Trato: siempre de usted

| No | Sí |
|---|---|
| Elegí tu especialidad | Elija su especialidad |
| ¿Querés cancelar? | ¿Desea cancelar la cita? |
| Te avisamos cuando esté lista | Le avisaremos cuando esté lista |
| Registrate | Regístrese |
| Revisá tu conexión | Revise su conexión |

- Sin voseo («tenés», «podés», «agregá») ni tuteo («tienes», «puedes», «agrega»).
- «Le» de cortesía para el objeto indirecto: «le enviamos», «le recomendamos».
- Las publicaciones y los mensajes que escriben los usuarios **no se corrigen**: son su voz, no la
  de AloVida.

## 2. Botones: infinitivo con el resultado

El botón dice **qué va a pasar**, no qué hace el sistema.

| Mecánico | Con criterio |
|---|---|
| Enviar | Solicitar cita |
| Aceptar | Confirmar pago |
| Submit / Procesar | Guardar cambios |
| Eliminar registro | Eliminar receta |
| Gestionar | Ver mis citas |

- Infinitivo y sin pronombre: «Guardar cambios», «Pedir cita», «Agregar medicamento».
- El botón principal de un formulario repite el verbo del título: título «Nueva receta» → botón
  «Emitir receta».
- La acción destructiva nombra el objeto: «Eliminar receta», nunca «Eliminar» a secas.

## 3. Títulos y etiquetas: lenguaje de persona, no de base de datos

| Mecánico | Con criterio |
|---|---|
| Datos del registro | Sus datos |
| Entidad / Ítem / Recurso | Clínica · Medicamento · Estudio |
| Estado: ACTIVE | Activa |
| N/A · — · null | No indicado |
| Fecha de alta | Miembro desde |
| Listado de solicitudes | Solicitudes recibidas |
| Módulo de gestión de agenda | Agenda |

- Nunca mostrar códigos, enums ni identificadores técnicos (`PENDING`, `uuid`, `concept_id`).
- Los títulos de pantalla son sustantivos cortos: «Mis citas», «Recetas», «Historia clínica».
- Los subtítulos explican **para qué sirve** la pantalla en una frase: «Aquí encontrará sus
  recetas vigentes y podrá ver dónde comprarlas.»

## 4. Mensajes de éxito, vacío y error

**Éxito.** Confirma lo que pasó y, si aplica, lo que sigue. Sin «exitosamente».

- ✗ «Registro creado exitosamente.»
- ✓ «Su cita quedó confirmada para el martes 14 a las 9:30. Le enviamos el detalle por correo.»

**Vacío.** Dice qué falta y cuál es el primer paso.

- ✗ «No hay datos.»
- ✓ «Todavía no tiene citas. Cuando reserve una, la verá aquí.» + botón «Buscar médico».

**Error.** Qué pasó, en palabras simples, y qué puede hacer la persona. Nunca culpar, nunca
mostrar códigos.

- ✗ «Error 500. Falló la operación.»
- ✓ «No pudimos guardar los cambios. Revise su conexión e intente de nuevo.»

## 5. Lo que una app de salud no hace

- **No promete resultados clínicos** («cure», «sin dolor», «garantizado»).
- **No exagera**: nada de «¡increíble!», «revolucionario», «el mejor». La confianza se gana con
  precisión, no con adjetivos.
- **No usa emojis** en textos de interfaz ni en mensajes clínicos.
- **Un signo de exclamación como máximo por pantalla**, y sólo en una bienvenida.
- **No alarma sin necesidad**: las alertas clínicas son claras y directas, sin dramatismo; si hay
  que actuar, dicen qué hacer y cuándo.
- **Lenguaje clínico sólo cuando aporta**: «presión arterial» antes que «PA»; el término técnico
  va acompañado de su explicación la primera vez.

## 6. Tono según el momento

| Momento | Tono | Ejemplo |
|---|---|---|
| Bienvenida, portada | Cálido, invitante | «Su salud, en un solo lugar.» |
| Formularios | Claro, guiado | «Ingrese el número tal como figura en su cédula.» |
| Confirmaciones | Preciso, tranquilizador | «Listo. Su médico ya puede ver los resultados.» |
| Errores | Sereno, resolutivo | «No pudimos conectarnos. Intente de nuevo en unos segundos.» |
| Alertas clínicas | Directo, sin adornos | «Si el dolor de pecho continúa, acuda a emergencias.» |

## 7. Gramática y estilo

- Frases cortas: una idea por frase.
- Mayúscula sólo al inicio: «Historia clínica», no «Historia Clínica».
- Números en cifras: «3 citas», «Bs 120».
- Fechas legibles: «martes 14 de octubre», no «2026-10-14».
- «Aquí» en textos nuevos («Aquí verá…»); evitar regionalismos que suenen informales.

## 8. Cómo aplicarla

- Al crear o tocar una pantalla, revisar sus textos contra las secciones 1–5.
- Las pruebas que buscan textos usan la misma redacción; si cambia el texto, cambia la prueba en
  el mismo commit.
- El pase masivo a usted del 2026-10-08 se hizo con un script que sólo toca textos visibles
  (cadenas de TypeScript y texto de plantillas, nunca comentarios ni identificadores).
- **`node scripts/check-usted.mjs`** marca cualquier texto visible que vuelva a hablar de vos o
  de tú, con archivo, línea y contexto. Sale en 1 si encuentra algo. Correrlo antes de abrir un
  PR que toque textos, y después de mezclar ramas viejas, que pueden traer voseo.
