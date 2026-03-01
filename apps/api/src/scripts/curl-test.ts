import { db } from '../config/database.js';
import http from 'http';

async function test() {
    const suppliers = await db.query.suppliers.findMany({ limit: 1 });
    if (suppliers.length === 0) return console.log('No suppliers');

    const req = http.request({
        hostname: 'localhost',
        port: 4000,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const token = parsed.data.token;

                const req2 = http.request({
                    hostname: 'localhost',
                    port: 4000,
                    path: `/api/v1/suppliers/${suppliers[0].id}/settle-balance`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                }, (res2) => {
                    let data2 = '';
                    res2.on('data', (chunk) => data2 += chunk);
                    res2.on('end', () => {
                        console.log('Status:', res2.statusCode);
                        console.log('Response:', data2);
                        process.exit(0);
                    });
                });

                req2.on('error', (e) => console.error(e));
                req2.write(JSON.stringify({
                    settlementType: 'monetary',
                    amount: 50,
                    paymentMethod: 'cash',
                    notes: 'Curl test'
                }));
                req2.end();

            } catch (e) {
                console.error('Login parsed failed', data);
                process.exit(1);
            }
        });
    });

    req.on('error', (e) => console.error(e));
    req.write(JSON.stringify({
        email: 'admin@marijewellers.com',
        password: 'password123'
    }));
    req.end();
}

test();
