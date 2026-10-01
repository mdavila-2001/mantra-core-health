# Evidencia D4 — cierre del formulario (Playwright suelto contra ng serve)

Fecha: 2026-09-26T02:08:03.168Z · Base: http://localhost:4221

- Sesión: medica@alovida.mock → http://localhost:4221/dashboard
- Consulta: http://localhost:4221/medical-records/413afff1-6002-4723-a627-c552a16a3944/consultation?booking=a1e0e8d1-0372-461b-adaf-176adc82309c&motivo=Mareos%20frecuentes&cita=8a4d96f7-5695-4025-a5fa-680e4a34b96c
- Antes — Diagnóstico: «2 en la historia» · Orden de análisis: «(sin cantidad)»
- Plantilla elegida: «Anamnesis y antecedentes odontológicos»
- Campo respondido: «Motivo de consulta

*

(obligatorio)» de 18 campos

- Estado del cierre:
  Cierre del formulario
  Con lo respondido en «Anamnesis y antecedentes odontológicos», la IA sugiere diagnósticos tentativos y análisis. Elegí lo que corresponda o dejá los dos campos vacíos: la ficha se completa igual.
  Bronquitis aguda
  J20.9
  67 %
  La fiebre y la tos son síntomas cardinales de la bronquitis, aunque el dolor al respirar es menos frecuente.
  Pruebas: Radiografía de tórax
  Usar como diagnóstico tentativo
  Neumonía
  J18.9
  59 %
  La combinación de fiebre, tos y dolor al respirar (pleurítico) sugiere un proceso infeccioso pulmonar.
  Pruebas: Radiografía de tórax, Procalcitonina, Hemocultivo, Gasometría arterial
  Usar como diagnóstico tentativo
  Gripe (influenza)
  J11.1
  42 %
  La gripe suele cursar con fiebre y tos, aunque el dolor al respirar suele ser menos intenso que en una neumonía.
  Pruebas: Radiografía de tórax
  Usar como diagnóstico tentativo
  Bronquiolitis
  J21.9
  28 %
  Por tos y fiebre.
  Usar como diagnóstico tentativo
  Crup (laringotraqueítis aguda)
  J05.0
  25 %
  Por tos y fiebre.
  Usar como diagnóstico tentativo
  Análisis sugeridos
  Radiografía de tórax
  Imagenología
  Usar como orden
  Procalcitonina
  Laboratorio
  Usar como orden
  Hemocultivo
  Laboratorio
  Usar como orden
  Gasometría arterial
  Laboratorio
  Usar como orden
  Apoyo al criterio médico; no es un diagnóstico. El diagnóstico nace como presuntivo y lo confirma o rechaza el profesional.
  Diagnóstico tentativo
  Sin diagnóstico tentativo
  Sin diagnóstico tentativo
  Hipertensión arterial esencial
  Diabetes mellitus tipo 2
  Dislipidemia
  Asma bronquial
  Lumbalgia
  Enfermedad por reflujo gastroesofágico
  Trastorno de ansiedad generalizada
  Hipotiroidismo
  Infección urinaria
  Infección respiratoria aguda
  Gonartrosis
  Migraña
  Obesidad
  Anemia ferropénica
  Dermatitis atópica
  Opcional. Nace presuntivo: se confirma o rechaza en la casilla «Diagnóstico».
  Categoría de la orden
  Seleccionar opción
  Sin categoría
  Laboratorio
  Imagenología
  Otro
  Opcional. Laboratorio, imagenología u otro.
  Orden de análisis
  Sin orden de análisis
  Sin orden de análisis
  Hemograma completo
  Glucosa en ayunas
  Perfil lipídico
  TSH
  Examen general de orina
  Radiografía de tórax
  Ecografía abdominal
  Electrocardiograma
  Resonancia de rodilla
  Tomografía de cráneo
  Creatinina en sangre
  Urea en sangre
  Hemoglobina glicosilada
  Tiempo de coagulación
  Perfil hepático
  Coproparasitológico
  Urocultivo con antibiograma
  Vitamina D
  Mamografía bilateral
  Ecografía obstétrica
  Radiografía de columna
  Tomografía de abdomen
  Resonancia de cerebro
  Densitometría ósea
  Opcional. Se pide al completar la ficha, dentro de esta consulta.
