import { useState, useEffect, useCallback } from 'react';
import { Settings, Theme } from '../types';

const SETTINGS_KEY = 'gemini-audio-app-settings';

const defaultSettings: Settings = {
    systemPrompt: 'Bạn là một trợ lý AI thân thiện và hữu ích. Hãy giữ cho câu trả lời của bạn ngắn gọn và mang tính trò chuyện.',
    voice: 'Zephyr',
    textModel: 'gemini-2.5-flash',
    theme: 'dark',
    sendOnEnter: true,
};

export const useSettings = () => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
            if (storedSettings) {
                // Merge stored settings with defaults to avoid breakages if new settings are added
                return { ...defaultSettings, ...JSON.parse(storedSettings) };
            }
        } catch (error) {
            console.error("Failed to parse settings from localStorage", error);
        }
        return defaultSettings;
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }, [settings]);
    
    useEffect(() => {
        // Apply theme to the root element
        const root = window.document.documentElement;
        if (settings.theme === 'light') {
            root.classList.remove('dark');
        } else {
            root.classList.add('dark');
        }
    }, [settings.theme]);

    const updateSettings = useCallback((newSettings: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    return { settings, updateSettings };
};
