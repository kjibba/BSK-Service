"""
Import data from an AppSheet Excel export into the Flask/SQLAlchemy database.

Features:
- Reads key sheets: Kunder, Utstyr, Besøk, Servicelogg.
- Maps Norwegian column names to current models (Customer, Equipment, Visit, ServiceLog).
- Preserves relationships using original IDs when available, with fallbacks.
- Dry-run by default; use --commit to write to DB.
- Writes an optional markdown summary report with stats and any warnings.

Usage (PowerShell):
  # Dry-run
  python backend/tools/import_appsheet.py data/appsheet_export.xlsx --out data/import_report.md
  # Commit changes
  python backend/tools/import_appsheet.py data/appsheet_export.xlsx --commit --out data/import_report.md
"""

from __future__ import annotations
# pyright: reportCallIssue=false

import argparse
import datetime as dt
import math
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

import os, sys
# Ensure the repository root is on sys.path so 'backend' package can be imported when running this file directly
_HERE = os.path.abspath(os.path.dirname(__file__))
_ROOT = os.path.abspath(os.path.join(_HERE, '..', '..'))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from backend.app import app
from backend.extensions import db
from backend.models import Customer, Equipment, Visit, ServiceLog, Material, MaterialUsage, Employee, RouteChoice, Photo


# ------------------------------ Utilities ---------------------------------

def _norm(s: str) -> str:
    """Normalize a column name for matching: lowercase, strip, replace spaces/diacritics lightly."""
    if s is None:
        return ""
    s2 = str(s).strip().lower()
    s2 = s2.replace(" ", "_")
    s2 = s2.replace("æ", "ae").replace("ø", "o").replace("å", "a")
    s2 = re.sub(r"[^a-z0-9_]+", "_", s2)
    s2 = re.sub(r"_+", "_", s2).strip("_")
    return s2


def _is_na(v: Any) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v)) or (isinstance(v, str) and v.strip() == "")


def _to_str(v: Any) -> Optional[str]:
    if _is_na(v):
        return None
    if isinstance(v, (int, float)):
        # Avoid .0 tails for integers that came as floats
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return str(v)
    return str(v).strip()


def _to_date(v: Any) -> Optional[dt.date]:
    if _is_na(v):
        return None
    if isinstance(v, dt.date) and not isinstance(v, dt.datetime):
        return v
    if isinstance(v, dt.datetime):
        return v.date()
    try:
        # pandas to_datetime handles Excel serials and strings
        d = pd.to_datetime(v, utc=False, errors="coerce", dayfirst=True)
        if pd.isna(d):
            return None
        if isinstance(d, pd.Timestamp):
            return d.to_pydatetime().date()
        if isinstance(d, dt.datetime):
            return d.date()
    except Exception:
        return None
    return None


def _to_datetime(v: Any) -> Optional[dt.datetime]:
    if _is_na(v):
        return None
    if isinstance(v, dt.datetime):
        # MySQL expects naive datetime by default
        return v.replace(tzinfo=None)
    if isinstance(v, dt.date):
        return dt.datetime.combine(v, dt.time())
    try:
        d = pd.to_datetime(v, utc=False, errors="coerce", dayfirst=True)
        if pd.isna(d):
            return None
        if isinstance(d, pd.Timestamp):
            dtv = d.to_pydatetime()
        else:
            dtv = d
        if isinstance(dtv, dt.datetime) and dtv.tzinfo is not None:
            dtv = dtv.replace(tzinfo=None)
        if isinstance(dtv, dt.date) and not isinstance(dtv, dt.datetime):
            dtv = dt.datetime.combine(dtv, dt.time())
        return dtv
    except Exception:
        return None


def _choose(*vals: Any) -> Optional[Any]:
    for v in vals:
        if not _is_na(v):
            return v
    return None


def _to_key(v: Any) -> Any:
    """Normalize possible key values: coerce floats like 79.0 to int 79; trim strings."""
    if _is_na(v):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, (int, dt.datetime, dt.date)):
        return v
    if isinstance(v, str):
        s = v.strip()
        # Try int conversion when numeric
        try:
            if re.fullmatch(r"[-+]?\d+", s):
                return int(s)
        except Exception:
            pass
        return s
    return v


# ------------------------------ Mappings -----------------------------------

