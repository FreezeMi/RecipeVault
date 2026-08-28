"use strict";
const __importDefault = function (mod) {
    return (mod?.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const readline_1 = __importDefault(require("node:readline"));
const prisma = new client_1.PrismaClient();
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => {
    return new Promise(resolve => {
        rl.question(query, resolve);
    });
};
async function main() {
    console.log('--- Create Admin Account ---');
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
        console.log('An account already exists. For this simple application, only one account is supported.');
        process.exit(1);
    }
    const email = await question('Email: ');
    if (!email?.includes('@')) {
        console.error('Invalid email address.');
        process.exit(1);
    }
    // Node readline doesn't natively hide input easily without writing a custom stream handler
    // For a simple CLI, we just prompt normally.
    const password = await question('Password (min 12 chars): ');
    if (password.length < 12) {
        console.error('Password must be at least 12 characters.');
        process.exit(1);
    }
    const passwordHash = await bcrypt_1.default.hash(password, 12);
    await prisma.user.create({
        data: {
            email,
            passwordHash
        }
    });
    console.log('Admin account created successfully!');
    process.exit(0);
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=create-admin.js.map