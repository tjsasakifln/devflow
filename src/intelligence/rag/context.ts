/**
 * RAG Context Retrieval
 *
 * ContextPack bundles all relevant context for a feature review.
 * Three retrieval strategies: lexical, dependency graph, embeddings.
 */

export interface ContextPack {
  files: string[];
  symbols: string[];
  contracts: string[];
  risks: string[];
  similarPastFeatures: string[];
  relatedTests: string[];
  affectedModules: string[];
  confidence: number; // 0-1
}

export function emptyContextPack(): ContextPack {
  return {
    files: [],
    symbols: [],
    contracts: [],
    risks: [],
    similarPastFeatures: [],
    relatedTests: [],
    affectedModules: [],
    confidence: 0,
  };
}

/**
 * Lexical context: direct file path and symbol name matching.
 * Does not require AI or embeddings — works offline.
 */
export async function retrieveLexicalContext(
  _featureId: string,
  _rootPath: string,
): Promise<ContextPack> {
  // Stub: return empty pack. Full implementation in Phase 7.
  return emptyContextPack();
}