CUSTOMER_COLUMNS = {
    "name": ["kundenavn", "navn", "kunde_navn"],
    "address": ["adresse"],
    "postal_code": ["postnr", "postnummer", "postkode"],
    "city": ["poststed", "by", "sted"],
    "contact_person": ["kontaktperson", "kontakt_person"],
    "phone": ["telefon", "tlf", "mobil"],
    "email": ["epost", "kunde_epost", "email"],
    "visits_per_year": [
        "antall_besok_i_aret",
        "besok_per_ar",
        "antall_besok",
        "frekvens",
        "antal_besok_pr_ar",
        "antall_besok_pr_ar",
    ],
    # Historical last-visit date in customer sheet (used to seed a Visit if needed)
    "historical_last_visit": [
        "historisk_siste_besok",
        "historisk_siste_besok_dato",
    ],
    "start_date": ["oppstart", "oppstartsdato", "startdato", "start_date"],
    # Optional identifiers
    "orig_id": ["kunde_id", "id", "row_id"],
}

EQUIPMENT_COLUMNS = {
    "orig_id": ["utstyr_id", "id"],
    "customer_name": ["tilknyttet_kunde", "kunde"],
    "type": ["type_utstyr", "type"],
    "position": ["posisjon", "plassering"],
    "installed_at": ["installert_dato", "installert", "dato"],
    "custom_type": ["egendefinert_utstyr"],
    "notes": ["plasseringsbeskrivelse", "notat", "notater"],
}

VISIT_COLUMNS = {
    "orig_id": ["besok_id", "besokid", "id", "besok_nr", "besok_nummer", "besoknummer", "besok"],
    "customer_name": ["tilknyttet_kunde", "kunde"],
    "when": ["tidspunkt", "dato", "planlagt_dato"],
    "technician": ["utfort_av", "tildelt_tekniker", "tekniker", "ansatt"],
    "notes": ["oppsummering_notat", "besoksnotater", "notat", "notater"],
}

SERVICELOG_COLUMNS = {
    "visit_orig_id": ["tilknyttet_besok_id", "besok_id"],
    "equipment_orig_id": ["tilknyttet_utstyr_id", "utstyr_id"],
    "log_date": ["dato_for_service", "dato", "tidspunkt"],
    "description": ["service_notat", "notat", "notater", "oppsummering"],
    "hours": ["timer", "hours", "timeforbruk"],
}


def _build_colmap(cols: List[str]) -> Dict[str, str]:
    ncols = {_norm(c): c for c in cols}
    return ncols


def _find_col(nmap: Dict[str, str], candidates: List[str]) -> Optional[str]:
    for cand in candidates:
        c = nmap.get(_norm(cand))
        if c:
            return c
    return None


@dataclass
class ImportStats:
    customers_created: int = 0
    customers_updated: int = 0
    equipment_created: int = 0
    visits_created: int = 0
    service_logs_created: int = 0
    materials_created: int = 0
    material_usage_created: int = 0
    employees_created: int = 0
    route_choices_created: int = 0
    photos_created: int = 0
    warnings: List[str] = field(default_factory=list)

MATERIAL_COLUMNS = {
    'orig_id': ['materiale_id', 'id'],
    'name': ['navn', 'materiale', 'material'],
    'type': ['materialtype', 'type'],
    'active': ['virkestoff'],
    'std_amount': ['standard_mengde', 'standard'],
}

MATERIAL_USAGE_COLUMNS = {
    'orig_id': ['bruk_id', 'id'],
    'service_log_orig': ['tilknyttet_servicelogg_id', 'servicelogg_id', 'logg_id'],
    'material_orig': ['benyttet_materiale', 'materiale_id'],
    'amount': ['mengde'],
}

EMPLOYEE_COLUMNS = {
    'name': ['navn'],
    'email': ['ansatt_epost', 'epost', 'email'],
    'role': ['rolle'],
}

ROUTE_COLUMNS = {
    'orig_id': ['valg_id', 'id'],
    'technician_email': ['tekniker_epost', 'ansatt_epost'],
    'customer_ref': ['valgt_kunde', 'kunde', 'tilknyttet_kunde'],
    'date': ['dato_valgt', 'dato'],
}

PHOTO_COLUMNS = {
    'orig_id': ['bilde_id', 'id'],
    'visit_orig': ['tilknyttet_besok_id', 'besok_id'],
    'image': ['bilde', 'url', 'fil'],
    'desc': ['bilde_beskrivelse', 'beskrivelse'],
}


def load_sheet(xls: pd.ExcelFile, name_options: List[str]) -> Optional[pd.DataFrame]:
    sheets = { _norm(str(n)): str(n) for n in xls.sheet_names }
    for opt in name_options:
        key = _norm(opt)
        if key in sheets:
            df = xls.parse(sheets[key])
            # Drop fully empty rows
            df = df.dropna(how="all")
            return df
    return None


