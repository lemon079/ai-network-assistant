import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

interface LoginRouterRequest {
    ip: string;
    username: string;
    password: string;
}

interface LoginRouterResponse {
    success: boolean;
    cookies: string;
    sessionId?: string;
    message?: string;
}

export function useLoginRouter() {
    return useMutation({
        mutationFn: async (credentials: LoginRouterRequest) => {
            const response = await axios.post<LoginRouterResponse>('/api/setup/login', credentials);
            return response.data;
        },
        onSuccess: (_, variables) => {
            // Session is stored in database by the API, no need for localStorage
            toast.success('Connected Successfully!', {
                description: `Logged in to router at ${variables.ip}`,
            });
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.message || 'Failed to connect to router';
            toast.error('Connection Failed', {
                description: errorMessage,
            });
        },
    });
}
