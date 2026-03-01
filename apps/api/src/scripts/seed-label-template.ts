
import { db } from '../config/database.js';
import { labelTemplates, users, stores } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function seedZPLReplicaTemplate() {
    try {
        console.log('Seeding ZPL Replica Label Template...\\n');

        // 1. Get Store
        const allStores = await db.select().from(stores).limit(1);
        if (allStores.length === 0) {
            console.error('No stores found!');
            process.exit(1);
        }
        const store = allStores[0];
        console.log(`Using store: ${store.name}`);

        // 2. Get Admin User
        const adminUser = await db.query.users.findFirst({
            where: eq(users.email, 'admin@marijewellers.com'),
        });

        if (!adminUser) {
            console.error('Admin user not found!');
            process.exit(1);
        }

        // 3. Define Template Data
        const templateData = {
            storeId: store.id,
            name: 'ZPL Replica (63x22mm)',
            description: 'Standard thermal label with Ring Size, Rate %, and MC',
            pageSize: 'custom',
            pageWidth: '63.00',
            pageHeight: '22.00',
            pageOrientation: 'landscape',
            labelWidth: '63.00',
            labelHeight: '22.00',
            labelsPerRow: 1,
            labelsPerColumn: 1,
            marginTop: '0.00',
            marginBottom: '0.00',
            marginLeft: '0.00',
            marginRight: '0.00',
            horizontalSpacing: '0.00',
            verticalSpacing: '0.00',
            companyName: store.name,
            showCompanyHeader: false, // We will add it as a manual text field for better control
            showBorder: false, // Clean look
            isDefault: true,
            isActive: true,
            createdBy: adminUser.id,
            fields: [
                // Company Name (Top Center/Left)
                {
                    id: 'f_company',
                    type: 'text',
                    field: 'companyName',
                    x: 2,
                    y: 4,
                    fontSize: 8,
                    fontWeight: 'bold',
                    textAlign: 'left',
                    width: 60,
                    height: 5
                },
                // Product Name (Below Company)
                {
                    id: 'f_name',
                    type: 'text',
                    field: 'name',
                    x: 2,
                    y: 7,
                    fontSize: 7,
                    fontWeight: 'normal',
                    textAlign: 'left',
                    width: 40,
                    height: 4
                },
                // SKU (Right of Product or Below)
                {
                    id: 'f_sku',
                    type: 'text',
                    field: 'sku',
                    x: 40,
                    y: 4, // Top right
                    fontSize: 7,
                    fontWeight: 'bold',
                    textAlign: 'right',
                    width: 20,
                    height: 4
                },
                // Row 3: Weight | Size
                {
                    id: 'f_weight',
                    type: 'text',
                    field: 'grossWeight',
                    customText: '', // Dynamic
                    // logic: prefix handled by component? No, usually raw. 
                    // detailed designs usually put static text label next to dynamic field.
                    // For simplicity in this schema, we assume the printer renders the value.
                    // If we want "GW: 10.5g", we might need a custom renderer or just "10.500g".
                    x: 2,
                    y: 11,
                    fontSize: 7,
                    fontWeight: 'bold',
                    width: 15,
                    height: 4
                },
                {
                    id: 'f_size_label',
                    type: 'text',
                    customText: 'Size:',
                    x: 20,
                    y: 11,
                    fontSize: 6,
                    width: 8,
                    height: 4
                },
                {
                    id: 'f_size',
                    type: 'text',
                    field: 'size',
                    x: 27,
                    y: 11,
                    fontSize: 7,
                    fontWeight: 'bold',
                    width: 10,
                    height: 4
                },
                // Row 4: Rate% | MC
                {
                    id: 'f_rate_label',
                    type: 'text',
                    customText: 'Rate:',
                    x: 2,
                    y: 15,
                    fontSize: 6,
                    width: 8,
                    height: 4
                },
                {
                    id: 'f_rate',
                    type: 'text',
                    field: 'costRatePercentage',
                    x: 9,
                    y: 15,
                    fontSize: 7,
                    width: 12,
                    height: 4
                },
                {
                    id: 'f_mc_label',
                    type: 'text',
                    customText: 'MC:',
                    x: 25,
                    y: 15,
                    fontSize: 6,
                    width: 6,
                    height: 4
                },
                {
                    id: 'f_mc',
                    type: 'text',
                    field: 'makingCharges',
                    x: 30,
                    y: 15,
                    fontSize: 7,
                    width: 15,
                    height: 4
                },
                // Barcode (Bottom Right)
                {
                    id: 'f_barcode',
                    type: 'barcode',
                    field: 'barcode',
                    x: 38, // Shifted to right
                    y: 8, // Spanning multiple rows height
                    width: 23,
                    height: 12,
                    fontSize: 6 // Text below barcode
                }
            ]
        };

        // 4. Insert Template
        const [template] = await db.insert(labelTemplates)
            .values(templateData)
            .returning();

        console.log(`\\n✅ Template created: ${template.name}`);
        console.log(`ID: ${template.id}`);

        process.exit(0);

    } catch (error) {
        console.error('Error seeding template:', error);
        process.exit(1);
    }
}

seedZPLReplicaTemplate();