def import_customers(df: pd.DataFrame, commit: bool, stats: ImportStats) -> Tuple[Dict[Any, int], Dict[str, int]]:
    colmap = _build_colmap(list(df.columns))
    c_name = _find_col(colmap, CUSTOMER_COLUMNS["name"]) or "Kundenavn"
    c_addr = _find_col(colmap, CUSTOMER_COLUMNS["address"]) or "Adresse"
    c_post = _find_col(colmap, CUSTOMER_COLUMNS["postal_code"]) or "Postnr"
    c_city = _find_col(colmap, CUSTOMER_COLUMNS["city"]) or "Poststed"
    c_contact = _find_col(colmap, CUSTOMER_COLUMNS["contact_person"]) or "Kontaktperson"
    c_phone = _find_col(colmap, CUSTOMER_COLUMNS["phone"]) or "Telefon"
    c_email = _find_col(colmap, CUSTOMER_COLUMNS["email"]) or "Epost"
    c_vpy = _find_col(colmap, CUSTOMER_COLUMNS["visits_per_year"])  # optional
    c_hist_last = _find_col(colmap, CUSTOMER_COLUMNS["historical_last_visit"])  # optional
    c_start = _find_col(colmap, CUSTOMER_COLUMNS["start_date"])  # optional
    c_orig = _find_col(colmap, CUSTOMER_COLUMNS["orig_id"])  # optional

    orig_to_id: Dict[Any, int] = {}
    name_to_id: Dict[str, int] = {}

    for _, row in df.iterrows():
        name = _to_str(row.get(c_name)) if c_name in df.columns else None
        if not name:
            continue
        address = _to_str(row.get(c_addr)) if c_addr in df.columns else None
        postal = _to_str(row.get(c_post)) if c_post in df.columns else None
        city = _to_str(row.get(c_city)) if c_city in df.columns else None
        contact = _to_str(row.get(c_contact)) if c_contact in df.columns else None
        phone = _to_str(row.get(c_phone)) if c_phone in df.columns else None
        email = _to_str(row.get(c_email)) if c_email in df.columns else None
        orig = row.get(c_orig) if c_orig and c_orig in df.columns else None
        vpy_raw = row.get(c_vpy) if c_vpy and c_vpy in df.columns else None
        vpy = None
        if not _is_na(vpy_raw):
            try:
                vpy = int(float(str(vpy_raw)))
            except Exception:
                vpy = None
        sdate = _to_date(row.get(c_start)) if c_start and c_start in df.columns else None
        # Historical last visit from customer sheet
        last_visit_dt = _to_datetime(row.get(c_hist_last)) if c_hist_last and c_hist_last in df.columns else None

        # Try find existing by name (case-insensitive)
        existing = Customer.query.filter(db.func.lower(Customer.name) == name.lower()).first()
        if existing:
            updated = False
            # Update missing fields only to avoid overwriting newer data
            if not existing.address and address:
                existing.address = address; updated = True
            if not existing.postal_code and postal:
                existing.postal_code = postal; updated = True
            if not existing.city and city:
                existing.city = city; updated = True
            if not existing.contact_person and contact:
                existing.contact_person = contact; updated = True
            if not existing.phone and phone:
                existing.phone = phone; updated = True
            if not existing.email and email:
                existing.email = email; updated = True
            if existing.visits_per_year is None and vpy is not None:
                existing.visits_per_year = vpy; updated = True
            if existing.start_date is None and sdate is not None:
                existing.start_date = sdate; updated = True
            if updated and commit:
                db.session.add(existing)
                stats.customers_updated += 1
        else:
            newc = Customer(
                name=name,
                address=address,
                postal_code=postal,
                city=city,
                contact_person=contact,
                phone=phone,
                email=email,
                visits_per_year=vpy,
                start_date=sdate,
            )
            # Add to session even in dry-run so we can flush and map IDs; final rollback cancels writes
            db.session.add(newc)
            stats.customers_created += 1
            existing = newc

        # Ensure we have IDs for mapping
        db.session.flush()
        if existing and existing.id:
            name_to_id[name.lower()] = existing.id
            if orig is not None and not (isinstance(orig, float) and math.isnan(orig)):
                orig_to_id[orig] = existing.id

        # If a historical last-visit date is provided, seed a Visit on that date if none exist for that day
        if existing and existing.id and last_visit_dt is not None:
            # Normalize to naive datetime and match by date-range to avoid duplicates on re-import
            if isinstance(last_visit_dt, dt.datetime) and last_visit_dt.tzinfo is not None:
                last_visit_dt = last_visit_dt.replace(tzinfo=None)
            day = last_visit_dt.date()
            start_dt = dt.datetime.combine(day, dt.time.min)
            end_dt = dt.datetime.combine(day, dt.time.max)
            already = (
                Visit.query
                .filter(Visit.customer_id == existing.id)
                .filter(Visit.visit_date >= start_dt, Visit.visit_date <= end_dt)
                .first()
            )
            if not already:
                v = Visit(
                    customer_id=existing.id,
                    visit_date=dt.datetime.combine(day, dt.time(hour=12)),
                    technician=None,
                    notes="Historisk siste besøk (import)",
                )
                db.session.add(v)
                stats.visits_created += 1

    return orig_to_id, name_to_id


