export interface VisionExtractionSpec {
  // Names the JSON schema (OpenAI) / the tool (Anthropic).
  name: string;
  prompt: string;
  // A provider-neutral JSON Schema for the expected output object, authored to
  // OpenAI strict-mode rules: every property listed in `required`,
  // `additionalProperties: false`, nullables written as `type: ['x', 'null']`.
  // Each transport adapts this to its own dialect.
  jsonSchema: Record<string, unknown>;
}

export interface VisionModel {
  // Sends the image + spec to the active model and returns its structured
  // output, already JSON-parsed. Throws a domain ScanError on an API failure,
  // or a ScanFailedError when the response can't be understood.
  extract(imageBase64: string, spec: VisionExtractionSpec): Promise<unknown>;
}
