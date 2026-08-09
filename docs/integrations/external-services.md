# Servicios externos

**La API REDESA es la única integración del frontend.** Esta página lo verifica y
enumera lo que no hay.

---

## El inventario, completo

| Servicio | Estado | Evidencia |
|---|---|---|
| **API REDESA** | **Única integración.** 20 operaciones | `core/data-access/**` |
| Correo electrónico | **Indirecta.** Lo envía la API; el enlace vuelve al frontend con un token | `/auth/verificar`, `/auth/nueva-clave` |
| Todo lo demás | **No existe** | Ver abajo |

## Lo que no hay

| Categoría | Estado |
|---|---|
| CDN de terceros | No. **Las tipografías están autoalojadas** (`@fontsource*`) |
| Analítica | No — ver [analítica](analytics.md) |
| Captura de errores (Sentry, Rollbar, …) | No — ver [reporte de errores](../observability/error-reporting.md) |
| Pagos | No |
| Mapas | No |
| Chat / soporte en vivo | No |
| Autenticación de terceros (Google, Apple, SSO) | No. Solo credenciales propias contra la API |
| Almacenamiento directo (S3 presignado) | No. La subida pasa por la API |
| Envío de correo desde el cliente | No, y no debería |
| Firma electrónica | No |
| Videollamada | No |
| Traducción automática | No |
| Banderas de funcionalidad remotas | No |

## Cómo se verifica

```bash
# Toda petición de red sale de core/data-access/
grep -rn "this\.http\|HttpClient\|fetch(\|XMLHttpRequest" src/app --include="*.ts" | grep -v "core/data-access"
# → solo app.config.ts, que registra el proveedor

# Ningún script de terceros
grep -n "<script" src/index.html
# → uno solo: el anti-parpadeo del tema, propio y en línea

# Ninguna URL absoluta a un dominio ajeno
grep -rn "https\?://" src/app --include="*.ts" --include="*.html" | grep -v "angular.dev\|localhost"
```

`scripts/check-architecture.mjs` automatiza la primera comprobación y falla si
aparece un `this.http` fuera de `core/data-access/`.

## Las diez dependencias externas

Todas de Angular o de su cadena de arranque:

```text
@angular/core (185)   @angular/common (51)    @angular/router (34)
@angular/forms (14)   rxjs (10)               @angular/platform-browser (4)
@angular/ssr (3)      express (1)             node:path (1)
node:fs (12)          ← solo en archivos de prueba
```

**Ninguna biblioteca de interfaz, de estado, de fechas, de utilidades ni de
validación.** Los 48 componentes están escritos en el repositorio.

## Por qué esto importa

Una superficie externa mínima tiene cuatro consecuencias medibles:

| Aspecto | Consecuencia |
|---|---|
| **Privacidad** | Ningún tercero ve la IP ni el comportamiento de los usuarios. En salud, hasta la visita a una sección puede revelar una condición |
| **Seguridad** | La única vulnerabilidad del árbol es de desarrollo, transitiva de `@angular/cli`, y no llega al navegador |
| **Rendimiento** | Cero peticiones y cero JavaScript de terceros bloqueando la carga |
| **Mantenimiento** | Ninguna dependencia externa que pueda quedar sin soporte o cambiar su API |

**No es un accidente y no debería perderse sin decisión explícita.** Cada
servicio externo que se agregue mueve las cuatro filas en la misma dirección.

## Si hay que agregar uno

Cinco preguntas que responder antes de instalar nada:

1. **¿Qué datos ve el tercero?** En un sistema de salud, la respuesta correcta a
   menudo es «ninguno», y eso descarta la mitad de las opciones.
2. **¿Se puede autoalojar?** Es lo que se hizo con las tipografías, y por eso hoy
   no hay una petición a Google Fonts.
3. **¿Qué pasa si el servicio no responde?** Un script de terceros que no carga
   no puede romper la aplicación.
4. **¿Cuánto pesa?** El presupuesto inicial ya está 16,70 kB por encima del
   umbral de aviso.
5. **¿Cabe en una CSP?** No hay CSP todavía, pero cuando la haya, cada dominio
   externo es una excepción que declarar. Ver
   [CSP](../security/content-security-policy.md).

## La coordinación con el correo

Es la única integración indirecta, y **no está documentada en ninguno de los dos
repositorios**:

```text
API → correo → enlace → frontend
      /auth/verificar?token=…
      /auth/nueva-clave?token=…
```

**La API arma la URL**, así que el dominio del enlace tiene que coincidir con
dónde está desplegado el frontend. Si no coinciden, las dos landings no se
alcanzan y el registro y la recuperación quedan a medias.

Es una dependencia de configuración entre repositorios sin dueño declarado.
Registrada como brecha `HIGH` en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