def import_equipment(df: pd.DataFrame, commit: bool, stats: ImportStats, customer_by_name: Dict[str, int], customer_by_orig: Dict[Any, int]) -> Dict[Any, int]:
    colmap = _build_colmap(list(df.columns))
    c_orig = _find_col(colmap, EQUIPMENT_COLUMNS["orig_id"]) or "Utstyr_ID"
    c_cust = _find_col(colmap, EQUIPMENT_COLUMNS["customer_name"]) or "Tilknyttet_Kunde"
    c_type = _find_col(colmap, EQUIPMENT_COLUMNS["type"]) or "Type_utstyr"
    c_pos = _find_col(colmap, EQUIPMENT_COLUMNS["position"]) or "Posisjon"
    c_inst = _find_col(colmap, EQUIPMENT_COLUMNS["installed_at"]) or "Installert_Dato"
    c_custom = _find_col(colmap, EQUIPMENT_COLUMNS["custom_type"]) or "Egendefinert_utstyr"
    c_notes = _find_col(colmap, EQUIPMENT_COLUMNS["notes"]) or "Plasseringsbeskrivelse"

    eq_orig_to_id: Dict[Any, int] = {}

    for _, row in df.iterrows():
        cust_raw = row.get(c_cust) if c_cust in df.columns else None
        cust_name = _to_str(cust_raw)
        cust_id = None
        if cust_name:
            cust_id = customer_by_name.get(cust_name.lower())
        if not cust_id:
            # Try resolve by original id map
            cust_id = customer_by_orig.get(_to_key(cust_raw))
        if not cust_id:
            stats.warnings.append(f"Equipment refers to unknown customer '{cust_raw}'; skipped")
            continue

        typ = _to_str(row.get(c_type)) if c_type in df.columns else None
        pos = _to_str(row.get(c_pos)) if c_pos in df.columns else None
        installed = _to_date(row.get(c_inst)) if c_inst in df.columns else None
        custom = _to_str(row.get(c_custom)) if c_custom in df.columns else None
        notes = _choose(_to_str(row.get(c_notes)), pos, custom)
        orig = row.get(c_orig) if c_orig and c_orig in df.columns else None

        name_parts = [p for p in [typ, pos, custom] if p]
        name = " - ".join(name_parts) if name_parts else (typ or pos or "Utstyr")

        eq = Equipment(
            customer_id=cust_id,
            name=name[:100] if name else "Utstyr",
            type=typ,
            serial_number=None,
            installed_at=installed,
            notes=notes,
        )
        db.session.add(eq)
        db.session.flush()
        if eq.id:
            if orig is not None and not (isinstance(orig, float) and math.isnan(orig)):
                eq_orig_to_id[orig] = eq.id

        stats.equipment_created += 1

    return eq_orig_to_id


