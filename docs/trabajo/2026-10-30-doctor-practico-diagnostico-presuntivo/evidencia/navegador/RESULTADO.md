# Resultado de la corrida de navegador (simulador)

Base: http://127.0.0.1:4333 · 2026-10-30T21:05:02.376Z

**65 / 65 comprobaciones en verde.**

## Comprobaciones
- ✔ H1 orden: sin formulario médico NO dice «Falta el formulario médico»
- ✔ H1 orden: dice que se registra igual, sin formulario
- ✔ H1 orden: «Pedir estudio» queda HABILITADO sin formulario médico — TSH por quimioluminiscencia
- ✔ H1 orden: salió UN POST /clinical/service-requests — {"custodianTenantId":"7008ddb3-957c-4095-a68f-a9425d52b798","patientProfileId":"413afff1-6002-4723-a627-c552a16a3944","codeConceptId":"ab18a62d-90f3-4f2b-a8ef-ae9e4b452808","category":"OTHER","encounterId":"47984b6b-6bc6-491f-a737-eb146fcba67a"}
- ✔ H1 orden: el cuerpo NO lleva formInstanceId ni basedOnNoteIds
- ✔ H1 orden: el servidor aceptó (2xx) — 201
- ✔ H1 orden: con todo guardado el anfitrión relee y cierra el modal
- ✔ H1 orden: al reabrir, «Estudios pedidos» muestra el estudio (relectura) — TSH por
- ✔ H1 receta: NO dice «Falta el formulario médico»
- ✔ H1 receta: ofrece el formulario como opcional
- ✔ H1 reconsulta: NO dice «Falta el formulario médico»
- ✔ H1 reconsulta: ofrece el formulario como opcional
- ✔ H1 plan de cuidados: NO dice «Falta el formulario médico»
- ✔ H1 plan de cuidados: ofrece el formulario como opcional
- ✔ H2 el bloque ofrece el alta del presuntivo
- ✔ H2 la tabla de presuntivos sigue ahí
- ✔ H2 sin diagnóstico elegido el botón está bloqueado
- ✔ 10-diagnostico-vacio: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 10-diagnostico-vacio: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 10-diagnostico-vacio: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ 10b-diagnostico-tabla: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 10b-diagnostico-tabla: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 10b-diagnostico-tabla: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ H2 con diagnóstico y filas el botón se habilita
- ✔ 11-diagnostico-lleno: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 11-diagnostico-lleno: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 11-diagnostico-lleno: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ H2 resolvió el concepto presuntivo por código en el catálogo
- ✔ H2 salió UN POST /clinical/conditions — {"custodianTenantId":"7008ddb3-957c-4095-a68f-a9425d52b798","patientProfileId":"413afff1-6002-4723-a627-c552a16a3944","codeConceptId":"3faa6968-7f31-4776-a4d3-eb0eb1ee083e","encounterId":"47984b6b-6bc6-491f-a737-eb146fcba67a","noteText":"Cuadro febril con tos de dos días.\nMotivos: Fiebre: 39 °C desde hace dos días; Tos: Productiva, con dolor al respirar","verificationStatusConceptId":"8c0d9e1f-e685-410f-ac2b-76d0dae8001e"}
- ✔ H2 el cuerpo lleva verificationStatusConceptId y NO la palabra PROVISIONAL
- ✔ H2 el cuerpo lleva el resumen en noteText
- ✔ H2 salió UN POST /charts/notes con las filas
- ✔ H2 la nota lleva las dos filas estructuradas (entries) — [{"label":"Fiebre","value":"39 °C desde hace dos días"},{"label":"Tos","value":"Productiva, con dolor al respirar"}]
- ✔ H2 el servidor aceptó el diagnóstico (2xx)
- ✔ H2 con todo guardado el anfitrión relee y cierra el modal (como con cualquier alta de la consulta)
- ✔ H2 tras RECARGAR la tabla muestra el diagnóstico nuevo «En estudio» con Confirmar y Rechazar — persistencia del simulador (sessionStorage)
- ✔ H2 el formulario reabre limpio y con el botón bloqueado
- ✔ 13-tras-recarga-tabla: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 13-tras-recarga-tabla: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 13-tras-recarga-tabla: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ H2 fallo parcial (inyectado): el diagnóstico SÍ se registró
- ✔ H2 fallo parcial: el modal NO se cierra (el anfitrión no recibió `cambio`)
- ✔ H2 fallo parcial: avisa que el diagnóstico quedó registrado y conserva las filas
- ✔ 14a-fallo-parcial-alerta: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 14a-fallo-parcial-alerta: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 14a-fallo-parcial-alerta: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ 14b-fallo-parcial-reintento: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 14b-fallo-parcial-reintento: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 14b-fallo-parcial-reintento: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ H2 reintento: NO vuelve a crear el diagnóstico (0 POST /clinical/conditions)
- ✔ H2 reintento: repite sólo la nota (1 POST /charts/notes, 2xx)
- ✔ H2 reintento: con todo guardado el modal se cierra y no queda el aviso
- ✔ H2 409 (inyectado): el aviso queda EN el campo del diagnóstico
- ✔ H2 el formulario médico se completó (POST …/close)
- ✔ H2 con un formulario llenado el diagnóstico ofrece traerlo
- ✔ H2 las respuestas del formulario aparecen como filas editables — 10 filas
- ✔ H2 dice qué se trajo — Se trajeron 10 respuestas como motivos: puede editarlas o quitarlas.
- ✔ H2 cada fila traída lleva la respuesta de SU campo (valores distintos por campo) — 10 filas · cruzadas: 0 · ej.: {"campo":"Motivo de consulta","valor":"Respuesta de «Motivo de consulta»"}
- ✔ 16-desde-formulario-llenado: sin desborde horizontal en movil — 0 elementos fuera
- ✔ 16-desde-formulario-llenado: sin desborde horizontal en tablet — 0 elementos fuera
- ✔ 16-desde-formulario-llenado: sin desborde horizontal en escritorio — 0 elementos fuera
- ✔ H2 el diagnóstico queda vinculado al formulario de origen (noteText) — Del formulario «Anamnesis / Historia clínica general» (30 oct, 09:04 p. m.).
Motivos: Motivo de consulta: Respuesta de «
- ✔ H2 la nota estructurada se crea con las filas del formulario
- ✔ Expediente: «Nuevo diagnóstico» ofrece el alta del presuntivo
- ✔ Expediente: sin encuentro no ofrece traer un formulario

