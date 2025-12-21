import { getSession } from '@/lib/router/session-manager';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { authenticated: false, message: 'No session found' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            authenticated: true,
            routerIp: session.routerIp,
        });
    } catch (error) {
        console.error('Auth check error:', error);
        return NextResponse.json(
            { authenticated: false, message: 'Failed to check session' },
            { status: 500 }
        );
    }
}