def import_visits(df: pd.DataFrame, commit: bool, stats: ImportStats, customer_by_name: Dict[str, int], customer_by_orig: Dict[Any, int]) -> Dict[Any, int]:
    colmap = _build_colmap(list(df.columns))
    c_orig = _find_col(colmap, VISIT_COLUMNS["orig_id"]) or "Besøk_ID"
    c_cust = _find_col(colmap, VISIT_COLUMNS["customer_name"]) or "Tilknyttet_Kunde"
    c_when = _find_col(colmap, VISIT_COLUMNS["when"]) or "Tidspunkt"
    c_tech = _find_col(colmap, VISIT_COLUMNS["technician"]) or "Utført_av"
    c_notes = _find_col(colmap, VISIT_COLUMNS["notes"]) or "Oppsummering_Notat"

    visit_orig_to_id: Dict[Any, int] = {}
    # Track placeholder customers we create during this phase so repeated refs reuse same row
    placeholder_by_orig: Dict[Any, int] = {}

    for _, row in df.iterrows():
        cust_raw = row.get(c_cust) if c_cust in df.columns else None
        cust_name = _to_str(cust_raw)
        cust_id = None
        if cust_name:
            cust_id = customer_by_name.get(cust_name.lower())
        if not cust_id:
            # Try original-ID map first
            key = _to_key(cust_raw)
            cust_id = customer_by_orig.get(key)
        if not cust_id:
            # Create a placeholder customer so we don't lose the visit
            key = _to_key(cust_raw)
            if key in placeholder_by_orig:
                cust_id = placeholder_by_orig[key]
            else:
                placeholder_name = f"Imported Customer #{key}" if key is not None else "Imported Customer (unknown)"
                new_customer = Customer(name=placeholder_name)
                db.session.add(new_customer)
                db.session.flush()
                cust_id = new_customer.id
                placeholder_by_orig[key] = cust_id
                stats.customers_created += 1

        raw_when = row.get(c_when) if c_when in df.columns else None
        # Skip rows with no customer and no date entirely
        if cust_id is None and (raw_when is None or (hasattr(pd, 'isna') and pd.isna(raw_when))):
            continue
        when = _to_datetime(raw_when)
        # Guard against pandas NaT sneaking through
        try:
            if hasattr(pd, 'isna') and pd.isna(when):
                when = None
        except Exception:
            pass
        if not isinstance(when, dt.datetime):
            when = dt.datetime.combine(dt.date.today(), dt.time(hour=12))
        tech = _to_str(row.get(c_tech)) if c_tech in df.columns else None
        notes = _to_str(row.get(c_notes)) if c_notes in df.columns else None
        orig = row.get(c_orig) if c_orig and c_orig in df.columns else None

        v = Visit(customer_id=cust_id, visit_date=when, technician=tech, notes=notes)
        db.session.add(v)
        db.session.flush()
        if v.id:
            if orig is not None and not (isinstance(orig, float) and math.isnan(orig)):
                visit_orig_to_id[orig] = v.id

        stats.visits_created += 1

    return visit_orig_to_id


def import_service_logs(df: pd.DataFrame, commit: bool, stats: ImportStats, visit_by_orig: Dict[Any, int], eq_by_orig: Dict[Any, int]):
    colmap = _build_colmap(list(df.columns))
    c_visit = _find_col(colmap, SERVICELOG_COLUMNS["visit_orig_id"]) or "Tilknyttet_Besøk_ID"
    c_eq = _find_col(colmap, SERVICELOG_COLUMNS["equipment_orig_id"]) or "Tilknyttet_Utstyr_ID"
    c_date = _find_col(colmap, SERVICELOG_COLUMNS["log_date"]) or "Dato_for_Service"
    c_desc = _find_col(colmap, SERVICELOG_COLUMNS["description"]) or "Service_Notat"
    c_hours = _find_col(colmap, SERVICELOG_COLUMNS["hours"])  # optional

    for _, row in df.iterrows():
        vo = row.get(c_visit) if c_visit in df.columns else None
        eo = row.get(c_eq) if c_eq in df.columns else None
        visit_id = visit_by_orig.get(_to_key(vo))
        eq_id = eq_by_orig.get(_to_key(eo))
        if not visit_id or not eq_id:
            # Only import logs we can link to both a visit and equipment
            continue

        log_date = _to_datetime(row.get(c_date)) if c_date in df.columns else None
        if log_date is not None and hasattr(pd, 'isna') and pd.isna(log_date):
            log_date = None
        desc = _to_str(row.get(c_desc)) if c_desc in df.columns else None
        hrs_raw = row.get(c_hours) if c_hours and c_hours in df.columns else None
        hours = None
        if not _is_na(hrs_raw) and isinstance(hrs_raw, (int, float, str)):
            try:
                hours = float(hrs_raw)
            except Exception:
                hours = None

        sl = ServiceLog(
            visit_id=visit_id,
            equipment_id=eq_id,
            log_date=log_date,
            description=desc or "",
            hours_worked=hours,
        )
        db.session.add(sl)
        stats.service_logs_created += 1


