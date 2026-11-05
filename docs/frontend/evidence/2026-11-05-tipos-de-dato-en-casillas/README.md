# Tipos de dato en las casillas de las altas — evidencia

Cambio: catálogo `shared/forms/field-kinds.ts` aplicado a todas las altas
(paciente, profesional, personal de apoyo, laboratorio, farmacia, imagenología,
centro médico, organización y altas asistidas del admin).

## Cómo se obtuvo

- `ng serve --configuration development,demo` (maqueta en memoria, nada se envía).
- `npx playwright test playwright/tipos-de-dato-en-casillas.spec.ts --workers=1`,
  Chromium del entorno, 1280 px de ancho. Resultado: **2 pasadas, 0 fallidas**.
- Se teclea carácter por carácter (`pressSequentially`), como una persona.

## Qué muestra cada captura

| Captura | Qué se tecleó | Qué quedó |
|---|---|---|
| `paciente-identidad-filtrada.png` | `María2 José*`, `De la Quintana9`, `D'Angelo-Rojas!`, `541984844*///*/*/ ñ` | `María José`, `De la Quintana`, `D'Angelo-Rojas`, `541984844` |
| `laboratorio-nit-filtrado.png` | NIT `1023456789abc .*` | `1023456789` |
| `laboratorio-representante-filtrado.png` | nombre `holaLTAD123`, documento `541984844*///*/*/ SC`, correo `ojpiojk mkl562651561--..(1)+.+@lab` | `holaLTAD`, `541984844 SC`, `ojpiojkmkl562651561-1@lab` en rojo con «Escriba un correo válido: es el usuario de la cuenta.» |

## Lo que no se ejecutó

- Las altas de farmacia, imagenología, centro médico, organización y personal
  de apoyo no tienen recorrido de navegador propio en este cambio: montan los
  mismos `app-input`, `app-inline-name-fields` y motor de formularios, y sus
  specs unitarios pasan.
- Sin revisión visual independiente (`visual-reviewer`) todavía: quien
  implementa no aprueba.
