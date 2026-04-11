---
name: review
description: Comprehensive multi-agent code review workflow. Launches parallel reviews by 6 specialists (Security, Product, Quality, QA, DevOps, Documentation) then synthesizes findings into actionable feedback.
user-invocable: true
allowed-tools: Read, Grep, Glob, Agent, TodoWrite, AskUserQuestion
model: sonnet
---

# Comprehensive Code Review Workflow

You are conducting a thorough code review with multiple specialist agents working in parallel.

## Code to Review

$ARGUMENTS

## Your Task

### Phase 1: Identify Changes
1. Find the recent changes to review (git diff or specified files)
2. Understand the scope of the changes
3. Gather context about what was built
4. Identify which review types are relevant (skip irrelevant ones)

### Phase 2: Parallel Reviews (Launch All Relevant Agents)

Launch these review agents **in parallel** for maximum efficiency:

#### Core Reviews (Always Run)

1. **Security Review** - Launch `ciso-auditor`:
   - Security vulnerabilities (OWASP Top 10)
   - Input validation and sanitization
   - Authentication/authorization issues
   - Data handling and encryption
   - Dependency vulnerabilities

2. **Code Quality Review** - Launch `code-reviewer` or `engineer`:
   - Code quality and maintainability
   - DRY violations and duplication
   - Complexity and readability
   - Error handling
   - Naming conventions and structure

3. **Product Review** - Launch `cpo-validator`:
   - Feature matches requirements
   - User experience quality
   - Edge cases handled
   - Acceptance criteria met

#### Extended Reviews (Run When Applicable)

4. **QA/Testing Review** - Launch `qa-engineer`:
   - Test coverage assessment
   - Missing test cases identified
   - Edge cases and boundary conditions
   - Test quality and reliability
   - Integration test needs

5. **DevOps Review** - Launch `devops-engineer`:
   - Deployment readiness
   - Configuration and environment handling
   - Performance implications
   - Logging and monitoring
   - Infrastructure impact

6. **Documentation Review** - Launch `tech-writer`:
   - README updates needed
   - API documentation accuracy
   - Code comments and JSDoc
   - Changelog entries
   - Breaking change documentation

### Phase 3: Synthesize Findings
1. Collect all review feedback from agents
2. Deduplicate overlapping findings
3. Categorize by severity (Critical, High, Medium, Low)
4. Identify patterns and systemic issues
5. Prioritize: blockers vs. should-fix vs. nice-to-have

### Phase 4: Present Consolidated Results
Present a unified review with clear actions and decisions.

## Output Format