def import_materials(df: pd.DataFrame, commit: bool, stats: ImportStats) -> Dict[Any, int]:
    colmap = _build_colmap(list(df.columns))
    c_orig = _find_col(colmap, MATERIAL_COLUMNS['orig_id']) or 'Materiale_ID'
    c_name = _find_col(colmap, MATERIAL_COLUMNS['name']) or 'Navn'
    c_type = _find_col(colmap, MATERIAL_COLUMNS['type']) or 'Materialtype'
    c_active = _find_col(colmap, MATERIAL_COLUMNS['active']) or 'Virkestoff'
    c_std = _find_col(colmap, MATERIAL_COLUMNS['std_amount']) or 'Standard_Mengde'

    orig_to_id: Dict[Any, int] = {}
    for _, row in df.iterrows():
        name = _to_str(row.get(c_name)) if c_name in df.columns else None
        if not name:
            continue
        std_raw = row.get(c_std) if c_std in df.columns else None
        std_val = None
        if not _is_na(std_raw) and isinstance(std_raw, (int, float, str)):
            try:
                std_val = float(std_raw)
            except Exception:
                std_val = None
        item = Material(
            name=name,
            material_type=_to_str(row.get(c_type)) if c_type in df.columns else None,
            active_ingredient=_to_str(row.get(c_active)) if c_active in df.columns else None,
            standard_amount=std_val,
        )
        db.session.add(item)
        db.session.flush()
        stats.materials_created += 1
        orig = row.get(c_orig) if c_orig and c_orig in df.columns else None
        if item.id and orig is not None and not (isinstance(orig, float) and math.isnan(orig)):
            orig_to_id[orig] = item.id
    return orig_to_id


def import_material_usage(df: pd.DataFrame, commit: bool, stats: ImportStats, sl_by_orig: Dict[Any, int], mat_by_orig: Dict[Any, int]):
    colmap = _build_colmap(list(df.columns))
    c_orig = _find_col(colmap, MATERIAL_USAGE_COLUMNS['orig_id']) or 'Bruk_ID'
    c_sl = _find_col(colmap, MATERIAL_USAGE_COLUMNS['service_log_orig']) or 'Tilknyttet_Servicelogg_ID'
    c_mat = _find_col(colmap, MATERIAL_USAGE_COLUMNS['material_orig']) or 'Benyttet_Materiale'
    c_amt = _find_col(colmap, MATERIAL_USAGE_COLUMNS['amount']) or 'Mengde'

    for _, row in df.iterrows():
        sl_id = sl_by_orig.get(_to_key(row.get(c_sl))) if c_sl in df.columns else None
        mat_id = mat_by_orig.get(_to_key(row.get(c_mat))) if c_mat in df.columns else None
        if not sl_id or not mat_id:
            continue
        amt = None
        raw = row.get(c_amt) if c_amt in df.columns else None
        if not _is_na(raw) and isinstance(raw, (int, float, str)):
            try:
                amt = float(raw)
            except Exception:
                amt = None
        mu = MaterialUsage(service_log_id=sl_id, material_id=mat_id, amount=amt)
        db.session.add(mu)
        stats.material_usage_created += 1


def import_employees(df: pd.DataFrame, commit: bool, stats: ImportStats):
    colmap = _build_colmap(list(df.columns))
    c_name = _find_col(colmap, EMPLOYEE_COLUMNS['name']) or 'Navn'
    c_email = _find_col(colmap, EMPLOYEE_COLUMNS['email']) or 'Ansatt_Epost'
    c_role = _find_col(colmap, EMPLOYEE_COLUMNS['role']) or 'Rolle'
    for _, row in df.iterrows():
        name = _to_str(row.get(c_name)) if c_name in df.columns else None
        email = _to_str(row.get(c_email)) if c_email in df.columns else None
        role = _to_str(row.get(c_role)) if c_role in df.columns else None
        if not name and not email:
            continue
        existing = None
        if email:
            existing = Employee.query.filter(Employee.email == email).first()
        if existing is None and name:
            existing = Employee.query.filter(db.func.lower(Employee.name) == name.lower()).first()
        if existing:
            updated = False
            if not existing.name and name:
                existing.name = name; updated = True
            if not existing.email and email:
                existing.email = email; updated = True
            if (not existing.role) and role:
                existing.role = role; updated = True
            if updated and commit:
                db.session.add(existing)
        else:
            emp = Employee(name=name or '', email=email, role=role)
            db.session.add(emp)
            stats.employees_created += 1


