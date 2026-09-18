# Contratos y criterios de extracción

## Mapa de responsabilidad

Átomo: control semántico básico. Molécula: propósito local. Organismo: región funcional. Plantilla: composición. Página: contexto real de ruta. Los casos de uso y adaptadores viven según la funcionalidad, no dentro de niveles visuales.

## Aplicación de SOLID

Separar razones de cambio; habilitar extensiones reales mediante composición; preservar promesas de variantes; reducir interfaces a lo necesario; proteger políticas de detalles de infraestructura. Una interfaz útil incluye errores y efectos, no solo tipos.

## Caso ilustrativo

Un SaveButton llama un endpoint, transforma datos, valida reglas y decide un toast. Separar control visual de caso de uso cuando esa mezcla dificulte varios consumidores. El consumidor conecta estado ocupado y resultado; el adaptador resuelve formato del transporte. La nueva interfaz debe reducir conocimiento en los consumidores. Si solo agrega un proxy sin beneficio, simplificar.

## Pruebas

Verificar resultado confirmado, rechazo, conflicto y resultado desconocido donde apliquen. El test cruza el mismo contrato que usa la UI. Una prueba del mock no garantiza persistencia. Un componente reutilizable debe conservar semántica, foco y estados en todas sus variantes.

## Contrato de salida

Problema de acoplamiento; interfaz propuesta; consumidores; garantías; archivos; comparación de complejidad; pruebas; migración; retirada. Registrar qué depende de backend para no inventar garantías locales.

Referencia de composición: [Brad Frost, Atomic Design](https://atomicdesign.bradfrost.com/chapter-2/). Esta skill propone la combinación con módulos por funcionalidad; no es una estructura de carpetas impuesta por el autor.
