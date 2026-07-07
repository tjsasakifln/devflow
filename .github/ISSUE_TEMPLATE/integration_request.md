---
name: Integration Request
about: Request Devflow integration with a tool, platform, or AI coding service
labels: ['integration']
---

## What Tool / Platform

Name the tool, platform, or service you want Devflow to integrate with.

- AI coding tool (e.g., Claude Code, Cursor, Copilot, Codeium, Continue)
- CI/CD platform (e.g., GitLab CI, Jenkins, CircleCI, Buildkite)
- Code hosting platform (e.g., GitLab, Bitbucket, Gitea)
- Communication tool (e.g., Slack, Discord, Teams)
- Project management (e.g., Jira, Linear, Asana)

## How Should It Work

Describe the desired integration behavior. For example:

- "Post a risk report as a comment on every PR"
- "Block merge if Devflow verdict is FAIL"
- "Show a badge in the repo README with current governance status"
- "Send a notification to Slack when a PR has HIGH findings"

## Expected Output

What format should the output take?

- Markdown comment
- Custom webhook payload
- Status check (pass/fail)
- Inline CI annotations
- Other (please describe)

## Example Use Case

Describe a real scenario where this integration would be valuable. Include:

- Your team size and workflow
- Which AI tools your team uses
- Why existing integrations don't cover this need
