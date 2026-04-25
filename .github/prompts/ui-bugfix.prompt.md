---
name: "UI Bugfix"
description: "Fix an Angular UI bug with minimal diff and verification steps"
argument-hint: "Describe the UI bug and expected behavior"
agent: "agent"
model: "GPT-5 (copilot)"
---
Fix this frontend issue: $ARGUMENTS

Requirements:
1. Identify root cause before code changes.
2. Keep diffs minimal and preserve component/service patterns.
3. Do not add or modify SCSS unless explicitly requested.
4. Add or update tests when behavior changes are non-trivial.
5. Report verification command(s) and summarize changed files.
