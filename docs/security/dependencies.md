# Dependencias y cadena de suministro

Diez dependencias en ejecución, todas de Angular. Una vulnerabilidad conocida, y
no llega al navegador.

---

## Superficie en ejecución

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 185 |
| `@angular/common` | 51 |
| `@angular/router` | 34 |
| `@angular/forms` | 14 |
| `rxjs` | 10 |
| `@angular/platform-browser` | 4 |
| `@angular/ssr` | 3 |
| `express` | 1 |
| `node:path` | 1 |
| `node:fs` | 12 — **solo en archivos de prueba** |

**Ninguna biblioteca de interfaz, de estado, de fechas, de utilidades ni de
validación.** Los 48 componentes están escritos en el repositorio.

Es la propiedad de seguridad más valiosa del proyecto y no se debería perder sin
decisión explícita. Ver
[ADR-0004](../adr/ADR-0004-sistema-de-diseno-propio.md).

## Auditoría

```bash
yarn npm audit --recursive
```

Resultado al 2026-08-01:

```text
moderate · @hono/node-server@1.19.15
  GHSA-frvp-7c67-39w9
  Path traversal en serve-static sobre Windows vía backslash codificado (%5C)
  Cadena: @angular/cli@21.2.19 → @modelcontextprotocol/sdk@1.26.0 → @hono/node-server
```

**Total: 1 moderada, 0 altas, 0 críticas.**

### Análisis

| Pregunta | Respuesta |
|---|---|
| ¿Llega al navegador? | **No.** `@angular/cli` es `devDependency` |
| ¿Se ejecuta en desarrollo? | Solo si alguien levanta el servidor MCP de la CLI |
| ¿El vector aplica? | **No.** Es un servidor estático corriendo en **Windows**; ni el entorno de desarrollo ni el de despliegue lo son |
| ¿Se puede corregir? | Subir `@angular/cli`, cuando publique una versión con la transitiva actualizada |
| ¿Se corrige acá? | **No.** Tocar el lockfile es un cambio de producto |

**Clasificación: aceptada, con seguimiento.** Se revisa en la próxima subida de
Angular.

## El par de dependencias no satisfecho

```text
YN0060: @angular/cli 21.2.19 no satisface lo que angular-eslint pide (>=22 <23)
```

**Preexistente, sin efecto medido:** lint y build pasan. Es una declaración de par
optimista de `angular-eslint`, no una incompatibilidad observable.

Subir `@angular/cli` a 22 tocaría el lockfile y el toolchain. Requiere
autorización y su propia validación.

## El lockfile

```bash
yarn install --immutable
```

`--immutable` **falla si el lockfile no cuadra**. Es la orden que debe correr un
pipeline: garantiza que lo instalado es exactamente lo declarado.

`yarn.lock` (257 kB) está versionado.

### Modo PnP

El repositorio no fija `nodeLinker`, así que Yarn 4 instala en modo Plug'n'Play.
Consecuencia para la cadena de suministro:

| Aspecto | Efecto |
|---|---|
| No hay `node_modules` | Un paquete no puede acceder a otro que no declaró |
| **Sin scripts de instalación arbitrarios** | PnP los restringe mucho más que un `node_modules` |
| `.yarn/unplugged/` | Solo lo que necesita binarios nativos se desempaqueta |

Es una propiedad de seguridad real que suele pasar inadvertida.

## Qué NO hay

| Control | Estado |
|---|---|
| Auditoría automática en CI | **No existe.** Se corre a mano |
| Dependabot / Renovate | **No configurado** |
| Fijado de versiones exactas | No: se usan rangos `^` |
| Comprobación de licencias | No existe |
| SBOM | No se genera |
| Firma de artefactos | No existe |
| Escaneo de secretos en el repositorio | No existe |

### Las dos que más rinden

**Auditoría en CI.** Una línea:

```yaml
- run: yarn npm audit --recursive --severity high
```

Falla solo con severidad alta o crítica, así que la moderada actual no bloquea.
Detecta la próxima antes de que llegue a producción.

**Escaneo de secretos.** El proyecto ya tiene una defensa fuerte en
`generate-env.mjs` —que impide que un secreto llegue al **paquete**— pero nada
impide que alguien confirme un `.env` real por accidente. `.gitignore` lo cubre;
un escáner cubriría el resto.

## Reglas al agregar una dependencia

Con diez dependencias en ejecución, agregar la undécima es una decisión, no un
trámite:

1. **¿Se puede escribir en el repositorio?** Con 48 componentes propios, la
   respuesta suele ser sí.
2. **¿Cuánto pesa?** El presupuesto inicial ya está 16,70 kB por encima del
   aviso.
3. **¿Qué arrastra?** Una dependencia con veinte transitivas es veinte
   superficies nuevas.
4. **¿Está mantenida?** Última publicación, número de mantenedores, respuesta a
   incidencias.
5. **¿Es de ejecución o de desarrollo?** Una `devDependency` no llega al
   navegador — como la vulnerabilidad actual.
6. **¿Hace peticiones de red?** Una dependencia que llame a un CDN rompe la
   propiedad de «cero terceros».

La sexta es la más fácil de pasar por alto y la que peor consecuencia tiene en
este dominio.

## Seguimiento

| Qué | Cuándo |
|---|---|
| `yarn npm audit --recursive` | Antes de cada entrega, y hoy a mano |
| Revisar `@hono/node-server` | En la próxima subida de `@angular/cli` |
| Revisar el par no satisfecho | Ídem |
| Actualizar Angular | Fuera del alcance de este trabajo |

Registrado en [la línea base](../reports/baseline.md#43--vulnerabilidad-moderada-en-una-transitiva-de-desarrollo)
y en [el análisis de brechas](../reports/documentation-gap-analysis.md).
