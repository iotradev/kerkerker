"use client";

import { useState, useEffect } from "react";

// 备用本地吉祥话（API 不可用时兜底）
const FALLBACK_PHRASES = [
  "龙腾四海，福满乾坤",
  "吉星高照，万事如意",
  "紫气东来，鸿运当头",
  "心想事成，步步高升",
  "花开富贵，竹报平安",
  "金玉满堂，喜气盈门",
  "鹏程万里，前途光明",
  "时来运转，否极泰来",
  "顺风顺水，一帆风顺",
  "春风得意，前程似锦",
];

interface HitokotoResponse {
  hitokoto: string;
  from: string;
  from_who?: string;
  type: string;
}

export function Footer() {
  const [phrase, setPhrase] = useState("");
  const [source, setSource] = useState("");

  const fetchPhrase = async () => {
    try {
      // 一言 API：随机获取一句中文句子
      const res = await fetch("https://v1.hitokoto.cn/?c=d&c=h&c=i&c=k&encode=json");
      if (!res.ok) throw new Error("API error");
      const data: HitokotoResponse = await res.json();
      setPhrase(data.hitokoto);
      setSource(data.from_who ? `${data.from_who}「${data.from}」` : `「${data.from}」`);
    } catch {
      // API 失败时用本地吉祥话兜底
      setPhrase(FALLBACK_PHRASES[Math.floor(Math.random() * FALLBACK_PHRASES.length)]);
      setSource("");
    }
  };

  useEffect(() => {
    fetchPhrase();
  }, []);

  return (
    <footer className="mt-20 border-t border-gray-800 bg-gradient-to-b from-black to-gray-950">
      <div className="mx-auto px-4 md:px-12 py-12">
        {/* 每日一言 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-yellow-400 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
              每日一言
            </h3>
            <button
              onClick={fetchPhrase}
              className="text-xs text-gray-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
              title="换一句"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              换一句
            </button>
          </div>
          <div className="text-center py-6">
            <p className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-400 to-yellow-400 tracking-wide leading-relaxed">
              {phrase || "\u00A0"}
            </p>
            {source && (
              <p className="text-sm text-gray-500 mt-4 italic">
                —— {source}
              </p>
            )}
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-gray-800 my-8"></div>

        {/* 底部信息 */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>© 2026 壳儿</span>
            <span className="text-gray-700">|</span>
            <span>仅供学习交流使用</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/unilei/kerkerker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              GitHub
            </a>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              回到顶部
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
