/**
 * LangGraph Guardrails
 * 
 * Implements guardrails as graph nodes that can:
 * 1. Filter input before the agent processes it
 * 2. Check output after the agent responds
 * 3. Redirect to safe responses when needed
 */

import { AIMessage, BaseMessage } from '@langchain/core/messages';

// ============ CONFIGURATION ============

const BANNED_KEYWORDS = [
    'hack', 'exploit', 'malware', 'crack', 'bypass security',
    'injection', 'sql injection', 'xss', 'ddos',
];

const OFF_TOPIC_KEYWORDS = [
    'write code', 'generate script', 'create program',
    'homework', 'essay', 'translate',
];

const SENSITIVE_TOOL_PATTERNS = [
    'reboot', 'reset', 'delete', 'remove', 'disable', 'restart',
];

// ============ GUARDRAIL TYPES ============

export interface GuardrailResult {
    passed: boolean;
    reason?: string;
    blockedResponse?: string;
}

// ============ INPUT GUARDRAILS ============

/**
 * Check if user input contains banned keywords
 */
export function checkBannedKeywords(content: string): GuardrailResult {
    const lowerContent = content.toLowerCase();

    for (const keyword of BANNED_KEYWORDS) {
        if (lowerContent.includes(keyword.toLowerCase())) {
            return {
                passed: false,
                reason: `Blocked: contains banned keyword "${keyword}"`,
                blockedResponse: "I can't process requests related to security exploits or hacking. As a network assistant, I'm here to help you monitor and manage your home router safely.",
            };
        }
    }
    return { passed: true };
}

/**
 * Check if request is off-topic for a network assistant
 */
export function checkOnTopic(content: string): GuardrailResult {
    const lowerContent = content.toLowerCase();

    for (const keyword of OFF_TOPIC_KEYWORDS) {
        if (lowerContent.includes(keyword.toLowerCase())) {
            return {
                passed: false,
                reason: `Blocked: off-topic request "${keyword}"`,
                blockedResponse: "I'm a network assistant focused on helping you with your router and home network. I can show you connected devices, check your internet connection, and monitor network performance. What would you like to know about your network?",
            };
        }
    }
    return { passed: true };
}

/**
 * Combined input guardrail check
 */
export function runInputGuardrails(content: string): GuardrailResult {
    // Check banned keywords first
    const bannedCheck = checkBannedKeywords(content);
    if (!bannedCheck.passed) return bannedCheck;

    // Check if on-topic
    const topicCheck = checkOnTopic(content);
    if (!topicCheck.passed) return topicCheck;

    return { passed: true };
}

// ============ TOOL CALL GUARDRAILS ============

/**
 * Check if a tool call requires confirmation
 */
export function checkSensitiveToolCall(toolName: string): GuardrailResult {
    const lowerToolName = toolName.toLowerCase();

    for (const pattern of SENSITIVE_TOOL_PATTERNS) {
        if (lowerToolName.includes(pattern)) {
            return {
                passed: true, // Still allow, but flag for confirmation
                reason: `Sensitive action: ${toolName} requires user confirmation`,
            };
        }
    }
    return { passed: true };
}

// ============ OUTPUT GUARDRAILS ============

/**
 * Sanitize output to redact sensitive information
 */
