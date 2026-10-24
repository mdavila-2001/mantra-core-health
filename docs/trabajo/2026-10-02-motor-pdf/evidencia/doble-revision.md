# Doble revisión de los PDF descargados desde la maqueta

Los tres archivos los bajó Playwright (`pdf-motor.spec.ts`, 3/3 PASS, un worker) contra
`ng serve` en `:4260`, sesión `mockup`. Página 1 de cada uno rasterizada con `sips`
(`*-p1.png`); las páginas 2–5 de la historia, miradas en el visor del navegador integrado
a resolución de miniatura (el visor no amplía regiones): se comprobó estructura y
continuidad, no el detalle tipográfico de esas páginas.

## Primera pasada — verificación contra el criterio

| Archivo | Criterio | Resultado |
|---|---|---|
| `balance-de-sumas-y-saldos.pdf` | Trae la tabla (cabecera + 22 filas) y **no** «Exportar a PDF», «Seleccionar las filas visibles», «Ver el detalle de la fila» ni flechas | ✔ tabla completa; ninguno de los cuatro textos |
| | Columnas numéricas (Código, Debe, Haber, Saldo) a la derecha; «Cuenta» a la izquierda | ✔ |
| | Fuentes Poppins/Inter embebidas (`FontName /Poppins`, `/Inter`) | ✔ |
| | Filigrana abajo a la derecha sin tocar la tabla; «Página 1 de 1» | ✔ |
| `receta-oficial-mock.pdf` | Es el documento de receta del motor, no «Receta oficial <uuid>» | ✔ membrete, paciente/profesional, emisión, diagnóstico, tabla de medicamentos, indicaciones |
| | Diagnóstico vinculado («Hipertensión arterial esencial») y no «Sin indicación registrada» | ✔ |
| `historia-completa.pdf` | 5 páginas numeradas «de 5», membrete corto en las de continuación | ✔ |
| | Etiquetas largas sin pisar el valor | ✔ tras H3.M8 (antes: «HIPERTENSIÓN ARTERIAL ESENCIAL» sobre «Activa») |

## Segunda pasada — adversarial

Postura: encontrar por qué **no** se puede entregar.

| # | Hallazgo | Severidad | Qué se hizo |
|---|---|---|---|
| 1 | Balance (1.ª descarga): el `h2` de la pantalla se repetía como sección bajo el título | MAYOR | Corregido (H1.M4, `sinElTituloRepetido`) y re-descargado: una sola vez |
| 2 | Historia (1.ª descarga): etiquetas de diagnóstico/medicamento desbordaban la columna y pisaban el valor | BLOQUEANTE | Corregido (H3.M8, `partirEtiqueta`) y re-descargado: parten en 2 líneas dentro de la columna |
| 3 | Balance: cifras sin separador de miles («122880.00») | MENOR | **No es del motor**: es el texto que la pantalla pone en la celda. Anotado, fuera de alcance |
| 4 | Balance: el bloque de firma y sello sale en un informe contable | MENOR | Comportamiento preexistente del branding (firma de la sesión en todo documento). Anotado; decidir con el propietario si los informes contables llevan firma |
| 5 | Historia: observaciones con unidad «mg» para talla/peso/temperatura («158 mg») | MENOR | **Datos del mock**, no del motor. Anotado |
| 6 | Receta: la fila única de la tabla sin cebra (es impar=0) | — | Correcto por diseño |
| 7 | Vigencia de la receta a la derecha aunque no sea numérica | — | Es la última columna con su ancho preferido al final del ancho útil; alineación izquierda. Correcto |

## Nota por pantalla

| Archivo | Nota |
|---|---|
| `balance-de-sumas-y-saldos.pdf` | **APROBADA** (hallazgos 3 y 4 anotados, no son del motor) |
| `receta-oficial-mock.pdf` | **APROBADA** |
| `historia-completa.pdf` | **ACEPTABLE CON RESERVAS** — página 1 revisada en detalle; páginas 2–5 sólo a resolución de miniatura |

Peldaño visual: **VERIFIED** para balance y receta; **VERIFIED_FUNCTIONAL_ONLY** para las páginas 2–5 de la historia.
