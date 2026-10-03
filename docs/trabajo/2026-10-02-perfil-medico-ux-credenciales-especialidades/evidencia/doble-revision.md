# Doble revisión visual — Hito 1

## P1 cerrada — diagnóstico, NO entrega final
Revisor: agente principal. Cada archivo fue abierto como imagen. Capturas de build intermedio, datos sintéticos. Estos estados se conservan para explicar fallos; no acreditan una pantalla aprobada.

| Captura en diagnostico/ | P1 | Hallazgo |
|---|---|---|
| compilacion-overlay.png | RECHAZADA | Superposición de compilación por helper fecha ausente, corregido. |
| pending-summary.png | RECHAZADA | 12 pendientes se contaban como verificados; fuente null no prueba aprobación. |
| listados-390x844-claro-credenciales.png | RECHAZADA | Título y encabezado partidos en mitad de palabra; estado largo domina el ancho. |
| listados-390x844-claro-trayectoria.png | RECHAZADA | Aviso informativo tapa contenido; se debe cerrar antes de capturar. |
| datos-propios-390x844-claro.png | RECHAZADA | Aviso tapa datos. Catálogo heredado muestra etiquetas de idioma en inglés. |
| editor-selector.png | ACEPTABLE CON RESERVAS | Ancho correcto; aviso informativo visible. Falló selector duplicado del test, no el control. |
| missing-api.png | ACEPTABLE CON RESERVAS | Editor visible; red tiene 404 de dos auxiliares no implementados. |

P2 de diagnóstico: [diagnostic-second-review.md](./diagnostic-second-review.md), cerrada para las siete capturas iniciales. P1 adicional cerrada: modal-tab-boundary.png, ACEPTABLE CON RESERVAS; geometría correcta, foco en frontera nativa de Chromium analizado con reproducción aislada (native-dialog-focus.txt). P2 adicional pendiente. La matriz final se revisará de nuevo después del último build y del recorrido aislado etiquetado.


## P1 cerrada — matriz final
Revisor: /root, 2026-10-02. Abiertas las 32 imágenes finales individualmente después del último build de producción. Recorrido propio: e2e-isolated-final.txt; público recapturado desde scroll=0: e2e-public-captures.txt. Cuatro GET auxiliares simulados explícitamente; datos del perfil y archivos reales. La matriz acredita UI aislada, no integración total.

| Captura en capturas/ | P1 | Severidad residual | Observación |
|---|---|---|---|
| cancelacion-390x844-claro.png | ACEPTABLE CON RESERVAS | LOW | Foco visible en Seguir editando; máscara cubre el viewport. FullPage incluye fondo fuera del viewport. |
| datos-propios-390x844-claro.png | ACEPTABLE CON RESERVAS | LOW | Idioma, nivel e interpretación presentes; etiquetas heredadas del catálogo en inglés. |
| listados-1024x768-claro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1024x768-claro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1024x768-oscuro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1024x768-oscuro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1440x900-claro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1440x900-claro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1440x900-oscuro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1440x900-oscuro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1920x1080-claro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1920x1080-claro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1920x1080-oscuro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-1920x1080-oscuro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-390x844-claro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-390x844-claro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-390x844-oscuro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-390x844-oscuro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-768x1024-claro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-768x1024-claro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-768x1024-oscuro-credenciales.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| listados-768x1024-oscuro-trayectoria.png | ACEPTABLE | NONE | Texto y estados legibles, grupos/paginación conservados, sin overflow; corte inferior corresponde al scroll vertical de tabla. |
| public-1024x768-claro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-1024x768-oscuro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-1440x900-claro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-1440x900-oscuro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-1920x1080-claro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-1920x1080-oscuro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-390x844-claro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-390x844-oscuro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-768x1024-claro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |
| public-768x1024-oscuro-credentials.png | ACEPTABLE CON RESERVAS | LOW | Resumen de especialidad en portada; Credenciales sólo matrícula/títulos. Etiqueta heredada del catálogo de idiomas en inglés; cabecera cabe. |

32/32 abiertas; ninguna captura final RECHAZADA en P1. El diagnóstico public-header-overflow.png tiene P1 RECHAZADA, severidad HIGH (avatar fuera de 768 px), corregido por H1.S4.M6. P2 de las dos capturas diagnósticas adicionales y de la matriz final se delega sólo tras este cierre.

## P1 cerrada — recaptura final sobre b84f74aa, 2026-10-03

Revisor: /root. Se abrieron individualmente las 32 imágenes finales después de e2e-current-base-isolated.txt (4 PASS, exit 0). JSON actual: 22 medidas propias + 10 públicas, problems=[] en ambas. La aserción pública exige una insignia y contención del sello en los diez estados.

