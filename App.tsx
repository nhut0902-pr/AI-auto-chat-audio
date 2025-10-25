import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useSettings } from './hooks/useSettings';
import { SettingsModal } from './components/Settings';
import {
    ConversationState,
    TranscriptEntry,
    ChatMode,
    GroundingSource,
    UploadedFile,
} from './types';
import {
    SettingsIcon,
    MicIcon,
    StopIcon,
    SendIcon,
    GeminiIcon,
    UserIcon,
    SearchIcon,
    ImageIcon,
    BrainIcon,
    DownloadIcon,
    PaperClipIcon,
    XMarkIcon
} from './components/Icons';

const App: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [conversationState, setConversationState] = useState<ConversationState>(ConversationState.IDLE);
    const [chatMode, setChatMode] = useState<ChatMode>('default');
    const [inputText, setInputText] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [isKeySelected, setIsKeySelected] = useState(false);
    const [isCheckingForKey, setIsCheckingForKey] = useState(true);
    const bottomOfChatRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkApiKey = async () => {
            setIsCheckingForKey(true);
            try {
                if (await (window as any).aistudio.hasSelectedApiKey()) {
                    setIsKeySelected(true);
                }
            } catch (e) {
                console.error("Error checking for API key:", e);
            } finally {
                setIsCheckingForKey(false);
            }
        };
        checkApiKey();
    }, []);

    useEffect(() => {
        if (isKeySelected) {
            bottomOfChatRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcript, isKeySelected]);

    const handleSelectKey = async () => {
        try {
            await (window as any).aistudio.openSelectKey();
            // Assume success and update the UI immediately
            setIsKeySelected(true);
        } catch (e) {
            console.error("Error opening select key dialog:", e);
        }
    };


    const handleClearHistory = useCallback(() => {
        setTranscript([]);
    }, []);

    const handleExportChat = useCallback(() => {
        const exported = transcript.map(entry => {
            let content = `[${entry.source}]\n`;
            if (entry.files && entry.files.length > 0) {
                content += `Files: ${entry.files.map(f => f.name).join(', ')}\n`;
            }
            content += entry.text;
            return content;
        }).join('\n\n');
        const blob = new Blob([exported], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-chat-${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [transcript]);

    const fileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                resolve({ mimeType: file.type, data: base64Data });
            };
            reader.onerror = error => reject(error);
        });
    };
    
    const readFileAsText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };


    const handleSend = async () => {
        if ((!inputText.trim() && uploadedFiles.length === 0) || conversationState === ConversationState.PROCESSING) return;

        const filesForTranscript: UploadedFile[] = uploadedFiles.map(f => ({ name: f.name }));
        const userMessage: TranscriptEntry = { source: 'user', text: inputText, files: filesForTranscript };
        
        const newTranscript: TranscriptEntry[] = [...transcript, userMessage];
        setTranscript(newTranscript);

        const filesToProcess = [...uploadedFiles];
        setInputText('');
        setUploadedFiles([]);
        
        setConversationState(ConversationState.PROCESSING);
        
        const geminiTypingMessage: TranscriptEntry = { source: 'gemini', text: '', isTyping: true };
        setTranscript(prev => [...prev, geminiTypingMessage]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            let finalEntry: Omit<TranscriptEntry, 'source'> = { text: '' };

            const textParts: string[] = [inputText];
            const imageParts: { inlineData: { mimeType: string, data: string } }[] = [];
            const unsupportedFiles: string[] = [];
            const SUPPORTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    
            for (const file of filesToProcess) {
                if (SUPPORTED_IMAGE_MIMES.includes(file.type)) {
                    const { mimeType, data } = await fileToBase64(file);
                    imageParts.push({ inlineData: { mimeType, data } });
                } else if (file.type.startsWith('text/')) {
                    const textContent = await readFileAsText(file);
                    textParts.unshift(`--- START OF FILE: ${file.name} ---\n${textContent}\n--- END OF FILE: ${file.name} ---\n\n`);
                } else {
                    unsupportedFiles.push(file.name);
                }
            }

            if (unsupportedFiles.length > 0) {
                const errorMessage = `Lỗi: Loại tệp không được hỗ trợ cho: ${unsupportedFiles.join(', ')}. Chỉ hỗ trợ các tệp hình ảnh và văn bản.`;
                setTranscript(prev => [...prev.slice(0, -1), { source: 'gemini', text: errorMessage }]);
                setConversationState(ConversationState.IDLE);
                return;
            }

            const combinedText = textParts.join('');
            let contents: any;

            if (imageParts.length > 0) {
                contents = { parts: [{ text: combinedText }, ...imageParts] };
            } else {
                contents = combinedText;
            }


            switch (chatMode) {
                case 'search': {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents,
                        config: { tools: [{ googleSearch: {} }] },
                    });
                    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
                        ?.map(chunk => chunk.web)
                        .filter((source): source is GroundingSource => source !== undefined) ?? [];
                    finalEntry = { text: response.text, sources };
                    break;
                }
                case 'image': {
                    finalEntry = { text: `Đang tạo ảnh cho: "${inputText}"...` };
                    setTranscript(prev => [...prev.slice(0, -1), { source: 'gemini', ...finalEntry }]);

                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: { parts: [{ text: inputText }] },
                        config: { responseModalities: [Modality.IMAGE] },
                    });

                    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
                    if (imagePart?.inlineData) {
                        const base64Image = imagePart.inlineData.data;
                        const mimeType = imagePart.inlineData.mimeType;
                        finalEntry = { text: '', imageUrl: `data:${mimeType};base64,${base64Image}` };
                    } else {
                        finalEntry = { text: 'Không thể tạo ảnh. Vui lòng thử lại.' };
                    }
                    break;
                }
                case 'reasoning': {
                    const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents });
                    finalEntry = { text: response.text };
                    break;
                }
                default: {
                    const model = (imageParts.length > 0) ? 'gemini-2.5-flash' : settings.textModel;
                    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction: settings.systemPrompt }});
                    finalEntry = { text: response.text };
                    break;
                }
            }
             setTranscript(prev => [...prev.slice(0, -1), { source: 'gemini', ...finalEntry }]);

        } catch (error) {
            console.error("Gemini API call failed:", error);
            const errorMessage = (error instanceof Error) ? error.message : "Đã xảy ra lỗi không xác định.";
            if (errorMessage.includes("API key not valid") || errorMessage.includes("Requested entity was not found")) {
                setTranscript(prev => [...prev.slice(0, -1), { source: 'gemini', text: `Lỗi: Khóa API không hợp lệ. Vui lòng chọn lại khóa.` }]);
                setIsKeySelected(false);
            } else {
                 setTranscript(prev => [...prev.slice(0, -1), { source: 'gemini', text: `Lỗi: ${errorMessage}` }]);
            }
        } finally {
            setConversationState(ConversationState.IDLE);
        }
    };
    
    const handleMicClick = () => {
        // Placeholder for future audio implementation
        alert("Chức năng ghi âm chưa được triển khai trong phiên bản này.");
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && settings.sendOnEnter && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };
    
    const handleDownloadImage = (imageUrl: string) => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `gemini-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const getFileExtension = (language: string) => {
        const lang = language.toLowerCase();
        const map: { [key: string]: string } = {
            python: 'py', javascript: 'js', typescript: 'ts',
            html: 'html', css: 'css', json: 'json',
            markdown: 'md', shell: 'sh', bash: 'sh', java: 'java',
            csharp: 'cs', cpp: 'cpp', go: 'go', ruby: 'rb',
        };
        return map[lang] || 'txt';
    };

    const handleDownloadFile = (content: string, language: string) => {
        const extension = getFileExtension(language);
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code-snippet.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileSelectClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setUploadedFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
        event.target.value = ''; // Allow selecting the same file again
    };

    const handleRemoveFile = (fileToRemove: File) => {
        setUploadedFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const ParsedContent: React.FC<{ content: string }> = ({ content }) => {
        const parts = content.split(/(```[\w-]*\n[\s\S]*?\n```)/g);
    
        return (
            <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {parts.map((part, index) => {
                    const match = part.match(/```([\w-]*)\n([\s\S]*?)\n```/);
                    if (match) {
                        const language = match[1] || 'text';
                        const code = match[2];
                        return (
                            <div key={index} className="bg-gray-200 dark:bg-black/30 rounded-lg my-2 relative group text-left">
                                <div className="flex justify-between items-center px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600">
                                    <span>{language}</span>
                                    <button
                                        onClick={() => handleDownloadFile(code, language)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> Tải về
                                    </button>
                                </div>
                                <pre className="p-4 overflow-x-auto text-sm">
                                    <code className={`language-${language}`}>{code}</code>
                                </pre>
                            </div>
                        );
                    }
                    return <span key={index}>{part}</span>;
                })}
            </div>
        );
    };

    const renderTranscriptEntry = (entry: TranscriptEntry, index: number) => (
        <div key={index} className={`flex gap-4 p-4 rounded-lg ${entry.source === 'user' ? '' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${entry.source === 'user' ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-200 dark:bg-gray-700'}`}>
                {entry.source === 'user' ? <UserIcon className="w-5 h-5 text-blue-700 dark:text-blue-300" /> : <GeminiIcon className="w-5 h-5" />}
            </div>
            <div className="w-full overflow-hidden">
                 {entry.isTyping ? (
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                    </div>
                ) : (
                    <>
                        {entry.files && entry.files.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {entry.files.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm px-2 py-1 rounded-md">
                                        <PaperClipIcon className="w-4 h-4" />
                                        <span>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {entry.imageUrl && (
                            <div className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                <img src={entry.imageUrl} alt="Generated by Gemini" className="max-w-full h-auto" />
                                <button onClick={() => handleDownloadImage(entry.imageUrl as string)} className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Tải ảnh">
                                    <DownloadIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        {entry.text && <ParsedContent content={entry.text} />}
                        {entry.sources && entry.sources.length > 0 && (
                            <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-2">
                                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">NGUỒN:</h4>
                                <div className="flex flex-col gap-2">
                                {entry.sources.map((source, i) => (
                                    <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate">
                                        {i + 1}. {source.title}
                                    </a>
                                ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
    
    const ModeButton = ({ mode, label, icon }: { mode: ChatMode; label: string; icon: React.ReactNode }) => (
        <button
            onClick={() => setChatMode(mode)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${chatMode === mode ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        >
            {icon} {label}
        </button>
    );

    if (isCheckingForKey) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <GeminiIcon className="w-6 h-6 animate-spin" />
                    <span>Đang kiểm tra Khóa API...</span>
                </div>
            </div>
        );
    }

    if (!isKeySelected) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 text-center">
                 <GeminiIcon className="w-16 h-16 mb-6" />
                 <h1 className="text-3xl font-bold mb-3">Chào mừng bạn đến với Gemini Chat</h1>
                 <p className="max-w-md mb-6 text-gray-600 dark:text-gray-300">
                    Để bắt đầu, vui lòng chọn Khóa API của bạn. Việc sử dụng API Gemini có thể phát sinh chi phí.
                 </p>
                 <button 
                    onClick={handleSelectKey}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                    Chọn Khóa API
                 </button>
                 <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 text-sm text-blue-500 hover:underline"
                 >
                    Tìm hiểu thêm về thanh toán
                 </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-sans">
            <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <GeminiIcon className="w-7 h-7" />
                    <h1 className="text-xl font-semibold">Gemini Chat</h1>
                </div>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Mở cài đặt">
                    <SettingsIcon className="w-6 h-6" />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {transcript.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                        <GeminiIcon className="w-16 h-16 mb-4" />
                        <h2 className="text-2xl font-medium">Làm thế nào tôi có thể giúp bạn hôm nay?</h2>
                     </div>
                ) : (
                    transcript.map(renderTranscriptEntry)
                )}
                <div ref={bottomOfChatRef} />
            </main>

            <footer className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-3">
                         <ModeButton mode="default" label="Trò chuyện" icon={<GeminiIcon className="w-4 h-4" />} />
                         <ModeButton mode="search" label="Tìm kiếm" icon={<SearchIcon className="w-4 h-4" />} />
                         <ModeButton mode="image" label="Tạo ảnh" icon={<ImageIcon className="w-4 h-4" />} />
                         <ModeButton mode="reasoning" label="Suy luận" icon={<BrainIcon className="w-4 h-4" />} />
                    </div>
                    
                    <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {uploadedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            {uploadedFiles.map((file, index) => (
                                <div key={index} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-sm pl-3 pr-2 py-1 rounded-full">
                                    <span>{file.name}</span>
                                    <button onClick={() => handleRemoveFile(file)} className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                                        <XMarkIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="relative">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhắn tin hoặc sử dụng micro..."
                            className="w-full p-4 pl-12 pr-24 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            rows={1}
                            disabled={conversationState === ConversationState.PROCESSING}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                             <button onClick={handleFileSelectClick} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400" aria-label="Đính kèm tệp">
                                <PaperClipIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {(inputText || uploadedFiles.length > 0) ? (
                                <button onClick={handleSend} className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300" disabled={conversationState === ConversationState.PROCESSING}>
                                    <SendIcon className="w-5 h-5" />
                                </button>
                            ) : (
                                <button onClick={handleMicClick} className={`p-3 rounded-full transition-colors bg-blue-600 hover:bg-blue-700`}>
                                    <MicIcon className="w-5 h-5 text-white" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </footer>
            
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                updateSettings={updateSettings}
                onClearHistory={handleClearHistory}
                onExportChat={handleExportChat}
            />
        </div>
    );
};

export default App;