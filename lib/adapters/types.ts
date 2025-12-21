// ============ ROUTER TYPES ============
// Type definitions for PTCL Router Adapter

// Status Interfaces
export interface DeviceInfo {
    model: string;
    firmwareVersion: string;
    uptime: string;
    lanMac: string;
    wlanMac: string;
    lanStatus: string;
    wlanStatus: string;
}

export interface WanInfo {
    wanIp: string;
    pppoeStatus: string;
    dslStatus: string;
    gateway: string;
    primaryDns: string;
    secondaryDns: string;
}

export interface ArpEntry {
    ip: string;
    mac: string;
    interface: string;
}

export interface DhcpLease {
    hostname: string;
    ip: string;
    mac: string;
    leaseTime: string;
}

export interface WifiStatus {
    ssid: string;
    encrypted: boolean;
    securityType: string;
    channel: string;
    noise: string;
}

export interface DslStats {
    snrMarginDown: string;
    snrMarginUp: string;
    attenuationDown: string;
    attenuationUp: string;
    lineRateDown: string;
    lineRateUp: string;
    linkStatus: string;
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

// Statistics Interfaces
export interface LanStats {
    totalPacketsSent: number;
    totalPacketsReceived: number;
    ports: PortStats[];
}

export interface PortStats {
    port: string;
    packetsSent: number;
    packetsReceived: number;
    bytesSent: number;
    bytesReceived: number;
}

export interface WlanStats {
    packetsSent: number;
    packetsReceived: number;
    bytesSent: number;
    bytesReceived: number;
    errors: number;
    dropped: number;
}

export interface AdslStats {
    receivedBlocks: number;
    transmittedBlocks: number;
    cellDefect: number;
    crcErrors: number;
    headerErrors: number;
}

// Configuration Interfaces
export interface LanSettings {
    ipAddress: string;
    subnetMask: string;
    dhcpEnabled: boolean;
    dhcpStartIp: string;
    dhcpEndIp: string;
    leaseTime: string;
}

export interface WanService {
    serviceName: string;
    protocol: string;
    status: string;
    ipAddress: string;
    vpi: string;
    vci: string;
}

export interface WirelessSettings {
    ssid: string;
    enabled: boolean;
    channel: string;
    security: string;
    password?: string;
    hiddenSsid: boolean;
}

export interface NatRule {
    name: string;
    protocol: string;
    externalPort: string;
    internalPort: string;
    internalIp: string;
    enabled: boolean;
}

export interface FirewallRule {
    name: string;
    action: 'allow' | 'deny';
    direction: 'inbound' | 'outbound';
    protocol: string;
    sourceIp: string;
    destIp: string;
    port: string;
    enabled: boolean;
}

export interface QosRule {
    name: string;
    priority: number;
    protocol: string;
    sourceIp: string;
    destIp: string;
    port: string;
}

// Access Control Interfaces
export interface DdnsSettings {
    enabled: boolean;
    provider: string;
    hostname: string;
    username: string;
    status: string;
}

export interface ParentalControl {
    enabled: boolean;
    macAddress: string;
    schedule: string;
    blockedSites: string[];
}

export interface UpnpStatus {
    enabled: boolean;
    mappings: UpnpMapping[];
}

export interface UpnpMapping {
    description: string;
    protocol: string;
    externalPort: number;
    internalPort: number;
    internalClient: string;
}

export interface IpFilterRule {
    name: string;
    action: 'allow' | 'deny';
    sourceIp: string;
    destIp: string;
    protocol: string;
    port: string;
}

// Management Interfaces
export interface SystemTime {
    currentTime: string;
    timezone: string;
    ntpEnabled: boolean;
    ntpServer: string;
}

// Advanced Interfaces
export interface RoutingEntry {
    destination: string;
    gateway: string;
    subnetMask: string;
    interface: string;
    metric: number;
}

export interface VpnSettings {
    enabled: boolean;
    type: string;
    serverAddress: string;
    username: string;
    status: string;
}

export interface InterfaceGroup {
    name: string;
    lanPorts: string[];
    wanInterface: string;
}
