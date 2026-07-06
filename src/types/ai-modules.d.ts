/**
 * Type declarations for optional AI dependencies.
 * These modules are NOT required at runtime — they are loaded dynamically.
 * If a module is missing, the adapter throws a helpful error message.
 */

declare module "@langchain/openai" {
  export class ChatOpenAI {
    constructor(config: Record<string, unknown>);
    invoke(input: string): Promise<{ content: string }>;
  }
}

declare module "@langchain/anthropic" {
  export class ChatAnthropic {
    constructor(config: Record<string, unknown>);
    invoke(input: string): Promise<{ content: string }>;
  }
}

declare module "@langchain/google-genai" {
  export class ChatGoogleGenerativeAI {
    constructor(config: Record<string, unknown>);
    invoke(input: string): Promise<{ content: string }>;
  }
}

declare module "@langchain/langgraph" {
  export class StateGraph<S> {
    constructor(config: { channels: S });
    addNode(name: string, fn: (state: S) => Promise<Partial<S>>): this;
    addEdge(from: string, to: string): this;
    addConditionalEdges(
      from: string,
      condition: (state: S) => string,
      destinations: Record<string, string>,
    ): this;
    setEntryPoint(node: string): this;
    compile(): { invoke(state: S): Promise<S> };
  }
  export const END: unique symbol;
}

declare module "@langchain/core" {
  export class BaseMessage {
    content: string;
  }
}
