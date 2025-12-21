/**
 * API Route: Fetch all router settings pages HTML
 * 
 * This crawls the router, fetches each settings page, and returns their HTML content.
 * Use this to analyze form fields for creating setter tools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/router/session-manager';
import { PTCLRouterAdapter } from '@/lib/adapters/ptcl';

// Settings pages to fetch (common PTCL router pages)
const SETTINGS_PAGES = [
    // Basic Settings
    '/cgi-bin/home_lan.asp',           // LAN/DHCP settings
    '/cgi-bin/home_wan.asp',           // WAN settings
    '/cgi-bin/home_wireless.asp',      // Basic wireless

    // Wireless Settings
    '/cgi-bin/wlan_basic.asp',         // WiFi basic (SSID, channel)
    '/cgi-bin/wlan_security.asp',      // WiFi security (password)
    '/cgi-bin/wlan_access.asp',        // WiFi access control

    // Advanced Settings
    '/cgi-bin/adv_nat_virsvr.asp',     // Port forwarding / Virtual servers
    '/cgi-bin/adv_nat_top.asp',        // NAT settings
    '/cgi-bin/adv_firewall.asp',       // Firewall settings
    '/cgi-bin/adv_qos.asp',            // QoS settings
    '/cgi-bin/adv_routing.asp',        // Routing

    // Access Control
    '/cgi-bin/access_macfilter.asp',   // MAC filtering / Device blocking
    '/cgi-bin/access_ipfilter.asp',    // IP filtering
    '/cgi-bin/access_parental.asp',    // Parental controls
    '/cgi-bin/access_ddns.asp',        // Dynamic DNS
    '/cgi-bin/access_upnp.asp',        // UPnP settings

    // System Tools
    '/cgi-bin/tools_system.asp',       // System (restart, reset)
    '/cgi-bin/tools_time.asp',         // Time settings
    '/cgi-bin/tools_admin.asp',        // Admin password
];

export async function GET(request: NextRequest) {
    try {
        // Get router session
        const session = await getSession();
        if (!session) {
            return NextResponse.json({
                error: 'Not logged in to router. Please login first via /setup'
            }, { status: 401 });
        }

        // Create adapter
        const cookieString = session.cookies.map(c => `${c.name}=${c.value}`).join('; ');
        const adapter = new PTCLRouterAdapter(session.routerIp, cookieString);

        // Results
        const results: {
            page: string;
            status: 'success' | 'error';
            html?: string;
            error?: string;
            forms?: {
                action: string;
                method: string;
                inputs: { name: string; type: string; value?: string }[];
            }[];
        }[] = [];

        // Fetch each page
        for (const page of SETTINGS_PAGES) {
            try {
                const html = await adapter['fetchPage'](page);

                // Extract form info using regex (simple extraction)
                const formRegex = /<form[^>]*action=["']([^"']*)["'][^>]*method=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi;
                const inputRegex = /<input[^>]*name=["']([^"']*)["'][^>]*/gi;
                const typeRegex = /type=["']([^"']*?)["']/i;
                const valueRegex = /value=["']([^"']*?)["']/i;

                const forms: { action: string; method: string; inputs: { name: string; type: string; value?: string }[] }[] = [];
                let formMatch;

                while ((formMatch = formRegex.exec(html)) !== null) {
                    const action = formMatch[1];
                    const method = formMatch[2];
                    const formContent = formMatch[3];

                    const inputs: { name: string; type: string; value?: string }[] = [];
                    let inputMatch;

                    while ((inputMatch = inputRegex.exec(formContent)) !== null) {
                        const inputTag = inputMatch[0];
                        const name = inputMatch[1];
                        const typeMatch = inputTag.match(typeRegex);
                        const valueMatch = inputTag.match(valueRegex);

                        inputs.push({
                            name,
                            type: typeMatch?.[1] || 'text',
                            value: valueMatch?.[1]
                        });
                    }

                    forms.push({ action, method, inputs });
                }

                results.push({
                    page,
                    status: 'success',
                    html: html.substring(0, 50000), // Limit size
                    forms
                });

            } catch (error: any) {
                results.push({
                    page,
                    status: 'error',
                    error: error.message || 'Failed to fetch'
                });
            }
        }

        return NextResponse.json({
            routerIp: session.routerIp,
            pagesChecked: SETTINGS_PAGES.length,
            successCount: results.filter(r => r.status === 'success').length,
            results
        });

    } catch (error: any) {
        console.error('[Fetch Settings] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to fetch settings pages'
        }, { status: 500 });
    }
}
