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

La SIL OFL 1.1 permite usar, modificar y redistribuir las fuentes, incluso en
proyectos comerciales; sólo prohíbe venderlas por separado. Texto completo:
`https://openfontlicense.org`.
