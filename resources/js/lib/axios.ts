import axios from 'axios';
import { Capacitor } from '@capacitor/core';

let csrfTokenInitialized = false;

export function setupAxios() {
    // Set base URL for axios requests
    // For Capacitor apps, always use the full backend URL
    // For web, use relative URLs (empty baseURL means same origin)
    const baseURL = Capacitor.isNativePlatform() 
        ? 'https://licaptest.eu-1.sharedwithexpose.com'
        : '';
    
    axios.defaults.baseURL = baseURL;
    
    // Always send cookies and authentication headers
    axios.defaults.withCredentials = true;
    
    // Set default headers for all requests
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    axios.defaults.headers.common['Accept'] = 'application/json';
    
    // Get CSRF token from meta tag or cookie
    const getCsrfToken = () => {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        // Try to get from cookie
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        if (match) {
            return decodeURIComponent(match[1]);
        }
        
        return null;
    };
    
    // Function to initialize CSRF cookie
    const initializeCsrfToken = async () => {
        if (csrfTokenInitialized) return;
        
        try {
            await axios.get('/api/sanctum/csrf-cookie');
            csrfTokenInitialized = true;
        } catch (error) {
            console.warn('Failed to initialize CSRF token:', error);
        }
    };
    
    // Set CSRF token if available
    const csrfToken = getCsrfToken();
    if (csrfToken) {
        axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
    }
    
    // Request interceptor to ensure CSRF token is always sent
    axios.interceptors.request.use(async (config) => {
        // Only try to initialize CSRF token for specific routes to avoid blocking startup
        if (Capacitor.isNativePlatform() && !csrfTokenInitialized && 
            (config.method === 'post' || config.method === 'put' || config.method === 'patch' || config.method === 'delete')) {
            try {
                await initializeCsrfToken();
            } catch (error) {
                console.warn('Could not initialize CSRF token:', error);
            }
        }
        
        const token = getCsrfToken();
        if (token) {
            config.headers['X-CSRF-TOKEN'] = token;
        }
        return config;
    });
    
    // Response interceptor to handle authentication errors
    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            if (error.response?.status === 419) {
                // CSRF token mismatch, get new token
                csrfTokenInitialized = false;
                await initializeCsrfToken();
                
                // Retry the original request
                const originalConfig = error.config;
                if (originalConfig && !originalConfig._retry) {
                    originalConfig._retry = true;
                    const token = getCsrfToken();
                    if (token) {
                        originalConfig.headers['X-CSRF-TOKEN'] = token;
                    }
                    return axios.request(originalConfig);
                }
            }
            return Promise.reject(error);
        }
    );
    
    // Initialize CSRF token on app start for mobile apps (but don't block app startup)
    if (Capacitor.isNativePlatform()) {
        setTimeout(() => {
            console.log('initializeCsrfToken')
            initializeCsrfToken().catch(error => {
                console.warn('CSRF token initialization failed, continuing without it:', error);
            });
        }, 100);
    }
}