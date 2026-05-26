import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
export const errorHandler = (err, _req, res, _next) => {
    // Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: err.errors,
            },
        });
    }
    // Application errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details || {},
            },
        });
    }
    // Prisma errors
    if (err.constructor.name.startsWith('Prisma')) {
        console.error('Prisma error:', err);
        return res.status(500).json({
            error: {
                code: 'DATABASE_ERROR',
                message: 'A database error occurred',
                details: {},
            },
        });
    }
    // Unknown errors
    console.error('Unexpected error:', err);
    return res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: {},
        },
    });
};
