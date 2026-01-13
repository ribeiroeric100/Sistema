// Compatibilidade em Windows (FS case-insensitive): alguns imports como
// `@context/AuthContext` podem resolver para este arquivo por variação de case.
// Reexportamos o que a app espera.

export { AuthProvider } from './AuthContext.jsx'
