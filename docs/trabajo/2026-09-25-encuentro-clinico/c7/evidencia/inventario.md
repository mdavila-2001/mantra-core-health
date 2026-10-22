# Inventario — `grep -rniE "nota clínica|evoluci[oó]n|hoja en blanco" src/app --include=*.html --include=*.ts`

56 archivos con al menos un hit (conteo completo en `evidencia/inventario-conteo.txt`). Clasificación
por dueño, agrupada por carpeta — el detalle línea a línea de mis propios archivos vive en los diffs,
no acá (regla de economía de contexto).

## Míos (se corrigen en este carril)

| Archivo | Acción |
|---|---|
| `core/navigation/navigation.map.ts` | Hecho: rótulo `'Evoluciones'` → `'Notas médicas'` (única línea reservada) |
| `features/progress-notes/{progress-notes.ts,.html,.spec.ts}` | Reescritura completa: «Notas médicas», ADR-0015 |
| `features/clinical-record/patient-chart/free-note-block/**` | Ver bloqueo real en `PLAN.md`: no se borra (rompería `patient-chart.ts`); se reduce a envoltorio `@deprecated` sin la hoja en blanco, delegando a `measurement-grid/` |
| `features/clinical-record/patient-chart/free-note-block/note-grid/**` | Se mueve y renombra a `features/clinical-record/patient-chart/measurement-grid/** ` |
| `features/clinical-record/patient-chart/observation-block/**` | Rótulos: «Medición», «Registrar una medición», «Qué se midió», «¿En qué consulta se tomó?» |
| `features/clinical-record/patient-chart/care-plan-block/**` | Términos viejos si los hay, dentro del archivo |
| `features/clinical-record/patient-chart/procedures-block/procedures-block.html` | 1 hit — corregido |
| `core/mock/faker/clinico.ts` | Sólo `notaDeEvolucion` → `textoDeNotaMedica` (C1 tiene otra función en el mismo archivo, región distinta — no tocar) |
| `core/mock/faker/index.ts` | El export correspondiente |
| `core/mock/aviso-ficha-medica.spec.ts` | Ajustar si nombra el término viejo |
| `playwright/pdf-premium-evoluciones.spec.ts` → `clinica-c7-notas-medicas-pdf.spec.ts` | Hecho: archivo renombrado (`git mv`), título del test, heading, nombres de captura y mensajes ajustados a «Notas médicas». La aserción del nombre del PDF descargado **no** se tocó — ver la fila de `progress-notes-pdf.ts` abajo |
| `playwright/consulta-rejilla.spec.ts` | Revisado: **no** referencia `note-grid`/`measurement-grid`. Sus dos únicos hits del kill-test (`observaciones`→«Registrar una observación», `notas`→«Escribir una nota clínica») son títulos de modal definidos en `consultation.ts` (congelado, ajeno) — ver la fila de `consultation/**` abajo. No se tocó |
| `playwright/formularios-cuadricula.spec.ts` | Revisado: es del generador de formularios (pregunta tipo cuadrícula Sí/No), sin relación con `note-grid`/`measurement-grid` ni con ningún término del kill-test. No tenía nada que ajustar — la mención original de la ficha era imprecisa |
| `docs/components/catalog.md` | Fila de `free-note-block` |

## Ajenos — se anotan, no se tocan (para el `REPORTE.md` de C8)

| Archivo(s) | Por qué es de otro carril | Hits |
|---|---|---|
| `core/mock/fixtures/fichas-estandar.generated.ts` | Generado; fixtures de fichas estándar (C1/C2) | 17 |
| `shared/utils/progress-notes-pdf/{progress-notes-pdf.ts,.spec.ts}` | No está en mi ficha de archivos reservados; genera el PDF de la pantalla que sí reescribo, pero el archivo en sí no me lo asignaron — **a confirmar con C8** si debía ser mío. **Consecuencia concreta:** `progress-notes-pdf.ts:154` arma el nombre de archivo `evoluciones-<fecha>.pdf`, que sigue así aunque la pantalla ya se llame «Notas médicas»; `playwright/clinica-c7-notas-medicas-pdf.spec.ts` lo deja documentado y **no** actualiza esa aserción, para no fallar contra el comportamiento real | 30 |
| `patient-chart/specialty-form-block/**` | No está en mi ficha (bloque de formularios de especialidad) | 11 |
| `shared/components/molecules/rich-text-editor/**` | Componente compartido de edición de texto — de la casa, no mío | 5 |
| `features/design-system-sample/**` | Página de muestra del sistema de diseño, ajena | 4 |
| `features/component-stock/component-index.generated.ts` | Generado — se regenera solo, no se edita a mano | 3 |
| `features/clinical-record/consultation/**` | Explícitamente fuera («ARCHIVOS DE OTROS», tipos congelados). **Detalle relevante:** `consultation.ts:172,174` define los títulos del modal de la rejilla `titulo: 'Observación'` / `tituloDelModal: 'Registrar una observación'` (casilla `observaciones`), y `consultation.ts:179,181` `titulo: 'Nota clínica'` / `tituloDelModal: 'Escribir una nota clínica'` (casilla `notas`). Son justo los términos que este carril retira, pero viven en un archivo congelado. Por eso `playwright/consulta-rejilla.spec.ts` **no se tocó** en esas dos entradas de `CASILLAS` (`observaciones`/`notas`): cambiarlas ahí sin poder cambiar `consultation.ts` haría fallar el spec contra la UI real. Queda para quien pueda tocar `consultation.ts`: renombrar esos dos títulos y entonces sí actualizar el spec. | 4 |
| `features/alovida/accesos/**` (8 pantallas) | Gestión de accesos delegados — dominio distinto, coincidencia de palabra suelta | 8 |
| `patient-chart.ts` / `patient-chart.html` | C3 — sólo se leyó para entender el bloqueo de `free-note-block`, no se edita | 3 |
| `shared/components/atoms/nav-icon/**` | Catálogo de íconos compartido | 3 |
| `messaging/thread/composer/emoji-catalog.generated.ts` | Generado, ajeno | 2 |
| `features/agenda/mi-recurso.{ts,spec.ts}` | Agenda, dominio distinto | 3 |
| `features/account/my-profile/**` (2 archivos) | Perfil del profesional, ajeno | 2 |
| `core/mock/handlers/clinical.handlers.ts` | Compartido; mis cambios de C5 ya están ahí, estos 2 hits son de otras rutas (C1/C2) | 2 |
| `core/mock/fixtures/clinica.ts` / `anatomia.ts` | Fixtures de C2 | 3 |
| `core/data-access/chart-notes/**`, `core/data-access/profiles/profiles.types.ts` | Contratos de otros carriles (C1) | 3 |
| `core/navigation/access-tree.ts`, `navigation.service.spec.ts` | Compartidos de navegación, fuera de mi única línea reservada | 2 |
| `features/dashboard/**`, `features/delegated-access/**` | Dominios distintos | 4 |
| `shared/components/atoms/textarea/textarea.ts`, `shared/utils/pdf-export/pdf-export.ts` | Piezas de la casa, ajenas | 2 |

**Total clasificado:** 56 archivos — 13 grupos míos, 19 grupos/carpetas ajenos anotados arriba (algunos
agrupan varios archivos de la misma carpeta).
