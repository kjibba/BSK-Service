import argparse
import os
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Tuple

import pandas as pd


def load_input(path: str) -> Dict[str, pd.DataFrame]:
    ext = os.path.splitext(path)[1].lower()
    tables: Dict[str, pd.DataFrame] = {}
    if ext in {'.xlsx', '.xls'}:
        x = pd.ExcelFile(path)
        for sheet in x.sheet_names:
            df = x.parse(sheet)
            tables[str(sheet).strip()] = df
    elif ext == '.csv':
        name = os.path.basename(path).rsplit('.', 1)[0]
        tables[name] = pd.read_csv(path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    return tables


def is_datetime_series(s: pd.Series) -> bool:
    try:
        pd.to_datetime(s.dropna().head(50), errors='raise')
        return True
    except Exception:
        return False


def is_date_series(s: pd.Series) -> bool:
    if not is_datetime_series(s):
        return False
    # If values look like dates (no time component) for a sample
    try:
        dt = pd.to_datetime(s.dropna().head(50))
        return all(x.hour == 0 and x.minute == 0 and x.second == 0 for x in dt)
    except Exception:
        return False


def candidate_pk(df: pd.DataFrame, table_name: str) -> Optional[str]:
    cols = [c for c in df.columns if df[c].notna().any()]
    preferred = [
        'id', f'{table_name.lower()}_id', 'key', 'rowid', 'row_id', 'uuid'
    ]
    for c in cols:
        if c.lower() in preferred:
            if df[c].notna().sum() == len(df) and df[c].nunique(dropna=True) == len(df):
                return c
    # Fallback: any column unique and non-null across rows
    for c in cols:
        if df[c].notna().sum() == len(df) and df[c].nunique(dropna=True) == len(df):
            return c
    return None


def candidate_fks(tables: Dict[str, pd.DataFrame], pks: Dict[str, Optional[str]]) -> Dict[Tuple[str, str], Tuple[str, str]]:
    """
    Returns mapping: (table, column) -> (ref_table, ref_pk)
    """
    result: Dict[Tuple[str, str], Tuple[str, str]] = {}
    # Simple heuristic: *_id columns that match another table's PK name or table name
    for tname, df in tables.items():
        for col in df.columns:
            col_l = col.lower()
            if col_l.endswith('_id'):
                base = col_l[:-3]
                # exact table match
                for rt in tables.keys():
                    pk = pks.get(rt)
                    if not pk:
                        continue
                    if rt.lower() == base or pk.lower() == col_l:
                        result[(tname, col)] = (rt, pk)
                        break
    return result


def small_cardinality_strings(s: pd.Series, max_unique: int = 20) -> Optional[List[str]]:
    if s.dropna().empty:
        return None
    if s.dtype == object:
        vals = [str(x).strip() for x in s.dropna().tolist()]
        uniq = sorted(set(vals))
        if 0 < len(uniq) <= max_unique:
            return uniq
    return None


def analyze(path: str) -> str:
    tables = load_input(path)
    report: List[str] = []
    report.append(f"# AppSheet schema analysis\n")
    report.append(f"Source file: {os.path.basename(path)}\n")

    # Basic stats per table
    pks: Dict[str, Optional[str]] = {}
    for name, df in tables.items():
        pks[name] = candidate_pk(df, name)

    fks = candidate_fks(tables, pks)

    for name, df in tables.items():
        report.append(f"## Table: {name}\n")
        report.append(f"Rows: {len(df)} | Columns: {len(df.columns)}\n")
        pk = pks.get(name)
        report.append(f"- Candidate PK: {pk or 'None'}\n")
        # Columns overview
        report.append("- Columns:\n")
        for col in df.columns:
            col_line = f"  - {col}"
            # types
            flags = []
            if is_datetime_series(df[col]):
                flags.append('datetime')
            elif is_date_series(df[col]):
                flags.append('date')
            enum_vals = small_cardinality_strings(df[col])
            if enum_vals:
                flags.append(f"enum({min(len(enum_vals), 5)} shown)")
            if (name, col) in fks:
                rt, rpk = fks[(name, col)]
                flags.append(f"FK -> {rt}({rpk})")
            if flags:
                col_line += f" [{' ,'.join(flags)}]"
            report.append(col_line + "\n")
        report.append("\n")

    # Summarize relationships
    report.append("## Relationships\n")
    for (t, c), (rt, rpk) in fks.items():
        report.append(f"- {t}.{c} -> {rt}.{rpk} (many-to-one)\n")

    # Endpoint suggestions
    report.append("\n## Suggested endpoints\n")
    for name in tables.keys():
        slug = name.strip().lower().replace(' ', '_')
        report.append(f"- GET /api/{slug} | POST /api/{slug} | GET/PUT/DELETE /api/{slug}/<id>\n")

    return ''.join(report)


def main():
    ap = argparse.ArgumentParser(description='Analyze AppSheet-exported sheet (XLSX/CSV) to infer schema and endpoints')
    ap.add_argument('path', help='Path to .xlsx/.xls or .csv file')
    ap.add_argument('--out', help='Write Markdown report to this path')
    args = ap.parse_args()

    rep = analyze(args.path)
    if args.out:
        os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(rep)
    print(rep)


if __name__ == '__main__':
    main()
