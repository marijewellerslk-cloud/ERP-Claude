
import { db, connection } from '../config/database.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../utils/password.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

async function resetAdminPassword() {
    try {
        const email = 'admin@marijewellers.com';
        const newPassword = 'password123';

        logger.info(`Resetting password for ${email}...`);

        // Check if user exists
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user) {
            logger.error(`User ${email} not found!`);
            process.exit(1);
        }

        const hashedPassword = await hashPassword(newPassword);

        await db.update(users)
            .set({ passwordHash: hashedPassword })
            .where(eq(users.email, email));

        logger.info(`✅ Password reset successfully to: ${newPassword}`);

    } catch (error) {
        logger.error('Error resetting password:', error);
    } finally {
        await connection.end();
    }
}

resetAdminPassword();
