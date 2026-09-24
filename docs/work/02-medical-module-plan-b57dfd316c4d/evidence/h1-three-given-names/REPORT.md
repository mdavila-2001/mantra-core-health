# Evidencia parcial H1: nombres de pila desglosados

- Fecha: 2026-09-24.
- Fuente funcional única: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
- Criterio: L0168; escenario MED-E01.
- Ramas examinadas: FE `justin/medical-module-execution-20260924` (`18b05cc3`); API `justin/medical-module-execution-20260924` (`09af2caf`).

## Estado observado

El formulario de alta muestra Primer, Segundo y Tercer nombre y deja agregar otros nombres. El cliente combina el segundo, tercer y nombres dinámicos en `middleName`; el API y la entidad `Persons` sólo exponen `name`, `middleName`, `lastName` y `motherLastName`. Por eso el tercer nombre no vuelve como parte separada para que el profesional la lea/edite después. La presentación de tres campos existe; la persistencia estructurada no.

## Verificación

- `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts` — el runner construyó la app; 97 pruebas aprobadas y 1 fallida (`resuelve los cinco tipos canónicos de credencial desde el backend simulado`) por `ENOSPC: no space left on device, write`. Las pruebas que comprueban el envío del tercer nombre están entre las aprobadas.
- El spec vigente afirma que `middleName: 'María'` más `thirdName: 'Eugenia'` se envían como `middleName: 'María Eugenia'`; y verifica que los nombres adicionales también se pliegan en esa misma cadena.
- Lectura de API: `Persons`/DTO de perfil contienen `middleName`, sin `thirdName`; el registro escribe `dto.middleName` como parte persistente.

## Límite y decisión

L0168 conserva `A MEDIAS / TESTED`; no se declara completa la mera presencia visual. Una parte persistente separada exige una extensión del modelo/DDL compartido que las instrucciones locales actuales prohíben tocar. No se inventa un delimitador ni se divide automáticamente `middleName`, porque una persona puede tener varios nombres reales y el corte no sería recuperable. No se cambió código de producto.
