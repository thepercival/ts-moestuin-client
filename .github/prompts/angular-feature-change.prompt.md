---
name: "Angular Feature Change"
description: "Implement a focused Angular feature change with safe verification"
argument-hint: "Describe the frontend change"
agent: "agent"
model: "GPT-5 (copilot)"
---
Implement this frontend change: $ARGUMENTS

Requirements:
1. Identify impacted components/services first.
2. Keep diffs minimal and preserve current architecture patterns.
3. Do not add or modify SCSS unless explicitly requested.
4. Add or update tests where behavior changes are non-trivial.
5. Provide commands to verify the result and summarize changed files.
