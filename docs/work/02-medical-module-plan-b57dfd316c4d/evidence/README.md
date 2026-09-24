# Evidencia del plan Médico

No hubo cambio visual de producto, por lo que no existe captura antes/después ni corrección declarada como hecha. Se inspeccionó localmente una captura Playwright de /my-account en modo mock y se revisó su geometría: viewport 1440×1000, body blanco, área principal de 1200 px y tarjeta de 1120 px, con márgenes laterales iguales de 40 px. La captura fue temporal y no se archiva como evidencia de corrección ni de journey clínico.

El filtro médico específico aprobó 381 pruebas en 7 archivos con dobles, sin ejecutar suites MyProfile de Paciente. La suite frontend completa actual aprobó 7.375 pruebas. Estos resultados acreditan pruebas unitarias/componentes, no API→DB→recarga.

El último intento registrado de Playwright carril-19-route-health.spec.ts falló en beforeAll porque la API de localhost:3005 no estaba saludable. No generó fotos del recorrido. No se asignó un número de corrección NN sin una ficha aplicable, así que no se ejecutó scripts/corr-evidencia.sh NN.

Una integración aislada de registro profesional aprobó 8/8 en DB desechable con semillas parciales; no ejecutó DDL canónica ni un journey end-to-end. No se guardaron datos personales reales; los fixtures del perfil inspeccionado son de la cuenta sintética de prueba.
