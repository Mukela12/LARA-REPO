import React, { useState } from 'react';
import { X, Key, Sliders, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-3-5-sonnet-20241022');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Settings</h2>
            <p className="text-sm text-slate-600">Configure your LARA preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Configuration */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">API Configuration</h3>
            </div>
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Anthropic API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter your Anthropic API key to enable LARA feedback generation
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Claude Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>

          {/* Feedback Preferences */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-900">Feedback Preferences</h3>
            </div>
            <Card>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700">Auto-approve feedback for trusted students</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700">Include text anchors in feedback</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700">Send email notifications on submission</span>
                </label>
              </div>
            </Card>
          </div>

          {/* About */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-slate-900">About</h3>
            </div>
            <Card className="bg-slate-50">
              <div className="space-y-2 text-sm text-slate-600">
                <p><strong className="text-slate-900">LARA</strong> - Learning Assessment & Response Assistant</p>
                <p>Version: 2.1 (Demo)</p>
                <p>Built with Claude Code and React 18</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onClose}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};
