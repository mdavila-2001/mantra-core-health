# Auditoría de integridad — Netter v2

## Resultado ejecutivo

La primera versión era **estructuralmente válida** (ZIP legible, 548 láminas y referencias dentro de rango), pero la auditoría encontró dos problemas de calidad que justificaban regenerarla:

1. **Diversidad insuficiente del dataset de entrenamiento anterior.** Había 240,567 bloques, pero solo 8,188 contenidos normalizados distintos; la tasa de repetición fue **96.60%**. El tamaño del archivo, por tanto, sobreestimaba la diversidad real.
2. **Errores OCR en el índice.** Se observaron formas corruptas como `comin`, `ircunteja`, `cigamaticotemporal` o `dettoidea`. La v2 vuelve a extraer las 46 páginas del índice a alta resolución con OCR español+inglés y coteja cada entrada contra la extracción anterior.

## Controles de la v2

- PDF físico inspeccionado con `pdfinfo`: **631 páginas**.
- Láminas canónicas modeladas: **548/548**.
- Páginas de índice re-OCR: **46** (PDF 585-630), tres columnas por página.
- Entradas OCR deduplicadas: **7,396**.
- `consensus_high`: **6,398**.
- `consensus_medium`: **369**.
- `new_ocr_only`: **629**.
- Entidades seleccionadas para definiciones: **3,161**.
- Ejemplos de entrenamiento gold generados: **164,372**.
- Duplicados exactos detectados durante generación v2: **0**.
- Referencias de lámina fuera de 1-548: **0**.
- Láminas sin página física mapeada: **0**.

## Cambios de integridad

### A. Identificador canónico
Se usa `PLATE_001`…`PLATE_548`. La página física del PDF es un metadato aparte. Esto corrige la ambigüedad entre páginas del escaneo y números de lámina.

### B. OCR por consenso
`consensus_high` exige fuerte acuerdo de texto y referencias entre dos pasadas OCR independientes. `consensus_medium` se mantiene en capa silver. `new_ocr_only` no entra al entrenamiento gold.

### C. Definiciones largas con procedencia
Las definiciones amplían **qué tipo de entidad es**, **qué contexto regional tiene**, **dónde aparece** y **qué no puede inferirse**. No se presentan como citas literales de Netter: el corpus separa fuente, clasificación derivada y conocimiento terminológico general.

### D. Entrenamiento sin relleno repetitivo
La v2 genera cada par `entidad × tarea` una sola vez. El generador rechaza hashes duplicados. El tamaño final proviene de definiciones y tareas distintas, no de repetir el mismo bloque con IDs nuevos.

## Términos OCR problemáticos observados en la v1
- `comin`: 15 ocurrencias en los índices derivados de v1.
- `ircunteja`: 6 ocurrencias en los índices derivados de v1.
- `cigamaticotemporal`: 3 ocurrencias en los índices derivados de v1.
- `tonsllar`: 3 ocurrencias en los índices derivados de v1.
- `estenopalatina`: 3 ocurrencias en los índices derivados de v1.
- `corificio`: 3 ocurrencias en los índices derivados de v1.
- `dettoidea`: 9 ocurrencias en los índices derivados de v1.
- `encélalo`: 3 ocurrencias en los índices derivados de v1.

## Limitaciones honestas

- Netter es un atlas visual; el índice escaneado no sustituye la lectura de cada ilustración.
- `consensus_high` reduce errores de OCR, pero **no equivale a validación humana término por término**.
- Las definiciones generadas explican categorías y contexto; propiedades específicas como origen/inserción, irrigación o inervación solo deben incorporarse cuando se verifican en una fuente explícita.
- TAH/FIPAT se usa como referencia de normalización, no como autorización para corregir automáticamente todas las formas históricas del Atlas.