La P1 anterior no detectó el desborde público que P2 sí encontró: aquella aceptación no cierra el hallazgo. Las imágenes rechazadas originales se preservan en diagnostico/public-specialty-overflow-{claro,oscuro}.png; final-second-review-first.md es histórico y se refiere a esas versiones anteriores, no a las recapturas actuales.

| Imagen final | Veredicto P1 | Severidad | Observación |
|---|---|---|---|
| [cancelacion-390x844-claro.png](capturas/cancelacion-390x844-claro.png) | ACEPTABLE CON RESERVAS | LOW | Diálogo, ambas decisiones y foco visibles. FullPage muestra máscara sólo en viewport nativo; catálogo de idiomas informa error recuperable en fondo (límite integración), sección ubicada en Datos personales. |
| [datos-propios-390x844-claro.png](capturas/datos-propios-390x844-claro.png) | ACEPTABLE CON RESERVAS | LOW | Idioma, nivel e interpretación presentes en Datos personales; labels heredados del catálogo en inglés. |
| [listados-1024x768-claro-credenciales.png](capturas/listados-1024x768-claro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-1024x768-claro-trayectoria.png](capturas/listados-1024x768-claro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-1024x768-oscuro-credenciales.png](capturas/listados-1024x768-oscuro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-1024x768-oscuro-trayectoria.png](capturas/listados-1024x768-oscuro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-1440x900-claro-credenciales.png](capturas/listados-1440x900-claro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-1440x900-claro-trayectoria.png](capturas/listados-1440x900-claro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-1440x900-oscuro-credenciales.png](capturas/listados-1440x900-oscuro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-1440x900-oscuro-trayectoria.png](capturas/listados-1440x900-oscuro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-1920x1080-claro-credenciales.png](capturas/listados-1920x1080-claro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-1920x1080-claro-trayectoria.png](capturas/listados-1920x1080-claro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-1920x1080-oscuro-credenciales.png](capturas/listados-1920x1080-oscuro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-1920x1080-oscuro-trayectoria.png](capturas/listados-1920x1080-oscuro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-390x844-claro-credenciales.png](capturas/listados-390x844-claro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-390x844-claro-trayectoria.png](capturas/listados-390x844-claro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-390x844-oscuro-credenciales.png](capturas/listados-390x844-oscuro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-390x844-oscuro-trayectoria.png](capturas/listados-390x844-oscuro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-768x1024-claro-credenciales.png](capturas/listados-768x1024-claro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-768x1024-claro-trayectoria.png](capturas/listados-768x1024-claro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [listados-768x1024-oscuro-credenciales.png](capturas/listados-768x1024-oscuro-credenciales.png) | APROBADA | NONE | Grupos de Credenciales, búsqueda, paginación y sellos legibles; sin overflow ni especialidades/idiomas. |
| [listados-768x1024-oscuro-trayectoria.png](capturas/listados-768x1024-oscuro-trayectoria.png) | ACEPTABLE CON RESERVAS | LOW | Actividad actual e histórica conservadas, estados/períodos separados. Tercera tabla editable carece de encabezado que explique la repetición; reserva ya existente. |
| [public-1024x768-claro-credentials.png](capturas/public-1024x768-claro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-1024x768-oscuro-credentials.png](capturas/public-1024x768-oscuro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-1440x900-claro-credentials.png](capturas/public-1440x900-claro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-1440x900-oscuro-credentials.png](capturas/public-1440x900-oscuro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-1920x1080-claro-credentials.png](capturas/public-1920x1080-claro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-1920x1080-oscuro-credentials.png](capturas/public-1920x1080-oscuro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-390x844-claro-credentials.png](capturas/public-390x844-claro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-390x844-oscuro-credentials.png](capturas/public-390x844-oscuro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-768x1024-claro-credentials.png](capturas/public-768x1024-claro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |
| [public-768x1024-oscuro-credentials.png](capturas/public-768x1024-oscuro-credentials.png) | ACEPTABLE CON RESERVAS | LOW | Especialidad/sello contenido en portada; fuera de Credenciales y sin respaldo ajeno. Idioma de catálogo en inglés; ACCIONES vacía en ancho desktop. |

Resultado P1: **10 APROBADA, 22 ACEPTABLE CON RESERVAS, 0 RECHAZADA**. Ninguna reserva acredita integración API completa. P2 independiente final todavía pendiente; no se cierra H1.S5.M4 hasta recibirla.

## P2 final cerrada

Revisor independiente: /root/review_profile_ux. [final-second-review.md](final-second-review.md): 32/32 imágenes nuevas abiertas; 10 APROBADA, 22 ACEPTABLE CON RESERVAS, 0 RECHAZADA; 50 respuestas adversariales, diez por cada uno de cinco grupos. Desborde del sello público corregido en las diez variantes. Sólo reservas LOW; el catálogo de idiomas ausente queda explícito como límite funcional de integración. El histórico P2 anterior permanece separado. **H1.S5.M4 HECHO**; no acredita H1.S5.M3 ni regresión global.
