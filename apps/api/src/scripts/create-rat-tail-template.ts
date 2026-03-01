
import { db, connection } from '../config/database.js';
import { labelTemplates, stores, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function createRatTailTemplate() {
    console.log('🏷️  Creating Rat Tail label template...\n');

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

        const templateName = 'Rat Tail Label (65.1x21.7mm)';

        // Check if template already exists
        const [existing] = await db
            .select()
            .from(labelTemplates)
            .where(eq(labelTemplates.name, templateName))
            .limit(1);

        if (existing) {
            console.log('ℹ️  Rat Tail label template already exists.');
            return;
        }

        // Rat Tail Template Configuration
        // Total Size: 65.1mm x 21.7mm
        // Printable Area: Starts at X=35mm (Tail is on left), Width=25.7mm
        const ratTailTemplate = {
            storeId: store.id,
            name: templateName,
            description: 'Rat tail jewelry label with tail on left side',

            // Page configuration (Thermal Printer)
            pageSize: 'custom' as const,
            pageWidth: 65,
            pageHeight: 22, // Rounding for safety
            pageOrientation: 'portrait' as const,

            // Label configuration
            labelWidth: 65,
            labelHeight: 22,
            labelsPerRow: 1,
            labelsPerColumn: 1,

            // Margins and spacing (Zero for thermal)
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            horizontalSpacing: 0,
            verticalSpacing: 0,

            // Label fields configuration - ALL positioned > 35mm X
            fields: [
                // Company Name (Small, top)
                {
                    id: 'company',
                    type: 'text' as const,
                    field: 'companyName' as const,
                    x: 35.5, // Start inside printable area
                    y: 2,
                    width: 25,
                    height: 3,
                    fontSize: 6,
                    fontFamily: 'Arial',
                    fontWeight: 'bold' as const,
                    textAlign: 'center' as const,
                    color: '#000000',
                },
                // SKU / Barcode Area
                {
                    id: 'barcode',
                    type: 'barcode' as const,
                    field: 'sku' as const,
                    x: 36,
                    y: 6,
                    width: 24,
                    height: 8,
                },
                // SKU Text
                {
                    id: 'sku-text',
                    type: 'text' as const,
                    field: 'sku' as const,
                    x: 35.5,
                    y: 15,
                    width: 25,
                    height: 3,
                    fontSize: 7,
                    fontFamily: 'monospace',
                    fontWeight: 'bold' as const,
                    textAlign: 'center' as const,
                    color: '#000000',
                },
                // Price / Weight
                {
                    id: 'price',
                    type: 'text' as const,
                    field: 'grossWeight' as const, // Placeholder, usually price or weight
                    label: 'GW:',
                    x: 35.5,
                    y: 19,
                    width: 25,
                    height: 3,
                    fontSize: 7,
                    fontFamily: 'Arial',
                    fontWeight: 'normal' as const,
                    textAlign: 'center' as const,
                    color: '#000000',
                },
            ],

            // Style configuration
            companyName: 'MARI Jewellers',
            showCompanyHeader: false, // We added manual field
            showBorder: false, // Usually no border for thermal
            borderWidth: 1,
            borderColor: '#000000',
            borderRadius: 0,
            backgroundColor: '#FFFFFF',

            // Template metadata
            isDefault: true,
            isActive: true,
            createdBy: user.id,
        };

        // Unset other defaults first
        await db
            .update(labelTemplates)
            .set({ isDefault: false })
            .where(eq(labelTemplates.storeId, store.id));

        const [created] = await db.insert(labelTemplates).values(ratTailTemplate).returning();

        console.log('✅ Rat Tail label template created successfully!');
        console.log(`   ID: ${created.id}`);
    } catch (error) {
        console.error('❌ Error creating template:', error);
        throw error;
    }
}

// Run the script
createRatTailTemplate()
    .then(async () => {
        await connection.end();
        process.exit(0);
    })
    .catch(async (error) => {
        await connection.end();
        process.exit(1);
    });