## Notas
- Sesión: medica@alovida.mock → http://127.0.0.1:4333/dashboard
- Consulta: http://127.0.0.1:4333/medical-records/413afff1-6002-4723-a627-c552a16a3944/consultation?booking=28aa15af-fb14-493d-a7ad-396ed50842bc&motivo=Mareos%20frecuentes&cita=6f18e4e1-e236-4193-a63a-58d274b99fa4
- Estudio elegido: «Perfil lipidico»
- «Perfil lipidico» pide algo más que el formulario (otro requisito): se prueba otro.
- Estudio elegido: «TSH por quimioluminiscencia»
- Diagnóstico elegido: «Hipertensión arterial esencial»
- escribió «Fiebre» en campo
- escribió «39 °C desde hace dos días» en valor
- escribió «Tos» en campo
- escribió «Productiva, con dolor al respirar» en valor
- escribió «Cuadro febril con tos de dos días.» en hallazgos
- escribió «Sed» en campo
- escribió «Intensa desde hace una semana» en valor
- Plantilla elegida: «Anamnesis / Historia clínica general»
- Campos del formulario: 19 · obligatorios completados: 3
- Formulario elegido: «Formulario médico · 30 oct, 09:04 p. m. · el más reciente»

## Consola y excepciones inesperadas
- console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://127.0.0.1:4333/ai/v1/diagnosis/suggest

## Errores de consola ESPERADOS (de un fallo inyectado a propósito)
- console.error: [API] POST /charts/notes → 500 · INTERNAL · «Simulado: fallo del servidor.» · correlationId=mock-fallo {status: 500, code: INTERNAL, message: Simulado: fallo del servidor., correlationId: mock-fallo} @ http://127.0.0.1:4333/main.js
- console.error: [API] POST /clinical/conditions → 409 · CONFLICT · «Simulado: ya existe un registro así.» · correlationId=mock-fallo {status: 409, code: CONFLICT, message: Simulado: ya existe un registro así., correlationId: mock-fallo} @ http://127.0.0.1:4333/main.js
