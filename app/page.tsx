"use client";

import { useState, useRef, useEffect } from "react";
import Matter from "matter-js";

const SPEED_SCALE = 0.7;

export default function Home() {
  const [namesInput, setNamesInput] = useState("수박*2,키위*2,귤*2");
  const [mapLength, setMapLength] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [rankings, setRankings] = useState<string[]>([]);

  const sceneRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const marblesRef = useRef<{ body: Matter.Body; name: string; lastY: number; stuckTime: number }[]>([]);
  const finishedRef = useRef<string[]>([]);
  const cameraYRef = useRef(0);
  const leaderIdRef = useRef<number | null>(null);

  const WIDTH = 500;
  const VIEW_HEIGHT = 700;
  const BASE_SECTION_HEIGHT = 400;
  const SECTION_COUNT = Math.max(1, Math.round((mapLength / 100) * 2));
  const HEIGHT = BASE_SECTION_HEIGHT * SECTION_COUNT + 100;
  const FINISH_Y = HEIGHT - 30;
  const MINIMAP_WIDTH = 500;
  const MINIMAP_HEIGHT = 70;

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

  const cleanup = () => {
    if (renderRef.current) {
      Matter.Render.stop(renderRef.current);
      renderRef.current.canvas.remove();
      renderRef.current = null;
    }
    if (runnerRef.current) {
      Matter.Runner.stop(runnerRef.current);
      runnerRef.current = null;
    }
    if (engineRef.current) {
      Matter.Engine.clear(engineRef.current);
      engineRef.current = null;
    }
    marblesRef.current = [];
    finishedRef.current = [];
    cameraYRef.current = 0;
    leaderIdRef.current = null;
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  // 한 구간 만들기
  const createSection = (yStart: number, sectionIndex: number) => {
    const { Bodies } = Matter;
    const obstacles: Matter.Body[] = [];
    const rotators: { body: Matter.Body; speed: number }[] = [];
    const pendulums: {
      rod: Matter.Body;
      bob: Matter.Body;
      pivot: { x: number; y: number };
      angle: number;
      speed: number;
      rodLength: number;
      bobRadius: number;
    }[] = [];

    const patterns = ["cross", "pendulum", "funnel", "jumppad"];
    const pattern = patterns[sectionIndex % patterns.length];

    if (pattern === "cross") {
      const setups = [
        { x: WIDTH * 0.3, y: yStart + 130, speed: 0.025 * SPEED_SCALE },
        { x: WIDTH * 0.7, y: yStart + 290, speed: -0.025 * SPEED_SCALE },
      ];
      setups.forEach(({ x, y, speed }) => {
        const arm1 = Bodies.rectangle(x, y, 150, 12, {
          isStatic: true,
          render: { fillStyle: "#06b6d4" },
          friction: 0.01,
        });
        const arm2 = Bodies.rectangle(x, y, 12, 150, {
          isStatic: true,
          render: { fillStyle: "#06b6d4" },
          friction: 0.01,
        });
        // 중심 디스크
        const hub = Bodies.circle(x, y, 10, {
          isStatic: true,
          render: { fillStyle: "#0e7490" },
        });
        rotators.push({ body: arm1, speed });
        rotators.push({ body: arm2, speed });
        obstacles.push(arm1, arm2, hub);
      });

      for (let i = 0; i < 4; i++) {
        const x = 60 + i * 110;
        obstacles.push(
          Bodies.circle(x, yStart + 360, 6, {
            isStatic: true,
            render: { fillStyle: "#475569" },
          })
        );
      }
    } else if (pattern === "pendulum") {
      // 진자 3개 — rod + bob 분리
      [0.25, 0.5, 0.75].forEach((ratio, i) => {
        const pivotX = WIDTH * ratio;
        const pivotY = yStart + 50;
        const rodLength = 110;
        const bobRadius = 18;

        // 줄(막대)
        const rod = Bodies.rectangle(pivotX, pivotY + rodLength / 2, 5, rodLength, {
          isStatic: true,
          render: { fillStyle: "#94a3b8" },
        });
        // 추(구슬)
        const bob = Bodies.circle(pivotX, pivotY + rodLength + bobRadius, bobRadius, {
          isStatic: true,
          render: { fillStyle: "#f59e0b" },
          friction: 0.01,
        });
        // 피벗 (천장)
        const pivotMount = Bodies.rectangle(pivotX, pivotY - 6, 30, 8, {
          isStatic: true,
          render: { fillStyle: "#1e293b" },
        });
        const pivotDot = Bodies.circle(pivotX, pivotY, 4, {
          isStatic: true,
          render: { fillStyle: "#facc15" },
        });

        pendulums.push({
          rod,
          bob,
          pivot: { x: pivotX, y: pivotY },
          angle: (i % 2 === 0 ? 1 : -1) * 0.5,
          speed: (0.04 + i * 0.005) * SPEED_SCALE,
          rodLength,
          bobRadius,
        });
        obstacles.push(rod, bob, pivotMount, pivotDot);
      });

      // 핀 한 줄 (진자 아래)
      for (let i = 0; i < 5; i++) {
        const x = 60 + i * 90;
        obstacles.push(
          Bodies.circle(x, yStart + 330, 6, {
            isStatic: true,
            render: { fillStyle: "#475569" },
          })
        );
      }
    } else if (pattern === "funnel") {
      const funnels = [
        { y: yStart + 100, leftX: WIDTH * 0.15, rightX: WIDTH * 0.85, gap: 70 },
        { y: yStart + 280, leftX: WIDTH * 0.25, rightX: WIDTH * 0.75, gap: 90 },
      ];
      funnels.forEach(({ y, leftX, rightX, gap }) => {
        const leftPlate = Bodies.rectangle(
          (leftX + WIDTH / 2 - gap / 2) / 2,
          y,
          Math.hypot(WIDTH / 2 - gap / 2 - leftX, 80),
          12,
          {
            isStatic: true,
            angle: Math.atan2(80, WIDTH / 2 - gap / 2 - leftX),
            render: { fillStyle: "#ec4899" },
          }
        );
        const rightPlate = Bodies.rectangle(
          (rightX + WIDTH / 2 + gap / 2) / 2,
          y,
          Math.hypot(rightX - WIDTH / 2 - gap / 2, 80),
          12,
          {
            isStatic: true,
            angle: -Math.atan2(80, rightX - WIDTH / 2 - gap / 2),
            render: { fillStyle: "#ec4899" },
          }
        );
        obstacles.push(leftPlate, rightPlate);
      });

      for (let i = 0; i < 3; i++) {
        obstacles.push(
          Bodies.circle(WIDTH / 2 - 60 + i * 60, yStart + 200, 6, {
            isStatic: true,
            render: { fillStyle: "#475569" },
          })
        );
      }
    } else if (pattern === "jumppad") {
      const pads = [
        { x: WIDTH * 0.2, y: yStart + 80, angle: -0.4 },
        { x: WIDTH * 0.8, y: yStart + 180, angle: 0.4 },
        { x: WIDTH * 0.2, y: yStart + 280, angle: -0.4 },
        { x: WIDTH * 0.8, y: yStart + 380, angle: 0.4 },
      ];
      pads.forEach(({ x, y, angle }) => {
        obstacles.push(
          Bodies.rectangle(x, y, 130, 14, {
            isStatic: true,
            angle,
            restitution: 1.2,
            render: { fillStyle: "#22c55e" },
          })
        );
      });

      for (let i = 0; i < 6; i++) {
        const x = 50 + i * 80;
        obstacles.push(
          Bodies.circle(x, yStart + 240, 5, {
            isStatic: true,
            render: { fillStyle: "#475569" },
          })
        );
      }
    }

    return { obstacles, rotators, pendulums };
  };

  const startSimulation = (participantNames: string[]) => {
    if (!sceneRef.current) return;

    const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;

    const engine = Engine.create({ gravity: { x: 0, y: 1 } });
    engine.timing.timeScale = SPEED_SCALE;
    engineRef.current = engine;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: WIDTH,
        height: VIEW_HEIGHT,
        wireframes: false,
        background: "#0f172a",
        hasBounds: true,
      },
    });
    renderRef.current = render;

    // 벽
    const walls = [
      Bodies.rectangle(0, HEIGHT / 2, 20, HEIGHT, {
        isStatic: true,
        render: { fillStyle: "#1e293b" },
      }),
      Bodies.rectangle(WIDTH, HEIGHT / 2, 20, HEIGHT, {
        isStatic: true,
        render: { fillStyle: "#1e293b" },
      }),
    ];

    // 결승선
    const finishLine = Bodies.rectangle(WIDTH / 2, FINISH_Y, WIDTH, 30, {
      isStatic: true,
      isSensor: true,
      render: { fillStyle: "#facc15" },
      label: "FINISH",
    });

    Composite.add(engine.world, [...walls, finishLine]);

    const allRotators: { body: Matter.Body; speed: number }[] = [];
    const allPendulums: {
      rod: Matter.Body;
      bob: Matter.Body;
      pivot: { x: number; y: number };
      angle: number;
      speed: number;
      rodLength: number;
      bobRadius: number;
    }[] = [];

    for (let i = 0; i < SECTION_COUNT; i++) {
      const yStart = 100 + i * BASE_SECTION_HEIGHT;
      const { obstacles, rotators, pendulums } = createSection(yStart, i);
      Composite.add(engine.world, obstacles);
      allRotators.push(...rotators);
      allPendulums.push(...pendulums);
    }

    // 회전체 + 진자 애니메이션
    Events.on(engine, "beforeUpdate", () => {
      allRotators.forEach((r) => {
        Matter.Body.setAngle(r.body, r.body.angle + r.speed);
      });
      allPendulums.forEach((p) => {
        p.angle += p.speed;
        const swing = Math.sin(p.angle) * 0.85;

        // 줄 (피벗에서 rodLength/2 만큼 떨어진 곳)
        const rodMidX = p.pivot.x + Math.sin(swing) * (p.rodLength / 2);
        const rodMidY = p.pivot.y + Math.cos(swing) * (p.rodLength / 2);
        Matter.Body.setPosition(p.rod, { x: rodMidX, y: rodMidY });
        Matter.Body.setAngle(p.rod, swing);

        // 추 (피벗에서 rodLength + bobRadius 만큼)
        const totalLen = p.rodLength + p.bobRadius;
        const bobX = p.pivot.x + Math.sin(swing) * totalLen;
        const bobY = p.pivot.y + Math.cos(swing) * totalLen;
        Matter.Body.setPosition(p.bob, { x: bobX, y: bobY });
      });
    });

    const colors = [
      "#ef4444", "#f97316", "#eab308", "#22c55e",
      "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
      "#f43f5e", "#14b8a6", "#a855f7", "#84cc16",
    ];

    const marbles = participantNames.map((name, i) => {
      const cols = 8;
      const x = 60 + (i % cols) * 50;
      const y = 30 + Math.floor(i / cols) * 30;
      const body = Bodies.circle(x, y, 11, {
        restitution: 0.5,
        friction: 0.02,
        density: 0.005,
        render: { fillStyle: colors[i % colors.length] },
        label: `MARBLE_${i}`,
      });
      return { body, name, lastY: y, stuckTime: 0 };
    });
    marblesRef.current = marbles;
    Composite.add(engine.world, marbles.map((m) => m.body));

    // 결승선 충돌 감지
    Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const finishBody =
          bodyA.label === "FINISH" ? bodyA : bodyB.label === "FINISH" ? bodyB : null;
        const marbleBody = bodyA.label.startsWith("MARBLE_")
          ? bodyA
          : bodyB.label.startsWith("MARBLE_")
          ? bodyB
          : null;
        if (finishBody && marbleBody) {
          const marble = marblesRef.current.find((m) => m.body === marbleBody);
          if (marble && !finishedRef.current.includes(marble.name + "_" + marbleBody.id)) {
            finishedRef.current.push(marble.name + "_" + marbleBody.id);
            Matter.Body.setStatic(marbleBody, true);
            Matter.Body.setPosition(marbleBody, { x: -200, y: -200 });
          }
        }
      });

      if (finishedRef.current.length === marblesRef.current.length) {
        const finalRanks = finishedRef.current.map((s) => s.split("_")[0]);
        setRankings(finalRanks);
        setWinner(finalRanks[0]);
        setIsRunning(false);
        setTimeout(() => cleanup(), 500);
      }
    });

    // 끼임 감지 + 카메라 + 미니맵
    Events.on(engine, "afterUpdate", () => {
      // 활성 구슬
      const activeMarbles = marblesRef.current.filter(
        (m) => !finishedRef.current.some((f) => f.endsWith("_" + m.body.id))
      );

      // 끼임 감지
      activeMarbles.forEach((m) => {
        const dy = Math.abs(m.body.position.y - m.lastY);
        if (dy < 0.2) {
          m.stuckTime += 1;
        } else {
          m.stuckTime = 0;
        }
        m.lastY = m.body.position.y;

        if (m.stuckTime > 90) {
          Matter.Body.applyForce(m.body, m.body.position, {
            x: (Math.random() - 0.5) * 0.05,
            y: 0.02,
          });
          m.stuckTime = 0;
        }
      });

      // 1등 (가장 앞선) 구슬 ID 갱신
      if (activeMarbles.length > 0) {
        const leader = activeMarbles.reduce((prev, curr) =>
          curr.body.position.y > prev.body.position.y ? curr : prev
        );
        leaderIdRef.current = leader.body.id;

        // 카메라: 1등 구슬을 화면 35% 지점에 (부드럽게)
        const targetY = Math.max(
          0,
          Math.min(HEIGHT - VIEW_HEIGHT, leader.body.position.y - VIEW_HEIGHT * 0.35)
        );
        cameraYRef.current += (targetY - cameraYRef.current) * 0.08;

        if (renderRef.current) {
          renderRef.current.bounds.min.y = cameraYRef.current;
          renderRef.current.bounds.max.y = cameraYRef.current + VIEW_HEIGHT;
          renderRef.current.bounds.min.x = 0;
          renderRef.current.bounds.max.x = WIDTH;
        }
      }
    });

    // 라벨 + 1등 강조
    Events.on(render, "afterRender", () => {
      const ctx = render.context;
      const offsetY = render.bounds.min.y;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      marblesRef.current.forEach((m) => {
        if (finishedRef.current.some((f) => f.endsWith("_" + m.body.id))) return;

        // 1등 외곽선 강조
        if (m.body.id === leaderIdRef.current) {
          ctx.beginPath();
          ctx.arc(
            m.body.position.x,
            m.body.position.y - offsetY,
            16,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 3;
          ctx.stroke();
          // 왕관 이모지
          ctx.font = "16px sans-serif";
          ctx.fillText("👑", m.body.position.x, m.body.position.y - offsetY - 28);
          ctx.font = "bold 11px sans-serif";
        }

        // 라벨 배경
        const labelY = m.body.position.y - 18 - offsetY;
        const labelX = m.body.position.x;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        const textWidth = ctx.measureText(m.name).width + 8;
        ctx.fillRect(labelX - textWidth / 2, labelY - 8, textWidth, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(m.name, labelX, labelY);
      });

      // 미니맵 그리기
      const mc = minimapRef.current;
      if (mc) {
        const mctx = mc.getContext("2d");
        if (mctx) {
          // 배경
          mctx.fillStyle = "#0f172a";
          mctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

          // 구간 구분선
          for (let i = 1; i < SECTION_COUNT; i++) {
            const sx = ((i * BASE_SECTION_HEIGHT + 100) / HEIGHT) * MINIMAP_WIDTH;
            mctx.fillStyle = "#1e293b";
            mctx.fillRect(sx, 0, 1, MINIMAP_HEIGHT);
          }

          // 출발선
          mctx.fillStyle = "#475569";
          mctx.fillRect(0, 0, 4, MINIMAP_HEIGHT);
          // 결승선
          mctx.fillStyle = "#facc15";
          mctx.fillRect(MINIMAP_WIDTH - 4, 0, 4, MINIMAP_HEIGHT);

          // 카메라 영역
          if (renderRef.current) {
            const camStartX = (renderRef.current.bounds.min.y / HEIGHT) * MINIMAP_WIDTH;
            const camEndX = (renderRef.current.bounds.max.y / HEIGHT) * MINIMAP_WIDTH;
            mctx.fillStyle = "rgba(6, 182, 212, 0.18)";
            mctx.fillRect(camStartX, 0, camEndX - camStartX, MINIMAP_HEIGHT);
            mctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
            mctx.lineWidth = 1;
            mctx.strokeRect(camStartX, 0, camEndX - camStartX, MINIMAP_HEIGHT);
          }

          // 구슬 표시
          marblesRef.current.forEach((m) => {
            const isFinished = finishedRef.current.some((f) => f.endsWith("_" + m.body.id));
            if (isFinished) return;
            const mx = (m.body.position.y / HEIGHT) * MINIMAP_WIDTH;
            const my = (m.body.position.x / WIDTH) * MINIMAP_HEIGHT;
            const color = (m.body.render.fillStyle as string) || "#fff";
            mctx.fillStyle = color;
            mctx.beginPath();
            mctx.arc(mx, my, m.body.id === leaderIdRef.current ? 4 : 2.5, 0, Math.PI * 2);
            mctx.fill();
            // 1등은 외곽선
            if (m.body.id === leaderIdRef.current) {
              mctx.strokeStyle = "#facc15";
              mctx.lineWidth = 1.5;
              mctx.stroke();
            }
          });
        }
      }
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;
  };

  const handleStart = () => {
    if (names.length < 2) {
      alert("최소 2명 이상의 참가자가 필요해요!");
      return;
    }
    setWinner(null);
    setRankings([]);
    setIsRunning(true);
    cleanup();
    setTimeout(() => startSimulation(names), 100);
  };

  const handleReset = () => {
    setWinner(null);
    setRankings([]);
    cleanup();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            🎲 도개 룰렛
          </h1>
          <p className="text-slate-300 mt-2">구슬 레이스로 정하는 운명의 순서!</p>
        </header>

        <div className="grid md:grid-cols-[300px_1fr] gap-6">
          <aside className="bg-slate-800/60 backdrop-blur rounded-2xl p-5 border border-slate-700 h-fit space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-3 text-cyan-300">참가자</h2>
              <textarea
                value={namesInput}
                onChange={(e) => setNamesInput(e.target.value)}
                disabled={isRunning}
                className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-cyan-400"
                placeholder="이름을 콤마로 구분. 예: 수박*2,키위,귤*3"
              />
              <p className="text-xs text-slate-400 mt-2">
                💡 <strong>이름*숫자</strong>로 여러 개 한 번에 입력 가능
              </p>
              <p className="text-xs text-slate-400">
                현재 참가자: <span className="text-cyan-300 font-bold">{names.length}명</span>
              </p>
            </div>

            <div>
              <label className="text-sm font-bold text-cyan-300 flex justify-between mb-2">
                <span>맵 길이</span>
                <span className="text-cyan-200">{mapLength}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="300"
                step="10"
                value={mapLength}
                onChange={(e) => setMapLength(parseInt(e.target.value))}
                disabled={isRunning}
                className="w-full accent-cyan-400"
              />
              <p className="text-xs text-slate-400 mt-1">
                구간 수: <span className="text-cyan-300 font-bold">{SECTION_COUNT}개</span>
              </p>
            </div>

            <button
              onClick={handleStart}
              disabled={isRunning}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-lg"
            >
              {isRunning ? "진행 중..." : "🚀 START"}
            </button>

            {winner && (
              <button
                onClick={handleReset}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition"
              >
                다시하기
              </button>
            )}
          </aside>

          <section className="bg-slate-800/60 backdrop-blur rounded-2xl p-5 border border-slate-700">
            <div className="flex flex-col lg:flex-row gap-4 items-start justify-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  ref={sceneRef}
                  className="rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700"
                  style={{ width: WIDTH, height: VIEW_HEIGHT }}
                />
                {/* 미니맵 */}
                <div className="w-full">
                  <p className="text-xs text-slate-400 mb-1 flex justify-between">
                    <span>📍 미니맵</span>
                    <span className="text-cyan-300">← 출발 ‧ 결승 →</span>
                  </p>
                  <canvas
                    ref={minimapRef}
                    width={MINIMAP_WIDTH}
                    height={MINIMAP_HEIGHT}
                    className="rounded-lg border border-slate-700 w-full"
                    style={{ display: "block" }}
                  />
                </div>
              </div>

              {winner && (
                <div className="bg-slate-900/80 rounded-xl p-4 w-full lg:w-72">
                  <div className="text-center mb-4">
                    <div className="text-5xl mb-2">🏆</div>
                    <p className="text-slate-300 text-xs">우승자</p>
                    <p className="text-3xl font-black text-yellow-300">{winner}</p>
                  </div>

                  <h3 className="font-bold text-slate-300 mb-2 text-sm">전체 순위</h3>
                  <ol className="text-sm space-y-1 max-h-96 overflow-y-auto">
                    {rankings.map((name, i) => (
                      <li
                        key={i}
                        className="flex justify-between border-b border-slate-700 py-1.5"
                      >
                        <span
                          className={`font-bold ${
                            i === 0
                              ? "text-yellow-300"
                              : i === 1
                              ? "text-slate-300"
                              : i === 2
                              ? "text-orange-400"
                              : "text-slate-400"
                          }`}
                        >
                          {i + 1}등
                        </span>
                        <span>{name}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}