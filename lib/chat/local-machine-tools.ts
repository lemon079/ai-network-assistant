/**
 * Local Machine Network Tools
 * 
 * Tools for getting network information about the local machine (the server running this app).
 * These tools use Node.js built-in modules (os, dns) and don't require router access.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as os from 'os';
import * as dns from 'dns';

/**
 * Get formatted network interface information
 */
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const result: {
        name: string;
        mac: string;
        ipv4?: string;
        ipv6?: string;
        internal: boolean;
    }[] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
        if (!addresses) continue;

        const iface: { name: string; mac: string; ipv4?: string; ipv6?: string; internal: boolean } = {
            name,
            mac: addresses[0]?.mac || 'unknown',
            internal: addresses[0]?.internal || false,
        };

        for (const addr of addresses) {
            if (addr.family === 'IPv4') {
                iface.ipv4 = addr.address;
            } else if (addr.family === 'IPv6' && !addr.address.startsWith('fe80')) {
                iface.ipv6 = addr.address;
            }
        }

        result.push(iface);
    }

    return result;
}

/**
 * Get the primary local IP address (non-internal IPv4)
 */
function getPrimaryLocalIP(): string {
    const interfaces = os.networkInterfaces();

    for (const addresses of Object.values(interfaces)) {
        if (!addresses) continue;
        for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return '127.0.0.1';
}

// ============ LOCAL MACHINE TOOLS ============

export const getLocalIP = tool(
    async () => {
        try {
            const ip = getPrimaryLocalIP();
            const hostname = os.hostname();
            return JSON.stringify({
                localIP: ip,
                hostname: hostname,
                message: `Your local machine IP address is ${ip} (hostname: ${hostname})`
            }, null, 2);
        } catch (error: any) {
            return `Error getting local IP: ${error.message}`;
        }
    },
    {
        name: 'getLocalIP',
        description: 'Get the local machine IP address and hostname. Use this when the user asks about their own machine/computer IP address.',
        schema: z.object({}),
    }
);

export const getLocalNetworkInterfaces = tool(
    async () => {
        try {
            const interfaces = getNetworkInterfaces();
            return JSON.stringify(interfaces, null, 2);
        } catch (error: any) {
            return `Error getting network interfaces: ${error.message}`;
        }
    },
    {
        name: 'getLocalNetworkInterfaces',
        description: 'Get all network interfaces on the local machine including WiFi, Ethernet, and virtual adapters with their IP and MAC addresses.',
        schema: z.object({}),
    }
);

export const getLocalSystemInfo = tool(
    async () => {
        try {
            const info = {
                hostname: os.hostname(),
                platform: os.platform(),
                osType: os.type(),
                osRelease: os.release(),
                architecture: os.arch(),
                cpuCores: os.cpus().length,
                totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
                freeMemoryGB: (os.freemem() / (1024 ** 3)).toFixed(2),
                uptime: `${(os.uptime() / 3600).toFixed(1)} hours`,
            };
            return JSON.stringify(info, null, 2);
        } catch (error: any) {
            return `Error getting system info: ${error.message}`;
        }
    },
    {
        name: 'getLocalSystemInfo',
        description: 'Get local machine system information including OS, hostname, CPU cores, memory, and uptime.',
        schema: z.object({}),
    }
);

export const resolveDomain = tool(
    async ({ domain }: { domain: string }) => {
        try {
            return new Promise((resolve) => {
                dns.lookup(domain, { all: true }, (err, addresses) => {
                    if (err) {
                        resolve(`Could not resolve ${domain}: ${err.message}`);
                        return;
                    }
                    const result = {
                        domain,
                        addresses: addresses.map((a: any) => ({
                            address: a.address,
                            family: a.family === 4 ? 'IPv4' : 'IPv6'
                        }))
                    };
                    resolve(JSON.stringify(result, null, 2));
                });
            });
        } catch (error: any) {
            return `Error resolving domain: ${error.message}`;
        }
    },
    {
        name: 'resolveDomain',
        description: 'Resolve a domain name to its IP addresses using DNS lookup.',
        schema: z.object({
            domain: z.string().describe('The domain name to resolve (e.g., google.com)')
        }),
    }
);

export const getDefaultGateway = tool(
    async () => {
        try {
            // Get default gateway from environment or common patterns
            const interfaces = os.networkInterfaces();
            let localIP = getPrimaryLocalIP();

            // Common gateway pattern: x.x.x.1
            const parts = localIP.split('.');
            if (parts.length === 4) {
                parts[3] = '1';
                const likelyGateway = parts.join('.');

                return JSON.stringify({
                    localIP,
                    probableGateway: likelyGateway,
                    note: 'This is the most common gateway address based on your IP. Your actual gateway may differ.'
                }, null, 2);
            }

            return JSON.stringify({ localIP, note: 'Could not determine gateway' }, null, 2);
        } catch (error: any) {
            return `Error getting gateway info: ${error.message}`;
        }
    },
    {
        name: 'getDefaultGateway',
        description: 'Get the probable default gateway (router) address based on local machine IP.',
        schema: z.object({}),
    }
);

// Export all local machine tools as an array
export function createLocalMachineTools() {
    return [
        getLocalIP,
        getLocalNetworkInterfaces,
        getLocalSystemInfo,
        resolveDomain,
        getDefaultGateway,
    ];
}