```
## Code Review Results: [Feature/PR Name]

### Overall Status: APPROVED / NEEDS_CHANGES / BLOCKED

### Summary
[2-3 sentences summarizing the review outcome and key findings]

### Reviewers
| Agent | Status | Key Finding |
|-------|--------|-------------|
| CISO (Security) | ✅/⚠️/❌ | [One-line summary] |
| Engineer (Quality) | ✅/⚠️/❌ | [One-line summary] |
| CPO (Product) | ✅/⚠️/❌ | [One-line summary] |
| QA (Testing) | ✅/⚠️/❌ | [One-line summary] |
| DevOps (Deploy) | ✅/⚠️/❌ | [One-line summary] |
| Tech Writer (Docs) | ✅/⚠️/❌ | [One-line summary] |

---

## Issues by Severity

### 🚨 Critical (Blocks Merge)
| # | Issue | Location | Reviewer | Fix |
|---|-------|----------|----------|-----|
| 1 | [Description] | `file:line` | [Agent] | [How to fix] |

### ⚠️ High Priority (Should Fix Before Merge)
| # | Issue | Location | Reviewer | Fix |
|---|-------|----------|----------|-----|
| 1 | [Description] | `file:line` | [Agent] | [How to fix] |

### 📋 Medium Priority (Fix Soon)
| # | Issue | Location | Reviewer |
|---|-------|----------|----------|
| 1 | [Description] | `file:line` | [Agent] |

### 💡 Suggestions (Nice to Have)
- [Suggestion 1] - [Reviewer]
- [Suggestion 2] - [Reviewer]

---

## Detailed Assessments

### 🔒 Security Assessment (CISO)
- **Risk Level**: None / Low / Medium / High / Critical
- **Vulnerabilities Found**: [count]
- **Auth/AuthZ**: [Pass/Concerns/Fail]
- **Data Handling**: [Pass/Concerns/Fail]
- **Dependencies**: [Pass/Concerns/Fail]
- **Notes**: [Details]

### 🔧 Code Quality Assessment (Engineer)
- **Maintainability**: Good / Fair / Poor
- **Complexity**: Acceptable / High / Too High
- **Error Handling**: Complete / Partial / Missing
- **Patterns**: Follows / Mostly Follows / Deviates
- **Notes**: [Details]

### 👤 Product Assessment (CPO)
- **Requirements Met**: Yes / Partially / No
- **UX Quality**: Good / Fair / Poor
- **Edge Cases**: Handled / Some Missing / Many Missing
- **Notes**: [Details]

### 🧪 Testing Assessment (QA)
- **Test Coverage**: Adequate / Needs Work / Insufficient
- **Unit Tests**: Present / Partial / Missing
- **Integration Tests**: Present / Partial / Missing / N/A
- **Edge Cases Tested**: Yes / Partially / No
- **Missing Tests**: [List specific tests needed]
- **Notes**: [Details]

### 🚀 DevOps Assessment (DevOps)
- **Deploy Ready**: Yes / Needs Work / No
- **Config Handling**: Good / Concerns / Issues
- **Performance Impact**: None / Minor / Significant
- **Monitoring**: Adequate / Needs Work / Missing
- **Notes**: [Details]

### 📚 Documentation Assessment (Tech Writer)
- **README**: Current / Needs Update / Missing
- **API Docs**: Current / Needs Update / Missing / N/A
- **Code Comments**: Adequate / Needs Work / Missing
- **Changelog**: Updated / Needs Entry / N/A
- **Notes**: [Details]

---

## Action Items

### Before Merge (Required)
- [ ] [Action 1] - Owner: [who]
- [ ] [Action 2] - Owner: [who]

### Before Release (Recommended)
- [ ] [Action 1]
- [ ] [Action 2]

### Tech Debt (Track for Later)
- [ ] [Item 1]
- [ ] [Item 2]

---

## Decision

**Final Verdict: APPROVED / NEEDS_CHANGES / BLOCKED**

**Rationale**: [Why this decision was made]

**Next Steps**:
1. [What should happen next]
2. [Follow-up actions]

[If NEEDS_CHANGES]: The following must be addressed before re-review:
- [Specific item 1]
- [Specific item 2]

[If BLOCKED]: This cannot proceed because:
- [Blocking reason]
```

## Review Selection Guide

Not all reviews are needed for every change. Use this guide:

| Change Type | Security | Quality | Product | QA | DevOps | Docs |
|-------------|----------|---------|---------|-----|--------|------|
| New feature | ✅ | ✅ | ��� | ✅ | ⚡ | ✅ |
| Bug fix | ✅ | ✅ | ⚡ | ✅ | ❌ | ⚡ |
| Refactor | ⚡ | ✅ | ❌ | ✅ | ❌ | ⚡ |
| Config change | ✅ | ⚡ | ❌ | ⚡ | ✅ | ✅ |
| Dependency update | ✅ | ❌ | ❌ | ✅ | ✅ | ⚡ |
| Docs only | ❌ | ❌ | ⚡ | ❌ | ❌ | ✅ |
| Hotfix | ✅ | ✅ | ⚡ | ✅ | ✅ | ⚡ |

✅ = Always | ⚡ = If relevant | ❌ = Skip

## Severity Guidelines

**🚨 Critical (Blocks merge):**
- Security vulnerabilities
- Data loss or corruption risks
- Breaking changes without migration
- Missing critical functionality
- Failed tests

**⚠️ High (Should fix before merge):**
- Significant bugs
- Performance regressions
- Missing error handling
- Inadequate test coverage for critical paths
- Security warnings

**📋 Medium (Fix soon):**
- Code quality issues
- Minor bugs
- Missing tests for edge cases
- Documentation gaps
- Non-critical DevOps concerns

**💡 Low (Nice to have):**
- Style preferences
- Minor optimizations
- Future improvement suggestions
- Nice-to-have documentation

## Important Notes

- Launch agents in parallel for efficiency
- Skip irrelevant review types (e.g., no DevOps review for docs-only changes)
- Be thorough but fair - acknowledge good work
- Provide specific, actionable feedback with file:line references
- Clearly distinguish blockers from suggestions
- If agents disagree, note the conflict and recommend resolution
