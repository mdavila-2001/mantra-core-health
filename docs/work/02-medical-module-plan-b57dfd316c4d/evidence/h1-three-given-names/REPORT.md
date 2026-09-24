# Evidencia parcial H1: nombres de pila desglosados

- Fecha: 2026-09-24.
- Fuente funcional única: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
- Criterio: L0168; escenario MED-E01.
- Ramas examinadas: FE `justin/medical-module-execution-20260924` (`18b05cc3`); API `justin/medical-module-execution-20260924` (`09af2caf`).

## Estado observado

El formulario de alta y el editor muestran Primer, Segundo y Tercer nombre y dejan agregar otros. El cliente combina los nombres desde el segundo en `middleName`; el API y la entidad `Persons` exponen `name`, `middleName`, `lastName` y `motherLastName`. El editor reconstruye los campos con `separarNombres()`, que los parte por espacios. La estrategia conserva nombres de una palabra, pero no distingue espacios internos de un nombre compuesto.

## Verificación

- `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts` — el runner construyó la app; 97 pruebas aprobadas y 1 fallida (`resuelve los cinco tipos canónicos de credencial desde el backend simulado`) por `ENOSPC: no space left on device, write`. Las pruebas que comprueban el envío del tercer nombre están entre las aprobadas.
- El spec vigente afirma que `middleName: 'María'` más `thirdName: 'Eugenia'` se envían como `middleName: 'María Eugenia'`; y verifica que los nombres adicionales también se pliegan en esa misma cadena.
- Lectura de API: `Persons`/DTO de perfil contienen `middleName`, sin `thirdName`; el registro escribe `dto.middleName` y la lectura propia lo devuelve. El test del editor confirma que los nombres adicionales vuelven a sus casillas al separar la cadena por espacios.

## Límite y decisión

L0168 conserva `A MEDIAS / TESTED` hasta que un recorrido de datos sintéticos pruebe alta→API→PostgreSQL→recarga en las tres casillas. No se inventa un delimitador ni se cambia modelo/DDL: la fuente no pide expresamente conservar espacios dentro de nombres compuestos. La ambigüedad actual de ese caso queda anotada; no se cambió código de producto.
