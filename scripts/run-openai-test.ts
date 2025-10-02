import { analyzePhoto, formatAdvice } from '../lib/openai';

async function main() {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';
  const photo = await analyzePhoto({ image, hints: { symbolText: 'AAPL' } });
  console.log('analyzePhoto output:', JSON.stringify(photo, null, 2));

  const advice = await formatAdvice({
    decision: 'NEUTRAL',
    reasons: ['理由1', '理由2', '理由3'],
    counters: ['反対1', '反対2'],
    nextSteps: ['次1', '次2']
  });
  console.log('formatAdvice output:', JSON.stringify(advice, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

