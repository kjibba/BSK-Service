# Workflows-driven development

We can design and iterate features by writing down the real-world workflows and the outcomes we need. Each workflow becomes a small spec that drives API, data model, and UI changes.

## Template
- Title: <short, user-facing name>
- Actors: <roles/people>
- Trigger: <when does it start>
- Preconditions: <what must be true>
- Steps: <what the user does, in order>
- Data: <entities/fields touched>
- Success criteria: <what makes it done>
- Edge cases: <notable exceptions>
- API/UI changes: <endpoints, components, filters>
- Metrics/Reporting (optional): <what do we want to measure>

## Examples

### 1) Plan next visits for a customer route
- Actors: Coordinator, Technicians
- Trigger: Weekly planning meeting
- Preconditions: Active customers with upcoming service windows
- Steps:
  1. Coordinator filters customers by area.
  2. Selects customers and assigns to a technician (creates RouteChoice entries with selected_date and technician_email).
  3. Optionally creates placeholder Visits for those customers with planned dates.
- Data: Customer, RouteChoice, Visit
- Success: All selected customers have a planned visit and an assigned technician.
- Edge cases: Customer is inactive; overlapping schedules.
- API/UI: Filters by area (later), create/update route choices, bulk create visits.

### 2) Perform on-site service and record logs
- Actors: Technician
- Trigger: On-site service visit
- Preconditions: An existing Visit for the customer
- Steps:
  1. Open the visit and see customer equipment.
  2. For each equipment point, add a ServiceLog with status/notes/hours.
  3. If materials used, record MaterialUsage items.
  4. Optionally capture photos linked to the visit.
- Data: Visit, Equipment, ServiceLog, MaterialUsage, Photo
- Success: Visit has at least one ServiceLog; materials/photos are saved if used.
- Edge cases: Missing equipment reference; offline mode (future consideration).
- API/UI: Visit list filtered by customer, create service logs, attach materials and photos.

### 3) Customer report generation (basic)
- Actors: Technician, Coordinator
- Trigger: After a visit
- Preconditions: Visit completed with logs
- Steps:
  1. Generate a simple summary of logs per visit (date, technician, equipment touched, notes).
  2. Export to PDF or send via email (later).
- Data: Visit, ServiceLog, Equipment
- Success: Downloadable or printable report exists.
- Edge cases: No logs yet; sensitive data redaction.
- API/UI: Read endpoints; a report view for a visit.

## How to use
1. Add a new workflow below using the template.
2. Label it with a short ID (WF-###) for tracking.
3. We’ll implement from top to bottom: data -> API -> UI.
4. Each merged change should reference the workflow ID in commit messages.
