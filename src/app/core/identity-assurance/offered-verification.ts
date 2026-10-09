/**
 * Si el producto **ofrece** hoy la verificación de identidad.
 *
 * ## Qué apaga, y qué no
 *
 * Apaga sólo lo que *pide* verificar: el renglón «Verificar identidad» y «Mis
 * verificaciones» del menú, la tarjeta «Tu identidad» del panel —que saludaba
 * con un sello «Sin verificar»— y el bloque del perfil que decía «Todavía no
 * iniciaste ninguna verificación».
 *
 * **No apaga la función.** Las rutas siguen declaradas y alcanzables, las
 * pantallas siguen montadas y `errorToViewState` sigue traduciendo el 403
 * `IDENTITY_VERIFICATION_REQUIRED` en una salida hacia `/my-account/identity`.
 * Eso último es deliberado: si la API llega a exigir la verificación para una
 * operación concreta, quitarle a la persona la puerta la dejaría en un error
 * sin salida, que es peor que el cartel que se quitó.
 *
 * ## Por qué existe en vez de borrar el código
 *
 * Porque el pedido fue «no pida verificación **de momento**» (chat del
 * 26/08/2026). Un pedido con fecha de vencimiento se implementa con un
 * interruptor y no con un borrado: volver a ofrecerla es cambiar este `false`
 * por `true`, y lo que se apagó vuelve completo y a la vez en los tres sitios.
 * Borrado, habría que reconstruirlo de memoria — y las tres piezas se
 * reconstruyen distinto.
 */
export const VERIFICACION_DE_IDENTIDAD_OFRECIDA = false;
