import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

// Import types from separate file
import type {
    DeviceInfo,
    WanInfo,
    ArpEntry,
    DhcpLease,
    WifiStatus,
    DslStats,
    LogEntry,
    LanStats,
    PortStats,
    WlanStats,
    AdslStats,
    LanSettings,
    WanService,
    WirelessSettings,
    NatRule,
    FirewallRule,
    QosRule,
    DdnsSettings,
    ParentalControl,
    UpnpStatus,
    IpFilterRule,
    SystemTime,
    RoutingEntry,
    VpnSettings,
    InterfaceGroup,
    UpnpMapping
} from './types';

// ============ ADAPTER CLASS ============

export class PTCLRouterAdapter {
    private ip: string;
    private sessionCookie: string;
    private client: AxiosInstance;

    constructor(ip: string, sessionCookie: string) {
        this.ip = ip;
        this.sessionCookie = sessionCookie;

        this.client = axios.create({
            baseURL: `http://${ip}`,
            headers: {
                'Cookie': sessionCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000,
            validateStatus: (status) => status < 500
        });
    }

    // ============ HELPER METHODS ============

    private async fetchPage(path: string): Promise<string> {
        try {
            const response = await this.client.get(path);
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired');
            }
            return response.data;
        } catch (error: any) {
            console.error(`[PTCL Adapter] Failed to fetch ${path}:`, error.message);
            throw error;
        }
    }

    /** Extract value from td.hd label → td.tabdata value pattern */
    private extractByHdClass($: cheerio.CheerioAPI, label: string): string {
        const cell = $(`td.hd:contains("${label}")`).first();
        return cell.next('td.tabdata').text().trim() || 'N/A';
    }

    /** Fallback: extract by any td containing label */
    private extractByLabel($: cheerio.CheerioAPI, label: string): string {
        return $(`td:contains("${label}")`).first().next('td').text().trim() || 'N/A';
    }

