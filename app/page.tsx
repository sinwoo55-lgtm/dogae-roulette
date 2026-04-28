"use client";

import { useState } from "react";

export default function Home() {
  const [namesInput, setNamesInput] = useState("수박*2,키위*2,귤*2");
  const [isRunning, setIsRunning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [rankings, setRankings] = useState<string[]>([]);

  // "수박*2,키위*2" → ["수박", "수박", "키위", "키위"]
  const parseNames = (input: string): string[] => {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .flatMap((token) => {
        const match = token.match(/^(.+?)\*(\d+)$/);
        if (match) {
          const name = match[1].trim();
          const count = parseInt(match[2], 10);
          return Array(count).fill(name);
        }
        return [token];
      });
  };

  const names = parseNames(namesInput);

  const handleStart = () => {
    if (names.length < 2) {
      alert("최소 2명 이상의 참가자가 필요해요!");
      return;
    }
    setWinner(null);
    setRankings([]);
    setIsRunning(true);
    // Part 2에서 실제 시뮬레이션 시작 로직 추가
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <header className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            🎲 도개 룰렛
          </h1>
          <p className="text-slate-300 mt-2">구슬 레이스로 정하는 운명의 순서!</p>
        </header>

        <div className="grid md:grid-cols-[300px_1fr] gap-6">
          {/* 좌측: 컨트롤 패널 */}
          <aside className="bg-slate-800/60 backdrop-blur rounded-2xl p-5 border border-slate-700">
            <h2 className="text-xl font-bold mb-3 text-yellow-300">참가자</h2>
            <textarea
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              disabled={isRunning}
              className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-yellow-400"
              placeholder="이름을 콤마로 구분. 예: 수박*2,키위,귤*3"
            />
            <p className="text-xs text-slate-400 mt-2">
              💡 <strong>이름*숫자</strong>로 여러 개 한 번에 입력 가능
            </p>
            <p className="text-xs text-slate-400">
              현재 참가자: <span className="text-yellow-300 font-bold">{names.length}명</span>
            </p>

            <button
              onClick={handleStart}
              disabled={isRunning}
              className="w-full mt-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-lg"
            >
              {isRunning ? "진행 중..." : "🚀 START"}
            </button>
          </aside>

          {/* 우측: 게임 화면 */}
          <section className="bg-slate-800/60 backdrop-blur rounded-2xl p-5 border border-slate-700 min-h-[600px] flex items-center justify-center">
            {!isRunning && !winner && (
              <div className="text-center text-slate-400">
                <div className="text-6xl mb-4">🎯</div>
                <p>참가자를 입력하고 START를 눌러주세요</p>
              </div>
            )}

            {isRunning && (
              <div className="text-center">
                <div className="text-6xl mb-4 animate-bounce">⚙️</div>
                <p className="text-yellow-300">물리 엔진 준비 중... (Part 2에서 추가 예정)</p>
              </div>
            )}

            {winner && (
              <div className="text-center w-full">
                <div className="text-7xl mb-4">🏆</div>
                <p className="text-slate-300 text-sm">우승자</p>
                <p className="text-4xl font-black text-yellow-300 mb-6">{winner}</p>

                <div className="bg-slate-900/60 rounded-xl p-4 max-h-80 overflow-y-auto">
                  <h3 className="font-bold text-slate-300 mb-2">전체 순위</h3>
                  <ol className="text-left space-y-1">
                    {rankings.map((name, i) => (
                      <li key={i} className="flex justify-between border-b border-slate-700 py-1">
                        <span className="font-bold text-yellow-200">{i + 1}등</span>
                        <span>{name}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <button
                  onClick={() => {
                    setWinner(null);
                    setRankings([]);
                  }}
                  className="mt-4 bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded-lg"
                >
                  다시하기
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}