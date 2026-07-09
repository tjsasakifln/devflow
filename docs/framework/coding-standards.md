# Coding Standards

> EPIC-TD-001 Story 2.4 — Development Framework Documentation

## TypeScript Configuration

- **Target:** ESNext
- **Module:** NodeNext (ESM)
- **Strict mode:** Enabled (`strict: true`)
- **No unused locals/params:** `noUnusedLocals: true`, `noUnusedParameters: true`

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `feature-complete.ts` |
| Directories | kebab-case | `kernel/utils/` |
| Functions | camelCase | `detectState()` |
| Types/Interfaces | PascalCase | `StackProfile` |
| Constants | UPPER_SNAKE_CASE | `SEVERITY_ICONS` |
| Exported API | camelCase | `export async function discoverCommand()` |

## Import Patterns

- Always use `.js` extension in imports (NodeNext ESM convention)
- prefer named imports over default imports
- Group imports: node builtins → external packages → internal modules
- No circular imports between kernel and adapters layers

## Error Handling

- Use explicit `try/catch` with typed error messages
- Never swallow errors silently
- Provide remediation hints in error messages
- Use `logger.error()` / `logError()` for error output

## Testing

- Framework: Vitest
- Test files: `test/**/*.test.ts`
- Prefer unit tests over integration tests
- Mock external dependencies (fs, child_process, AI providers)
- Characterization tests before refactoring

## Linting

- ESLint with `@typescript-eslint/recommended`
- `no-console: warn` (use logger instead)
- `prefer-const: error`
