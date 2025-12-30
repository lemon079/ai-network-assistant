import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ZTERouterAdapter } from '@/lib/adapters/zte';

// Helper to format tool errors with session expiration detection
function formatToolError(error: any, operation: string): string {
    const message = error?.message || '';
    if (message.toLowerCase().includes('session expired') ||
        message.includes('401') ||
        message.includes('403')) {
        return 'Session expired - please re-login to your router';
    }
    return `Error ${operation}: ${message}`;
}

// Factory to create tools with a specific adapter instance
export function createRouterTools(adapter: ZTERouterAdapter) {
    const getDeviceInfo = tool(
        async () => {
            try {
                const info = await adapter.getDeviceInfo();
                return JSON.stringify(info, null, 2);
            } catch (error: any) {
                return formatToolError(error, 'fetching device info');
            }
        },
        {
            name: 'getDeviceInfo',
            description: 'Get router device information including model, firmware version, MAC address, LAN IP, subnet mask, gateway, and DNS servers.',
            schema: z.object({}),
        }
    );

    const getWanInfo = tool(
        async () => {
            try {
                const info = await adapter.getWanInfo();
                return JSON.stringify(info, null, 2);
            } catch (error: any) {
                return formatToolError(error, 'fetching WAN info');
            }
        },
        {
            name: 'getWanInfo',
            description: 'Get WAN connection information including WAN IP address, PPPoE connection status, and DSL mode/modulation.',
            schema: z.object({}),
        }
    );

    const getConnectedDevices = tool(
        async () => {
            try {
                const devices = await adapter.getConnectedDevices();
                return JSON.stringify(devices, null, 2);
            } catch (error: any) {
                return formatToolError(error, 'fetching connected devices');
            }
        },
        {
            name: 'getConnectedDevices',
            description: 'Get list of all devices currently connected to the network. Returns hostname, IP address, and MAC address for each device.',
            schema: z.object({}),
        }
    );

    const getDslStats = tool(
        async () => {
            try {
                const stats = await adapter.getDslStats();
                return JSON.stringify(stats, null, 2);
            } catch (error: any) {
                return `Error fetching DSL stats: ${error.message}`;
            }
        },
        {
            name: 'getDslStats',
            description: 'Get DSL line statistics including SNR margin, line attenuation, data rate (downstream/upstream), and line state.',
            schema: z.object({}),
        }
    );

    const getWlanStats = tool(
        async () => {
            try {
                const stats = await adapter.getWlanStats();
                return JSON.stringify(stats, null, 2);
            } catch (error: any) {
                return `Error fetching WLAN stats: ${error.message}`;
            }
        },
        {
            name: 'getWlanStats',
            description: 'Get wireless network statistics including packets sent/received, transmission errors, and dropped packets.',
            schema: z.object({}),
        }
    );

    const getLanStats = tool(
        async () => {
            try {
                const stats = await adapter.getLanStats();
                return JSON.stringify(stats, null, 2);
            } catch (error: any) {
                return `Error fetching LAN stats: ${error.message}`;
            }
        },
        {
            name: 'getLanStats',
            description: 'Get LAN port statistics showing status (Up/NoLink), bytes and packets sent/received for each Ethernet port (LAN1-LAN4).',
            schema: z.object({}),
        }
    );

    const getDhcpLeases = tool(
        async () => {
            try {
                const leases = await adapter.getDhcpLeases();
                return JSON.stringify(leases, null, 2);
            } catch (error: any) {
                return `Error fetching DHCP leases: ${error.message}`;
            }
        },
        {
            name: 'getDhcpLeases',
            description: 'Get DHCP lease table showing all devices that have been assigned IP addresses, including hostname, IP, MAC, and lease time remaining.',
            schema: z.object({}),
        }
    );

    const getWifiClients = tool(
        async () => {
            try {
                const status = await adapter.getWifiStatus();
                return JSON.stringify(status, null, 2);
            } catch (error: any) {
                return `Error fetching WiFi clients: ${error.message}`;
            }
        },
        {
            name: 'getWifiClients',
            description: 'Get list of devices currently connected via WiFi, showing their MAC addresses.',
            schema: z.object({}),
        }
    );

    const getWifiSettings = tool(
        async () => {
            try {
                const settings = await adapter.getWirelessSettings();
                return `WiFi Settings:\n• Network Name (SSID): ${settings.ssid}\n• Status: ${settings.enabled ? 'Enabled' : 'Disabled'}\n• Channel: ${settings.channel}\n• Security: ${settings.security}\n• Hidden SSID: ${settings.hiddenSsid ? 'Yes' : 'No'}`;
            } catch (error: any) {
                return formatToolError(error, 'fetching WiFi settings');
            }
        },
        {
            name: 'getWifiSettings',
            description: 'Get WiFi settings including network name (SSID), channel, security type, and whether WiFi is enabled.',
            schema: z.object({}),
        }
    );

    const restartRouter = tool(
        async ({ confirm }: { confirm: boolean }) => {
            if (!confirm) {
                return 'Restart cancelled. User must confirm the restart action.';
            }
            try {
                const success = await adapter.restart();
                if (success) {
                    return 'Router restart initiated successfully. The router will restart and may be offline for 1-2 minutes.';
                } else {
                    return 'Failed to initiate router restart. Please try again or check the router manually.';
                }
            } catch (error: any) {
                return `Error restarting router: ${error.message}`;
            }
        },
        {
            name: 'restartRouter',
            description: 'Restart the router. This will disconnect all devices temporarily. Only use when explicitly requested by the user. Always ask for confirmation first.',
            schema: z.object({
                confirm: z.boolean().describe('Must be true to confirm the restart. Ask user for confirmation before setting this to true.')
            }),
        }
    );

    // ========== ADVANCED SETTINGS TOOLS ==========

    const getParentalControl = tool(
        async () => {
            try {
                const settings = await adapter.getParentalControl();
                return JSON.stringify(settings, null, 2);
            } catch (error: any) {
                return `Error fetching parental control settings: ${error.message}`;
            }
        },
        {
            name: 'getParentalControl',
            description: 'Get parental control settings including enabled status and any configured rules with MAC addresses and time schedules.',
            schema: z.object({}),
        }
    );

    const getQosSettings = tool(
        async () => {
            try {
                const settings = await adapter.getQosSettings();
                return JSON.stringify(settings, null, 2);
            } catch (error: any) {
                return `Error fetching QoS settings: ${error.message}`;
            }
        },
        {
            name: 'getQosSettings',
            description: 'Get Quality of Service (QoS) settings including enabled status, bandwidth limits, and priority rules for traffic management.',
            schema: z.object({}),
        }
    );

    const getFirewallSettings = tool(
        async () => {
            try {
                const settings = await adapter.getFirewallSettings();
                return JSON.stringify(settings, null, 2);
            } catch (error: any) {
                return `Error fetching firewall settings: ${error.message}`;
            }
        },
        {
            name: 'getFirewallSettings',
            description: 'Get firewall settings including firewall enabled status, SPI (Stateful Packet Inspection) status, and DoS protection.',
            schema: z.object({}),
        }
    );

    const getDdnsSettings = tool(
        async () => {
            try {
                const settings = await adapter.getDdnsSettings();
                return JSON.stringify(settings, null, 2);
            } catch (error: any) {
                return `Error fetching DDNS settings: ${error.message}`;
            }
        },
        {
            name: 'getDdnsSettings',
            description: 'Get Dynamic DNS (DDNS) settings including enabled status, provider, hostname, and username configuration.',
            schema: z.object({}),
        }
    );

    // ========== WIFI SETTINGS TOOLS ==========

    const setWifiSsid = tool(
        async ({ ssid, confirm }) => {
            if (!confirm) {
                return 'Please confirm you want to change the WiFi SSID. This will disconnect all devices and they will need to reconnect to the new network name.';
            }
            try {
                const result = await adapter.setWifiSsid(ssid);
                return result.success
                    ? `✅ WiFi SSID changed to "${ssid}". All devices will need to reconnect.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return `Error changing SSID: ${error.message}`;
            }
        },
        {
            name: 'setWifiSsid',
            description: 'Change the WiFi network name (SSID). WARNING: This will disconnect all devices. Always ask for user confirmation first.',
            schema: z.object({
                ssid: z.string().min(1).max(32).describe('New WiFi network name (1-32 characters)'),
                confirm: z.boolean().describe('Must be true to confirm the change. Ask user for confirmation before setting this to true.')
            }),
        }
    );

    const setWifiPassword = tool(
        async ({ password, confirm }) => {
            if (!confirm) {
                return 'Please confirm you want to change the WiFi password. This will disconnect all devices and they will need to reconnect with the new password.';
            }
            try {
                const result = await adapter.setWifiPassword(password);
                return result.success
                    ? `✅ WiFi password changed successfully. All devices will need to reconnect with the new password.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return `Error changing password: ${error.message}`;
            }
        },
        {
            name: 'setWifiPassword',
            description: 'Change the WiFi password. WARNING: This will disconnect all devices. Password must be 8-63 characters. Always ask for user confirmation first.',
            schema: z.object({
                password: z.string().min(8).max(63).describe('New WiFi password (8-63 characters)'),
                confirm: z.boolean().describe('Must be true to confirm the change. Ask user for confirmation before setting this to true.')
            }),
        }
    );

    const setWifiEnabled = tool(
        async ({ enabled, confirm }) => {
            if (!confirm) {
                const action = enabled ? 'enable' : 'disable';
                return `Please confirm you want to ${action} WiFi. ${enabled ? 'This will allow devices to connect.' : 'This will disconnect all WiFi devices.'}`;
            }
            try {
                const result = await adapter.setWifiEnabled(enabled);
                return result.success
                    ? `✅ WiFi has been ${enabled ? 'enabled' : 'disabled'}.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return `Error: ${error.message}`;
            }
        },
        {
            name: 'setWifiEnabled',
            description: 'Enable or disable WiFi. WARNING: Disabling will disconnect all WiFi devices. Always ask for user confirmation first.',
            schema: z.object({
                enabled: z.boolean().describe('True to enable WiFi, false to disable'),
                confirm: z.boolean().describe('Must be true to confirm the change. Ask user for confirmation before setting this to true.')
            }),
        }
    );

    const setWifiChannel = tool(
        async ({ channel, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to change the WiFi channel to ${channel === 0 ? 'Auto' : channel}. This may briefly disconnect devices.`;
            }
            try {
                const result = await adapter.setWifiChannel(channel);
                return result.success
                    ? `✅ WiFi channel changed to ${channel === 0 ? 'Auto' : channel}.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return `Error changing channel: ${error.message}`;
            }
        },
        {
            name: 'setWifiChannel',
            description: 'Change the WiFi channel. Use 0 for auto, or 1-14 for specific channels. Always ask for user confirmation first.',
            schema: z.object({
                channel: z.number().min(0).max(14).describe('WiFi channel (0 = auto, 1-14 for specific channel)'),
                confirm: z.boolean().describe('Must be true to confirm the change. Ask user for confirmation before setting this to true.')
            }),
        }
    );

    // ========== NETWORK DIAGNOSTIC TOOLS ==========

    const pingWebsite = tool(
        async ({ host }) => {
            try {
                const { pingHost } = await import('@/lib/network/diagnostics');
                const result = await pingHost(host, 4);
                if (result.alive) {
                    return `✅ ${host} is reachable\n• Latency: ${result.time}\n• Packet Loss: ${result.packetLoss}\n• Min/Avg/Max: ${result.min}/${result.avg}/${result.max}`;
                } else {
                    return `❌ ${host} is not reachable\n• Error: ${result.error || 'Host unreachable'}`;
                }
            } catch (error: any) {
                return `Error pinging ${host}: ${error.message}`;
            }
        },
        {
            name: 'pingWebsite',
            description: 'Ping a website or IP address to check if it is reachable and measure latency. Use this to test connectivity to specific hosts.',
            schema: z.object({
                host: z.string().describe('Website domain or IP address to ping (e.g., "google.com" or "8.8.8.8")')
            }),
        }
    );

    const lookupDns = tool(
        async ({ hostname }) => {
            try {
                const { resolveDns } = await import('@/lib/network/diagnostics');
                const result = await resolveDns(hostname);
                if (result.addresses.length > 0) {
                    return `DNS lookup for ${hostname}:\n${result.addresses.map(ip => `• ${ip}`).join('\n')}`;
                } else {
                    return `❌ Could not resolve ${hostname}: ${result.error || 'No addresses found'}`;
                }
            } catch (error: any) {
                return `Error looking up ${hostname}: ${error.message}`;
            }
        },
        {
            name: 'lookupDns',
            description: 'Perform DNS lookup to resolve a hostname to IP addresses. Use this to check if DNS is working properly.',
            schema: z.object({
                hostname: z.string().describe('Domain name to lookup (e.g., "google.com")')
            }),
        }
    );

    const checkInternetConnectivity = tool(
        async () => {
            try {
                const { checkConnectivity } = await import('@/lib/network/diagnostics');
                const result = await checkConnectivity();
                const status = [];
                status.push(`• Internet: ${result.internet ? '✅ Connected' : '❌ Not connected'}`);
                status.push(`• DNS: ${result.dns ? '✅ Working' : '❌ Not working'}`);
                status.push(`• Latency: ${result.latency}`);
                return `Internet Connectivity Status:\n${status.join('\n')}`;
            } catch (error: any) {
                return `Error checking connectivity: ${error.message}`;
            }
        },
        {
            name: 'checkInternetConnectivity',
            description: 'Check overall internet connectivity status including DNS resolution and latency to public servers.',
            schema: z.object({}),
        }
    );

    const checkPortOpen = tool(
        async ({ host, port }) => {
            try {
                const { checkPort } = await import('@/lib/network/diagnostics');
                const result = await checkPort(host, port);
                if (result.open) {
                    return `✅ Port ${port} on ${host} is OPEN (latency: ${result.latency})`;
                } else {
                    return `❌ Port ${port} on ${host} is CLOSED or filtered\n• Reason: ${result.error || 'Connection refused'}`;
                }
            } catch (error: any) {
                return `Error checking port: ${error.message}`;
            }
        },
        {
            name: 'checkPortOpen',
            description: 'Check if a specific TCP port is open on a host. Useful for testing if services are accessible.',
            schema: z.object({
                host: z.string().describe('Host to check (domain or IP)'),
                port: z.number().min(1).max(65535).describe('Port number to check (1-65535)')
            }),
        }
    );

    // ========== QOS SETTINGS TOOLS ==========

    const setQosEnabled = tool(
        async ({ enabled, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to ${enabled ? 'enable' : 'disable'} QoS (Quality of Service). This controls traffic prioritization on your network.`;
            }
            try {
                const result = await adapter.setQosEnabled(enabled);
                return result.success
                    ? `✅ QoS has been ${enabled ? 'enabled' : 'disabled'}.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'toggling QoS');
            }
        },
        {
            name: 'setQosEnabled',
            description: 'Enable or disable Quality of Service (QoS) for traffic prioritization. Always ask for user confirmation first.',
            schema: z.object({
                enabled: z.boolean().describe('True to enable QoS, false to disable'),
                confirm: z.boolean().describe('Must be true to confirm. Ask user first.')
            }),
        }
    );

    const addQosRule = tool(
        async ({ protocol, sourceIp, destIp, destPort, priority, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to add a QoS rule for ${protocol || 'all'} traffic${destPort ? ` on port ${destPort}` : ''} with priority ${priority}.`;
            }
            try {
                const result = await adapter.addQosRule({
                    protocol: protocol as any,
                    sourceIp,
                    destIp,
                    destPort,
                    priority: priority as any
                });
                return result.success
                    ? `✅ QoS rule added successfully.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'adding QoS rule');
            }
        },
        {
            name: 'addQosRule',
            description: 'Add a QoS traffic prioritization rule. Priority 0-7 (higher = more priority).',
            schema: z.object({
                protocol: z.enum(['TCP/UDP', 'TCP', 'UDP', 'ICMP', 'IGMP']).optional().describe('Protocol to prioritize'),
                sourceIp: z.string().optional().describe('Source IP address to match'),
                destIp: z.string().optional().describe('Destination IP address to match'),
                destPort: z.number().optional().describe('Destination port to prioritize'),
                priority: z.number().min(0).max(7).describe('Priority level (0-7, higher = more priority)'),
                confirm: z.boolean().describe('Must be true to confirm.')
            }),
        }
    );

    // ========== PORT FORWARDING TOOLS ==========

    const addPortForwarding = tool(
        async ({ name, protocol, externalPort, internalIp, internalPort, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to add port forwarding: ${name} - ${protocol} port ${externalPort} → ${internalIp}:${internalPort || externalPort}`;
            }
            try {
                const result = await adapter.addPortForwardingRule({
                    name,
                    protocol: protocol as any,
                    externalPort,
                    internalIp,
                    internalPort
                });
                return result.success
                    ? `✅ ${result.message}`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'adding port forwarding rule');
            }
        },
        {
            name: 'addPortForwarding',
            description: 'Add a port forwarding rule to allow external access to internal services. Always ask for user confirmation.',
            schema: z.object({
                name: z.string().describe('Name/description for the rule'),
                protocol: z.enum(['TCP', 'UDP', 'ALL']).describe('Protocol (TCP, UDP, or ALL)'),
                externalPort: z.number().min(1).max(65535).describe('External port number'),
                internalIp: z.string().describe('Internal IP address to forward to'),
                internalPort: z.number().optional().describe('Internal port (defaults to external port)'),
                confirm: z.boolean().describe('Must be true to confirm.')
            }),
        }
    );

    // ========== MAC FILTER / DEVICE BLOCKING TOOLS ==========

    const blockDevice = tool(
        async ({ macAddress, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to BLOCK device with MAC address: ${macAddress}. This will prevent the device from accessing the network.`;
            }
            try {
                const result = await adapter.blockDevice(macAddress);
                return result.success
                    ? `✅ Device ${macAddress} has been blocked.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'blocking device');
            }
        },
        {
            name: 'blockDevice',
            description: 'Block a device from the network by its MAC address. Always ask for user confirmation first.',
            schema: z.object({
                macAddress: z.string().describe('MAC address to block (format: XX:XX:XX:XX:XX:XX)'),
                confirm: z.boolean().describe('Must be true to confirm.')
            }),
        }
    );

    const allowDevice = tool(
        async ({ macAddress, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to ALLOW/unblock device with MAC address: ${macAddress}.`;
            }
            try {
                const result = await adapter.allowDevice(macAddress);
                return result.success
                    ? `✅ Device ${macAddress} has been allowed.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'allowing device');
            }
        },
        {
            name: 'allowDevice',
            description: 'Unblock/allow a previously blocked device by its MAC address.',
            schema: z.object({
                macAddress: z.string().describe('MAC address to allow (format: XX:XX:XX:XX:XX:XX)'),
                confirm: z.boolean().describe('Must be true to confirm.')
            }),
        }
    );

    // ========== LAN/DHCP SETTINGS TOOLS ==========

    const setDhcpEnabled = tool(
        async ({ enabled, confirm }) => {
            if (!confirm) {
                return `Please confirm you want to ${enabled ? 'enable' : 'disable'} the DHCP server. ${!enabled ? 'Devices may lose their IP addresses.' : ''}`;
            }
            try {
                const result = await adapter.setDhcpEnabled(enabled);
                return result.success
                    ? `✅ DHCP server ${enabled ? 'enabled' : 'disabled'}.`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'toggling DHCP');
            }
        },
        {
            name: 'setDhcpEnabled',
            description: 'Enable or disable the DHCP server. Always ask for confirmation.',
            schema: z.object({
                enabled: z.boolean().describe('True to enable, false to disable'),
                confirm: z.boolean().describe('Must be true to confirm.')
            }),
        }
    );

    // ========== ADMIN SETTINGS TOOLS ==========

    const setAdminPassword = tool(
        async ({ newPassword, confirm }) => {
            if (!confirm) {
                return `⚠️ Please confirm you want to change the router admin password. Make sure to remember the new password!`;
            }
            try {
                const result = await adapter.setAdminPassword(newPassword);
                return result.success
                    ? `✅ ${result.message}`
                    : `❌ Failed: ${result.message}`;
            } catch (error: any) {
                return formatToolError(error, 'changing admin password');
            }
        },
        {
            name: 'setAdminPassword',
            description: 'Change the router admin login password. Always ask for user confirmation first.',
            schema: z.object({
                newPassword: z.string().min(1).describe('New admin password'),
                confirm: z.boolean().describe('Must be true to confirm.')
            }),
        }
    );

    return [
        getDeviceInfo,
        getWanInfo,
        getConnectedDevices,
        getDslStats,
        getWlanStats,
        getLanStats,
        getDhcpLeases,
        getWifiClients,
        getWifiSettings,
        restartRouter,
        // Advanced settings (getters)
        getParentalControl,
        getQosSettings,
        getFirewallSettings,
        getDdnsSettings,
        // WiFi settings (setters)
        setWifiSsid,
        setWifiPassword,
        setWifiEnabled,
        setWifiChannel,
        // QoS settings (setters)
        setQosEnabled,
        addQosRule,
        // Port forwarding (setters)
        addPortForwarding,
        // Device blocking (setters)
        blockDevice,
        allowDevice,
        // LAN/DHCP settings (setters)
        setDhcpEnabled,
        // Admin settings (setters)
        setAdminPassword,
        // Network diagnostics
        pingWebsite,
        lookupDns,
        checkInternetConnectivity,
        checkPortOpen,
    ];
}
