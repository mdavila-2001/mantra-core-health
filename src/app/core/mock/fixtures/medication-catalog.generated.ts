// ARCHIVO GENERADO por scripts/build-catalog-fixture.mjs — no editar a mano.
// Subconjunto REAL de CIMA (AEMPS) e INVIMA, ver el encabezado del script.
import type { CatalogProduct } from '../../data-access/pharmacy/pharmacy.types';

/** `medicationCode` es el medicamento del vademécum del simulador que comparte ATC nivel 5. */
export interface CatalogFixtureRow extends CatalogProduct {
  readonly medicationCode: string | null;
}

export const CATALOGO_MEDICAMENTOS: readonly CatalogFixtureRow[] = [
  {
    "id": "fcac7662-ab24-5452-b185-07756c6b84ee",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "57773",
    "display": "RENITEC 20 mg COMPRIMIDOS",
    "holder": "Organon Salud S.L.",
    "strengthText": "20 mg enalapril maleato",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ENALAPRIL MALEATO",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09AA02"
    ],
    "presentations": [
      {
        "code": "861070",
        "name": "RENITEC 20 mg COMPRIMIDOS , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/57773/57773_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/57773/57773_materialas.jpg",
      "attribution": "AEMPS · CIMA — RENITEC 20 mg COMPRIMIDOS (nº reg. 57773), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=57773",
    "medicationCode": "MED-ENALAPRIL"
  },
  {
    "id": "ee27795d-bc09-59da-87e9-3be6a26ea7a3",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62644",
    "display": "ENALAPRIL STADA 5 mg COMPRIMIDOS EFG",
    "holder": "Laboratorio Stada S.L.",
    "strengthText": "5 mg",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "ENALAPRIL MALEATO",
        "amount": "5",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09AA02"
    ],
    "presentations": [
      {
        "code": "849661",
        "name": "ENALAPRIL STADA 5 mg  COMPRIMIDOS EFG, 60 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62644/62644_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62644/62644_materialas.jpg",
      "attribution": "AEMPS · CIMA — ENALAPRIL STADA 5 mg COMPRIMIDOS EFG (nº reg. 62644), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62644",
    "medicationCode": "MED-ENALAPRIL"
  },
  {
    "id": "9bc07594-893a-55b3-8e4d-6e82582829b9",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62645",
    "display": "ENALAPRIL STADA 20 mg COMPRIMIDOS EFG",
    "holder": "Laboratorio Stada S.L.",
    "strengthText": "20 mg",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "ENALAPRIL MALEATO",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09AA02"
    ],
    "presentations": [
      {
        "code": "850560",
        "name": "ENALAPRIL STADA  20 mg COMPRIMIDOS EFG, 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62645/62645_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62645/62645_materialas.jpg",
      "attribution": "AEMPS · CIMA — ENALAPRIL STADA 20 mg COMPRIMIDOS EFG (nº reg. 62645), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62645",
    "medicationCode": "MED-ENALAPRIL"
  },
  {
    "id": "edba6992-2f84-512b-aed6-942ecee7eded",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63166",
    "display": "ENALAPRIL VIATRIS 20 MG COMPRIMIDOS EFG",
    "holder": "Viatris Limited",
    "strengthText": "20 mg enalapril maleato",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "ENALAPRIL MALEATO",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09AA02"
    ],
    "presentations": [
      {
        "code": "999820",
        "name": "ENALAPRIL VIATRIS 20 MG COMPRIMIDOS EFG, 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63166/63166_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63166/63166_materialas.jpg",
      "attribution": "AEMPS · CIMA — ENALAPRIL VIATRIS 20 MG COMPRIMIDOS EFG (nº reg. 63166), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63166",
    "medicationCode": "MED-ENALAPRIL"
  },
  {
    "id": "a7770f63-2f2a-5085-807e-12dca41547b4",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2010M-0010318",
    "display": "PRESUREN 20 MG TABLETAS",
    "holder": "PATMAR S.A.",
    "strengthText": "20 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "ENALAPRIL MALEATO",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09AA02"
    ],
    "presentations": [
      {
        "code": "19999405-1",
        "name": "MARCA:SIN DATOBLÍSTER DE PVC-PVDC/ALUMINIO EN CAJA POR 20 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19999405-3",
        "name": "MARCA:SIN DATOBLÍSTER DE PVC-PVDC/ALUMINIO EN CAJA POR 330 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19999405-6",
        "name": "GENÉRICO:SIN DATOBLÍSTER DE PVC-PVDC/ALUMINIO EN CAJA POR 330 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19999405-4",
        "name": "GENÉRICO:SIN DATOBLÍSTER DE PVC-PVDC/ALUMINIO EN CAJA POR 10 TABLETAS.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-ENALAPRIL"
  },
  {
    "id": "8792d9f9-c73c-5487-989f-db86efae225c",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2018M-012662-R3",
    "display": "ENALAPRIL MALEATO 5 MG TABLETAS",
    "holder": "PENTACOOP S.A.",
    "strengthText": "5 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "ENALAPRIL MALEATO",
        "amount": "5",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09AA02"
    ],
    "presentations": [
      {
        "code": "43757-5",
        "name": "CAJA PLEGADIZA POR 50 TABLETAS EN BLÍSTER PVC/PE/PVDC BLANCO/ALUMINIO POR 10 TABLETAS CADA BLÍSTER.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-ENALAPRIL"
  },
  {
    "id": "ab4e8b83-569e-56ca-ac27-52b634041702",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "60913",
    "display": "COZAAR 50 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Organon Salud S.L.",
    "strengthText": "50 mg losartan potasico",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LOSARTAN POTASICO",
        "amount": "50,0",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09CA01"
    ],
    "presentations": [
      {
        "code": "682229",
        "name": "COZAAR 50 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/60913/60913_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/60913/60913_materialas.jpg",
      "attribution": "AEMPS · CIMA — COZAAR 50 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 60913), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=60913",
    "medicationCode": "MED-LOSARTAN"
  },
  {
    "id": "20b62eb5-0e25-5c96-bec8-e21282241217",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62117",
    "display": "COZAAR 12.5 mg INICIO COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Organon Salud S.L.",
    "strengthText": "12,5 mg losartan potasico",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LOSARTAN POTASICO",
        "amount": "12,5",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09CA01"
    ],
    "presentations": [
      {
        "code": "659094",
        "name": "COZAAR 12.5 mg INICIO COMPRIMIDOS RECUBIERTOS CON PELICULA , 7 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62117/62117_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62117/62117_materialas.jpg",
      "attribution": "AEMPS · CIMA — COZAAR 12.5 mg INICIO COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 62117), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62117",
    "medicationCode": "MED-LOSARTAN"
  },
  {
    "id": "bf229a17-a39a-5565-a5d2-2720b5b27f7b",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "64971",
    "display": "COZAAR 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Organon Salud S.L.",
    "strengthText": "100 mg losartan potasico",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LOSARTAN POTASICO",
        "amount": "100,0",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09CA01"
    ],
    "presentations": [
      {
        "code": "809186",
        "name": "COZAAR 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/64971/64971_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/64971/64971_materialas.jpg",
      "attribution": "AEMPS · CIMA — COZAAR 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 64971), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=64971",
    "medicationCode": "MED-LOSARTAN"
  },
  {
    "id": "cfb33415-bda7-5cd6-873e-1df89577ba7d",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "67631",
    "display": "LOSARTAN SANDOZ 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Sandoz Farmaceutica S.A.",
    "strengthText": "100 mg losartan potasio",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "LOSARTAN POTASICO",
        "amount": "100",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09CA01"
    ],
    "presentations": [
      {
        "code": "652236",
        "name": "LOSARTAN SANDOZ 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 28 comprimidos (BLISTER)",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/67631/67631_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/67631/67631_materialas.jpg",
      "attribution": "AEMPS · CIMA — LOSARTAN SANDOZ 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 67631), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=67631",
    "medicationCode": "MED-LOSARTAN"
  },
  {
    "id": "361868ad-bcd4-525d-9717-01c3cb17cc3e",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2013M-0014220",
    "display": "LOSARTAN POTASICO 100 MG TABLETA RECUBIERTA",
    "holder": "LABORATORIO INTERNACIONAL DE COLOMBIA S.A.S.. LABINCO S.A.S.",
    "strengthText": "100 mg",
    "dosageForm": "TABLETA RECUBIERTA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "LOSARTAN POTASICO",
        "amount": "100",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09CA01"
    ],
    "presentations": [
      {
        "code": "20049336-3",
        "name": "CAJA POR 15 TABLETAS RECUBIERTAS EN BLISTER PVC/PVDC/PE/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20049336-9",
        "name": "CAJA POR 105 TABLETAS RECUBIERTAS EN BLISTER PVC/PVDC/PE/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20049336-7",
        "name": "CAJA POR 375 TABLETAS RECUBIERTAS EN BLISTER PVC/PVDC/PE/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20049336-11",
        "name": "CAJA POR 200 TABLETAS RECUBIERTAS EN BLISTER PVC/PVDC/PE/ALUMINIO",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-LOSARTAN"
  },
  {
    "id": "91639cf0-1151-5a43-b9eb-01eedb8ab825",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2014M-0002904-R1",
    "display": "LOSARTAN 50 MG. TABLETAS CUBIERTAS",
    "holder": "LABORATORIOS RAVEN COLOMBIA S.A.S.",
    "strengthText": "50 mg",
    "dosageForm": "TABLETA CUBIERTA CON PELICULA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "LOSARTÁN POTÁSICO",
        "amount": "50",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09CA01"
    ],
    "presentations": [
      {
        "code": "19940171-10",
        "name": "USO INSTITUCIONAL CAJA POR 300 TABLETAS EN BLISTER DE ALUMINIO/PVC (INCOLORO).",
        "gtin": null,
        "active": true
      },
      {
        "code": "19940171-13",
        "name": "CAJA POR 300 TABLETAS EN BLÍSTER DE ALUMINIO/PVC (INCOLORO)",
        "gtin": null,
        "active": true
      },
      {
        "code": "19940171-3",
        "name": "CAJA POR 30 TABLETAS EN BLISTER DE ALUMINIO/PVC (INCOLORO).",
        "gtin": null,
        "active": true
      },
      {
        "code": "19940171-12",
        "name": "USO INSTITUCIONAL CAJA POR 30 TABLETAS EN BLISTER DE ALUMINIO/PVC (INCOLORO).",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-LOSARTAN"
  },
  {
    "id": "ee838417-0e87-55dc-9622-f56c33548005",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "55211",
    "display": "DIANBEN 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Merck Sante",
    "strengthText": "850 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "METFORMINA HIDROCLORURO",
        "amount": "850",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "689877",
        "name": "DIANBEN 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA, 50 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/55211/55211_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/55211/55211_materialas.jpg",
      "attribution": "AEMPS · CIMA — DIANBEN 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 55211), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=55211",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "f2f8dec2-c50c-5a71-b89c-303543c68fa8",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "68167",
    "display": "METFORMINA CINFA 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorios Cinfa S.A.",
    "strengthText": "850 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "METFORMINA HIDROCLORURO",
        "amount": "850",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "656367",
        "name": "METFORMINA CINFA 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 50 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/68167/68167_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/68167/68167_materialas.jpg",
      "attribution": "AEMPS · CIMA — METFORMINA CINFA 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 68167), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=68167",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "4bf1b845-7418-5d18-acac-b4bdb127f630",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "71269",
    "display": "METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Sandoz Farmaceutica S.A.",
    "strengthText": "850 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "METFORMINA HIDROCLORURO",
        "amount": "850,00",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "670938",
        "name": "METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 50 comprimidos",
        "gtin": null,
        "active": true
      },
      {
        "code": "763926",
        "name": "METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 60 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/71269/71269_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/71269/71269_materialas.jpg",
      "attribution": "AEMPS · CIMA — METFORMINA SANDOZ 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 71269), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=71269",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "95515839-537b-5939-a365-b70ab2921d72",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "72222",
    "display": "METFORMINA VIATRIS 1000 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Viatris Limited",
    "strengthText": "1000 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "METFORMINA HIDROCLORURO",
        "amount": "1000,00",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "689260",
        "name": "METFORMINA VIATRIS 1000 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 30 comprimidos",
        "gtin": null,
        "active": true
      },
      {
        "code": "689259",
        "name": "METFORMINA VIATRIS 1000 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 50 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/72222/72222_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/72222/72222_materialas.jpg",
      "attribution": "AEMPS · CIMA — METFORMINA VIATRIS 1000 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 72222), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=72222",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "46bfabc3-c00e-5b29-a4d4-6085d1c5ac3d",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2008M-0008511",
    "display": "METFORMINA 500 MG TABLETASRECUBIERTAS",
    "holder": "GENFAR S.A.",
    "strengthText": "500 mg",
    "dosageForm": "TABLETA RECUBIERTA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "METFORMINACLORHIDRATO GRANULADOC.D. 95% 526.32 MG( EQUIVALENTEAMETFORMINACLORHIDRATO**",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "19993385-6",
        "name": "CAJA X 600 TABLETAS RECUBIERTAS EN BLISTER X 10 TABLETAS RECUBIERTAS BLISTER ALUMINIO-PVC/PVDC ÁMBAR",
        "gtin": null,
        "active": true
      },
      {
        "code": "19993385-7",
        "name": "CAJA X 900 TABLETAS RECUBIERTAS EN BLISTER X 10 TABLETAS RECUBIERTAS BLISTER ALUMINIO-PVC/PVDC ÁMBAR",
        "gtin": null,
        "active": true
      },
      {
        "code": "19993385-1",
        "name": "CAJASIN DATOXSIN DATO30SIN DATOTABLETASSIN DATORECUBIERTASSIN DATOENSIN DATOBLISTERSIN DATOXSIN DATO10 TABLETAS RECUBIERTAS EN BLISTER ALUMINIO-PVC/PVDC ÁMBAR",
        "gtin": null,
        "active": true
      },
      {
        "code": "19993385-5",
        "name": "CAJA X 300 TABLETAS RECUBIERTAS EN BLISTER X 10 TABLETAS RECUBIERTAS BLISTER ALUMINIO-PVC/PVDC ÁMBAR",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "87ceee27-79fd-5e45-be29-66fac75552fb",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2008M-0008534",
    "display": "GLIFORMIN 1000 TABLETAS CUBIERTAS",
    "holder": "LABORATORIOS SIEGFRIED S.A.S.",
    "strengthText": "1000 mg",
    "dosageForm": "TABLETA CUBIERTA CON PELICULA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "METFORMINA CLORHIDRATO GRANULOS DC 95% EQUIVALENTE AMETFORMINA CLORHIDRATO (*)",
        "amount": "1000",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "19988017-4",
        "name": "CAJA X 10 TABLETAS CUBIERTAS EN BLÍSTER PVC TRANSPARENTE-ALUMINIO.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19988017-9",
        "name": "CAJA POR 300 TABLETAS RECUBIERTAS EN BLISTER EN PVC TRANSPARENTE/ALUMINIO POR 10 TABLETAS RECUBIERTAS C/U",
        "gtin": null,
        "active": true
      },
      {
        "code": "19988017-1",
        "name": "CAJA CON 30 TABLETAS EN BLISTER PVC TRANSPARENTE - ALUMINIO.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19988017-7",
        "name": "CAJA POR 100 TABLETAS RECUBIERTAS EN BLISTER EN PVC TRANSPARENTE/ALUMINIO POR 10 TABLETAS RECUBIERTAS C/U",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "406ac9bd-3588-5056-a7dc-4301834aa8a0",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "67066",
    "display": "METFORMINA PHARMAKERN 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Kern Pharma S.L.",
    "strengthText": "850 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "METFORMINA HIDROCLORURO",
        "amount": "850",
        "unit": "mg"
      }
    ],
    "atc": [
      "A10BA02"
    ],
    "presentations": [
      {
        "code": "652200",
        "name": "METFORMINA PHARMAKERN 850 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 50 comprimidos",
        "gtin": null,
        "active": false
      }
    ],
    "regulatoryStatus": "REVOKED",
    "selectable": false,
    "photo": null,
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=67066",
    "medicationCode": "MED-METFORMINA"
  },
  {
    "id": "e046c9d0-59f8-558f-b70e-a21935d8d4f0",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "61654",
    "display": "ZARATOR 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "10 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ATORVASTATINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "C10AA05"
    ],
    "presentations": [
      {
        "code": "715334",
        "name": "ZARATOR 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/61654/61654_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/61654/61654_materialas.jpg",
      "attribution": "AEMPS · CIMA — ZARATOR 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 61654), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=61654",
    "medicationCode": "MED-ATORVASTATINA"
  },
  {
    "id": "4d887532-f270-5608-a83c-e60d8cc0d673",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "61655",
    "display": "ZARATOR 20 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "20 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ATORVASTATINA",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "C10AA05"
    ],
    "presentations": [
      {
        "code": "669069",
        "name": "ZARATOR 20 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/61655/61655_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/61655/61655_materialas.jpg",
      "attribution": "AEMPS · CIMA — ZARATOR 20 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 61655), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=61655",
    "medicationCode": "MED-ATORVASTATINA"
  },
  {
    "id": "87632199-c4bf-5b5f-9213-46824741f31d",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "61656",
    "display": "ZARATOR 40 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "40 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ATORVASTATINA",
        "amount": "40",
        "unit": "mg"
      }
    ],
    "atc": [
      "C10AA05"
    ],
    "presentations": [
      {
        "code": "669051",
        "name": "ZARATOR 40 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/61656/61656_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/61656/61656_materialas.jpg",
      "attribution": "AEMPS · CIMA — ZARATOR 40 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 61656), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=61656",
    "medicationCode": "MED-ATORVASTATINA"
  },
  {
    "id": "507f2ebf-6d75-5263-b90c-886fa58470b0",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "61716",
    "display": "CARDYL 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "10 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ATORVASTATINA CALCICA TRIHIDRATO",
        "amount": "10,85",
        "unit": "mg"
      }
    ],
    "atc": [
      "C10AA05"
    ],
    "presentations": [
      {
        "code": "716886",
        "name": "CARDYL 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 28 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/61716/61716_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/61716/61716_materialas.jpg",
      "attribution": "AEMPS · CIMA — CARDYL 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 61716), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=61716",
    "medicationCode": "MED-ATORVASTATINA"
  },
  {
    "id": "b00fbadc-e98b-5b2e-a77e-5da717c6ea50",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2008M-0009030",
    "display": "ATORFIT. TABLETA X 20 MG.",
    "holder": "BIOQUIFAR PHARMACEUTICA S.A.",
    "strengthText": "21.7 mg.",
    "dosageForm": "TABLETA CUBIERTA CON PELICULA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "ATORVASTATINA CALCICA EQUIVALENTE A 20.00 MG.DE ATORVASTATINA .",
        "amount": "21.7",
        "unit": "mg."
      }
    ],
    "atc": [
      "C10AA05"
    ],
    "presentations": [
      {
        "code": "19996671-1",
        "name": "CAJA X 10 TABLETAS EN BLISTER PP/ALU/PVC/PVDCSIN DATOX 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19996671-4",
        "name": "CAJA X 250 BLISTER EN BLISTER PP/ALU/PVC/PVDCSIN DATOX 10 TABLETAS. USO INSTITUCIONAL.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19996671-2",
        "name": "CAJA X 30 TABLETAS EN BLISTER EN PP/ALU/PVC/PVDCSIN DATOX 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19996671-3",
        "name": "CAJA X 100 BLISTER EN BLISTER PP/ALU/PVC/PVDCSIN DATOX 10 TABLETAS",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-ATORVASTATINA"
  },
  {
    "id": "f8e397ea-abca-5a1d-a64e-076c8af3eca5",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-0009397",
    "display": "ATORFIT TABLETA X 10 MG",
    "holder": "BIOQUIFAR PHARMACEUTICA S.A.",
    "strengthText": "10 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "ATORVASTATINA CALCICA 10.85 MG EQUIVALENTE A ATORVASTATINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "C10AA05"
    ],
    "presentations": [
      {
        "code": "19996546-2",
        "name": "CAJA POR 30 TABLETAS EN BLISTER DE ALU/ALUSIN DATOPOR 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19996546-1",
        "name": "CAJA POR 10 TABLETAS EN BLISTER DE ALU/ALUSIN DATOPOR 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19996546-4",
        "name": "CAJA POR 250 TABLETAS EN BLISTER DE ALU/ALUSIN DATOPOR 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19996546-3",
        "name": "CAJA POR 100 TABLETAS EN BLISTER DE ALU/ALUSIN DATOPOR 10 TABLETAS",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-ATORVASTATINA"
  },
  {
    "id": "161b6c28-60bd-57ad-a5cb-5bb1e6d088ee",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "50239",
    "display": "CLAMOXYL 500 mg CAPSULAS DURAS",
    "holder": "Glaxosmithkline S.A.",
    "strengthText": "500 mg",
    "dosageForm": "CÁPSULA DURA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "AMOXICILINA TRIHIDRATO",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01CA04"
    ],
    "presentations": [
      {
        "code": "695334",
        "name": "CLAMOXYL 500 mg CAPSULAS DURAS , 20 cápsulas",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/50239/50239_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/50239/50239_materialas.jpg",
      "attribution": "AEMPS · CIMA — CLAMOXYL 500 mg CAPSULAS DURAS (nº reg. 50239), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=50239",
    "medicationCode": "MED-AMOXICILINA"
  },
  {
    "id": "87b641e6-6f95-5b5f-878c-632cb7a0c3ba",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "59133",
    "display": "CLAMOXYL 1g COMPRIMIDOS DISPERSABLES",
    "holder": "Glaxosmithkline S.A.",
    "strengthText": "1000 mg",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "AMOXICILINA TRIHIDRATO",
        "amount": "1",
        "unit": "g"
      }
    ],
    "atc": [
      "J01CA04"
    ],
    "presentations": [
      {
        "code": "695341",
        "name": "CLAMOXYL 1g COMPRIMIDOS DISPERSABLES, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/59133/59133_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/59133/59133_materialas.jpg",
      "attribution": "AEMPS · CIMA — CLAMOXYL 1g COMPRIMIDOS DISPERSABLES (nº reg. 59133), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=59133",
    "medicationCode": "MED-AMOXICILINA"
  },
  {
    "id": "c1bbdb68-e7ad-52ab-9f25-b0aaa76f6751",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62338",
    "display": "AMOXICILINA SANDOZ 500 mg CAPSULAS DURAS EFG",
    "holder": "Sandoz Farmaceutica S.A.",
    "strengthText": "500 mg",
    "dosageForm": "CÁPSULA DURA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "AMOXICILINA TRIHIDRATO",
        "amount": "574",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01CA04"
    ],
    "presentations": [
      {
        "code": "695000",
        "name": "AMOXICILINA SANDOZ 500 mg CAPSULAS DURAS EFG , 20 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "695001",
        "name": "AMOXICILINA SANDOZ 500 mg CAPSULAS DURAS EFG , 30 cápsulas",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62338/62338_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62338/62338_materialas.jpg",
      "attribution": "AEMPS · CIMA — AMOXICILINA SANDOZ 500 mg CAPSULAS DURAS EFG (nº reg. 62338), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62338",
    "medicationCode": "MED-AMOXICILINA"
  },
  {
    "id": "f6953d66-1af0-5bd6-abf1-81cc833b4839",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62339",
    "display": "AMOXICILINA SANDOZ 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Sandoz Farmaceutica S.A.",
    "strengthText": "750 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "AMOXICILINA TRIHIDRATO",
        "amount": "861",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01CA04"
    ],
    "presentations": [
      {
        "code": "695639",
        "name": "AMOXICILINA SANDOZ 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 20 comprimidos",
        "gtin": null,
        "active": true
      },
      {
        "code": "695640",
        "name": "AMOXICILINA SANDOZ 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62339/62339_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62339/62339_materialas.jpg",
      "attribution": "AEMPS · CIMA — AMOXICILINA SANDOZ 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 62339), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62339",
    "medicationCode": "MED-AMOXICILINA"
  },
  {
    "id": "84febd45-4740-5c20-bc43-a89e2f789b74",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2008 M-011328 R1",
    "display": "AMOXICILINA 250 MG / 5 ML PPR",
    "holder": "MEMPHIS PRODUCTS S.A.",
    "strengthText": "5 g",
    "dosageForm": "POLVO PARA RECONSTITUIR A SUSPENSION ORAL",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "AMOXICILINA TRIHIDRATO EQUIVALENTE A AMOXICILINA BASE *",
        "amount": "5",
        "unit": "g"
      }
    ],
    "atc": [
      "J01CA04"
    ],
    "presentations": [
      {
        "code": "216979-8",
        "name": "FRASCO DE PEAD X 53.33 G DE POLVO PARA RECONSTITUIR A 120 ML.",
        "gtin": null,
        "active": true
      },
      {
        "code": "216979-5",
        "name": "FRASCO DE PEADSIN DATOX 20 G DE POLVO PARA RECONSTITUIR A 45 ML",
        "gtin": null,
        "active": true
      },
      {
        "code": "216979-7",
        "name": "FRASCO DE PEAD X 40 G DE POLVO PARA RECONSTITUIR A 90 ML",
        "gtin": null,
        "active": true
      },
      {
        "code": "216979-9",
        "name": "FRASCO DE PEAD X45.9 G DE POLVO PARA RECONSTITUIR A 100 ML",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-AMOXICILINA"
  },
  {
    "id": "84e3ab2e-c01e-50a7-ba85-eea06aec24ef",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-0010124",
    "display": "AMOXICILINA500 MGCAPSULAS",
    "holder": "BIOQUIMICO PHARMAS.A.",
    "strengthText": "500 mg",
    "dosageForm": "CAPSULA DURA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "AMOXICILINA TRIHIDRATO COMPACTADA EQUIVALENTE A AMOXICILINA BASE",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01CA04"
    ],
    "presentations": [
      {
        "code": "20004301-1",
        "name": "CAJA POR 20 CAPSULAS EN BLISTER PVC/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20004301-2",
        "name": "CAJA POR 50 CAPSULAS EN BLISTER PVC/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20004301-3",
        "name": "CAJA POR 250 CAPSULAS EN BLISTER PVC/ALUMINIO",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-AMOXICILINA"
  },
  {
    "id": "3e72c0ee-dc1f-56ce-b162-89da5a79c738",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "60514",
    "display": "ESPIDIFEN 400 mg GRANULADO PARA SOLUCION ORAL SABOR MENTA",
    "holder": "Zambon S.A.U.",
    "strengthText": "400 mg",
    "dosageForm": "GRANULADO PARA SOLUCIÓN ORAL",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "IBUPROFENO ARGININA",
        "amount": "770",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "735498",
        "name": "ESPIDIFEN 400 mg GRANULADO PARA SOLUCION ORAL SABOR MENTA , 30 sobres",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/60514/60514_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/60514/60514_materialas.jpg",
      "attribution": "AEMPS · CIMA — ESPIDIFEN 400 mg GRANULADO PARA SOLUCION ORAL SABOR MENTA (nº reg. 60514), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=60514",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "b8e7e84a-0d6d-5384-9727-5ff48e163d2b",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63597",
    "display": "IBUFEN 400 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Laboratorios Cinfa S.A.",
    "strengthText": "400 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "IBUPROFENO",
        "amount": "400",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "674911",
        "name": "IBUFEN 400 mg COMPRIMIDOS RECUBIERTOS CON PELICULA 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63597/63597_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63597/63597_materialas.jpg",
      "attribution": "AEMPS · CIMA — IBUFEN 400 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 63597), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63597",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "c8777b02-1842-5153-864e-f6bdf6a665d0",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "64584",
    "display": "DOLORAC 600 mg POLVO PARA SUSPENSION ORAL",
    "holder": "Laboratorio De Aplicaciones Farmacodinamicas S.A.",
    "strengthText": "600 mg ibuprofeno",
    "dosageForm": "POLVO PARA SUSPENSIÓN ORAL",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "IBUPROFENO LISINA",
        "amount": "1025",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "825992",
        "name": "DOLORAC 600 mg POLVO PARA SUSPENSION ORAL, 20 sobres",
        "gtin": null,
        "active": true
      },
      {
        "code": "848101",
        "name": "DOLORAC 600 mg POLVO PARA SUSPENSION ORAL, 40 sobres",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/64584/64584_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/64584/64584_materialas.jpg",
      "attribution": "AEMPS · CIMA — DOLORAC 600 mg POLVO PARA SUSPENSION ORAL (nº reg. 64584), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=64584",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "91bf0040-06bb-5dad-b271-bcd49b0cf60d",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "65250",
    "display": "IBUPROFENO NORMON 400 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorios Normon S.A.",
    "strengthText": "400 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "IBUPROFENO",
        "amount": "400",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "754267",
        "name": "IBUPROFENO NORMON 400 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/65250/65250_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/65250/65250_materialas.jpg",
      "attribution": "AEMPS · CIMA — IBUPROFENO NORMON 400 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 65250), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=65250",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "dec1262d-9166-5ce2-a79e-b9c8714e0e83",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-0009420",
    "display": "BUPROFEN 800 MG",
    "holder": "LABQUIFAR LTDA.",
    "strengthText": "800 mg",
    "dosageForm": "TABLETA CUBIERTA CON PELICULA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "IBUPROFENO",
        "amount": "800",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "20003532-5",
        "name": "BLISTER DE PVC TRANSPARENTE / ALUMINIO X 10 TABLETAS. CAJA PORSIN DATO100 TABLETAS PARA PRESENTACIÓN INSTITU",
        "gtin": null,
        "active": true
      },
      {
        "code": "20003532-8",
        "name": "BLISTER DE PVC TRANSPARENTE / ALUMINIO X 10 TABLETAS EN CAJA POR 20TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "20003532-1",
        "name": "BLISTER DE PVC TRANSPARENTE / ALUMINIO X 10 TABLETAS EN CAJA POR 10 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "20003532-9",
        "name": "BLISTER DE PVC TRANSPARENTE / ALUMINIO X 10 TABLETAS EN CAJA POR 30 TABLETAS.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "849e94cf-6b2f-5041-99de-8ffed561e4e8",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-012990-R1",
    "display": "CALMIDOL COMPUESTO",
    "holder": "EUROFARMA COLOMBIA S.A.S.",
    "strengthText": "200 mg + 30 mg",
    "dosageForm": "CAPSULA DURA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "IBUPROFENO",
        "amount": "200",
        "unit": "mg"
      },
      {
        "name": "CAFEINA ANHIDRA",
        "amount": "30",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "229857-8",
        "name": "CAJA POR 24 TABLETAS EN BLISTER POR 2 C/U",
        "gtin": null,
        "active": true
      },
      {
        "code": "229857-6",
        "name": "CAJA PLEGADIZA DE CARTULINA POR 2 CÁPSULAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "229857-9",
        "name": "CAJA POR 48 TABLETAS EN BLISTER POR 2 C/U",
        "gtin": null,
        "active": true
      },
      {
        "code": "229857-4",
        "name": "CAJA PLEGADIZA DE CARTULINA POR 48 CAPSULAS",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "2bb082c8-5f67-5a6c-adc6-07fddfffe15f",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62258",
    "display": "DOCTRIL FORTE 400 MG COMPRMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Jntl Consumer Health (Spain) S.L.",
    "strengthText": "400 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "IBUPROFENO LISINA",
        "amount": "400",
        "unit": "mg"
      }
    ],
    "atc": [
      "M01AE01"
    ],
    "presentations": [
      {
        "code": "656538",
        "name": "DOCTRIL FORTE 400 MG COMPRMIDOS RECUBIERTOS CON PELICULA, 10 comprimidos",
        "gtin": null,
        "active": false
      }
    ],
    "regulatoryStatus": "SUSPENDED",
    "selectable": false,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62258/62258_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62258/62258_materialas.jpg",
      "attribution": "AEMPS · CIMA — DOCTRIL FORTE 400 MG COMPRMIDOS RECUBIERTOS CON PELICULA (nº reg. 62258), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62258",
    "medicationCode": "MED-IBUPROFENO"
  },
  {
    "id": "9d692293-ae6b-5009-9786-e31933c43916",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "23203",
    "display": "TERMALGIN 500 mg COMPRIMIDOS",
    "holder": "Haleon Spain S.A.",
    "strengthText": "500 mg paracetamol",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "PARACETAMOL",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BE01"
    ],
    "presentations": [
      {
        "code": "833673",
        "name": "TERMALGIN 500 mg COMPRIMIDOS, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/23203/23203_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/23203/23203_materialas.jpg",
      "attribution": "AEMPS · CIMA — TERMALGIN 500 mg COMPRIMIDOS (nº reg. 23203), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=23203",
    "medicationCode": "MED-PARACETAMOL"
  },
  {
    "id": "51afbb8e-1603-57d1-b2dc-3f0def365c50",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "43990",
    "display": "TERMALGIN 650 mg COMPRIMIDOS",
    "holder": "Haleon Spain S.A.",
    "strengthText": "650 mg",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "PARACETAMOL",
        "amount": "650",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BE01"
    ],
    "presentations": [
      {
        "code": "851162",
        "name": "TERMALGIN 650 mg COMPRIMIDOS, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/43990/43990_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/43990/43990_materialas.jpg",
      "attribution": "AEMPS · CIMA — TERMALGIN 650 mg COMPRIMIDOS (nº reg. 43990), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=43990",
    "medicationCode": "MED-PARACETAMOL"
  },
  {
    "id": "edd15471-a8ff-5b54-8cd8-b414be11df07",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "52010",
    "display": "GELOCATIL 650 mg COMPRIMIDOS",
    "holder": "Vemedia Pharma Hispania S.A.",
    "strengthText": "650 mg paracetamol",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "PARACETAMOL",
        "amount": "650",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BE01"
    ],
    "presentations": [
      {
        "code": "731397",
        "name": "GELOCATIL 650 mg COMPRIMIDOS, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/52010/52010_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/52010/52010_materialas.jpg",
      "attribution": "AEMPS · CIMA — GELOCATIL 650 mg COMPRIMIDOS (nº reg. 52010), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=52010",
    "medicationCode": "MED-PARACETAMOL"
  },
  {
    "id": "c5896155-e853-52db-907f-5c3e9cefc05c",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "56423",
    "display": "ANTIDOL 500 mg COMPRIMIDOS RECUBIERTOS",
    "holder": "Laboratorios Cinfa S.A.",
    "strengthText": "500 mg paracetamol",
    "dosageForm": "COMPRIMIDO RECUBIERTO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "PARACETAMOL",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BE01"
    ],
    "presentations": [
      {
        "code": "961805",
        "name": "ANTIDOL  500 mg COMPRIMIDOS RECUBIERTOS , 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/56423/56423_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/56423/56423_materialas.jpg",
      "attribution": "AEMPS · CIMA — ANTIDOL 500 mg COMPRIMIDOS RECUBIERTOS (nº reg. 56423), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=56423",
    "medicationCode": "MED-PARACETAMOL"
  },
  {
    "id": "64d411d4-8666-5e4d-9b2c-7ebe8dea4147",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2016M-0004911-R1",
    "display": "DOLINFAR® 100 MG/ML SOLUCIÓN ORAL",
    "holder": "COOPERATIVA MULTIACTIVA DE PRODUCCIÓN DISTRIBUCIÓN. COMERCIALIZACIÓN Y SERVICIOS FARMACOOP -FARMACOOP-",
    "strengthText": "100 mg",
    "dosageForm": "SOLUCION ORAL",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "ACETAMINOFEN",
        "amount": "100",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BE01"
    ],
    "presentations": [
      {
        "code": "19954065-1",
        "name": "CAJA CON UN FRASCO GOTERO DE POLIETILENO DE BAJA DENSIDAD POR 30 ML.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-PARACETAMOL"
  },
  {
    "id": "ce052562-cbed-5704-a393-54c1511d0109",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2016M-0005221-R1",
    "display": "ACETAMINOFEN 500 MG",
    "holder": "LABORATORIO INTERNACIONAL DE COLOMBIA S.A.S - LABINCO S.A.S",
    "strengthText": "500 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "ACETAMINOFEN COMPRESIÓN DIRECTA 90% PRECOMPACTADO EQUIVALENTE A ACETAMINOFÉN",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BE01"
    ],
    "presentations": [
      {
        "code": "19954763-7",
        "name": "CAJA POR 50 BLISTER PVC TRANSPARENTE/ALUMINIO POR 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19954763-8",
        "name": "CAJA POR 10 BLISTER PCV TRANSPARENTE/ALUMINIO POR 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19954763-2",
        "name": "CAJA POR 500 BLISTER PVC TRANSPARENTE/ALUMINIO POR 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19954763-4",
        "name": "USO INSTITUCIONAL: CAJA POR 20 BLISTER PVC TRANSPARENTE/ALUMINIO POR 10 TABLETAS",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-PARACETAMOL"
  },
  {
    "id": "a61697e0-a34b-59f9-a207-f3b32e7abc30",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62763",
    "display": "OMEPRAZOL VIATRIS 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG",
    "holder": "Viatris Pharmaceuticals S.L.",
    "strengthText": "20 mg",
    "dosageForm": "CÁPSULA DURA GASTRORRESISTENTE",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "OMEPRAZOL",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "A02BC01"
    ],
    "presentations": [
      {
        "code": "889592",
        "name": "OMEPRAZOL VIATRIS 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG, 28 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "709503",
        "name": "OMEPRAZOL VIATRIS 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG, 28 cápsulas ",
        "gtin": null,
        "active": true
      },
      {
        "code": "709504",
        "name": "OMEPRAZOL VIATRIS 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG, 56 cápsulas (frasco)",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62763/62763_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62763/62763_materialas.jpg",
      "attribution": "AEMPS · CIMA — OMEPRAZOL VIATRIS 20 MG CAPSULAS DURAS GASTRORRESISTENTES EFG (nº reg. 62763), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62763",
    "medicationCode": "MED-OMEPRAZOL"
  },
  {
    "id": "314924c4-1b74-5bca-a044-955525638158",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62764",
    "display": "OMEPRAZOL CINFAMED 20 mg CAPSULAS DURAS GASTRORESISTENTES EFG",
    "holder": "Laboratorios Cinfa S.A.",
    "strengthText": "20 mg omeprazol",
    "dosageForm": "CÁPSULA DURA GASTRORRESISTENTE",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "OMEPRAZOL",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "A02BC01"
    ],
    "presentations": [
      {
        "code": "887646",
        "name": "OMEPRAZOL CINFAMED 20 mg CAPSULAS DURAS GASTRORESISTENTES EFG , 14 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "887638",
        "name": "OMEPRAZOL CINFAMED 20 mg CAPSULAS DURAS GASTRORESISTENTES EFG , 28 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "600140",
        "name": "OMEPRAZOL CINFAMED 20 mg CAPSULAS DURAS GASTRORESISTENTES EFG , 500 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "901413",
        "name": "OMEPRAZOL CINFAMED 20 mg CAPSULAS DURAS GASTRORESISTENTES EFG , 56 cápsulas",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62764/62764_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62764/62764_materialas.jpg",
      "attribution": "AEMPS · CIMA — OMEPRAZOL CINFAMED 20 mg CAPSULAS DURAS GASTRORESISTENTES EFG (nº reg. 62764), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62764",
    "medicationCode": "MED-OMEPRAZOL"
  },
  {
    "id": "3f6ad6c8-1aef-53a0-b1a2-73aa993f20db",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63710",
    "display": "OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG",
    "holder": "Laboratorios Normon S.A.",
    "strengthText": "20 mg",
    "dosageForm": "CÁPSULA DURA GASTRORRESISTENTE",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "OMEPRAZOL",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "A02BC01"
    ],
    "presentations": [
      {
        "code": "834655",
        "name": "OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG , 14 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "834697",
        "name": "OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG , 28 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "712497",
        "name": "OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG,56 cápsulas",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63710/63710_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63710/63710_materialas.jpg",
      "attribution": "AEMPS · CIMA — OMEPRAZOL NORMON 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG (nº reg. 63710), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63710",
    "medicationCode": "MED-OMEPRAZOL"
  },
  {
    "id": "ee6f7c10-02e3-571f-bfb0-bec149e8b9df",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63908",
    "display": "OMEPRAZOL STADA 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG",
    "holder": "Laboratorio Stada S.L.",
    "strengthText": "20 mg",
    "dosageForm": "CÁPSULA DURA GASTRORRESISTENTE",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "OMEPRAZOL",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "A02BC01"
    ],
    "presentations": [
      {
        "code": "767491",
        "name": "OMEPRAZOL STADA 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG , 28 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "692442",
        "name": "OMEPRAZOL STADA 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG , 28 cápsulas (FRASCO)",
        "gtin": null,
        "active": true
      },
      {
        "code": "767509",
        "name": "OMEPRAZOL STADA 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG , 56 cápsulas",
        "gtin": null,
        "active": true
      },
      {
        "code": "712909",
        "name": "OMEPRAZOL STADA 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG,56 cápsulas (frasco)",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63908/63908_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63908/63908_materialas.jpg",
      "attribution": "AEMPS · CIMA — OMEPRAZOL STADA 20 mg CAPSULAS DURAS GASTRORRESISTENTES EFG (nº reg. 63908), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63908",
    "medicationCode": "MED-OMEPRAZOL"
  },
  {
    "id": "03795d23-6598-5f97-9d43-7fc63e8c1659",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2012M- 012793-R2",
    "display": "ORAZOLE 40 MG CAPSULAS",
    "holder": "LABORATORIOS BUSSIÉ S.A.",
    "strengthText": "40 mg",
    "dosageForm": "CAPSULA DURA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "MICROGÁNULOS DE OMEPRAZOL AL 8.58% 466MG EQUIVALENTES A 40 MG DE OMEPRAZOL",
        "amount": "40",
        "unit": "mg"
      }
    ],
    "atc": [
      "A02BC01"
    ],
    "presentations": [
      {
        "code": "40026-3",
        "name": "CAJA POR 15 CÁPSULAS (3 CAJAS CON BLISTER DE PVC TRANSPARENTE / ALUMINIO POR 5 CÁPSULAS CADA UNA EN BOLSA DE SEGURIDAD DE ALU/PE",
        "gtin": null,
        "active": true
      },
      {
        "code": "40026-13",
        "name": "USO INSTITUCIONAL:CAJA POR 15 CÁPSULAS (3 BLISTER DE PVC TRANSPARENTE / ALUMINIO POR 5 CÁPSULAS CADA UNO)SIN DATOEN BOLSA DE SEGURIDAD DE ALU/PE.",
        "gtin": null,
        "active": true
      },
      {
        "code": "40026-1",
        "name": "CAJA POR 30 CÁPSULAS (3 BLISTER DE PVC TRANSPARENTE / ALUMINIO POR 10 CÁPSULAS CADA UNO)SIN DATOEN BOLSA DE SEGURIDAD DE ALU/PE",
        "gtin": null,
        "active": true
      },
      {
        "code": "40026-19",
        "name": "USO INSTITUCIONAL:CAJA MÚLTIPLE Y/O DISPENSADORA POR 240 CÁPSULAS (16 BLISTER DE PVC TRANSPARENTE / ALUMINIO POR 5 CÁPSULAS CADA UNO EN BOLSA.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-OMEPRAZOL"
  },
  {
    "id": "ea8460ec-eca4-5fba-a22f-65cb76e75ee5",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2012M-0001713-R1",
    "display": "GASTROSEF® 20 MG",
    "holder": "ANZG LTDA",
    "strengthText": "20 mg",
    "dosageForm": "CAPSULA DURA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "OMEPRAZOL PELLETS AL 8.5%EQUIVALENTEA OMEPRAZOL",
        "amount": "20",
        "unit": "mg"
      }
    ],
    "atc": [
      "A02BC01"
    ],
    "presentations": [
      {
        "code": "19929991-2",
        "name": "CAJA PLEGADIZA POR 14 CÁPSULAS DURAS EN BLISTER DE ALUMINIO/PVC-PVDC PROTEGIDO CON SOBRE LAMINADO-POUCH BLANCO",
        "gtin": null,
        "active": true
      },
      {
        "code": "19929991-3",
        "name": "CAJA PLEGADIZA POR 50 CÁPSULAS DURAS EN BLISTER DE ALUMINIO/PVC-PVDC PROTEGIDO CON SOBRE LAMINADO-POUCH BLANCO",
        "gtin": null,
        "active": true
      },
      {
        "code": "19929991-1",
        "name": "CAJA PLEGADIZA POR 10 CÁPSULAS DURAS EN BLISTER DE ALUMINIO/PVC-PVDC PROTEGIDO CON SOBRE LAMINADO-POUCH BLANCO",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-OMEPRAZOL"
  },
  {
    "id": "e67b3a22-d3d3-5769-bf83-2c87c8c464b8",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "53010",
    "display": "VENTOLIN 100 microgramos/INHALACIÓN SUSPENSIÓN PARA INHALACIÓN EN ENVASE A PRESIÓN",
    "holder": "Glaxosmithkline S.A.",
    "strengthText": "100 mcg de salbutamol (en forma de sulfato)",
    "dosageForm": "SUSPENSIÓN PARA INHALACIÓN EN ENVASE A PRESIÓN",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL",
        "amount": "100",
        "unit": "µg"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "656706",
        "name": "VENTOLIN 100 microgramos/INHALACIÓN SUSPENSIÓN PARA INHALACIÓN EN ENVASE A PRESIÓN , 1 inhalador de 200 dosis",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/53010/53010_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/53010/53010_materialas.jpg",
      "attribution": "AEMPS · CIMA — VENTOLIN 100 microgramos/INHALACIÓN SUSPENSIÓN PARA INHALACIÓN EN ENVASE A PRESIÓN (nº reg. 53010), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=53010",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "584fb246-6e5b-5cc6-bd1a-4d17b49f7edf",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "55147",
    "display": "VENTOLIN 5 mg/ml SOLUCION PARA INHALACION POR NEBULIZADOR",
    "holder": "Glaxosmithkline S.A.",
    "strengthText": "500 mg",
    "dosageForm": "SOLUCIÓN PARA INHALACIÓN POR NEBULIZADOR",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL SULFATO",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "941807",
        "name": "VENTOLIN 5 mg/ml SOLUCION PARA INHALACION POR NEBULIZADOR, 1 frasco de 10 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/55147/55147_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/55147/55147_materialas.jpg",
      "attribution": "AEMPS · CIMA — VENTOLIN 5 mg/ml SOLUCION PARA INHALACION POR NEBULIZADOR (nº reg. 55147), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=55147",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "f3bd27cc-82d5-5fe0-a7b3-fdbd3418a3e4",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "65850",
    "display": "SALBUTAMOL ALDO-UNION 100 microgramos/dosis SUSPENSION PARA INHALACION EN ENVASE A PRESION",
    "holder": "Laboratorio Aldo Union S.L.",
    "strengthText": "100 microgramos/aplicación",
    "dosageForm": "SUSPENSIÓN PARA INHALACIÓN EN ENVASE A PRESIÓN",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL SULFATO",
        "amount": "0,2400",
        "unit": "g"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "797183",
        "name": "SALBUTAMOL ALDO-UNION 100 microgramos/dosis SUSPENSION PARA INHALACION EN ENVASE A PRESION  , 1 inhalador de 200 dosis",
        "gtin": null,
        "active": true
      },
      {
        "code": "607323",
        "name": "SALBUTAMOL ALDO-UNION 100 microgramos/dosis SUSPENSION PARA INHALACION EN ENVASE A PRESION  20 inhaladores de 200 dosis",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/65850/65850_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/65850/65850_materialas.jpg",
      "attribution": "AEMPS · CIMA — SALBUTAMOL ALDO-UNION 100 microgramos/dosis SUSPENSION PARA INHALACION EN ENVASE A PRESION (nº reg. 65850), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=65850",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "62098f26-1f6e-580a-a6a8-6f5782dc002e",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "73562",
    "display": "SALBUAIR 5 mg SOLUCION PARA INHALACION POR NEBULIZADOR",
    "holder": "Laboratorio Aldo Union S.L.",
    "strengthText": "0.24% P/V SALBUTAMOL SULFATO",
    "dosageForm": "SOLUCIÓN PARA INHALACIÓN POR NEBULIZADOR",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL SULFATO",
        "amount": "0,24",
        "unit": "% P/V"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "677363",
        "name": "SALBUAIR 5 mg SOLUCION PARA INHALACION POR NEBULIZADOR, 60 ampollas de 2,5 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/73562/73562_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/73562/73562_materialas.jpg",
      "attribution": "AEMPS · CIMA — SALBUAIR 5 mg SOLUCION PARA INHALACION POR NEBULIZADOR (nº reg. 73562), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=73562",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "e0729aba-803e-50b2-936e-496adf691ed8",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2016M-0011574-R1",
    "display": "BETADREN JARABE",
    "holder": "INVERSIONES COMERFAR LTDA.",
    "strengthText": "40 mg",
    "dosageForm": "JARABE",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL SULFATO EQUIVALENTE A SALBUTAMOL BASE",
        "amount": "40",
        "unit": "mg"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "20012634-1",
        "name": "CAJA CON FRASCO PET AMBAR POR 120 ML. CON TAPA DE COLOR BLANCO DE COPOLIMERO DESIN DATOPOLIPROPILENO CON LINNER AZUL DE ETILVINILACETATO.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "ee18c7d2-ca23-5bdf-b8db-f571738abb16",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2019M-0009124-R1",
    "display": "SALBUTAMOL JARABE 2 MG /5ML",
    "holder": "LABORATORIO PROFESIONAL FARMACEUTICO S.A.S. - LABORATORIOS LAPROFF S.A.S.",
    "strengthText": "40 mg",
    "dosageForm": "JARABE",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL SULFATO48.0 MG (EQUIVALENTE A SALBUTAMOL",
        "amount": "40",
        "unit": "mg"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "19994006-2",
        "name": "USO INSTITUCIONAL: FRASCO PET BLANCO POR 120 ML",
        "gtin": null,
        "active": true
      },
      {
        "code": "19994006-1",
        "name": "FRASCO PET BLANCO X 120 ML",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "6d1ba5e2-48c6-590a-a7a7-feff98929c95",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63011",
    "display": "SALBUTAMOL CLICKHALER POLVO PARA INHALACION",
    "holder": "Innovata Biomed Limited",
    "strengthText": "0,114 mg salbutamol sulfato/inhalacion",
    "dosageForm": "POLVO PARA INHALACIÓN",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SALBUTAMOL SULFATO",
        "amount": "0,114",
        "unit": "mg"
      }
    ],
    "atc": [
      "R03AC02"
    ],
    "presentations": [
      {
        "code": "864967",
        "name": "SALBUTAMOL CLICKHALER POLVO PARA INHALACION, 1 inhalador de 200 dosis",
        "gtin": null,
        "active": false
      }
    ],
    "regulatoryStatus": "SUSPENDED",
    "selectable": false,
    "photo": null,
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63011",
    "medicationCode": "MED-SALBUTAMOL"
  },
  {
    "id": "a39a6ba1-cec7-597f-8536-b154c0ba11b4",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "64011",
    "display": "EUTIROX 25 microgramos COMPRIMIDOS",
    "holder": "Merck S.L.",
    "strengthText": "25 mcg levotiroxina sodica",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LEVOTIROXINA SODICA",
        "amount": "25",
        "unit": "µg"
      }
    ],
    "atc": [
      "H03AA01"
    ],
    "presentations": [
      {
        "code": "698089",
        "name": "EUTIROX 25 microgramos COMPRIMIDOS , 100 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/64011/64011_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/64011/64011_materialas.jpg",
      "attribution": "AEMPS · CIMA — EUTIROX 25 microgramos COMPRIMIDOS (nº reg. 64011), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=64011",
    "medicationCode": "MED-LEVOTIROXINA"
  },
  {
    "id": "6c112453-e217-5f6b-ae14-00240de57b60",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "64012",
    "display": "EUTIROX 50 microgramos COMPRIMIDOS",
    "holder": "Merck S.L.",
    "strengthText": "50 mcg levotiroxina sodica",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LEVOTIROXINA SODICA",
        "amount": "50",
        "unit": "µg"
      }
    ],
    "atc": [
      "H03AA01"
    ],
    "presentations": [
      {
        "code": "698092",
        "name": "EUTIROX 50 microgramos COMPRIMIDOS , 100 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/64012/64012_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/64012/64012_materialas.jpg",
      "attribution": "AEMPS · CIMA — EUTIROX 50 microgramos COMPRIMIDOS (nº reg. 64012), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=64012",
    "medicationCode": "MED-LEVOTIROXINA"
  },
  {
    "id": "6ba9e105-4e93-5410-a387-62faeba5c487",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "64013",
    "display": "EUTIROX 75 microgramos COMPRIMIDOS",
    "holder": "Merck S.L.",
    "strengthText": "75 mcg levotiroxina sodica",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LEVOTIROXINA SODICA",
        "amount": "75",
        "unit": "µg"
      }
    ],
    "atc": [
      "H03AA01"
    ],
    "presentations": [
      {
        "code": "698093",
        "name": "EUTIROX  75 microgramos COMPRIMIDOS, 100 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/64013/64013_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/64013/64013_materialas.jpg",
      "attribution": "AEMPS · CIMA — EUTIROX 75 microgramos COMPRIMIDOS (nº reg. 64013), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=64013",
    "medicationCode": "MED-LEVOTIROXINA"
  },
  {
    "id": "ef586da2-1d9f-5f43-beba-3f52973b8f32",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "64014",
    "display": "EUTIROX 100 microgramos COMPRIMIDOS",
    "holder": "Merck S.L.",
    "strengthText": "100 mcg levotiroxina sodica",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LEVOTIROXINA SODICA",
        "amount": "100",
        "unit": "µg"
      }
    ],
    "atc": [
      "H03AA01"
    ],
    "presentations": [
      {
        "code": "698095",
        "name": "EUTIROX 100 microgramos COMPRIMIDOS , 100 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/64014/64014_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/64014/64014_materialas.jpg",
      "attribution": "AEMPS · CIMA — EUTIROX 100 microgramos COMPRIMIDOS (nº reg. 64014), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=64014",
    "medicationCode": "MED-LEVOTIROXINA"
  },
  {
    "id": "d4d1b6e4-32d9-5266-8dc5-30ecf82602cb",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-0009831",
    "display": "TIROXIN® 112",
    "holder": "LABORATORIOS SIEGFRIED S.A.S.",
    "strengthText": "0.112 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "LEVOTIROXINA SODICA",
        "amount": "0.112",
        "unit": "mg"
      }
    ],
    "atc": [
      "H03AA01"
    ],
    "presentations": [
      {
        "code": "20001059-21",
        "name": "CAJA POR 200 TABLETAS EN BLISTER DE ALUMINIO/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20001059-48",
        "name": "GENERICO: CAJA POR 300 TABLETAS EN BLISTER DE ALUMINIO/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20001059-27",
        "name": "CAJA POR 275 TABLETAS EN BLISTER DE ALUMINIO/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20001059-19",
        "name": "CAJA POR 175 TABLETAS EN BLISTER DE ALUMINIO/ALUMINIO",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-LEVOTIROXINA"
  },
  {
    "id": "ec220e61-ca11-5561-bccc-b91e8867fc99",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-0009847",
    "display": "TIROXIN 88",
    "holder": "LABORATORIOS SIEGFRIED S.A.S.",
    "strengthText": "0.088 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "LEVOTIROXINASÓDICA",
        "amount": "0.088",
        "unit": "mg"
      }
    ],
    "atc": [
      "H03AA01"
    ],
    "presentations": [
      {
        "code": "20001113-11",
        "name": "USO INSTITUCIONAL: CAJA POR 50 TABLETAS BLISTER PVC/PVDC ÁMBAR/ALUMINIO POR 10 TABLETAS CADA UNO.",
        "gtin": null,
        "active": true
      },
      {
        "code": "20001113-12",
        "name": "(GENERICO) CAJA X 60 TABLETAS EN BLÍSTER PVC/PVDC ÁMBAR - ALUMINIO X 10 TABLETAS CADA BLÍSTER",
        "gtin": null,
        "active": true
      },
      {
        "code": "20001113-6",
        "name": "USO INSTITUCIONAL EN SU DENOMINACIÓN GENÉRICA: CAJA POR 150 TABLETASSIN DATOCON BLISTER PVC/PVDC ÁMBAR/ALUMINIO POR 10 TABLETAS CADA UNO.",
        "gtin": null,
        "active": true
      },
      {
        "code": "20001113-7",
        "name": "CAJA POR 50 TABLETAS EN BLISTER PVC/PVDC ÁMBAR/ALUMINIO POR 10 TABLETAS CADA UNO.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-LEVOTIROXINA"
  },
  {
    "id": "31aeb17f-6bce-5114-9877-4eb40f1d1306",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "59717",
    "display": "BESITRAN 50 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "50 mg sertralina",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SERTRALINA HIDROCLORURO",
        "amount": "55,950",
        "unit": "mg"
      }
    ],
    "atc": [
      "N06AB06"
    ],
    "presentations": [
      {
        "code": "798959",
        "name": "BESITRAN 50 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/59717/59717_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/59717/59717_materialas.jpg",
      "attribution": "AEMPS · CIMA — BESITRAN 50 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 59717), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=59717",
    "medicationCode": "MED-SERTRALINA"
  },
  {
    "id": "ec67c50a-4ccc-5959-8c1d-b79d62173360",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "59718",
    "display": "BESITRAN 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "100 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SERTRALINA HIDROCLORURO",
        "amount": "100",
        "unit": "mg"
      }
    ],
    "atc": [
      "N06AB06"
    ],
    "presentations": [
      {
        "code": "799486",
        "name": "BESITRAN 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA , 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/59718/59718_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/59718/59718_materialas.jpg",
      "attribution": "AEMPS · CIMA — BESITRAN 100 mg COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 59718), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=59718",
    "medicationCode": "MED-SERTRALINA"
  },
  {
    "id": "85612baf-f9ca-5ea5-88fe-bd50050f0ce6",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63477",
    "display": "BESITRAN 20 mg/ml CONCENTRADO PARA SOLUCION ORAL",
    "holder": "Viatris Healthcare Limited",
    "strengthText": "20 mg sertralina/ml",
    "dosageForm": "CONCENTRADO PARA SOLUCIÓN ORAL",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SERTRALINA HIDROCLORURO",
        "amount": "22,370",
        "unit": "mg"
      }
    ],
    "atc": [
      "N06AB06"
    ],
    "presentations": [
      {
        "code": "657676",
        "name": "BESITRAN 20 mg/ml CONCENTRADO PARA SOLUCION ORAL , 1 frasco de 60 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63477/63477_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63477/63477_materialas.jpg",
      "attribution": "AEMPS · CIMA — BESITRAN 20 mg/ml CONCENTRADO PARA SOLUCION ORAL (nº reg. 63477), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63477",
    "medicationCode": "MED-SERTRALINA"
  },
  {
    "id": "b79f676a-b855-5ce9-8dc6-01b07e7fd693",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "65645",
    "display": "SERTRALINA VIATRIS 100 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Viatris Pharmaceuticals S.L.",
    "strengthText": "100 mg sertralina hidrocloruro",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "SERTRALINA HIDROCLORURO",
        "amount": "112",
        "unit": "mg"
      }
    ],
    "atc": [
      "N06AB06"
    ],
    "presentations": [
      {
        "code": "999817",
        "name": "SERTRALINA VIATRIS 100 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/65645/65645_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/65645/65645_materialas.jpg",
      "attribution": "AEMPS · CIMA — SERTRALINA VIATRIS 100 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 65645), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=65645",
    "medicationCode": "MED-SERTRALINA"
  },
  {
    "id": "e701d75d-e4a9-5fb8-90b6-c05f1f27a5d3",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2008M-0008156",
    "display": "INOSERT® 50 MG",
    "holder": "IPCA LABORATORIES LIMITED",
    "strengthText": "50 mg.",
    "dosageForm": "TABLETA RECUBIERTA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "SERTRALINA CLORHIDRATO (EQUIVALENTE A SERTRALINA)",
        "amount": "50",
        "unit": "mg."
      }
    ],
    "atc": [
      "N06AB06"
    ],
    "presentations": [
      {
        "code": "19985551-2",
        "name": "CAJA POR 3 BLISTER EN PVC BLANCO OPACO / ALUMINIO POR 10 TABLETAS (30 TABLETAS)",
        "gtin": null,
        "active": true
      },
      {
        "code": "19985551-7",
        "name": "CAJA POR 1 BLÍSTER DE 14 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19985551-12",
        "name": "USO INSTITUCIONAL: CAJA POR 1 BLÍSTER DE 10 TABLETAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "19985551-8",
        "name": "CAJA POR 2 BLÍSTER DE 7 TABLETAS",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-SERTRALINA"
  },
  {
    "id": "7d401a8e-a8de-54fd-981d-b2af1b1aced4",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2008M-0008162",
    "display": "INOSERT® - 100",
    "holder": "IPCA LABORATORIES LIMITED",
    "strengthText": "100 mg.",
    "dosageForm": "TABLETA RECUBIERTA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "SERTRALINA CLORHIDRATO (EQUIVALENTE A SERTRALINA)",
        "amount": "100",
        "unit": "mg."
      }
    ],
    "atc": [
      "N06AB06"
    ],
    "presentations": [
      {
        "code": "19985550-8",
        "name": "CAJA DE CARTON POR 2 BLISTER PVC BLANCO OPACO/ALUMINIOSIN DATOPOR 10 TABLETAS C/U.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19985550-6",
        "name": "CAJA DE CARTON POR 1 BLISTER PVC BLANCO OPACO/ALUMINIOSIN DATOPOR 14 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19985550-9",
        "name": "CAJA DE CARTON POR 1 BLISTER PVC BLANCO OPACO/ALUMINIOSIN DATODE 7 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "19985550-11",
        "name": "CAJA DE CARTON POR 1 BLISTER PVC BLANCO OPACO/ALUMINIOSIN DATODE 10 TABLETAS.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-SERTRALINA"
  },
  {
    "id": "90609d08-9167-56bd-9e12-306b42357bec",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "58518",
    "display": "CLARITYNE 10 mg COMPRIMIDOS",
    "holder": "Bayer Hispania S.L.",
    "strengthText": "10 mg loratadina",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "LORATADINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "763794",
        "name": "CLARITYNE 10 mg COMPRIMIDOS, 10 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/58518/58518_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/58518/58518_materialas.jpg",
      "attribution": "AEMPS · CIMA — CLARITYNE 10 mg COMPRIMIDOS (nº reg. 58518), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=58518",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "593043d5-2e7f-592b-8a07-53c0cfd878a3",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63696",
    "display": "LORATADINA CINFA 10 mg COMPRIMIDOS EFG",
    "holder": "Laboratorios Cinfa S.A.",
    "strengthText": "10 mg loratadina",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "LORATADINA",
        "amount": "10,0",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "762930",
        "name": "LORATADINA CINFA 10 mg COMPRIMIDOS EFG, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63696/63696_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63696/63696_materialas.jpg",
      "attribution": "AEMPS · CIMA — LORATADINA CINFA 10 mg COMPRIMIDOS EFG (nº reg. 63696), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63696",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "49a9722e-7b24-52b2-b96b-0e0b4f4c0ee8",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63711",
    "display": "LORATADINA STADA 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorio Stada S.L.",
    "strengthText": "10 mg/comprimido",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "LORATADINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "653102",
        "name": "LORATADINA STADA 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63711/63711_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63711/63711_materialas.jpg",
      "attribution": "AEMPS · CIMA — LORATADINA STADA 10 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 63711), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63711",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "8cf46351-979c-5b17-b980-b3770771d09f",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63784",
    "display": "LORATADINA NORMON 10 mg COMPRIMIDOS EFG",
    "holder": "Laboratorios Normon S.A.",
    "strengthText": "Loratadina 10 mg",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "LORATADINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "869354",
        "name": "LORATADINA NORMON 10 mg COMPRIMIDOS EFG, 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/63784/63784_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/63784/63784_materialas.jpg",
      "attribution": "AEMPS · CIMA — LORATADINA NORMON 10 mg COMPRIMIDOS EFG (nº reg. 63784), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63784",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "fe3b1abd-3e97-51c8-b29e-e840706c0d22",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2010M-0010322",
    "display": "LORATADINA10 MG TABLETAS",
    "holder": "GLOBAL INTERNATIONAL MEDICINE S.A.S. GIMED S.A.S.",
    "strengthText": "10 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "LORATADINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "19996082-1",
        "name": "PLEGADICA POR 10 TABLETAS EN BLISTER PVC/ALUMINIO POR 10 TABLETAS CADA UNO.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "806dc1b7-7f1a-53fa-9912-c9f9b30262a1",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2014M-0015305",
    "display": "CLARITYNE TABLETAS",
    "holder": "BAYER S.A.",
    "strengthText": "10 mg",
    "dosageForm": "TABLETA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "LORATADINA MICRONIZADA USP",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "20062950-8",
        "name": "CAJA POR 4 TABLETAS EN BLÍSTER ACLAR/PVC/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20062950-4",
        "name": "CAJA POR 10 TABLETAS EN BLISTER ACLAR PVC/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "20062950-7",
        "name": "CAJA POR 2 TABLETAS EN BLÍSTER ACLAR/PVC/ALUMINIO",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "7769e96a-3c7d-5cea-9438-383bdae8e4d5",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "63903",
    "display": "LORATADINA EDIGEN 10 mg COMPRIMIDOS EFG",
    "holder": "Aristo Pharma Iberia S.L.",
    "strengthText": "10 mg",
    "dosageForm": "COMPRIMIDO",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "LORATADINA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "R06AX13"
    ],
    "presentations": [
      {
        "code": "755454",
        "name": "LORATADINA EDIGEN 10 mg COMPRIMIDOS EFG, 20 comprimidos",
        "gtin": null,
        "active": false
      }
    ],
    "regulatoryStatus": "REVOKED",
    "selectable": false,
    "photo": null,
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=63903",
    "medicationCode": "MED-LORATADINA"
  },
  {
    "id": "edcbce9d-f25b-5751-bd12-3839fae4fa60",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "52994",
    "display": "TARDYFERON 80 mg COMPRIMIDOS DE LIBERACIÓN PROLONGADA",
    "holder": "Pierre Fabre Iberica S.A.",
    "strengthText": "80 mg",
    "dosageForm": "COMPRIMIDO DE LIBERACIÓN PROLONGADA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "HIERRO SULFATO DESECADO",
        "amount": "247,25",
        "unit": "mg"
      }
    ],
    "atc": [
      "B03AA07"
    ],
    "presentations": [
      {
        "code": "672908",
        "name": "TARDYFERON 80 mg COMPRIMIDOS DE LIBERACIÓN PROLONGADA, 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/52994/52994_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/52994/52994_materialas.jpg",
      "attribution": "AEMPS · CIMA — TARDYFERON 80 mg COMPRIMIDOS DE LIBERACIÓN PROLONGADA (nº reg. 52994), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=52994",
    "medicationCode": "MED-SULFATO-FERROSO"
  },
  {
    "id": "85dce756-8c3c-54ac-bca0-09f2f6326e8b",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "48330",
    "display": "FERO-GRADUMET 105 mg COMPRIMIDOS DE LIBERACION PROLONGADA.",
    "holder": "Teofarma S.R.L.",
    "strengthText": "105 mg",
    "dosageForm": "COMPRIMIDO DE LIBERACIÓN PROLONGADA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "HIERRO (II) SULFATO",
        "amount": "325",
        "unit": "mg"
      }
    ],
    "atc": [
      "B03AA07"
    ],
    "presentations": [
      {
        "code": "656582",
        "name": "FERO-GRADUMET 105 mg COMPRIMIDOS DE LIBERACION PROLONGADA., 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=48330",
    "medicationCode": "MED-SULFATO-FERROSO"
  },
  {
    "id": "4227b38a-0302-5292-8b78-e648dd1d2829",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009 M-001785-R3",
    "display": "SULFATO FERROSOGRAGEAS",
    "holder": "LABORATORIOS ECAR S.A.",
    "strengthText": "0.2 g",
    "dosageForm": "TABLETA CUBIERTA (GRAGEA)",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "SULFATO FERROSO SECO EQUIVALENTE A SULFATO FERROSO",
        "amount": "0.2",
        "unit": "g"
      }
    ],
    "atc": [
      "B03AA07"
    ],
    "presentations": [
      {
        "code": "32897-22",
        "name": "CAJA DE CARTON POR 500 GRAGEAS EN BLISTER PVC /ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "32897-4",
        "name": "CAJA DE CARTON POR 100 GRAGEAS EN BLISTER PVC /ALUMINIO*",
        "gtin": null,
        "active": true
      },
      {
        "code": "32897-8",
        "name": "FRASCO PEAD BLANCO CON TAPA PP BLANCA POR 100 GRAGEAS",
        "gtin": null,
        "active": true
      },
      {
        "code": "32897-23",
        "name": "CAJA DE CARTON PORSIN DATO1000GRAGEAS EN BLISTER PVC /ALUMINIO",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-SULFATO-FERROSO"
  },
  {
    "id": "f03355e0-a3c1-59a7-ab69-8f858ecf50d7",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2009M-0009794",
    "display": "SULFATO FERROSO 2.5G/100ML SOLUCION ORAL",
    "holder": "PENTACOOP S.A.",
    "strengthText": "2.5 g",
    "dosageForm": "SOLUCION ORAL",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "SULFATO FERROSO HEPTAHIDRATADO EQUIVALENTE A 2.5 G DE SULFATO FERROSO ANHIDRO. EQUIVALENTE A 919 MG DE HIERRO.",
        "amount": "2.5",
        "unit": "g"
      }
    ],
    "atc": [
      "B03AA07"
    ],
    "presentations": [
      {
        "code": "19995854-2",
        "name": "FRASCO PET ÁMBAR POR 120 ML. CON TAPA PET BLANCA",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-SULFATO-FERROSO"
  },
  {
    "id": "7927b583-b5ea-554e-a900-09a322472606",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62299",
    "display": "CIPROFLOXACINO NORMON 250 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorios Normon S.A.",
    "strengthText": "250 mg ciprofloxacino hidrocloruro",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "CIPROFLOXACINO HIDROCLORURO",
        "amount": "250",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01MA02"
    ],
    "presentations": [
      {
        "code": "695618",
        "name": "CIPROFLOXACINO NORMON 250 mg COMPRIMIDOS RECUBIERTOS CON PELICULA  EFG , 14 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62299/62299_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62299/62299_materialas.jpg",
      "attribution": "AEMPS · CIMA — CIPROFLOXACINO NORMON 250 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 62299), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62299",
    "medicationCode": "MED-CIPROFLOXACINO"
  },
  {
    "id": "e7d901ff-936e-590b-8f7b-dc07037ed905",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62300",
    "display": "CIPROFLOXACINO NORMON 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorios Normon S.A.",
    "strengthText": "500 mg ciprofloxacino hidrocloruro",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "CIPROFLOXACINO HIDROCLORURO",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01MA02"
    ],
    "presentations": [
      {
        "code": "695621",
        "name": "CIPROFLOXACINO NORMON 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 14 comprimidos",
        "gtin": null,
        "active": true
      },
      {
        "code": "604520",
        "name": "CIPROFLOXACINO NORMON 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 500 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62300/62300_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62300/62300_materialas.jpg",
      "attribution": "AEMPS · CIMA — CIPROFLOXACINO NORMON 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 62300), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62300",
    "medicationCode": "MED-CIPROFLOXACINO"
  },
  {
    "id": "08a1c88f-2fa4-5a6e-a388-dd6caefff015",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62301",
    "display": "CIPROFLOXACINO NORMON 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorios Normon S.A.",
    "strengthText": "750 mg ciprofloxacino hidrocloruro",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "CIPROFLOXACINO HIDROCLORURO",
        "amount": "750",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01MA02"
    ],
    "presentations": [
      {
        "code": "695622",
        "name": "CIPROFLOXACINO NORMON 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA  EFG , 14 comprimidos",
        "gtin": null,
        "active": true
      },
      {
        "code": "604538",
        "name": "CIPROFLOXACINO NORMON 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA  EFG , 500 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62301/62301_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62301/62301_materialas.jpg",
      "attribution": "AEMPS · CIMA — CIPROFLOXACINO NORMON 750 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 62301), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62301",
    "medicationCode": "MED-CIPROFLOXACINO"
  },
  {
    "id": "9fcebe95-5722-5227-bcb7-4494c3e13884",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "62506",
    "display": "CIPROFLOXACINO STADA 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG",
    "holder": "Laboratorio Stada S.L.",
    "strengthText": "500 mg ciprofloxacino hidrocloruro",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "CIPROFLOXACINO",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01MA02"
    ],
    "presentations": [
      {
        "code": "694686",
        "name": "CIPROFLOXACINO STADA 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG , 14 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/62506/62506_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/62506/62506_materialas.jpg",
      "attribution": "AEMPS · CIMA — CIPROFLOXACINO STADA 500 mg COMPRIMIDOS RECUBIERTOS CON PELICULA EFG (nº reg. 62506), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=62506",
    "medicationCode": "MED-CIPROFLOXACINO"
  },
  {
    "id": "3e1a3ea3-80f7-5b3c-98cf-bd998e89d3ba",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2014M-0015442",
    "display": "MICROBAC",
    "holder": "BD FARMA S.A.S.",
    "strengthText": "500 mg",
    "dosageForm": "TABLETA RECUBIERTA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "CIPROFLOXACINA CLORHIDRATO EQUIVALENTE A CIPROFLOXACINA BASE",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01MA02"
    ],
    "presentations": [
      {
        "code": "20068314-1",
        "name": "CAJA PLEGADIZA X 10 TABLETAS EN BLISTER PVC - FOIL ALUMINIO.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-CIPROFLOXACINO"
  },
  {
    "id": "570e67f3-d307-525f-920a-9f29e37bfae0",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2015 M- 011296-R3",
    "display": "CIGRAM 500 MG TABLETAS",
    "holder": "LABORATORIOS BUSSIÉ S.A.",
    "strengthText": "500 mg",
    "dosageForm": "TABLETA RECUBIERTA",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "CIPROFLOXACINA CLORHIDRATO MONOHIDRATO EQUIVALENTE A CIPROFLOXACINA BASE",
        "amount": "500",
        "unit": "mg"
      }
    ],
    "atc": [
      "J01MA02"
    ],
    "presentations": [
      {
        "code": "35644-3",
        "name": "CAJA X 10 TABLETAS EN FOILSIN DATOALU/ALU",
        "gtin": null,
        "active": true
      },
      {
        "code": "35644-6",
        "name": "CAJA X 250 TABLETAS.",
        "gtin": null,
        "active": true
      },
      {
        "code": "35644-27",
        "name": "USO INSTITUCIONAL:CAJA POR 10 TABLETAS EN BLISTER PVC/PVDC/ALUMINIO",
        "gtin": null,
        "active": true
      },
      {
        "code": "35644-2",
        "name": "CAJA X 6 TABLETAS EN FOIL ALU/ALU.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-CIPROFLOXACINO"
  },
  {
    "id": "5ece0fc8-fd10-5e91-bca3-eb0dd157f995",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "02233003",
    "display": "INSULATARD 100 UI/ml SUSPENSION INYECTABLE EN VIAL",
    "holder": "Novo Nordisk A/S",
    "strengthText": "100 UI/ml",
    "dosageForm": "SUSPENSIÓN INYECTABLE",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "INSULINA ISOFANA",
        "amount": "100",
        "unit": "UI"
      }
    ],
    "atc": [
      "A10AC01"
    ],
    "presentations": [
      {
        "code": "775932",
        "name": "INSULATARD 100 UI/ml SUSPENSION INYECTABLE EN VIAL 1 vial de 10 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/02233003/02233003_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/02233003/02233003_materialas.jpg",
      "attribution": "AEMPS · CIMA — INSULATARD 100 UI/ml SUSPENSION INYECTABLE EN VIAL (nº reg. 02233003), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=02233003",
    "medicationCode": "MED-INSULINA-NPH"
  },
  {
    "id": "aec3e9c9-5095-5857-9a57-388782bcd065",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "02233014",
    "display": "INSULATARD FLEXPEN 100 UI/ml SUSPENSION INYECTABLE EN PLUMA PRECARGADA",
    "holder": "Novo Nordisk A/S",
    "strengthText": "100 UI/ml",
    "dosageForm": "SUSPENSIÓN INYECTABLE EN PLUMA PRECARGADA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "INSULINA HUMANA ISOFANA",
        "amount": "100",
        "unit": "UI"
      }
    ],
    "atc": [
      "A10AC01"
    ],
    "presentations": [
      {
        "code": "776427",
        "name": "INSULATARD FLEXPEN 100 UI/ml SUSPENSION INYECTABLE EN PLUMA PRECARGADA 5 plumas precargadas de 3 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/02233014/02233014_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/02233014/02233014_materialas.jpg",
      "attribution": "AEMPS · CIMA — INSULATARD FLEXPEN 100 UI/ml SUSPENSION INYECTABLE EN PLUMA PRECARGADA (nº reg. 02233014), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=02233014",
    "medicationCode": "MED-INSULINA-NPH"
  },
  {
    "id": "2570013e-96f7-5fdc-87c6-f905c2827cea",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "80667",
    "display": "HUMULINA NPH 100 UI/ML SUSPENSION INYECTABLE EN VIAL",
    "holder": "Lilly S.A.",
    "strengthText": "100 UI/ml",
    "dosageForm": "SUSPENSIÓN INYECTABLE",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "INSULINA HUMANA",
        "amount": "100",
        "unit": "UI"
      }
    ],
    "atc": [
      "A10AC01"
    ],
    "presentations": [
      {
        "code": "710014",
        "name": "HUMULINA NPH 100 UI/ML SUSPENSION INYECTABLE EN VIAL, 1 vial de 10 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=80667",
    "medicationCode": "MED-INSULINA-NPH"
  },
  {
    "id": "71132020-ad71-5d8e-9e49-51d84ec83ffd",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "80668",
    "display": "HUMULINA NPH KWIKPEN 100 UI/ML SUSPENSION INYECTABLE",
    "holder": "Lilly S.A.",
    "strengthText": "100 UI/ml",
    "dosageForm": "SUSPENSIÓN INYECTABLE EN PLUMA PRECARGADA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "INSULINA ISOFANA HUMANA PRB",
        "amount": "100",
        "unit": "UI"
      }
    ],
    "atc": [
      "A10AC01"
    ],
    "presentations": [
      {
        "code": "710016",
        "name": "HUMULINA NPH KWIKPEN 100 UI/ML SUSPENSION INYECTABLE, 6 plumas precargadas de 3 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=80668",
    "medicationCode": "MED-INSULINA-NPH"
  },
  {
    "id": "b0cd53e6-9508-5a19-9121-edd37e6d1205",
    "source": "invima",
    "sourceName": "INVIMA — Código Único de Medicamentos Vigentes (datos.gov.co)",
    "code": "INVIMA 2020M-0019684",
    "display": "WOSULIN N 100UI/ML SUSPENSIÓN INYECTABLE",
    "holder": "ELIXYM BIOPHARMACEUTICAL S.A.S",
    "strengthText": "100 UI",
    "dosageForm": "SUSPENSION INYECTABLE",
    "requiresPrescription": null,
    "generic": null,
    "activeIngredients": [
      {
        "name": "INSULINA HUMANA (RECOMBINANTE)",
        "amount": "100",
        "unit": "UI"
      }
    ],
    "atc": [
      "A10AC01"
    ],
    "presentations": [
      {
        "code": "20061253-2",
        "name": "IUM 1I1032691000101: CAJA POR 1 CARTUCHO (VIDRIO TIPO I) DE 3ML MULTIDOSIS. SELLO SUPERIOR CON DISCO DE GOMA. Y ÉMBOLO INFERIOR (GOMA DE BROMOBUTILO).",
        "gtin": null,
        "active": true
      },
      {
        "code": "20061253-1",
        "name": "IUM 1I1032691000100 : CAJA POR 1 VIAL (VIDRIO TIPO I) DE 10ML MULTIDOSIS CONSIN DATOTAPÓN DE GOMA DE BROMOBUTILO RECUBIERTO DE POLÍMERO FLUORADO.",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": null,
    "sourceUrl": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/C-DIGO-NICO-DE-MEDICAMENTOS-VIGENTES/i7cb-raxc",
    "medicationCode": "MED-INSULINA-NPH"
  },
  {
    "id": "fab80281-c731-5583-8c8c-ca8ac0b2feda",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "00129001",
    "display": "AZOPT 10 mg/ml COLIRIO EN SUSPENSION",
    "holder": "Novartis Europharm Limited",
    "strengthText": "Desconocida",
    "dosageForm": "COLIRIO EN SUSPENSIÓN",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "BRINZOLAMIDA",
        "amount": "10",
        "unit": "mg"
      }
    ],
    "atc": [
      "S01EC04"
    ],
    "presentations": [
      {
        "code": "848226",
        "name": "AZOPT 10 mg/ml COLIRIO EN SUSPENSION, 1 frasco de 5 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/00129001/00129001_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/00129001/00129001_materialas.jpg",
      "attribution": "AEMPS · CIMA — AZOPT 10 mg/ml COLIRIO EN SUSPENSION (nº reg. 00129001), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=00129001",
    "medicationCode": null
  },
  {
    "id": "681423a8-7220-54df-a116-dca2ab7ea396",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "04279024",
    "display": "LYRICA 300 MG CAPSULAS DURAS",
    "holder": "Upjohn Eesv",
    "strengthText": "300mg",
    "dosageForm": "CÁPSULA DURA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "PREGABALINA",
        "amount": "300",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BF02"
    ],
    "presentations": [
      {
        "code": "754895",
        "name": "LYRICA 300 MG CAPSULAS DURAS, 56 cápsulas",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/04279024/04279024_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/04279024/04279024_materialas.jpg",
      "attribution": "AEMPS · CIMA — LYRICA 300 MG CAPSULAS DURAS (nº reg. 04279024), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=04279024",
    "medicationCode": null
  },
  {
    "id": "dd971979-c043-50fc-8088-7d3883804b64",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "07431002",
    "display": "RETACRIT 1000 UI/0,3 ml SOLUCION INYECTABLE EN JERINGA PRECARGADA",
    "holder": "Pfizer Europe Ma Eeig",
    "strengthText": "1000 UI",
    "dosageForm": "SOLUCIÓN INYECTABLE EN JERINGA PRECARGADA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "EPOETINA DSETA (EPOETIN ZETA)",
        "amount": "1000",
        "unit": "UI"
      }
    ],
    "atc": [
      "B03XA01"
    ],
    "presentations": [
      {
        "code": "660509",
        "name": "RETACRIT 1000 UI/0,3 ml SOLUCION INYECTABLE EN JERINGA PRECARGADA, 6 jeringas precargadas de 0,3 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/07431002/07431002_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/07431002/07431002_materialas.jpg",
      "attribution": "AEMPS · CIMA — RETACRIT 1000 UI/0,3 ml SOLUCION INYECTABLE EN JERINGA PRECARGADA (nº reg. 07431002), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=07431002",
    "medicationCode": null
  },
  {
    "id": "4eb726d9-0c28-5a67-aa0b-5974e1738ba7",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "09599018",
    "display": "RIVASTIGMINA SANDOZ 2 mg/ml SOLUCION ORAL EFG",
    "holder": "Sandoz Gmbh",
    "strengthText": "2 mg/ml",
    "dosageForm": "SOLUCIÓN ORAL",
    "requiresPrescription": true,
    "generic": true,
    "activeIngredients": [
      {
        "name": "RIVASTIGMINA HIDROGENO TARTRATO",
        "amount": "2",
        "unit": "mg"
      }
    ],
    "atc": [
      "N06DA03"
    ],
    "presentations": [
      {
        "code": "665804",
        "name": "RIVASTIGMINA SANDOZ 2 mg/ml SOLUCION ORAL EFG, 1 frasco de 120 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/formafarmac/09599018/09599018_formafarmac.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/formafarmac/09599018/09599018_formafarmac.jpg",
      "attribution": "AEMPS · CIMA — RIVASTIGMINA SANDOZ 2 mg/ml SOLUCION ORAL EFG (nº reg. 09599018), foto de forma farmacéutica"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=09599018",
    "medicationCode": null
  },
  {
    "id": "4022435c-ef8e-5db4-a9d2-5769cfb1404e",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "110612013",
    "display": "REVOLADE 25 MG POLVO PARA SUSPENSION ORAL",
    "holder": "Novartis Europharm Limited",
    "strengthText": "25 mg",
    "dosageForm": "POLVO PARA SUSPENSIÓN ORAL",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ELTROMBOPAG",
        "amount": "25",
        "unit": "mg"
      }
    ],
    "atc": [
      "B02BX05"
    ],
    "presentations": [
      {
        "code": "710908",
        "name": "REVOLADE 25 MG POLVO PARA SUSPENSION ORAL, 30 sobres + 1 frasco de mezcla + 30 jeringas para uso oral de un solo uso",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/110612013/110612013_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/110612013/110612013_materialas.jpg",
      "attribution": "AEMPS · CIMA — REVOLADE 25 MG POLVO PARA SUSPENSION ORAL (nº reg. 110612013), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=110612013",
    "medicationCode": null
  },
  {
    "id": "41fc2616-7cd2-5525-8054-ac22df57ff22",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "113892003",
    "display": "TIVICAY 10 MG COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Viiv Healthcare B.V.",
    "strengthText": "10 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "DOLUTEGRAVIR SODIO",
        "amount": "10.50",
        "unit": "mg"
      }
    ],
    "atc": [
      "J05AJ03"
    ],
    "presentations": [
      {
        "code": "715365",
        "name": "TIVICAY 10 MG COMPRIMIDOS RECUBIERTOS CON PELICULA, 30 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/113892003/113892003_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/113892003/113892003_materialas.jpg",
      "attribution": "AEMPS · CIMA — TIVICAY 10 MG COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 113892003), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=113892003",
    "medicationCode": null
  },
  {
    "id": "92ad1f78-f59c-5824-b51f-b43a7c49a40e",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "1151058003",
    "display": "ENTRESTO 49 MG/51 MG COMPRIMIDOS RECUBIERTOS CON PELICULA",
    "holder": "Novartis Europharm Limited",
    "strengthText": "49 mg/51 mg",
    "dosageForm": "COMPRIMIDO RECUBIERTO CON PELÍCULA",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "SACUBITRILO",
        "amount": "48,6",
        "unit": "mg"
      },
      {
        "name": "VALSARTAN",
        "amount": "51,4",
        "unit": "mg"
      }
    ],
    "atc": [
      "C09DX04"
    ],
    "presentations": [
      {
        "code": "709177",
        "name": "ENTRESTO 49 MG/51 MG COMPRIMIDOS RECUBIERTOS CON PELICULA, 56 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/1151058003/1151058003_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/1151058003/1151058003_materialas.jpg",
      "attribution": "AEMPS · CIMA — ENTRESTO 49 MG/51 MG COMPRIMIDOS RECUBIERTOS CON PELICULA (nº reg. 1151058003), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=1151058003",
    "medicationCode": null
  },
  {
    "id": "4ccc4868-c898-560a-b543-46784a3d20c2",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "11694002",
    "display": "NULOJIX 250 MG POLVO PARA CONCENTRADO PARA SOLUCION PARA PERFUSION",
    "holder": "Bristol-Myers Squibb Pharma Eeig",
    "strengthText": "250 mg belatacept",
    "dosageForm": "POLVO PARA CONCENTRADO PARA SOLUCIÓN PARA PERFUSIÓN",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "BELATACEPT",
        "amount": "275",
        "unit": "mg"
      }
    ],
    "atc": [
      "L04AA28"
    ],
    "presentations": [
      {
        "code": "682687",
        "name": "NULOJIX 250 MG POLVO PARA CONCENTRADO PARA SOLUCION PARA PERFUSION, 2 viales",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/11694002/11694002_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/11694002/11694002_materialas.jpg",
      "attribution": "AEMPS · CIMA — NULOJIX 250 MG POLVO PARA CONCENTRADO PARA SOLUCION PARA PERFUSION (nº reg. 11694002), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=11694002",
    "medicationCode": null
  },
  {
    "id": "6ba43bf9-e16b-504c-b35f-5ef4c584cdc9",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "1181344002",
    "display": "ZIRABEV 25 MG/ML CONCENTRADO PARA SOLUCION PARA PERFUSION",
    "holder": "Pfizer Europe Ma Eeig",
    "strengthText": "25 mg/ml",
    "dosageForm": "CONCENTRADO PARA SOLUCIÓN PARA PERFUSIÓN",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "BEVACIZUMAB",
        "amount": "400",
        "unit": "mg"
      }
    ],
    "atc": [
      "L01FG01"
    ],
    "presentations": [
      {
        "code": "726625",
        "name": "ZIRABEV 25 MG/ML CONCENTRADO PARA SOLUCION PARA PERFUSION, 1 vial de 16 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/1181344002/1181344002_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/1181344002/1181344002_materialas.jpg",
      "attribution": "AEMPS · CIMA — ZIRABEV 25 MG/ML CONCENTRADO PARA SOLUCION PARA PERFUSION (nº reg. 1181344002), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=1181344002",
    "medicationCode": null
  },
  {
    "id": "bcefa347-a98d-5b78-8b71-3dba92512a75",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "1231727001",
    "display": "BEKEMV 300 MG CONCENTRADO PARA SOLUCION PARA PERFUSION",
    "holder": "Amgen Europe B.V.",
    "strengthText": "300 MG",
    "dosageForm": "CONCENTRADO PARA SOLUCIÓN PARA PERFUSIÓN",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "ECULIZUMAB",
        "amount": "300",
        "unit": "mg"
      }
    ],
    "atc": [
      "L04AJ01"
    ],
    "presentations": [
      {
        "code": "762474",
        "name": "BEKEMV 300 MG CONCENTRADO PARA SOLUCION PARA PERFUSION, 1 vial de 30 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/1231727001/1231727001_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/1231727001/1231727001_materialas.jpg",
      "attribution": "AEMPS · CIMA — BEKEMV 300 MG CONCENTRADO PARA SOLUCION PARA PERFUSION (nº reg. 1231727001), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=1231727001",
    "medicationCode": null
  },
  {
    "id": "e07b793a-1ae6-5858-a543-a760bf074f03",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "199119003",
    "display": "NOVORAPID PENFILL 100 U/ML SOLUCION INYECTABLE EN CARTUCHO",
    "holder": "Novo Nordisk A/S",
    "strengthText": "100 U/ml",
    "dosageForm": "SOLUCIÓN INYECTABLE",
    "requiresPrescription": true,
    "generic": false,
    "activeIngredients": [
      {
        "name": "INSULINA ASPARTA",
        "amount": "100",
        "unit": "U"
      }
    ],
    "atc": [
      "A10AB05"
    ],
    "presentations": [
      {
        "code": "704723",
        "name": "NOVORAPID PENFILL 100 U/ML SOLUCION INYECTABLE EN CARTUCHO, 5 cartuchos de 3 ml",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/199119003/199119003_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/199119003/199119003_materialas.jpg",
      "attribution": "AEMPS · CIMA — NOVORAPID PENFILL 100 U/ML SOLUCION INYECTABLE EN CARTUCHO (nº reg. 199119003), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=199119003",
    "medicationCode": null
  },
  {
    "id": "ba226e3e-c88d-5ad7-96f8-6e0e19354593",
    "source": "cima",
    "sourceName": "CIMA — Centro de Información online de Medicamentos de la AEMPS",
    "code": "47178",
    "display": "ACTRON COMPUESTO 267 MG/133 MG/40 MG COMPRIMIDOS EFERVESCENTES",
    "holder": "Bayer Hispania S.L.",
    "strengthText": "267 mg/40 mg/133 mg",
    "dosageForm": "COMPRIMIDO EFERVESCENTE",
    "requiresPrescription": false,
    "generic": false,
    "activeIngredients": [
      {
        "name": "PARACETAMOL",
        "amount": "133",
        "unit": "mg"
      },
      {
        "name": "CAFEINA",
        "amount": "40",
        "unit": "mg"
      },
      {
        "name": "ACETILSALICILICO ACIDO",
        "amount": "267",
        "unit": "mg"
      }
    ],
    "atc": [
      "N02BA51"
    ],
    "presentations": [
      {
        "code": "954925",
        "name": "ACTRON COMPUESTO 267 MG/133 MG/40 MG COMPRIMIDOS EFERVESCENTES , 20 comprimidos",
        "gtin": null,
        "active": true
      }
    ],
    "regulatoryStatus": "ACTIVE",
    "selectable": true,
    "photo": {
      "url": "https://cima.aemps.es/cima/fotos/full/materialas/47178/47178_materialas.jpg",
      "thumbUrl": "https://cima.aemps.es/cima/fotos/thumbnails/materialas/47178/47178_materialas.jpg",
      "attribution": "AEMPS · CIMA — ACTRON COMPUESTO 267 MG/133 MG/40 MG COMPRIMIDOS EFERVESCENTES (nº reg. 47178), foto de envase"
    },
    "sourceUrl": "https://cima.aemps.es/cima/publico/detalle.html?nregistro=47178",
    "medicationCode": null
  }
];
