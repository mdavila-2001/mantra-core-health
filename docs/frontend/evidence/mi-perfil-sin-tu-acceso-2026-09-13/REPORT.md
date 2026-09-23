# «Mi perfil» sin «Tu acceso» — evidencia del 13/09/2026

Rama `justin/mi-perfil-sin-tu-acceso`, sobre `mockup` en `971e1b66`.

## Qué pidió el cliente (13/09/2026)

1. Sacar la tarjeta **«Tu acceso»** de «Mi perfil» — sus dos renglones,
   «Organización» y «Roles», son vocabulario de sistema.
2. Los **contadores de «Actividad»** del médico tenían que verse como
   contadores y no como el pie de una lista.

## Qué se hizo

| Cambio | Dónde |
|---|---|
| Sale «Tu acceso»; con ella, la columna lateral entera cuando la verificación está apagada | `my-profile.html`, `my-profile.ts`, `my-profile.css` |
| Sus dos enlaces —«Mi consultorio propio» y «Organización médica»— se mudan al pie del perfil profesional | `my-profile.html` |
| Los cuatro contadores pasan a tarjetas, en componente propio | `practitioner-activity/` (nuevo), `practitioner-profile-view.html` |
| El subtítulo deja de prometer una sección que ya no existe | `my-profile.html` |
| El comentario de `vieneAAtenderse` deja de nombrar la tarjeta como su caso | `role-labels.ts` |

**Los dos enlaces no se fueron con la tarjeta a propósito.** Son los únicos
accesos a `/administration/my-practice` y `/administration/medical-organization`
desde que esas pantallas salieron del menú del médico (§4.H del plan de UX);
borrarlos con la tarjeta habría convertido una limpieza visual en una pérdida de
acceso. Hay un spec propio que lo fija.

## Por qué «Actividad» es un componente nuevo

No por gusto de abstraer: `practitioner-profile-view.css` estaba a **20 bytes**
del techo de 9 kB que `angular.json` fija por hoja de componente
(`anyComponentStyle`). Las primeras reglas de los contadores —escritas en la
hoja compartida `ficha-de-perfil.css`— voltearon el build:

```
✘ [ERROR] ficha-de-perfil.css exceeded maximum budget.
          Budget 9.00 kB was not met by 606 bytes with a total of 9.61 kB.
```

Verificado que el rojo era mío y no preexistente: con el diff guardado aparte,
`yarn build` sobre `mockup` limpio sale en 0 y la misma hoja mide **8,98 kB**.
Subir el presupuesto habría tapado el problema; sacar la pestaña a
`practitioner-activity/` le da su propia hoja y su propio presupuesto, y deja el
CSS al lado del marcado que lo usa. Tras el cambio la hoja vuelve a **8,98 kB**
—exactamente la línea base— y el build sale en 0.

El dibujo es el de las cifras del panel (`panel__cifra-*`): `app-card`
`outlined`, rótulo en «overline» y valor en tipografía de titular con cifras
tabulares. Se repitió el patrón y no el componente porque el panel tiene además
un pie por tarjeta que acá no existe; **unificarlos en una pieza compartida
queda anotado como trabajo aparte**.

## Evidencia

### Compuertas

| Comando | Resultado |
|---|---|
| `corepack yarn typecheck` | exit 0 |
| `corepack yarn lint` | exit 0 |
| `corepack yarn build` | exit 0, sin `[ERROR]` |
| `corepack yarn test --watch=false` | **484 archivos · 5 799 pruebas · 0 fallos** |

### Navegador (maqueta, `--workers=1`)

`node playwright/mi-perfil-sin-tu-acceso.mjs http://localhost:4333` —
**14/14 en verde**:

```
✔ paciente · «Tu acceso» ya no está
✔ paciente · no queda columna lateral
✔ paciente · la rejilla no reserva la columna
✔ paciente · la ficha está centrada — izq 40 · der 40
✔ paciente · la ficha ocupa el ancho del área — 1096 de 1176px
✔ médica · conserva los dos accesos — Mi consultorio propio | Organización médica
✔ médica · y llevan a donde deben — /administration/my-practice | /administration/medical-organization
✔ médica · los contadores son tarjetas — 4 contadores
✔ médica · ya no son renglones de ficha
✔ médica · reparten el ancho en una rejilla — 253px cada una
✔ teléfono · los contadores caen en una columna
✔ teléfono · sin desborde horizontal
✔ sin errores de consola
✔ sin respuestas 4xx/5xx
```

### Fotos

| Archivo | Qué muestra |
|---|---|
| `despues-paciente-1440.png` | Una tarjeta, ancho completo, sin columna lateral |
| `despues-paciente-375.png` | La misma en teléfono |
| `despues-medica-1440.png` | El perfil del médico con los dos enlaces al pie |
| `despues-medica-actividad-1440.png` | Los cuatro contadores en tarjetas |
| `despues-medica-actividad-1440-oscuro.png` | Lo mismo en modo oscuro |
| `despues-medica-actividad-375.png` | Los contadores en una columna, sin desborde |

Las capturas se observaron, no sólo se midieron: mirando la del médico se
encontró el subtítulo huérfano que se corrigió en este mismo diff.

## Lo que NO se pudo verificar

- **Los E2E de perfil contra la API viva quedaron SALTEADOS**
  (`alv-perfil-medico.spec.ts`, `it1-perfil-paciente-libre.spec.ts`: 4 salteados,
  0 corridos). Exigen el stack Docker, que está apagado por pedido del
  propietario. No se declara verificado lo que no se corrió.
- El cambio es de maqueta (`mockup`) y no toca contratos de API, autorización ni
  persistencia: lo único que se movió de sitio son dos enlaces de navegación,
  cuyo destino está fijado por spec.

## Defecto encontrado y corregido de paso

El guion de evidencia escribía las capturas en
`~/Desktop/Mantra%20Core%20Technologies/…`: `new URL(...).pathname` codifica los
espacios de la ruta. Se corrigió con `fileURLToPath` y se borró la carpeta
basura. **Los guiones vecinos de `playwright/*.mjs` tienen el mismo defecto** —
anotado, no tocado acá.
