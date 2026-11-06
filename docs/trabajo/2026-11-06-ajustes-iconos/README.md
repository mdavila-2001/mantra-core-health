# Ajustes: un mismo renglón con ícono en todas las pestañas (06/11/2026)

Pedido: que las opciones de Ajustes se vean como «Permisos» —ícono a la izquierda que dice de qué
trata, título y detalle en el medio, control a la derecha—.

| Pestaña | Íconos |
|---|---|
| Avisos | los de cada categoría (ya existían, pasan a la izquierda), `monitor` en este navegador, `moon` en silencio nocturno |
| Chats | `clock` no responder, `chat` mensaje fijo, `moon` fuera de horario, `note` cada frase guardada |
| Agenda | `calendar` por agenda |
| Apariencia | `moon` en modo oscuro |
| Permisos | sin cambio en los permisos; `shield` en roles, `lock` en acceso a la historia |
| Dispositivos | `phone` para iOS/Android, `monitor` para el resto; el botón de verificar a la derecha |
| Tutoriales | `teach`, con el botón dentro del renglón |
| Identidad | `check-circle` verificar, `folder` mis verificaciones |

## Evidencia

Capturas del panel de cada pestaña en `evidencia/`, con `ng serve --configuration development,demo`
y la cuenta simulada `paciente@alovida.mock`, a 1280 y 390 px. En ambos anchos
`document.documentElement.scrollWidth` igual al viewport (sin desborde) y sin errores de página.
Agenda e Identidad no se capturaron (la cuenta paciente no las ve); quedan cubiertas por las
pruebas unitarias.
