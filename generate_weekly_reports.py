#!/usr/bin/env python3
"""
TheraScope Weekly Report Generator
Generates PDF reports for DORs and Admins
"""

import json
import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
import zipfile


def create_styles():
    """Create reusable PDF styles"""
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#0891B2'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#475569'),
        spaceAfter=20,
        alignment=TA_CENTER
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#0891B2'),
        spaceAfter=12,
        fontName='Helvetica-Bold'
    )

    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER,
        fontName='Helvetica-Oblique'
    )

    return title_style, subtitle_style, heading_style, footer_style


def generate_dor_report(facility_data, facility_history, output_path):
    """Generate PDF report for a single DOR/facility"""
    
    doc = SimpleDocTemplate(output_path, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    
    title_style, subtitle_style, heading_style, footer_style = create_styles()
    
    # Header
    elements.append(Paragraph("TheraScope", title_style))
    elements.append(Paragraph("Weekly Performance Report", subtitle_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Facility and Date Info
    info_data = [
        ['Facility:', facility_data['facility']],
        ['Report Week:', facility_data['date']],
        ['Report Generated:', datetime.now().strftime('%B %d, %Y')]
    ]
    info_table = Table(info_data, colWidths=[2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Performance Metrics
    elements.append(Paragraph("Performance Metrics", heading_style))
    
    med_b_pct = int((facility_data['medBCaseload']/facility_data['medBEligible'])*100) if facility_data['medBEligible'] > 0 else 0
    
    metrics_data = [
        ['Metric', 'Your Result', 'Goal', 'Status'],
        ['Productivity', f"{facility_data['productivity']}%", '≥84%', '✓ Met' if facility_data['productivity'] >= 84 else '✗ Not Met'],
        ['CPM', f"${facility_data['cpm']}", '≤$1.45', '✓ Met' if facility_data['cpm'] <= 1.45 else '✗ Not Met'],
        ['Med B Performance', f"{med_b_pct}%", '', ''],
    ]
    
    metrics_table = Table(metrics_data, colWidths=[2.2*inch, 1.5*inch, 1.2*inch, 1.3*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0891B2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # DOR-Specific Metrics
    elements.append(Paragraph("DOR-Specific Metrics", heading_style))
    
    dor_metrics_data = [
        ['Metric', 'This Week'],
        ['Med B Units Billed', str(facility_data.get('medBUnitsThisWeek', 'N/A'))],
        ['Units Per Visit', str(facility_data.get('unitsPerVisit', 'N/A'))],
        ['Mode of Treatment', f"{facility_data.get('modeOfTreatment', 0)}%"],
    ]
    
    dor_table = Table(dor_metrics_data, colWidths=[3.5*inch, 2.7*inch])
    dor_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(dor_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # 4-Week Trend
    if len(facility_history) > 0:
        elements.append(Paragraph("4-Week Trend", heading_style))
        
        trend_data = [['Week', 'Productivity', 'CPM', 'Med B Caseload']]
        for record in facility_history[-4:]:
            trend_data.append([
                record['date'],
                f"{record['productivity']}%",
                f"${record['cpm']}",
                str(record['medBCaseload'])
            ])
        
        trend_table = Table(trend_data, colWidths=[1.8*inch, 1.5*inch, 1.2*inch, 1.7*inch])
        trend_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#14b8a6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f1f5f9')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(trend_table)
        elements.append(Spacer(1, 0.4*inch))
    
    # Footer
    footer_text = "<i>This report is confidential and intended for the Director of Rehab only. For questions or support, please contact your regional manager.</i>"
    elements.append(Paragraph(footer_text, footer_style))
    
    doc.build(elements)


def generate_admin_report(latest_week_data, output_path):
    """Generate weekly admin report with regional breakdown"""
    
    # Split by region
    golden_coast = sorted([r for r in latest_week_data if r['region'] == 'Golden Coast'], key=lambda x: x['facility'])
    overland = sorted([r for r in latest_week_data if r['region'] == 'Overland'], key=lambda x: x['facility'])
    
    doc = SimpleDocTemplate(output_path, pagesize=landscape(letter), topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    
    title_style, subtitle_style, heading_style, footer_style = create_styles()
    
    admin_subtitle = ParagraphStyle('AdminSubtitle', parent=subtitle_style, fontSize=18)
    
    # Header
    elements.append(Paragraph("TheraScope", title_style))
    elements.append(Paragraph("Weekly Admin Performance Report", admin_subtitle))
    
    # Report Info
    week_date = latest_week_data[0]['date'] if latest_week_data else 'N/A'
    info_data = [
        ['Report Week:', week_date],
        ['Generated:', datetime.now().strftime('%B %d, %Y at %I:%M %p')],
        ['Total Facilities:', str(len(latest_week_data))]
    ]
    info_table = Table(info_data, colWidths=[2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Golden Coast Region
    gc_heading = ParagraphStyle('GCHeading', parent=heading_style, fontSize=16, textColor=colors.HexColor('#d97706'))
    elements.append(Paragraph("Golden Coast Region", gc_heading))
    
    gc_data = [['Facility', 'Productivity', 'CPM', 'Med B Eligible', 'Med B Caseload', 'Med B Units']]
    for facility in golden_coast:
        gc_data.append([
            facility['facility'],
            f"{facility['productivity']}%",
            f"${facility['cpm']}",
            str(facility['medBEligible']),
            str(facility['medBCaseload']),
            str(facility.get('medBUnitsThisWeek', 'N/A'))
        ])
    
    # Totals
    total_eligible_gc = sum([f['medBEligible'] for f in golden_coast])
    total_caseload_gc = sum([f['medBCaseload'] for f in golden_coast])
    total_units_gc = sum([f.get('medBUnitsThisWeek', 0) for f in golden_coast])
    avg_prod_gc = round(sum([f['productivity'] for f in golden_coast]) / len(golden_coast), 1) if golden_coast else 0
    avg_cpm_gc = round(sum([f['cpm'] for f in golden_coast]) / len(golden_coast), 2) if golden_coast else 0
    
    gc_data.append(['TOTALS / AVERAGES', f"{avg_prod_gc}%", f"${avg_cpm_gc}", str(total_eligible_gc), str(total_caseload_gc), str(total_units_gc)])
    
    gc_table = Table(gc_data, colWidths=[2.5*inch, 1.2*inch, 1*inch, 1.3*inch, 1.3*inch, 1.2*inch])
    gc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d97706')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTSIZE', (0, 1), (-1, -2), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#fef3c7')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d97706')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fbbf24')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
    ]))
    elements.append(gc_table)
    elements.append(Spacer(1, 0.4*inch))
    
    # Overland Region
    ov_heading = ParagraphStyle('OVHeading', parent=heading_style, fontSize=16, textColor=colors.HexColor('#3b82f6'))
    elements.append(Paragraph("Overland Region", ov_heading))
    
    ov_data = [['Facility', 'Productivity', 'CPM', 'Med B Eligible', 'Med B Caseload', 'Med B Units']]
    for facility in overland:
        ov_data.append([
            facility['facility'],
            f"{facility['productivity']}%",
            f"${facility['cpm']}",
            str(facility['medBEligible']),
            str(facility['medBCaseload']),
            str(facility.get('medBUnitsThisWeek', 'N/A'))
        ])
    
    # Totals
    total_eligible_ov = sum([f['medBEligible'] for f in overland])
    total_caseload_ov = sum([f['medBCaseload'] for f in overland])
    total_units_ov = sum([f.get('medBUnitsThisWeek', 0) for f in overland])
    avg_prod_ov = round(sum([f['productivity'] for f in overland]) / len(overland), 1) if overland else 0
    avg_cpm_ov = round(sum([f['cpm'] for f in overland]) / len(overland), 2) if overland else 0
    
    ov_data.append(['TOTALS / AVERAGES', f"{avg_prod_ov}%", f"${avg_cpm_ov}", str(total_eligible_ov), str(total_caseload_ov), str(total_units_ov)])
    
    ov_table = Table(ov_data, colWidths=[2.5*inch, 1.2*inch, 1*inch, 1.3*inch, 1.3*inch, 1.2*inch])
    ov_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTSIZE', (0, 1), (-1, -2), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#dbeafe')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#3b82f6')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#60a5fa')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 11),
    ]))
    elements.append(ov_table)
    elements.append(Spacer(1, 0.4*inch))
    
    # Company-Wide Summary
    summary_heading = ParagraphStyle('SummaryHeading', parent=heading_style, fontSize=16, textColor=colors.HexColor('#14b8a6'))
    elements.append(Paragraph("Company-Wide Summary", summary_heading))
    
    summary_data = [
        ['Metric', 'Golden Coast', 'Overland', 'Total / Average'],
        ['Facilities', str(len(golden_coast)), str(len(overland)), str(len(latest_week_data))],
        ['Avg Productivity', f"{avg_prod_gc}%", f"{avg_prod_ov}%", f"{round((avg_prod_gc + avg_prod_ov) / 2, 1)}%"],
        ['Avg CPM', f"${avg_cpm_gc}", f"${avg_cpm_ov}", f"${round((avg_cpm_gc + avg_cpm_ov) / 2, 2)}"],
        ['Total Med B Eligible', str(total_eligible_gc), str(total_eligible_ov), str(total_eligible_gc + total_eligible_ov)],
        ['Total Med B Caseload', str(total_caseload_gc), str(total_caseload_ov), str(total_caseload_gc + total_caseload_ov)],
        ['Total Med B Units', str(total_units_gc), str(total_units_ov), str(total_units_gc + total_units_ov)],
    ]
    
    summary_table = Table(summary_data, colWidths=[2.5*inch, 1.8*inch, 1.8*inch, 1.8*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#14b8a6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ccfbf1')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#14b8a6')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
    ]))
    elements.append(summary_table)
    
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph("<i>Confidential - For Administrative Use Only</i>", footer_style))
    
    doc.build(elements)


def main():
    """Generate all weekly reports"""
    
    print("="*80)
    print("THERASCOPE WEEKLY REPORT GENERATOR")
    print("="*80)
    
    # Load data
    data_file = 'facility_data.json'
    if not os.path.exists(data_file):
        data_file = 'src/facility_data.json'
    if not os.path.exists(data_file):
        print("\n❌ ERROR: facility_data.json not found!")
        print("   Please run this script from the repo root.")
        sys.exit(1)
    
    with open(data_file, 'r') as f:
        all_data = json.load(f)
    
    # Get latest week
    latest_week = str(max([int(d['week']) for d in all_data]))
    latest_week_data = [d for d in all_data if d['week'] == latest_week]
    
    print(f"\n✓ Latest Week: {latest_week}")
    print(f"✓ Facilities: {len(latest_week_data)}")
    
    # Create output directory
    output_dir = 'weekly_reports'
    os.makedirs(output_dir, exist_ok=True)
    
    pdf_files = []
    
    # Generate DOR Reports
    print(f"\n{'='*80}")
    print(f"GENERATING DOR REPORTS ({len(latest_week_data)} facilities)")
    print(f"{'='*80}")
    
    for facility_data in latest_week_data:
        facility_name = facility_data['facility']
        
        # Get historical data
        facility_history = [d for d in all_data if d['facility'] == facility_name]
        facility_history = sorted(facility_history, key=lambda x: int(x['week']))
        
        # Create PDF
        safe_name = facility_name.replace(' ', '_').replace('/', '-')
        pdf_filename = f"DOR_{safe_name}_Week_{latest_week}.pdf"
        pdf_path = os.path.join(output_dir, pdf_filename)
        
        print(f"  ✓ {facility_name}")
        generate_dor_report(facility_data, facility_history, pdf_path)
        pdf_files.append(pdf_path)
    
    # Generate Admin Report
    print(f"\n{'='*80}")
    print("GENERATING ADMIN REPORT")
    print(f"{'='*80}")
    
    admin_pdf_filename = f"ADMIN_Weekly_Report_Week_{latest_week}.pdf"
    admin_pdf_path = os.path.join(output_dir, admin_pdf_filename)
    
    print(f"  ✓ Creating admin regional summary...")
    generate_admin_report(latest_week_data, admin_pdf_path)
    pdf_files.append(admin_pdf_path)
    
    # Create ZIP
    zip_filename = f'Weekly_Reports_Week_{latest_week}.zip'
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for pdf_file in pdf_files:
            zipf.write(pdf_file, os.path.basename(pdf_file))
    
    print(f"\n{'='*80}")
    print("✅ SUCCESS!")
    print(f"{'='*80}")
    print(f"\n✓ Generated {len(latest_week_data)} DOR reports")
    print(f"✓ Generated 1 Admin report")
    print(f"✓ Total: {len(pdf_files)} PDFs")
    print(f"✓ ZIP file: {zip_filename}")
    print(f"\nContents:")
    print(f"  • 17 DOR reports (email to each DOR)")
    print(f"  • 1 Admin report (email to leadership)")


if __name__ == '__main__':
    main()
