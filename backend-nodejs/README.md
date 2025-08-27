# BSK Service App - Node.js Backend

This is a complete Node.js/TypeScript port of the original Python Flask backend, providing identical API functionality with Express.js and TypeORM.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database settings
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run in development:**
   ```bash
   npm run dev
   ```

5. **Run in production:**
   ```bash
   npm start
   ```

## Features Implemented

- ✅ **Authentication** - Session-based auth matching Flask version
- ✅ **Customer Management** - Full CRUD operations
- ✅ **Equipment Management** - Full CRUD operations  
- ✅ **Map Integration** - Customer coordinate handling
- ✅ **TypeORM Entities** - All 11 entities matching Python models exactly
- 🚧 **Complex Routes** - Visits, service logs, materials (stub implementation)
- 🚧 **Business Logic** - Next visit calculations, workflows
- 🚧 **File Uploads** - Photo/document handling

## Database Schema

The TypeORM entities match the original SQLAlchemy models exactly:
- Customer, Visit, Equipment, EquipmentType  
- ServiceLog, Material, MaterialUsage
- Employee, RouteChoice, Photo, Feedback, DailyTask

## API Compatibility

All endpoints maintain identical request/response formats to ensure the React frontend works without changes.

## Development vs Production

- **Development:** Uses `tsx watch` for hot reload
- **Production:** Compiles to JavaScript and runs with Node.js
- **Docker:** Full containerization support with docker-compose

## Environment Variables

See `.env.example` for required configuration including database connection and session secrets.

## Next Steps

1. Complete remaining route implementations
2. Port complex business logic from Python
3. Add comprehensive error handling
4. Set up automated testing
5. Deploy to production environment

## Servicerapporter og e-post

- Ved fullføring av et besøk genereres det en PDF-rapport i `static/reports/` og en rad lagres i tabellen `service_reports`.
- Rapporten vises på kundekortet under «Servicerapporter (PDF)» og kan listes for admin via `GET /api/reports` eller per kunde via `GET /api/reports/by_customer/:id`.
- E-post sendes (vedlegg: PDF) til en fast adresse (midlertidig): `kjibba@gmail.com`.

SMTP-konfigurasjon (valgfritt – hvis ikke satt, brukes logg-transport som skriver e-posten som JSON):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `MAIL_FROM` (standard: `no-reply@bsk-service.local`)
