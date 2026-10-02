# Decisiones de ejecución

- La evidencia y documentos de ejecución permanecen bajo el ID único `Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192`.
- La rama se actualizó con `git merge --ff-only origin/mockup` a `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2`. El ajuste del banner ya está en upstream por PR #598 / `9d3f4b54`; no se duplica el cambio de producto. Esta rama agrega prueba y evidencia.
- Se limitó la regresión a rutas actuales y se añadió verificación de H1 esperado. `/my-account/loyalty` redirige a `/my-account` por N-03/Q-17 en la base actual; se excluyó del set visual y se incluye `/my-account/promotions`.
- La auditoría oficial corre desde una copia física aislada y usa el runner/spec sin cambios; sólo el manifiesto temporal se filtra a cinco rutas para no escribir evidencia compartida de lane 34.
- Se amplió la auditoría de navegación global: `scripts/corr-rutas.mjs` generó 58 rutas en copia física y `scripts/corr-evidencia.sh 34 --antes` midió 232 celdas como `medica`. Se guardaron matriz y 232 fotos bajo el ID del plan. Las 22 filas móviles de 375 px fallan scroll; las demás métricas pasan. No cubre pasada completa con actor `paciente` ni altas públicas.
- El overflow confirmado a 375 px termina en x=380 en `.app-header__derecha`/avatar y document width=380 en tres rutas. PR #604 modifica los mismos archivos compartidos de `shell-layout` e incluye ajuste hasta 400 px; no se duplica la solución mientras esté abierto.
- La fase de aceptación dirigida a `/laboratory-directory` falló exactamente en la aserción de scroll a 375 px, demostrando que la aceptación detecta el defecto. El test y sus salidas quedan sólo en la copia aislada.
- Las 20 fotos oficiales se revisaron una por una. Ocho fotos 1440 `fullPage` muestran el menú fijo sobre contenido largo; se conservan como diagnóstico. Las siete capturas de viewport se usan para valorar el aviso móvil.
- H1–H6 no se marcan terminados: `mockup` utiliza datos en memoria y las restricciones vigentes impiden integrar API/modelo y acuerdos de otros módulos.
- No se modifica la matriz ni se crea el `REPORT.md` global de lane 34 por el incidente documentado. El archivo ajeno modificado bajo `docs/trabajo/2026-09-22-ender-simulador-cabecera/` se conserva sin stage.
