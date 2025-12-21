import { streamAgentWithEvents } from '@/lib/chat/stream-agent';
import { SYSTEM_PROMPT } from '@/lib/chat/prompts';
import { getSession } from '@/lib/router/session-manager';

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // Validate basic request structure
        if (!Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: 'Invalid request: messages must be an array' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Get router session from httpOnly cookie
        const routerSession = await getSession();

        if (!routerSession) {
            return new Response(
                JSON.stringify({ error: 'No router session found. Please login to your router first.' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const routerIp = routerSession.routerIp;
        const sessionCookie = routerSession.cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Create SSE stream using ReadableStream
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream events from the agent
                    const eventStream = streamAgentWithEvents(messages, {
                        systemPrompt: SYSTEM_PROMPT,
                        routerIp,
                        sessionCookie,
                    });

                    for await (const event of eventStream) {
                        // Format as SSE: data: {...}\n\n
                        const sseData = `data: ${JSON.stringify(event)}\n\n`;
                        controller.enqueue(encoder.encode(sseData));
                    }

                    controller.close();
                } catch (error) {
                    console.error('Stream error:', error);
                    const errorEvent = `data: ${JSON.stringify({ type: 'done', content: 'An error occurred while processing your request.' })}\n\n`;
                    controller.enqueue(encoder.encode(errorEvent));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });
    } catch (error) {
        console.error('Error in chat route:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to process chat request' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
