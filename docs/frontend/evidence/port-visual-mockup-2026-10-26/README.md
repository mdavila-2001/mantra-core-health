# Port visual de `mockup` a `dev` y `test` (26/10/2026)

## Cómo se midió

Las dos ramas se levantaron con **el mismo backend simulado** (`mockBackend`, `demoPresets` y
`designMockups` encendidos sólo en local, sin commitear) y se fotografió cada pantalla del
catálogo `docs/reports/generated/rutas.json`, más las públicas, a 1440 px, con las cuentas
`*@alovida.mock` que corresponden a cada ruta.

Resultado del barrido: **370 pantallas**. 146 iguales (<1 % de píxeles distintos), 144 con
diferencias leves y 80 claramente distintas. Las 101 que pasan del 3 % se revisaron a ojo:
en la mayoría `dev` va por delante o sólo cambian los datos simulados.

No se pudo entrar con `imagen@alovida.mock` en ninguna rama, ni con laboratorio, farmacia y
visitador en `mockup`: sus pantallas quedan sin comparar.

## Lo que `mockup` tiene y `dev` no

| # | Qué | Dónde | Estado |
| --- | --- | --- | --- |
| 1 | Barra de avance «latido» (ECG) sobre el paso a paso de todos los asistentes | `paginated-form`, `progress` | Franja 1 (PR #1465 / #1466) |
| 2 | Sello animado del tipo de cuenta en la cabecera de cada alta, ayuda en beige, tarjeta con borde | `features/auth` | **Franja 2** (este PR) |
| 3 | «Crear cuenta» separado de «Registre su organización» (`/auth/register/organization-type`) | `register-account-type`, rutas, login | **Franja 2** (este PR) |
| 4 | Íconos a la izquierda de los campos (cuestionarios, alta de paciente, plantillas, permisos) | formularios | Pendiente |
| 5 | Pestaña «Flujo de dinero» y textos nuevos en Contabilidad | `features/accounting` | Pendiente |
| 6 | Citas como tarjetas con franja de color; «Abrir sesión y ver pago» | agenda, mis citas | Pendiente |
| 7 | Directorio de médicos: filtros laterales, contador, orden, grilla/lista | `/directory` | Pendiente |
| 8 | Catálogo de formularios estándar en el constructor | `/form-builder` | Pendiente |
| 9 | Glosario: vista Tarjetas/Tabla; tabla de créditos del atlas | `features/glossary` | Pendiente |
| 10 | Insignias «Verificado» verdes; panel de la médica con tonos cálidos; textos de proveedores de identidad | varios | Pendiente |

Lo que **no** se porta: el backend simulado (`core/mock`) y lo que en `mockup` manda datos nuevos
a la API (p. ej. «dónde estudió cada especialidad» en el alta del médico), que necesita backend.

## Franja 2 — evidencia

Cada imagen: **izquierda `mockup` · centro `dev` antes · derecha esta rama**.

- `franja2_auth_register.jpg` — «Crear cuenta» con las cuentas de persona.
- `franja2_auth_register_laboratory.jpg`, `_pharmacy`, `_practitioner`, `_patient`,
  `_medical-center` — sello en la cabecera, línea ECG y ayuda en beige.
