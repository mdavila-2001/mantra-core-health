# Respuesta a incidentes

Qué hacer cuando algo del frontend falla o se compromete. **Hoy la detección
depende enteramente de que alguien lo reporte**, y ése es el primer problema a
resolver.

---

## La limitación de partida

| Capacidad | Estado |
|---|---|
| Telemetría de errores | **No existe** |
| Monitoreo de disponibilidad | **No existe** |
| Alertas | **No existe** |
| Registros del cliente | **No existen** |
| Despliegue de producción | **No existe** |

**Consecuencia:** un incidente se detecta cuando una persona lo reporta. No hay
métrica, ni alerta, ni panel.

Todo lo que sigue asume que el aviso llegó por un canal humano.

## Lo único que sí ayuda: el identificador de soporte

Cuando el fallo viene de la API, la pantalla muestra un código copiable:

```html
Código de soporte: <code class="tabular-nums">{{ fallo.requestId }}</code>
<button app-button size="sm" variant="outline" (clicked)="copyRequestId()">Copiar código</button>
```

Sale de `correlationId` del cuerpo, o de la cabecera `x-request-id`, o de
`'sin-id'`.

**Es lo único que conecta lo que la persona reporta con los registros del
servidor.** Pedirlo debe ser la primera pregunta de cualquier reporte.

> **Ojo:** un fallo de render (pantalla en blanco) **no tiene ese
> identificador**, porque nunca hubo una petición. Ver
> [error boundaries](../architecture/error-boundaries.md#nivel-3--el-hueco).

## Clasificación

| Severidad | Definición | Ejemplos |
|---|---|---|
| **S1 · Crítica** | Nadie puede usar la aplicación, o hay exposición de datos | Pantalla en blanco general · token filtrado · XSS confirmado |
| **S2 · Alta** | Un flujo crítico está roto | No se puede iniciar sesión · el registro falla |
| **S3 · Media** | Degradación con alternativa | Una pantalla lenta · un estado que se ve mal |
| **S4 · Baja** | Cosmético | Un ícono que no pinta |

## Procedimiento

### 1 · Contener

| Situación | Acción |
|---|---|
| Regresión de un despliegue | **Revertir.** Ver [rollback](../operations/rollback.md) |
| Credencial comprometida | Revocar del lado de la API. Un `logout-all` invalida los refresh tokens |
| Exposición de datos | Contener primero, investigar después |

### 2 · Reunir evidencia

Del reporte:

- [ ] **El código de soporte** (`requestId`), si la pantalla lo mostró.
- [ ] URL exacta y hora aproximada.
- [ ] Navegador y sistema operativo.
- [ ] ¿Con sesión o sin ella? ¿Qué organización?
- [ ] ¿Es reproducible?
- [ ] Consola del navegador y pestaña de red, si es posible.

Del sistema:

- [ ] Versión desplegada del frontend.
- [ ] Registros de la API filtrados por el `requestId`.
- [ ] Estado de la API — ¿respondía?

**Nada de PHI en el registro del incidente.** Un identificador opaco basta; el
nombre de un paciente no.

### 3 · Diagnosticar

Los [runbooks](../operations/runbooks/index.md) cubren los doce síntomas más
probables:

| Síntoma | Runbook |
|---|---|
| La aplicación no carga | [app-no-carga](../operations/runbooks/app-no-carga.md) |
| Pantalla en blanco | [pantalla-en-blanco](../operations/runbooks/pantalla-en-blanco.md) |
| Chunks fallidos tras un despliegue | [chunks-desactualizados](../operations/runbooks/chunks-desactualizados.md) |
| Backend no disponible | [backend-no-disponible](../operations/runbooks/backend-no-disponible.md) |
| Autenticación en bucle | [autenticacion-en-bucle](../operations/runbooks/autenticacion-en-bucle.md) |
| CORS bloqueando | [cors-bloqueando](../operations/runbooks/cors-bloqueando.md) |
| Variables de entorno mal | [variables-incorrectas](../operations/runbooks/variables-incorrectas.md) |
| Error de hidratación | [error-de-hidratacion](../operations/runbooks/error-de-hidratacion.md) |

### 4 · Comunicar

| Severidad | A quién | Cuándo |
|---|---|---|
| S1 | Responsable del producto + equipo de API | Inmediato |
| S2 | Equipo | En la hora |
| S3–S4 | Registro de incidencias | En el día |

**Si hay sospecha de exposición de datos personales**, la comunicación deja de
ser técnica: aplica el marco normativo del proyecto, que
[hoy no está declarado](privacy.md#marco-normativo). Es una brecha con
consecuencias reales en un incidente.

### 5 · Resolver

| Opción | Cuándo |
|---|---|
| Revertir | Regresión de un despliegue. **Siempre la primera opción** |
| Corregir hacia adelante | Solo si la corrección es trivial y verificable |
| Mitigar | Si ninguna de las dos es posible ya |

Antes de dar por cerrado, **la batería completa**:

```bash
yarn lint && yarn tsc -p tsconfig.app.json --noEmit && yarn build && yarn test:coverage
```

### 6 · Post mortem

Para S1 y S2:

- Qué pasó y cuándo.
- Cómo se detectó — **y cuánto tardó**.
- Impacto: cuánta gente, cuánto tiempo.
- Causa raíz.
- Qué lo hizo posible.
- Qué lo detectaría antes la próxima vez.
- Acciones, con dueño.

**La pregunta que más va a rendir en este proyecto es la quinta**: hoy la
respuesta casi siempre va a ser «nada», y eso es exactamente el argumento para
añadir telemetría.

## Incidentes específicos

### Sospecha de XSS

1. Contener: sacar el despliegue si es necesario.
2. **Asumir que todo refresh token está comprometido.** Están en `localStorage`.
3. Revocar sesiones del lado de la API.
4. Buscar el vector: `grep -rn "innerHTML\|bypassSecurityTrust\|eval("` — hoy no
   hay ninguno, así que un hallazgo es la pista.
5. Revisar dependencias: `yarn npm audit --recursive`.
6. **Añadir CSP** — ver [CSP](content-security-policy.md).

### Fuga de un secreto en el paquete

`generate-env.mjs` lo hace muy improbable, pero si pasara:

1. Rotar el secreto **primero**. Está en el paquete de todos los que lo
   descargaron.
2. Revisar por qué las tres defensas del generador no lo atraparon.
3. Reforzar el `MANIFEST` o las validaciones.

### Pico de errores S8

Significa que **la API no responde para los usuarios**. No es un incidente del
frontend: escalar al equipo de API.

Hoy **no se puede detectar**, porque no hay telemetría. Es el argumento más
concreto para agregarla.

## Lo que hace falta para que esto funcione

| # | Qué | Estado |
|---|---|---|
| 1 | Un despliegue de producción | **No existe** |
| 2 | Telemetría de errores | **No existe** |
| 3 | Alertas sobre picos de S8/S9 | **No existe** |
| 4 | Marco normativo declarado | **No existe** |
| 5 | Canal de reporte definido | No documentado |
| 6 | Dueño de guardia | No definido |

**Sin 1 y 2, este procedimiento es teórico.** Están en
[el análisis de brechas](../reports/documentation-gap-analysis.md) como `BLOCKER`
y `HIGH` respectivamente.
