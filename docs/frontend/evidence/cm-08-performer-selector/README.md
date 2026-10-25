# Evidencia — selector de ejecutor en la orden de procedimiento

Base: `mockup`. Recorrido en el navegador con `medica@alovida.mock`: expediente de la paciente de ejemplo →
Consulta → «Formulario clínico» → «Laboratorio e imagenología» → tipo **Procedimiento**.

La maqueta responde dentro de la app (un interceptor), así que no hay pestaña de red: el cuerpo de cada
`POST /clinical/service-requests` se copió de la consola, con un `console.info` **local** en el handler de la
maqueta (no está en el commit). Sin datos clínicos: sólo uuids de la maqueta.

Las lecturas de sedes (`GET /practitioners/me/role-assignments` con `serviceConceptId` y `statusCode`, y
`GET /medical-centers/search`) se respondieron con dobles **locales**, porque la maqueta todavía no trae esas
rutas. Hay que repetir este recorrido cuando las tenga y contra la API real.

## Recorrido

| Paso | Resultado | Captura |
|---|---|---|
| Con tipo Laboratorio | el selector no se monta | — |
| Con tipo Procedimiento | «Que elija el paciente» marcada; se lee «Es una recomendación. Su paciente puede elegir otro lugar.» | `*-1-abierto-por-defecto.png` |
| Emitir por defecto | cuerpo sin médico ni sede | `*-2-emitido-por-defecto.png` |
| «En este centro», sin sede | «Pedir estudio» deshabilitado; sedes en el orden recibido (Norte, Los Olivos, Sur) | `*-3-en-este-centro-sin-sede.png` |
| «En este centro», con sede | cuerpo con el concepto `ORGANIZATION` y la sede, sin médico | `*-4-en-este-centro-con-sede.png` |
| «Lo hago yo» con sede propia | sólo la sede activa que ofrece el procedimiento; cuerpo con médico y sede | `*-5-lo-hago-yo-con-sede.png` |
| «Lo hago yo» sin sede propia | deshabilitada, con el motivo «No tiene una sede activa que publique este procedimiento con precio» | `*-6-lo-hago-yo-deshabilitada-con-motivo.png` |

Viewports: 390x844, 768x1024, 1024x768, 1440x900 y 1920x1080 en claro; 390x844 y 1440x900 también en oscuro.
Prefijo de cada captura: `<ancho>x<alto>-<tema>`. Cuerpos completos: `*-post-bodies.json`.

## Campos que viajan por modo (1440x900, claro)

**Que elija el paciente**
```json
{
  "performerSelectionConceptId": "f65da5a1-7ec8-47d5-a41f-d65461b2eac6"
}
```

**En este centro**
```json
{
  "performerSelectionConceptId": "0474f3bf-19d5-45c5-a3fe-b9e6bb9d85d4",
  "suggestedPracticeSiteId": "1293b757-9c2c-466f-ac0f-89f8718574b6"
}
```

**Lo hago yo**
```json
{
  "performerSelectionConceptId": "f511135a-3b49-43de-a85b-0bc4e4f60518",
  "performerPractitionerProfileId": "be0f3a66-c03e-4eac-a416-c1068238d3d2",
  "suggestedPracticeSiteId": "1293b757-9c2c-466f-ac0f-89f8718574b6"
}
```

Los tres cuerpos: ninguno lleva `performerTenantId`.

## Sin cubrir

- «Mis órdenes» del paciente trae el modo: depende de que la maqueta guarde los tres campos nuevos, que todavía no lo hace.
- Un 422 real de la API: sólo cubierto por spec, no en el navegador.
- API real (puerto `dev`): no corrió.
