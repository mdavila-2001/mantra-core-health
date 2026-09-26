# Decisiones — H1 front (BR-04, BR-05, BR-20)

Las decisiones de fondo están en `mantra-core-health-api/docs/progress/DECISIONS.md` de la rama gemela. Acá, lo que
decide el front:

- **D-I (cookie):** interruptor de despliegue `PUBLIC_REFRESH_COOKIE` (público, booleano; excepción declarada al
  filtro de nombres de `generate-env.mjs`). Apagado por defecto; se enciende **con** `AUTH_REFRESH_COOKIE_ENABLED` de
  la API. En modo cookie el refresh no se guarda: sólo la marca no secreta `mantra.session`.
- **TX-11:** se retira `ownTenantId`. La organización elegida se recuerda por persona (`<userId>|<tenantId>`) y
  sobrevive al cierre de sesión (es una preferencia atada a la persona, no un secreto). `mantra.selected-tenant` es la
  única clave `mantra.*` que queda tras cerrar sesión.
- **TX-30:** sólo 400/401 descartan el refresh guardado; sin red, 429 y 5xx lo conservan, se reintenta una vez y se
  restaura al volver `online`.
- **TX-15:** `SessionStore.roles` pasa a ser **efectivo** (regla de `RolesGuard`); todas las pantallas y guards que
  leen `roles()` lo heredan. La autoridad sigue siendo la API.
- **TX-31:** la respuesta automática ya se lee y escribe en la API (`community`); lo local (copia, plantillas del
  médico, tarifarios) se olvida al cerrar sesión vía `SESSION_CLEANERS` (import perezoso, para no engordar el bundle
  inicial, que está en el límite de 1,30 MB).
- **Seguridad de la cuenta:** se entra por el menú de la cuenta del encabezado, **no** por el menú lateral: agregarla
  ahí devolvía «Mi cuenta» al médico, y esa desaparición es a propósito (spec existente).
- **Consentimiento informado:** vive dentro de la casilla «Formulario clínico» de la consulta: la rejilla conserva
  sus diez posibilidades (pedido del propietario, spec existente).
- **Emergencia:** el botón sólo se ofrece ante el 403 del expediente a quien tiene `CLINICAL_APPROVER` o
  `SECURITY_ADMIN`; justificación obligatoria de 10+ caracteres (`confirmWithReason`).
- **`features/alovida/accesos/` (maquetas):** quedan fuera del menú; las reemplazan «Mi privacidad» y «Quién ve mi
  historia».
- **Test reescrito con causa:** `asks for the signed url only when the file is actually opened` exigía la URL firmada
  y `window.open`; el requisito cambió (CL-40), así que ahora exige la lectura por la ruta del resultado y que **no**
  se pida ninguna URL firmada.
