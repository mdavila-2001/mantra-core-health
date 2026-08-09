# Privacidad

Un sistema de salud maneja información sensible por definición. Este frontend
**hoy no muestra ningún dato clínico**, y esa es la razón por la que muchas
preguntas de esta página todavía no tienen que responderse.

---

## Qué datos personales toca hoy

| Dato | Dónde aparece | Persiste |
|---|---|---|
| Identificador de usuario (`sub`) | Panel, tarjeta de sesión | No |
| Nombre para mostrar (`name`) | Encabezado del armazón | No |
| Roles (`roles[]`) | Panel | No |
| Organizaciones (`tenants[]`, `tenantNames`) | Panel, selector | No |
| Documento de identidad | Formularios de login y registro | **No.** Solo en el campo |
| Correo electrónico | Formularios | No |
| Fecha de nacimiento | Registro (opcional) | No |
| **Datos clínicos (PHI)** | **Ninguno todavía** | — |

**Todo lo que se muestra sale del token.** No hay ninguna petición que traiga
datos personales: la única lectura de la API es el directorio público, que por
definición no transporta PHI.

## Lo que este frontend hace bien, y conviene no perder

### Cero terceros

Ningún script externo, ninguna analítica, ningún CDN. **Las tipografías están
autoalojadas**, así que ni Google ve la IP de los visitantes.

En salud eso importa más que en otros dominios: **el tráfico ya es
información**. Que alguien visite una sección de oncología es un dato de salud
aunque no lleve su nombre.

### Cero PHI persistida

`localStorage` tiene dos claves: un token y una preferencia de tema. Ningún dato
clínico sobrevive al cierre de la pestaña.

### S6 no filtra existencia

```ts
case 'NOT_FOUND':
  return notFound();   // se descartan message y details
```

> *«El backend puede incluir el identificador buscado, y repetirlo en pantalla
> confirmaría que la persona consultó por algo concreto.»*

Y `NotFoundViewState` **no tiene campos de datos**: no se puede construir uno que
filtre. Es una regla de privacidad codificada en un tipo.

### La recuperación no enumera cuentas

El acuse es **idéntico exista o no la cuenta**. Decir «ese correo no está
registrado» convertiría la pantalla en una forma de averiguar quién tiene cuenta.

Lo mismo con la verificación de correo: todos los fallos se cuentan igual.

### Registros de consola sin datos

Dos `console.warn` en todo el proyecto:

```ts
'[terminology] El conjunto … tiene más de … opciones: se devuelven las recorridas hasta acá.'
'[app-button] iconOnly sin nombre accesible: agregá aria-label al <button>.'
```

Ninguno lleva datos personales. El segundo solo corre en desarrollo.

### El identificador de soporte no es un dato personal

S9 muestra el `requestId`, no el identificador del usuario ni el del recurso. Es
lo justo para correlacionar sin revelar nada.

## Riesgos de privacidad

### 1 · Sin `Referrer-Policy` · `MEDIUM`

Una navegación a un sitio externo puede filtrar la URL de origen en la cabecera
`Referer`. Hoy ninguna URL lleva identificadores —no hay parámetros de ruta— pero
**cuando los haya** (`/pacientes/:id`), el riesgo es real.

**Mitigación parcial ya presente:** `app-link` pone `rel="noopener noreferrer"`
en todo enlace externo, y `noreferrer` suprime la cabecera. Falta la política
global para todo lo demás.

### 2 · Sin telemetría, y eso es un arma de doble filo · —

**A favor:** no se envía nada a ningún lado.
**En contra:** no se puede detectar un incidente ni medir nada.

Cuando se decida agregarla, la discusión de privacidad va **antes** de la
elección de herramienta. Ver
[eventos analíticos](../observability/analytics-events.md).

### 3 · Sin banner de consentimiento, y hoy no hace falta · —

No se recogen datos con fines de análisis, así que no hay nada que consentir. La
única persistencia son un token de sesión —estrictamente necesario— y una
preferencia de interfaz.

**Esto cambia el día que se agregue analítica.**

### 4 · Sin política de retención · `LOW`

No hay nada que retener en el cliente. Cuando haya caché o telemetría, habrá que
definirla.

## Reglas para cuando aparezca PHI

Las pantallas clínicas no existen todavía. Cuando existan:

1. **Nada de PHI en `localStorage` ni en `IndexedDB`.** Sobreviven al cierre de
   sesión.
2. **Nada de PHI en registros**, ni en `console`, ni en telemetría, ni en
   mensajes de error.
3. **Nada de PHI en la URL.** Queda en el historial, en el `Referer` y en los
   registros del servidor. Un identificador opaco es aceptable; un nombre o un
   documento, no.
4. **Nada de PHI en capturas de pantalla documentales.** Ni siquiera de datos de
   prueba que parezcan reales.
5. **Toda caché de PHI, en memoria y vaciada al cerrar sesión y al cambiar de
   organización.**
6. **`sensitivity: 'PHI'` en toda subida de archivo clínico.** El parámetro ya es
   obligatorio en `FilesClient.upload`.
7. **Cifras tabulares en los datos clínicos** — no es privacidad, es lectura
   segura, y está en el mismo lugar de las reglas.
8. **`--text-muted` jamás en información clínica** (excepciones E1/E2).

Las reglas 5 y 6 son las que el código ya prepara; las demás son disciplina que
habrá que sostener.

## Datos en pruebas y documentación

| Regla | Estado |
|---|---|
| Las pruebas usan datos sintéticos | ✅ verificado: sin llamadas a servicios reales |
| La documentación no muestra tokens ni credenciales | ✅ |
| No hay capturas con datos personales | ✅ — no hay capturas |
| Las credenciales de demostración viven fuera de este repositorio | ✅ están en el `.env` de la API |

## Marco normativo

**No está declarado en ningún documento del proyecto** qué normativa aplica
(HIPAA, GDPR, la ley boliviana de protección de datos, o el marco contractual de
REDESA).

Sin eso, esta página describe buenas prácticas pero **no puede afirmar
cumplimiento**. Es una limitación real y está registrada como brecha `MEDIUM` en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

Es una definición que corresponde al proyecto, no a este repositorio, y hace
falta antes de la primera pantalla con PHI.
