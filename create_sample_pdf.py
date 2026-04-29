#!/usr/bin/env python3
"""
Sample PDF Generator for Testing Document Automation
This script creates a comprehensive sample PDF with various elements
commonly found in business documents.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas
import os

def create_sample_pdf(filename="sample_test_document.pdf"):
    """Create a comprehensive sample PDF for testing."""
    
    # Create the document
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )
    
    # Container for the 'Flowable' objects
    story = []
    
    # Get styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.darkblue,
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.darkgreen,
        spaceBefore=12,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    )
    
    # === TITLE SECTION ===
    story.append(Paragraph("Sample Test Document", title_style))
    story.append(Paragraph("For Automation Testing & Template Development", 
                          ParagraphStyle('Subtitle', parent=styles['Normal'], 
                                       alignment=TA_CENTER, fontSize=12)))
    story.append(Spacer(1, 0.3*inch))
    
    # === INTRODUCTION SECTION ===
    story.append(Paragraph("1. Introduction", heading_style))
    intro_text = """
    This is a sample PDF document created for testing purposes. It contains various elements 
    commonly found in business documents including text paragraphs, tables, lists, and formatted 
    sections. This document serves as a template reference for automated document generation systems.
    """
    story.append(Paragraph(intro_text, normal_style))
    story.append(Spacer(1, 0.2*inch))
    
    # === SAMPLE DATA TABLE ===
    story.append(Paragraph("2. Sample Data Table", heading_style))
    
    table_data = [
        ['ID', 'Name', 'Department', 'Position', 'Status'],
        ['001', 'John Smith', 'Engineering', 'Senior Developer', 'Active'],
        ['002', 'Sarah Johnson', 'Marketing', 'Marketing Manager', 'Active'],
        ['003', 'Michael Brown', 'Finance', 'Financial Analyst', 'Active'],
        ['004', 'Emily Davis', 'HR', 'HR Specialist', 'On Leave'],
        ['005', 'David Wilson', 'Engineering', 'Junior Developer', 'Active'],
    ]
    
    table = Table(table_data, colWidths=[0.8*inch, 1.5*inch, 1.3*inch, 1.7*inch, 0.9*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 0.3*inch))
    
    # === TEXT SECTIONS ===
    story.append(Paragraph("3. Document Sections", heading_style))
    
    section_text = """
    This section demonstrates standard paragraph formatting. Automated document generation 
    systems need to handle various text formatting requirements including different font sizes, 
    styles, alignments, and spacing. This sample shows justified text alignment with proper 
    line leading (line height) for readability.
    """
    story.append(Paragraph(section_text, normal_style))
    
    # === BULLET POINTS SECTION ===
    story.append(Paragraph("4. Key Features", heading_style))
    
    features = [
        "Professional header and footer sections",
        "Formatted tables with alternating row colors",
        "Multiple text styles and alignments",
        "Proper spacing and margins",
        "Page break support for multi-page documents",
        "Compatible with PDF readers and automation tools"
    ]
    
    for i, feature in enumerate(features, 1):
        bullet_text = f"• {feature}"
        story.append(Paragraph(bullet_text, normal_style))
    
    story.append(Spacer(1, 0.3*inch))
    
    # === METADATA SECTION ===
    story.append(Paragraph("5. Document Metadata", heading_style))
    
    metadata_table = Table([
        ['Property', 'Value'],
        ['Document Type', 'Test Sample'],
        ['Created For', 'Automation Testing'],
        ['Format', 'PDF'],
        ['Version', '1.0'],
        ['Status', 'Final'],
    ], colWidths=[2*inch, 4*inch])
    
    metadata_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.lightyellow),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    story.append(metadata_table)
    story.append(Spacer(1, 0.3*inch))
    
    # === CONCLUSION ===
    story.append(Paragraph("6. Conclusion", heading_style))
    conclusion_text = """
    This sample PDF demonstrates the essential components needed for automated document 
    generation. When creating templates for automation, ensure you include all necessary 
    structural elements, maintain consistent styling, and test with various data inputs.
    """
    story.append(Paragraph(conclusion_text, normal_style))
    
    # Add page break
    story.append(PageBreak())
    
    # === SECOND PAGE - ADDITIONAL CONTENT ===
    story.append(Paragraph("Appendix A: Additional Test Content", heading_style))
    
    appendix_text = """
    This second page demonstrates multi-page document support. Automated systems should 
    handle page breaks correctly and maintain consistent formatting across pages. Headers 
    and footers should appear on each page as configured.
    """
    story.append(Paragraph(appendix_text, normal_style))
    
    # Sample numbered list
    story.append(Paragraph("Test Checklist:", heading_style))
    
    checklist_items = [
        "Verify text rendering quality",
        "Check table formatting and alignment",
        "Confirm page breaks work correctly",
        "Test with different data sets",
        "Validate PDF accessibility",
        "Ensure compatibility with PDF readers"
    ]
    
    for i, item in enumerate(checklist_items, 1):
        item_text = f"{i}. {item}"
        story.append(Paragraph(item_text, normal_style))
    
    # Build the PDF
    doc.build(story)
    print(f"✓ Sample PDF created successfully: {filename}")
    return filename

if __name__ == "__main__":
    create_sample_pdf()
