import { db, connection } from '../config/database.js';
import { labelTemplates, stores, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function createDefaultLabelTemplate() {
  console.log('🏷️  Creating default label template...\n');

  try {
    // Get the first store
    const [store] = await db.select().from(stores).limit(1);
    if (!store) {
      console.error('❌ No store found. Please create a store first.');
      process.exit(1);
    }

    // Get the first user (super admin)
    const [user] = await db.select().from(users).limit(1);
    if (!user) {
      console.error('❌ No user found. Please create a user first.');
      process.exit(1);
    }

    // Check if default template already exists
    const [existing] = await db
      .select()
      .from(labelTemplates)
      .where(eq(labelTemplates.storeId, store.id))
      .limit(1);

    if (existing) {
      console.log('ℹ️  Default label template already exists.');
      console.log(`   Template: ${existing.name}`);
      console.log(`   ID: ${existing.id}`);
      return;
    }

    // Default template configuration matching current label design
    const defaultTemplate = {
      storeId: store.id,
      name: 'Default Label (A4 - 2 Column)',
      description: 'Standard 2-column label layout for A4 paper, matching the original design',

      // Page configuration
      pageSize: 'A4' as const,
      pageOrientation: 'portrait' as const,

      // Label configuration (approximately 90mm x 60mm per label)
      labelWidth: 90,
      labelHeight: 60,
      labelsPerRow: 2,
      labelsPerColumn: 4,

      // Margins and spacing
      marginTop: 10,
      marginBottom: 10,
      marginLeft: 10,
      marginRight: 10,
      horizontalSpacing: 5,
      verticalSpacing: 5,

      // Label fields configuration
      fields: [
        // Company header
        {
          id: 'header',
          type: 'text' as const,
          field: 'companyName' as const,
          x: 5,
          y: 2,
          width: 80,
          height: 8,
          fontSize: 16,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'center' as const,
          color: '#000000',
        },
        // SKU label
        {
          id: 'sku-label',
          type: 'text' as const,
          label: 'SKU:',
          x: 5,
          y: 12,
          width: 15,
          height: 4,
          fontSize: 10,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'left' as const,
          color: '#000000',
        },
        // SKU value
        {
          id: 'sku-value',
          type: 'text' as const,
          field: 'sku' as const,
          x: 22,
          y: 12,
          width: 63,
          height: 4,
          fontSize: 10,
          fontFamily: 'Courier',
          fontWeight: 'bold' as const,
          textAlign: 'right' as const,
          color: '#000000',
        },
        // Item name
        {
          id: 'name',
          type: 'text' as const,
          field: 'name' as const,
          x: 5,
          y: 18,
          width: 80,
          height: 5,
          fontSize: 11,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'left' as const,
          color: '#000000',
        },
        // Metal type label + value
        {
          id: 'metal-label',
          type: 'text' as const,
          label: 'Metal:',
          x: 5,
          y: 25,
          width: 18,
          height: 4,
          fontSize: 8,
          fontFamily: 'Arial',
          fontWeight: 'normal' as const,
          textAlign: 'left' as const,
          color: '#666666',
        },
        {
          id: 'metal-value',
          type: 'text' as const,
          field: 'metalType' as const,
          x: 24,
          y: 25,
          width: 18,
          height: 4,
          fontSize: 9,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'left' as const,
          color: '#000000',
        },
        // Purity label + value
        {
          id: 'purity-label',
          type: 'text' as const,
          label: 'Purity:',
          x: 47,
          y: 25,
          width: 18,
          height: 4,
          fontSize: 8,
          fontFamily: 'Arial',
          fontWeight: 'normal' as const,
          textAlign: 'left' as const,
          color: '#666666',
        },
        {
          id: 'purity-value',
          type: 'text' as const,
          field: 'purity' as const,
          x: 66,
          y: 25,
          width: 19,
          height: 4,
          fontSize: 9,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'left' as const,
          color: '#000000',
        },
        // Gross weight label + value
        {
          id: 'gross-label',
          type: 'text' as const,
          label: 'Gross:',
          x: 5,
          y: 31,
          width: 18,
          height: 4,
          fontSize: 8,
          fontFamily: 'Arial',
          fontWeight: 'normal' as const,
          textAlign: 'left' as const,
          color: '#666666',
        },
        {
          id: 'gross-value',
          type: 'text' as const,
          field: 'grossWeight' as const,
          x: 24,
          y: 31,
          width: 18,
          height: 4,
          fontSize: 9,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'left' as const,
          color: '#000000',
        },
        // Net weight label + value
        {
          id: 'net-label',
          type: 'text' as const,
          label: 'Net:',
          x: 47,
          y: 31,
          width: 18,
          height: 4,
          fontSize: 8,
          fontFamily: 'Arial',
          fontWeight: 'normal' as const,
          textAlign: 'left' as const,
          color: '#666666',
        },
        {
          id: 'net-value',
          type: 'text' as const,
          field: 'netWeight' as const,
          x: 66,
          y: 31,
          width: 19,
          height: 4,
          fontSize: 9,
          fontFamily: 'Arial',
          fontWeight: 'bold' as const,
          textAlign: 'left' as const,
          color: '#000000',
        },
        // Barcode
        {
          id: 'barcode',
          type: 'barcode' as const,
          field: 'sku' as const,
          x: 10,
          y: 40,
          width: 70,
          height: 12,
        },
        // SKU text below barcode
        {
          id: 'barcode-text',
          type: 'text' as const,
          field: 'sku' as const,
          x: 10,
          y: 53,
          width: 70,
          height: 4,
          fontSize: 8,
          fontFamily: 'Courier',
          fontWeight: 'normal' as const,
          textAlign: 'center' as const,
          color: '#000000',
        },
      ],

      // Style configuration
      companyName: 'MARI Jewellers',
      showCompanyHeader: true,
      headerFontSize: 16,
      showBorder: true,
      borderWidth: 2,
      borderColor: '#000000',
      borderRadius: 4,
      backgroundColor: '#FFFFFF',

      // Template metadata
      isDefault: true,
      isActive: true,
      createdBy: user.id,
    };

    const [created] = await db.insert(labelTemplates).values(defaultTemplate).returning();

    console.log('✅ Default label template created successfully!\n');
    console.log('   Details:');
    console.log(`   - Template ID: ${created.id}`);
    console.log(`   - Name: ${created.name}`);
    console.log(`   - Store: ${store.name}`);
    console.log(`   - Label Size: ${created.labelWidth}mm × ${created.labelHeight}mm`);
    console.log(`   - Layout: ${created.labelsPerRow} columns × ${created.labelsPerColumn} rows`);
    console.log(`   - Total Fields: ${created.fields ? (created.fields as any[]).length : 0}`);
    console.log(`   - Is Default: ${created.isDefault ? 'Yes' : 'No'}\n`);
  } catch (error) {
    console.error('❌ Error creating default label template:', error);
    throw error;
  }
}

// Run the script
createDefaultLabelTemplate()
  .then(async () => {
    console.log('✅ Script completed successfully');
    await connection.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Script failed:', error);
    await connection.end();
    process.exit(1);
  });
