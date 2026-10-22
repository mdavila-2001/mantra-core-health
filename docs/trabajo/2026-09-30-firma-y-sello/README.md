# Firma y sello médicos — evidencia (2026-09-30)

Cuenta `medica@alovida.mock` contra el simulador de `mockup`. Son **imágenes**
(la firma manuscrita escaneada y el sello), **no una firma electrónica**.

| Archivo | Qué prueba |
|---|---|
| `ficha-con-firma-y-sello.png`, `…-nuevos.png`, `ficha-sin-firma-ni-sello.png`, `…-390.png` | «Datos personales» de la ficha: firma (caja 3:1) y sello (caja 1:1), con «Sin firma» / «Sin sello» si faltan. De lectura: no hay control de subida |
| `editor-con-firma-y-sello.png`, `…-nuevos.png`, `editor-sin-firma-ni-sello.png` | El editor, arriba de «Datos personales»: subir, cambiar, quitar, con vista previa. Se guarda con «Guardar cambios» |
| `pdf-con-firma-y-sello(-nuevos).pdf` / `pdf-sin-firma-ni-sello.pdf` (+ `-p1.png`) | PDF real descargado desde Contabilidad: al pie de la última página, firma y sello al lado, línea, nombre y matrícula. Sin imágenes, la línea queda vacía y el nombre y la matrícula siguen |
| `alta-paso-firma-y-sello-vacio.png`, `…-cargados.png`, `alta-terminada.png` | El alta del doctor: paso opcional «Tu firma y tu sello», con las dos cajas vacías, con las dos imágenes, y el alta terminada |

`playwright/firma-y-sello.spec.ts` genera todo esto
(`E2E_BASE_URL=… yarn pw --workers=1 playwright/firma-y-sello.spec.ts`). Son tres
pruebas: el perfil y el PDF (con, con nuevos y sin), el alta con el paso cargado y
el alta saltándolo.

Límites honestos:
- En el alta el navegador no puede ver lo que el simulador hace con las imágenes
  (corre dentro de Angular, no por red). Lo que viaja en el cuerpo y cómo se
  guarda bajo el perfil recién creado lo prueban `register-practitioner.spec.ts` y
  `firma-y-sello.handlers.spec.ts`; el E2E prueba la pantalla y que el alta termina.
- El simulador pierde los bytes de un archivo subido al recargar (F5): los E2E
  navegan dentro de la SPA.
- El PDF oficial de la receta que arma la API (pdfkit) no lleva el bloque: ver
  `docs/pendientes-backend-perfil-profesional.md`.
