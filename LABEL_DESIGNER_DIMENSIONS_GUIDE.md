# Label Designer Configuration Guide

## Overview
This document explains how to configure the label designer for your specific requirements:
- Total label size: height 21.7mm, width 65.1mm
- Printable area: height 21.7mm, width 27mm

## Understanding Label Dimensions

### Total Label Size
- **Width**: 65.1mm (total width of the physical label)
- **Height**: 21.7mm (total height of the physical label)

### Printable Area
- **Width**: 27mm (usable area for content within the 65.1mm width)
- **Height**: 21.7mm (same as total height)

The printable area is positioned within the total label dimensions, leaving 38.1mm of unused space on the right side (65.1mm - 27mm = 38.1mm). This could be used for additional information, logos, or left blank depending on your design needs.

## Configuration Steps

### 1. Setting Label Dimensions
When creating or editing a label template:
- Set **Label Width** to `65.1` mm
- Set **Label Height** to `21.7` mm

### 2. Configuring Printable Area
To utilize the 27mm printable width effectively:
- Position your content fields within the first 27mm of the width
- Use X coordinates from 0mm to 27mm for main content
- Use the remaining 38.1mm (from 27mm to 65.1mm) for additional information like:
  - Barcodes
  - QR codes
  - Additional text
  - Decorative elements

### 3. Field Positioning
When adding fields to your template:
- **X coordinate**: Use values from 0mm to 27mm for main content area
- **Y coordinate**: Use values from 0mm to 21.7mm for vertical positioning
- **Width**: For main content, keep within 27mm; for full label width, use up to 65.1mm

### 4. Example Field Positions
For a typical jewelry label with the specified dimensions:

#### Main Content Area (0-27mm width):
- Item Name: X=1mm, Y=2mm, Width=25mm
- SKU/Item Code: X=1mm, Y=6mm, Width=25mm  
- Weight: X=1mm, Y=10mm, Width=25mm
- Price: X=1mm, Y=14mm, Width=25mm

#### Extended Area (27-65.1mm width):
- Barcode: X=28mm, Y=8mm, Width=35mm, Height=10mm
- Additional info: X=28mm, Y=2mm, Width=35mm

## Layout Configuration

### Labels Per Page
With the dimensions specified:
- **Portrait orientation**: Approximately 10-12 labels per column (depending on spacing)
- **Landscape orientation**: Approximately 2-3 labels per row (depending on spacing)

### Recommended Spacing
- **Horizontal spacing**: 2mm minimum
- **Vertical spacing**: 2mm minimum
- **Margins**: 0mm (to maximize usable space)

## Practical Implementation

### Creating a New Template
1. Navigate to Settings → Label Designer
2. Click "Create New Template"
3. Set the following values:
   - Label Width: 65.1mm
   - Label Height: 21.7mm
   - Labels Per Row: 2-3 (for landscape A4)
   - Labels Per Column: 10-12 (depending on spacing)
   - Horizontal Spacing: 2mm
   - Vertical Spacing: 2mm
   - All margins: 0mm

### Adding Fields
When adding fields to your template:
1. For main content (within 27mm), position fields with X coordinates 0-27mm
2. For extended content (using full 65.1mm), position fields with X coordinates 0-65.1mm
3. Ensure Y coordinates stay within 0-21.7mm range

## Best Practices

### Content Placement
- Place critical information within the first 27mm width
- Use the extended area for secondary information
- Ensure sufficient spacing between elements
- Test print on actual label stock before finalizing

### Typography
- Use font sizes that remain readable at small scales
- Consider 8-12pt for standard text
- Use bold fonts for important information

### Barcode Considerations
- Reserve adequate space in the extended area for barcode generation
- Ensure barcode is positioned away from fold lines or edges
- Test barcode readability with your scanner

## Troubleshooting

### Content Cut Off
- Verify field positions don't exceed label dimensions
- Check that X+Width ≤ 65.1mm and Y+Height ≤ 21.7mm

### Poor Print Quality
- Ensure adequate spacing between labels
- Verify printer settings match paper dimensions
- Check that label stock is properly calibrated in printer

### Alignment Issues
- Use consistent spacing between similar elements
- Align text elements to maintain visual consistency
- Test with multiple items to ensure consistency