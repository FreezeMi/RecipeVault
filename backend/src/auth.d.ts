import { Request, Response, NextFunction } from 'express';
declare const router: import("express-serve-static-core").Router;
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
            };
        }
    }
}
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default router;
//# sourceMappingURL=auth.d.ts.map