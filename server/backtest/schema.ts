export const DATASET_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Mavrix 009 historical option candles",
  type: "object",
  required: ["version", "date", "spotReferenceClose", "contracts", "candles"],
  properties: {
    version: { const: 1 },
    date: { type: "string", format: "date" },
    spotReferenceClose: {
      type: "number",
      exclusiveMinimum: 0,
      description:
        "Actual NIFTY 09:15–09:20 close, used to select the historical ATM pair.",
    },
    contracts: {
      type: "object",
      required: ["CE", "PE"],
      properties: {
        CE: { $ref: "#/$defs/contract" },
        PE: { $ref: "#/$defs/contract" },
      },
    },
    candles: {
      type: "object",
      required: ["CE", "PE"],
      properties: {
        CE: {
          type: "array",
          minItems: 1,
          maxItems: 75,
          items: { $ref: "#/$defs/candle" },
        },
        PE: {
          type: "array",
          minItems: 1,
          maxItems: 75,
          items: { $ref: "#/$defs/candle" },
        },
      },
    },
  },
  $defs: {
    contract: {
      type: "object",
      required: ["side", "symbol", "token", "expiry", "strike", "lotSize"],
      properties: {
        side: { enum: ["CE", "PE"] },
        symbol: {
          type: "string",
          description: "Original NIFTY option trading symbol.",
        },
        token: { type: "string", pattern: "^[0-9]+$" },
        expiry: { type: "string", format: "date" },
        strike: { type: "number", exclusiveMinimum: 0 },
        lotSize: { type: "integer", minimum: 1 },
      },
    },
    candle: {
      type: "object",
      required: ["start", "end", "open", "high", "low", "close"],
      properties: {
        start: {
          type: "integer",
          description:
            "UTC Unix milliseconds for candle open, corresponding to the IST session.",
        },
        end: {
          type: "integer",
          description: "start + 300000 milliseconds. Only completed candles.",
        },
        open: { type: "number", exclusiveMinimum: 0 },
        high: { type: "number", exclusiveMinimum: 0 },
        low: { type: "number", exclusiveMinimum: 0 },
        close: { type: "number", exclusiveMinimum: 0 },
      },
    },
  },
};
