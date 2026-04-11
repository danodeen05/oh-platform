---
name: plan
description: Create an architecture plan for an approved idea. Launches the code-architect agent to design the implementation approach, then presents the plan for approval.
user-invocable: true
allowed-tools: Read, Grep, Glob, Agent, TodoWrite, AskUserQuestion
model: sonnet
---

# Architecture Planning Workflow

You are creating an architecture plan for an approved feature.

## Feature to Plan

$ARGUMENTS

## Your Task

### Phase 1: Context Gathering
1. Understand the approved idea/feature
2. Read relevant existing code to understand patterns
3. Identify integration points and dependencies

### Phase 2: Architecture Design
Launch the `code-architect` agent with this context to design:
1. Component structure
2. Data flow
3. API contracts (if applicable)
4. File structure and naming
5. Build sequence

### Phase 3: Plan Review
1. Review the architecture proposal
2. Identify any gaps or concerns
3. Ensure alignment with project standards

### Phase 4: Present for Approval
Present the plan clearly and ask for human approval before proceeding.

## Output Format

```
## Architecture Plan: [Feature Name]

### Overview
[2-3 sentence summary of the approach]

### Components

**[Component 1 Name]**
- Purpose: [what it does]
- Location: [file path]
- Dependencies: [what it uses]

**[Component 2 Name]**
- Purpose: [what it does]
- Location: [file path]
- Dependencies: [what it uses]

### Data Flow
[Describe how data moves through the system]

### API Contracts (if applicable)
```typescript
// Example interfaces
interface RequestType {
  field: type;
}
```

### File Structure
```
src/
├── [new-directory]/
│   ├── [file1].ts
│   └── [file2].ts
└── [modified-file].ts (modified)
```

### Build Sequence
1. [ ] [First thing to build]
2. [ ] [Second thing to build]
3. [ ] [Third thing to build]

### Testing Strategy
- [What tests will be needed]

### Risks & Mitigations
- Risk: [risk description]
  Mitigation: [how to handle]

---

**Ready to proceed with implementation?**
Please review this plan and approve to continue to the build phase.
```

## Important Notes

- Always read existing code before proposing new patterns
- Keep the plan focused and actionable
- Include specific file paths and names
- Wait for explicit approval before the build phase
