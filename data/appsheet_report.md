# AppSheet schema analysis
Source file: appsheet_export.xlsx
## Table: Kunder
Rows: 136 | Columns: 17
- Candidate PK: None
- Columns:
  - Kunde_ID [datetime]
  - Bydel [enum(5 shown)]
  - Inaktiv [datetime]
  - Kundenavn
  - Adresse
  - Postnr [datetime]
  - Poststed [enum(2 shown)]
  - Kontaktperson [enum(2 shown)]
  - Telefon [datetime]
  - Epost [enum(3 shown)]
  - Kunde_Epost [enum(3 shown)]
  - Antall_besøk_pr_år [datetime]
  - Historisk_Siste_Besøk [datetime]
  - Neste besøk [datetime]
  - Status_gammel [enum(1 shown)]
  - Merknad
  - Notater [enum(4 shown)]

## Table: Admin_Filter
Rows: 1 | Columns: 4
- Candidate PK: Filter_ID
- Columns:
  - Filter_ID [datetime ,FK -> Admin_Filter(Filter_ID)]
  - Startdato [datetime]
  - Sluttdato [datetime]
  - Valgt_Tekniker [enum(1 shown)]

## Table: Besøk
Rows: 138 | Columns: 15
- Candidate PK: None
- Columns:
  - Besøk_ID
  - Tilknyttet_Kunde
  - Tidspunkt [datetime]
  - Besøkstype [enum(3 shown)]
  - Besøksstatus [enum(3 shown)]
  - Substitusjon_Vurdert [datetime]
  - Substitusjon_Tekst [enum(1 shown)]
  - Utført_av [enum(2 shown)]
  - Besøksnotater [enum(5 shown)]
  - Oppsummering_Notat [enum(5 shown)]
  - Rapport_Klar [datetime]
  - Sjekk_Advarselskilt [datetime]
  - Sjekk_Uteareal [datetime]
  - Planlagt_Dato [datetime]
  - Tildelt_Tekniker [enum(3 shown)]

## Table: Bilder
Rows: 0 | Columns: 4
- Candidate PK: None
- Columns:
  - Bilde_ID [datetime]
  - Tilknyttet_Besøk_ID [datetime]
  - Bilde [datetime]
  - Bilde_Beskrivelse [datetime]

## Table: Utstyr
Rows: 69 | Columns: 19
- Candidate PK: None
- Columns:
  - Utstyr_ID
  - Tilknyttet_Kunde [enum(5 shown)]
  - Posisjon
  - Type_utstyr [enum(5 shown)]
  - Installert_Dato [datetime ,enum(5 shown)]
  - Unnamed: 5 [datetime]
  - Egendefinert_utstyr [datetime]
  - Plasseringsbeskrivelse
  - Installasjonsbilde
  - Inneholder_Gift_Åte [datetime]
  - Inneholder_Giftfritt_Åte [datetime]
  - Inneholder_Felle [datetime]
  - Startmengde_Gift [datetime]
  - Startmengde_Giftfritt [datetime]
  - Tilgang_Type [enum(1 shown)]
  - Tilgang_Kode [datetime]
  - Tilgang_Instruksjoner [datetime]
  - Standard_Giftåte [enum(1 shown)]
  - Standard_Giftfritt_Åte [datetime]

## Table: Utstyrstyper
Rows: 5 | Columns: 1
- Candidate PK: Type
- Columns:
  - Type [enum(5 shown)]