- Selectores del cierre: 3
- «Usar» el primer tentativo → selector de diagnóstico: «Sin diagnóstico tentativo»
- Avisos tras «Usar»: Advertencia:

Sin corre pondencia en el catálogo

«Bronquiti aguda» (J20.9) no e tá en el catálogo de diagnó tico . Elegilo a mano.

- «Usar» la primera orden → categoría: «Imagenología» · estudio: «Radiografía de tórax»
- Estudio cambiado a «Densitometría ósea» para esquivar la antiduplicación del simulador.
- Elegido — diagnóstico: «Infección respiratoria aguda» · categoría: «Laboratorio» · estudio: «Densitometría ósea»
- Obligatorios de la ficha completados: 2
- Desborde horizontal a 375: no
- Avisos tras completar:
  8
  4
  Listo:

Formulario completado

«Anamnesis y antecedentes odontológicos» quedó guardada en la ficha.
Listo:

Diagnóstico tentativo registrado

Nace presuntivo: confirmalo o rechazalo en la casilla «Diagnóstico».
Listo:

Orden de análisis pedida

Quedó en la casilla «Orden de análisis» de esta consulta.

- Después de recargar — Diagnóstico: «3 en la historia» · Orden de análisis: «(sin cantidad)»
- Casilla «Orden de análisis» tras recargar: NO lista la densitometría — texto: Laboratorio e imagenología
  E tudio

*

(obligatorio)
Elegí un e tudio
Elegí un e tudio
Hemograma completo
Gluco a en ayuna
Perfil lipídico
TSH
Examen general de orina
Radiografía de tórax
Ecografía abdominal
Electrocardiograma
Re onancia de rodilla
Tomografía de cráneo
Creatinina en angre
Urea en angre
Hemoglobina glico ilada
Tiempo de coagulación
Perfil hepático
Copropara itológico
Urocultivo con antibiograma
Vitamina D
Mamografía bilateral
Ecografía ob tétrica
Radiografía de columna
Tomografía de abdomen
Re onancia de cerebro
Den itometría ó ea

Del catálogo de terminología. Qué análi i o

## Peticiones al servicio de IA

- POST http://localhost:4221/ai/v1/diagnosis/suggest → 200
- POST http://localhost:4221/ai/v1/diagnosis/suggest → 200

## Problemas (consola, pageerror, script)

- console: Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'sha256-Ohy6Wz7NFFGmQaVW/a8g5BXylUJrN/hbRM2QuMglZ6Q=' 'sha256-HasAYtZ13nA92vtyhOH9KYrQLVFmnxB9+lraZXpGRQc=''. Either the 'unsafe-inline' keyword, a hash ('sha256-VM2mZqyEQZoLzoTrp5EigFvzQ0+f1wSeBuoOn95WHCg='), or a nonce ('nonce-...') is required to enable inline execution. The action has been blocked.
- console: Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'sha256-Ohy6Wz7NFFGmQaVW/a8g5BXylUJrN/hbRM2QuMglZ6Q=' 'sha256-HasAYtZ13nA92vtyhOH9KYrQLVFmnxB9+lraZXpGRQc=''. Either the 'unsafe-inline' keyword, a hash ('sha256-kSSVmtxCwx5BcVxBHL/eBew1IVRG78eha+qAq9Y8B38='), or a nonce ('nonce-...') is required to enable inline execution. The action has been blocked.

## Corrección leída de la captura 06

La línea «NO lista la densitometría» de arriba es un falso negativo del script (leyó el texto del
anfitrión antes de que la lista se pintara). La captura `06-orden-en-su-casilla-tras-recargar-1440.png`
muestra, después de recargar, «Estudios pedidos» con la fila **Densitometría ósea · Laboratorio ·
Pendiente · Sin resultado todavía**: la orden pedida desde el cierre persistió y se ve en su casilla.
