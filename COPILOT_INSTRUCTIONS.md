# Copilot-prosjektinstruksjoner

## 🎯 Mål
Dette prosjektet skal utvikles med tanke på at brukeren (Kjetil) er nybegynner i Python, Flask og webutvikling.  
Copilot skal derfor alltid:
- Forklare hva koden gjør.
- Forklare hvorfor vi gjør det på denne måten.
- Bruke enkle ord og unngå unødvendig fagsjargong.
- Legge inn korte, relevante kommentarer i koden.
- Vise små, forståelige eksempler på bruk der det er mulig.

## 📜 Retningslinjer for koden
1. **Kommentarer i koden**  
   - Hver funksjon, klasse og viktige kodeblokk skal ha en kommentar som forklarer hensikten.
   - Kommenter også *hvorfor* vi velger en bestemt løsning, ikke bare *hva* den gjør.

2. **Struktur og lesbarhet**  
   - Følg PEP 8 for Python-kode.
   - Bruk beskrivende variabel- og funksjonsnavn.
   - Del opp lange funksjoner i mindre, logiske deler.

3. **Pedagogisk forklaring**  
   - Når ny kode foreslås, legg ved en kort tekst (i kommentar eller separat) som forklarer:
     - Hva koden gjør.
     - Hvor den skal plasseres i prosjektet.
     - Hvordan den henger sammen med eksisterende kode.
     - Hvordan den kan testes.

4. **Eksempler**  
   - Gi eksempler på hvordan funksjoner eller API-endepunkter kan brukes.
   - Bruk gjerne Flask `test_client`-eksempler for å vise API-kall.

5. **Imports og prosjektstruktur**  
   - Bruk alltid pakkestier (f.eks. `backend.extensions`, `backend.models`) for å unngå import-problemer.
   - Ikke opprett nye `db`-instanser — bruk den som finnes i `backend.extensions`.

6. **Migrasjoner og databasen**  
   - Når nye modeller eller felter legges til, forklar hvordan man:
     - Genererer migrasjon (`flask db migrate -m "..."`)
     - Kjører migrasjon (`flask db upgrade`)
   - Forklar hva migrasjonen gjør med databasen.

## 💬 Eksempel på ønsket Copilot-svar
Når jeg ber om en ny rute i Flask, skal Copilot:
- Lage koden.
- Kommentere hvert steg.
- Forklare hvordan jeg kan teste den.
- Forklare hvorfor vi gjør det slik.

---

> **Merk:** Disse instruksjonene gjelder for hele prosjektet.  
> Copilot skal alltid anta at brukeren ønsker å lære, ikke bare få ferdig kode.

Terminal er PowerShell, husk riktig syntaks for PowerShell kommandoer

Følg opp source control i GitHub. Bruker er ukjent med bruk av GitHub

Rydd alltid opp i ESlint errors.