## Table: Servicelogg
Rows: 69 | Columns: 26
- Candidate PK: Logg_ID
- Columns:
  - Logg_ID [FK -> Servicelogg(Logg_ID)]
  - Tilknyttet_Besøk_ID [enum(5 shown)]
  - Tilknyttet_Utstyr_ID
  - Dato_for_Service [datetime]
  - Status_Giftåte [datetime]
  - Forbruk_Giftåte [datetime]
  - Giftåte_Etterfylt [datetime]
  - Forbruk_Giftfritt [datetime]
  - Giftfritt_Etterfylt [datetime]
  - Status_Felle [datetime]
  - Service_Notat [enum(5 shown)]
  - Antall_Slag [datetime]
  - Antall_Fangst [datetime]
  - Mengde_fra_Forrige_Besøk [datetime]
  - Mengde_Forbrukt [datetime]
  - Benyttet_Giftåte [enum(1 shown)]
  - Benyttet_Giftfritt_Åte [datetime]
  - Mengde_Etterlatt [datetime]
  - Nullstill_Åte
  - Nullstill_Giftfritt_Åte
  - Giftfritt_Mengde_fra_Forrige [datetime]
  - Giftfritt_Mengde_Forbrukt [datetime]
  - Giftfritt_Mengde_Etterlatt [datetime]
  - Unnamed: 23 [datetime]
  - Bilde_av_Servicepunkt [enum(5 shown)]
  - Bilde_Beskrivelse_Servicepunkt [enum(4 shown)]

## Table: Materialer
Rows: 2 | Columns: 5
- Candidate PK: Materiale_ID
- Columns:
  - Materiale_ID [enum(2 shown) ,FK -> Materialer(Materiale_ID)]
  - Navn [enum(2 shown)]
  - Materialtype [enum(2 shown)]
  - Virkestoff [enum(2 shown)]
  - Standard_Mengde [datetime]

## Table: Materialbruk
Rows: 2 | Columns: 4
- Candidate PK: Bruk_ID
- Columns:
  - Bruk_ID [enum(2 shown) ,FK -> Materialbruk(Bruk_ID)]
  - Tilknyttet_Servicelogg_ID [enum(2 shown)]
  - Benyttet_Materiale [enum(2 shown)]
  - Mengde [datetime]

## Table: Ansatte
Rows: 4 | Columns: 4
- Candidate PK: Navn
- Columns:
  - Navn [enum(4 shown)]
  - Ansatt_Epost [enum(4 shown)]
  - Unnamed: 2 [datetime]
  - Rolle [enum(2 shown)]

## Table: Rutevalg
Rows: 13 | Columns: 4
- Candidate PK: Valg_ID
- Columns:
  - Valg_ID [enum(5 shown) ,FK -> Rutevalg(Valg_ID)]
  - Tekniker_Epost [enum(2 shown)]
  - Valgt_Kunde [datetime]
  - Dato_Valgt [datetime]

## Relationships
- Admin_Filter.Filter_ID -> Admin_Filter.Filter_ID (many-to-one)
- Servicelogg.Logg_ID -> Servicelogg.Logg_ID (many-to-one)
- Materialer.Materiale_ID -> Materialer.Materiale_ID (many-to-one)
- Materialbruk.Bruk_ID -> Materialbruk.Bruk_ID (many-to-one)
- Rutevalg.Valg_ID -> Rutevalg.Valg_ID (many-to-one)

## Suggested endpoints
- GET /api/kunder | POST /api/kunder | GET/PUT/DELETE /api/kunder/<id>
- GET /api/admin_filter | POST /api/admin_filter | GET/PUT/DELETE /api/admin_filter/<id>
- GET /api/besøk | POST /api/besøk | GET/PUT/DELETE /api/besøk/<id>
- GET /api/bilder | POST /api/bilder | GET/PUT/DELETE /api/bilder/<id>
- GET /api/utstyr | POST /api/utstyr | GET/PUT/DELETE /api/utstyr/<id>
- GET /api/utstyrstyper | POST /api/utstyrstyper | GET/PUT/DELETE /api/utstyrstyper/<id>
- GET /api/servicelogg | POST /api/servicelogg | GET/PUT/DELETE /api/servicelogg/<id>
- GET /api/materialer | POST /api/materialer | GET/PUT/DELETE /api/materialer/<id>
- GET /api/materialbruk | POST /api/materialbruk | GET/PUT/DELETE /api/materialbruk/<id>
- GET /api/ansatte | POST /api/ansatte | GET/PUT/DELETE /api/ansatte/<id>
- GET /api/rutevalg | POST /api/rutevalg | GET/PUT/DELETE /api/rutevalg/<id>