def import_route_choices(df: pd.DataFrame, commit: bool, stats: ImportStats, cust_by_name: Dict[str, int], cust_by_orig: Dict[Any, int]):
    colmap = _build_colmap(list(df.columns))
    c_email = _find_col(colmap, ROUTE_COLUMNS['technician_email']) or 'Tekniker_Epost'
    c_cust = _find_col(colmap, ROUTE_COLUMNS['customer_ref']) or 'Valgt_Kunde'
    c_date = _find_col(colmap, ROUTE_COLUMNS['date']) or 'Dato_Valgt'
    for _, row in df.iterrows():
        cust_raw = row.get(c_cust) if c_cust in df.columns else None
        cust_id = None
        name = _to_str(cust_raw)
        if name:
            cust_id = cust_by_name.get(name.lower())
        if not cust_id:
            cust_id = cust_by_orig.get(_to_key(cust_raw))
        rc = RouteChoice(
            technician_email=_to_str(row.get(c_email)) if c_email in df.columns else None,
            customer_id=cust_id,
            selected_date=_to_date(row.get(c_date)) if c_date in df.columns else None,
        )
        db.session.add(rc)
        stats.route_choices_created += 1


def import_photos(df: pd.DataFrame, commit: bool, stats: ImportStats, visit_by_orig: Dict[Any, int]):
    colmap = _build_colmap(list(df.columns))
    c_visit = _find_col(colmap, PHOTO_COLUMNS['visit_orig']) or 'Tilknyttet_Besøk_ID'
    c_img = _find_col(colmap, PHOTO_COLUMNS['image']) or 'Bilde'
    c_desc = _find_col(colmap, PHOTO_COLUMNS['desc']) or 'Bilde_Beskrivelse'
    for _, row in df.iterrows():
        visit_id = visit_by_orig.get(_to_key(row.get(c_visit))) if c_visit in df.columns else None
        if not visit_id:
            continue
        p = Photo(
            visit_id=visit_id,
            image_url=_to_str(row.get(c_img)) if c_img in df.columns else None,
            description=_to_str(row.get(c_desc)) if c_desc in df.columns else None,
        )
        db.session.add(p)
        stats.photos_created += 1


