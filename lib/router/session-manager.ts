import { cookies } from 'next/headers';
import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';

// Cookie name for storing router session
const ROUTER_SESSION_COOKIE = 'router_session';

// Types
export interface RouterCredentials {
    ip: string;
    username: string;
    password: string;
}

export interface RouterSession {
    routerIp: string;
    sessionId: string;
    cookies: Array<{ name: string; value: string }>;
}

export interface SessionResult {
    success: boolean;
    sessionId?: string;
    cookies?: Array<{ name: string; value: string }>;
    message?: string;
}

/**
 * Get the current router session from httpOnly cookie
 */
export async function getSession(): Promise<RouterSession | null> {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(ROUTER_SESSION_COOKIE);

        if (!sessionCookie?.value) {
            return null;
        }

        // Parse the JSON stored in the cookie
        const session = JSON.parse(sessionCookie.value) as RouterSession;
        return session;
    } catch (error) {
        console.error('[Cookie Session] Error reading session:', error);
        return null;
    }
}

/**
 * Test if the stored session is still valid with the router
 */
async function testSessionWithRouter(routerIp: string, sessionCookies: Array<{ name: string; value: string }>): Promise<boolean> {
    try {
        const cookieString = sessionCookies.map(c => `${c.name}=${c.value}`).join('; ');

        const response = await axios.get(`http://${routerIp}/`, {
            headers: {
                'Cookie': cookieString
            },
            validateStatus: (status) => status < 500,
            maxRedirects: 0,
            timeout: 5000
        });

        // If we get 401/403 or redirect to login, session is invalid
        if (response.status === 401 || response.status === 403) {
            return false;
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.location;
            if (location?.includes('login')) {
                return false;
            }
        }

        return response.status === 200;
    } catch (error) {
        console.error('[Cookie Session] Error testing session:', error);
        return false;
    }
}

/**
 * Save session to httpOnly cookie
 */
export async function saveSession(session: RouterSession): Promise<void> {
    const cookieStore = await cookies();

    // Store session as JSON in httpOnly cookie
    // No maxAge = session cookie (clears when browser closes)
    cookieStore.set(ROUTER_SESSION_COOKIE, JSON.stringify(session), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        // No maxAge = session cookie, clears when browser closes
    });

    console.log('[Cookie Session] Session saved to cookie');
}

/**
 * Clear the router session cookie
 */
export async function clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(ROUTER_SESSION_COOKIE);
    console.log('[Cookie Session] Session cleared');
}

/**
 * Perform router login using Puppeteer
 */
async function performRouterLogin(credentials: RouterCredentials): Promise<{ sessionId: string; cookies: Array<{ name: string; value: string }> }> {
    let browser: Browser | null = null;

    try {
        console.log('[Cookie Session] Launching browser for login...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page: Page = await browser.newPage();

        // Set up HTTP Basic Auth
        await page.authenticate({
            username: credentials.username,
            password: credentials.password
        });

        console.log(`[Cookie Session] Navigating to http://${credentials.ip}/`);
        const response = await page.goto(`http://${credentials.ip}/`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        if (!response) {
            throw new Error('No response from router');
        }

        if (response.status() === 401) {
            throw new Error('Invalid credentials');
        }

        // Extract cookies
        const browserCookies = await page.cookies();
        console.log('[Cookie Session] Retrieved cookies:', browserCookies.map(c => c.name));

        // Find session cookie
        const sessionCookie = browserCookies.find(
            c => c.name.toLowerCase().includes('session') ||
                c.name.toLowerCase().includes('sid') ||
                c.name.toLowerCase().includes('auth')
        );

        const sessionId = sessionCookie?.value || browserCookies[0]?.value || 'NO_SESSION';

        // Convert to simple format
        const cookies = browserCookies.map(c => ({ name: c.name, value: c.value }));

        await browser.close();
        console.log('[Cookie Session] Login successful');

        return { sessionId, cookies };
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        console.error('[Cookie Session] Login failed:', error);
        throw error;
    }
}

/**
 * Main function: Login to router and save session to cookie
 */
export async function loginAndSaveSession(credentials: RouterCredentials): Promise<SessionResult> {
    try {
        console.log(`[Cookie Session] Logging in to ${credentials.ip}`);

        // Perform login
        const { sessionId, cookies: routerCookies } = await performRouterLogin(credentials);

        // Create session object
        const session: RouterSession = {
            routerIp: credentials.ip,
            sessionId,
            cookies: routerCookies
        };

        // Save to httpOnly cookie
        await saveSession(session);

        return {
            success: true,
            sessionId,
            cookies: routerCookies,
            message: 'Login successful'
        };
    } catch (error: any) {
        console.error('[Cookie Session] Login error:', error);
        return {
            success: false,
            message: error?.message || 'Failed to login'
        };
    }
}

/**
 * Get valid session or return null if expired/invalid
 */
export async function getValidSession(): Promise<RouterSession | null> {
    const session = await getSession();

    if (!session) {
        return null;
    }

    // Test if session is still valid with router
    const isValid = await testSessionWithRouter(session.routerIp, session.cookies);

    if (!isValid) {
        console.log('[Cookie Session] Session expired, clearing');
        await clearSession();
        return null;
    }

    return session;
}
