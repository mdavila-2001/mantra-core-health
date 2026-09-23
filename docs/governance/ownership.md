# Propiedad

**No hay `CODEOWNERS` ni asignación formal de responsables.** Esta página
registra lo que sí se puede deducir y lo que hace falta decidir.

---

## Lo que existe

| Fuente | Qué dice |
|---|---|
| `COORDINACION-AGENTES.md` | Un mecanismo real: **quién está tocando qué archivos**, escrito por cada sesión antes de empezar |
| Historia de Git | Quién escribió cada línea |
| `angular.json` | `cli.packageManager: yarn` — convención del proyecto |

`COORDINACION-AGENTES.md` es lo más parecido a un contrato de propiedad que hay,
y funciona: declara *«Archivos que estoy creando»*, *«Archivos existentes que
estoy modificando»* y *«Lo que NO estoy tocando — es todo tuyo»*.

**Este trabajo documental se atuvo a ese mecanismo**: cuando apareció trabajo
concurrente sobre `src/environments/`, `package.json` y los archivos de Docker,
se preservó íntegro y se repitió la medición. Ver
[la línea base §1.1](../reports/baseline.md#11--trabajo-concurrente-durante-la-medición).

## Lo que no existe

| Elemento | Estado |
|---|---|
| `CODEOWNERS` | **No existe** |
| Responsable por área | No definido |
| Revisores obligatorios | No definidos |
| Guardia | No definida |
| Responsable de la documentación | No definido |
| Contacto de seguridad | No definido |

## Propiedad propuesta

Las áreas que de verdad necesitan un dueño, ordenadas por lo que cuesta que no lo
tengan:

| Área | Archivos | Por qué importa |
|---|---|---|
| **Contratos de la API** | `core/data-access/**` | Un cambio del backend rompe acá, y **no hay prueba de contrato** |
| **Sistema de diseño** | `shared/components/**`, `styles.css`, `core/tokens/**` | 188 tokens, 48 componentes, **sin regresión visual** |
| **Sesión y seguridad** | `core/auth/**`, `core/http/**` | La superficie de mayor riesgo |
| **Estados del M34** | `core/view-state/**` | 14 importadores. Cambia el vocabulario de todo |
| **Contrato de formularios** | `shared/forms/**` | 19 importadores. Rompe la accesibilidad de todos los campos |
| Renderizado y arranque | `app.config*.ts`, `app.routes*.ts`, `server.ts` | Un cambio de orden rompe la recuperación de sesión |
| Build y despliegue | `angular.json`, `Dockerfile*`, `docker-compose.yml` | |
| Documentación | `docs/**`, `scripts/**` | |

Los cinco primeros son **exactamente los nodos de mayor centralidad** del grafo
de módulos. No es casualidad: lo que muchos importan es lo que más cuesta cambiar
mal.

## `CODEOWNERS` propuesto

```text
# PROPUESTA — requiere que existan los equipos

/src/app/core/data-access/   @equipo-contratos
/src/app/core/auth/          @equipo-seguridad
/src/app/core/http/          @equipo-seguridad
/src/app/core/view-state/    @equipo-arquitectura
/src/app/shared/forms/       @equipo-arquitectura @equipo-accesibilidad
/src/app/shared/components/  @equipo-diseno
/src/styles.css              @equipo-diseno
/src/app/core/tokens/        @equipo-diseno
/angular.json                @equipo-plataforma
/Dockerfile.dev              @equipo-plataforma
/docker-compose.yml          @equipo-plataforma
/docs/                       @equipo-documentacion
/scripts/                    @equipo-documentacion
```

**No se crea el archivo**: crear un `CODEOWNERS` que nombre equipos inexistentes
haría fallar la revisión de cada pull request. Requiere que los equipos existan
primero.

## Dependencias con otros equipos

| Dependencia | Dueño | Estado |
|---|---|---|
| Contrato de la API | Equipo de la API | **Sin OpenAPI alcanzable** |
| Códigos de error | Ídem | Copiados a mano, con la referencia anotada |
| **Dominio de los enlaces del correo** | Ídem | **Sin documentar en ningún repositorio** |
| Primer administrador sembrado | Ídem | Documentado en `ESTADO-FRONTEND.md` |
| `identidad-visual.md` (ALOVIDA) | Diseño | Fuente normativa del sistema |
| Modelo M34 | Arquitectura | Fuente normativa de los 9 estados |

**La tercera es la que rompe dos journeys completos si nadie la cuida.** Ver
[servicios externos](../integrations/external-services.md#la-coordinación-con-el-correo).

## Decisiones que esperan a alguien

Recogidas de los comentarios del propio código y de los documentos previos:

| Decisión | Dónde está anotada |
|---|---|
| Confirmar la escala de breakpoints | `core/tokens/breakpoints.ts`: *«Pendiente de que el diseñador la confirme»* |
| Si `subtle` puede subrayar solo al hover | `link.types.ts` |
| Señal de MFA en el backend | `login.ts`, con un `TODO` |
| Dominio de la API en producción | [Configuración](../operations/configuration.md#la-decisión-tomada) |
| Marco normativo de privacidad | [Privacidad](../security/privacy.md#marco-normativo) |
| Destino del barril `@shared` | [Reglas de composición](../components/composition-rules.md#el-barril-y-las-rutas-profundas) |

## Estado

`MEDIUM`. No bloquea el desarrollo; **sí bloquea la operación**: sin guardia
definida, una alerta no tiene a quién llegarle. Ver
[paneles y alertas](../observability/dashboards-and-alerts.md#guardia).
