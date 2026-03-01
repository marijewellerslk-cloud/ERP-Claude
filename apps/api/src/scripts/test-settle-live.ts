import http from 'http';

// Step 1: Login to get a token
function login(): Promise<string> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ email: 'admin@marijewellers.com', password: 'Admin@123' });
        const req = http.request({
            hostname: 'localhost',
            port: 4000,
            path: '/api/v1/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.data?.accessToken) {
                        resolve(parsed.data.accessToken);
                    } else {
                        // Try other common passwords
                        reject(new Error('Login failed: ' + body));
                    }
                } catch (e) {
                    reject(new Error('Parse error: ' + body));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Step 2: Get a supplier with balance > 0
function getSuppliers(token: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 4000,
            path: '/api/v1/suppliers?limit=10',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed.data?.data || []);
                } catch (e) {
                    reject(new Error('Parse error: ' + body));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Step 3: Call settle balance
function settleBalance(token: string, supplierId: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            settlementType: 'monetary',
            amount: 100,
            paymentMethod: 'cash',
            notes: 'Test settlement via script',
        });

        console.log(`\nPOST /api/v1/suppliers/${supplierId}/settle-balance`);
        console.log('Payload:', data);

        const req = http.request({
            hostname: 'localhost',
            port: 4000,
            path: `/api/v1/suppliers/${supplierId}/settle-balance`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': `Bearer ${token}`,
            },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`\nResponse status: ${res.statusCode}`);
                console.log('Response body:', body);
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body, status: res.statusCode });
                }
            });
        });
        req.on('error', (err) => {
            console.error('Request error:', err.message);
            reject(err);
        });
        req.write(data);
        req.end();
    });
}

async function main() {
    try {
        console.log('=== Settlement API Live Test ===\n');

        // Try login
        let token: string;
        try {
            token = await login();
            console.log('✅ Login successful');
        } catch (e: any) {
            console.log('Login with Admin@123 failed, trying password123...');
            // Try fallback password
            const data = JSON.stringify({ email: 'admin@marijewellers.com', password: 'password123' });
            token = await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: 4000,
                    path: '/api/v1/auth/login',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
                }, (res) => {
                    let body = '';
                    res.on('data', (chunk) => body += chunk);
                    res.on('end', () => {
                        const parsed = JSON.parse(body);
                        if (parsed.data?.accessToken) resolve(parsed.data.accessToken);
                        else reject(new Error('Login failed: ' + body));
                    });
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
            console.log('✅ Login successful (password123)');
        }

        // Get suppliers
        const suppliers = await getSuppliers(token);
        console.log(`\nFound ${suppliers.length} suppliers`);

        if (suppliers.length === 0) {
            console.log('❌ No suppliers found');
            process.exit(1);
        }

        // Find one with balance
        const withBalance = suppliers.find((s: any) => parseFloat(s.currentBalance || '0') > 0);
        const target = withBalance || suppliers[0];
        console.log(`\nTarget supplier: ${target.businessName} (${target.id})`);
        console.log(`Current balance: ${target.currentBalance}`);

        // Settle
        const result = await settleBalance(token, target.id);

        if (result.success) {
            console.log('\n✅ Settlement SUCCEEDED');
        } else {
            console.log('\n❌ Settlement FAILED');
            console.log('Error:', JSON.stringify(result, null, 2));
        }
    } catch (error: any) {
        console.error('\n❌ Fatal error:', error.message);
    }

    process.exit(0);
}

main();
