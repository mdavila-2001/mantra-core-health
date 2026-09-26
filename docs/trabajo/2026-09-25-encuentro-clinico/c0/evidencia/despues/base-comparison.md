# Comparación estática de hallazgos externos a C0

Fecha de trabajo: 2026-09-25. Base contrastada: `9b8bc46e3f92be7bf80b64b2014cdaf4b86b9796` (HEAD al efectuar esta comparación).

Se leyeron las salidas ya existentes y se compararon fuentes contra el blob Git de la base. **No se ejecutaron runners, builds ni gates en esta revisión.** No se modificó producto, tests ni configuración para resolver los hallazgos de esta tabla.

La igualdad de fuentes prueba que una instrucción ya estaba en la base; **no prueba que su fallo haya ocurrido en una ejecución de baseline**. Los únicos rojos previos documentados literalmente aquí son el lint y insurance-analytics. Los cuatro fallos de la corrida con cobertura siguen pendientes de reproducción aislada: no se declaran automáticamente regresiones de C0 ni fallos previos reproducidos.

## Hallazgos de gates

Las cinco salidas enlazadas registran `EXIT_CODE: 1`.

| Gate / causa observada | Evidencia y comparación | ¿Ya venía? |
|---|---|---|
| Architecture: 3 ciclos del grafo estático | [Salida existente](check-architecture.txt). Los pares personas ↔ insurer-network, personas ↔ registered-people y month-view ↔ day-view conservan fuentes idénticas. Hay imports `type` en las vueltas de los ciclos; esto describe el grafo del gate, no demuestra un ciclo de ejecución. | **Fuentes sí**; gate sobre la base no vuelto a ejecutar. |
| Architecture: import de core hacia shared | `mock-backend.spec.ts:20` importa `phone-input.paises`. El archivo fue ampliado por C0, pero la línea denunciada está idéntica en base y worktree; el diff sólo agrega pruebas desde la antigua línea 86. Hash de la línea en §3. | **Import sí**; el archivo completo cambió. |
| Architecture: detección de red fuera de data-access | `provincias.ts:102` mantiene el fetch; `adjunto-metadata.ts:97` menciona `fetch(dataUrl)` en un comentario. El detector en `check-architecture.mjs:127–128` aplica regex al texto sin quitar comentarios: el segundo hallazgo es estático sobre un comentario, no una llamada ejecutada. Fuentes y scanner idénticos. | **Texto y detector sí**; no se ejercitaron estas funciones. |
| API prefixes: falta /loyalty en Docker/nginx | [Salida existente](check-api-prefixes.txt): el prefijo está en `proxy.conf.json` y falta en `proxy.conf.docker.json` y la unión de `deploy/api-locations.conf` + `deploy/nginx.conf`. Las cuatro fuentes y el gate son idénticos a la base. | **Configuración sí**; no se volvió a ejecutar gate baseline. |
| Form pages: 2 formularios sin paginar | [Salida existente](check-form-pages.txt): `dependent-form-dialog.html` pide 8 campos y `plan-form-dialog.html` pide 5. Ambos templates y scanner tienen hashes idénticos. | **Templates sí**; no se recorrieron esos formularios. |
| CSS tokens: 4 nombres, 5 usos sin reserva | [Salida existente](check-css-tokens.txt): `--s` (2), `--x`, `--dur` en auth-stage, y `--fs-title` en pharmacy-shop. CSS señalado, hojas globales y scanner idénticos. | **Usos sí**; la comparación no demuestra por sí sola defecto visual. |
| Doc links: 12 destinos ausentes | [Salida existente](check-doc-links.txt). Diez enlaces a artifacts de transparencia/copagos y dos enlaces a documentación externa de Marcelo. Los tres documentos fuente y scanner son idénticos. El resultado depende también de artifacts ignorados y ubicación de repos hermanos. | **Enlaces sí**; no se infiere existencia/ausencia histórica de archivos externos al árbol Git. |

