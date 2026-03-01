import { db } from '../src/config/database.js';
import { labelTemplates } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Script to update label templates to the new dimensions:
 * - Total size: height 21.7mm, width 65.1mm
 * - Printable area: height 21.7mm, width 27mm
 */

async function updateLabelDimensions() {
  console.log('Updating label templates to new dimensions...');

  try {
    // Find all label templates
    const templates = await db.select().from(labelTemplates);

    for (const template of templates) {
      console.log(`Updating template: ${template.name} (${template.id})`);
      
      // Update the template dimensions
      await db
        .update(labelTemplates)
        .set({
          labelWidth: 65.1,  // Total width: 65.1mm
          labelHeight: 21.7, // Total height: 21.7mm
          labelsPerRow: 2,   // Adjusted to fit wider labels
          labelsPerColumn: 10, // Adjusted to fit shorter height
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
          horizontalSpacing: 2,
          verticalSpacing: 2,
          updatedAt: new Date(),
        })
        .where(eq(labelTemplates.id, template.id));

      console.log(`✓ Updated template: ${template.name}`);
    }

    console.log(`\nSuccessfully updated ${templates.length} label templates.`);
    console.log('New dimensions:');
    console.log('- Label Width: 65.1mm');
    console.log('- Label Height: 21.7mm');
    console.log('- Labels Per Row: 2');
    console.log('- Labels Per Column: 10');
    console.log('- Margins: 0mm');
    console.log('- Spacing: 2mm');
  } catch (error) {
    console.error('Error updating label templates:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateLabelDimensions()
    .then(() => {
      console.log('\nLabel template update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { updateLabelDimensions };