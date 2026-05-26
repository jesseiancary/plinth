# Code Style Rules

## TypeScript

- **Strict mode is always on.** No `any` types allowed. Use `unknown` + type guards if an escape hatch is needed.
- **Use `const` only** — never `let` unless reassignment is genuinely required and unavoidable.
- **Named exports only** — no default exports except React components and route handlers.
- **No barrel files** (`index.ts` re-exports) — import directly from source files.

## Type Safety

- **Infer types from Zod schemas** using `z.infer<typeof Schema>` — do not duplicate types.
- **No type assertions** (`as` keyword) unless absolutely necessary and well-documented.
- **Use type guards** for narrowing unknown types.

## Code Organization

- **Colocate tests** with source files: `src/routes/auth.test.ts` next to `src/routes/auth.ts`
- **One responsibility per file** — keep files focused and modules small.
- **Alphabetize imports** — third-party, then internal, then relative.

## Async Patterns

- **Use async/await only** — no `.then()` chains.
- **Always use try/catch** in Express route handlers.
- **Never use callbacks** — prefer promises.

## Naming Conventions

- **camelCase** for variables, functions, and methods.
- **PascalCase** for types, interfaces, classes, and React components.
- **SCREAMING_SNAKE_CASE** for constants and environment variables.
- **Descriptive names** — avoid abbreviations except universally known ones (e.g., `id`, `url`).

## Comments

- **Code should be self-documenting** — prefer clear naming over comments.
- **Use comments sparingly** — only when the "why" is not obvious from the code.
- **JSDoc for public APIs** — document all exported functions and types.

## Formatting

- **2 spaces** for indentation.
- **Single quotes** for strings (except when double quotes avoid escaping).
- **Trailing commas** in multi-line arrays and objects.
- **No semicolons** unless required for disambiguation.
