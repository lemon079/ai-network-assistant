import { NextResponse } from 'next/server';
import { loginAndSaveSession, clearSession } from '@/lib/router/session-manager';

/**
 * Login route using httpOnly cookies for session storage
 * Session is stored in browser cookie and clears when browser closes
 */
export async function POST(req: Request) {
    try {
        const { ip, username, password } = await req.json();
        console.log('[Router Login] Received request:', { ip, username: username ? '***' : null });

        if (!ip || !username || !password) {
            console.log('[Router Login] Missing credentials');
            return NextResponse.json(
                { success: false, message: 'Missing credentials' },
                { status: 400 }
            );
        }

        // Login and save session to httpOnly cookie
        const result = await loginAndSaveSession({
            ip,
            username,
            password
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, message: result.message },
                { status: 401 }
            );
        }

        console.log('[Router Login] Session saved to cookie');

        return NextResponse.json({
            success: true,
            message: result.message
        });

    } catch (error: any) {
        console.error('[Router Login] Error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Login failed',
                details: error?.message
            },
            { status: 500 }
        );
    }
}

/**
 * Logout / clear session cookie
 */
export async function DELETE() {
    try {
        await clearSession();

        return NextResponse.json({
            success: true,
            message: 'Session cleared successfully'
        });

    } catch (error: any) {
        console.error('[Router Login] Delete error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to clear session',
                details: error?.message
            },
            { status: 500 }
        );
    }
}
