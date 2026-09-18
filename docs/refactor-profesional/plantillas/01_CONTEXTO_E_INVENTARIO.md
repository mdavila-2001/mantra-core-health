# Contrato de CONTEXTO_REAL.md e INVENTARIO.md

Estos campos son instrucciones para generar documentos con hechos del proyecto. Las filas ilustrativas no son evidencia de una app real.

## Contexto

Registrar nombre observado, propósito, audiencia conocida, roles, tareas principales, idiomas, dispositivos, restricciones, alcance autorizado y exclusiones. Para cada dato registrar fuente y confianza. Si no se conoce, escribir “no determinado” con la acción de descubrimiento necesaria.

## Entorno

Tabla con herramienta, versión declarada, versión ejecutada, archivo que la fija, comando disponible y resultado. Enumerar variables por nombre y propósito, nunca por valor secreto. Registrar proveedor de autenticación y datos solo cuando el repositorio los demuestre.

## Inventario de rutas

| Campo | Contenido |
|---|---|
| ID | Identificador estable, por ejemplo ROUTE-001 |
| Ruta real | Patrón exacto del router y parámetros relevantes |
| Propósito | Tarea que permite completar |
| Roles | Visibilidad y permisos verificados |
| Entrada/salida | Navegación y enlaces profundos |
| Acciones | Lectura, escritura, exportación u otras reales |
| Estados | Carga, vacío, error y estados específicos |
| Dependencias | Componentes y contratos de datos |
| Evidencia | Captura, recorrido o archivo inspeccionado |
| Estado de inspección | Ejecutado, estático, no accesible o excluido |

## Inventario de componentes

Nombre y ruta real; consumidores; responsabilidad; variantes; tokens utilizados; estados; dependencias no visuales; problemas conocidos; candidato a mantener, consolidar o sustituir. No usar la cantidad de líneas como único criterio.

## Baseline

Por medición: fecha, candidato, URL, rol, viewport, tema, datos, equipo, navegador, red/CPU/caché, comando, resultado y archivo de evidencia. Para experiencia cualitativa, describir tarea y observación sin inventar métricas poblacionales.
