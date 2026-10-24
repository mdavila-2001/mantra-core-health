# Recorrido de teclado — pantalla de carga masiva (H4.S3.M3)

> **Alcance de esta evidencia.** El recorrido está **derivado del DOM que produce el spec**
> (`version-import.spec.ts`, 39/39 en verde) y de los contratos de los átomos que se reusan, no de
> una sesión en navegador: esta corrida no tiene navegador disponible (cuatro carriles en paralelo,
> regla 70). Los pasos marcados `[spec]` están **verificados por una aserción**; los marcados
> `[derivado]` se siguen del DOM y del componente reusado pero **no se observaron**. Pendiente de
> recorrido real: ver `REPORTE.md` §No cubierto.

## El orden de tabulación

| # | Elemento | Cómo se llega | Qué hace |
|---|---|---|---|
| 1 | `carga-perfil` (`app-select`) | `Tab` desde el encabezado | ↑/↓ cambian el perfil; el cambio limpia el resultado anterior `[spec]` |
| 2 | `carga-sistema` | `Tab` | Al elegir, pide las versiones y limpia el resultado `[spec]` |
| 3 | `carga-version` | `Tab` | Deshabilitado —y por tanto **fuera** del orden de tabulación— hasta que hay sistema `[derivado]` |
| 4 | `carga-plantilla-csv` | `Tab` | `Enter`/`Espacio` dispara la descarga `[spec]` |
| 5 | `carga-plantilla-xlsx` | `Tab` | Ídem |
| 6 | Zona de arrastre (`carga-archivo`) | `Tab` | El `<label for>` del átomo lleva el foco al `<input type=file>`; `Enter` abre el diálogo del sistema `[derivado — es el comportamiento nativo del `<input type=file>`, no código nuestro]` |
| 7 | `carga-validar` | `Tab` | `Enter` valida sin guardar `[spec]` |
| 8 | `carga-importar` | `Tab` | **Alcanzable siempre**, con `aria-disabled="true"` mientras no haya validación de 0 errores `[spec]`. El clic se intercepta; el foco no se pierde |
| 9 | `carga-informe` / `carga-resumen` | **el foco llega solo** | Tras validar, el foco salta al informe; tras importar, al resumen `[spec, con `document.activeElement`]` |
| 10 | `carga-descargar-errores` | `Tab` desde el informe | Sólo existe cuando hay errores `[spec]` |
| 11 | «Publicar la versión» y `carga-otro` | `Tab` desde el resumen | Sólo existen tras importar `[spec]` |

## Las tres decisiones de accesibilidad, y por qué

1. **El botón deshabilitado sigue siendo alcanzable.** `AppButton` dice «no se puede» con
   `aria-disabled` e intercepta el clic, en vez de poner el atributo `disabled` nativo, que lo
   sacaría del orden de tabulación. Un botón que desaparece del teclado no puede explicar **por qué**
   no se puede todavía, y ese «por qué» —«falta validar»— es justo lo que hay que poder leer.
   Verificado en el spec: `aria-disabled="true"` sin validación previa.

2. **El foco se mueve al resultado, y la región viva lo anuncia igual.** Son dos cosas distintas y
   hacen falta las dos: `aria-live="polite"` sobre el bloque del paso 3 anuncia el informe sin
   robar el foco a quien esté escribiendo, y el salto explícito al ancla `tabindex="-1"` es lo que
   evita que quien navega con teclado tenga que tabular a ciegas hasta el final de la página.
   Verificado en el spec: el informe está dentro de `[aria-live="polite"]`, tiene `tabindex="-1"`, y
   `document.activeElement` es él después de validar.

3. **El foco se mueve cuando el elemento existe, no cuando llega la respuesta.** El bloque del
   informe lo dibuja un `@if` que se resuelve en el render siguiente al de la señal: enfocar dentro
   del `subscribe` era enfocar `undefined`, **en silencio**. Lo resuelve un `effect` que vuelve a
   correr cuando la consulta de vista encuentra el ancla. Es el defecto que las dos pruebas de foco
   destaparon en la primera corrida de este spec.

## Lo que este recorrido NO verifica

- Que un lector de pantalla real (NVDA / VoiceOver) lea el informe al aparecer. El `aria-live` está
  puesto y probado por estructura, no por locución.
- El foco visible: `styles.css` declara `:focus-visible { outline: 4px solid var(--focus-ring) }`
  globalmente y esta pantalla **no lo pisa** (se comprobó que no hay ninguna regla `outline` propia),
  pero el contraste del anillo sobre `--bg-inset` no se midió en pantalla.
- El diálogo nativo de archivos, que no es código de este repo.
