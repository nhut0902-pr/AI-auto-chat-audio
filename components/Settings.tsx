import React from 'react';
import { Settings, Voice, TextModel, Theme } from '../types';
import { CloseIcon, TrashIcon, ExportIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  onClearHistory: () => void;
  onExportChat: () => void;
}

const VOICE_OPTIONS: Voice[] = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
const TEXT_MODEL_OPTIONS: TextModel[] = ['gemini-2.5-flash', 'gemini-2.5-pro'];
const THEME_OPTIONS: {value: Theme, label: string}[] = [{value: 'light', label: 'Sáng'}, {value: 'dark', label: 'Tối'}];


export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSettings,
  onClearHistory,
  onExportChat,
}) => {
  if (!isOpen) {
    return null;
  }

  const handleClear = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện không? Hành động này không thể hoàn tác.')) {
        onClearHistory();
        onClose();
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      aria-labelledby="settings-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg m-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl text-gray-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="settings-modal-title" className="text-xl font-semibold">Cài đặt</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Đóng cài đặt">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <label htmlFor="systemPrompt" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Gợi ý hệ thống
            </label>
            <textarea
              id="systemPrompt"
              rows={4}
              className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              value={settings.systemPrompt}
              onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label htmlFor="voice" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Giọng nói
                </label>
                <select
                  id="voice"
                  className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={settings.voice}
                  onChange={(e) => updateSettings({ voice: e.target.value as Voice })}
                >
                  {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="textModel" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mô hình văn bản
                </label>
                <select
                  id="textModel"
                  className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={settings.textModel}
                  onChange={(e) => updateSettings({ textModel: e.target.value as TextModel })}
                >
                  {TEXT_MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
          </div>
          
           <div>
              <label htmlFor="theme" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Chủ đề
              </label>
              <select
                id="theme"
                className="w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as Theme })}
              >
                {THEME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Gửi tin nhắn bằng 'Enter'</span>
                <label htmlFor="sendOnEnter" className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        id="sendOnEnter" 
                        className="sr-only peer"
                        checked={settings.sendOnEnter}
                        onChange={(e) => updateSettings({ sendOnEnter: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3">
                 <button 
                    onClick={onExportChat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                 >
                    <ExportIcon className="w-5 h-5" />
                    Xuất trò chuyện
                 </button>
                 <button 
                    onClick={handleClear}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                 >
                    <TrashIcon className="w-5 h-5" />
                    Xóa lịch sử
                 </button>
            </div>
        </div>

      </div>
    </div>
  );
};
