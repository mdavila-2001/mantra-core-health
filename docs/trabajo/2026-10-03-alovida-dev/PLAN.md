# AloVida Dev: revisión de correcciones acumuladas

Objetivo: publicar ramas nuevas con los cambios propios hacia dev y test.

1. Inventariar cambios locales, comparar con origin/dev y origin/test.
2. Integrar títulos, nombres adicionales y logos sin revertir cambios actuales.
3. Verificar tests, lint y compilación; documentar alcance y evidencia.
4. Empaquetar complementos de semillas sin archivos privados.
5. Publicar PRs coordinados; API antes que frontend.

Las ramas de test parten de origin/test y reciben los commits propios, pues las bases tienen historias distintas. No se mezclan ramas completas.

Criterio de aceptación: diff limitado a correcciones, checks locales verdes y enlaces remotos. El CI remoto determina cuándo salen de borrador.
