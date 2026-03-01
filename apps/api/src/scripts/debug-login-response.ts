
import { authService } from '../modules/auth/auth.service';
import { db } from '../config/database';
import { users, roles } from '../db/schema';
import { eq } from 'drizzle-orm';

async function testLogin() {
    try {
        // 1. Find a non-admin user (e.g., a sales agent or create one)
        console.log('Finding a user...');
        const user = await db.query.users.findFirst({
            where: eq(users.email, 'sales@marijewellers.com')
        });

        if (!user) {
            console.log('Sales user not found, trying to create or find another...');
            // Fallback to searching for any user to test the structure
            const anyUser = await db.query.users.findFirst();
            if (anyUser) {
                console.log(`Found user: ${anyUser.email}. Note: This might be an admin.`);
            } else {
                console.log('No users found in DB.');
                return;
            }
        }

        // 2. Perform login (mocking the input)
        // We need a known password. If we can't login, we can at least check the service method code again or partial output.
        // However, since we can't easily know the password, let's inspecting the generateAuthResponse method output by
        // mocking the internal calls or just creating a temporary user with a known password.

        console.log('Creating a temp test user with known password...');
        const tempEmail = `test_sidebar_${Date.now()}@example.com`;
        const tempPass = 'password123';

        // We need a valid store and role ID.
        const store = await db.query.stores.findFirst();
        const role = await db.query.roles.findFirst({
            where: eq(roles.name, 'sales_agent') // Try to find sales_agent, or just take the first one
        }) || await db.query.roles.findFirst();

        if (!store || !role) {
            console.error('Missing store or role for test setup');
            return;
        }

        const newUser = await authService.register({
            email: tempEmail,
            password: tempPass,
            fullName: 'Test User',
            storeId: store.id,
            roleId: role.id
        });

        console.log('User registered:', newUser.user);

        console.log('Attempting login...');
        const loginResponse = await authService.login({
            email: tempEmail,
            password: tempPass,
            storeId: store.id
        });

        console.log('Login Response User Object:', JSON.stringify(loginResponse.user, null, 2));

        if (loginResponse.user.role) {
            console.log('SUCCESS: Role is present in the response.');
        } else {
            console.error('FAILURE: Role is MISSING in the response.');
        }

        // Cleanup
        // await db.delete(users).where(eq(users.id, newUser.user.id));

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

testLogin();
