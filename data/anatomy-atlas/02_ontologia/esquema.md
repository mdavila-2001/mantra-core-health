# Ontología de la taxonomía Netter v2

## Entidades
`REGION`, `SUBREGION`, `LAMINA`, `ENTRADA_INDICE`, `ESTRUCTURA_ANATOMICA`, `CONDICION_CLINICA`, `FUENTE`.

## Relaciones seguras
`PERTENECE_A_REGION`, `PERTENECE_A_SUBREGION`, `APARECE_EN_LAMINA`, `TIENE_TIPO_LEXICAL`, `TIENE_EVIDENCIA_OCR`, `TIENE_FUENTE`.

## Relaciones que requieren evidencia adicional
`IRRIGA`, `DRENA`, `INERVA`, `SE_INSERTA_EN`, `SE_ORIGINA_EN`, `CAUSA`, `TRATA`, `ES_SINTOMA_DE`.

Estas últimas **no deben generarse** únicamente a partir de coaparición en una lámina o índice.
