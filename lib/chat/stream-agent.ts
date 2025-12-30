import { StateGraph, Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createRouterTools } from './tools';
import { createLocalMachineTools } from './local-machine-tools';
import { ZTERouterAdapter } from '@/lib/adapters/zte';
import { runInputGuardrails, sanitizeOutput, maskToolNames } from './guardrails';
import { createLLMWithTools, getActiveProvider, getActiveModel, LLMProvider } from './llm-provider';

// Define the state annotation for our graph with guardrail flag
const AgentState = Annotation.Root({
    ...MessagesAnnotation.spec,
    blocked: Annotation<boolean>({ default: () => false, reducer: (_, b) => b }),
});

// Options for the agent
interface AgentOptions {
    provider?: LLMProvider;
    model?: string;
    systemPrompt?: string;
    routerIp?: string;
    sessionCookie?: string;
}

// Create the agent graph with guardrails
function createAgentGraph(options: AgentOptions = {}) {
    const {
        provider = getActiveProvider(),
        model = getActiveModel(),
        systemPrompt = '',
        routerIp = '',
        sessionCookie = '',
    } = options;

    // Create the router adapter and tools
    const adapter = new ZTERouterAdapter(routerIp, sessionCookie);
    const routerTools = createRouterTools(adapter);

    // Create local machine tools (no router required)
    const localTools = createLocalMachineTools();

    // Combine all tools
    const tools = [...routerTools, ...localTools];

    // Create the LLM with tools bound using the provider system
    const llm = createLLMWithTools(tools, { provider, model });

    // Create the tool node
    const toolNode = new ToolNode(tools);

    // ========== GUARDRAIL NODE: Input Validation ==========
    function inputGuardrail(state: typeof AgentState.State) {
        const messages = state.messages;
        if (!messages || messages.length === 0) {
            return { blocked: false };
        }

        // Get the last user message
        const lastMessage = messages[messages.length - 1];
        if (lastMessage._getType() !== 'human') {
            return { blocked: false };
        }

        const content = lastMessage.content?.toString() || '';
        const guardrailResult = runInputGuardrails(content);

        if (!guardrailResult.passed && guardrailResult.blockedResponse) {
            // Return blocked response
            return {
                messages: [new AIMessage(guardrailResult.blockedResponse)],
                blocked: true,
            };
        }

        return { blocked: false };
    }

    // ========== AGENT NODE: Model Call ==========
    async function callModel(state: typeof AgentState.State) {
        const messages = state.messages;

        // Add system message at the beginning if not present
        const hasSystemMessage = messages.some(
            (m: BaseMessage) => m._getType() === 'system'
        );

        const messagesWithSystem = hasSystemMessage
            ? messages
            : [new SystemMessage(systemPrompt), ...messages];

        const response = await llm.invoke(messagesWithSystem);
        return { messages: [response] };
    }

    // ========== GUARDRAIL NODE: Output Sanitization ==========
    function outputGuardrail(state: typeof AgentState.State) {
        const messages = state.messages;
        if (!messages || messages.length === 0) {
            return {};
        }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage._getType() !== 'ai') {
            return {};
        }

        const content = lastMessage.content?.toString() || '';
        const sanitized = sanitizeOutput(content);

        // If content was modified, return updated message
        if (sanitized !== content) {
            return {
                messages: [new AIMessage(sanitized)],
            };
        }

        return {};
    }

    // ========== ROUTING LOGIC ==========

    // Route after input guardrail: blocked -> end, else -> agent
    function routeAfterInputGuardrail(state: typeof AgentState.State): 'agent' | '__end__' {
        if (state.blocked) {
            return '__end__';
        }
        return 'agent';
    }

    // Route after agent: has tool calls -> tools, else -> output_guardrail
    function routeAfterAgent(state: typeof AgentState.State): 'tools' | 'output_guardrail' {
        const messages = state.messages;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            return 'tools';
        }
        return 'output_guardrail';
    }

    // ========== BUILD THE GRAPH ==========
    const graph = new StateGraph(AgentState)
        // Nodes
        .addNode('input_guardrail', inputGuardrail)
        .addNode('agent', callModel)
        .addNode('tools', toolNode)
        .addNode('output_guardrail', outputGuardrail)
        // Edges
        .addEdge('__start__', 'input_guardrail')
        .addConditionalEdges('input_guardrail', routeAfterInputGuardrail)
        .addConditionalEdges('agent', routeAfterAgent)
        .addEdge('tools', 'agent')
        .addEdge('output_guardrail', '__end__');

    return graph.compile();
}

// Convert frontend messages to LangChain format
function convertToLangChainMessages(messages: { role: string; content: string }[]): BaseMessage[] {
    return messages.map((m) => {
        if (m.role === 'user') {
            return new HumanMessage(m.content);
        } else if (m.role === 'assistant') {
            return new AIMessage(m.content);
        } else if (m.role === 'system') {
            return new SystemMessage(m.content);
        }
        return new HumanMessage(m.content);
    });
}

