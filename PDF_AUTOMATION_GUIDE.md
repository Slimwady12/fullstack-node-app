# Complete Guide: PDF Document Automation & Template Setup

## 📄 What This Sample PDF Is Made Of

The generated `sample_test_document.pdf` contains the following components:

### 1. **Document Structure**
- **Page Size**: Letter (8.5" x 11")
- **Margins**: 0.75 inches on all sides
- **Pages**: 2 pages with proper page break

### 2. **Text Elements**
- **Title**: Large, centered, dark blue heading (24pt Helvetica-Bold)
- **Subtitle**: Centered secondary title (12pt)
- **Section Headings**: Green colored headings (16pt Helvetica-Bold)
- **Body Text**: Justified paragraphs (11pt Helvetica, 14pt leading)
- **Bullet Points**: Unicode bullet characters (•)
- **Numbered Lists**: Sequential numbering

### 3. **Tables**
- **Data Table**: 6 rows × 5 columns with:
  - Dark blue header row with white text
  - Alternating row colors (white/light grey)
  - Grid borders
  - Centered alignment
  - Custom column widths
  
- **Metadata Table**: 6 rows × 2 columns with:
  - Dark green header
  - Light yellow body background
  - Left-aligned text

### 4. **Styling Components**
- **Colors**: darkblue, darkgreen, whitesmoke, beige, lightgrey, lightyellow
- **Fonts**: Helvetica, Helvetica-Bold
- **Alignments**: Center, Left, Justify
- **Spacing**: SpaceBefore, SpaceAfter, Spacer elements
- **Padding**: Bottom padding in table cells

### 5. **Layout Elements**
- **Spacers**: Vertical spacing between sections (0.2"-0.3")
- **PageBreak**: Forces content to new page
- **Flowable Container**: Story list that builds document sequentially

---

## 🛠️ How to Set Up a Template for Automation

### Step 1: Install Required Libraries

```bash
pip install reportlab
```

### Step 2: Create Your Template Structure

Create a Python file (e.g., `template_generator.py`) with this structure:

```python
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

class DocumentTemplate:
    def __init__(self, filename, pagesize=letter):
        self.filename = filename
        self.pagesize = pagesize
        self.doc = SimpleDocTemplate(
            filename,
            pagesize=pagesize,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )
        self.story = []
        self.styles = getSampleStyleSheet()
        self.setup_styles()
    
    def setup_styles(self):
        """Define custom styles for consistent formatting"""
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.darkblue,
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        self.heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.darkgreen,
            spaceBefore=12,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        self.normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=11,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=10
        )
    
    def add_title(self, title, subtitle=None):
        """Add document title with optional subtitle"""
        self.story.append(Paragraph(title, self.title_style))
        if subtitle:
            subtitle_style = ParagraphStyle(
                'Subtitle',
                parent=self.styles['Normal'],
                alignment=TA_CENTER,
                fontSize=12
            )
            self.story.append(Paragraph(subtitle, subtitle_style))
        self.story.append(Spacer(1, 0.3*inch))
    
    def add_section(self, title, content):
        """Add a section with heading and content"""
        self.story.append(Paragraph(title, self.heading_style))
        self.story.append(Paragraph(content, self.normal_style))
        self.story.append(Spacer(1, 0.2*inch))
    
    def add_table(self, data, headers=True):
        """Add a formatted table"""
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        self.story.append(table)
        self.story.append(Spacer(1, 0.3*inch))
    
    def add_page_break(self):
        """Insert a page break"""
        self.story.append(PageBreak())
    
    def generate(self):
        """Build and save the PDF"""
        self.doc.build(self.story)
        print(f"✓ PDF generated: {self.filename}")
```

### Step 3: Create Data-Driven Document Generation

```python
def generate_automated_document(data_dict, output_filename):
    """
    Generate a PDF from structured data
    
    Args:
        data_dict: Dictionary containing document data
        output_filename: Output PDF filename
    """
    template = DocumentTemplate(output_filename)
    
    # Add title
    template.add_title(
        data_dict.get('title', 'Document Title'),
        data_dict.get('subtitle', '')
    )
    
    # Add sections
    for section in data_dict.get('sections', []):
        template.add_section(section['heading'], section['content'])
    
    # Add tables
    for table_data in data_dict.get('tables', []):
        template.add_table(table_data)
    
    # Generate PDF
    template.generate()

# Example usage
if __name__ == "__main__":
    sample_data = {
        'title': 'Monthly Report',
        'subtitle': 'Generated Automatically',
        'sections': [
            {'heading': 'Executive Summary', 'content': 'This is the summary...'},
            {'heading': 'Details', 'content': 'Detailed information here...'}
        ],
        'tables': [
            [['Header1', 'Header2'], ['Data1', 'Data2']]
        ]
    }
    
    generate_automated_document(sample_data, 'automated_report.pdf')
```

### Step 4: Advanced Template Features

#### A. Dynamic Content Insertion

