import { NextResponse } from 'next/server';
import si from 'systeminformation';

interface RouterInfo {
    name: string;
    ip: string;
}

// Check if IP is a valid private network address (not VPN)
function isValidPrivateIP(ip: string): boolean {
    // Filter out VPN addresses like Hamachi (25.x.x.x, 26.x.x.x)
    if (ip.startsWith('25.') || ip.startsWith('26.')) {
        return false;
    }

    // Valid private IP ranges
    const privateRanges = [
        /^10\./,                    // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
        /^192\.168\./               // 192.168.0.0/16
    ];

    return privateRanges.some(range => range.test(ip));
}

// Detect router type based on IP
async function detectRouterType(gateway: string): Promise<RouterInfo> {
    const commonRouters: Record<string, string> = {
        '192.168.1.1': 'Generic Router',
        '192.168.0.1': 'Generic Router',
        '192.168.2.1': 'Generic Router',
        '192.168.10.1': 'Generic Router',
        '10.0.0.1': 'Generic Router',
        '10.0.0.138': 'Generic Router',
    };

    const name = commonRouters[gateway] || 'Generic Router';
    return { name, ip: gateway };
}

// Find the best gateway by checking network interfaces
async function findBestGateway(): Promise<string | null> {
    try {
        const interfaces = await si.networkInterfaces();

        // Hard-prioritize real local networks
        const candidates = interfaces
            .filter(iface => {
                const name = iface.iface.toLowerCase();

                // ignore tunnels, VPNs, virtual crap
                if (
                    name.includes('vpn') ||
                    name.includes('hamachi') ||
                    name.includes('radmin') ||
                    name.includes('virtual') ||
                    name.includes('vEthernet'.toLowerCase()) ||
                    name.includes('loopback') ||
                    name.includes('pseudo')
                ) return false;

                // must have IPv4
                if (!iface.ip4) return false;

                // must be private local IP, not 172.24.x.x (WSL)
                return isValidPrivateIP(iface.ip4);
            })
            .sort((a, b) => {
                // WIFI gets highest priority
                if (a.type === 'wireless' && b.type !== 'wireless') return -1;
                if (b.type === 'wireless' && a.type !== 'wireless') return 1;
                return 0;
            });

        if (candidates.length === 0) return null;

        const iface = candidates[0];
        const parts = iface.ip4.split('.');
        return `${parts[0]}.${parts[1]}.${parts[2]}.1`;

    } catch (err) {
        console.error('Gateway detection failed:', err);
        return null;
    }
}

export async function GET() {
    try {
        // Find the best gateway
        const gateway = await findBestGateway();

        if (!gateway) {
            return NextResponse.json(
                { found: false, message: 'No valid router gateway found. Please ensure you are connected to a local network.' },
                { status: 404 }
            );
        }

        console.log('Detecting router at', gateway);

        // Detect router type
        const routerInfo = await detectRouterType(gateway);

        return NextResponse.json({
            found: true,
            router: routerInfo
        });
    } catch (error) {
        console.error('Router detection error:', error);
        return NextResponse.json(
            { found: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
