/**
 * Network Diagnostic Utilities
 * Provides ping, DNS lookup, and connectivity checks
 */

import ping from 'ping';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);
const dnsResolve = promisify(dns.resolve);

// ============ PING ============

export interface PingResult {
    host: string;
    alive: boolean;
    time: string;
    packetLoss: string | number;
    min: string;
    max: string;
    avg: string;
    error?: string;
}

/**
 * Ping a host and return latency info
 */
export async function pingHost(host: string, count: number = 4): Promise<PingResult> {
    try {
        const result = await ping.promise.probe(host, {
            timeout: 5,
            extra: process.platform === 'win32' ? ['-n', count.toString()] : ['-c', count.toString()]
        });

        return {
            host,
            alive: result.alive,
            time: typeof result.time === 'number' ? `${result.time}ms` : 'N/A',
            packetLoss: result.packetLoss || '0%',
            min: result.min || 'N/A',
            max: result.max || 'N/A',
            avg: result.avg || 'N/A'
        };
    } catch (error: any) {
        return {
            host,
            alive: false,
            time: 'N/A',
            packetLoss: '100%',
            min: 'N/A',
            max: 'N/A',
            avg: 'N/A',
            error: error.message
        };
    }
}

// ============ DNS LOOKUP ============

export interface DnsResult {
    hostname: string;
    addresses: string[];
    error?: string;
}

/**
 * Resolve a hostname to IP addresses
 */
export async function resolveDns(hostname: string): Promise<DnsResult> {
    try {
        // Try to get all addresses
        const addresses = await dnsResolve(hostname);
        return {
            hostname,
            addresses: Array.isArray(addresses) ? addresses : [addresses]
        };
    } catch {
        // Fallback to simple lookup
        try {
            const result = await dnsLookup(hostname);
            return {
                hostname,
                addresses: [result.address]
            };
        } catch (error: any) {
            return {
                hostname,
                addresses: [],
                error: error.message || 'DNS resolution failed'
            };
        }
    }
}

// ============ CONNECTIVITY CHECK ============

export interface ConnectivityResult {
    internet: boolean;
    dns: boolean;
    gateway: boolean;
    latency: string;
    error?: string;
}

/**
 * Check overall internet connectivity
 */
export async function checkConnectivity(gatewayIp?: string): Promise<ConnectivityResult> {
    const result: ConnectivityResult = {
        internet: false,
        dns: false,
        gateway: false,
        latency: 'N/A'
    };

    try {
        // Check gateway (if provided)
        if (gatewayIp) {
            const gatewayPing = await pingHost(gatewayIp, 1);
            result.gateway = gatewayPing.alive;
        }

        // Check DNS
        const dnsResult = await resolveDns('google.com');
        result.dns = dnsResult.addresses.length > 0;

        // Check internet (ping public DNS)
        const internetPing = await pingHost('8.8.8.8', 2);
        result.internet = internetPing.alive;
        result.latency = internetPing.time;

    } catch (error: any) {
        result.error = error.message;
    }

    return result;
}

// ============ TRACEROUTE (simplified) ============

export interface TracerouteHop {
    hop: number;
    ip: string;
    time: string;
}

/**
 * Simple traceroute to a host (limited hops)
 */
export async function traceRoute(host: string, maxHops: number = 10): Promise<TracerouteHop[]> {
    // Note: Full traceroute requires raw sockets which Node.js doesn't support natively
    // This is a simplified version that just pings the target
    const hops: TracerouteHop[] = [];

    try {
        const result = await pingHost(host, 1);
        hops.push({
            hop: 1,
            ip: host,
            time: result.time
        });
    } catch {
        hops.push({
            hop: 1,
            ip: host,
            time: 'timeout'
        });
    }

    return hops;
}

// ============ PORT CHECK ============

import net from 'net';

export interface PortCheckResult {
    host: string;
    port: number;
    open: boolean;
    latency: string;
    error?: string;
}

/**
 * Check if a TCP port is open on a host
 */
export async function checkPort(host: string, port: number, timeout: number = 3000): Promise<PortCheckResult> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            const latency = Date.now() - startTime;
            socket.destroy();
            resolve({
                host,
                port,
                open: true,
                latency: `${latency}ms`
            });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({
                host,
                port,
                open: false,
                latency: 'timeout',
                error: 'Connection timed out'
            });
        });

        socket.on('error', (err: any) => {
            socket.destroy();
            resolve({
                host,
                port,
                open: false,
                latency: 'N/A',
                error: err.message
            });
        });

        socket.connect(port, host);
    });
}

// ============ SPEED TEST (simplified) ============

export interface SpeedTestResult {
    downloadSpeed: string;
    uploadSpeed: string;
    latency: string;
    error?: string;
}

/**
 * Simple speed estimation based on latency to known servers
 * Note: For accurate speed tests, use dedicated APIs or speedtest-net package
 */
export async function estimateSpeed(): Promise<SpeedTestResult> {
    try {
        const pingResult = await pingHost('8.8.8.8', 3);

        // Very rough estimation based on latency
        // This is NOT an accurate speed test
        const latencyMs = parseFloat(pingResult.avg) || 50;

        return {
            downloadSpeed: 'Use speedtest.net for accurate results',
            uploadSpeed: 'Use speedtest.net for accurate results',
            latency: `${latencyMs}ms to Google DNS`
        };
    } catch (error: any) {
        return {
            downloadSpeed: 'N/A',
            uploadSpeed: 'N/A',
            latency: 'N/A',
            error: error.message
        };
    }
}