```python
def add_dynamic_field(template, field_name, value, style=None):
    """Add a dynamic field with label and value"""
    if style is None:
        style = template.normal_style
    
    field_text = f"<b>{field_name}:</b> {value}"
    template.story.append(Paragraph(field_text, style))
    template.story.append(Spacer(1, 0.1*inch))
```

#### B. Conditional Content

```python
def add_conditional_section(template, condition, heading, content):
    """Add section only if condition is met"""
    if condition:
        template.add_section(heading, content)
```

#### C. Loop Through Data

```python
def add_list_items(template, items, bullet_char="•"):
    """Add bulleted or numbered list"""
    for item in items:
        bullet_text = f"{bullet_char} {item}"
        template.story.append(Paragraph(bullet_text, template.normal_style))
```

### Step 5: JSON-Based Template System

Create a JSON template file (`template_config.json`):

```json
{
  "document": {
    "pagesize": "letter",
    "margins": {
      "top": 0.75,
      "bottom": 0.75,
      "left": 0.75,
      "right": 0.75
    }
  },
  "styles": {
    "title": {
      "fontSize": 24,
      "color": "darkblue",
      "alignment": "center",
      "fontName": "Helvetica-Bold"
    },
    "heading": {
      "fontSize": 16,
      "color": "darkgreen",
      "fontName": "Helvetica-Bold"
    },
    "normal": {
      "fontSize": 11,
      "leading": 14,
      "alignment": "justify"
    }
  },
  "structure": [
    {"type": "title", "content": "Report Title"},
    {"type": "section", "heading": "Introduction", "content": "Text here"},
    {"type": "table", "data": "path/to/data.csv"},
    {"type": "pagebreak"},
    {"type": "section", "heading": "Conclusion", "content": "Final thoughts"}
  ]
}
```

### Step 6: Full Automation Workflow

```python
import json
from datetime import datetime

class AutomatedPDFGenerator:
    def __init__(self, config_file='template_config.json'):
        with open(config_file, 'r') as f:
            self.config = json.load(f)
    
    def generate_from_data(self, data, output_filename):
        """Generate PDF using template config and dynamic data"""
        template = DocumentTemplate(output_filename)
        
        # Process structure from config
        for element in self.config['structure']:
            elem_type = element['type']
            
            if elem_type == 'title':
                template.add_title(
                    data.get('title', element.get('content')),
                    data.get('subtitle')
                )
            
            elif elem_type == 'section':
                content = element.get('content', '')
                # Replace placeholders with actual data
                for key, value in data.items():
                    content = content.replace(f'{{{{{key}}}}}', str(value))
                template.add_section(element['heading'], content)
            
            elif elem_type == 'table':
                template.add_table(data.get('table_data', []))
            
            elif elem_type == 'pagebreak':
                template.add_page_break()
        
        template.generate()
        return output_filename

# Usage
generator = AutomatedPDFGenerator()
data = {
    'title': 'Q4 Sales Report',
    'subtitle': f'Generated on {datetime.now().strftime("%Y-%m-%d")}',
    'table_data': [['Product', 'Sales'], ['Widget A', '$10,000']]
}
generator.generate_from_data(data, 'quarterly_report.pdf')
```

---

## 📋 Quick Reference: PDF Components

| Component | Purpose | ReportLab Class |
|-----------|---------|-----------------|
| Title | Main document heading | `Paragraph` with custom style |
| Headings | Section dividers | `Paragraph` with Heading style |
| Body Text | Content paragraphs | `Paragraph` with Normal style |
| Tables | Structured data display | `Table` + `TableStyle` |
| Spacers | Vertical spacing | `Spacer(width, height)` |
| Page Breaks | Force new page | `PageBreak()` |
| Lists | Bullet/numbered items | `Paragraph` with • or 1. 2. 3. |
| Images | Embedded graphics | `Image(path)` |
| Headers/Footers | Page-level info | Canvas drawing functions |

---

## 🎯 Best Practices for Automation

1. **Separate Content from Style**: Keep data in JSON/CSV, styling in template
2. **Use Consistent Naming**: Standardize style names across templates
3. **Validate Data First**: Check data integrity before generating
4. **Error Handling**: Wrap generation in try-except blocks
5. **Test with Edge Cases**: Empty fields, long text, special characters
6. **Version Control**: Track template changes in Git
7. **Modular Design**: Create reusable components/functions
8. **Documentation**: Comment your template code thoroughly

---

## 🔧 Files Created

1. **`create_sample_pdf.py`** - Script that generates the sample PDF
2. **`sample_test_document.pdf`** - The generated sample PDF (5.2KB)
3. **`PDF_AUTOMATION_GUIDE.md`** - This comprehensive guide

---

## 🚀 Next Steps

1. **Customize the template** for your specific use case
2. **Connect to data sources** (database, API, CSV, JSON)
3. **Add branding** (logos, company colors, fonts)
4. **Implement batch generation** for multiple documents
5. **Add digital signatures** if needed
6. **Set up scheduled generation** with cron or task scheduler

You now have everything needed to create automated PDF documents! 🎉
