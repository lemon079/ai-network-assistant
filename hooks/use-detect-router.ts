import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface DetectRouterResponse {
    found: boolean;
    router?: {
        name: string;
        ip: string;
    };
}

export function useDetectRouter(enabled: boolean = true) {
    return useQuery({
        queryKey: ['detect-router'],
        queryFn: async () => {
            const response = await axios.get<DetectRouterResponse>('/api/setup/detect');
            return response.data;
        },
        enabled, // Only run when enabled
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
