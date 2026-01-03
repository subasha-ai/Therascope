# TheraScope Weekly Reports

## 📊 Report Types

### 1. DOR Reports (17 individual PDFs)
- One PDF per facility
- Shows facility performance vs goals
- DOR-specific metrics (Med B Units, Units Per Visit)
- 4-week trend

### 2. Admin Report (1 PDF)
- Regional breakdown (Golden Coast & Overland)
- All 17 facilities
- Company-wide summary
- Totals and averages

---

## 🚀 How To Generate Reports

### Weekly Process:
```bash
python3 generate_weekly_reports.py
```

This creates:
- `Weekly_Reports_Week_XXXX.zip` containing:
  - 17 DOR PDFs (one per facility)
  - 1 Admin PDF (regional summary)

### What You Get:
- **DOR PDFs**: Email individually to each DOR
- **Admin PDF**: For your weekly review

---

## 📅 Workflow

**Every Week (after Saturday close):**
1. Export 6 NetHealth reports
2. Run `python3 process_nethealth_reports.py [6 files]`
3. Upload `facility_data_nethealth.json` to GitHub as `src/facility_data.json`
4. Run `python3 generate_weekly_reports.py`
5. Download ZIP file
6. Email reports to DORs
7. Review Admin report

---

## 📧 Email Distribution

**DOR Reports** → Email to each facility's DOR
**Admin Report** → Keep for your records

