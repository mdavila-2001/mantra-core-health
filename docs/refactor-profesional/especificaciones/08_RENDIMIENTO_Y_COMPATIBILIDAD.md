# Rendimiento, compatibilidad y presupuestos

## Métricas de referencia

Google propone como valores buenos LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1, evaluados en percentil 75 de datos de campo y segmentados por móvil/escritorio. La fuente es [Web Vitals](https://web.dev/articles/vitals). No sustituir INP de campo con TBT ni con una única pulsación automatizada: esos datos pueden orientar el diagnóstico, pero miden cosas distintas.

Antes de tener datos de campo, el informe debe decir “laboratorio” y describir equipo, versión, red, CPU, caché, URL y datos. No afirmar que toda la base de usuarios cumple esos umbrales porque una prueba local salga bien.

## Establecer un presupuesto situado

1. Medir rutas críticas en el entorno reproducible existente. Separar primer acceso y navegación posterior.
2. Inventariar JS, CSS, fuentes, imágenes, solicitudes y costes de componentes pesados.
3. Definir un límite por ruta y una tolerancia basada en variabilidad observada. Evitar un número universal de KB sin conocer la app.
4. Toda dependencia o efecto nuevo declara coste medido, beneficio y alternativa más simple.
5. Un incremento que supera presupuesto debe optimizarse o tener una decisión explícita. No redefinir automáticamente el presupuesto para aprobar el cambio.

Propuesta de control inicial: impedir regresiones de recursos transferidos o tiempo reproducible superiores al 10 % sin revisión cuando la variabilidad de la medición permita distinguirlas. Ese 10 % es una política sugerida, no un estándar. Sustituirlo por un umbral basado en datos del proyecto.

## Rutas de optimización

| Señal | Investigar primero | Evitar |
|---|---|---|
| Carga inicial lenta | Recurso LCP, respuesta servidor, bloqueo y tamaño inicial | Añadir lazy loading al recurso principal indiscriminadamente |
| Interacción lenta | Tareas largas, cálculo síncrono y render excesivo | Suponer que todo se arregla con memoización |
| Saltos de layout | Dimensiones de medios, fuentes, banners, skeletons | Usar skeleton con geometría distinta del resultado |
| Scroll irregular | Filtros, capas grandes, eventos y listas | Blur sobre toda la página y listeners sin necesidad |
| Lista grande | Paginación, consultas, coste por fila, virtualización selectiva | Virtualizar sin conservar lectura accesible y búsqueda |
| Red redundante | Efectos, invalidación, peticiones duplicadas y caché | Ocultar un problema de datos con un spinner más bonito |

## Compatibilidad progresiva

Definir navegadores por contrato del producto y datos de uso, no por la máquina del desarrollador. Si no existe una política, proponer Chrome/Edge, Firefox y Safari en versiones soportadas por el producto, con matriz móvil acorde al público. La versión exacta se fija en fase 00 y se registra en los reportes.

Los efectos avanzados deben activarse mediante detección de capacidad y conservar una presentación funcional de respaldo. Un navegador sin View Transitions conserva navegación; uno sin blur conserva superficie opaca. No bloquear contenido esperando soporte de un efecto.

## Ensayo reproducible

Preparar fixture de datos de tamaño conocido; mismo build y ruta; misma condición de caché; varias ejecuciones para observar variación. Informar mediana y rango en laboratorio, evitando presentar un percentil estable con una muestra mínima. Guardar trazas útiles para explicar el cuello de botella.

En móvil real revisar temperatura, batería y fluidez si los efectos son relevantes. Un emulador de viewport no reproduce necesariamente GPU, CPU ni interacción táctil del dispositivo.

## Optimización responsable

Dividir carga por rutas o funcionalidades cuando el framework lo permita. Mantener recursos críticos priorizados. Reservar dimensiones de medios. Reducir fuentes/pesos y respetar la licencia. Evitar una dependencia de gran tamaño para una transición que CSS resuelve.

El perfilado debe preceder a cambios complejos. No introducir caches, workers ni algoritmos nuevos sin identificar el coste que resuelven. La mejora debe conservar resultados, orden y reglas de actualización.

## Aceptación

Existe una tabla baseline/candidato comparable. Las regresiones están resueltas o decididas explícitamente. Los efectos degradan de manera funcional. Se conoce qué falta medir en campo. La app no necesita un dispositivo de alta gama para completar las tareas básicas incluidas.
