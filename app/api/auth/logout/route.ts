import { clearSession } from '@/lib/router/session-manager';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        await clearSession();
        return NextResponse.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to logout' },
            { status: 500 }
        );
    }
}