export function sanitizeOutput(content: string): string {
    let sanitized = content;

    // Redact passwords
    sanitized = sanitized.replace(/password[:\s]*["']?[\w!@#$%^&*]{4,}["']?/gi, 'password: [REDACTED]');

    // Redact session IDs
    sanitized = sanitized.replace(/SESSIONID=[\w]+/gi, 'SESSIONID=[REDACTED]');

    // Redact private keys
    sanitized = sanitized.replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/g, '[PRIVATE KEY REDACTED]');

    // Redact API keys that might leak
    sanitized = sanitized.replace(/api[_-]?key[:\s]*["']?[\w-]{20,}["']?/gi, 'API_KEY: [REDACTED]');

    return sanitized;
}

// Helper to mask internal tool names from user‑facing output
export function maskToolNames(content: string): string {
    const toolNames = [
        'getDeviceInfo', 'getWanInfo', 'getConnectedDevices', 'getDslStats', 'getWlanStats',
        'getLanStats', 'getDhcpLeases', 'getWifiClients', 'getWifiSettings', 'restartRouter',
        'getParentalControl', 'getQosSettings', 'getFirewallSettings', 'getDdnsSettings',
        'setWifiSsid', 'setWifiPassword', 'setWifiEnabled', 'setWifiChannel',
        'setQosEnabled', 'addQosRule', 'addPortForwarding', 'blockDevice', 'allowDevice',
        'setDhcpEnabled', 'setAdminPassword',
        'pingWebsite', 'lookupDns', 'checkInternetConnectivity', 'checkPortOpen'
    ];
    let masked = content;
    for (const name of toolNames) {
        const regex = new RegExp(`\\b${name}\\b`, 'gi');
        masked = masked.replace(regex, 'the requested operation');
    }
    return masked;
}

// ============ REASONING TRACE HELPERS ============

/**
 * Human-friendly display names for tools (NEVER show internal names to users)
 */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
    // Status & Info
    'getDeviceInfo': 'Fetching router info',
    'getWanInfo': 'Checking internet connection',
    'getConnectedDevices': 'Scanning connected devices',
    'getDslStats': 'Reading DSL statistics',
    'getWlanStats': 'Checking WiFi statistics',
    'getLanStats': 'Reading LAN port stats',
    'getDhcpLeases': 'Looking up device leases',
    'getWifiClients': 'Finding WiFi clients',
    'getWifiSettings': 'Reading WiFi settings',
    // Settings (getters)
    'getParentalControl': 'Checking parental controls',
    'getQosSettings': 'Reading QoS settings',
    'getFirewallSettings': 'Checking firewall status',
    'getDdnsSettings': 'Reading DDNS settings',
    // WiFi Actions
    'restartRouter': 'Restarting router',
    'setWifiSsid': 'Changing network name',
    'setWifiPassword': 'Updating WiFi password',
    'setWifiEnabled': 'Toggling WiFi',
    'setWifiChannel': 'Changing WiFi channel',
    // QoS Actions
    'setQosEnabled': 'Toggling QoS',
    'addQosRule': 'Adding QoS rule',
    // Port Forwarding
    'addPortForwarding': 'Adding port forwarding',
    // Device Blocking
    'blockDevice': 'Blocking device',
    'allowDevice': 'Unblocking device',
    // LAN/DHCP
    'setDhcpEnabled': 'Toggling DHCP',
    // Admin
    'setAdminPassword': 'Changing admin password',
    // Diagnostics
    'pingWebsite': 'Pinging host',
    'lookupDns': 'Looking up DNS',
    'checkInternetConnectivity': 'Testing connectivity',
    'checkPortOpen': 'Checking port',
    // Local Machine
    'getLocalIP': 'Getting your IP address',
    'getLocalNetworkInterfaces': 'Scanning network adapters',
    'getLocalSystemInfo': 'Reading system info',
    'resolveDomain': 'Resolving domain',
    'getDefaultGateway': 'Finding gateway address',
};

/**
 * Get human-friendly display name for a tool
 */
export function getToolDisplayName(toolName: string): string {
    return TOOL_DISPLAY_NAMES[toolName] || 'Processing';
}

/**
 * Format a reasoning step for display (used by streaming UI)
 */
export function formatStepForDisplay(step: string, nodeName?: string): string {
    // Map graph node names to human-friendly steps
    const nodeDisplayNames: Record<string, string> = {
        'input_guardrail': 'Checking request',
        'agent': 'Thinking',
        'tools': 'Running action',
        'output_guardrail': 'Preparing response',
    };

    if (nodeName && nodeDisplayNames[nodeName]) {
        return nodeDisplayNames[nodeName];
    }
    return step;
}

// ============ GRAPH NODE FUNCTIONS ============


/**
 * Input guardrail node - runs before the agent
 * Returns blocked response or allows through
 */
export function inputGuardrailNode(state: { messages: BaseMessage[] }): {
    messages: BaseMessage[];
    blocked?: boolean;
} | undefined {
    const messages = state.messages;
    if (!messages || messages.length === 0) return undefined;

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage._getType() !== 'human') return undefined;

    const content = lastMessage.content?.toString() || '';
    const guardrailResult = runInputGuardrails(content);

    if (!guardrailResult.passed && guardrailResult.blockedResponse) {
        // Return a blocked response
        return {
            messages: [new AIMessage(guardrailResult.blockedResponse)],
            blocked: true,
        };
    }

    return undefined; // Continue to agent
}

/**
 * Output guardrail node - runs after the agent
 * Sanitizes the output
 */
export function outputGuardrailNode(state: { messages: BaseMessage[] }): {
    messages: BaseMessage[];
} | undefined {
    const messages = state.messages;
    if (!messages || messages.length === 0) return undefined;

    // Get the last AI message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage._getType() !== 'ai') return undefined;

    const content = lastMessage.content?.toString() || '';
    const sanitized = sanitizeOutput(content);

    // If content was modified, return updated message
    if (sanitized !== content) {
        return {
            messages: [new AIMessage(sanitized)],
        };
    }

    return undefined; // No changes needed
}

/**
 * Routing function to check if input was blocked
 */
export function shouldBypassAgent(state: { messages: BaseMessage[]; blocked?: boolean }): 'agent' | '__end__' {
    if (state.blocked) {
        return '__end__';
    }
    return 'agent';
}
