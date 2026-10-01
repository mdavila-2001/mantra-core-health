# Formulario libre «campo y valor» y el modal que se despegaba — 28/09/2026

Rama `claude/formulario-libre-deslizable-bug-ko5n7y`, sobre `mockup` (`7dccc322`).

## 1 · El deslizable del modal

**Síntoma reportado.** En «Llenar el formulario médico» aparecían dos barras de
desplazamiento, y al rodar el modal entero subía: el pie con «Completar
formulario» quedaba flotando a mitad de pantalla.

**Causa.** El cuerpo de `app-content-dialog` no tenía ningún ancestro
posicionado. Los `span.sr-only` (1 px, `position: absolute`) de cada etiqueta
obligatoria tomaban como bloque contenedor al `<dialog>` —que es `fixed`— y
quedaban cientos de píxeles por debajo del panel. El `<dialog>`, con su
`overflow: auto` nativo, crecía hasta alcanzarlos y sacaba una segunda barra;
rodar sobre el encabezado o esa barra movía el panel.

Medido en 1025×560, tema oscuro, con la ficha cardiológica:

| | `dialog.scrollHeight` / `clientHeight` | `scrollTop` tras rodar sobre el encabezado | borde superior del panel |
|---|---|---|---|
| Antes | 1564 / 528 | 300 | −284 px ([foto](evidencia/0-antes-modal-despegado.png)) |
| Después | 528 / 528 | 0 | 16 px ([foto](evidencia/1-modal-al-fondo-sin-despegarse.png)) |

**Arreglo.** `position: relative` en `.content-dialog__cuerpo` (y en el panel,
para el encabezado y el pie). Lo afecta todo modal que use `app-content-dialog`;
los menús y tooltips usan `position: fixed`, que esto no altera.

## 2 · «Formulario libre — campo y valor»

Nueva entrada fija del selector «Qué vas a completar», detrás de «Hoja en
blanco». Son los mismos campos adicionales que cierran cualquier ficha, pero
solos:

- arranca con una fila abierta; cada fila es **campo + valor**, y el valor
  puede ser texto, **uno o varios archivos** (hasta 10 por fila, se suman en
  varias tandas) o las dos cosas; más un texto libre opcional;
- «Guardar formulario» registra una nota médica del encuentro con las filas y
  un documento por fila con archivos (mismos pasos que ya usaban los campos
  adicionales, sin pasar por `forms`);
- no lo tapa la ficha ya respondida: se puede registrar antes, después o
  varias veces; debajo muestra lo «Ya registrado en esta consulta»;
- si falla la nota no se sube nada y lo escrito se conserva; si falla un
  documento, la nota ya quedó, se vacía el formulario y se nombra lo que faltó.

De paso, el formulario deja de estar acotado a 40rem (regla 6 del cliente).

## Verificación ejecutada

- `ng test` sobre `clinical-record/**` y `content-dialog`: 28 archivos, 430/430.
  Nuevas: 3 en `additional-fields.spec.ts`, 3 en `specialty-form-block.spec.ts`
  (más el orden de entradas fijas actualizado para incluir la nueva).
- `tsc` de app y de Playwright limpio; ESLint y Prettier limpios en lo tocado
  (`content-dialog.css` y su spec ya no pasaban Prettier/ESLint en `mockup`; no
  se reformatearon).
- Playwright contra `ng serve` con el simulador, Chromium:
  `consulta-formulario-libre.spec.ts` 2/2 y `consulta-formulario-medico.spec.ts`
  1/1 (regresión).
  Recorrido `UI → petición → simulador → recarga (F5) → UI`: lo guardado se
  relee tras recargar ([foto](evidencia/5-releido-tras-recargar.png)).
  El simulador persiste en `sessionStorage`; **no se probó contra la API real
  ni PostgreSQL**.
- Fotos inspeccionadas una por una: [2](evidencia/2-formulario-libre-vacio.png),
  [3](evidencia/3-formulario-libre-lleno.png),
  [4](evidencia/4-formulario-libre-guardado.png).

## Pendiente

- Revisión independiente (`NO_SELF_APPROVAL`): no la hizo nadie más que quien
  implementó.
- Suite completa (`yarn test`) y `yarn lint` global no se corrieron.
- Portar a `dev`/`test` si corresponde.