// Main export: get agent response (non-streaming)
export async function getAgentResponse(
    messages: { role: string; content: string }[],
    options: AgentOptions = {}
): Promise<string> {
    const graph = createAgentGraph(options);
    const langchainMessages = convertToLangChainMessages(messages);

    try {
        // Invoke the graph and get final state
        const result = await graph.invoke({ messages: langchainMessages });

        // Get the last AI message from the result
        const resultMessages = result.messages || [];
        for (let i = resultMessages.length - 1; i >= 0; i--) {
            const msg = resultMessages[i];
            if (msg._getType() === 'ai' && msg.content) {
                let textContent = '';
                if (typeof msg.content === 'string') {
                    textContent = msg.content;
                } else if (Array.isArray(msg.content)) {
                    textContent = msg.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text)
                        .join('');
                }
                if (textContent) {
                    // Apply sanitization and mask tool names
                    const sanitized = sanitizeOutput(textContent);
                    const masked = maskToolNames(sanitized);
                    return masked;
                }
            }
        }

        return "I couldn't generate a response. Please try again.";
    } catch (error: any) {
        console.error('Agent error:', error);
        return `Error: ${error.message || 'An unexpected error occurred'}`;
    }
}

// ============ STREAMING WITH EVENTS ============

/**
 * Event types for the reasoning trace
 */
export type StreamEvent =
    | { type: 'step'; step: string }
    | { type: 'tool'; tool: string }
    | { type: 'content'; content: string }
    | { type: 'done'; content: string };

/**
 * Stream agent response with intermediate step events
 * Yields events as the agent processes the request
 */
export async function* streamAgentWithEvents(
    messages: { role: string; content: string }[],
    options: AgentOptions = {}
): AsyncGenerator<StreamEvent> {
    const graph = createAgentGraph(options);
    const langchainMessages = convertToLangChainMessages(messages);

    let finalContent = '';
    const seenNodes = new Set<string>();

    try {
        // Use LangGraph's stream() with 'updates' mode to get node-by-node updates
        const stream = await graph.stream(
            { messages: langchainMessages },
            { streamMode: 'updates' as any }
        );

        for await (const chunk of stream) {
            // chunk is an object like { nodeName: nodeOutput }
            for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
                // Emit step event for each node (but only once per node)
                if (!seenNodes.has(nodeName)) {
                    seenNodes.add(nodeName);

                    // Map node names to human-friendly descriptions
                    const stepDescriptions: Record<string, string> = {
                        'input_guardrail': 'Checking request...',
                        'agent': 'Thinking...',
                        'tools': 'Running action...',
                        'output_guardrail': 'Preparing response...',
                    };

                    if (stepDescriptions[nodeName]) {
                        yield { type: 'step', step: stepDescriptions[nodeName] };
                    }
                }

                // If this is the tools node, extract tool name for more specific feedback
                if (nodeName === 'tools' && nodeOutput) {
                    const output = nodeOutput as any;
                    if (output.messages) {
                        for (const msg of output.messages) {
                            // Tool messages have a 'name' property
                            if (msg.name) {
                                const { getToolDisplayName } = await import('./guardrails');
                                const displayName = getToolDisplayName(msg.name);
                                yield { type: 'tool', tool: displayName };
                            }
                        }
                    }
                }

                // Extract final content from output_guardrail or agent node
                if ((nodeName === 'output_guardrail' || nodeName === 'agent') && nodeOutput) {
                    const output = nodeOutput as any;
                    if (output.messages && output.messages.length > 0) {
                        const lastMsg = output.messages[output.messages.length - 1];
                        if (lastMsg._getType?.() === 'ai' && lastMsg.content) {
                            // Check if this is actual text content (not a tool call)
                            if (typeof lastMsg.content === 'string' && lastMsg.content.trim()) {
                                finalContent = lastMsg.content;
                            } else if (Array.isArray(lastMsg.content)) {
                                const textParts = lastMsg.content
                                    .filter((c: any) => c.type === 'text')
                                    .map((c: any) => c.text);
                                if (textParts.length > 0) {
                                    finalContent = textParts.join('');
                                }
                            }
                        }
                    }
                }
            }

            // Reset seen nodes between iterations if agent loops back
            if (seenNodes.has('tools')) {
                seenNodes.delete('agent'); // Allow "Thinking..." again after tools
            }
        }

        // Stream the final content character by character for smooth animation
        if (finalContent) {
            const sanitized = sanitizeOutput(finalContent);
            const masked = maskToolNames(sanitized);

            // Stream content in small chunks for smooth typing effect
            const CHUNK_SIZE = 3; // Characters per chunk
            for (let i = 0; i < masked.length; i += CHUNK_SIZE) {
                const chunk = masked.slice(i, i + CHUNK_SIZE);
                yield { type: 'content', content: chunk };
                // Small delay to create typing effect (handled by the async generator)
            }

            // Send done event with full content for final state
            yield { type: 'done', content: masked };
        } else {
            yield { type: 'done', content: "I couldn't generate a response. Please try again." };
        }
    } catch (error: any) {
        console.error('Stream agent error:', error);

        // Check for session expiration
        const errorMessage = error.message || '';
        if (errorMessage.toLowerCase().includes('session expired') ||
            errorMessage.includes('401') ||
            errorMessage.includes('403')) {
            yield {
                type: 'done',
                content: '⚠️ **Your router session has expired.** Please go back to the setup page and login to your router again to continue.'
            };
        } else {
            yield { type: 'done', content: `Error: ${errorMessage || 'An unexpected error occurred'}` };
        }
    }
}
