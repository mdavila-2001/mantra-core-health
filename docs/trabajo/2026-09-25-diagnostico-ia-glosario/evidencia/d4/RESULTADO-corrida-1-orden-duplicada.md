# Evidencia D4 — cierre del formulario (Playwright suelto contra ng serve)

Fecha: 2026-09-26T02:03:20.108Z · Base: http://localhost:4221

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
  Pidiendo sugerencias a la IA…
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
- Elegido — diagnóstico: «Infección respiratoria aguda» · categoría: «Laboratorio» · estudio: «Hemograma completo»
- Obligatorios de la ficha completados: 2
- Desborde horizontal a 375: no
- Avisos tras completar:
  8
  4
  Advertencia:

La ficha quedó guardada, pero no todo el cierre

No se registró la orden de análisis: Ya existe un estudio igual reciente.
Listo:

Formulario completado

«Anamnesis y antecedentes odontológicos» quedó guardada en la ficha.
Listo:

Diagnóstico tentativo registrado

Nace presuntivo: confirmalo o rechazalo en la casilla «Diagnóstico».
Error:

La ficha quedó guardada, pero no todo el cierre

No se registró la orden de análisis: Ya existe un estudio igual reciente.

- Después de recargar — Diagnóstico: «3 en la historia» · Orden de análisis: «(sin cantidad)»

## Peticiones al servicio de IA

- POST http://localhost:4221/ai/v1/diagnosis/suggest → 200
- POST http://localhost:4221/ai/v1/diagnosis/suggest → 200

## Problemas (consola, pageerror, script)

- console: Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'sha256-Ohy6Wz7NFFGmQaVW/a8g5BXylUJrN/hbRM2QuMglZ6Q=' 'sha256-HasAYtZ13nA92vtyhOH9KYrQLVFmnxB9+lraZXpGRQc=''. Either the 'unsafe-inline' keyword, a hash ('sha256-VM2mZqyEQZoLzoTrp5EigFvzQ0+f1wSeBuoOn95WHCg='), or a nonce ('nonce-...') is required to enable inline execution. The action has been blocked.
- console: Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'sha256-Ohy6Wz7NFFGmQaVW/a8g5BXylUJrN/hbRM2QuMglZ6Q=' 'sha256-HasAYtZ13nA92vtyhOH9KYrQLVFmnxB9+lraZXpGRQc=''. Either the 'unsafe-inline' keyword, a hash ('sha256-kSSVmtxCwx5BcVxBHL/eBew1IVRG78eha+qAq9Y8B38='), or a nonce ('nonce-...') is required to enable inline execution. The action has been blocked.
