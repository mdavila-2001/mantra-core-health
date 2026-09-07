/* ============================================================================
    El generador de datos del backend simulado.

    Punto de entrada único: los fixtures importan `fk` desde aquí y nunca
    `@faker-js/faker` directamente. Dos motivos, y los dos han mordido a otros
    proyectos antes:

      1. **La semilla.** `faker` a secas arranca aleatorio y rompe el
         determinismo del que depende todo el mock (ver `semilla.ts`). Pasando
         por `fk.conSemilla(...)` no hay forma de olvidarlo.

      2. **El peso.** `@faker-js/faker` no es pequeño. Todo esto vive detrás del
         `import('./handlers')` perezoso del interceptor, así que no toca el
         paquete inicial —donde sí hay presupuesto (620 kB de aviso, 1,3 MB de
         error en `angular.json`)—. Con un único punto de entrada, comprobar
         que nadie lo importa desde fuera de `core/mock` es un `grep`, y eso es
         justamente lo que hace la prueba de `mock-backend.spec.ts`.

    Se importa el locale español, no el genérico: `fakerES` trae nombres y
    apellidos que un lector boliviano reconoce. Lo que el locale no cubre
    —cédulas, NIT, celulares +591, municipios, mapas— lo pone `bolivia.ts`, y
    lo clínico lo pone `clinico.ts` eligiendo siempre del catálogo real.
    ========================================================================== */

export { apellido, conSemilla, semillaDe, slugDeNombre } from './semilla';

export {
  ASEGURADORAS,
  BANCOS,
  LUGARES,
  LUGARES_PRINCIPALES,
  ORGANIZACIONES_SALUD,
  PLANES,
  bolivianos,
  cedula,
  cedulaSimple,
  celular,
  coordenada,
  direccion,
  lugar,
  matricula,
  nit,
  telefonoFijo,
  type LugarBoliviano,
} from './bolivia';

export {
  CODIGOS_DX,
  CODIGOS_MED,
  biografia,
  diagnosticoId,
  edadDe,
  medicamentoId,
  motivoDeConsulta,
  notaDeEvolucion,
  posologia,
  severidadId,
  signosVitales,
  unidadId,
  viaId,
  type SignoVital,
} from './clinico';
