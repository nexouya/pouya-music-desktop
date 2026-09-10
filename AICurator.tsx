/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Send, Sparkles, Cpu, Plus, Music, MessageSquareDot } from 'lucide-react';
import { Track } from './types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AICuratorProps {
  onAddRecommendationToFS: (recTrack: Track) => void;
  language: 'en' | 'fa';
  l: any;
  showToast?: (msg: string) => void;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  recommendedTracks?: Array<{
    title: string;
    artist: string;
    category: string;
    description: string;
    songIndex: number;
  }>;
}

export const AICurator: React.FC<AICuratorProps> = ({ onAddRecommendationToFS, language, l, showToast }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        sender: 'ai',
        text: language === 'fa' 
          ? "✨ **[دستیار هوشمند آماده است]** - من دستیار هوشمند و مشاور موسیقی شما در پویا موزیک هستم. زیباترین پلی‌لیست‌ها و آهنگ‌های دنیا را متناسب با سلیقه شما پیشنهاد می‌دهم. سبک یا حس و حال مورد نظر خود را بنویسید."
          : "✨ **[AI MUSIC ASSISTANT READY]** - I am your personal music curator. I'll help you explore beautiful playlists and customized track selections. Tell me what mood, genre, or vibe matches your activity (e.g. moody dark-pop, lofi focus, upbeat workspace).",
      }
    ];
  });
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync initial message on language swap
  React.useEffect(() => {
    setMessages([
      {
        sender: 'ai',
        text: language === 'fa'
          ? "✨ **[دستیار هوشمند آماده است]** - من دستیار هوشمند و مشاور موسیقی شما در پویا موزیک هستم. زیباترین پلی‌لیست‌ها و آهنگ‌های دنیا را متناسب با سلیقه شما پیشنهاد می‌دهم. سبک یا حس و حال مورد نظر خود را بنویسید."
          : "✨ **[AI MUSIC ASSISTANT READY]** - I am your personal music curator. I'll help you explore beautiful playlists and customized track selections. Tell me what mood, genre, or vibe matches your activity (e.g. moody dark-pop, lofi focus, upbeat workspace).",
      }
    ]);
  }, [language]);

  const handleSend = async () => {
    if (input.trim() === '') return;

    const userMsgText = input;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMsgText }]);
    setIsLoading(true);

    try {
      const response = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/curate-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userMsgText }),
      });

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: '',
          recommendedTracks: [],
        },
      ]);
      
      let fullText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              if (data.type === 'chunk' && data.text) {
                fullText += data.text;
                // Avoid showing the hidden JSON block to the user while it's typing
                const displayObj = fullText.split('JSON_TRACKS_START')[0].trim();
                setMessages(prev => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  newArr[lastIdx] = { ...newArr[lastIdx], text: displayObj };
                  return newArr;
                });
              } else if (data.type === 'tracks' && data.tracks) {
                setMessages(prev => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  newArr[lastIdx] = { ...newArr[lastIdx], recommendedTracks: data.tracks };
                  return newArr;
                });
              }
            } catch(e) {}
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const newArr = [...prev];
        const lastIdx = newArr.length - 1;
        if (newArr[lastIdx].sender === 'ai' && newArr[lastIdx].text === '') {
          newArr.pop(); // Remove empty bubble
        }
        return [
          ...newArr,
          {
            sender: 'ai',
            text: "⚠️ **[خطا در برقراری ارتباط]** - متأسفانه ارتباط موقتاً با سرور برقرار نشد. لطفاً سبک یا حس و حال خود را مجدداً ارسال کنید تا پلی‌لیست مناسب را پیشنهاد دهم.",
          },
        ];
      });
    } finally {
      setIsLoading(false);
      setMessages(prev => {
        const newArr = [...prev];
        const lastIdx = newArr.length - 1;
        if (lastIdx >= 0 && newArr[lastIdx].sender === 'ai' && !newArr[lastIdx].text.trim() && (!newArr[lastIdx].recommendedTracks || newArr[lastIdx].recommendedTracks.length === 0)) {
           newArr[lastIdx].text = language === 'fa' ? '⚠️ سرور پاسخی نداد. لطفاً دوباره تلاش کنید.' : '⚠️ Server returned no response. Please try again.';
        }
        return newArr;
      });
    }
  };

  const handleInjectTrack = (rec: {
    title: string;
    artist: string;
    category: string;
    description: string;
    songIndex: number;
  }) => {
    // Map songIndex to reliable SoundHelix stream
    const audioUrl = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${Math.max(1, Math.min(16, rec.songIndex))}.mp3`;

    const newTrack: Track = {
      id: `ai-rec-${Date.now()}-${rec.songIndex}`,
      title: rec.title,
      artist: rec.artist,
      url: audioUrl,
      duration: 320,
      coverUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400&fit=crop", // Elegant dark glassy cover
      isLocal: false,
      category: rec.category,
    };

    onAddRecommendationToFS(newTrack);
    const successMsg = language === 'fa' 
      ? `قطعه [${rec.title}] با موفقیت به کتابخانه موسیقی شما اضافه شد!`
      : `Successfully added [${rec.title}] to your music library!`;
    if (showToast) {
      showToast(successMsg);
    }
  };

  return (
    <div dir={l.dir} className="flex flex-col h-full rounded-2xl bg-slate-950/45 border border-white/10 shadow-2xl shadow-purple-950/5 backdrop-blur-3xl overflow-hidden p-6 gap-4 min-h-[480px]">
      {/* SHINY PURPLE GLOW */}
      <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-purple-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5 animate-pulse" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,1)]" />
              <span className="text-xs font-mono text-purple-400 uppercase tracking-wider font-semibold">
                {language === 'fa' ? 'پیشنهاد دهنده هوشمند پویا' : 'PERSONAL VIBE RECOMMEND'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100">{l.aiCoreTitle}</h3>
          </div>
        </div>
      </div>

      {/* CHAT BUBBLES BLOCK */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin flex flex-col gap-4 min-h-[220px] pb-4 z-10">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-2 max-w-[85%] ${
              msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
            }`}
          >
            {/* Sender and Bubble container */}
            <div
              className={`p-4 rounded-2xl text-sm leading-relaxed border ${
                msg.sender === 'user'
                  ? `bg-purple-950/20 border-purple-500/20 text-purple-100 ${language === 'fa' ? 'rounded-tl-none' : 'rounded-tr-none'}`
                  : `bg-slate-950/50 border-slate-900/60 text-slate-200 backdrop-blur-md ${language === 'fa' ? 'rounded-tr-none' : 'rounded-tl-none'}`
              }`}
            >
              {/* Formatted body text */}
              <div className="whitespace-pre-wrap markdown-body text-start">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({node, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      return isInline ? (
                        <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 text-purple-300 px-2.5 py-0.5 rounded-lg font-medium border border-purple-500/20 mx-1 align-baseline mt-1 mb-1 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                          <Music className="w-3.5 h-3.5 text-purple-400" strokeWidth={1.75} />
                          <code className={className} {...props}>{children}</code>
                        </span>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    }
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>

              {/* Suggested Tracks List mapping */}
              {msg.recommendedTracks && msg.recommendedTracks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-900 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 font-mono text-xs text-purple-400 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {l.cognitiveRecon}
                  </div>

                  <div className="flex flex-col gap-2">
                    {msg.recommendedTracks.map((rec, trackIdx) => (
                      <div
                        key={trackIdx}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-purple-500/30 transition-all gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-100 flex items-center gap-1">
                            <Music className="w-3 h-3 text-purple-400 inline-block" strokeWidth={1.75} />
                            {rec.title}
                          </p>
                          <p className="text-xxs font-mono text-slate-400 mt-0.5">
                            {language === 'fa' ? 'اثر: ' : 'by '} {rec.artist} • <span className="text-purple-400">{rec.category}</span>
                          </p>
                          <p className="text-xxs text-slate-500 italic mt-1 line-clamp-1">{rec.description}</p>
                        </div>

                        <button
                          onClick={() => handleInjectTrack(rec)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-950/30 border border-purple-500/25 hover:bg-purple-950 text-purple-300 hover:text-purple-200 hover:border-purple-400 font-mono text-xxs uppercase tracking-wider transition-all self-end sm:self-auto"
                          id={`inject-track-btn-${trackIdx}`}
                        >
                          <Plus className="w-3 h-3" strokeWidth={1.75} />
                          {l.injectBtn}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* LOADING SHADOW INDIX */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 self-start bg-purple-950/20 border border-purple-500/25 px-4 py-2.5 rounded-xl animate-pulse">
            <Cpu className="w-4 h-4 animate-spin" strokeWidth={1.75} />
            <span>{l.consultingAi}</span>
          </div>
        )}
      </div>

      {/* INPUT ACTIONS SECTION */}
      <div className="flex items-center gap-2 mt-auto border-t border-slate-900 pt-4 z-10" dir="ltr">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={l.placeholderAi}
          disabled={isLoading}
          className="flex-grow bg-slate-950 border border-slate-900 rounded-xl px-4 py-2 sm:py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-purple-500/40 transition-colors font-sans"
          id="ai-prompt-input"
          dir={language === 'fa' ? 'rtl' : 'ltr'}
        />
        <button
          onClick={handleSend}
          disabled={input.trim() === '' || isLoading}
          className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:shadow-[0_0_18px_rgba(168,85,247,0.5)] transition-all flex-shrink-0"
          id="ai-send-btn"
        >
          <Send className={`w-4 h-4 ml-0.5`} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
