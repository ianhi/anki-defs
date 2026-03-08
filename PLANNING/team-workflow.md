# Team Workflow: Coordinator Playbook

This doc is for the **coordinator** (the main Claude session managing agents), not for
individual agents/team members. Agents only need the brief rules in root CLAUDE.md.

## Role

When the user asks you to manage a team or launch agents, you are a **coordinator, not an
implementer**:

- **Delegate** all implementation work (code, docs, config) to spawned agents.
- **Keep** your focus on: task breakdown, priority decisions, cross-cutting concerns,
  reviewing agent output, merging branches, and communicating status to the user.
- **Don't** write code yourself unless the user explicitly asks you to make a change directly
  or it's a trivial meta-task (e.g., updating CLAUDE.md itself).

When not in team mode, implement directly as usual.

## Git Worktree Discipline

**Hard rule**: Always launch agents with `isolation: "worktree"` so they work on isolated
branches. Never let multiple agents commit directly to main.

### Coordinator workflow

1. **Launch** agents with `isolation: "worktree"`. Each gets its own branch and working copy.
2. **Scope** each agent to non-overlapping directories when possible (e.g., one agent owns
   `client/`, another owns `ankiconnect-server/`). State the scope in the agent prompt.
3. **Merge** completed agent branches one at a time on main:
   ```
   git merge <agent-branch> --no-ff
   ```
   If two agents touched overlapping files, merge the first, then rebase the second
   before merging.
4. **Rebase stale agents**: If main has advanced while an agent is working, the agent's
   branch may need rebasing before merge. The coordinator handles this, not the agent.
5. **Cross-cutting changes** (shared/types.ts, CLAUDE.md, root PLANNING/) should be done
   by the coordinator directly on main, not by agents, to avoid conflicts.

### Scoping guidelines

| Agent scope   | Owns                                          | Must not touch                                   |
| ------------- | --------------------------------------------- | ------------------------------------------------ |
| Frontend      | `client/`, `client/PLANNING/`, `client/DOCS/` | `ankiconnect-server/`, `android/`, `anki-addon/` |
| Backend (web) | `ankiconnect-server/`, its PLANNING/DOCS      | `client/`, `android/`, `anki-addon/`             |
| Android       | `android/`, its PLANNING/DOCS                 | `client/`, `ankiconnect-server/`, `anki-addon/`  |
| Anki add-on   | `anki-addon/`, its PLANNING/DOCS              | `client/`, `ankiconnect-server/`, `android/`     |
| Docs          | `docs/`                                       | Everything else                                  |
| Shared types  | `shared/`                                     | Backend internals                                |

If an agent needs to change files outside its scope (e.g., `shared/types.ts`), it should
note the needed change in its output and let the coordinator handle it.

## Agent Prompt Template

Include these in every agent prompt:

```
You are working on [TASK DESCRIPTION].

**First**: Read the root CLAUDE.md and the CLAUDE.md in each directory you own.
Follow all rules there -- they are not optional.

**Scope**: You own [DIRECTORIES]. Do not modify files outside these directories.
If you need changes in other directories (e.g., shared/types.ts), describe the
needed change in your commit message or output -- the coordinator will handle it.

**Commits**: Commit your work with descriptive messages. Every commit that changes
code MUST also update the relevant PLANNING/ or DOCS/ file in your scope. Run
`npm run check` (or the equivalent for your scope) before committing.

**Current state**: [BRIEF CONTEXT -- recent relevant commits, any dependencies]
```

## Lessons Learned

- Agents on main branch without worktrees cause overlapping changes and merge conflicts.
- Agents tend to skip PLANNING/DOCS updates unless explicitly told to in their prompt.
- Agents don't read CLAUDE.md unless prompted to -- always include "Read CLAUDE.md first"
  in the agent prompt so they pick up commit discipline, doc update rules, and code quality
  requirements on their own.
- Multiple agents touching the same files (e.g., eslint.config.js, package.json) leads
  to conflicts -- scope agents tightly and handle shared files from the coordinator.
- Long-running agents may fall behind main -- check if rebase is needed before merging.
