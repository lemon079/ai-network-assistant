// Script to fetch HTML from advanced settings pages using DB session
import { PTCLRouterAdapter } from '../lib/adapters/ptcl';
import { prisma } from '../prisma/prisma';

async function main() {
    // Get session from database
    const session = await prisma.routerSession.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!session) {
        console.error('No session found in database. Please login first.');
        process.exit(1);
    }

    const cookies = session.cookies as Array<{ name: string; value: string }>;
    const sessionCookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    console.log(`Using session for router: ${session.routerIp}`);

    const adapter = new PTCLRouterAdapter(session.routerIp, sessionCookie);

    const endpoints = [
        { name: 'WiFi Basic', path: '/cgi-bin/wlan_basic.asp' },
        { name: 'WiFi Security', path: '/cgi-bin/wlan_security.asp' },
        { name: 'Parental Control', path: '/cgi-bin/access_parental.asp' },
        { name: 'QoS', path: '/cgi-bin/adv_qos.asp' },
        { name: 'Firewall', path: '/cgi-bin/adv_firewall.asp' },
        { name: 'DNS/DDNS', path: '/cgi-bin/access_ddns.asp' },
    ];

    for (const endpoint of endpoints) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${endpoint.name}: ${endpoint.path}`);
        console.log('='.repeat(60));

        try {
            const html = await (adapter as any).fetchPage(endpoint.path);
            console.log(html.slice(0, 6000)); // First 6000 chars
        } catch (error: any) {
            console.error(`Error fetching ${endpoint.name}:`, error.message);
        }
    }

    await prisma.$disconnect();
}

main();
