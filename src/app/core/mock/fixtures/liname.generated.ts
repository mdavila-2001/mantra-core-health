/* ============================================================================
    LINAME 2022-2024 — Lista Nacional de Medicamentos Esenciales de Bolivia
    (Ministerio de Salud y Deportes del Estado Plurinacional de Bolivia), agrupada por ATC nivel 5.

    **GENERADO por `scripts/gen-liname-fixture.mjs`. No editar a mano.**
    Extraída del PDF oficial por la API (`tools/bolivia-datasets/extract_liname.py`),
    SHA-256 del PDF: 6983cd08e94d05e95651b8fb4c385a4d87c249e5dac40834ac569ef27f16c275.
    482 medicamentos. La LINAME no trae indicaciones, dosis ni
    contraindicaciones, y este archivo tampoco.
    ========================================================================== */

export interface PresentacionLiname {
  /** Código LINAME (`J-01-49`). */
  readonly code: string;
  readonly form: string;
  readonly strength: string;
  /** «R» en la LINAME: uso restringido. */
  readonly restrictedUse: boolean;
}

export interface MedicamentoLiname {
  readonly atc: string;
  readonly name: string;
  readonly doseForms: readonly string[];
  readonly strengths: readonly string[];
  readonly presentations: readonly PresentacionLiname[];
}

