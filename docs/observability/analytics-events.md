# Catálogo de eventos analíticos

**El catálogo está vacío: no se emite ningún evento.** Esta página lo registra y
propone el catálogo que correspondería, con sus reglas de privacidad, **sin
implementarlo**.

> El plan maestro es explícito: *«No añadir telemetría nueva como parte implícita
> de la documentación.»*

---

## Estado

```bash
grep -rn "track(\|logEvent\|gtag\|dataLayer\|analytics" src/
```

Sin resultados. Ver [analítica](../integrations/analytics.md).

## Propuesta de catálogo

Los eventos que tendrían valor, con la ficha completa que el plan exige. **Nada
de esto está implementado.**

### Autenticación

| Evento | Disparador | Propiedades | Prohibido | Consentimiento | Consumidor |
|---|---|---|---|---|---|
| `login_intentado` | Envío del formulario | `metodo: 'email'\|'documento'` | El identificador | Necesario para operar | Producto + Operaciones |
| `login_exitoso` | 200 | `tiene_varias_organizaciones: boolean` | `sub`, nombre, organización | Ídem | Producto |
| `login_fallido` | Error | `codigo` de la API | El identificador, el mensaje | Ídem | **Operaciones** |
| `organizacion_elegida` | `selectTenant` | `cantidad_disponibles: number` | El identificador de la organización | Ídem | Producto |
| `sesion_cerrada` | `logout` | `motivo: 'usuario'\|'token_invalido'` | — | Ídem | Producto |

### Registro

| Evento | Disparador | Propiedades | Prohibido |
|---|---|---|---|
| `registro_iniciado` | Entrada a la pantalla | `tipo: 'paciente'\|'profesional'` | — |
| `registro_tipo_cambiado` | `cambiarTipo` | `de`, `a` | — |
| `registro_enviado` | Envío | `tipo` | Todos los campos |
| `registro_exitoso` | 200 | `tipo`, `verificacion_enviada: boolean` | Identificadores del perfil |
| `registro_fallido` | Error | `tipo`, `codigo` | El mensaje |

### Recuperación y verificación

| Evento | Disparador | Propiedades | Prohibido |
|---|---|---|---|
| `recuperacion_pedida` | Envío | — | **El identificador. Siempre** |
| `contrasena_restablecida` | 200 | `sesiones_revocadas: number` | El token |
| `correo_verificado` | 200 | `resultado: 'ok'\|'invalido'\|'sin_token'` | El token |

### Operativos — **los más valiosos**

| Evento | Disparador | Propiedades | Consumidor |
|---|---|---|---|
| `estado_ux_mostrado` | Cada estado del M34 en `ViewStateHost` | `codigo: 'S3'\|'S4'…'S9'`, `ruta` normalizada | **Operaciones** |
| `api_error` | Cualquier fallo | `codigo`, `estado_http`, `endpoint`, `request_id` | **Operaciones** |
| `chunk_fallido` | Fallo de `loadComponent` | `chunk` | **Operaciones** |
| `reintento_pedido` | `(retry)` | `codigo_previo` | Producto |

**`estado_ux_mostrado` es el evento que más rinde de todo el catálogo.** Un pico
de `S8` significa que la API no responde para los usuarios, y hoy **eso no se
detecta hasta que alguien lo reporta**.

Y es barato de instrumentar: **hay un solo lugar donde poner el disparador**,
porque `ViewStateHost` pinta los nueve estados para todo el proyecto.

## Datos prohibidos, en toda propiedad de todo evento

1. Identificadores de paciente, documentos, correos, teléfonos.
2. Nombres de personas.
3. Tokens, completos o truncados.
4. Contenido de formularios.
5. Nombres de archivo — pueden ser identificables por sí solos.
6. **Rutas sin normalizar.** `/pacientes/4821` es un identificador; debe viajar
   como `/pacientes/:id`.
7. Cualquier cosa que revele **qué** consultó una persona. En salud, la sección
   visitada es información de salud.

La 6 y la 7 son las específicas de este dominio y las que más fácil se rompen.

## Convenciones propuestas

| Regla | Ejemplo |
|---|---|
| Nombres en español, `snake_case`, sustantivo + participio | `login_exitoso` |
| Propiedades en `snake_case` | `tiene_varias_organizaciones` |
| Booleanos con prefijo `es_`/`tiene_` | `tiene_varias_organizaciones` |
| Rutas siempre normalizadas | `/pacientes/:id` |
| Códigos de error, nunca mensajes | `codigo: 'RATE_LIMITED'` |

La última repite la regla que el proyecto ya aplica en `errorToViewState`:
**se ramifica por `code`, nunca por `message`**. Los mensajes cambian de
redacción; los códigos son contrato.

## Cómo se probaría

Sin esto, las reglas de arriba son una intención:

1. Una prueba por evento que compruebe que **solo** emite las propiedades
   declaradas.
2. Una prueba que pase un objeto con un token y compruebe que no sale.
3. Una comprobación de que ninguna ruta viaja sin normalizar.

## Antes de implementar nada

Ver [analítica §antes de agregar](../integrations/analytics.md#antes-de-agregar-analítica)
y [privacidad](../security/privacy.md).

**Y una decisión de orden:** los eventos operativos (`estado_ux_mostrado`,
`api_error`, `chunk_fallido`) son más urgentes y **menos problemáticos en
privacidad** que los de producto. Conviene empezar por ellos: no describen
comportamiento de personas, describen salud del sistema.

## Estado

`MEDIUM` de producto, `HIGH` operativa. Registrado en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

**No se implementa acá.**
