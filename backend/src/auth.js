"use strict";
const __importDefault = function (mod) {
    return (mod?.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.SESSION_SECRET || 'fallback_secret_for_development_only';
// Middleware to require authentication
const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Check if session exists in DB
        const session = await prisma.session.findUnique({
            where: { id: decoded.sessionId },
            include: { user: true }
        });
        if (!session || session.expiresAt < new Date()) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        req.user = {
            id: session.user.id,
            email: session.user.email
        };
        next();
    }
    catch (error) {
        console.warn('Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
        res.status(401).json({ error: 'Unauthorized' });
    }
};
exports.requireAuth = requireAuth;
// Rate limiter helper (simple in-memory for this example, or use express-rate-limit)
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per `window`
    message: { error: 'Too many login attempts, please try again later.' }
});
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Invalid email or password.' });
            return;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const validPassword = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!validPassword) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        // Create session
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                expiresAt
            }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, sessionId: session.id }, JWT_SECRET, { expiresIn: '30d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        res.json({ user: { id: user.id, email: user.email } });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                await prisma.session.delete({ where: { id: decoded.sessionId } }).catch(() => { });
            }
            catch (error) {
                // Logout remains idempotent, but record invalid or expired tokens.
                console.warn('Logout token verification failed:', error instanceof Error ? error.message : 'Unknown error');
            }
        }
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            res.json({ authenticated: false });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const session = await prisma.session.findUnique({
            where: { id: decoded.sessionId },
            include: { user: true }
        });
        if (!session || session.expiresAt < new Date()) {
            res.json({ authenticated: false });
            return;
        }
        res.json({
            authenticated: true,
            user: {
                id: session.user.id,
                email: session.user.email
            }
        });
    }
    catch (error) {
        console.warn('Session lookup failed:', error instanceof Error ? error.message : 'Unknown error');
        res.json({ authenticated: false });
    }
});
router.post('/change-password', exports.requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword || newPassword.length < 12) {
            res.status(400).json({ error: 'Invalid input or password too short (min 12 chars).' });
            return;
        }
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }
        const validPassword = await bcrypt_1.default.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            res.status(401).json({ error: 'Incorrect current password.' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash }
        });
        // Invalidate all existing sessions for this user
        await prisma.session.deleteMany({
            where: { userId }
        });
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });
        res.json({ success: true, message: 'Password changed. Please log in again.' });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map