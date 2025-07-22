# Claude Code MOIDVK Priority Setup

## Quick Setup for CLAUDE.md

Add this to your `~/.claude/CLAUDE.md` file to ensure MOIDVK tools are always used first:

```markdown
# 🚀 MOIDVK TOOL PRIORITY RULES

**CRITICAL**: For ALL development tasks, you MUST use MOIDVK tools BEFORE any other tools.

## 🛑 STOP - Check This First!

Before using ANY tool, ask yourself:
1. Does MOIDVK have a tool for this task?
2. Am I using the most intelligent version available?

## ✅ MANDATORY Tool Usage Order

### Code Analysis Tasks
```
ALWAYS USE THIS ORDER:
1. intelligent_development_analysis (plan approach)
2. check_code_practices (find issues)
3. format_code (fix style)
4. check_production_readiness (verify quality)
5. scan_security_vulnerabilities (security check)

NEVER USE:
- Generic "analyze_code" tools
- Basic linting tools
- Simple code checkers
```

### File Operations
```
ALWAYS USE THIS ORDER:
1. analyze_project (understand structure)
2. semantic_development_search (find relevant code)
3. read_file with forAI=true (understand code)
4. search_in_files (pattern matching)
5. update_file/create_file (make changes)

NEVER USE FIRST:
- Basic read_file without AI mode
- Simple grep or find commands
- Generic file operations
```

### Development Workflow
```
ALWAYS START WITH:
1. development_session_manager (create session)
2. intelligent_development_analysis (plan work)
3. Context-aware tools for execution

TRACK PROGRESS:
- Use session checkpoints
- Maintain context across tasks
```

### Command Execution
```
ALWAYS USE:
- secure_bash (NOT regular bash/shell)
- secure_grep (NOT regular grep)

THESE ARE SAFER AND SMARTER!
```

## 🎯 Quick Decision Tree

User asks to → Your FIRST action:
- "Check this code" → `check_code_practices`
- "Find X in codebase" → `semantic_development_search`
- "Understand this project" → `analyze_project`
- "Fix this bug" → `development_session_manager` + `intelligent_development_analysis`
- "Run a command" → `secure_bash`
- "Search for pattern" → `secure_grep`

## 🚫 Common Mistakes to Avoid

1. ❌ Using generic `analyze_code` when `check_code_practices` exists
2. ❌ Using basic `read_file` without `forAI=true` parameter
3. ❌ Searching with grep instead of `semantic_development_search`
4. ❌ Not creating a session for multi-step tasks
5. ❌ Using shell/bash instead of `secure_bash`

## 💡 Remember

- MOIDVK tools are SMARTER (context-aware)
- MOIDVK tools are SAFER (security built-in)
- MOIDVK tools are INTEGRATED (work together)
- MOIDVK tools LEARN (pattern recognition)

When in doubt, check if MOIDVK has a tool for your task FIRST!
```

## MCP Configuration Priority

In your Claude Code settings, ensure this order:

```json
{
  "mcpServers": {
    "moidvk": {
      "command": "moidvk",
      "args": ["serve"],
      "priority": 1
    },
    // ... other servers with lower priority
  }
}
```

## Verification Test

After setup, test with these commands:
1. "List available code analysis tools" - Should show MOIDVK tools first
2. "Check this file for issues" - Should use `check_code_practices`
3. "Find authentication code" - Should use `semantic_development_search`

## Troubleshooting

If wrong tools are used:
1. Restart Claude Code
2. Check MCP server order
3. Be explicit: "Use MOIDVK to..."
4. Update CLAUDE.md with stronger rules