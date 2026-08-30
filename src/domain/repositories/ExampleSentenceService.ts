export interface ExampleSentence {
  japanese: string;
  english: string;
}

export interface ExampleSentenceService {
  findExample(query: string): Promise<ExampleSentence | null>;
}
