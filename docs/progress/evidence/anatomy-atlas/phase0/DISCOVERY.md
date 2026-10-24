# Fase 0 — Discovery y licencias (2026-10-24)

Todo lo que sigue se comprobó en esta sesión; cada afirmación remite al archivo
de esta carpeta que guarda la salida.

## 1. Alcance de red

La sesión en la nube tenía una política de red que **rechazaba** PubMed
E-utilities, Europe PMC, OpenAlex, Crossref, OLS4, Wikimedia Commons
(API y `upload.wikimedia.org`), Wikipedia, Wikidata, Open Library, Zenodo,
purl.obolibrary.org, el archivo de DBCLS (dbarchive.biosciencedbc.jp,
lifesciencedb.jp) y el visor de TA2 (ta2viewer.openanatomy.org).
Sí alcanzaba GitHub (clon, `raw.githubusercontent.com`, assets de releases) y
el registro de npm. Salida literal: `network-reachability.txt`.

Consecuencia: todo lo que dependía de esas APIs (descripciones extendidas con
literatura, imágenes de Commons con `extmetadata`, resolución en línea de
citas e IDs) **no se pudo hacer** y quedó marcado como no hecho; no se
reemplazó con nada inventado ni escrito de memoria.

## 2. Modelos 3D

### BodyParts3D (DBCLS)

- Versión 3.0 (20110915), tomada de la copia
  `github.com/Kevin-Mattheus-Moerman/BodyParts3D` (el archivo de DBCLS no era
  alcanzable). 934 STL, 1,3 GB, nombradas por ID FMA (`FMA24474.stl`) o `BP*`.
- Licencia: CC BY-SA 2.1 JP (`bodyparts3d-LICENSE_content.txt`). Hay dos
  formas del crédito: la del archivo de licencia («BodyParts3D, Copyright©
  2008 Life Science Integrated Database Center licensed by CC
  Display-Inheritance 2.1 Japan», traducción automática del japonés) y la del
  README de la copia («BodyParts3D, (c) The Database Center for Life Science
  licensed under CC Attribution-Share Alike 2.1 Japan»,
  `bodyparts3d-readme-and-fma-counts.txt`). Se usa la segunda porque nombra
  la licencia por su nombre oficial en inglés y la entidad actual (DBCLS).
- **Sólo un cuerpo masculino.** El README de la copia lo dice («The data is
  currently, unfortunately, only for a single male model») y la lista de
  piezas lo confirma: hay testículos, epidídimos, vesículas seminales,
  próstata y pene; ninguna malla de útero, ovario, trompa, vagina, vulva ni
  mama (`bodyparts3d-female-coverage.txt`).

### Z-Anatomy

- `github.com/LluisV/Z-Anatomy` (proyecto Unity), licencia CC BY-SA 4.0 para
  sus modelos, que son a su vez **derivados de BodyParts3D**
  (`z-anatomy-models-License.txt`).
- Incluye además componentes con licencia **no comercial** (oído interno
  CC BY-NC-SA 4.0, riñón CC BY-NC 4.0). Para una plataforma de salud
  comercial eso los descarta.
- Cobertura femenina: el FBX visceral (`VisceralSystem100.fbx`, 18,4 MB) nombra
  testículo, próstata y pene; **ningún nodo de útero, ovario, vagina, vulva ni
  mama**. Los nombres femeninos del repo son sólo textos de definición
  (`z-anatomy-female-coverage.txt`).

### Conclusión sobre el modelo femenino

**No existe, entre las fuentes aprobadas, un modelo femenino completo con
licencia libre.** La alternativa honesta que se implementó: el selector
«Hombre / Mujer» existe, y «Mujer» muestra el mismo cuerpo de referencia sin
las piezas exclusivas del sistema genital masculino, con un aviso visible de que
la pelvis y las proporciones siguen siendo masculinas, y lista las 93
estructuras femeninas del catálogo (UBERON, parte del sistema reproductor
femenino) como fichas **sin pieza 3D**. No se presenta como un modelo femenino.

### Lo que se usó y cuánto pesa

BodyParts3D 3.0, sin el sistema tegumentario (la piel mezcla superficies
internas y externas; el pelo tapa cráneo y pelvis): **930 mallas**, reducidas
a **358 984 triángulos** y cuantizadas a int16, en cinco GLB por capa
(`glb-sizes.txt`):

| Capa | Bytes | gzip -9 |
|---|---|---|
| skeleton.glb | 884 832 | 547 924 |
| muscles.glb | 2 340 884 | 1 565 493 |
| organs.glb | 294 924 | 186 367 |
| vessels.glb | 248 532 | 151 786 |
| nervous.glb | 416 868 | 269 920 |

Se sirven desde el mismo origen (`public/anatomy-atlas-3d/models/`) y se bajan
por capa al encenderla: la CSP no se tocó.

## 3. Ontologías

- **UBERON** release 2026-10-01, `uberon.obo` desde los assets de la release en
  GitHub; SHA-256 `d4751a15d7551a8414caee2628c62bf68301d567caf54ccfa3eef383ae7cbb61`
  (en `data/anatomy-ontology/provenance.json`). 16 141 clases UBERON; **6 074**
  humanas (con xref FMA).
- **FMA**: la copia que distribuye BodyParts3D (`FMA.csv`: 104 723 filas,
  104 721 registros según el parser CSV, 104 698 FMAID distintos —
  `bodyparts3d-readme-and-fma-counts.txt`).
  OLS4 (la vía para resolver IDs FMA en línea) no era alcanzable.
- **TA2 (FIPAT)**: no alcanzable (ta2viewer.openanatomy.org rechazado), y
  UBERON 2026-10-01 no trae xrefs TA2. **No hay códigos TA2 en el catálogo.**

## 4. Mapeo Netter → UBERON

Se hizo en la fase 1 (por región). Ver el conteo en `../REPORT.md` y el
detalle en `data/anatomy-ontology/netter-mapping-report.json`.
