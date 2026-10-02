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
| `poppins-600.ttf` | Poppins SemiBold | Títulos, rótulos, cabeceras de tabla, versalitas del membrete | Mismo binario que `assets/fonts/Poppins-SemiBold.ttf` del repo móvil (Google Fonts) | SIL Open Font License 1.1 |
| `inter-400.ttf` | Inter Regular (estática) | Cuerpo, datos, filas de tabla, pie | `extras/ttf/Inter-Regular.ttf` del release **Inter 4.1** (github.com/rsms/inter, 2024-11-15), bajado el 2026-10-02 | SIL Open Font License 1.1 |

**Por qué Inter estática y no la variable del repo móvil.** `jsPDF` no interpreta
los ejes de una fuente variable: embebería la instancia por omisión sin poder
elegir peso, y el archivo pesa el doble. La estática de 400 es exactamente lo que
el cuerpo necesita.

La SIL OFL 1.1 permite usar, modificar y redistribuir las fuentes, incluso en
proyectos comerciales; sólo prohíbe venderlas por separado. Texto completo:
`https://openfontlicense.org`.