export const MEDICAMENTOS_LINAME: readonly MedicamentoLiname[] = [
  {
    "atc": "A01AA01",
    "name": "Fluoruro de sodio",
    "doseForms": [
      "Gel o Pasta"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "A-01-02",
        "form": "Gel o Pasta",
        "strength": "Según Programa",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A01AB11",
    "name": "Bicarbonato de sodio",
    "doseForms": [
      "Polvo"
    ],
    "strengths": [
      "20 g"
    ],
    "presentations": [
      {
        "code": "A-01-01",
        "form": "Polvo",
        "strength": "20 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A02AD01",
    "name": "Hidróxido de aluminio y magnesio",
    "doseForms": [
      "Suspensión"
    ],
    "strengths": [
      "1:1"
    ],
    "presentations": [
      {
        "code": "A-02-01",
        "form": "Suspensión",
        "strength": "1:1",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A02BA02",
    "name": "Ranitidina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "150 mg",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "A-02-03",
        "form": "Comprimido",
        "strength": "150 mg",
        "restrictedUse": false
      },
      {
        "code": "A-02-04",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A02BB01",
    "name": "Misoprostol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "200 mcg"
    ],
    "presentations": [
      {
        "code": "A-02-06",
        "form": "Comprimido",
        "strength": "200 mcg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "A02BC01",
    "name": "Omeprazol",
    "doseForms": [
      "Cápsula",
      "Inyectable"
    ],
    "strengths": [
      "20 mg",
      "40 mg/ml"
    ],
    "presentations": [
      {
        "code": "A-02-02",
        "form": "Cápsula",
        "strength": "20 mg",
        "restrictedUse": false
      },
      {
        "code": "A-02-05",
        "form": "Inyectable",
        "strength": "40 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A02BX02",
    "name": "Sucralfato",
    "doseForms": [
      "Suspensión"
    ],
    "strengths": [
      "1g/5 ml"
    ],
    "presentations": [
      {
        "code": "A-02-07",
        "form": "Suspensión",
        "strength": "1g/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A03AX13",
    "name": "Simeticona",
    "doseForms": [
      "Suspensión",
      "Comprimido"
    ],
    "strengths": [
      "3% o 4%",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "A-03-12",
        "form": "Suspensión",
        "strength": "3% o 4%",
        "restrictedUse": false
      },
      {
        "code": "A-03-13",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A03BA01",
    "name": "Atropina sulfato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "A-03-01",
        "form": "Inyectable",
        "strength": "1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A03BB01",
    "name": "Butilbromuro de Hioscina (Butilescopolamina)",
    "doseForms": [
      "Comprimido",
      "Solución oral gotas",
      "Inyectable"
    ],
    "strengths": [
      "10 mg",
      "0,1%",
      "20 mg/ml"
    ],
    "presentations": [
      {
        "code": "A-03-02",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "A-03-03",
        "form": "Solución oral gotas",
        "strength": "0,1%",
        "restrictedUse": false
      },
      {
        "code": "A-03-04",
        "form": "Inyectable",
        "strength": "20 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A03FA01",
    "name": "Metoclopramida",
    "doseForms": [
      "Comprimido",
      "Inyectable",
      "Solución oral gotas"
    ],
    "strengths": [
      "10 mg",
      "10mg / 2ml",
      "0,35% o 0,5%"
    ],
    "presentations": [
      {
        "code": "A-03-07",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "A-03-08",
        "form": "Inyectable",
        "strength": "10mg / 2ml",
        "restrictedUse": false
      },
      {
        "code": "A-03-09",
        "form": "Solución oral gotas",
        "strength": "0,35% o 0,5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A03FA03",
    "name": "Domperidona",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "A-03-06",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A04AA01",
    "name": "Ondansetrón",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "8 mg"
    ],
    "presentations": [
      {
        "code": "A-04-01",
        "form": "Inyectable",
        "strength": "8 mg",
        "restrictedUse": false
      },
      {
        "code": "A-04-02",
        "form": "Comprimido",
        "strength": "8 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A05AA02",
    "name": "Ácido Ursodeoxicólico",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "A-05-01",
        "form": "Cápsula",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A06AB02",
    "name": "Bisacodilo",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "A-06-02",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A06AC07",
    "name": "Fibra natural",
    "doseForms": [
      "Polvo o granulado"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "A-06-04",
        "form": "Polvo o granulado",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A06AD04",
    "name": "Sulfato de Magnesio",
    "doseForms": [
      "Granulado"
    ],
    "strengths": [
      "20 g a 30 g"
    ],
    "presentations": [
      {
        "code": "A-06-08",
        "form": "Granulado",
        "strength": "20 g a 30 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A06AD11",
    "name": "Lactulosa",
    "doseForms": [
      "Solución oral"
    ],
    "strengths": [
      "65% a 67%"
    ],
    "presentations": [
      {
        "code": "A-06-07",
        "form": "Solución oral",
        "strength": "65% a 67%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A06AG06",
    "name": "Aceite mineral",
    "doseForms": [
      "Emulsión oral"
    ],
    "strengths": [
      "40%"
    ],
    "presentations": [
      {
        "code": "A-06-01",
        "form": "Emulsión oral",
        "strength": "40%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A06AX01",
    "name": "Glicerol (Glicerina)",
    "doseForms": [
      "Supositorio"
    ],
    "strengths": [
      "2 g a 4 g (adulto)",
      "1 g a 1,80 g (infantil)"
    ],
    "presentations": [
      {
        "code": "A-06-05",
        "form": "Supositorio",
        "strength": "2 g a 4 g (adulto)",
        "restrictedUse": false
      },
      {
        "code": "A-06-06",
        "form": "Supositorio",
        "strength": "1 g a 1,80 g (infantil)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A07AA02",
    "name": "Nistatina",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500.000 UI",
      "500.000 UI/5 ml"
    ],
    "presentations": [
      {
        "code": "A-07-03",
        "form": "Comprimido",
        "strength": "500.000 UI",
        "restrictedUse": false
      },
      {
        "code": "A-07-04",
        "form": "Suspensión",
        "strength": "500.000 UI/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A07BA01",
    "name": "Carbón medicinal activado",
    "doseForms": [
      "Polvo"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "A-07-01",
        "form": "Polvo",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A07DA03",
    "name": "Loperamida",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "2 mg"
    ],
    "presentations": [
      {
        "code": "A-07-02",
        "form": "Cápsula o Comprimido",
        "strength": "2 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A09AA02",
    "name": "Enzimas pancreáticas (Lipasa, Proteasa y Amilasa en combinación)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "A-09-01",
        "form": "Comprimido",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A10AB01",
    "name": "Insulina zinc cristalina recombinante humana",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 UI/ml"
    ],
    "presentations": [
      {
        "code": "A-10-03",
        "form": "Inyectable",
        "strength": "100 UI/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A10AB06",
    "name": "Insulina Glulisina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 U.I/ml"
    ],
    "presentations": [
      {
        "code": "A-10-06",
        "form": "Inyectable",
        "strength": "100 U.I/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A10AC01",
    "name": "Insulina recombinante humana NPH",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 UI/ml"
    ],
    "presentations": [
      {
        "code": "A-10-02",
        "form": "Inyectable",
        "strength": "100 UI/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A10AE04",
    "name": "Insulina Glargina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 U.I/ml"
    ],
    "presentations": [
      {
        "code": "A-10-05",
        "form": "Inyectable",
        "strength": "100 U.I/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A10BA02",
    "name": "Metformina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "850 mg",
      "500 mg"
    ],
    "presentations": [
      {
        "code": "A-10-04",
        "form": "Comprimido",
        "strength": "850 mg",
        "restrictedUse": false
      },
      {
        "code": "A-10-07",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A10BB01",
    "name": "Glibenclamida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "A-10-01",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11AA03",
    "name": "Multivitaminas",
    "doseForms": [
      "Comprimido",
      "Jarabe",
      "Polvo liofilizado"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "A-11-09",
        "form": "Comprimido",
        "strength": "Según concentración estándar",
        "restrictedUse": false
      },
      {
        "code": "A-11-10",
        "form": "Jarabe",
        "strength": "Según concentración estándar",
        "restrictedUse": false
      },
      {
        "code": "A-11-20",
        "form": "Polvo liofilizado",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11CA01",
    "name": "Retinol (Vitamina A)",
    "doseForms": [
      "Cápsula o Perla"
    ],
    "strengths": [
      "10.000 UI",
      "25.000 UI",
      "100.000 UI",
      "200.000 UI"
    ],
    "presentations": [
      {
        "code": "A-11-13",
        "form": "Cápsula o Perla",
        "strength": "10.000 UI",
        "restrictedUse": false
      },
      {
        "code": "A-11-14",
        "form": "Cápsula o Perla",
        "strength": "25.000 UI",
        "restrictedUse": false
      },
      {
        "code": "A-11-15",
        "form": "Cápsula o Perla",
        "strength": "100.000 UI",
        "restrictedUse": false
      },
      {
        "code": "A-11-16",
        "form": "Cápsula o Perla",
        "strength": "200.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11CC05",
    "name": "Colecalciferol (Vitamina D3)",
    "doseForms": [
      "Comprimido o Cápsula blanda"
    ],
    "strengths": [
      "0,25 mcg"
    ],
    "presentations": [
      {
        "code": "A-11-05",
        "form": "Comprimido o Cápsula blanda",
        "strength": "0,25 mcg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11DA01",
    "name": "Tiamina (Vitamina B 1)",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "300 mg",
      "100 mg/ml"
    ],
    "presentations": [
      {
        "code": "A-11-17",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      },
      {
        "code": "A-11-18",
        "form": "Inyectable",
        "strength": "100 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11GA01",
    "name": "Ácido Ascorbico (Vitamina C)",
    "doseForms": [
      "Inyectable",
      "Solución oral gotas"
    ],
    "strengths": [
      "500 mg/ml (2 ml)"
    ],
    "presentations": [
      {
        "code": "A-11-02",
        "form": "Inyectable",
        "strength": "500 mg/ml (2 ml)",
        "restrictedUse": false
      },
      {
        "code": "A-11-03",
        "form": "Solución oral gotas",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11HA02",
    "name": "Piridoxina clorhidrato (Vitamina B6)",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "300 mg"
    ],
    "presentations": [
      {
        "code": "A-11-11",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      },
      {
        "code": "A-11-12",
        "form": "Inyectable",
        "strength": "300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A11HA03",
    "name": "Tocoferol (Vitamina E)",
    "doseForms": [
      "Cápsula blanda"
    ],
    "strengths": [
      "1.000 UI"
    ],
    "presentations": [
      {
        "code": "A-11-19",
        "form": "Cápsula blanda",
        "strength": "1.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A12AA04",
    "name": "Calcio (carbonato o citrato)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg (ión calcio)"
    ],
    "presentations": [
      {
        "code": "A-12-01",
        "form": "Comprimido",
        "strength": "500 mg (ión calcio)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A12BA01",
    "name": "Cloruro de potasio",
    "doseForms": [
      "Solución oral"
    ],
    "strengths": [
      "1,3 mEq/ml"
    ],
    "presentations": [
      {
        "code": "A-12-03",
        "form": "Solución oral",
        "strength": "1,3 mEq/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A12CB01",
    "name": "Zinc (como sulfato)",
    "doseForms": [
      "Jarabe",
      "Comprimido"
    ],
    "strengths": [
      "20 mg/5 ml",
      "20 mg"
    ],
    "presentations": [
      {
        "code": "A-12-05",
        "form": "Jarabe",
        "strength": "20 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "A-12-06",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "A12CD01",
    "name": "Fluoruro de sodio",
    "doseForms": [
      "Solución oral gotas"
    ],
    "strengths": [
      "0,2%"
    ],
    "presentations": [
      {
        "code": "A-12-04",
        "form": "Solución oral gotas",
        "strength": "0,2%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B01AA03",
    "name": "Warfarina",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "B-01-05",
        "form": "Comprimido ranurado",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B01AB01",
    "name": "Heparina sódica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "5.000 UI/ml"
    ],
    "presentations": [
      {
        "code": "B-01-04",
        "form": "Inyectable",
        "strength": "5.000 UI/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B01AC04",
    "name": "Clopidogrel",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "75 mg"
    ],
    "presentations": [
      {
        "code": "B-01-06",
        "form": "Comprimido",
        "strength": "75 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B01AC06",
    "name": "Ácido acetil salicílico",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "B-01-01",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B01AD01",
    "name": "Estreptoquinasa",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1.500.000 UI"
    ],
    "presentations": [
      {
        "code": "B-01-02",
        "form": "Inyectable",
        "strength": "1.500.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B01AD11",
    "name": "Tenecteplasa",
    "doseForms": [
      "Polvo para Inyectable"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "B-01-08",
        "form": "Polvo para Inyectable",
        "strength": "50 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B01AX06",
    "name": "Rivaroxabán",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "B-01-07",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B02AA01",
    "name": "Ácido aminocapróico",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "2g /10 ml"
    ],
    "presentations": [
      {
        "code": "B-02-01",
        "form": "Inyectable",
        "strength": "2g /10 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B02AA02",
    "name": "Ácido Tranexámico",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "B-02-06",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": true
      },
      {
        "code": "B-02-07",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B02BA01",
    "name": "Fitomenadiona (Vitamina K1)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "B-02-02",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B02BB01",
    "name": "Fibrinógeno humano",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1g"
    ],
    "presentations": [
      {
        "code": "B-02-08",
        "form": "Inyectable",
        "strength": "1g",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B02BD02",
    "name": "Factor VIII de la coagulación",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 UI"
    ],
    "presentations": [
      {
        "code": "B-02-04",
        "form": "Inyectable",
        "strength": "500 UI",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B02BD04",
    "name": "Factor IX de la coagulación",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 UI"
    ],
    "presentations": [
      {
        "code": "B-02-05",
        "form": "Inyectable",
        "strength": "500 UI",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B02BX01",
    "name": "Etamsilato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "250 mg/2 ml"
    ],
    "presentations": [
      {
        "code": "B-02-03",
        "form": "Inyectable",
        "strength": "250 mg/2 ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "B03AA01",
    "name": "Hierro (como bisglicina quelato)",
    "doseForms": [
      "Suspensión"
    ],
    "strengths": [
      "30 mg/5 mL"
    ],
    "presentations": [
      {
        "code": "B-03-12",
        "form": "Suspensión",
        "strength": "30 mg/5 mL",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B03AA07",
    "name": "Sulfato ferroso",
    "doseForms": [
      "Comprimido",
      "Solución oral"
    ],
    "strengths": [
      "200 mg",
      "125 mg/ml"
    ],
    "presentations": [
      {
        "code": "B-03-06",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "B-03-07",
        "form": "Solución oral",
        "strength": "125 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B03AC02",
    "name": "Hierro",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg - IM o IV"
    ],
    "presentations": [
      {
        "code": "B-03-04",
        "form": "Inyectable",
        "strength": "100 mg - IM o IV",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B03AE10",
    "name": "Sulfato ferroso + Ac. Fólico + Vitamina C",
    "doseForms": [
      "Polvo",
      "Comprimido",
      "Solución oral"
    ],
    "strengths": [
      "200 mg + 0,5 mg + 150 mg",
      "125 mg + 0,25 mg + 30 mg"
    ],
    "presentations": [
      {
        "code": "B-03-05",
        "form": "Polvo",
        "strength": "Según concentración estándar",
        "restrictedUse": false
      },
      {
        "code": "B-03-08",
        "form": "Comprimido",
        "strength": "200 mg + 0,5 mg + 150 mg",
        "restrictedUse": false
      },
      {
        "code": "B-03-09",
        "form": "Solución oral",
        "strength": "125 mg + 0,25 mg + 30 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B03BB01",
    "name": "Ácido fólico",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "5 mg",
      "800 mcg"
    ],
    "presentations": [
      {
        "code": "B-03-01",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      },
      {
        "code": "B-03-10",
        "form": "Comprimido",
        "strength": "800 mcg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B03XA01",
    "name": "Eritropoyetina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10.000 UI",
      "2.000 UI",
      "4000 UI"
    ],
    "presentations": [
      {
        "code": "B-03-02",
        "form": "Inyectable",
        "strength": "10.000 UI",
        "restrictedUse": false
      },
      {
        "code": "B-03-03",
        "form": "Inyectable",
        "strength": "2.000 UI",
        "restrictedUse": false
      },
      {
        "code": "B-03-11",
        "form": "Inyectable",
        "strength": "4000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05AA01",
    "name": "Albúmina humana",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20%"
    ],
    "presentations": [
      {
        "code": "B-05-02",
        "form": "Inyectable",
        "strength": "20%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05AA05",
    "name": "Dextrán 70",
    "doseForms": [
      "Solución parenteral de gran volúmen"
    ],
    "strengths": [
      "6%"
    ],
    "presentations": [
      {
        "code": "B-05-08",
        "form": "Solución parenteral de gran volúmen",
        "strength": "6%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05AA06",
    "name": "Agentes con gelatina",
    "doseForms": [
      "Solución parenteral de gran volúmen"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "B-05-12",
        "form": "Solución parenteral de gran volúmen",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05BA01",
    "name": "Aminoácidos",
    "doseForms": [
      "Solución parenteral de gran volumen"
    ],
    "strengths": [
      "10%"
    ],
    "presentations": [
      {
        "code": "B-05-03",
        "form": "Solución parenteral de gran volumen",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05BA02",
    "name": "Emulsión de lípidos",
    "doseForms": [
      "Emulsión inyectable"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "B-05-09",
        "form": "Emulsión inyectable",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05BA10",
    "name": "Oligoelementos para nutricion parenteral",
    "doseForms": [
      "Solución parenteral de gran volúmen"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "B-05-11",
        "form": "Solución parenteral de gran volúmen",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05CB01",
    "name": "Solución Fisiológica",
    "doseForms": [
      "Inyectable",
      "Solución parenteral de gran volumen",
      "Solución parenteral"
    ],
    "strengths": [
      "20%",
      "0,9% (500 ml)",
      "0,9% (1.000 ml)",
      "0,9% (150 ml)",
      "0,9% (100 ml)"
    ],
    "presentations": [
      {
        "code": "B-05-07",
        "form": "Inyectable",
        "strength": "20%",
        "restrictedUse": false
      },
      {
        "code": "B-05-22",
        "form": "Solución parenteral de gran volumen",
        "strength": "0,9% (500 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-23",
        "form": "Solución parenteral de gran volumen",
        "strength": "0,9% (1.000 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-34",
        "form": "Solución parenteral",
        "strength": "0,9% (150 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-37",
        "form": "Solución parenteral",
        "strength": "0,9% (100 ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05CB04",
    "name": "Bicarbonato de sodio p/hemodiálisis",
    "doseForms": [
      "Polvo"
    ],
    "strengths": [
      "Frasco por 720 g"
    ],
    "presentations": [
      {
        "code": "B-05-05",
        "form": "Polvo",
        "strength": "Frasco por 720 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05CB10",
    "name": "Solución glucosada clorurada",
    "doseForms": [
      "Solución parenteral de gran volumen"
    ],
    "strengths": [
      "500 ml",
      "1.000 ml"
    ],
    "presentations": [
      {
        "code": "B-05-24",
        "form": "Solución parenteral de gran volumen",
        "strength": "500 ml",
        "restrictedUse": false
      },
      {
        "code": "B-05-25",
        "form": "Solución parenteral de gran volumen",
        "strength": "1.000 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05CX01",
    "name": "Solución de glucosa",
    "doseForms": [
      "Solución parenteral de gran volumen",
      "Inyectable",
      "Solución parenteral"
    ],
    "strengths": [
      "5% (500 ml)",
      "5% (1.000 ml)",
      "10% (500 ml)",
      "10% (1.000 ml)",
      "50% (500 ml)",
      "50% (20 ml)",
      "10% (250 ml)"
    ],
    "presentations": [
      {
        "code": "B-05-15",
        "form": "Solución parenteral de gran volumen",
        "strength": "5% (500 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-16",
        "form": "Solución parenteral de gran volumen",
        "strength": "5% (1.000 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-17",
        "form": "Solución parenteral de gran volumen",
        "strength": "10% (500 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-18",
        "form": "Solución parenteral de gran volumen",
        "strength": "10% (1.000 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-19",
        "form": "Solución parenteral de gran volumen",
        "strength": "50% (500 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-20",
        "form": "Inyectable",
        "strength": "50% (20 ml)",
        "restrictedUse": false
      },
      {
        "code": "B-05-36",
        "form": "Solución parenteral",
        "strength": "10% (250 ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05CX04",
    "name": "Solución de Manitol",
    "doseForms": [
      "Solución parenteral de gran volumen"
    ],
    "strengths": [
      "20% (500 ml)"
    ],
    "presentations": [
      {
        "code": "B-05-21",
        "form": "Solución parenteral de gran volumen",
        "strength": "20% (500 ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05XA01",
    "name": "Cloruro de potasio",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20%"
    ],
    "presentations": [
      {
        "code": "B-05-06",
        "form": "Inyectable",
        "strength": "20%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05XA02",
    "name": "Bicarbonato de sodio",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "8%"
    ],
    "presentations": [
      {
        "code": "B-05-04",
        "form": "Inyectable",
        "strength": "8%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05XA05",
    "name": "Sulfato de Magnesio",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10%"
    ],
    "presentations": [
      {
        "code": "B-05-33",
        "form": "Inyectable",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05XA07",
    "name": "Gluconato Cálcico (Calcio Gluconato)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10%"
    ],
    "presentations": [
      {
        "code": "B-05-10",
        "form": "Inyectable",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "B05XA30",
    "name": "Solución ringer normal",
    "doseForms": [
      "Solución parenteral de gran volumen"
    ],
    "strengths": [
      "500 ml",
      "1.000 ml"
    ],
    "presentations": [
      {
        "code": "B-05-29",
        "form": "Solución parenteral de gran volumen",
        "strength": "500 ml",
        "restrictedUse": false
      },
      {
        "code": "B-05-30",
        "form": "Solución parenteral de gran volumen",
        "strength": "1.000 ml",
        "restrictedUse": false
      },
      {
        "code": "B-05-31",
        "form": "Solución parenteral de gran volumen",
        "strength": "500 ml",
        "restrictedUse": false
      },
      {
        "code": "B-05-32",
        "form": "Solución parenteral de gran volumen",
        "strength": "1.000 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01AA05",
    "name": "Digoxina",
    "doseForms": [
      "Solución oral gotas",
      "Inyectable",
      "Comprimido ranurado"
    ],
    "strengths": [
      "0,75 mg/ml",
      "0,25 mg/ml",
      "0,25 mg"
    ],
    "presentations": [
      {
        "code": "C-01-04",
        "form": "Solución oral gotas",
        "strength": "0,75 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "C-01-05",
        "form": "Inyectable",
        "strength": "0,25 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "C-01-06",
        "form": "Comprimido ranurado",
        "strength": "0,25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01BD01",
    "name": "Amiodarona (clorhidrato)",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "200 mg",
      "50 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-02",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "C-01-03",
        "form": "Inyectable",
        "strength": "50 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01CA01",
    "name": "Etilefrina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-13",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01CA03",
    "name": "Noradrenalina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-15",
        "form": "Inyectable",
        "strength": "1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01CA04",
    "name": "Dopamina clorhidrato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "C-01-09",
        "form": "Inyectable",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01CA07",
    "name": "Dobutamina clorhidrato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "C-01-08",
        "form": "Inyectable",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01CA24",
    "name": "Epinefrina (Adrenalina)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-10",
        "form": "Inyectable",
        "strength": "1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01CE02",
    "name": "Milrinona",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-16",
        "form": "Inyectable",
        "strength": "1 mg/ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "C01DA02",
    "name": "Nitroglicerina (Trinitrato de glicerol)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "5 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-12",
        "form": "Inyectable",
        "strength": "5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01DA08",
    "name": "Dinitrato de isosorbida (Isosorbide dinitrato)",
    "doseForms": [
      "Comprimido sublingual"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "C-01-07",
        "form": "Comprimido sublingual",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01DA14",
    "name": "Isosorbida Mononitrato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "C-01-11",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01EB10",
    "name": "Adenosina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "6 mg/2 ml"
    ],
    "presentations": [
      {
        "code": "C-01-01",
        "form": "Inyectable",
        "strength": "6 mg/2 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C01EB16",
    "name": "Ibuprofeno",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "5 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-01-14",
        "form": "Inyectable",
        "strength": "5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C02AB02",
    "name": "Metildopa (Alfametildopa)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "C-02-04",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C02DB02",
    "name": "Hidralazina clorhidrato",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "20 mg/ml",
      "25 mg"
    ],
    "presentations": [
      {
        "code": "C-02-03",
        "form": "Inyectable",
        "strength": "20 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "C-02-07",
        "form": "Comprimido",
        "strength": "25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C02DD01",
    "name": "Nitroprusiato de sodio",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "25 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-02-05",
        "form": "Inyectable",
        "strength": "25 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C03AA03",
    "name": "Hidroclorotiazida",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "C-03-06",
        "form": "Comprimido ranurado",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C03AX01",
    "name": "Hidroclorotiazida + Amilorida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "50 mg + 5 mg"
    ],
    "presentations": [
      {
        "code": "C-03-07",
        "form": "Comprimido",
        "strength": "50 mg + 5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C03CA01",
    "name": "Furosemida",
    "doseForms": [
      "Comprimido ranurado",
      "Inyectable"
    ],
    "strengths": [
      "40 mg",
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-03-04",
        "form": "Comprimido ranurado",
        "strength": "40 mg",
        "restrictedUse": false
      },
      {
        "code": "C-03-05",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C03DA01",
    "name": "Espironolactona",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg",
      "25 mg"
    ],
    "presentations": [
      {
        "code": "C-03-02",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "C-03-03",
        "form": "Comprimido",
        "strength": "25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C05AX03",
    "name": "Corticoide + anestésico",
    "doseForms": [
      "Supositorio",
      "Crema o Pomada"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "C-05-01",
        "form": "Supositorio",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "C-05-02",
        "form": "Crema o Pomada",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C07AA05",
    "name": "Propranolol",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "40 mg",
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-07-02",
        "form": "Comprimido",
        "strength": "40 mg",
        "restrictedUse": false
      },
      {
        "code": "C-07-03",
        "form": "Inyectable",
        "strength": "1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C07AB03",
    "name": "Atenolol",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "C-07-01",
        "form": "Comprimido ranurado",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C07AB07",
    "name": "Bisoprolol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "C-07-06",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C07AG01",
    "name": "Labetalol",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "C-07-07",
        "form": "Inyectable",
        "strength": "20 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "C07AG02",
    "name": "Carvedilol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "6,25 mg",
      "12,5 mg"
    ],
    "presentations": [
      {
        "code": "C-07-04",
        "form": "Comprimido",
        "strength": "6,25 mg",
        "restrictedUse": false
      },
      {
        "code": "C-07-05",
        "form": "Comprimido",
        "strength": "12,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C08CA01",
    "name": "Amlodipina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "C-08-07",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C08CA05",
    "name": "Nifedipino",
    "doseForms": [
      "Comprimido o Cápsula"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "C-08-08",
        "form": "Comprimido o Cápsula",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C08CA06",
    "name": "Nimodipina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "30 mg",
      "0,2 mg/ml"
    ],
    "presentations": [
      {
        "code": "C-08-02",
        "form": "Comprimido",
        "strength": "30 mg",
        "restrictedUse": false
      },
      {
        "code": "C-08-03",
        "form": "Inyectable",
        "strength": "0,2 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C08DA01",
    "name": "Verapamilo",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "80 mg",
      "2,5 mg/ml",
      "40 mg"
    ],
    "presentations": [
      {
        "code": "C-08-04",
        "form": "Comprimido",
        "strength": "80 mg",
        "restrictedUse": false
      },
      {
        "code": "C-08-05",
        "form": "Inyectable",
        "strength": "2,5 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "C-08-06",
        "form": "Comprimido",
        "strength": "40 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C09AA02",
    "name": "Enalapril maleato",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "C-09-01",
        "form": "Comprimido ranurado",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C09CA01",
    "name": "Losartán",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "C-09-02",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C10AA05",
    "name": "Atorvastatina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg",
      "20 mg"
    ],
    "presentations": [
      {
        "code": "C-10-01",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "C-10-05",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C10AA07",
    "name": "Rosuvastatina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "C-10-03",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C10AB04",
    "name": "Gemfibrozilo",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "600 mg"
    ],
    "presentations": [
      {
        "code": "C-10-02",
        "form": "Comprimido",
        "strength": "600 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "C10AB05",
    "name": "Fenofibrato",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "C-10-04",
        "form": "Cápsula o Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AA01",
    "name": "Nistatina",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "100.000 UI/g"
    ],
    "presentations": [
      {
        "code": "D-01-04",
        "form": "Crema o Pomada",
        "strength": "100.000 UI/g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AA20",
    "name": "Bacitracina + Neomicina sulfato",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "500 UI + 5 mg/g"
    ],
    "presentations": [
      {
        "code": "D-01-02",
        "form": "Crema o Pomada",
        "strength": "500 UI + 5 mg/g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AC01",
    "name": "Clotrimazol",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "D-01-03",
        "form": "Crema o Pomada",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AC06",
    "name": "Tiabendazol",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "5%"
    ],
    "presentations": [
      {
        "code": "D-01-05",
        "form": "Crema o Pomada",
        "strength": "5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AE02",
    "name": "Violeta de genciana (Cloruro de metilrosanilina)",
    "doseForms": [
      "Solución"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "D-01-07",
        "form": "Solución",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AE12",
    "name": "Ácido salicílico",
    "doseForms": [
      "Solución tópica"
    ],
    "strengths": [
      "5%"
    ],
    "presentations": [
      {
        "code": "D-01-01",
        "form": "Solución tópica",
        "strength": "5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AE15",
    "name": "Terbinafina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "D-01-08",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D01AE18",
    "name": "Tolnaftato",
    "doseForms": [
      "Solución"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "D-01-06",
        "form": "Solución",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D03AX12",
    "name": "Trolamina",
    "doseForms": [
      "Emulsión dermica"
    ],
    "strengths": [
      "0,67%"
    ],
    "presentations": [
      {
        "code": "D-03-01",
        "form": "Emulsión dermica",
        "strength": "0,67%",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "D04AB01",
    "name": "Lidocaína",
    "doseForms": [
      "Gel o Jalea",
      "Solución para atomización"
    ],
    "strengths": [
      "2%",
      "10%"
    ],
    "presentations": [
      {
        "code": "D-04-01",
        "form": "Gel o Jalea",
        "strength": "2%",
        "restrictedUse": false
      },
      {
        "code": "D-04-02",
        "form": "Solución para atomización",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D06BA01",
    "name": "Sulfadiazina de plata",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "D-06-02",
        "form": "Crema o Pomada",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D06BB03",
    "name": "Aciclovir",
    "doseForms": [
      "Crema dérmica"
    ],
    "strengths": [
      "5%"
    ],
    "presentations": [
      {
        "code": "D-06-03",
        "form": "Crema dérmica",
        "strength": "5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D06BB04",
    "name": "Resina de Podofilo (Podofilina)",
    "doseForms": [
      "Solución tópica"
    ],
    "strengths": [
      "10% o 25%"
    ],
    "presentations": [
      {
        "code": "D-06-01",
        "form": "Solución tópica",
        "strength": "10% o 25%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D07AA02",
    "name": "Hidrocortisona acetato",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "D-07-04",
        "form": "Crema o Pomada",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D07AC01",
    "name": "Betametasona (valerato)",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "0,1%"
    ],
    "presentations": [
      {
        "code": "D-07-01",
        "form": "Crema o Pomada",
        "strength": "0,1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D07AD01",
    "name": "Clobetasol",
    "doseForms": [
      "Crema o Pomada",
      "Solución"
    ],
    "strengths": [
      "0,05%"
    ],
    "presentations": [
      {
        "code": "D-07-02",
        "form": "Crema o Pomada",
        "strength": "0,05%",
        "restrictedUse": false
      },
      {
        "code": "D-07-03",
        "form": "Solución",
        "strength": "0,05%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AC02",
    "name": "Clorhexidina gluconato",
    "doseForms": [
      "Solución"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "D-08-02",
        "form": "Solución",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AF01",
    "name": "Nitrofural (Nitrofurazona)",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "0,2% (450 g)"
    ],
    "presentations": [
      {
        "code": "D-08-09",
        "form": "Crema o Pomada",
        "strength": "0,2% (450 g)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AG02",
    "name": "Iodo povidona (Yodopovidona)",
    "doseForms": [
      "Crema o Pomada",
      "Solución"
    ],
    "strengths": [
      "10% ( 500 g )",
      "10%"
    ],
    "presentations": [
      {
        "code": "D-08-07",
        "form": "Crema o Pomada",
        "strength": "10% ( 500 g )",
        "restrictedUse": false
      },
      {
        "code": "D-08-08",
        "form": "Solución",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AG03",
    "name": "Iodo (Yodo)",
    "doseForms": [
      "Solución hidroalcohólica"
    ],
    "strengths": [
      "2%"
    ],
    "presentations": [
      {
        "code": "D-08-06",
        "form": "Solución hidroalcohólica",
        "strength": "2%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AX01",
    "name": "Peróxido de hidrógeno (Agua oxigenada)",
    "doseForms": [
      "Solución"
    ],
    "strengths": [
      "2% o 3%"
    ],
    "presentations": [
      {
        "code": "D-08-10",
        "form": "Solución",
        "strength": "2% o 3%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AX07",
    "name": "Hipoclorito de sodio",
    "doseForms": [
      "Solución"
    ],
    "strengths": [
      "8%"
    ],
    "presentations": [
      {
        "code": "D-08-05",
        "form": "Solución",
        "strength": "8%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D08AX08",
    "name": "Alcohol etílico (Etanol)",
    "doseForms": [
      "Solución 1 l"
    ],
    "strengths": [
      "70% a 95%"
    ],
    "presentations": [
      {
        "code": "D-08-01",
        "form": "Solución 1 l",
        "strength": "70% a 95%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D10AE01",
    "name": "Peróxido de Benzoílo",
    "doseForms": [
      "Loción",
      "Crema, Pomada o Gel"
    ],
    "strengths": [
      "5%"
    ],
    "presentations": [
      {
        "code": "D-10-02",
        "form": "Loción",
        "strength": "5%",
        "restrictedUse": false
      },
      {
        "code": "D-10-03",
        "form": "Crema, Pomada o Gel",
        "strength": "5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D10AF02",
    "name": "Eritromicina",
    "doseForms": [
      "Loción"
    ],
    "strengths": [
      "2% a 4%"
    ],
    "presentations": [
      {
        "code": "D-10-01",
        "form": "Loción",
        "strength": "2% a 4%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D10AX02",
    "name": "Resorcinol",
    "doseForms": [
      "Crema o Pomada"
    ],
    "strengths": [
      "10%"
    ],
    "presentations": [
      {
        "code": "D-10-04",
        "form": "Crema o Pomada",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "D11AX11",
    "name": "Hidroquinona",
    "doseForms": [
      "Loción",
      "Crema a Pomada"
    ],
    "strengths": [
      "4% o 5%",
      "4% o 5 %"
    ],
    "presentations": [
      {
        "code": "D-11-01",
        "form": "Loción",
        "strength": "4% o 5%",
        "restrictedUse": false
      },
      {
        "code": "D-11-02",
        "form": "Crema a Pomada",
        "strength": "4% o 5 %",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G01AA01",
    "name": "Nistatina",
    "doseForms": [
      "Óvulo"
    ],
    "strengths": [
      "100.000 UI"
    ],
    "presentations": [
      {
        "code": "G-01-05",
        "form": "Óvulo",
        "strength": "100.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G01AD02",
    "name": "Ácido acético (Ácido tricloroacético)",
    "doseForms": [
      "Solución tópica"
    ],
    "strengths": [
      "50%"
    ],
    "presentations": [
      {
        "code": "G-01-01",
        "form": "Solución tópica",
        "strength": "50%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G01AF01",
    "name": "Metronidazol",
    "doseForms": [
      "Óvulo"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "G-01-04",
        "form": "Óvulo",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G01AF02",
    "name": "Clotrimazol",
    "doseForms": [
      "Óvulo",
      "Crema vaginal"
    ],
    "strengths": [
      "100 mg",
      "1%"
    ],
    "presentations": [
      {
        "code": "G-01-02",
        "form": "Óvulo",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "G-01-03",
        "form": "Crema vaginal",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G02AB03",
    "name": "Ergometrina maleato",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "0,2 mg",
      "0,2 mg/ml"
    ],
    "presentations": [
      {
        "code": "G-02-03",
        "form": "Comprimido",
        "strength": "0,2 mg",
        "restrictedUse": false
      },
      {
        "code": "G-02-04",
        "form": "Inyectable",
        "strength": "0,2 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G02AD06",
    "name": "Misoprostol",
    "doseForms": [
      "Comprimido vaginal"
    ],
    "strengths": [
      "25 mcg"
    ],
    "presentations": [
      {
        "code": "G-02-08",
        "form": "Comprimido vaginal",
        "strength": "25 mcg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "G02CA01",
    "name": "Ritodrina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "10 mg",
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "G-02-06",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "G-02-07",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G02CB01",
    "name": "Bromocriptina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2,5 mg",
      "5 mg"
    ],
    "presentations": [
      {
        "code": "G-02-01",
        "form": "Comprimido",
        "strength": "2,5 mg",
        "restrictedUse": false
      },
      {
        "code": "G-02-02",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G02CB03",
    "name": "Cabergolina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "0,5 mg"
    ],
    "presentations": [
      {
        "code": "G-02-11",
        "form": "Comprimido",
        "strength": "0,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03AC03",
    "name": "Levonorgestrel",
    "doseForms": [
      "Implante subdérmico"
    ],
    "strengths": [
      "150 mg"
    ],
    "presentations": [
      {
        "code": "G-03-19",
        "form": "Implante subdérmico",
        "strength": "150 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03AC06",
    "name": "Medroxiprogesterona acetato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "150 mg/ml",
      "104mg/0,65 ml"
    ],
    "presentations": [
      {
        "code": "G-03-13",
        "form": "Inyectable",
        "strength": "150 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "G-03-21",
        "form": "Inyectable",
        "strength": "104mg/0,65 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03AD01",
    "name": "Levonorgestrel",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "0,75 mg",
      "1,5 mg"
    ],
    "presentations": [
      {
        "code": "G-03-11",
        "form": "Comprimido",
        "strength": "0,75 mg",
        "restrictedUse": false
      },
      {
        "code": "G-03-20",
        "form": "Comprimido",
        "strength": "1,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03BA03",
    "name": "Testosterona undecanoato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1.000 mg"
    ],
    "presentations": [
      {
        "code": "G-03-18",
        "form": "Inyectable",
        "strength": "1.000 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03CA57",
    "name": "Estrógenos conjugados",
    "doseForms": [
      "Comprimido",
      "Crema vaginal"
    ],
    "strengths": [
      "0,625 mg",
      "1,25 mg"
    ],
    "presentations": [
      {
        "code": "G-03-07",
        "form": "Comprimido",
        "strength": "0,625 mg",
        "restrictedUse": false
      },
      {
        "code": "G-03-08",
        "form": "Comprimido",
        "strength": "1,25 mg",
        "restrictedUse": false
      },
      {
        "code": "G-03-09",
        "form": "Crema vaginal",
        "strength": "0,625 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03DA02",
    "name": "Medroxiprogesterona acetato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "G-03-14",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03DA04",
    "name": "Progesterona",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "G-03-22",
        "form": "Cápsula",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03DC02",
    "name": "Noretisterona",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "G-03-15",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03EA03",
    "name": "Estradiol valerianato + Prasterona enantato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "4 mg + 200 mg/ml"
    ],
    "presentations": [
      {
        "code": "G-03-06",
        "form": "Inyectable",
        "strength": "4 mg + 200 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03FA10",
    "name": "Estradiol valerianato + Norgestrel",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2 mg + 0,5 mg"
    ],
    "presentations": [
      {
        "code": "G-03-05",
        "form": "Comprimido",
        "strength": "2 mg + 0,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03FB01",
    "name": "Norgestrel + Etinilestradiol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "0,3 mg + 0,03 mg ó 0,5 mg + 0,05 mg"
    ],
    "presentations": [
      {
        "code": "G-03-16",
        "form": "Comprimido",
        "strength": "0,3 mg + 0,03 mg ó 0,5 mg + 0,05 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03FB05",
    "name": "Estradiol + Noretisterona acetato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2mg + 1mg"
    ],
    "presentations": [
      {
        "code": "G-03-04",
        "form": "Comprimido",
        "strength": "2mg + 1mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03FB09",
    "name": "Levonorgestrel + Etinilestradiol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "0,150 mg + 0,03 mg"
    ],
    "presentations": [
      {
        "code": "G-03-12",
        "form": "Comprimido",
        "strength": "0,150 mg + 0,03 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03GA01",
    "name": "Gonadotrofina coriónica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "5.000 UI/ml"
    ],
    "presentations": [
      {
        "code": "G-03-10",
        "form": "Inyectable",
        "strength": "5.000 UI/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03GB02",
    "name": "Clomifeno citrato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "G-03-03",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03HA01",
    "name": "Ciproterona acetato + Estradiol valerato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2 mg + 1 mg",
      "2 mg + 0,035 mg"
    ],
    "presentations": [
      {
        "code": "G-03-01",
        "form": "Comprimido",
        "strength": "2 mg + 1 mg",
        "restrictedUse": false
      },
      {
        "code": "G-03-02",
        "form": "Comprimido",
        "strength": "2 mg + 0,035 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G03XB01",
    "name": "Mifepristona",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "G-02-10",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "G04CB01",
    "name": "Finasterida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "G-04-01",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H01AA01",
    "name": "Corticotrofina (ACTH)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "25 UI o 40 UI"
    ],
    "presentations": [
      {
        "code": "H-01-01",
        "form": "Inyectable",
        "strength": "25 UI o 40 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H01AC01",
    "name": "Somatropina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "4UI (1,33 mg)"
    ],
    "presentations": [
      {
        "code": "H-01-04",
        "form": "Inyectable",
        "strength": "4UI (1,33 mg)",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "H01BA02",
    "name": "Desmopresina acetato",
    "doseForms": [
      "Solución nasal"
    ],
    "strengths": [
      "0,1 mg/ml"
    ],
    "presentations": [
      {
        "code": "H-01-02",
        "form": "Solución nasal",
        "strength": "0,1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H01BA04",
    "name": "Terlipresina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 mg"
    ],
    "presentations": [
      {
        "code": "H-01-03",
        "form": "Inyectable",
        "strength": "1 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "H01BB03",
    "name": "Carbetocina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mcg/ml"
    ],
    "presentations": [
      {
        "code": "H-01-05",
        "form": "Inyectable",
        "strength": "100 mcg/ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "H02AB01",
    "name": "Betametasona (fosfato)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "4 mg"
    ],
    "presentations": [
      {
        "code": "H-02-01",
        "form": "Inyectable",
        "strength": "4 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H02AB02",
    "name": "Dexametasona",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "4 mg",
      "0,5 mg",
      "4 mg/ml"
    ],
    "presentations": [
      {
        "code": "H-02-02",
        "form": "Comprimido",
        "strength": "4 mg",
        "restrictedUse": false
      },
      {
        "code": "H-02-03",
        "form": "Comprimido",
        "strength": "0,5 mg",
        "restrictedUse": false
      },
      {
        "code": "H-02-04",
        "form": "Inyectable",
        "strength": "4 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H02AB04",
    "name": "Metilprednisolona succinato sódico",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "H-02-07",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H02AB07",
    "name": "Prednisona",
    "doseForms": [
      "Comprimido",
      "Comprimido ranurado",
      "Suspensión"
    ],
    "strengths": [
      "5 mg",
      "20 mg",
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "H-02-08",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      },
      {
        "code": "H-02-09",
        "form": "Comprimido ranurado",
        "strength": "20 mg",
        "restrictedUse": false
      },
      {
        "code": "H-02-10",
        "form": "Suspensión",
        "strength": "1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H02AB09",
    "name": "Hidrocortisona succinato sódico",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg",
      "250 mg"
    ],
    "presentations": [
      {
        "code": "H-02-05",
        "form": "Inyectable",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "H-02-06",
        "form": "Inyectable",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H03AA01",
    "name": "Levotiroxina sódica",
    "doseForms": [
      "Comprimido ranurado",
      "Comprimido"
    ],
    "strengths": [
      "0,1 mg",
      "0,05 mg"
    ],
    "presentations": [
      {
        "code": "H-03-01",
        "form": "Comprimido ranurado",
        "strength": "0,1 mg",
        "restrictedUse": false
      },
      {
        "code": "H-03-03",
        "form": "Comprimido",
        "strength": "0,05 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H03BA02",
    "name": "Propiltiouracilo",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "H-03-02",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "H03BB02",
    "name": "Tiamazol (Metimazol)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "H-03-04",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01AA02",
    "name": "Doxiciclina",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-01-44",
        "form": "Cápsula o Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01AA07",
    "name": "Tetraciclina",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-54",
        "form": "Cápsula o Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01AA08",
    "name": "Minociclina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-01-73",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01BA01",
    "name": "Cloranfenicol",
    "doseForms": [
      "Cápsula",
      "Inyectable"
    ],
    "strengths": [
      "500 mg",
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-32",
        "form": "Cápsula",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-33",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CA01",
    "name": "Ampicilina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-12",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CA04",
    "name": "Amoxicilina",
    "doseForms": [
      "Comprimido",
      "Inyectable",
      "Suspensión"
    ],
    "strengths": [
      "1 g",
      "500 mg",
      "500 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-05",
        "form": "Comprimido",
        "strength": "1 g",
        "restrictedUse": false
      },
      {
        "code": "J-01-06",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-08",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      },
      {
        "code": "J-01-57",
        "form": "Suspensión",
        "strength": "500 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CE01",
    "name": "Bencilpenicilina sódica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1.000.000 UI",
      "30.000.000 UI"
    ],
    "presentations": [
      {
        "code": "J-01-19",
        "form": "Inyectable",
        "strength": "1.000.000 UI",
        "restrictedUse": false
      },
      {
        "code": "J-01-20",
        "form": "Inyectable",
        "strength": "30.000.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CE08",
    "name": "Bencilpenicilina benzatínica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "600.000 UI",
      "1.200.000 UI",
      "2.400.000 UI"
    ],
    "presentations": [
      {
        "code": "J-01-14",
        "form": "Inyectable",
        "strength": "600.000 UI",
        "restrictedUse": false
      },
      {
        "code": "J-01-15",
        "form": "Inyectable",
        "strength": "1.200.000 UI",
        "restrictedUse": false
      },
      {
        "code": "J-01-16",
        "form": "Inyectable",
        "strength": "2.400.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CE09",
    "name": "Bencilpenicilina procaínica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "400.000 UI",
      "800.000 UI"
    ],
    "presentations": [
      {
        "code": "J-01-17",
        "form": "Inyectable",
        "strength": "400.000 UI",
        "restrictedUse": false
      },
      {
        "code": "J-01-18",
        "form": "Inyectable",
        "strength": "800.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CF01",
    "name": "Dicloxacilina sódica",
    "doseForms": [
      "Cápsula",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "250 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-41",
        "form": "Cápsula",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-42",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CF02",
    "name": "Cloxacilina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg",
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-34",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-36",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CR02",
    "name": "Amoxicilina + inhibidor betalactamasa",
    "doseForms": [
      "Comprimido",
      "Suspensión",
      "Inyectable"
    ],
    "strengths": [
      "500 mg + Según disponibilidad",
      "250 mg + Según disponibilidad",
      "1 g + Según disponibilidad",
      "875 mg + Según disponibilidad"
    ],
    "presentations": [
      {
        "code": "J-01-09",
        "form": "Comprimido",
        "strength": "500 mg + Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "J-01-10",
        "form": "Suspensión",
        "strength": "250 mg + Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "J-01-11",
        "form": "Inyectable",
        "strength": "1 g + Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "J-01-71",
        "form": "Comprimido",
        "strength": "875 mg + Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01CR05",
    "name": "Piperacilina + Tazobactam",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "4 g/500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-75",
        "form": "Inyectable",
        "strength": "4 g/500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01DB04",
    "name": "Cefazolina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-21",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DB09",
    "name": "Cefradina",
    "doseForms": [
      "Cápsula o Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "250 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-23",
        "form": "Cápsula o Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-24",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DD01",
    "name": "Cefotaxima",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-22",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DD02",
    "name": "Ceftazidima",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-25",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DD04",
    "name": "Ceftriaxona",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-01-26",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DD08",
    "name": "Cefixima",
    "doseForms": [
      "Comprimido o Cápsula",
      "Suspensión"
    ],
    "strengths": [
      "400 mg",
      "100 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-58",
        "form": "Comprimido o Cápsula",
        "strength": "400 mg",
        "restrictedUse": true
      },
      {
        "code": "J-01-63",
        "form": "Suspensión",
        "strength": "100 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DE01",
    "name": "Cefepima",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1g"
    ],
    "presentations": [
      {
        "code": "J-01-74",
        "form": "Inyectable",
        "strength": "1g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01DH02",
    "name": "Meropenem",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-69",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01DH51",
    "name": "Imipenem + Cilastatina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg + 500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-50",
        "form": "Inyectable",
        "strength": "500 mg + 500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01EE01",
    "name": "Cotrimoxazol (Sulfametoxazol + Trimetoprima)",
    "doseForms": [
      "Comprimido",
      "Suspensión",
      "Inyectable"
    ],
    "strengths": [
      "800 mg + 160 mg",
      "200 mg + 40 mg/5 ml",
      "100 mg + 20 mg",
      "400 mg + 80 mg",
      "400 mg + 80 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-37",
        "form": "Comprimido",
        "strength": "800 mg + 160 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-38",
        "form": "Suspensión",
        "strength": "200 mg + 40 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "J-01-39",
        "form": "Comprimido",
        "strength": "100 mg + 20 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-40",
        "form": "Comprimido",
        "strength": "400 mg + 80 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-60",
        "form": "Inyectable",
        "strength": "400 mg + 80 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "J-01-65",
        "form": "Suspensión",
        "strength": "400 mg + 80 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01FA01",
    "name": "Eritromicina (estearato)",
    "doseForms": [
      "Cápsula o Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "250 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-45",
        "form": "Cápsula o Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-46",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01FA02",
    "name": "Espiramicina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-47",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01FA09",
    "name": "Claritromicina",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "250 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-29",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": true
      },
      {
        "code": "J-01-30",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01FA10",
    "name": "Azitromicina",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "200 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-13",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-62",
        "form": "Suspensión",
        "strength": "200 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01FF01",
    "name": "Clindamicina",
    "doseForms": [
      "Suspensión o Jarabe",
      "Cápsula o Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "75 mg/5 ml",
      "300 mg",
      "600 mg"
    ],
    "presentations": [
      {
        "code": "J-01-31",
        "form": "Suspensión o Jarabe",
        "strength": "75 mg/5 ml",
        "restrictedUse": true
      },
      {
        "code": "J-01-56",
        "form": "Cápsula o Comprimido",
        "strength": "300 mg",
        "restrictedUse": true
      },
      {
        "code": "J-01-64",
        "form": "Inyectable",
        "strength": "600 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01GB03",
    "name": "Gentamicina sulfato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20 mg",
      "80 mg"
    ],
    "presentations": [
      {
        "code": "J-01-48",
        "form": "Inyectable",
        "strength": "20 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-49",
        "form": "Inyectable",
        "strength": "80 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01GB04",
    "name": "Kanamicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-04-13",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01GB06",
    "name": "Amikacina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500mg /2 ml"
    ],
    "presentations": [
      {
        "code": "J-01-04",
        "form": "Inyectable",
        "strength": "500mg /2 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01MA01",
    "name": "Ofloxacina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "400 mg",
      "200 mg"
    ],
    "presentations": [
      {
        "code": "J-01-53",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": true
      },
      {
        "code": "J-01-59",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01MA02",
    "name": "Ciprofloxacina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "500 mg",
      "200 mg",
      "250 mg"
    ],
    "presentations": [
      {
        "code": "J-01-27",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-28",
        "form": "Inyectable",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-61",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01MA12",
    "name": "Levofloxacina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-66",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": true
      },
      {
        "code": "J-01-68",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01MA14",
    "name": "Moxifloxacina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "400 mg"
    ],
    "presentations": [
      {
        "code": "J-01-72",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01MB02",
    "name": "Ácido nalidíxico",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "250 mg/5 ml",
      "125 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-01",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-02",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "J-01-03",
        "form": "Suspensión",
        "strength": "125 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01XA01",
    "name": "Vancomicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-01-55",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01XB01",
    "name": "Colistina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-01-67",
        "form": "Inyectable",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J01XE01",
    "name": "Nitrofurantoína",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "100 mg",
      "25 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "J-01-51",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "J-01-52",
        "form": "Suspensión",
        "strength": "25 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J01XX08",
    "name": "Linezolid",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "600 mg"
    ],
    "presentations": [
      {
        "code": "J-01-70",
        "form": "Comprimido",
        "strength": "600 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J02AA01",
    "name": "Amfotericina B",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "J-02-01",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J02AC01",
    "name": "Fluconazol",
    "doseForms": [
      "Inyectable",
      "Comprimido o Cápsula"
    ],
    "strengths": [
      "200 mg",
      "150 mg"
    ],
    "presentations": [
      {
        "code": "J-02-02",
        "form": "Inyectable",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "J-02-08",
        "form": "Comprimido o Cápsula",
        "strength": "150 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J02AC03",
    "name": "Voriconazol",
    "doseForms": [
      "Polvo para inyectable"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "J-02-09",
        "form": "Polvo para inyectable",
        "strength": "200 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04AA01",
    "name": "Acido p-aminosalicilico",
    "doseForms": [
      "Polvo para solución oral"
    ],
    "strengths": [
      "4 g"
    ],
    "presentations": [
      {
        "code": "J-04-11",
        "form": "Polvo para solución oral",
        "strength": "4 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J04AB01",
    "name": "Cicloserina",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "J-04-01",
        "form": "Cápsula",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J04AB02",
    "name": "Rifampicina",
    "doseForms": [
      "Suspensión",
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "100 mg/5 ml",
      "300 mg",
      "150 mg"
    ],
    "presentations": [
      {
        "code": "J-04-09",
        "form": "Suspensión",
        "strength": "100 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "J-04-10",
        "form": "Cápsula o Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      },
      {
        "code": "J-04-17",
        "form": "Cápsula o Comprimido",
        "strength": "150 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04AB30",
    "name": "Capreomicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "J-04-12",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J04AC01",
    "name": "Isoniazida (INH)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-04-07",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04AD03",
    "name": "Etionamida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "J-04-06",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J04AK01",
    "name": "Pirazinamida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-04-08",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04AK02",
    "name": "Etambutol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "400 mg"
    ],
    "presentations": [
      {
        "code": "J-04-05",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04AK05",
    "name": "Bedaquilina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-04-18",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J04AK06",
    "name": "Delamanid",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-04-19",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J04AM02",
    "name": "Rifampicina + Isoniazida (INH)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg + 150 mg"
    ],
    "presentations": [
      {
        "code": "J-04-14",
        "form": "Comprimido",
        "strength": "300 mg + 150 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04BA01",
    "name": "Clofazimina",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "50 mg",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-04-02",
        "form": "Cápsula",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "J-04-15",
        "form": "Cápsula",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J04BA02",
    "name": "Dapsona",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "J-04-03",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "J-04-16",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AB01",
    "name": "Aciclovir",
    "doseForms": [
      "Comprimido",
      "Suspensión",
      "Inyectable"
    ],
    "strengths": [
      "400 mg",
      "200 mg/5 ml",
      "200 mg",
      "800 mg",
      "250 mg",
      "500 mg"
    ],
    "presentations": [
      {
        "code": "J-05-04",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-30",
        "form": "Suspensión",
        "strength": "200 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "J-05-42",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-43",
        "form": "Comprimido",
        "strength": "800 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-44",
        "form": "Inyectable",
        "strength": "250 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-45",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AB14",
    "name": "Valganciclovir",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "450 mg"
    ],
    "presentations": [
      {
        "code": "J-05-29",
        "form": "Comprimido",
        "strength": "450 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AE03",
    "name": "Ritonavir",
    "doseForms": [
      "Cápsula blanda"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "J-05-22",
        "form": "Cápsula blanda",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AE08",
    "name": "Atazanavir (sulfato)",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "300 mg"
    ],
    "presentations": [
      {
        "code": "J-05-31",
        "form": "Cápsula o Comprimido",
        "strength": "300 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AE10",
    "name": "Darunavir",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "600 mg"
    ],
    "presentations": [
      {
        "code": "J-05-32",
        "form": "Comprimido",
        "strength": "600 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AF01",
    "name": "Zidovudina",
    "doseForms": [
      "Inyectable",
      "Suspensión oral"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "J-05-24",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "J-05-25",
        "form": "Suspensión oral",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AF05",
    "name": "Lamivudina",
    "doseForms": [
      "Comprimido",
      "Jarabe o Solución oral"
    ],
    "strengths": [
      "150 mg",
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "J-05-15",
        "form": "Comprimido",
        "strength": "150 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-16",
        "form": "Jarabe o Solución oral",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AF06",
    "name": "Abacavir",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg"
    ],
    "presentations": [
      {
        "code": "J-05-01",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AF07",
    "name": "Tenofovir disoproxilo",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "245 mg (Equiv. a 300 mg como fumarato)"
    ],
    "presentations": [
      {
        "code": "J-05-28",
        "form": "Comprimido",
        "strength": "245 mg (Equiv. a 300 mg como fumarato)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AF30",
    "name": "Zidovudina + Lamivudina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg + 150 mg"
    ],
    "presentations": [
      {
        "code": "J-05-27",
        "form": "Comprimido",
        "strength": "300 mg + 150 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AG01",
    "name": "Nevirapina",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "200 mg",
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "J-05-20",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-21",
        "form": "Suspensión",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AG03",
    "name": "Efavirenz",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "600 mg",
      "200 mg"
    ],
    "presentations": [
      {
        "code": "J-05-10",
        "form": "Comprimido",
        "strength": "600 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-33",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AH02",
    "name": "Oseltamivir",
    "doseForms": [
      "Cápsula",
      "Suspensión"
    ],
    "strengths": [
      "75 mg",
      "30 mg/5 ml",
      "12 mg/ml"
    ],
    "presentations": [
      {
        "code": "J-05-36",
        "form": "Cápsula",
        "strength": "75 mg",
        "restrictedUse": true
      },
      {
        "code": "J-05-47",
        "form": "Suspensión",
        "strength": "30 mg/5 ml",
        "restrictedUse": true
      },
      {
        "code": "J-05-48",
        "form": "Suspensión",
        "strength": "12 mg/ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AR10",
    "name": "Lopinavir + Ritonavir",
    "doseForms": [
      "Comprimido",
      "Solución oral"
    ],
    "strengths": [
      "200 mg + 50 mg",
      "80 mg + 20 mg/ml"
    ],
    "presentations": [
      {
        "code": "J-05-34",
        "form": "Comprimido",
        "strength": "200 mg + 50 mg",
        "restrictedUse": false
      },
      {
        "code": "J-05-35",
        "form": "Solución oral",
        "strength": "80 mg + 20 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AR11",
    "name": "Tenofovir disoproxilo + Efavirenz + Lamivudina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg + 600 mg + 300 mg"
    ],
    "presentations": [
      {
        "code": "J-05-38",
        "form": "Comprimido",
        "strength": "300 mg + 600 mg + 300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AX08",
    "name": "Raltegravir (potasico)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "400 mg"
    ],
    "presentations": [
      {
        "code": "J-05-37",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AX14",
    "name": "Daclatasvir",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "60 mg"
    ],
    "presentations": [
      {
        "code": "J-05-40",
        "form": "Cápsula o Comprimido",
        "strength": "60 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AX15",
    "name": "Sofosbuvir",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "400 mg"
    ],
    "presentations": [
      {
        "code": "J-05-41",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J05AX27",
    "name": "Favipiravir",
    "doseForms": [
      "Comprimido recubierto"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "J-05-49",
        "form": "Comprimido recubierto",
        "strength": "200 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J05AX65",
    "name": "Ledipasvir + Sofosbuvir",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "90 mg + 400 mg"
    ],
    "presentations": [
      {
        "code": "J-05-46",
        "form": "Comprimido",
        "strength": "90 mg + 400 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "J06AA02",
    "name": "Antitóxina tetánica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI según disponibilidad"
    ],
    "presentations": [
      {
        "code": "J-06-01",
        "form": "Inyectable",
        "strength": "Norma PAI según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J06AA03",
    "name": "Suero antiofídico polivalente",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 ml"
    ],
    "presentations": [
      {
        "code": "J-06-04",
        "form": "Inyectable",
        "strength": "10 ml",
        "restrictedUse": false
      },
      {
        "code": "J-06-07",
        "form": "Inyectable",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "J-06-08",
        "form": "Inyectable",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J06AA06",
    "name": "Suero Antirrábico (heterólogo)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "J-06-05",
        "form": "Inyectable",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "J-06-09",
        "form": "Inyectable",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J06BA02",
    "name": "Inmunoglobulina humana normal",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "5 g IV"
    ],
    "presentations": [
      {
        "code": "J-06-03",
        "form": "Inyectable",
        "strength": "5 g IV",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J06BB01",
    "name": "Inmunoglobulina anti D (RH +)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,1 mg/ml a 0,2 mg/ml"
    ],
    "presentations": [
      {
        "code": "J-06-02",
        "form": "Inyectable",
        "strength": "0,1 mg/ml a 0,2 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07AL02",
    "name": "Vacuna antineumococo (13 valente)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI (Unidosis)"
    ],
    "presentations": [
      {
        "code": "J-07-22",
        "form": "Inyectable",
        "strength": "Norma PAI (Unidosis)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07AM01",
    "name": "Toxoide tetánico adsorbido",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "120 UI/ml"
    ],
    "presentations": [
      {
        "code": "J-07-01",
        "form": "Inyectable",
        "strength": "120 UI/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07AM51",
    "name": "Vacuna doble dT (difteria, Tétanos)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-12",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07AN01",
    "name": "Vacuna BCG",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-11",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BC01",
    "name": "Vacuna antihepatitis B",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-05",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BD01",
    "name": "Vacuna SRP (Sarampión, Rubeola; Paperas)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI Multidosis",
      "Norma PAI (Unidosis)"
    ],
    "presentations": [
      {
        "code": "J-07-15",
        "form": "Inyectable",
        "strength": "Norma PAI Multidosis",
        "restrictedUse": false
      },
      {
        "code": "J-07-16",
        "form": "Inyectable",
        "strength": "Norma PAI (Unidosis)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BD53",
    "name": "Vacuna SR (Sarampión, Rubeola)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-14",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BF03",
    "name": "Vacuna antipoliomielítica inactivada",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-24",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BF04",
    "name": "Vacuna antipoliomielítica bivalente",
    "doseForms": [
      "Solución oral"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-23",
        "form": "Solución oral",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BG01",
    "name": "Vacuna Antirrábica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 UI/ml",
      "2,5 U.I./0,5 ml"
    ],
    "presentations": [
      {
        "code": "J-07-08",
        "form": "Inyectable",
        "strength": "1 UI/ml",
        "restrictedUse": false
      },
      {
        "code": "J-07-25",
        "form": "Inyectable",
        "strength": "2,5 U.I./0,5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BH01",
    "name": "Vacuna Antirotavírica",
    "doseForms": [
      "Solución oral"
    ],
    "strengths": [
      "Norma PAI Multidosis",
      "Norma PAI (Unidosis)"
    ],
    "presentations": [
      {
        "code": "J-07-18",
        "form": "Solución oral",
        "strength": "Norma PAI Multidosis",
        "restrictedUse": false
      },
      {
        "code": "J-07-19",
        "form": "Solución oral",
        "strength": "Norma PAI (Unidosis)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BL01",
    "name": "Vacuna antiamarílica",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI (20 dosis)",
      "Norma PAI (10 dosis)",
      "Norma PAI (5 dosis)"
    ],
    "presentations": [
      {
        "code": "J-07-02",
        "form": "Inyectable",
        "strength": "Norma PAI (20 dosis)",
        "restrictedUse": false
      },
      {
        "code": "J-07-03",
        "form": "Inyectable",
        "strength": "Norma PAI (10 dosis)",
        "restrictedUse": false
      },
      {
        "code": "J-07-04",
        "form": "Inyectable",
        "strength": "Norma PAI (5 dosis)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BM01",
    "name": "Vacuna cuadrivalente recombinante contra el Virus del Papiloma Humano",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-26",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "J07BX03",
    "name": "Vacuna contra COVID-19",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "Norma PAI"
    ],
    "presentations": [
      {
        "code": "J-07-27",
        "form": "Inyectable",
        "strength": "Norma PAI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01AA01",
    "name": "Ciclofosfamida",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "500 mg",
      "1 g",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-05",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-06",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      },
      {
        "code": "L-01-07",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01AA03",
    "name": "Melfalán",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "2 mg",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-22",
        "form": "Comprimido",
        "strength": "2 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-63",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01AA06",
    "name": "Ifosfamida",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "L-01-20",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01AB01",
    "name": "Busulfano",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2 mg"
    ],
    "presentations": [
      {
        "code": "L-01-02",
        "form": "Comprimido",
        "strength": "2 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01AX03",
    "name": "Temozolomida",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "20 mg",
      "100 mg",
      "250 mg"
    ],
    "presentations": [
      {
        "code": "L-01-51",
        "form": "Cápsula",
        "strength": "20 mg",
        "restrictedUse": true
      },
      {
        "code": "L-01-52",
        "form": "Cápsula",
        "strength": "100 mg",
        "restrictedUse": true
      },
      {
        "code": "L-01-53",
        "form": "Cápsula",
        "strength": "250 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01AX04",
    "name": "Dacarbazina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "L-01-12",
        "form": "Inyectable",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01BA01",
    "name": "Metotrexato",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "50 mg",
      "500 mg",
      "2,5 mg"
    ],
    "presentations": [
      {
        "code": "L-01-24",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-25",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-26",
        "form": "Comprimido",
        "strength": "2,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01BB02",
    "name": "Mercaptopurina",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-23",
        "form": "Comprimido ranurado",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01BB05",
    "name": "Fludarabina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-62",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01BC01",
    "name": "Citarabina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg",
      "500 mg"
    ],
    "presentations": [
      {
        "code": "L-01-10",
        "form": "Inyectable",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-11",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01BC02",
    "name": "Fluorouracilo",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg/10 ml"
    ],
    "presentations": [
      {
        "code": "L-01-17",
        "form": "Inyectable",
        "strength": "500 mg/10 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01BC05",
    "name": "Gemcitabina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g",
      "200 mg"
    ],
    "presentations": [
      {
        "code": "L-01-18",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      },
      {
        "code": "L-01-33",
        "form": "Inyectable",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01BC06",
    "name": "Capecitabine",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "L-01-03",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01CA01",
    "name": "Vinblastina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "L-01-39",
        "form": "Inyectable",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01CA02",
    "name": "Vincristina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 mg/ml"
    ],
    "presentations": [
      {
        "code": "L-01-30",
        "form": "Inyectable",
        "strength": "1 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01CA04",
    "name": "Vinorelbina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-31",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01CB01",
    "name": "Etopósido",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "L-01-16",
        "form": "Inyectable",
        "strength": "100 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01CD01",
    "name": "Paclitaxel",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "30 mg/5 ml",
      "300 mg/50 ml"
    ],
    "presentations": [
      {
        "code": "L-01-28",
        "form": "Inyectable",
        "strength": "30 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "L-01-60",
        "form": "Inyectable",
        "strength": "300 mg/50 ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01CD02",
    "name": "Docetaxel",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "40 mg/ml (2ml)"
    ],
    "presentations": [
      {
        "code": "L-01-38",
        "form": "Inyectable",
        "strength": "40 mg/ml (2ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01DA01",
    "name": "Dactinomicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,5 mg/ml"
    ],
    "presentations": [
      {
        "code": "L-01-13",
        "form": "Inyectable",
        "strength": "0,5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01DB01",
    "name": "Doxorubicina clorhidrato (Adriamicina clorh.)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg",
      "50 mg",
      "20 mg/ 10 ml"
    ],
    "presentations": [
      {
        "code": "L-01-14",
        "form": "Inyectable",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-15",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-48",
        "form": "Inyectable",
        "strength": "20 mg/ 10 ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01DB02",
    "name": "Daunorrubicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "L-01-37",
        "form": "Inyectable",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01DC01",
    "name": "Bleomicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "15 UI"
    ],
    "presentations": [
      {
        "code": "L-01-01",
        "form": "Inyectable",
        "strength": "15 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01DC03",
    "name": "Mitomicina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "L-01-27",
        "form": "Inyectable",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01EA01",
    "name": "Imatinib",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "400 mg"
    ],
    "presentations": [
      {
        "code": "L-01-50",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01EA02",
    "name": "Dasatinib",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg",
      "50 mg",
      "70 mg",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "L-01-44",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": true
      },
      {
        "code": "L-01-45",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": true
      },
      {
        "code": "L-01-46",
        "form": "Comprimido",
        "strength": "70 mg",
        "restrictedUse": true
      },
      {
        "code": "L-01-47",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01EB02",
    "name": "Erlotinib",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "150 mg"
    ],
    "presentations": [
      {
        "code": "L-01-59",
        "form": "Comprimido",
        "strength": "150 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01FA01",
    "name": "Rituximab",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg/50 ml",
      "100 mg/10ml"
    ],
    "presentations": [
      {
        "code": "L-01-41",
        "form": "Inyectable",
        "strength": "500 mg/50 ml",
        "restrictedUse": true
      },
      {
        "code": "L-01-56",
        "form": "Inyectable",
        "strength": "100 mg/10ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01FD01",
    "name": "Trastuzumab",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "440 mg",
      "600 mg"
    ],
    "presentations": [
      {
        "code": "L-01-42",
        "form": "Inyectable",
        "strength": "440 mg",
        "restrictedUse": true
      },
      {
        "code": "L-01-43",
        "form": "Inyectable",
        "strength": "600 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01FD02",
    "name": "Pertuzumab",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "420 mg/14 ml"
    ],
    "presentations": [
      {
        "code": "L-01-58",
        "form": "Inyectable",
        "strength": "420 mg/14 ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01FG01",
    "name": "Bevacizumab",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "25 mg/ml"
    ],
    "presentations": [
      {
        "code": "L-01-36",
        "form": "Inyectable",
        "strength": "25 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01XA01",
    "name": "Cisplatino",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-08",
        "form": "Inyectable",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-09",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01XA02",
    "name": "Carboplatino",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "450 mg",
      "150 mg"
    ],
    "presentations": [
      {
        "code": "L-01-04",
        "form": "Inyectable",
        "strength": "450 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-32",
        "form": "Inyectable",
        "strength": "150 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01XA03",
    "name": "Oxaliplatino",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "50 mg",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "L-01-34",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "L-01-35",
        "form": "Inyectable",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01XC99",
    "name": "Nimotuzumab",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-01-54",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01XE01",
    "name": "Imatinib",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "L-01-49",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01XE11",
    "name": "Pazopanib",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "L-01-57",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01XX02",
    "name": "Asparaginasa",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10.000 UI"
    ],
    "presentations": [
      {
        "code": "L-01-21",
        "form": "Inyectable",
        "strength": "10.000 UI",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01XX05",
    "name": "Hidroxiurea",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "L-01-19",
        "form": "Cápsula",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L01XX19",
    "name": "Irinotecan",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg /5 ml"
    ],
    "presentations": [
      {
        "code": "L-01-40",
        "form": "Inyectable",
        "strength": "100 mg /5 ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01XX24",
    "name": "Pegaspargasa",
    "doseForms": [
      "Plegable Frasco Vial"
    ],
    "strengths": [
      "750 mg/ml"
    ],
    "presentations": [
      {
        "code": "L-01-61",
        "form": "Plegable Frasco Vial",
        "strength": "750 mg/ml",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L01XX32",
    "name": "Bortezomib",
    "doseForms": [
      "Polvo para inyectable"
    ],
    "strengths": [
      "3,5 mg"
    ],
    "presentations": [
      {
        "code": "L-01-55",
        "form": "Polvo para inyectable",
        "strength": "3,5 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L02AE02",
    "name": "Leuprolide",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "7,5 mg"
    ],
    "presentations": [
      {
        "code": "L-02-10",
        "form": "Inyectable",
        "strength": "7,5 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L02AE04",
    "name": "Triptorelina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "11,25 mg",
      "22,5 mg"
    ],
    "presentations": [
      {
        "code": "L-02-07",
        "form": "Inyectable",
        "strength": "11,25 mg",
        "restrictedUse": false
      },
      {
        "code": "L-02-08",
        "form": "Inyectable",
        "strength": "22,5 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L02BA01",
    "name": "Tamoxifeno",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "L-02-05",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L02BB01",
    "name": "Flutamida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "L-02-03",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L02BB03",
    "name": "Bicalutamida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-02-12",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L02BB04",
    "name": "Enzalutamida",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "40 mg"
    ],
    "presentations": [
      {
        "code": "L-02-11",
        "form": "Cápsula",
        "strength": "40 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L02BG03",
    "name": "Anastrozol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "1 mg"
    ],
    "presentations": [
      {
        "code": "L-02-01",
        "form": "Comprimido",
        "strength": "1 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L02BG04",
    "name": "Letrozol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2,5 mg"
    ],
    "presentations": [
      {
        "code": "L-02-04",
        "form": "Comprimido",
        "strength": "2,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L02BX03",
    "name": "Abiraterona Acetato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "L-02-09",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L03AA02",
    "name": "Filgrastrim",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "300 mcg/ml"
    ],
    "presentations": [
      {
        "code": "L-03-01",
        "form": "Inyectable",
        "strength": "300 mcg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L03AB05",
    "name": "Interferon alfa 2 b recombinante",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10.000.000 UI con diluyente (1 ml)",
      "3.000.000 UI con diluyente (1 ml)"
    ],
    "presentations": [
      {
        "code": "L-03-02",
        "form": "Inyectable",
        "strength": "10.000.000 UI con diluyente (1 ml)",
        "restrictedUse": false
      },
      {
        "code": "L-03-03",
        "form": "Inyectable",
        "strength": "3.000.000 UI con diluyente (1 ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L03AB07",
    "name": "Interferon beta",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,3 mg"
    ],
    "presentations": [
      {
        "code": "L-03-04",
        "form": "Inyectable",
        "strength": "0,3 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L04AA01",
    "name": "Ciclosporina",
    "doseForms": [
      "Solución oral",
      "Cápsula blanda"
    ],
    "strengths": [
      "100 mg/ml",
      "100 mg",
      "25 mg",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "L-04-03",
        "form": "Solución oral",
        "strength": "100 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "L-04-04",
        "form": "Cápsula blanda",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "L-04-05",
        "form": "Cápsula blanda",
        "strength": "25 mg",
        "restrictedUse": false
      },
      {
        "code": "L-04-06",
        "form": "Cápsula blanda",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L04AA04",
    "name": "Globulina Anti-timocito",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "250 mg/5ml",
      "25 mg"
    ],
    "presentations": [
      {
        "code": "L-04-11",
        "form": "Inyectable",
        "strength": "250 mg/5ml",
        "restrictedUse": true
      },
      {
        "code": "L-04-19",
        "form": "Inyectable",
        "strength": "25 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AA05",
    "name": "Tacrolimus",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "1 mg"
    ],
    "presentations": [
      {
        "code": "L-04-10",
        "form": "Cápsula",
        "strength": "1 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AA06",
    "name": "Micofenolato de mofetilo",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "L-04-07",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AA09",
    "name": "Basiliximab",
    "doseForms": [
      "Polvo para inyectable"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "L-04-09",
        "form": "Polvo para inyectable",
        "strength": "20 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AA13",
    "name": "Leflunomida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "L-04-12",
        "form": "Comprimido",
        "strength": "20 mg",
        "restrictedUse": true
      },
      {
        "code": "L-04-13",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AA27",
    "name": "Fingolimod",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "0,5 mg"
    ],
    "presentations": [
      {
        "code": "L-04-18",
        "form": "Cápsula",
        "strength": "0,5 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AX01",
    "name": "Azatioprina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "50 mg",
      "20 mg/ml"
    ],
    "presentations": [
      {
        "code": "L-04-01",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "L-04-02",
        "form": "Inyectable",
        "strength": "20 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "L04AX02",
    "name": "Talidomida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "L-04-08",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "L04AX04",
    "name": "Lenalidomida",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "5 mg",
      "10 mg",
      "15 mg",
      "25 mg"
    ],
    "presentations": [
      {
        "code": "L-04-14",
        "form": "Cápsula",
        "strength": "5 mg",
        "restrictedUse": true
      },
      {
        "code": "L-04-15",
        "form": "Cápsula",
        "strength": "10 mg",
        "restrictedUse": true
      },
      {
        "code": "L-04-16",
        "form": "Cápsula",
        "strength": "15 mg",
        "restrictedUse": true
      },
      {
        "code": "L-04-17",
        "form": "Cápsula",
        "strength": "25 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "M01AB01",
    "name": "Indometacina",
    "doseForms": [
      "Cápsula o Comprimido",
      "Supositorio"
    ],
    "strengths": [
      "25 mg",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "M-01-06",
        "form": "Cápsula o Comprimido",
        "strength": "25 mg",
        "restrictedUse": false
      },
      {
        "code": "M-01-07",
        "form": "Supositorio",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M01AB05",
    "name": "Diclofenaco Sódico",
    "doseForms": [
      "Pomada o Gel",
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "1%",
      "50 mg",
      "75 mg"
    ],
    "presentations": [
      {
        "code": "M-01-01",
        "form": "Pomada o Gel",
        "strength": "1%",
        "restrictedUse": false
      },
      {
        "code": "M-01-02",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "M-01-03",
        "form": "Inyectable",
        "strength": "75 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M01AB15",
    "name": "Ketorolaco",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "30 mg/ml"
    ],
    "presentations": [
      {
        "code": "M-01-09",
        "form": "Inyectable",
        "strength": "30 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M01AC06",
    "name": "Meloxicam",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "15 mg"
    ],
    "presentations": [
      {
        "code": "M-01-11",
        "form": "Comprimido",
        "strength": "15 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M01AE01",
    "name": "Ibuprofeno",
    "doseForms": [
      "Suspensión",
      "Comprimido"
    ],
    "strengths": [
      "100 mg/5 ml",
      "400 mg"
    ],
    "presentations": [
      {
        "code": "M-01-04",
        "form": "Suspensión",
        "strength": "100 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "M-01-05",
        "form": "Comprimido",
        "strength": "400 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M01AE03",
    "name": "Ketoprofeno",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "M-01-10",
        "form": "Inyectable",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M01CC01",
    "name": "Penicilamina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "M-01-08",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M03AB01",
    "name": "Suxametonio (Succinil colina)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "M-03-04",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M03AC04",
    "name": "Atracurio besilato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "M-03-01",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M03AC09",
    "name": "Rocuronio bromuro",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "M-03-03",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M03AC10",
    "name": "Mivacuronio",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "2 mg/ml"
    ],
    "presentations": [
      {
        "code": "M-03-02",
        "form": "Inyectable",
        "strength": "2 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M04AA01",
    "name": "Alopurinol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg"
    ],
    "presentations": [
      {
        "code": "M-04-01",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M04AC01",
    "name": "Colchicina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "0,5 mg"
    ],
    "presentations": [
      {
        "code": "M-04-02",
        "form": "Comprimido",
        "strength": "0,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M05BA04",
    "name": "Ácido Alendrónico (Alendronato)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "70 mg"
    ],
    "presentations": [
      {
        "code": "M-05-03",
        "form": "Comprimido",
        "strength": "70 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "M05BA08",
    "name": "Ácido Zoledrónico",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "4 mg"
    ],
    "presentations": [
      {
        "code": "M-05-04",
        "form": "Inyectable",
        "strength": "4 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "N01AB01",
    "name": "Halotano",
    "doseForms": [
      "Solución"
    ],
    "strengths": [
      "0,01% de timol"
    ],
    "presentations": [
      {
        "code": "N-01-07",
        "form": "Solución",
        "strength": "0,01% de timol",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AB08",
    "name": "Sevoflurano (Trifluorometil etil)",
    "doseForms": [
      "Solución"
    ],
    "strengths": [
      "250 ml"
    ],
    "presentations": [
      {
        "code": "N-01-14",
        "form": "Solución",
        "strength": "250 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AF03",
    "name": "Tiopental sódico",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "N-01-15",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AH01",
    "name": "Fentanilo con conservante",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,05 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-01-05",
        "form": "Inyectable",
        "strength": "0,05 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-01-06",
        "form": "Inyectable",
        "strength": "0,05 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AH06",
    "name": "Remifentanilo",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "5 mg"
    ],
    "presentations": [
      {
        "code": "N-01-16",
        "form": "Inyectable",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AX01",
    "name": "Droperidol",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "2,5 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-01-04",
        "form": "Inyectable",
        "strength": "2,5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AX03",
    "name": "Ketamina (Cetamina)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "50 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-01-08",
        "form": "Inyectable",
        "strength": "50 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01AX10",
    "name": "Propofol",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-01-13",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01BB01",
    "name": "Bupivacaina clorhidrato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,5%"
    ],
    "presentations": [
      {
        "code": "N-01-01",
        "form": "Inyectable",
        "strength": "0,5%",
        "restrictedUse": false
      },
      {
        "code": "N-01-02",
        "form": "Inyectable",
        "strength": "0,5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01BB02",
    "name": "Lidocaína clorhidrato sin conservante",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "2%"
    ],
    "presentations": [
      {
        "code": "N-01-12",
        "form": "Inyectable",
        "strength": "2%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01BB51",
    "name": "Bupivacaina clorhidrato con Epinefrina sin conservante",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,5% 1:200.000"
    ],
    "presentations": [
      {
        "code": "N-01-03",
        "form": "Inyectable",
        "strength": "0,5% 1:200.000",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N01BB52",
    "name": "Lidocaína clorhidrato + Epinefrina",
    "doseForms": [
      "Cartucho dental",
      "Inyectable"
    ],
    "strengths": [
      "2%",
      "2% 1:200.000"
    ],
    "presentations": [
      {
        "code": "N-01-09",
        "form": "Cartucho dental",
        "strength": "2%",
        "restrictedUse": false
      },
      {
        "code": "N-01-10",
        "form": "Inyectable",
        "strength": "2% 1:200.000",
        "restrictedUse": false
      },
      {
        "code": "N-01-11",
        "form": "Cartucho dental",
        "strength": "2% 1:200.000",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02AA01",
    "name": "Morfina",
    "doseForms": [
      "Cápsula o Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "10 mg",
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-02-06",
        "form": "Cápsula o Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "N-02-07",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02AA07",
    "name": "Codeína",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "30 mg"
    ],
    "presentations": [
      {
        "code": "N-02-02",
        "form": "Comprimido",
        "strength": "30 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02AB02",
    "name": "Petidina (Meperidina)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "N-02-13",
        "form": "Inyectable",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02AX02",
    "name": "Tramadol",
    "doseForms": [
      "Inyectable",
      "Comprimido",
      "Solución para gotas orales"
    ],
    "strengths": [
      "100 mg/2 ml",
      "50 mg",
      "100 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-02-14",
        "form": "Inyectable",
        "strength": "100 mg/2 ml",
        "restrictedUse": false
      },
      {
        "code": "N-02-15",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "N-02-17",
        "form": "Solución para gotas orales",
        "strength": "100 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02BA01",
    "name": "Ácido acetil salicílico",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "N-02-01",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02BB02",
    "name": "Metamizol (Dipirona)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "N-02-05",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02BE01",
    "name": "Paracetamol (Acetaminofeno)",
    "doseForms": [
      "Comprimido",
      "Jarabe",
      "Gotas",
      "Supositorio",
      "Inyectable"
    ],
    "strengths": [
      "500 mg",
      "120 mg/5 ml o 125 mg/5 ml",
      "100 mg/ml",
      "100 mg",
      "1 gr"
    ],
    "presentations": [
      {
        "code": "N-02-08",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "N-02-09",
        "form": "Jarabe",
        "strength": "120 mg/5 ml o 125 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "N-02-10",
        "form": "Gotas",
        "strength": "100 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-02-11",
        "form": "Supositorio",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "N-02-12",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "N-02-18",
        "form": "Inyectable",
        "strength": "1 gr",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02CA72",
    "name": "Ergotamina tartrato + Cafeína",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "1 mg + 100 mg"
    ],
    "presentations": [
      {
        "code": "N-02-03",
        "form": "Comprimido",
        "strength": "1 mg + 100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N02CC02",
    "name": "Naratriptan",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "2,5 mg"
    ],
    "presentations": [
      {
        "code": "N-02-16",
        "form": "Comprimido",
        "strength": "2,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N03AA02",
    "name": "Fenobarbital",
    "doseForms": [
      "Comprimido",
      "Gotas",
      "Inyectable"
    ],
    "strengths": [
      "100 mg",
      "20 mg/ml",
      "100 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-03-09",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "N-03-10",
        "form": "Gotas",
        "strength": "20 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-03-11",
        "form": "Inyectable",
        "strength": "100 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N03AB02",
    "name": "Fenitoína",
    "doseForms": [
      "Inyectable",
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "50 mg/ml",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "N-03-07",
        "form": "Inyectable",
        "strength": "50 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-03-08",
        "form": "Cápsula o Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N03AE01",
    "name": "Clonazepam",
    "doseForms": [
      "Comprimido ranurado",
      "Solución oral"
    ],
    "strengths": [
      "2 mg",
      "2,5 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-03-06",
        "form": "Comprimido ranurado",
        "strength": "2 mg",
        "restrictedUse": false
      },
      {
        "code": "N-03-12",
        "form": "Solución oral",
        "strength": "2,5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N03AF01",
    "name": "Carbamazepina",
    "doseForms": [
      "Comprimido",
      "Suspensión o Jarabe"
    ],
    "strengths": [
      "200 mg",
      "2% (100 mg/5 ml)"
    ],
    "presentations": [
      {
        "code": "N-03-04",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "N-03-05",
        "form": "Suspensión o Jarabe",
        "strength": "2% (100 mg/5 ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N03AG01",
    "name": "Ácido Valpróico ó Valproato sódico",
    "doseForms": [
      "Jarabe o Solución oral",
      "Cápsula o Comprimido",
      "Jarabe o Solución Oral"
    ],
    "strengths": [
      "200 mg/5 ml",
      "250 mg/5 ml",
      "500 mg",
      "200 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-03-01",
        "form": "Jarabe o Solución oral",
        "strength": "200 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "N-03-02",
        "form": "Jarabe o Solución oral",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "N-03-03",
        "form": "Cápsula o Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "N-03-22",
        "form": "Jarabe o Solución Oral",
        "strength": "200 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N03AX09",
    "name": "Lamotrigina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "25 mg",
      "50 mg",
      "100 mg",
      "200 mg"
    ],
    "presentations": [
      {
        "code": "N-03-15",
        "form": "Comprimido",
        "strength": "25 mg",
        "restrictedUse": true
      },
      {
        "code": "N-03-16",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": true
      },
      {
        "code": "N-03-17",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      },
      {
        "code": "N-03-18",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "N03AX16",
    "name": "Pregabalina",
    "doseForms": [
      "Comprimido o Cápsula"
    ],
    "strengths": [
      "50 mg",
      "75 mg",
      "150 mg"
    ],
    "presentations": [
      {
        "code": "N-03-19",
        "form": "Comprimido o Cápsula",
        "strength": "50 mg",
        "restrictedUse": true
      },
      {
        "code": "N-03-20",
        "form": "Comprimido o Cápsula",
        "strength": "75 mg",
        "restrictedUse": true
      },
      {
        "code": "N-03-21",
        "form": "Comprimido o Cápsula",
        "strength": "150 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "N04AA02",
    "name": "Biperideno clorhidrato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "4 mg"
    ],
    "presentations": [
      {
        "code": "N-04-01",
        "form": "Comprimido",
        "strength": "4 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N04BA02",
    "name": "Levodopa + Carbidopa",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg + 25 mg"
    ],
    "presentations": [
      {
        "code": "N-04-02",
        "form": "Comprimido",
        "strength": "250 mg + 25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05AA01",
    "name": "Clorpromazina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "100 mg",
      "12,5 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-05-02",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "N-05-03",
        "form": "Inyectable",
        "strength": "12,5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05AC02",
    "name": "Tioridazina",
    "doseForms": [
      "Suspensión",
      "Comprimido"
    ],
    "strengths": [
      "100 mg/5 ml",
      "100 mg"
    ],
    "presentations": [
      {
        "code": "N-05-13",
        "form": "Suspensión",
        "strength": "100 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "N-05-14",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05AD01",
    "name": "Haloperidol",
    "doseForms": [
      "Solución oral",
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "2 mg/ml",
      "5 mg",
      "50 mg/ml",
      "5 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-05-07",
        "form": "Solución oral",
        "strength": "2 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-05-08",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      },
      {
        "code": "N-05-09",
        "form": "Inyectable",
        "strength": "50 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-05-17",
        "form": "Inyectable",
        "strength": "5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05AH04",
    "name": "Quetiapina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg"
    ],
    "presentations": [
      {
        "code": "N-05-18",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "N05AN01",
    "name": "Litio carbonato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg"
    ],
    "presentations": [
      {
        "code": "N-05-10",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05AX08",
    "name": "Risperidona",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "3 mg"
    ],
    "presentations": [
      {
        "code": "N-05-12",
        "form": "Comprimido",
        "strength": "3 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05AX12",
    "name": "Aripiprazol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg",
      "15 mg"
    ],
    "presentations": [
      {
        "code": "N-05-15",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": true
      },
      {
        "code": "N-05-16",
        "form": "Comprimido",
        "strength": "15 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "N05BA01",
    "name": "Diazepam",
    "doseForms": [
      "Comprimido ranurado",
      "Inyectable"
    ],
    "strengths": [
      "10 mg",
      "5 mg"
    ],
    "presentations": [
      {
        "code": "N-05-04",
        "form": "Comprimido ranurado",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "N-05-05",
        "form": "Inyectable",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "N-05-06",
        "form": "Comprimido ranurado",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05BA12",
    "name": "Alprazolam",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "0,5 mg"
    ],
    "presentations": [
      {
        "code": "N-05-01",
        "form": "Comprimido ranurado",
        "strength": "0,5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05CD08",
    "name": "Midazolam",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "15 mg/3 ml"
    ],
    "presentations": [
      {
        "code": "N-05-11",
        "form": "Inyectable",
        "strength": "15 mg/3 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N05CM18",
    "name": "Dexmedetomidina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mcg/ml"
    ],
    "presentations": [
      {
        "code": "N-05-19",
        "form": "Inyectable",
        "strength": "100 mcg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N06AA02",
    "name": "Imipramina clorhidrato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "25 mg"
    ],
    "presentations": [
      {
        "code": "N-06-05",
        "form": "Comprimido",
        "strength": "25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N06AA04",
    "name": "Clomipramina",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "75 mg",
      "25 mg/2 ml"
    ],
    "presentations": [
      {
        "code": "N-06-02",
        "form": "Comprimido",
        "strength": "75 mg",
        "restrictedUse": false
      },
      {
        "code": "N-06-03",
        "form": "Inyectable",
        "strength": "25 mg/2 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N06AA09",
    "name": "Amitriptilina",
    "doseForms": [
      "Comprimido ranurado"
    ],
    "strengths": [
      "25 mg"
    ],
    "presentations": [
      {
        "code": "N-06-01",
        "form": "Comprimido ranurado",
        "strength": "25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N06AB03",
    "name": "Fluoxetina",
    "doseForms": [
      "Cápsula o Comprimido"
    ],
    "strengths": [
      "20 mg"
    ],
    "presentations": [
      {
        "code": "N-06-04",
        "form": "Cápsula o Comprimido",
        "strength": "20 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N06AX21",
    "name": "Duloxetina",
    "doseForms": [
      "Cápsula"
    ],
    "strengths": [
      "30 mg"
    ],
    "presentations": [
      {
        "code": "N-06-08",
        "form": "Cápsula",
        "strength": "30 mg",
        "restrictedUse": true
      }
    ]
  },
  {
    "atc": "N06BA04",
    "name": "Metilfenidato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "N-06-06",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N06BC01",
    "name": "Cafeína",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml",
      "20 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-06-07",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "N-06-09",
        "form": "Inyectable",
        "strength": "20 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N07AA01",
    "name": "Neostigmina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,5 mg/ml"
    ],
    "presentations": [
      {
        "code": "N-07-05",
        "form": "Inyectable",
        "strength": "0,5 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N07AA02",
    "name": "Piridostigmina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "60 mg"
    ],
    "presentations": [
      {
        "code": "N-07-06",
        "form": "Comprimido",
        "strength": "60 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "N07CA03",
    "name": "Flunarizina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "10 mg"
    ],
    "presentations": [
      {
        "code": "N-07-08",
        "form": "Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01AB01",
    "name": "Metronidazol",
    "doseForms": [
      "Suspensión",
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "250 mg/5 ml",
      "500 mg",
      "125 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "P-01-06",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "P-01-07",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-08",
        "form": "Suspensión",
        "strength": "125 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "P-01-09",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01AX11",
    "name": "Nitazoxanida",
    "doseForms": [
      "Comprimido",
      "Jarabe"
    ],
    "strengths": [
      "500 mg",
      "100 mg / 5 ml"
    ],
    "presentations": [
      {
        "code": "P-01-11",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-26",
        "form": "Jarabe",
        "strength": "100 mg / 5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BA01",
    "name": "Cloroquina fosfato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg (150 mg base)"
    ],
    "presentations": [
      {
        "code": "P-01-03",
        "form": "Comprimido",
        "strength": "250 mg (150 mg base)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BA02",
    "name": "Hidroxicloroquina sulfato",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "200 mg"
    ],
    "presentations": [
      {
        "code": "P-01-27",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BA03",
    "name": "Primaquina (base)",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "15 mg",
      "15 mg/5 ml",
      "5 mg"
    ],
    "presentations": [
      {
        "code": "P-01-15",
        "form": "Comprimido",
        "strength": "15 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-16",
        "form": "Suspensión",
        "strength": "15 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "P-01-20",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BC01",
    "name": "Quinina (diclorhidrato)",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "300 mg",
      "600 mg"
    ],
    "presentations": [
      {
        "code": "P-01-17",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-18",
        "form": "Inyectable",
        "strength": "600 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BC02",
    "name": "Mefloquina (clorhidrato)",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "P-01-04",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BD01",
    "name": "Pirimetamina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "25 mg"
    ],
    "presentations": [
      {
        "code": "P-01-14",
        "form": "Comprimido",
        "strength": "25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BD51",
    "name": "Sulfadoxina + Pirimetamina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg + 25 mg"
    ],
    "presentations": [
      {
        "code": "P-01-19",
        "form": "Comprimido",
        "strength": "500 mg + 25 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BE03",
    "name": "Artesunato",
    "doseForms": [
      "Comprimido",
      "Inyectable"
    ],
    "strengths": [
      "50 mg",
      "25 mg + 55 mg",
      "100 mg + 220 mg",
      "60 mg"
    ],
    "presentations": [
      {
        "code": "P-01-01",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-21",
        "form": "Comprimido",
        "strength": "25 mg + 55 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-22",
        "form": "Comprimido",
        "strength": "100 mg + 220 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-24",
        "form": "Inyectable",
        "strength": "60 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01BF01",
    "name": "Artemeter + Lumefantrina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "20 mg + 120 mg"
    ],
    "presentations": [
      {
        "code": "P-01-23",
        "form": "Comprimido",
        "strength": "20 mg + 120 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01CA02",
    "name": "Benznidazol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "100 mg",
      "12,5 mg",
      "50 mg"
    ],
    "presentations": [
      {
        "code": "P-01-02",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-25",
        "form": "Comprimido",
        "strength": "12,5 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-28",
        "form": "Comprimido",
        "strength": "50 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01CB01",
    "name": "Meglumina antimoniato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1,5 g/5 ml"
    ],
    "presentations": [
      {
        "code": "P-01-05",
        "form": "Inyectable",
        "strength": "1,5 g/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01CC01",
    "name": "Nifurtimox",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "120 mg",
      "30 mg",
      "250 mg"
    ],
    "presentations": [
      {
        "code": "P-01-10",
        "form": "Comprimido",
        "strength": "120 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-29",
        "form": "Comprimido",
        "strength": "30 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-30",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P01CX01",
    "name": "Pentamidina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "200 mg",
      "300 mg"
    ],
    "presentations": [
      {
        "code": "P-01-12",
        "form": "Inyectable",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "P-01-13",
        "form": "Inyectable",
        "strength": "300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02BA01",
    "name": "Prazicuantel",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "600 mg"
    ],
    "presentations": [
      {
        "code": "P-02-09",
        "form": "Comprimido",
        "strength": "600 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02BX04",
    "name": "Triclabendazol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "250 mg"
    ],
    "presentations": [
      {
        "code": "P-02-12",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02CA01",
    "name": "Mebendazol",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "100 mg",
      "100 mg/5 ml",
      "500 mg"
    ],
    "presentations": [
      {
        "code": "P-02-03",
        "form": "Comprimido",
        "strength": "100 mg",
        "restrictedUse": false
      },
      {
        "code": "P-02-04",
        "form": "Suspensión",
        "strength": "100 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "P-02-05",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02CA02",
    "name": "Tiabendazol",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "500 mg",
      "500 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "P-02-10",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      },
      {
        "code": "P-02-11",
        "form": "Suspensión",
        "strength": "500 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02CA03",
    "name": "Albendazol",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "200 mg",
      "200 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "P-02-01",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      },
      {
        "code": "P-02-02",
        "form": "Suspensión",
        "strength": "200 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02CC01",
    "name": "Pirantel pamoato",
    "doseForms": [
      "Comprimido",
      "Suspensión"
    ],
    "strengths": [
      "250 mg",
      "250 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "P-02-07",
        "form": "Comprimido",
        "strength": "250 mg",
        "restrictedUse": false
      },
      {
        "code": "P-02-08",
        "form": "Suspensión",
        "strength": "250 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02CF01",
    "name": "Ivermectina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "3 mg",
      "6 mg"
    ],
    "presentations": [
      {
        "code": "P-02-13",
        "form": "Comprimido",
        "strength": "3 mg",
        "restrictedUse": false
      },
      {
        "code": "P-02-14",
        "form": "Comprimido",
        "strength": "6 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P02DA01",
    "name": "Niclosamida",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "P-02-06",
        "form": "Comprimido",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P03AC04",
    "name": "Permetrina",
    "doseForms": [
      "Loción",
      "Crema o Pomada"
    ],
    "strengths": [
      "1%",
      "5%"
    ],
    "presentations": [
      {
        "code": "P-03-02",
        "form": "Loción",
        "strength": "1%",
        "restrictedUse": false
      },
      {
        "code": "P-03-03",
        "form": "Crema o Pomada",
        "strength": "5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "P03AX01",
    "name": "Benzoato de bencilo",
    "doseForms": [
      "Solución o Loción"
    ],
    "strengths": [
      "20% o 25%"
    ],
    "presentations": [
      {
        "code": "P-03-01",
        "form": "Solución o Loción",
        "strength": "20% o 25%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03AC02",
    "name": "Salbutamol",
    "doseForms": [
      "Solución para nebulización",
      "Aerosol"
    ],
    "strengths": [
      "5 mg/ml",
      "0,1 mg/inhalación"
    ],
    "presentations": [
      {
        "code": "R-03-04",
        "form": "Solución para nebulización",
        "strength": "5 mg/ml",
        "restrictedUse": false
      },
      {
        "code": "R-03-06",
        "form": "Aerosol",
        "strength": "0,1 mg/inhalación",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03AK06",
    "name": "Salmeterol + Fluticasona",
    "doseForms": [
      "Aerosol"
    ],
    "strengths": [
      "25 mcg + 125 mcg"
    ],
    "presentations": [
      {
        "code": "R-03-11",
        "form": "Aerosol",
        "strength": "25 mcg + 125 mcg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03BA01",
    "name": "Beclometasona dipropionato",
    "doseForms": [
      "Aerosol"
    ],
    "strengths": [
      "50 mcg/inhalación"
    ],
    "presentations": [
      {
        "code": "R-03-03",
        "form": "Aerosol",
        "strength": "50 mcg/inhalación",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03BA02",
    "name": "Budesonida",
    "doseForms": [
      "Aerosol"
    ],
    "strengths": [
      "100 mcg"
    ],
    "presentations": [
      {
        "code": "R-03-12",
        "form": "Aerosol",
        "strength": "100 mcg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03BB01",
    "name": "Ipratropio bromuro",
    "doseForms": [
      "Aerosol"
    ],
    "strengths": [
      "20 mcg/dosis"
    ],
    "presentations": [
      {
        "code": "R-03-09",
        "form": "Aerosol",
        "strength": "20 mcg/dosis",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03CC02",
    "name": "Salbutamol",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "4 mg"
    ],
    "presentations": [
      {
        "code": "R-03-05",
        "form": "Comprimido",
        "strength": "4 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03DA04",
    "name": "Teofilina",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "300 mg"
    ],
    "presentations": [
      {
        "code": "R-03-08",
        "form": "Comprimido",
        "strength": "300 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03DA05",
    "name": "Aminofilina",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "250 mg / 10 ml",
      "200 mg"
    ],
    "presentations": [
      {
        "code": "R-03-01",
        "form": "Inyectable",
        "strength": "250 mg / 10 ml",
        "restrictedUse": false
      },
      {
        "code": "R-03-02",
        "form": "Comprimido",
        "strength": "200 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R03DC03",
    "name": "Montelukast",
    "doseForms": [
      "Comprimido o Cápsula",
      "Comprimido"
    ],
    "strengths": [
      "10 mg",
      "5 mg"
    ],
    "presentations": [
      {
        "code": "R-03-13",
        "form": "Comprimido o Cápsula",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "R-03-14",
        "form": "Comprimido",
        "strength": "5 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R05DA04",
    "name": "Codeína",
    "doseForms": [
      "Jarabe"
    ],
    "strengths": [
      "10 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "R-05-02",
        "form": "Jarabe",
        "strength": "10 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R05DA09",
    "name": "Dextrometorfano bromhidrato",
    "doseForms": [
      "Jarabe"
    ],
    "strengths": [
      "10 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "R-05-03",
        "form": "Jarabe",
        "strength": "10 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R06AB04",
    "name": "Clorfenamina (Clorfeniramina)",
    "doseForms": [
      "Comprimido",
      "Jarabe",
      "Inyectable"
    ],
    "strengths": [
      "4 mg",
      "2 mg/5 ml",
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "R-06-01",
        "form": "Comprimido",
        "strength": "4 mg",
        "restrictedUse": false
      },
      {
        "code": "R-06-02",
        "form": "Jarabe",
        "strength": "2 mg/5 ml",
        "restrictedUse": false
      },
      {
        "code": "R-06-03",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R06AE07",
    "name": "Cetirizina",
    "doseForms": [
      "Cápsula o Comprimido",
      "Jarabe"
    ],
    "strengths": [
      "10 mg",
      "5 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "R-06-07",
        "form": "Cápsula o Comprimido",
        "strength": "10 mg",
        "restrictedUse": false
      },
      {
        "code": "R-06-08",
        "form": "Jarabe",
        "strength": "5 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R06AX17",
    "name": "Ketotifeno",
    "doseForms": [
      "Comprimido"
    ],
    "strengths": [
      "1 mg"
    ],
    "presentations": [
      {
        "code": "R-06-04",
        "form": "Comprimido",
        "strength": "1 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "R07AA02",
    "name": "Surfactante pulmonar",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "25 a 35 mg/ml"
    ],
    "presentations": [
      {
        "code": "R-07-01",
        "form": "Inyectable",
        "strength": "25 a 35 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01AA01",
    "name": "Cloranfenicol",
    "doseForms": [
      "Solución oftálmica",
      "Ungüento oftálmico"
    ],
    "strengths": [
      "0,5%",
      "1%"
    ],
    "presentations": [
      {
        "code": "S-01-05",
        "form": "Solución oftálmica",
        "strength": "0,5%",
        "restrictedUse": false
      },
      {
        "code": "S-01-06",
        "form": "Ungüento oftálmico",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01AA11",
    "name": "Gentamicina",
    "doseForms": [
      "Ungüento oftálmico",
      "Solución oftálmica"
    ],
    "strengths": [
      "0,3%"
    ],
    "presentations": [
      {
        "code": "S-01-15",
        "form": "Ungüento oftálmico",
        "strength": "0,3%",
        "restrictedUse": false
      },
      {
        "code": "S-01-16",
        "form": "Solución oftálmica",
        "strength": "0,3%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01AD03",
    "name": "Aciclovir",
    "doseForms": [
      "Crema o Pomada oftálmica"
    ],
    "strengths": [
      "3%"
    ],
    "presentations": [
      {
        "code": "S-01-01",
        "form": "Crema o Pomada oftálmica",
        "strength": "3%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01AX13",
    "name": "Ciprofloxacina",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,3%"
    ],
    "presentations": [
      {
        "code": "S-01-04",
        "form": "Solución oftálmica",
        "strength": "0,3%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01BA01",
    "name": "Dexametasona",
    "doseForms": [
      "Solución oftálmica",
      "Ungüento o Pomada oftálmica"
    ],
    "strengths": [
      "0,1%"
    ],
    "presentations": [
      {
        "code": "S-01-09",
        "form": "Solución oftálmica",
        "strength": "0,1%",
        "restrictedUse": false
      },
      {
        "code": "S-01-10",
        "form": "Ungüento o Pomada oftálmica",
        "strength": "0,1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01BC03",
    "name": "Diclofenaco Sódico",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,1%"
    ],
    "presentations": [
      {
        "code": "S-01-11",
        "form": "Solución oftálmica",
        "strength": "0,1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01CA01",
    "name": "Corticoide + antiinfeccioso de accion tópica",
    "doseForms": [
      "Solución oftálmica",
      "Ungüento oftálmico"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "S-01-24",
        "form": "Solución oftálmica",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "S-01-25",
        "form": "Ungüento oftálmico",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01EC03",
    "name": "Dorzolamida",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "2%"
    ],
    "presentations": [
      {
        "code": "S-01-12",
        "form": "Solución oftálmica",
        "strength": "2%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01ED01",
    "name": "Timolol maleato",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,5%"
    ],
    "presentations": [
      {
        "code": "S-01-22",
        "form": "Solución oftálmica",
        "strength": "0,5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01EE01",
    "name": "Latanoprost",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "50 mcg/ml"
    ],
    "presentations": [
      {
        "code": "S-01-27",
        "form": "Solución oftálmica",
        "strength": "50 mcg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01FA01",
    "name": "Atropina sulfato",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "S-01-02",
        "form": "Solución oftálmica",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01FA06",
    "name": "Tropicamida",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "1%"
    ],
    "presentations": [
      {
        "code": "S-01-23",
        "form": "Solución oftálmica",
        "strength": "1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01GA01",
    "name": "Nafazolina clorhidrato",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,1%"
    ],
    "presentations": [
      {
        "code": "S-01-19",
        "form": "Solución oftálmica",
        "strength": "0,1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01GX08",
    "name": "Ketotifeno",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,25 mg/ml"
    ],
    "presentations": [
      {
        "code": "S-01-17",
        "form": "Solución oftálmica",
        "strength": "0,25 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01HA04",
    "name": "Proximetacaina (Proparacaina)",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,5%"
    ],
    "presentations": [
      {
        "code": "S-01-20",
        "form": "Solución oftálmica",
        "strength": "0,5%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01JA01",
    "name": "Fluoresceina",
    "doseForms": [
      "Inyectable",
      "Solución oftálmica"
    ],
    "strengths": [
      "10%",
      "0,25%"
    ],
    "presentations": [
      {
        "code": "S-01-13",
        "form": "Inyectable",
        "strength": "10%",
        "restrictedUse": false
      },
      {
        "code": "S-01-14",
        "form": "Solución oftálmica",
        "strength": "0,25%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01XA18",
    "name": "Ciclosporina",
    "doseForms": [
      "Solución oftálmica"
    ],
    "strengths": [
      "0,1%"
    ],
    "presentations": [
      {
        "code": "S-01-03",
        "form": "Solución oftálmica",
        "strength": "0,1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S01XA20",
    "name": "Lágrimas artificiales",
    "doseForms": [
      "Solución oftálmica",
      "Gel"
    ],
    "strengths": [
      "0,3% o 1%"
    ],
    "presentations": [
      {
        "code": "S-01-18",
        "form": "Solución oftálmica",
        "strength": "0,3% o 1%",
        "restrictedUse": false
      },
      {
        "code": "S-01-26",
        "form": "Gel",
        "strength": "0,3% o 1%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "S02DA30",
    "name": "Glicerina + carbonato de sodio",
    "doseForms": [
      "Gotas óticas"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "S-02-01",
        "form": "Gotas óticas",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB01",
    "name": "Ipecacuana",
    "doseForms": [
      "Jarabe"
    ],
    "strengths": [
      "7%"
    ],
    "presentations": [
      {
        "code": "V-03-06",
        "form": "Jarabe",
        "strength": "7%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB03",
    "name": "Edetato sódico de calcio (EDTA)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "20%"
    ],
    "presentations": [
      {
        "code": "V-03-04",
        "form": "Inyectable",
        "strength": "20%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB04",
    "name": "Pralidoxima",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "1 g"
    ],
    "presentations": [
      {
        "code": "V-03-12",
        "form": "Inyectable",
        "strength": "1 g",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB09",
    "name": "Dimercaprol (B.A.L.)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "100 mg/ml"
    ],
    "presentations": [
      {
        "code": "V-03-03",
        "form": "Inyectable",
        "strength": "100 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB14",
    "name": "Protamina Sulfato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10 mg/ml"
    ],
    "presentations": [
      {
        "code": "V-03-13",
        "form": "Inyectable",
        "strength": "10 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB15",
    "name": "Naloxona",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,4 mg/ml"
    ],
    "presentations": [
      {
        "code": "V-03-09",
        "form": "Inyectable",
        "strength": "0,4 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB18",
    "name": "Permanganato de potasio",
    "doseForms": [
      "Solución acuosa"
    ],
    "strengths": [
      "1:10.000"
    ],
    "presentations": [
      {
        "code": "V-03-11",
        "form": "Solución acuosa",
        "strength": "1:10.000",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB23",
    "name": "Acetil Cisteina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "10%"
    ],
    "presentations": [
      {
        "code": "V-03-01",
        "form": "Inyectable",
        "strength": "10%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AB25",
    "name": "Flumazenil",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0,5 mg/5 ml"
    ],
    "presentations": [
      {
        "code": "V-03-05",
        "form": "Inyectable",
        "strength": "0,5 mg/5 ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AC01",
    "name": "Deferoxamina mesilato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "500 mg"
    ],
    "presentations": [
      {
        "code": "V-03-02",
        "form": "Inyectable",
        "strength": "500 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AF01",
    "name": "Mesna (Mercapto etilsulfonato sódico)",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "400 mg"
    ],
    "presentations": [
      {
        "code": "V-03-08",
        "form": "Inyectable",
        "strength": "400 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AF03",
    "name": "Leucovorina",
    "doseForms": [
      "Inyectable",
      "Comprimido"
    ],
    "strengths": [
      "50 mg",
      "15 mg"
    ],
    "presentations": [
      {
        "code": "V-03-07",
        "form": "Inyectable",
        "strength": "50 mg",
        "restrictedUse": false
      },
      {
        "code": "V-03-14",
        "form": "Comprimido",
        "strength": "15 mg",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V03AN01",
    "name": "Oxígeno",
    "doseForms": [
      "Gas"
    ],
    "strengths": [
      "93% - 99%"
    ],
    "presentations": [
      {
        "code": "V-03-10",
        "form": "Gas",
        "strength": "93% - 99%",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V08AA01",
    "name": "Meglumina diatrizoato",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "70% o 76% (20 ml)",
      "70% o 76% (50 ml)"
    ],
    "presentations": [
      {
        "code": "V-08-06",
        "form": "Inyectable",
        "strength": "70% o 76% (20 ml)",
        "restrictedUse": false
      },
      {
        "code": "V-08-07",
        "form": "Inyectable",
        "strength": "70% o 76% (50 ml)",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V08BA02",
    "name": "Sulfato de Bario",
    "doseForms": [
      "Suspensión",
      "Polvo para enema"
    ],
    "strengths": [],
    "presentations": [
      {
        "code": "V-08-08",
        "form": "Suspensión",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      },
      {
        "code": "V-08-09",
        "form": "Polvo para enema",
        "strength": "Según disponibilidad",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V08CA01",
    "name": "Gadopentato de dimeglumina",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "469 mg/ml"
    ],
    "presentations": [
      {
        "code": "V-08-05",
        "form": "Inyectable",
        "strength": "469 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V08CA03",
    "name": "Gadodiamida",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "287 mg/ml"
    ],
    "presentations": [
      {
        "code": "V-08-04",
        "form": "Inyectable",
        "strength": "287 mg/ml",
        "restrictedUse": false
      }
    ]
  },
  {
    "atc": "V08CA06",
    "name": "Gadoversetamida",
    "doseForms": [
      "Inyectable"
    ],
    "strengths": [
      "0.5mmol / ml"
    ],
    "presentations": [
      {
        "code": "V-08-10",
        "form": "Inyectable",
        "strength": "0.5mmol / ml",
        "restrictedUse": true
      }
    ]
  }
];
