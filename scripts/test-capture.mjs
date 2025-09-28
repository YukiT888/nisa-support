const SAMPLE_IMAGE_DATA_URL =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P33jjwAAAABJRU5ErkJggg==';

const BASE_URL = process.env.CAPTURE_TEST_URL ?? 'http://localhost:3000';

const describePayloadKeys = (payload) =>
  Object.entries(payload).map(([key, value]) => `${key}:${typeof value}`);

let lastPayloadKeys = null;

async function main() {
  const imageDataUrl = SAMPLE_IMAGE_DATA_URL;

  const payload = {
    image: imageDataUrl,
    hints: {},
    openAIApiKey: process.env.OPENAI_API_KEY ?? undefined
  };
  lastPayloadKeys = describePayloadKeys(payload);

  const response = await fetch(`${BASE_URL}/api/analyze-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Request failed', response.status, text);
    console.error('Payload keys', lastPayloadKeys);
    process.exit(1);
  }

  const json = await response.json();
  const photo = json.photo ?? {};

  if (!photo.chart_type) {
    throw new Error('chart_type is missing in photo analysis');
  }
  if (!photo.x_axis || typeof photo.x_axis.scale !== 'string' || typeof photo.x_axis.unit !== 'string') {
    throw new Error('x_axis is missing scale/unit');
  }
  if (!photo.y_axis || typeof photo.y_axis.scale !== 'string' || typeof photo.y_axis.unit !== 'string') {
    throw new Error('y_axis is missing scale/unit');
  }

  console.log('Capture test succeeded', {
    chart_type: photo.chart_type,
    x_axis: photo.x_axis,
    y_axis: photo.y_axis
  });

  return lastPayloadKeys;
}

main().catch((error) => {
  console.error('Capture test failed', error);
  if (lastPayloadKeys) {
    console.error('Payload keys', lastPayloadKeys);
  }
  process.exit(1);
});
