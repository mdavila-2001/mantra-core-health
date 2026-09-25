# Defectos reportados (nunca arreglados acá)

| A quién | Qué | Severidad | Captura / pasos | Estado |
|---|---|---|---|---|
| Ninguno todavía | — | — | — | — |

Ningún `BLOQUEANTE`/`MAYOR` encontrado en la rama de Justin durante H3 (los 10 tests reales del
contrato pasan). Un hallazgo de **método**, no un defecto, quedó documentado directamente en el
spec (`carga-masiva.spec.ts`, test 4): `no-es-nada.pdf` se rechaza en el **cliente**
(`FileInput`/`matchesFileAccept`, `accept` validado también al soltar) antes de llegar al
servidor — el 422 `IMPORT_FORMAT_UNSUPPORTED` del contrato §2 es la defensa del servidor para
quien no pasa por la pantalla. No es un defecto de Justin: es una capa de validación adicional,
correcta, que el spec original no contemplaba.
