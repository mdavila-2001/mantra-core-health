# Tipografías de las maquetas

Las dos familias están **auto-hospedadas**: viven en esta carpeta y se cargan con
`@font-face` desde `alovida.css`. No hay CDN, así que las pantallas se ven igual
en cualquier equipo y siguen abriéndose con doble clic sin conexión.

| Archivo | Familia | Uso | Licencia |
|---|---|---|---|
| `nunito-sans-variable.woff2` · `-ext` | Nunito Sans (variable, 400–1000) | Cuerpo, cifras, overline | SIL Open Font License 1.1 |
| `poppins-500.woff2` · `-ext` | Poppins Medium | H3 y títulos de modal | SIL Open Font License 1.1 |
| `poppins-600.woff2` · `-ext` | Poppins SemiBold | H1 y H2 | SIL Open Font License 1.1 |

**Por qué Nunito Sans y no Avenir.** Avenir es de Linotype y no se puede
redistribuir con el proyecto. Nunito Sans es la alternativa libre más cercana en
carácter —geométrica de base, remates humanistas, altura de x moderada— y aguanta
bien los 13 px de las tablas densas, que es donde Avenir sí se usaría. Si la
organización compra la licencia de Avenir, se cambia una sola línea: la variable
`--f-texto` de `alovida.css`.

## Las del papel (PDF)

Los PDF que genera la aplicación (`src/app/shared/utils/pdf-export/`) embeben
sus propias fuentes: `jsPDF` sólo acepta **TTF**, no WOFF2, así que son archivos
aparte de los de pantalla. Se descargan sólo al exportar un documento, no entran
en el paquete inicial.

| Archivo | Familia | Uso en el papel | Origen | Licencia |
|---|---|---|---|---|
| `poppins-500.ttf` | Poppins Medium (v4.004) | Subtítulos y rótulos | `500Medium/Poppins_500Medium.ttf` del paquete npm **`@expo-google-fonts/poppins` 0.4.1** (Google Fonts), recortado con `pyftsubset` al rango latino de abajo | SIL Open Font License 1.1 |
| `poppins-600.ttf` | Poppins SemiBold (v4.004) | Títulos, portada, secciones, total a pagar | Mismo binario que `assets/fonts/Poppins-SemiBold.ttf` del repo móvil (Google Fonts) | SIL Open Font License 1.1 |
| `nunito-sans-400.ttf` | Nunito Sans Regular (v3.101) | Cuerpo y datos | `400Regular/NunitoSans_400Regular.ttf` del paquete npm **`@expo-google-fonts/nunito-sans` 0.4.2** (Google Fonts), recortado con `pyftsubset` | SIL Open Font License 1.1 |
| `nunito-sans-700.ttf` | Nunito Sans Bold (v3.101) | Datos destacados y cifras | `700Bold/NunitoSans_700Bold.ttf` del mismo paquete, recortado igual | SIL Open Font License 1.1 |
| `inter-400.ttf` | Inter Regular (estática) | **Ya no la usa el papel** desde que adoptó la identidad AloVida (Nunito Sans); queda por compatibilidad con enlaces viejos | `extras/ttf/Inter-Regular.ttf` del release **Inter 4.1** (github.com/rsms/inter, 2024-11-15), bajado el 2026-10-02 | SIL Open Font License 1.1 |

**Por qué Inter estática y no la variable del repo móvil.** `jsPDF` no interpreta
los ejes de una fuente variable: embebería la instancia por omisión sin poder
elegir peso, y el archivo pesa el doble. La estática de 400 es exactamente lo que
el cuerpo necesita.

**Las estáticas son la misma letra que la pantalla.** Las Nunito Sans del papel
son la versión 3.101, la misma de `nunito-sans-variable.woff2`. Se comprobó
instanciando la variable en 400, 600 y 700 con `fontTools.varLib.instancer`: los
avances de los 230 + 331 caracteres de los dos woff2 coinciden con las estáticas
y los contornos difieren en menos de una unidad de 1000 (el redondeo de la
instancia). Las Poppins también son la 4.004 de los woff2 de pantalla.

**El recorte.** Las estáticas completas traen vietnamita, cirílico o devanagari
que el papel no usa, y `jsPDF` embebe el archivo entero en cada PDF. Se dejaron
latín básico, Latin-1, Latin Extended-A, puntuación general, monedas, `№`, `™`,
flechas y signos matemáticos sueltos, con las tablas de diseño (`GPOS`, `GSUB`),
el hinting y los textos de licencia intactos:

```
pyftsubset ORIGEN.ttf --output-file=DESTINO.ttf \
  --unicodes="U+0020-007E,U+00A0-017F,U+0192,U+0218-021B,U+02C6-02C7,U+02C9,U+02D8-02DD,U+0300-0304,U+0306-030C,U+0326-0328,U+2000-206F,U+20A0-20C0,U+2113,U+2116,U+2122,U+2190-2195,U+2212,U+2215,U+2219,U+221E,U+2248,U+2260,U+2264-2265,U+25CF,U+FEFF,U+FFFD" \
  --layout-features='*' --hinting --name-IDs='*' --name-legacy --name-languages='*' \
  --notdef-outline --recalc-bounds --drop-tables+=DSIG,STAT
```

Lo que falta no lo quitó el recorte, no está en el original: Poppins no tiene
`№` ni las letras del esperanto y el maltés (`Ĉ`, `Ĝ`, `Ħ`…), y ninguna de las
dos tiene `→` ni `●`. Para el español sobra.

La SIL OFL 1.1 permite usar, modificar y redistribuir las fuentes, incluso en
proyectos comerciales; sólo prohíbe venderlas por separado. Texto completo:
`https://openfontlicense.org`.
