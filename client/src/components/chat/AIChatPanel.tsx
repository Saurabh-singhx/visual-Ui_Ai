import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Sliders,
  RotateCcw,
  AlertCircle,
  CornerDownLeft,
  Cpu,
  StopCircle,
} from 'lucide-react';
import { AIChatMessage, InteractiveElement } from '../../types';
import { api } from '../../services/api';

interface AIChatPanelProps {
  messages: AIChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  selectedElement: InteractiveElement | null;
  presets: Array<{ id: string; label: string; prompt: string }>;
  onClearChat: () => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  selectedElement,
  presets,
  onClearChat,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [bridgeMsg, setBridgeMsg] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleBridgeApply = async () => {
    if (!inputText.trim()) return;
    setBridgeStatus('sending');
    setBridgeMsg(null);
    try {
      await api.bridgeSelect({
        element: {
          selector: selectedElement?.selector || 'body',
          tagName: selectedElement?.tagName,
          componentHint: selectedElement?.name,
          filePath: selectedElement?.filePath,
          outerHTMLSnippet: selectedElement?.codeSnippet?.slice(0, 300),
        },
        instruction: inputText,
        status: 'pending',
      });
      setBridgeStatus('sent');
      setBridgeMsg('Queued for CLI agent ✓');
      setInputText('');
      setTimeout(() => { setBridgeStatus('idle'); setBridgeMsg(null); }, 3000);
    } catch {
      setBridgeStatus('error');
      setBridgeMsg('Bridge unavailable — is the server running?');
      setTimeout(() => { setBridgeStatus('idle'); setBridgeMsg(null); }, 4000);
    }
  };

  const handleBridgeDone = async () => {
    setBridgeStatus('sending');
    try {
      await api.bridgeDone();
      setBridgeStatus('sent');
      setBridgeMsg('CLI session finished ✓');
      setTimeout(() => { setBridgeStatus('idle'); setBridgeMsg(null); }, 3000);
    } catch {
      setBridgeStatus('error');
      setBridgeMsg('Bridge unavailable');
      setTimeout(() => { setBridgeStatus('idle'); setBridgeMsg(null); }, 4000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-studio-900 border-t lg:border-t-0 lg:border-l border-studio-800 select-none">
      {/* Chat Header */}
      <div className="h-10 bg-studio-900/90 border-b border-studio-800 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">AI Redesign Studio</span>
          {selectedElement && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-300 border border-orange-500/30 truncate max-w-[120px]">
              &lt;{selectedElement.tagName}&gt;
            </span>
          )}
        </div>

        <button
          onClick={onClearChat}
          className="text-studio-500 hover:text-studio-300 p-1 rounded hover:bg-studio-800 transition-colors"
          title="Reset conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shrink-0 text-orange-400">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-studio-950 border border-studio-800 text-studio-200 shadow-md'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Accessibility Improvements Summary */}
              {msg.accessibilityImprovements && msg.accessibilityImprovements.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-studio-800/80">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>WCAG 2.2 Improvements</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-studio-300">
                    {msg.accessibilityImprovements.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Styling Highlights */}
              {msg.stylingDiffSummary && msg.stylingDiffSummary.length > 0 && (
                <div className="mt-2 pt-2 border-t border-studio-800/80">
                  <div className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    <span>Design Enhancements</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-studio-300">
                    {msg.stylingDiffSummary.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-orange-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-studio-800 border border-studio-700 flex items-center justify-center shrink-0 text-studio-300">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center text-studio-400 text-xs">
            <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 animate-spin">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-studio-950 p-3 rounded-2xl border border-studio-800 flex items-center gap-2">
              <span className="animate-pulse">Reasoning and redesigning component UI...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Presets */}
      <div className="p-2 border-t border-studio-800/60 bg-studio-950/40 overflow-x-auto flex gap-1.5 scrollbar-none">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSendMessage(preset.prompt)}
            disabled={isLoading}
            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] bg-studio-800/70 hover:bg-orange-600/30 hover:text-orange-300 text-studio-300 border border-studio-700/60 transition-colors disabled:opacity-50"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-studio-900 border-t border-studio-800">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedElement
                ? `Prompt AI to redesign <${selectedElement.tagName}> or fix styling...`
                : 'Select an element or type a prompt...'
            }
            rows={2}
            className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 pr-10 text-xs text-white placeholder-studio-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none font-sans"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-2.5 bottom-3.5 p-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-studio-800 disabled:text-studio-600 text-white rounded-lg transition-colors"
            title="Send (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-studio-500 mt-1.5 px-1">
          <span>Press Enter to send, Shift+Enter for newline</span>
          <span>Powered by Multimodal UI Engine</span>
        </div>

        {/* CLI Bridge Buttons */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-studio-800/60">
          <button
            type="button"
            onClick={handleBridgeApply}
            disabled={!inputText.trim() || bridgeStatus === 'sending'}
            className="flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 disabled:opacity-40 text-orange-300 border border-orange-500/30 rounded-lg text-xs font-medium transition-colors"
            title="Queue this instruction for the listening CLI agent (visual-ui listen)"
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>Apply via CLI Agent</span>
          </button>
          <button
            type="button"
            onClick={handleBridgeDone}
            disabled={bridgeStatus === 'sending'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-medium transition-colors"
            title="Signal the CLI agent that the visual editing session is finished"
          >
            <StopCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Finish CLI Session</span>
          </button>
        </div>
        {bridgeMsg && (
          <p className={`text-[10px] mt-1 px-1 ${bridgeStatus === 'error' ? 'text-rose-400' : 'text-orange-400'}`}>
            {bridgeMsg}
          </p>
        )}
      </div>
    </div>
  );
};
