# Procedencia — plan del módulo Médico

**ID:** `02-medical-module-plan-b57dfd316c4d`.

La única fuente de requisitos funcionales es `/Users/josejeremias/Downloads/02_METAPROMPT_MEDICO.md`. Su copia exacta está en [sources/medical-metaprompt.md](sources/medical-metaprompt.md). Hash SHA-256 observado: `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.

| Parte del plan | Procedencia |
|---|---|
| Secciones A–I | Método común del archivo de Médico. La sección C adapta sólo rutas/nombres de salida al ID exclusivo y a la regla de archivos en inglés. |
| Secciones 1–8 | Requisitos y reglas específicas de Médico, 15 grupos MED, ocho hitos y 17 escenarios. Conservados del archivo indicado. |
| Apéndice L0164–L0266 | Extracto literal del propio metaprompt de Médico, conservado íntegro. El hash del Registro original se rotula como citado/no verificado. |
| Bloque operativo 0 | Elaboración del agente: desglose de hitos y ejecución futura, reglas AGENTS.md aportadas por el usuario, corrección de alcance a Médico y delimitación con otros agentes. No se atribuye este texto al documento fuente. |
| Rutas candidatas | Existencia observada en el frontend local durante la preparación; implementación y referencias `dev` no auditadas. |

El Registro original de 522 líneas citado dentro del metaprompt no se verificó; no se adjunta otro Registro como sustituto. Los requisitos de Paciente se consumen sólo como dependencias explícitas del documento de Médico. No se usa `01_METAPROMPT_PACIENTE.md` como fuente de este plan.

Este paquete pertenece al módulo **Médico** y su único insumo funcional es `02_METAPROMPT_MEDICO.md`. No reemplaza ni supersede ningún plan de Paciente. El campo de procedencia anterior que apuntaba al ID `2026-09-23-plan-cierre-modulo-paciente-efe8db62d87a` era incorrecto y se eliminó de `SOURCES.json`; los paquetes de Paciente y de otros agentes se conservan separados.

Estado de ejecución al 2026-09-24: **PARCIAL**. Se ejecutó y subió una corrección visual CORR-08 en la rama `justin/mockup-corr-38-editar-perfil-medico-como-alta`, commit `55e948a4`, PR borrador [#612](https://github.com/mdavila-2001/mantra-core-health/pull/612). La evidencia y los límites están en el `PLAN.md` y en el reporte enlazado allí. El plan médico completo sigue sin cierre: 10/98 criterios puntuales incluidos alcanzan su DoD; MED-E01/H1 siguen parciales; no se mergeó ni desplegó.