`generate-inventory --check` también registró cinco inventarios desactualizados en [su salida](generate-inventory.txt). **No se clasifica como ajeno:** C0 mueve componentes y rutas, por lo que sus inventarios derivados deben regenerarse y verificarse en la integración.

## Pruebas: evidencia de ejecución existente y límite de atribución

| Caso | Salida literal existente / causa identificable | ¿Fallo previo reproducido? |
|---|---|---|
| Baseline lint | [antes/lint.txt](../antes/lint.txt): `263 problems (263 errors, 0 warnings)`; `exit=1`. | **Sí, baseline registrado.** No es el conteo exploratorio de otro checkout. |
| Baseline insurance-analytics | [antes/tests-specs.txt](../antes/tests-specs.txt): `coveragesWithoutPremiumCount` esperaba 0, recibió 1; línea 86. Spec y handler idénticos a la base. | **Sí, baseline registrado.** Causa funcional no aislada por esta revisión. |
| Coverage: subida de documentos | [tests-coverage.txt](tests-coverage.txt): `expected 682.4627999999975 to be less than 650`, spec de latencia:67. Prueba mide tiempo real. Spec e interceptor son idénticos. | **No.** El código del umbral es previo; no está demostrado que el exceso de latencia ocurriera antes de C0. |
| Coverage: dos corridas | Mismo log: `expected 47.625099999997474 to be less than 30`, spec de latencia:76. Comparación de duración real; fuente idéntica. | **No.** Variación observada, causa del jitter no aislada. |
| Coverage: lectura estática Math.random | Mismo log: `ENOENT` al abrir `wt-clinica-c0\mock-backend.interceptor.ts`, spec:82. La instrucción previa es `readFileSync(join(__dirname, 'mock-backend.interceptor.ts'), 'utf-8')`; el archivo real vive en `src/app/core/mock/`. El path resultante del artefacto ejecutado no señala al fuente. | **No.** Instrucción problemática previa comprobada; fallo documentado sólo en esta corrida con cobertura. |
| Coverage: IDs de cupos entre días | Mismo log: `Test timed out in 5000ms.`, `agenda-ids-estables.spec.ts:23`. El test resetea módulos e importa agenda dos veces con fechas distintas. Spec, fixture agenda, Angular y configuración Vitest son idénticos. | **No.** Timeout observado; no prueba que los IDs difieran y no aísla la causa del costo de importación. |

Resumen literal de baseline:

```text
Test Files  1 failed | 54 passed (55)
     Tests  1 failed | 692 passed (693)
exit=1
```

Resumen literal de la corrida amplia con cobertura:

```text
Test Files  2 failed | 59 passed (61)
     Tests  4 failed | 970 passed (974)
```

Los specs de latencia y agenda-ids figuran en el listado de bundles del log baseline; dicho log sólo detalla individualmente el test rojo de insurance-analytics. No se utiliza la aparición de un bundle como evidencia de que esos escenarios fallaron antes. Tampoco se atribuye por descarte la latencia a C0: el grafo transitivo incluye handlers y conceptos modificados; comparar sólo el spec no excluye cambios de costo, scheduling o entorno.

No se aumentaron timeouts, añadieron retries, omitieron tests ni debilitaron aserciones. La clasificación y cualquier cierre siguen sujetos al resultado de las corridas dirigidas del agente principal.

## Hashes de fuentes y scripts

Comparación mediante Python `subprocess.check_output(['git', 'show', BASE + ':' + path])` frente a `Path(path).read_bytes()`, normalizando únicamente CRLF → LF en ambos lados y calculando SHA-256. No se normaliza contenido ni espacios.

Salida de la comparación realizada:

```text
Total: 36; identical: 35
Unchanged flagged import SHA256: caa49fe9e55677581e42030b6784dc507e77595d68b99b66d9b00de6eebb56b1
```

La columna SHA-256 contiene el digest completo compartido por base/worktree cuando coincide. En el único archivo modificado se muestran ambos.