    /** Extract JavaScript array from HTML script (e.g., var ary_wan_ptm8 = [[...], [...]]) */
    private extractJsArray(html: string, arrayName: string): string[][] {
        // Match the array declaration including nested arrays
        const regex = new RegExp(`var\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'm');
        const match = html.match(regex);
        if (!match) return [];

        try {
            // Extract individual rows using a more robust pattern
            const content = match[1];
            const rows: string[][] = [];

            // Match each inner array like ["Yes", "Yes", "1", "39.46.192.1", ...]
            const rowRegex = /\["([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\]/g;
            let rowMatch;

            while ((rowMatch = rowRegex.exec(content)) !== null) {
                rows.push([rowMatch[1], rowMatch[2], rowMatch[3], rowMatch[4], rowMatch[5], rowMatch[6]]);
            }

            return rows;
        } catch {
            return [];
        }
    }

    private parseTable($: cheerio.CheerioAPI, tableSelector: string = 'table'): string[][] {
        const rows: string[][] = [];
        $(`${tableSelector} tr`).each((_, row) => {
            const cols: string[] = [];
            $(row).find('td').each((_, col) => {
                cols.push($(col).text().trim());
            });
            if (cols.length > 0) rows.push(cols);
        });
        return rows;
    }

    // ============ STATUS ENDPOINTS ============

    /** GET /cgi-bin/status_deviceinfo.asp */
    async getDeviceInfo(): Promise<DeviceInfo & {
        hardwareVersion: string;
        serialNumber: string;
        lanIp: string;
        subnetMask: string;
        dhcpEnabled: boolean;
        gateway: string;
        primaryDns: string;
        secondaryDns: string;
    }> {
        const html = await this.fetchPage('/cgi-bin/status_deviceinfo.asp');
        const $ = cheerio.load(html);

        // Extract WAN info from JavaScript arrays (ary_wan_ptm8 for VDSL, ary_wan_pvc8 for ADSL)
        let gateway = 'N/A', primaryDns = 'N/A', secondaryDns = 'N/A';

        // Try VDSL (PTM) array first
        const ptmArray = this.extractJsArray(html, 'ary_wan_ptm8');
        if (ptmArray.length > 0) {
            // Find active connection with default route
            for (const row of ptmArray) {
                if (row[0] === 'Yes' && row[1] === 'Yes' && row[2] === '1') {
                    gateway = row[3] || 'N/A';
                    primaryDns = row[4] || 'N/A';
                    secondaryDns = row[5] || 'N/A';
                    break;
                }
            }
        }

        // Fallback to ADSL (ATM) array
        if (gateway === 'N/A') {
            const pvcArray = this.extractJsArray(html, 'ary_wan_pvc8');
            for (const row of pvcArray) {
                if (row[0] === 'Yes' && row[1] === 'Yes' && row[2] === '1') {
                    gateway = row[3] || 'N/A';
                    primaryDns = row[4] || 'N/A';
                    secondaryDns = row[5] || 'N/A';
                    break;
                }
            }
        }

        return {
            model: this.extractByHdClass($, 'Model Name:'),
            firmwareVersion: this.extractByHdClass($, 'Firmware Version:'),
            hardwareVersion: this.extractByHdClass($, 'Hardware Version:'),
            serialNumber: this.extractByHdClass($, 'Serial Number:'),
            uptime: this.extractByHdClass($, 'Uptime:'),
            lanMac: this.extractByHdClass($, 'MAC Address:'),
            wlanMac: this.extractByHdClass($, 'WLAN MAC:'),
            lanStatus: this.extractByHdClass($, 'LAN Status:'),
            wlanStatus: this.extractByHdClass($, 'WLAN Status:'),
            lanIp: this.extractByHdClass($, 'LAN IPv4 Address:'),
            subnetMask: this.extractByHdClass($, 'Subnet Mask:'),
            dhcpEnabled: this.extractByHdClass($, 'DHCP:').toLowerCase().includes('enabled'),
            gateway,
            primaryDns,
            secondaryDns
        };
    }

    /** GET /cgi-bin/wan.asp */
    async getWanInfo(): Promise<WanInfo> {
        const html = await this.fetchPage('/cgi-bin/wan.asp');
        const $ = cheerio.load(html);

        // WAN info is in pvc8_serv_info array:
        // [active, ipaddr4, ipaddr6, isp, getip, ipversion, vlanID, mld, igmp, nat, staticIPv4, staticIPv6, IPv4_status, IPv6_status]
        let wanIp = 'N/A';
        let connectionStatus = 'N/A';
        let connectionType = 'N/A';

        // Extract pvc8_serv_info array - different format from ary_wan_ptm8
        const pvcServRegex = /var\s+pvc8_serv_info\s*=\s*\[([\s\S]*?)\];/m;
        const pvcMatch = html.match(pvcServRegex);

        if (pvcMatch) {
            // Match rows like ["Yes", "39.46.240.18", "N/A", "2", ...]
            const rowRegex = /\["([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\]/g;
            let rowMatch;

            while ((rowMatch = rowRegex.exec(pvcMatch[1])) !== null) {
                const active = rowMatch[1];
                const ipv4 = rowMatch[2];
                const isp = rowMatch[4]; // 0=Dynamic, 1=Static, 2=PPPoE, 3=Bridge
                const ipv4Status = rowMatch[13];

                if (active === 'Yes' && ipv4 !== 'N/A' && ipv4Status === '1') {
                    wanIp = ipv4;
                    connectionStatus = 'Connected';
                    if (isp === '2') connectionType = 'PPPoE';
                    else if (isp === '0') connectionType = 'Dynamic';
                    else if (isp === '1') connectionType = 'Static';
                    else if (isp === '3') connectionType = 'Bridge';
                    break;
                }
            }
        }

        // Extract DSL mode
        const dslModeMatch = html.match(/var\s+DslMode\s*=\s*"([^"]+)"/);
        const dslMode = dslModeMatch ? dslModeMatch[1] : 'N/A';

        return {
            wanIp,
            pppoeStatus: connectionStatus,
            dslStatus: dslMode,
            gateway: this.extractByHdClass($, 'Default Gateway:') || 'N/A',
            primaryDns: this.extractByHdClass($, 'DNS Server:') || 'N/A',
            secondaryDns: 'N/A' // Secondary DNS not on this page, available in deviceinfo
        };
    }

    /** GET /cgi-bin/arp.asp */
    async getArpTable(): Promise<ArpEntry[]> {
        const html = await this.fetchPage('/cgi-bin/arp.asp');
        const entries: ArpEntry[] = [];

        // Data is in JavaScript variables:
        // temp = "192.168.10.7,192.168.10.4,...";
        // var arpIPaddress=temp.split(',');
        // temp="a8:6d:aa:12:a3:5e,d4:17:61:0d:b4:10,...";
        // var arpHWaddress=temp.split(',');
        // temp="br0,br0,...";
        // var arpDevice=temp.split(',');

        // Extract IP addresses
        const ipMatch = html.match(/temp\s*=\s*"([^"]+)";\s*var\s+arpIPaddress/);
        const macMatch = html.match(/temp\s*=\s*"([^"]+)";\s*var\s+arpHWaddress/);
        const deviceMatch = html.match(/temp\s*=\s*"([^"]+)";\s*var\s+arpDevice/);

        if (ipMatch && macMatch) {
            const ips = ipMatch[1].split(',').filter(s => s.trim());
            const macs = macMatch[1].split(',').filter(s => s.trim());
            const devices = deviceMatch ? deviceMatch[1].split(',').filter(s => s.trim()) : [];

            for (let i = 0; i < ips.length; i++) {
                if (ips[i] && ips[i] !== 'N/A') {
                    entries.push({
                        ip: ips[i],
                        mac: macs[i] || 'N/A',
                        interface: devices[i] || 'br0'
                    });
                }
            }
        }

        return entries;
    }

    /** GET /cgi-bin/dhcpinfo.asp */
    async getDhcpLeases(): Promise<DhcpLease[]> {
        const html = await this.fetchPage('/cgi-bin/dhcpinfo.asp');
        const leases: DhcpLease[] = [];

        // Data is in tableData array:
        // ["1", "dell-PC","192.168.10.2","D4:BE:D9:D7:0A:6A","0" + "days " + "15:44:45"],
        const tableDataMatch = html.match(/var\s+tableData\s*=\s*\[([\s\S]*?)\];/m);

        if (tableDataMatch) {
            // Match each row like ["1", "dell-PC","192.168.10.2","D4:BE:D9:D7:0A:6A",...]
            const rowRegex = /\["\d+",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\s*\+\s*"days\s*"\s*\+\s*"([^"]*)"\]/g;
            let match;

            while ((match = rowRegex.exec(tableDataMatch[1])) !== null) {
                const hostname = match[1];
                const ip = match[2];
                const mac = match[3];
                const leaseTime = `${match[4]} days ${match[5]}`;

                if (ip && ip !== 'N/A') {
                    leases.push({ hostname: hostname || 'Unknown', ip, mac, leaseTime });
                }
            }
        }

        return leases;
    }

    /** GET /cgi-bin/status_wifi.asp - returns connected WiFi clients */
    async getWifiStatus(): Promise<WifiStatus & { clients: Array<{ mac: string; hostname: string; ip: string; rssi: string }> }> {
        const html = await this.fetchPage('/cgi-bin/status_wifi.asp');
        const clients: Array<{ mac: string; hostname: string; ip: string; rssi: string }> = [];

        // Extract clientnumber and MAC addresses from if/else blocks
        const clientNumMatch = html.match(/clientnumber\s*=\s*(\d+);/);
        const clientCount = clientNumMatch ? parseInt(clientNumMatch[1]) : 0;

        // Extract MAC addresses from if blocks: mac="E2:BC:C1:88:33:26";
        const macRegex = /if\s*\(i\s*==\s*\d+\)[\s\S]*?mac\s*=\s*"([^"]+)"/g;
        let macMatch;
        while ((macMatch = macRegex.exec(html)) !== null) {
            const mac = macMatch[1];
            if (mac && mac !== 'N/A') {
                clients.push({ mac, hostname: 'N/A', ip: '', rssi: 'N/A' });
            }
        }

        return {
            ssid: 'N/A', // Not on this page
            encrypted: true,
            securityType: 'N/A',
            channel: 'N/A',
            noise: 'N/A',
            clients: clients.slice(0, clientCount || clients.length)
        };
    }

    /** GET /cgi-bin/xdsl.asp */
    async getDslStats(): Promise<DslStats & { lineState: string; modulation: string; annexMode: string }> {
        const html = await this.fetchPage('/cgi-bin/xdsl.asp');
        const $ = cheerio.load(html);

        // Extract basic info
        const lineState = this.extractByHdClass($, 'Line State:');
        const modulation = this.extractByHdClass($, 'Modulation:');
        const annexMode = this.extractByHdClass($, 'Annex Mode:');

        // For the Downstream/Upstream table, find rows and extract values
        const extractDualValue = (label: string): [string, string] => {
            const row = $(`td.hd:contains("${label}")`).first().parent();
            const cells = row.find('td.tabdata div');
            return [
                $(cells[0]).text().trim() || 'N/A',
                $(cells[1]).text().trim() || 'N/A'
            ];
        };

        const [snrDown, snrUp] = extractDualValue('SNR Margin:');
        const [attDown, attUp] = extractDualValue('Line Attenuation:');
        const [rateDown, rateUp] = extractDualValue('Data Rate:');

        return {
            lineState,
            modulation,
            annexMode,
            snrMarginDown: snrDown,
            snrMarginUp: snrUp,
            attenuationDown: attDown,
            attenuationUp: attUp,
            lineRateDown: rateDown,
            lineRateUp: rateUp,
            linkStatus: lineState
        };
    }

    /** GET /cgi-bin/status_log2.asp */
    async getSystemLog(): Promise<LogEntry[]> {
        const html = await this.fetchPage('/cgi-bin/status_log2.asp');
        const $ = cheerio.load(html);
        const logs: LogEntry[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 2) return;
            const timestamp = $(cols[0]).text().trim();
            const level = $(cols[1])?.text().trim() || 'INFO';
            const message = $(cols[2])?.text().trim() || $(cols[1]).text().trim();
            if (timestamp) logs.push({ timestamp, level, message });
        });
        return logs;
    }

    /** GET /cgi-bin/status_logsecurity.asp */
    async getSecurityLog(): Promise<LogEntry[]> {
        const html = await this.fetchPage('/cgi-bin/status_logsecurity.asp');
        const $ = cheerio.load(html);
        const logs: LogEntry[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 2) return;
            const timestamp = $(cols[0]).text().trim();
            const level = $(cols[1])?.text().trim() || 'SECURITY';
            const message = $(cols[2])?.text().trim() || $(cols[1]).text().trim();
            if (timestamp) logs.push({ timestamp, level, message });
        });
        return logs;
    }

    // ============ STATISTICS ENDPOINTS ============

    /** GET /cgi-bin/statslan.asp */
    async getLanStats(): Promise<LanStats & { ports: Array<PortStats & { status: string }> }> {
        const html = await this.fetchPage('/cgi-bin/statslan.asp');
        const ports: Array<PortStats & { status: string }> = [];
        let totalPacketsSent = 0, totalPacketsReceived = 0;

        // Search entire HTML for LAN port blocks
        // Split by each row start: document.writeln("<tr>");
        const portBlocks = html.split(/document\.writeln\s*\(\s*"<tr>"\s*\)\s*;/);

        for (const block of portBlocks) {
            // Extract LAN port name with flexible whitespace
            const portMatch = block.match(/document\.writeln\s*\(\s*"<td class='hd'>(LAN\d+)"/);
            if (!portMatch) continue;

            const port = portMatch[1];

            // Extract all hdata values - flexible whitespace between elements
            const values: string[] = [];
            const valueRegex = /document\.writeln\s*\(\s*"<td class='hdata'>" \+ "([^"]+)" \+ "&nbsp;<\/td>"\s*\)\s*;/g;
            let match;
            while ((match = valueRegex.exec(block)) !== null) {
                values.push(match[1]);
            }

            if (values.length >= 5) {
                const status = values[0];
                const rxBytes = parseInt(values[1]) || 0;
                const rxPackets = parseInt(values[2]) || 0;
                const txBytes = parseInt(values[3]) || 0;
                const txPackets = parseInt(values[4]) || 0;

                ports.push({
                    port,
                    status,
                    bytesReceived: rxBytes,
                    packetsReceived: rxPackets,
                    bytesSent: txBytes,
                    packetsSent: txPackets
                });

                totalPacketsSent += txPackets;
                totalPacketsReceived += rxPackets;
            }
        }

        return { totalPacketsSent, totalPacketsReceived, ports };
    }

    /** GET /cgi-bin/statswlan.asp */
    async getWlanStats(): Promise<WlanStats> {
        const html = await this.fetchPage('/cgi-bin/statswlan.asp');
        const $ = cheerio.load(html);

        // Labels are: "Tx Frames Count", "Rx Frames Count", etc.
        const extractValue = (label: string): number => {
            const cell = $(`td.hd:contains("${label}")`).first();
            const value = cell.next('td.hdata').find('div').text().trim();
            return parseInt(value.replace(/,/g, '')) || 0;
        };

        return {
            packetsSent: extractValue('Tx Frames Count'),
            packetsReceived: extractValue('Rx Frames Count'),
            bytesSent: 0, // Not available on this page
            bytesReceived: 0,
            errors: extractValue('Tx Errors Count') + extractValue('Rx Errors Count'),
            dropped: extractValue('Tx Drops Count') + extractValue('Rx Drops Count')
        };
    }

    /** GET /cgi-bin/statsadsl.asp */
    async getAdslStats(): Promise<AdslStats> {
        const html = await this.fetchPage('/cgi-bin/statsadsl.asp');
        const $ = cheerio.load(html);
        return {
            receivedBlocks: parseInt(this.extractByLabel($, 'Received Blocks').replace(/,/g, '')) || 0,
            transmittedBlocks: parseInt(this.extractByLabel($, 'Transmitted Blocks').replace(/,/g, '')) || 0,
            cellDefect: parseInt(this.extractByLabel($, 'Cell Delineation').replace(/,/g, '')) || 0,
            crcErrors: parseInt(this.extractByLabel($, 'CRC Errors').replace(/,/g, '')) || 0,
            headerErrors: parseInt(this.extractByLabel($, 'Header Errors').replace(/,/g, '')) || 0
        };
    }

    // ============ CONFIGURATION ENDPOINTS ============

    /** GET /cgi-bin/home_lan.asp */
    async getLanSettings(): Promise<LanSettings> {
        const html = await this.fetchPage('/cgi-bin/home_lan.asp');
        const $ = cheerio.load(html);
        return {
            ipAddress: $('input[name="lanIp"]').val() as string || this.extractByLabel($, 'IP Address'),
            subnetMask: $('input[name="lanMask"]').val() as string || this.extractByLabel($, 'Subnet Mask'),
            dhcpEnabled: $('input[name="dhcpEnable"]:checked').length > 0 || this.extractByLabel($, 'DHCP').toLowerCase().includes('enable'),
            dhcpStartIp: $('input[name="dhcpStart"]').val() as string || this.extractByLabel($, 'Start IP'),
            dhcpEndIp: $('input[name="dhcpEnd"]').val() as string || this.extractByLabel($, 'End IP'),
            leaseTime: $('input[name="dhcpLease"]').val() as string || this.extractByLabel($, 'Lease Time')
        };
    }

    /** GET /cgi-bin/home_wan.asp */
    async getWanServices(): Promise<WanService[]> {
        const html = await this.fetchPage('/cgi-bin/home_wan.asp');
        const $ = cheerio.load(html);
        const services: WanService[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 4) return;
            const serviceName = $(cols[0]).text().trim();
            if (!serviceName || serviceName.toLowerCase().includes('service')) return;

            services.push({
                serviceName,
                protocol: $(cols[1]).text().trim() || 'PPPoE',
                status: $(cols[2]).text().trim() || 'Unknown',
                ipAddress: $(cols[3]).text().trim() || 'N/A',
                vpi: $(cols[4])?.text().trim() || '0',
                vci: $(cols[5])?.text().trim() || '35'
            });
        });
        return services;
    }

    /** GET /cgi-bin/home_wireless.asp */
    async getWirelessSettings(): Promise<WirelessSettings> {
        const html = await this.fetchPage('/cgi-bin/home_wireless.asp');
        const $ = cheerio.load(html);

        // Field names based on actual router HTML:
        // - SSID: input[name="ESSID"]
        // - Access Point enabled: radio[name="wlan_APenable"]
        // - Channel: select[name="Channel_ID"]
        // - Security: select[name="WEP_Selection"]
        // - Hidden SSID: radio[name="ESSID_HIDE_Selection"] (0=broadcast, 1=hidden)

        const ssid = $('input[name="ESSID"]').val() as string || '';
        const isEnabled = $('input[name="wlan_APenable"][value="1"]:checked').length > 0;
        const channel = $('select[name="Channel_ID"] option:selected').text() || 'Auto';
        const security = $('select[name="WEP_Selection"] option:selected').text() || 'Unknown';
        const isHidden = $('input[name="ESSID_HIDE_Selection"][value="1"]:checked').length > 0;

        return {
            ssid,
            enabled: isEnabled,
            channel,
            security,
            hiddenSsid: isHidden
        };
    }

    /** GET /cgi-bin/adv_nat_top.asp */
    async getNatRules(): Promise<NatRule[]> {
        const html = await this.fetchPage('/cgi-bin/adv_nat_top.asp');
        const $ = cheerio.load(html);
        const rules: NatRule[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 5) return;
            const name = $(cols[0]).text().trim();
            if (!name || name.toLowerCase().includes('name')) return;

            rules.push({
                name,
                protocol: $(cols[1]).text().trim() || 'TCP',
                externalPort: $(cols[2]).text().trim(),
                internalPort: $(cols[3]).text().trim(),
                internalIp: $(cols[4]).text().trim(),
                enabled: $(cols[5])?.text().trim().toLowerCase() !== 'disabled'
            });
        });
        return rules;
    }

    /** GET /cgi-bin/adv_firewall.asp */
    async getFirewallRules(): Promise<FirewallRule[]> {
        const html = await this.fetchPage('/cgi-bin/adv_firewall.asp');
        const $ = cheerio.load(html);
        const rules: FirewallRule[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 5) return;
            const name = $(cols[0]).text().trim();
            if (!name || name.toLowerCase().includes('name')) return;

            rules.push({
                name,
                action: $(cols[1]).text().trim().toLowerCase() === 'deny' ? 'deny' : 'allow',
                direction: $(cols[2]).text().trim().toLowerCase().includes('out') ? 'outbound' : 'inbound',
                protocol: $(cols[3]).text().trim() || 'TCP',
                sourceIp: $(cols[4]).text().trim(),
                destIp: $(cols[5])?.text().trim() || '*',
                port: $(cols[6])?.text().trim() || '*',
                enabled: true
            });
        });
        return rules;
    }

    /** GET /cgi-bin/adv_qos.asp */
    async getQosRules(): Promise<QosRule[]> {
        const html = await this.fetchPage('/cgi-bin/adv_qos.asp');
        const $ = cheerio.load(html);
        const rules: QosRule[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 4) return;
            const name = $(cols[0]).text().trim();
            if (!name || name.toLowerCase().includes('name')) return;

            rules.push({
                name,
                priority: parseInt($(cols[1]).text().trim()) || 0,
                protocol: $(cols[2]).text().trim() || 'All',
                sourceIp: $(cols[3]).text().trim() || '*',
                destIp: $(cols[4])?.text().trim() || '*',
                port: $(cols[5])?.text().trim() || '*'
            });
        });
        return rules;
    }

    // ============ ACCESS CONTROL ENDPOINTS ============

    // Note: getDdnsSettings is defined in ADVANCED SETTINGS section below

    /** GET /cgi-bin/access_parental.asp */
    async getParentalControls(): Promise<ParentalControl[]> {
        const html = await this.fetchPage('/cgi-bin/access_parental.asp');
        const $ = cheerio.load(html);
        const controls: ParentalControl[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 2) return;
            const mac = $(cols[0]).text().trim();
            if (!mac || mac.toLowerCase().includes('mac')) return;

            controls.push({
                enabled: true,
                macAddress: mac,
                schedule: $(cols[1])?.text().trim() || 'Always',
                blockedSites: []
            });
        });
        return controls;
    }

    /** GET /cgi-bin/access_upnp.asp */
    async getUpnpStatus(): Promise<UpnpStatus> {
        const html = await this.fetchPage('/cgi-bin/access_upnp.asp');
        const $ = cheerio.load(html);
        const mappings: UpnpMapping[] = [];

        const enabled = $('input[name="upnpEnable"]:checked').length > 0 ||
            this.extractByLabel($, 'UPnP').toLowerCase().includes('enable');

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 4) return;
            const desc = $(cols[0]).text().trim();
            if (!desc || desc.toLowerCase().includes('description')) return;

            mappings.push({
                description: desc,
                protocol: $(cols[1]).text().trim() || 'TCP',
                externalPort: parseInt($(cols[2]).text().trim()) || 0,
                internalPort: parseInt($(cols[3]).text().trim()) || 0,
                internalClient: $(cols[4])?.text().trim() || ''
            });
        });

        return { enabled, mappings };
    }

    /** GET /cgi-bin/access_ipfilter.asp */
    async getIpFilterRules(): Promise<IpFilterRule[]> {
        const html = await this.fetchPage('/cgi-bin/access_ipfilter.asp');
        const $ = cheerio.load(html);
        const rules: IpFilterRule[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 4) return;
            const name = $(cols[0]).text().trim();
            if (!name || name.toLowerCase().includes('name')) return;

            rules.push({
                name,
                action: $(cols[1]).text().trim().toLowerCase() === 'deny' ? 'deny' : 'allow',
                sourceIp: $(cols[2]).text().trim(),
                destIp: $(cols[3]).text().trim(),
                protocol: $(cols[4])?.text().trim() || 'All',
                port: $(cols[5])?.text().trim() || '*'
            });
        });
        return rules;
    }

    // ============ MANAGEMENT ENDPOINTS ============

    /** GET /cgi-bin/tools_time.asp */
    async getSystemTime(): Promise<SystemTime> {
        const html = await this.fetchPage('/cgi-bin/tools_time.asp');
        const $ = cheerio.load(html);
        return {
            currentTime: this.extractByLabel($, 'Current Time') || this.extractByLabel($, 'System Time'),
            timezone: $('select[name="timezone"] option:selected').text() || this.extractByLabel($, 'Time Zone'),
            ntpEnabled: $('input[name="ntpEnable"]:checked').length > 0,
            ntpServer: $('input[name="ntpServer"]').val() as string || this.extractByLabel($, 'NTP Server')
        };
    }

    /** POST /cgi-bin/tools_system.asp - Restart router */
    async restart(): Promise<boolean> {
        try {
            await this.client.post('/cgi-bin/tools_system.asp', new URLSearchParams({
                'testFlag': '0',
                'restoreFlag': '1',      // 1 = Current Settings, 2 = Factory Default
                'rebootFlag': '1',       // Must be 1 to trigger restart
                'RestartBtn': 'Restart'  // Submit button
            }));
            return true;
        } catch (error) {
            console.error('[PTCL Adapter] Failed to restart:', error);
            return false;
        }
    }

    // ============ ADVANCED ENDPOINTS ============

    /** GET /cgi-bin/adv_routing_table.asp */
    async getRoutingTable(): Promise<RoutingEntry[]> {
        const html = await this.fetchPage('/cgi-bin/adv_routing_table.asp');
        const $ = cheerio.load(html);
        const routes: RoutingEntry[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 4) return;
            const dest = $(cols[0]).text().trim();
            if (!dest || dest.toLowerCase().includes('destination')) return;

            routes.push({
                destination: dest,
                gateway: $(cols[1]).text().trim(),
                subnetMask: $(cols[2]).text().trim(),
                interface: $(cols[3]).text().trim(),
                metric: parseInt($(cols[4])?.text().trim()) || 0
            });
        });
        return routes;
    }

    /** GET /cgi-bin/adv_vpn_setting.asp */
    async getVpnSettings(): Promise<VpnSettings> {
        const html = await this.fetchPage('/cgi-bin/adv_vpn_setting.asp');
        const $ = cheerio.load(html);
        return {
            enabled: $('input[name="vpnEnable"]:checked').length > 0,
            type: $('select[name="vpnType"] option:selected').text() || this.extractByLabel($, 'VPN Type'),
            serverAddress: $('input[name="vpnServer"]').val() as string || this.extractByLabel($, 'Server'),
            username: $('input[name="vpnUser"]').val() as string || this.extractByLabel($, 'Username'),
            status: this.extractByLabel($, 'Status') || 'Disconnected'
        };
    }

    /** GET /cgi-bin/adv_portbinding.asp */
    async getInterfaceGroups(): Promise<InterfaceGroup[]> {
        const html = await this.fetchPage('/cgi-bin/adv_portbinding.asp');
        const $ = cheerio.load(html);
        const groups: InterfaceGroup[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length < 2) return;
            const name = $(cols[0]).text().trim();
            if (!name || name.toLowerCase().includes('group')) return;

            groups.push({
                name,
                lanPorts: $(cols[1]).text().trim().split(',').map(p => p.trim()),
                wanInterface: $(cols[2])?.text().trim() || 'ppp0'
            });
        });
        return groups;
    }

    // ============ CONVENIENCE METHODS ============

    /** Get all connected devices by combining ARP and DHCP data */
    async getConnectedDevices(): Promise<DhcpLease[]> {
        const [arpTable, dhcpLeases] = await Promise.all([
            this.getArpTable(),
            this.getDhcpLeases()
        ]);

        const macToHostname = new Map<string, string>();
        dhcpLeases.forEach(lease => {
            macToHostname.set(lease.mac.toLowerCase(), lease.hostname);
        });

        return arpTable.map(arp => ({
            hostname: macToHostname.get(arp.mac.toLowerCase()) || 'Unknown',
            ip: arp.ip,
            mac: arp.mac,
            leaseTime: 'Active'
        }));
    }

    // ============ WIFI SETTINGS (SETTERS) ============

    /**
     * Change WiFi settings including SSID, password, channel
     * POST /cgi-bin/home_wireless.asp
     * Based on actual router HTML form analysis
     */
    async setWifiSettings(options: {
        ssid?: string;
        password?: string;
        enabled?: boolean;
        channel?: number;
    }): Promise<{ success: boolean; message: string }> {
        try {
            // First, get current settings to preserve unchanged values
            const currentSettings = await this.getWirelessSettings();

            // Build form parameters based on actual router HTML
            // Form: name="WLAN" action="/cgi-bin/home_wireless.asp"
            const params: Record<string, string> = {
                // Access Point enable/disable
                'wlan_APenable': options.enabled === false ? '0' : '1',
                // SSID (network name)
                'ESSID': options.ssid ?? currentSettings.ssid,
                // Broadcast SSID (0=Yes/broadcast, 1=No/hidden)
                'ESSID_HIDE_Selection': currentSettings.hiddenSsid ? '1' : '0',
                // Enable SSID
                'ESSID_Enable_Selection': '1',
                // Channel (0 = Auto)
                'Channel_ID': options.channel?.toString() ?? '0',
                // Wireless Mode (9 = 802.11b+g+n)
                'WirelessMode': '9',
                // Authentication Type
                'WEP_Selection': currentSettings.security || 'WPA2PSK',
                // Pre-Shared Key (password)
                'PreSharedKey1': options.password ?? '',
                // Required hidden fields
                'wlanWEPFlag': '3',
                'SSID_INDEX': '0',
                'Is11nMode': '1',
                // Default values
                'BeaconInterval': '100',
                'RTSThreshold': '2347',
                'FragmentThreshold': '2346',
                'DTIM': '1',
                'StationNum': '0',
            };

            // If changing password, validate it
            if (options.password !== undefined) {
                if (options.password.length < 8) {
                    return { success: false, message: 'Password must be at least 8 characters' };
                }
                if (options.password.length > 63) {
                    return { success: false, message: 'Password must be at most 63 characters' };
                }
            }

            await this.client.post('/cgi-bin/home_wireless.asp', new URLSearchParams(params));

            return { success: true, message: 'WiFi settings updated successfully' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to update WiFi settings:', error);
            return { success: false, message: error.message || 'Failed to update WiFi settings' };
        }
    }

    /**
     * Enable or disable WiFi
     */
    async setWifiEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
        return this.setWifiSettings({ enabled });
    }

    /**
     * Change WiFi SSID (network name)
     */
    async setWifiSsid(ssid: string): Promise<{ success: boolean; message: string }> {
        if (!ssid || ssid.length < 1 || ssid.length > 32) {
            return { success: false, message: 'SSID must be between 1 and 32 characters' };
        }
        return this.setWifiSettings({ ssid });
    }

    /**
     * Change WiFi password
     */
    async setWifiPassword(password: string): Promise<{ success: boolean; message: string }> {
        return this.setWifiSettings({ password });
    }

    /**
     * Change WiFi channel
     */
    async setWifiChannel(channel: number): Promise<{ success: boolean; message: string }> {
        if (channel < 0 || channel > 14) {
            return { success: false, message: 'Channel must be between 0 (auto) and 14' };
        }
        return this.setWifiSettings({ channel });
    }

    // ============ LAN SETTINGS (SETTERS) ============

    /**
     * Change LAN settings including IP address, subnet mask, and DHCP configuration
     * POST /cgi-bin/home_lan.asp
     * Based on actual router HTML form analysis
     */
    async setLanSettings(options: {
        ipAddress?: string;
        subnetMask?: string;
        dhcpEnabled?: boolean;
        dhcpStartIp?: string;
        dhcpPoolSize?: number;
        dhcpLeaseTime?: number;
    }): Promise<{ success: boolean; message: string }> {
        try {
            // First fetch current settings to preserve unchanged values
            const currentHtml = await this.fetchPage('/cgi-bin/home_lan.asp');
            const $ = cheerio.load(currentHtml);

            // Extract current values from the page
            const currentIp = $('input[name="uiViewIPAddr"]').val() as string || '192.168.10.1';
            const currentMask = $('input[name="uiViewNetMask"]').val() as string || '255.255.255.0';
            const currentStartIp = $('input[name="StartIp"]').val() as string || '192.168.10.2';
            const currentPoolSize = $('input[name="PoolSize"]').val() as string || '250';
            const currentLeaseTime = $('input[name="dhcp_LeaseTime"]').val() as string || '86400';
            const currentAliasIp = $('input[name="uiViewAliasIPAddr"]').val() as string || '192.168.2.1';
            const currentAliasMask = $('input[name="uiViewAliasNetMask"]').val() as string || '255.255.255.0';

            // Build params with current values as defaults
            // Based on actual form fields from home_lan.asp
            const params: Record<string, string> = {
                // LAN IP settings
                'uiViewIPAddr': options.ipAddress || currentIp,
                'uiViewNetMask': options.subnetMask || currentMask,
                // Alias IP settings (preserve current)
                'uiViewAliasIPAddr': currentAliasIp,
                'uiViewAliasNetMask': currentAliasMask,
                // DHCP Type: 0=Disabled, 1=Enabled, 2=Relay
                'dhcpTypeRadio': options.dhcpEnabled === false ? '0' : '1',
                // DHCP pool settings
                'StartIp': options.dhcpStartIp || currentStartIp,
                'PoolSize': options.dhcpPoolSize?.toString() || currentPoolSize,
                'dhcp_LeaseTime': options.dhcpLeaseTime?.toString() || currentLeaseTime,
                // DNS settings (preserve)
                'dnsTypeRadio': '0',
                'PrimaryDns': 'N/A',
                'SecondDns': 'N/A',
                // Required hidden fields (CRITICAL)
                'dhcpFlag': '0',
                'lanFlag': '0',
                'aliasFlag': 'Yes',
                'DNSproxy': 'Yes',
            };

            await this.client.post('/cgi-bin/home_lan.asp', new URLSearchParams(params));

            return { success: true, message: 'LAN settings updated successfully' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to update LAN settings:', error);
            return { success: false, message: error.message || 'Failed to update LAN settings' };
        }
    }

    /**
     * Change LAN IP address
     */
    async setLanIpAddress(ipAddress: string): Promise<{ success: boolean; message: string }> {
        // Validate IP format
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ipAddress)) {
            return { success: false, message: 'Invalid IP address format' };
        }
        return this.setLanSettings({ ipAddress });
    }

    /**
     * Enable or disable DHCP server
     */
    async setDhcpEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
        return this.setLanSettings({ dhcpEnabled: enabled });
    }

    /**
     * Configure DHCP pool settings
     */
    async setDhcpPool(startIp: string, poolSize: number, leaseTime?: number): Promise<{ success: boolean; message: string }> {
        if (poolSize < 1 || poolSize > 254) {
            return { success: false, message: 'Pool size must be between 1 and 254' };
        }
        return this.setLanSettings({
            dhcpStartIp: startIp,
            dhcpPoolSize: poolSize,
            dhcpLeaseTime: leaseTime
        });
    }

    // ============ WAN SETTINGS (SETTERS) ============

    /**
     * Change WAN/PPPoE settings including credentials and connection type
     * POST /cgi-bin/home_wan.asp
     */
    async setWanSettings(options: {
        pppUsername?: string;
        pppPassword?: string;
        connectionType?: 'dynamic' | 'static' | 'pppoe' | 'bridge';
        natEnabled?: boolean;
        mtu?: number;
        vlanId?: number;
    }): Promise<{ success: boolean; message: string }> {
        try {
            // Map connection type to radio value
            const connectionTypeMap: Record<string, string> = {
                'dynamic': '0',
                'static': '1',
                'pppoe': '2',
                'bridge': '3'
            };

            const params: Record<string, string> = {
                'SaveBtn': 'Save',
            };

            if (options.pppUsername) {
                params['wan_PPPUsername'] = options.pppUsername;
            }

            if (options.pppPassword) {
                params['wan_PPPPassword'] = options.pppPassword;
            }

            if (options.connectionType) {
                params['wanTypeRadio'] = connectionTypeMap[options.connectionType] || '2';
            }

            if (options.natEnabled !== undefined) {
                params['wan_NAT0'] = options.natEnabled ? 'Enable' : 'Disabled';
            }

            if (options.mtu !== undefined) {
                params['wan_TCPMTU0'] = options.mtu.toString();
            }

            if (options.vlanId !== undefined) {
                params['wan_vid'] = options.vlanId.toString();
            }

            await this.client.post('/cgi-bin/home_wan.asp', new URLSearchParams(params));

            return { success: true, message: 'WAN settings updated successfully' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to update WAN settings:', error);
            return { success: false, message: error.message || 'Failed to update WAN settings' };
        }
    }

    /**
     * Update PPPoE credentials
     */
    async setPppoeCredentials(username: string, password: string): Promise<{ success: boolean; message: string }> {
        if (!username || !password) {
            return { success: false, message: 'Username and password are required' };
        }
        return this.setWanSettings({ pppUsername: username, pppPassword: password });
    }

    /**
     * Enable or disable NAT
     */
    async setNatEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
        return this.setWanSettings({ natEnabled: enabled });
    }

    // ============ PORT FORWARDING (SETTERS) ============

    /**
     * Add or update a port forwarding rule
     * POST /cgi-bin/adv_nat_virsvr.asp
     */
    async addPortForwardingRule(options: {
        name: string;
        protocol: 'TCP' | 'UDP' | 'ALL';
        externalPort: number | string;
        internalIp: string;
        internalPort?: number | string;
        enabled?: boolean;
    }): Promise<{ success: boolean; message: string }> {
        try {
            const startPort = options.externalPort.toString();
            const localPort = (options.internalPort || options.externalPort).toString();

            const params = new URLSearchParams({
                'Application': options.name,
                'SelectProtocol': options.protocol,
                'start_port': startPort,
                'end_port': startPort,
                'Addr': options.internalIp,
                'local_sport': localPort,
                'local_eport': localPort,
                'enbl': options.enabled !== false ? 'on' : 'off',
                'isLocalPortSupport': 'Yes',
                'enblflag': 'Yes',
                'editFlag': '0',
                'delFlag': '0',
                'editnum': '-1',
            });

            await this.client.post('/cgi-bin/adv_nat_virsvr.asp', params);

            return { success: true, message: `Port forwarding rule "${options.name}" added successfully` };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to add port forwarding rule:', error);
            return { success: false, message: error.message || 'Failed to add port forwarding rule' };
        }
    }

    /**
     * Delete a port forwarding rule by index
     */
    async deletePortForwardingRule(ruleIndex: number): Promise<{ success: boolean; message: string }> {
        try {
            const params = new URLSearchParams({
                'delFlag': '1',
                'editnum': ruleIndex.toString(),
            });

            await this.client.post('/cgi-bin/adv_nat_virsvr.asp', params);

            return { success: true, message: `Port forwarding rule at index ${ruleIndex} deleted` };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to delete port forwarding rule:', error);
            return { success: false, message: error.message || 'Failed to delete port forwarding rule' };
        }
    }

    // ============ MAC/IP FILTERING (SETTERS) ============

    /**
     * Block or allow a MAC address
     * POST /cgi-bin/access_ipfilter.asp
     * Based on actual router HTML form analysis
     */
    async setMacFilter(options: {
        macAddress: string;
        action: 'block' | 'allow';
        direction?: 'both' | 'incoming' | 'outgoing';
        ruleIndex?: number;
        enabled?: boolean;
    }): Promise<{ success: boolean; message: string }> {
        try {
            // Validate MAC address format
            const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
            if (!macRegex.test(options.macAddress)) {
                return { success: false, message: 'Invalid MAC address format. Use format: XX:XX:XX:XX:XX:XX' };
            }

            // Map direction values to match form options
            const directionMap: Record<string, string> = {
                'both': 'Both',
                'incoming': 'Incoming',
                'outgoing': 'Outgoing'
            };

            // Build form parameters based on actual router HTML
            // Form: name=IPFILTERform action=/cgi-bin/access_ipfilter.asp
            const params = new URLSearchParams({
                // Rule Type: Black List (block) or White List (allow)
                'RuleTypeSEL': options.action === 'block' ? 'Black' : 'White',
                // Filter type: MAC (not IP)
                'FILTERRuleTypeSEL': 'MAC',
                // MAC address to filter
                'MacAddrTXT': options.macAddress.toUpperCase(),
                // Active: Yes or No
                'RuleActiveRDO': options.enabled !== false ? 'Yes' : 'No',
                // Direction
                'DirectionSEL': directionMap[options.direction || 'both'] || 'Both',
                // Rule index (0-15)
                'RuleIndexSEL': (options.ruleIndex || 0).toString(),
                // Interface: LAN for local devices
                'InterfaceSEL': 'LAN',
                // RuleTypeChange: 1 = Add
                'RuleTypeChange': '1',
                // Submit button
                'IpFilterApply': 'Set',
            });

            await this.client.post('/cgi-bin/access_ipfilter.asp', params);

            return {
                success: true,
                message: `MAC address ${options.macAddress} ${options.action === 'block' ? 'blocked' : 'allowed'}`
            };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to set MAC filter:', error);
            return { success: false, message: error.message || 'Failed to set MAC filter' };
        }
    }

    /**
     * Block a device by MAC address
     */
    async blockDevice(macAddress: string): Promise<{ success: boolean; message: string }> {
        return this.setMacFilter({ macAddress, action: 'block' });
    }

    /**
     * Unblock/allow a device by MAC address
     */
    async allowDevice(macAddress: string): Promise<{ success: boolean; message: string }> {
        return this.setMacFilter({ macAddress, action: 'allow' });
    }

    /**
     * Delete a MAC filter rule
     */
    async deleteMacFilter(ruleIndex: number): Promise<{ success: boolean; message: string }> {
        try {
            const params = new URLSearchParams({
                'RuleIndexSEL': ruleIndex.toString(),
                'IpFilterDelete': 'Delete',
            });

            await this.client.post('/cgi-bin/access_ipfilter.asp', params);

            return { success: true, message: `MAC filter rule at index ${ruleIndex} deleted` };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to delete MAC filter:', error);
            return { success: false, message: error.message || 'Failed to delete MAC filter' };
        }
    }

    // ============ QOS SETTINGS (SETTERS) ============

    /**
     * Enable or disable QoS globally
     * POST /cgi-bin/adv_qos.asp
     * Based on form analysis: QOS_Flag=4 for discipline save, qoSOptType=discRule
     */
    async setQosEnabled(enabled: boolean): Promise<{ success: boolean; message: string }> {
        try {
            // The QoS form requires specific parameters to save the state
            // QOS_Flag: 4 = discipline save, qoSOptType: discRule
            const params = new URLSearchParams({
                'Qos_active': enabled ? 'Yes' : 'No',
                'Qosdiscipline': 'SP',  // Strict Priority (default)
                'qoSOptType': 'discRule',
                'QOS_Flag': '4',
                'QosWRRweight1': '8',
                'QosWRRweight2': '4',
                'QosWRRweight3': '2',
                'QosWRRweight4': '1',
                'Qosdisciplinesave': 'Discipline Save',
            });

            await this.client.post('/cgi-bin/adv_qos.asp', params);

            return { success: true, message: enabled ? 'QoS enabled successfully' : 'QoS disabled' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to toggle QoS:', error);
            return { success: false, message: error.message || 'Failed to toggle QoS' };
        }
    }

    /**
     * Set QoS discipline (scheduling algorithm)
     * WRR = Weighted Round Robin, SP = Strict Priority
     */
    async setQosDiscipline(discipline: 'WRR' | 'SP', weights?: { high?: number; medium?: number; low?: number }): Promise<{ success: boolean; message: string }> {
        try {
            const params: Record<string, string> = {
                'Qosdiscipline': discipline,
                'Qosdisciplinesave': 'Save',
            };

            if (discipline === 'WRR' && weights) {
                if (weights.high !== undefined) params['QosWRRweight2'] = weights.high.toString();
                if (weights.medium !== undefined) params['QosWRRweight3'] = weights.medium.toString();
                if (weights.low !== undefined) params['QosWRRweight4'] = weights.low.toString();
            }

            await this.client.post('/cgi-bin/adv_qos.asp', new URLSearchParams(params));

            return { success: true, message: `QoS discipline set to ${discipline}` };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to set QoS discipline:', error);
            return { success: false, message: error.message || 'Failed to set QoS discipline' };
        }
    }

    /**
     * Add a QoS rule for traffic prioritization
     * POST /cgi-bin/adv_qos.asp
     */
    async addQosRule(options: {
        ruleIndex?: number;
        enabled?: boolean;
        protocol?: 'TCP/UDP' | 'TCP' | 'UDP' | 'ICMP' | 'IGMP';
        sourceIp?: string;
        destIp?: string;
        sourcePort?: number | string;
        destPort?: number | string;
        priority?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
    }): Promise<{ success: boolean; message: string }> {
        try {
            const params: Record<string, string> = {
                'QosRuleIndex': (options.ruleIndex || 0).toString(),
                'QosRuleActive': options.enabled !== false ? 'Yes' : 'No',
                'QoS_Add': 'Add',
            };

            if (options.protocol) {
                params['QosProtocol'] = options.protocol;
            }

            if (options.sourceIp) {
                params['QosSrcIpValue'] = options.sourceIp;
            }

            if (options.destIp) {
                params['QosDestIpValue'] = options.destIp;
            }

            if (options.sourcePort) {
                params['QosSrcPortValue1'] = options.sourcePort.toString();
            }

            if (options.destPort) {
                params['QosDestPortValue1'] = options.destPort.toString();
            }

            if (options.priority !== undefined) {
                params['QosIPPValue1'] = options.priority.toString();
            }

            await this.client.post('/cgi-bin/adv_qos.asp', new URLSearchParams(params));

            return { success: true, message: 'QoS rule added successfully' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to add QoS rule:', error);
            return { success: false, message: error.message || 'Failed to add QoS rule' };
        }
    }

    /**
     * Delete a QoS rule by index
     */
    async deleteQosRule(ruleIndex: number): Promise<{ success: boolean; message: string }> {
        try {
            const params = new URLSearchParams({
                'QosRuleIndex': ruleIndex.toString(),
                'QoS_Del': 'Delete',
            });

            await this.client.post('/cgi-bin/adv_qos.asp', params);

            return { success: true, message: `QoS rule ${ruleIndex} deleted` };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to delete QoS rule:', error);
            return { success: false, message: error.message || 'Failed to delete QoS rule' };
        }
    }

    // ============ ADMIN/SYSTEM SETTINGS (SETTERS) ============

    /**
     * Change router admin password
     * POST /cgi-bin/tools_admin.asp
     */
    async setAdminPassword(newPassword: string): Promise<{ success: boolean; message: string }> {
        try {
            if (!newPassword || newPassword.length < 1) {
                return { success: false, message: 'Password cannot be empty' };
            }

            const params = new URLSearchParams({
                'adminFlag': '1',
                'uiViewTools_Password': newPassword,
                'uiViewTools_PasswordConfirm': newPassword,
                'SaveBtn': 'Save',
            });

            await this.client.post('/cgi-bin/tools_admin.asp', params);

            return { success: true, message: 'Admin password changed successfully. Remember to update your login credentials.' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to change admin password:', error);
            return { success: false, message: error.message || 'Failed to change admin password' };
        }
    }

    /**
     * Configure Dynamic DNS settings
     * POST /cgi-bin/access_ddns.asp
     */
    async setDdnsSettings(options: {
        enabled: boolean;
        provider?: string;
        hostname?: string;
        username?: string;
        password?: string;
        wildcard?: boolean;
    }): Promise<{ success: boolean; message: string }> {
        try {
            const params: Record<string, string> = {
                'Enable_DyDNS': options.enabled ? 'Yes' : 'No',
                'SaveFlag': '1',
                'SaveBtn': 'Save',
            };

            if (options.provider) {
                params['ddns_ServerName'] = options.provider;
            }

            if (options.hostname) {
                params['sysDNSHost'] = options.hostname;
            }

            if (options.username) {
                params['sysDNSUser'] = options.username;
            }

            if (options.password) {
                params['sysDNSPassword'] = options.password;
            }

            if (options.wildcard !== undefined) {
                params['Enable_Wildcard'] = options.wildcard ? 'Yes' : 'No';
            }

            await this.client.post('/cgi-bin/access_ddns.asp', new URLSearchParams(params));

            return { success: true, message: options.enabled ? 'Dynamic DNS enabled successfully' : 'Dynamic DNS disabled' };
        } catch (error: any) {
            console.error('[PTCL Adapter] Failed to configure DDNS:', error);
            return { success: false, message: error.message || 'Failed to configure Dynamic DNS' };
        }
    }

    /**
     * Enable Dynamic DNS with specific provider
     */
    async enableDdns(provider: string, hostname: string, username: string, password: string): Promise<{ success: boolean; message: string }> {
        return this.setDdnsSettings({
            enabled: true,
            provider,
            hostname,
            username,
            password
        });
    }

    /**
     * Disable Dynamic DNS
     */
    async disableDdns(): Promise<{ success: boolean; message: string }> {
        return this.setDdnsSettings({ enabled: false });
    }

    // ============ ADVANCED SETTINGS ENDPOINTS ============

    /** GET /cgi-bin/access_parental.asp - Get Parental Control settings */
    async getParentalControl(): Promise<{
        enabled: boolean;
        rules: Array<{
            mac: string;
            days: string[];
            startTime: string;
            endTime: string;
        }>;
    }> {
        const html = await this.fetchPage('/cgi-bin/access_parental.asp');
        const $ = cheerio.load(html);

        const rules: Array<{
            mac: string;
            days: string[];
            startTime: string;
            endTime: string;
        }> = [];

        // Check if parental control is enabled
        const enabled = $('input[name="pcEnable"]:checked').val() === '1' ||
            $('input[name="Enable"]:checked').val() === 'Yes';

        // Parse rules from table
        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 4) {
                const mac = $(cols[0]).text().trim();
                // Skip header rows
                if (mac && mac.match(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/)) {
                    rules.push({
                        mac,
                        days: $(cols[1]).text().trim().split(',').map(d => d.trim()),
                        startTime: $(cols[2]).text().trim(),
                        endTime: $(cols[3]).text().trim()
                    });
                }
            }
        });

        return { enabled, rules };
    }

    /** GET /cgi-bin/adv_qos.asp - Get QoS settings */
    async getQosSettings(): Promise<{
        enabled: boolean;
        totalBandwidth: string;
        rules: Array<{
            name: string;
            priority: string;
            protocol: string;
            port: string;
        }>;
    }> {
        const html = await this.fetchPage('/cgi-bin/adv_qos.asp');
        const $ = cheerio.load(html);

        const rules: Array<{
            name: string;
            priority: string;
            protocol: string;
            port: string;
        }> = [];

        // Check if QoS is enabled
        const enabled = $('input[name="qosEnable"]:checked').val() === '1' ||
            $('select[name="qosEnable"]').val() === '1';

        // Get total bandwidth
        const totalBandwidth = $('input[name="wanBandwidth"]').val() as string ||
            this.extractByLabel($, 'Total Bandwidth') || 'N/A';

        // Parse QoS rules from table
        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 4) {
                const name = $(cols[0]).text().trim();
                // Skip headers
                if (name && !name.includes('Rule') && !name.includes('Name')) {
                    rules.push({
                        name,
                        priority: $(cols[1]).text().trim(),
                        protocol: $(cols[2]).text().trim(),
                        port: $(cols[3]).text().trim()
                    });
                }
            }
        });

        return { enabled, totalBandwidth, rules };
    }

    /** GET /cgi-bin/adv_firewall.asp - Get Firewall settings */
    async getFirewallSettings(): Promise<{
        firewallEnabled: boolean;
        spiEnabled: boolean;
        dosProtection: boolean;
    }> {
        const html = await this.fetchPage('/cgi-bin/adv_firewall.asp');
        const $ = cheerio.load(html);

        // Check firewall status
        const firewallEnabled = $('input[name="firewallEnable"]:checked').val() === '1';

        // Check SPI (Stateful Packet Inspection) status
        const spiEnabled = $('input[name="spiEnable"]:checked').val() === '1';

        // DoS protection is typically tied to firewall
        const dosProtection = firewallEnabled;

        return {
            firewallEnabled,
            spiEnabled,
            dosProtection
        };
    }

    /** GET /cgi-bin/access_ddns.asp - Get Dynamic DNS settings */
    async getDdnsSettings(): Promise<DdnsSettings> {
        const html = await this.fetchPage('/cgi-bin/access_ddns.asp');
        const $ = cheerio.load(html);

        // Check if DDNS is enabled
        const enabled = $('input[name="Enable_DyDNS"]:checked').val() === 'Yes';

        // Get provider
        const provider = $('select[name="ddns_ServerName"]').val() as string ||
            $('select[name="ddns_ServerName"] option:selected').text() || 'N/A';

        // Get hostname
        const hostname = $('input[name="sysDNSHost"]').val() as string || 'N/A';

        // Get username
        const username = $('input[name="sysDNSUser"]').val() as string || 'N/A';

        // Get wildcard status
        const wildcardEnabled = $('input[name="Enable_Wildcard"]:checked').val() === 'Yes';

        return {
            enabled,
            provider,
            hostname,
            username,
            status: enabled ? 'Active' : 'Inactive'
        };
    }

    // ============ UTILITY METHODS ============

    /** Get comprehensive status summary */
    async getFullStatus(): Promise<{
        device: DeviceInfo;
        wan: WanInfo;
        wifi: WifiStatus;
        dsl: DslStats;
    }> {
        const [device, wan, wifi, dsl] = await Promise.all([
            this.getDeviceInfo(),
            this.getWanInfo(),
            this.getWifiStatus(),
            this.getDslStats()
        ]);
        return { device, wan, wifi, dsl };
    }

    /** Crawl router to discover all endpoints */
    async crawlRouterLinks(startPath: string = '/', maxDepth: number = 2): Promise<string[]> {
        const visited = new Set<string>();
        const allLinks = new Set<string>();
        const baseUrl = `http://${this.ip}`;

        const extractLinks = (html: string): string[] => {
            const $ = cheerio.load(html);
            const links: string[] = [];
            const addLink = (href: string | undefined) => {
                if (!href) return;
                if (href.startsWith('/')) links.push(baseUrl + href);
                else if (href.startsWith('cgi-bin')) links.push(`${baseUrl}/${href}`);
                else if (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript')) {
                    links.push(`${baseUrl}/${href}`);
                }
            };
            $('a.menuLink').each((_, el) => addLink($(el).attr('href')));
            $('frame, iframe').each((_, el) => addLink($(el).attr('src')));
            $('area').each((_, el) => addLink($(el).attr('href')));
            return links;
        };

        const crawl = async (url: string, depth: number) => {
            if (depth > maxDepth || visited.has(url)) return;
            visited.add(url);
            try {
                const path = url.replace(baseUrl, '');
                const html = await this.fetchPage(path || '/');
                const links = extractLinks(html);
                for (const link of links) {
                    allLinks.add(link);
                    if (link.includes('cgi-bin') && !visited.has(link)) {
                        await crawl(link, depth + 1);
                    }
                }
            } catch {
                console.log(`[PTCL Crawler] Skipped: ${url}`);
            }
        };

        await crawl(baseUrl + startPath, 0);
        return Array.from(allLinks).sort();
    }
}
