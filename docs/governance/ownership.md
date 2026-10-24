# Propiedad

**No hay `CODEOWNERS` ni asignación formal de responsables.** Esta página
registra lo que sí se puede deducir.

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
| Primer administrador sembrado | Ídem | Bootstrap de la API (ver su README) |
| `identidad-visual.md` (ALOVIDA) | Diseño | Fuente normativa del sistema |
| Modelo M34 | Arquitectura | Fuente normativa de los 9 estados |

**La tercera es la que rompe dos journeys completos si nadie la cuida.** Ver
[servicios externos](../integrations/external-services.md#la-coordinación-con-el-correo).