| Archivo | SHA-256 base y worktree | Resultado |
|---|---|---|
| `scripts/check-architecture.mjs` | `b6ef844ac9c974a456e90cdaec3a6537de96f239567452f08546a531eed89305` | IDÉNTICO |
| `scripts/lib/scan.mjs` | `236e9f5aa825768f2af2b8af2869bb8b20b3425602a917271af505fffebdb0ec` | IDÉNTICO |
| `src/app/core/mock/fixtures/personas.ts` | `bd9f0744017ea43234d3be659b43335a15a87d6194f5d45aacd23af428af06c6` | IDÉNTICO |
| `src/app/core/mock/fixtures/insurer-network.ts` | `5855d96322a0adffa037406d59a50a7f134e4d9ce89d2fc47cc0b4fe7781069d` | IDÉNTICO |
| `src/app/core/mock/fixtures/registered-people.ts` | `a3f72681ab07549aa5c79b1c503123fed9f21ca250b0b7f60a20c9d23e91cee6` | IDÉNTICO |
| `src/app/features/agenda/my-agenda/month-view/month-view.ts` | `51699ea088f2acecbb0dbaff9298a7fc0e6950e65c2a3aeecdd1934ee787c4b1` | IDÉNTICO |
| `src/app/features/agenda/my-agenda/day-view/day-view.ts` | `cbfd16b36b382ea834d250415ca527b1fb9bc3b895f107726182fcb751d97289` | IDÉNTICO |
| `src/app/core/mock/mock-backend.spec.ts` | Base: `83fda6401b52eb630abc9aac2a1f354a68b66ee9f60ada99aee3069902ba83ae`; worktree: `a02d866ad4e8be3bc5ac3710c2e8b2499f74824a5487a43af8eaf95f24d97cf8` | MODIFICADO; import denunciado idéntico |
| `src/app/shared/components/molecules/phone-input/phone-input.paises.ts` | `badc0830a80aa34058e617fbda62e11fd626217b7a192b2b67095d705f5eec8c` | IDÉNTICO |
| `src/app/core/messaging/adjunto-metadata.ts` | `7b173f74360b5e104f77343da33573d10230ddd16ffdf5036f137407c2f9dffa` | IDÉNTICO |
| `src/app/shared/components/organisms/map/provincias.ts` | `a799c1f2968e37b3409bdef922ad8e25682213aba9c9993a75fd88e76c0d6d2d` | IDÉNTICO |
| `scripts/check-api-prefixes.mjs` | `30d8f42c3339854df55de1e81c19ee86fd3d2fdccbc149c59be024450286c987` | IDÉNTICO |
| `proxy.conf.json` | `3ce328ed7d83391c396b6151243424e8d9728bd1ec71dfa2d9f01aada719986e` | IDÉNTICO |
| `proxy.conf.docker.json` | `5a865e406553ca70b835f63163736fda41d3d6ac22597552daaa2907ef4063eb` | IDÉNTICO |
| `deploy/api-locations.conf` | `9615635d99fa0b416a9f7c36591753590cd3b06a5b9d5ef5ec0cf5972d24acfa` | IDÉNTICO |
| `deploy/nginx.conf` | `bf345758f50277f6cca5b64296678bdef5b6818a21e5ac3357e379e6bd9c174a` | IDÉNTICO |
| `scripts/check-form-pages.mjs` | `7ab68e8e9ccb3756fe5967248e07c08c150cd3fe91bd75abed1784224ff24202` | IDÉNTICO |
| `src/app/features/account/dependents/dependent-form-dialog.html` | `695df8df946a7446badcd8d57bf30e20c5dbea8af5b5b4db8c45c80330b0923b` | IDÉNTICO |
| `src/app/features/insurance/insurance-catalog/plan-form-dialog.html` | `8cdadca3e38f64646736f73775174fd8eb812f3d531dfa0e1409405b03b466a3` | IDÉNTICO |
| `scripts/check-css-tokens.mjs` | `c6c11743fcc9798f1c825a7356cfd89497747d42b62b0809ce7c4ba65735192e` | IDÉNTICO |
| `src/app/shared/components/organisms/auth-stage/auth-stage.css` | `8a045f248e79af6fbe5d0a064c59d90c7e723effcf490100981429e4e4cdb449` | IDÉNTICO |
| `src/app/features/account/pharmacy-hub/pharmacy-shop/pharmacy-shop.css` | `2177a935eee77ab28332348eb36edbdc08199c4f3b9550ececed41cca70158cb` | IDÉNTICO |
| `src/styles.css` | `a3b150c0bd4b9455587fc1a3099127a06f33022a695224b1832d43ab11772740` | IDÉNTICO |
| `src/styles/alovida.css` | `ff4766f91907f113c6699b08b43c9f8fbb168870763da455f3e68c47912888b3` | IDÉNTICO |
| `scripts/check-doc-links.mjs` | `b64c856ce7b45ff2ecc7f9f6cc7598d56615fe97066e27686390ccef3063f6e8` | IDÉNTICO |
| `docs/tareas/subtarea-2.4-transparencia-copagos/verification.md` | `994715d46602232723ec76198e12b87bc2ccad41beeebaa55ebc60bf2af05315` | IDÉNTICO |
| `docs/trabajo/2026-09-25-marcelo-calidad/PLAN.md` | `c7a9fc0be202935db9ffc30d91b231f3d9336c2e684e2aa1a462f1ff43536fdb` | IDÉNTICO |
| `docs/trabajo/2026-09-25-marcelo-calidad/REPORTE.md` | `565715396ac6f3993cde690f6cbdbcc467d6b769c96e04938131725da1cbfdd6` | IDÉNTICO |
| `src/app/core/mock/mock-backend-latencia.spec.ts` | `f84c7b809e911f159dda99f4abd7d851648b70996e119a4e47fb2f6156f77309` | IDÉNTICO |
| `src/app/core/mock/mock-backend.interceptor.ts` | `f33f91c47cc8886a6a1f3f79e3aef9ddc38f604705b2be7a004f3222d5ae0e5b` | IDÉNTICO |
| `src/app/core/mock/fixtures/agenda-ids-estables.spec.ts` | `96ed905cb11cd5975e1102f01a94bcbfdebf4a28fc179a0b7feec24001c6886f` | IDÉNTICO |
| `src/app/core/mock/fixtures/agenda.ts` | `23233b669ef6bcc75866f951138b49f3505f5e522147686255b00a6fb04f67b1` | IDÉNTICO |
| `src/app/core/mock/handlers/insurance-analytics.handlers.spec.ts` | `391849d861ff74faa8fe779241384af6b4d17e90535487713ade6ab44559ed24` | IDÉNTICO |
| `src/app/core/mock/handlers/insurance-analytics.handlers.ts` | `efb208296ece2a057a0916d64c7121082b0d5cd8502322c9967321101f975b8f` | IDÉNTICO |
| `angular.json` | `4f6493690087912e7c1556678c0bf8e7cdbba40413ed64b3c31126d511df29bf` | IDÉNTICO |
| `vitest.config.ts` | `762028e1bb98e09ac32ac086e5dce35f31023b2aa4e9eeebd5fa3203e0466467` | IDÉNTICO |

Comprobación puntual del import denunciado en ambos textos:

```ts
import { esTelefonoCompleto } from '../../shared/components/molecules/phone-input/phone-input.paises';
```

No cubierto: reproducción aislada de los cuatro fallos con cobertura, gates reejecutados sobre un checkout separado de la base, comportamiento visual de superficies externas a C0 y disponibilidad histórica de artifacts/repos hermanos. Esta evidencia es estática salvo las salidas previas citadas; no constituye REGRESSION_VERIFIED.
