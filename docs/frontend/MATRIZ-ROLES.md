# Matriz de regresión por rol

**Corrida:** 2026-09-08 · **Rama:** `mockup` · **2220 mediciones**
5 cuentas × 222 rutas × 2 viewports (390 y 1440), 14,5 min.
**Herramienta:** `yarn pw playwright/fable-matriz-roles.spec.ts`
**Datos crudos:** `evidence/roles/matriz-roles.json`

---

## Por qué esta matriz y no sólo la global

La matriz global mide con una cuenta y responde «¿la pantalla pinta?». Ésta
responde la que importa después: **¿cada rol llega a lo suyo, y sólo a lo suyo?**

La distinción que la hace útil: **un redirect no es un defecto si el rol no
tiene el permiso** — es el guardia funcionando. Sólo es defecto cuando el rol
sí figura habilitado y aun así no entra. Sin esa clasificación habría 492
falsos positivos.

## Resultado

| Veredicto | Cantidad |
|---|---:|
| `OK` | 1661 |
| `GUARDIA-OK` (redirect correcto) | 492 |
| `REDIRIGE-INESPERADO` | 24 |
| `ENTRA-SIN-PERMISO` | 42 |
| `DESBORDE` | 1 |

| Cuenta | OK | Guardia OK | Redirige inesperado | Entra sin permiso |
|---|---:|---:|---:|---:|
| `admin@alovida.mock` | 431 | 6 | 6 | 0 |
| `medica@alovida.mock` | 284 | 154 | 4 | 2 |
| `paciente@alovida.mock` | 270 | 164 | 8 | 2 |
| `superadmin@alovida.mock` | 406 | 2 | 0 | 36 |
| `visitador@alovida.mock` | 270 | 166 | 6 | 2 |

## `/directory`: resuelto, no era un defecto

La observación que quedó abierta desde la Wave 0 se cierra con dato:

| Cuenta | Habilitado | Termina en | Veredicto |
|---|---|---|---|
| `paciente@` | sí | `/directory` | **OK** |
| `medica@`, `admin@`, `superadmin@`, `visitador@` | no | `/dashboard` | `GUARDIA-OK` |

El catálogo la declara `roles: ["PATIENT"], rolesExclusivos: true`. El redirect
**era el guardia funcionando**. La matriz de un solo rol no podía distinguirlo.

## Hallazgos abiertos

### 1 · Desborde de 51 px, confirmado

`/administration/medical-laboratory`, cuenta `admin@`, 390 px:
`scrollWidth 441` contra `clientWidth 390`, **reproducible 5 de 5**.

Aparece con `admin@` y no con `superadmin@` aunque ambos tengan
`SECURITY_ADMIN`: `admin@` suma 13 roles más y la pantalla le muestra más
contenido. **La matriz de un solo rol nunca lo habría visto.**

Culpable sin aislar. Un barrido por elementos no lo encontró, y el barrido
tiene un defecto de método conocido: el `overflow` de un ancestro **no recorta**
a un descendiente `position: fixed`, así que descarta candidatos válidos. El
paso siguiente es un bisect ocultando ramas del DOM, no otra heurística.

### 2 · 12 pares rol-ruta que redirigen estando habilitados

| Cuenta | Ruta |
|---|---|
| `admin` | `/my-account/articles` |
| `admin` | `/my-account/edit` |
| `admin` | `/my-account/preview` |
| `medica` | `/my-account/appointments` |
| `medica` | `/my-account/medical-record` |
| `paciente` | `/glossary` |
| `paciente` | `/my-account/articles` |
| `paciente` | `/my-account/edit` |
| `paciente` | `/my-account/preview` |
| `visitador` | `/my-account/articles` |
| `visitador` | `/my-account/edit` |
| `visitador` | `/my-account/preview` |

**Ojo antes de llamarlos defectos.** `habilitado` se calcula desde el campo
`roles` del catálogo: si está vacío, cualquiera figura habilitado. Estas rutas
pueden estar gobernadas por otra condición legítima —tener perfil público,
haber completado el onboarding— que el catálogo no declara. Distinguirlo exige
leer el guardia de cada ruta, no medir más.

### 3 · 21 rutas donde se entra sin figurar habilitado

18 son de `superadmin@`, que casi con seguridad tiene paso implícito por el rol
`SUPERADMIN`; eso es diseño, no agujero.

Las otras 3 sí merecen mirada: `paciente@`, `medica@` y `visitador@` entran a
`/administration/patients/assisted-registration`. **La autoridad es la API**, y
que la pantalla pinte no significa que los datos se entreguen — pero una ruta de
administración que abre para un paciente es, como mínimo, una discoverability
que nadie eligió.

## Lo que sigue sin medir

Interacción, los nueve estados M34, mutaciones y las 10 rutas parametrizadas.
Eso no es medición: es criterio, y necesita a alguien que sepa qué tiene que
pasar en cada pantalla.
