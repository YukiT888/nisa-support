'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import ja from '@/public/i18n/ja.json';

const t = ja.nisa;

export default function NisaPage() {
  const [monthly, setMonthly] = useState(5_0000);
  const [years, setYears] = useState(10);
  const [returnRate, setReturnRate] = useState(0.04);

  const futureValue = useMemo(() => {
    const periods = years * 12;
    const monthlyRate = returnRate / 12;
    let total = 0;
    for (let i = 0; i < periods; i += 1) {
      total = (total + monthly) * (1 + monthlyRate);
    }
    return Math.round(total);
  }, [monthly, years, returnRate]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-xs text-white/60">非課税枠を活用して長期分散投資を学びましょう。</p>
      </header>
      <Card className="space-y-3 text-sm">
        <h3 className="text-base font-semibold text-kachi-accent">{t.overview}</h3>
        <ul className="list-disc space-y-1 pl-5 text-white/80">
          <li>年間360万円（つみたて枠120万円 + 成長投資枠240万円）が上限。</li>
          <li>非課税保有期間は無期限。売却枠は翌年に再利用可能。</li>
          <li>低コストETFや投信での分散投資が王道。過度な集中は避けましょう。</li>
        </ul>
      </Card>
      <Card className="space-y-3 text-sm">
        <h3 className="text-base font-semibold text-kachi-accent">{t.qa}</h3>
        <details className="rounded-xl bg-white/5 p-3">
          <summary className="cursor-pointer font-semibold">途中で売却しても良い？</summary>
          <p className="mt-2 text-white/70">非課税枠は売却時に消化されますが、翌年に限り同額を再利用できます。長期計画に基づき、必要資金は生活防衛資金で確保しましょう。</p>
        </details>
        <details className="rounded-xl bg-white/5 p-3">
          <summary className="cursor-pointer font-semibold">銘柄はどう選ぶ？</summary>
          <p className="mt-2 text-white/70">費用率が低く、分散が効いたETFやインデックスファンドが基本。アプリの銘柄ナビから手数料・配当・リスクを比較できます。</p>
        </details>
      </Card>
      <Card className="space-y-3 text-sm">
        <h3 className="text-base font-semibold text-kachi-accent">{t.steps}</h3>
        <ol className="list-decimal space-y-1 pl-5 text-white/80">
          <li>目標期間とリスク許容度を定義。</li>
          <li>APIキーを登録し、チャート解析でシグナルの見方を学ぶ。</li>
          <li>銘柄ナビで低コストETFを比較し、分散ポートフォリオを組む。</li>
          <li>定期的に振り返り、必要に応じてリバランス。</li>
        </ol>
      </Card>
      <Card className="space-y-3 text-sm">
        <h3 className="text-base font-semibold text-kachi-accent">{t.simulator}</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">毎月の積立額（円）</span>
            <input
              type="number"
              value={monthly}
              onChange={(event) => setMonthly(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">運用年数</span>
            <input
              type="number"
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">想定年率リターン</span>
            <input
              type="number"
              step="0.01"
              value={returnRate}
              onChange={(event) => setReturnRate(Number(event.target.value))}
              className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
            />
          </label>
        </div>
        <p className="text-xs text-white/70">将来価値（概算）: <span className="text-kachi-accent text-lg font-semibold">{futureValue.toLocaleString()}円</span></p>
        <p className="text-[10px] text-white/50">シミュレーションは税金・手数料を考慮しておらず、実績を保証するものではありません。</p>
      </Card>
    </div>
  );
}
