# OpenAI Responses API `response_format` Error

The OpenAI Responses API replaced the legacy `response_format` top-level field in April 2024. According to the official documentation for [`POST /v1/responses`](https://platform.openai.com/docs/api-reference/responses/create), structured outputs must now be configured inside the `text` object with a `format` property. Example:

```json
{
  "model": "gpt-5.0-mini",
  "input": [
    {
      "role": "user",
      "content": [
        { "type": "input_text", "text": "Hello" }
      ]
    }
  ],
  "text": {
    "format": "json_schema",
    "json_schema": {
      "name": "example",
      "schema": {
        "type": "object",
        "properties": {
          "message": { "type": "string" }
        },
        "required": ["message"]
      }
    }
  }
}
```

If the legacy payload still includes the old `response_format` property, the API responds with the 400 error:

```
Unsupported parameter: 'response_format'. In the Responses API, this parameter has moved to 'text.format'.
```

Therefore the error shown in the screenshot is caused by an outdated request body that still sends `response_format`. Update the client so the schema lives under `text.format` (e.g. `text: { format: 'json_schema', json_schema: { ... } }`) instead of the removed top-level field.

> **Using GPT-5 only?**
>
> The integration now enforces GPT-5 usage exclusively. Environment overrides (`OPENAI_MODEL`, `OPENAI_MODEL_TEXT`, `OPENAI_MODEL_VISION`) must reference GPT-5 family models (e.g. `gpt-5.0-mini`); providing any other identifier throws an explicit configuration error. If you leave the variables unset, the app falls back to `gpt-5.0-mini` for every request.
>
> Screenshot uploads route through the same guardrails. The `analyzePhoto` workflow automatically selects the GPT-5 vision-capable model before calling the Responses API, so chart images are always parsed by GPT-5.
