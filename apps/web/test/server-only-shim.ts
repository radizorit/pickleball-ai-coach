// Empty shim so Vitest can import modules that begin with `import "server-only";`
// without pulling in the real package (which throws on the client / outside Next).
export {};
