---
name: Stack Adapter Request
about: Request support for a new programming language or framework
labels: ['adapter']
---

## Language / Framework

Name the language or framework you want Devflow to support. Examples: Ruby, PHP, Java/Kotlin, C#, Swift, Elixir, Dart/Flutter, Lua, R, Scala.

## Key Tools

What tools does this language ecosystem use? List the canonical tools for each category:

| Category       | Tool           | Command Example       |
|----------------|----------------|-----------------------|
| Test runner    |                |                       |
| Linter         |                |                       |
| Type checker   |                |                       |
| Formatter      |                |                       |
| Package manager|                |                       |
| Build tool     |                |                       |

## Dangerous Patterns to Detect

What language-specific patterns should Devflow flag? Examples:

- Ruby: `eval()`, `send()`, `class_eval`, unsafe YAML loading
- PHP: `eval()`, `exec()`, `unserialize()`, `extract()`
- Java: `Runtime.exec()`, `Method.invoke()`, insecure deserialization
- C#: `dynamic`, `Reflection.Emit`, insecure `DangerousAcceptAnyServerCertificateValidator`

## Example Repository

(Optional) Link to a public repository using this language that would benefit from Devflow governance. This helps us understand real-world usage patterns.