def write_report(path: Optional[str], stats: ImportStats):
    if not path:
        return
    lines = []
    lines.append("# Import report\n")
    lines.append(f"Date: {dt.datetime.now().isoformat()}\n")
    lines.append("\n## Summary\n")
    lines.append(f"- Customers created: {stats.customers_created}\n")
    lines.append(f"- Customers updated: {stats.customers_updated}\n")
    lines.append(f"- Equipment created: {stats.equipment_created}\n")
    lines.append(f"- Visits created: {stats.visits_created}\n")
    lines.append(f"- Service logs created: {stats.service_logs_created}\n")
    lines.append(f"- Materials created: {stats.materials_created}\n")
    lines.append(f"- Material usage created: {stats.material_usage_created}\n")
    lines.append(f"- Employees created: {stats.employees_created}\n")
    lines.append(f"- Route choices created: {stats.route_choices_created}\n")
    lines.append(f"- Photos created: {stats.photos_created}\n")
    lines.append(f"- Materials created: {stats.materials_created}\n")
    lines.append(f"- Material usage created: {stats.material_usage_created}\n")
    lines.append(f"- Employees created: {stats.employees_created}\n")
    lines.append(f"- Route choices created: {stats.route_choices_created}\n")
    lines.append(f"- Photos created: {stats.photos_created}\n")
    if stats.warnings:
        lines.append("\n## Warnings\n")
        for w in stats.warnings:
            lines.append(f"- {w}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)


def main():
    parser = argparse.ArgumentParser(description="Import AppSheet Excel export into the database")
    parser.add_argument("input", help="Path to Excel export (XLSX)")
    parser.add_argument("--out", dest="out", help="Optional path to write a markdown report")
    parser.add_argument("--commit", action="store_true", help="Actually write to the database (default is dry-run)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of rows per sheet to import (for testing)")
    args = parser.parse_args()

    stats = ImportStats()

    with app.app_context():
        xls = pd.ExcelFile(args.input)

        # Customers
        kunder = load_sheet(xls, ["Kunder", "Kunde", "Customers"])
        orig_cust_map: Dict[Any, int] = {}
        name_cust_map: Dict[str, int] = {}
        if kunder is not None and not kunder.empty:
            if args.limit:
                kunder = kunder.head(args.limit)
            orig_cust_map, name_cust_map = import_customers(kunder, args.commit, stats)

        # Equipment
        utstyr = load_sheet(xls, ["Utstyr", "Utstyrs", "Equipment"])
        eq_map: Dict[Any, int] = {}
        if utstyr is not None and not utstyr.empty:
            if args.limit:
                utstyr = utstyr.head(args.limit)
            eq_map = import_equipment(utstyr, args.commit, stats, name_cust_map, orig_cust_map)

        # Visits
        besok = load_sheet(xls, ["Besøk", "Besok", "Visits"])
        visit_map: Dict[Any, int] = {}
        if besok is not None and not besok.empty:
            if args.limit:
                besok = besok.head(args.limit)
            visit_map = import_visits(besok, args.commit, stats, name_cust_map, orig_cust_map)

        # Service logs
        slogs = load_sheet(xls, ["Servicelogg", "ServiceLog", "Service Logs"])
        if slogs is not None and not slogs.empty:
            if args.limit:
                slogs = slogs.head(args.limit)
            import_service_logs(slogs, args.commit, stats, visit_map, eq_map)
        # Materials
        mats = load_sheet(xls, ["Materialer", "Materials"])
        mat_map: Dict[Any, int] = {}
        if mats is not None and not mats.empty:
            if args.limit:
                mats = mats.head(args.limit)
            mat_map = import_materials(mats, args.commit, stats)
        # Material usage
        mbruk = load_sheet(xls, ["Materialbruk", "Material Usage"])
        if mbruk is not None and not mbruk.empty:
            if args.limit:
                mbruk = mbruk.head(args.limit)
            # Build mapping from service log original IDs using slogs if it has Logg_ID
            sl_orig_to_id: Dict[Any, int] = {}
            if slogs is not None and not slogs.empty:
                colmap_sl = _build_colmap(list(slogs.columns))
                c_logid = _find_col(colmap_sl, ['logg_id', 'id']) or 'Logg_ID'
                if c_logid in slogs.columns:
                    tmp_visit = _find_col(colmap_sl, SERVICELOG_COLUMNS['visit_orig_id']) or 'Tilknyttet_Besøk_ID'
                    tmp_eq = _find_col(colmap_sl, SERVICELOG_COLUMNS['equipment_orig_id']) or 'Tilknyttet_Utstyr_ID'
                    tmp_date = _find_col(colmap_sl, SERVICELOG_COLUMNS['log_date']) or 'Dato_for_Service'
                    tmp_desc = _find_col(colmap_sl, SERVICELOG_COLUMNS['description']) or 'Service_Notat'
                    db_slogs = ServiceLog.query.all()
                    for _, row in slogs.iterrows():
                        orig = row.get(c_logid)
                        vo = visit_map.get(_to_key(row.get(tmp_visit))) if tmp_visit in slogs.columns else None
                        eo = eq_map.get(_to_key(row.get(tmp_eq))) if tmp_eq in slogs.columns else None
                        d = _to_datetime(row.get(tmp_date)) if tmp_date in slogs.columns else None
                        desc = _to_str(row.get(tmp_desc)) if tmp_desc in slogs.columns else None
                        match = next((s for s in db_slogs if s.visit_id == vo and s.equipment_id == eo and ((s.log_date or None) == (d or None)) and (s.description or '') == (desc or '')), None)
                        if match and orig is not None and not (isinstance(orig, float) and math.isnan(orig)):
                            sl_orig_to_id[orig] = match.id
            if sl_orig_to_id:
                import_material_usage(mbruk, args.commit, stats, sl_orig_to_id, mat_map)
        # Employees
        ansatte = load_sheet(xls, ["Ansatte", "Employees"])
        if ansatte is not None and not ansatte.empty:
            if args.limit:
                ansatte = ansatte.head(args.limit)
            import_employees(ansatte, args.commit, stats)
        # Routes
        rute = load_sheet(xls, ["Rutevalg", "Routes"])
        if rute is not None and not rute.empty:
            if args.limit:
                rute = rute.head(args.limit)
            import_route_choices(rute, args.commit, stats, name_cust_map, orig_cust_map)
        # Photos
        bilder = load_sheet(xls, ["Bilder", "Photos"])
        if bilder is not None and not bilder.empty:
            if args.limit:
                bilder = bilder.head(args.limit)
            import_photos(bilder, args.commit, stats, visit_map)

        if args.commit:
            db.session.commit()
        else:
            db.session.rollback()

    write_report(args.out, stats)
    # Console summary
    print("Import complete (commit=" + str(args.commit) + ")")
    print(f"Customers: +{stats.customers_created}, updated {stats.customers_updated}")
    print(f"Equipment: +{stats.equipment_created}")
    print(f"Visits: +{stats.visits_created}")
    print(f"Service logs: +{stats.service_logs_created}")
    print(f"Materials: +{stats.materials_created}")
    print(f"Material usage: +{stats.material_usage_created}")
    print(f"Employees: +{stats.employees_created}")
    print(f"Route choices: +{stats.route_choices_created}")
    print(f"Photos: +{stats.photos_created}")
    if stats.warnings:
        print(f"Warnings: {len(stats.warnings)} (see report)")


if __name__ == "__main__":
    main()
