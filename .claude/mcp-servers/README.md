# MCP Servers Directory

This directory is reserved for **Model Context Protocol (MCP) server configurations** — a future extensibility point for Claude Code.

## What is MCP?

The Model Context Protocol allows Claude to connect to external tools, data sources, and services through standardized server implementations.

**Examples of MCP servers:**

- **Database MCP** — Direct SQL query execution and schema inspection
- **GitHub MCP** — Issue creation, PR review, repository analysis
- **Filesystem MCP** — Enhanced file operations beyond built-in tools
- **API MCP** — Integration with external REST/GraphQL APIs
- **Documentation MCP** — Search and reference external documentation

## Current Status

**MCP support is not yet configured for this project.** This directory is a placeholder for future integration.

## When to Add MCP Servers

Consider adding MCP servers when:

- ✅ You need frequent access to external APIs (e.g., Stripe, Sentry, Analytics)
- ✅ You want Claude to interact with project-specific tooling (e.g., custom CLI, internal services)
- ✅ You need real-time data that changes frequently (e.g., production metrics, database state)
- ✅ You want to extend Claude's capabilities beyond built-in tools

**Don't add MCP servers for:**

- ❌ One-off API calls (use WebFetch or curl instead)
- ❌ Data that can be committed to the repo (use skills or rules instead)
- ❌ Operations that built-in tools already handle well (Read, Write, Bash, etc.)

## Directory Structure (When Configured)

```
.claude/mcp-servers/
├── README.md                    # This file
├── database.json                # PostgreSQL/Prisma database MCP config
├── github.json                  # GitHub API MCP config
├── stripe.json                  # Stripe API MCP config (Phase 9+)
└── analytics.json               # Analytics platform MCP config
```

Each JSON file configures an MCP server with:

```json
{
  "name": "database",
  "description": "Direct PostgreSQL access via Prisma",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres"],
  "env": {
    "DATABASE_URL": "postgresql://user:pass@localhost:5432/plinth_dev"
  }
}
```

## Configuration Steps (Future)

When ready to add MCP servers:

1. **Install MCP server package** (varies by server type)

   ```bash
   npm install -g @modelcontextprotocol/server-name
   ```

2. **Create configuration file** in this directory

   ```json
   {
     "name": "server-name",
     "description": "What this server provides",
     "command": "command-to-start-server",
     "args": ["--arg1", "--arg2"],
     "env": {
       "API_KEY": "from-environment-variable"
     }
   }
   ```

3. **Test the server** manually before adding to Claude Code

   ```bash
   command-to-start-server --arg1 --arg2
   ```

4. **Reference in settings** (if required by Claude Code)
   - Update `.claude/settings.json` with MCP server permissions
   - Grant/deny specific MCP tools as needed

5. **Document usage** in relevant commands/skills
   - Add examples of when to use the MCP server
   - Document available MCP tools and their parameters

## Security Considerations

**IMPORTANT:** MCP servers run with the same permissions as Claude Code.

- 🔴 **Never commit API keys or secrets** to MCP server configs — use environment variables
- 🔴 **Review MCP server source code** before installation — malicious servers can access your system
- 🔴 **Use least-privilege credentials** — MCP servers should only have read access unless write is required
- 🟡 **Monitor MCP server usage** — log what data is accessed and when
- 🟡 **Limit scope** — only install MCP servers you actively need

## Example Use Cases (Phase 9+)

### Stripe MCP (Subscription Billing)

```json
{
  "name": "stripe",
  "description": "Stripe API for subscription and invoice management",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-stripe"],
  "env": {
    "STRIPE_API_KEY": "${STRIPE_SECRET_KEY}"
  }
}
```

**Use when:**

- Debugging subscription state issues
- Analyzing failed payment patterns
- Generating billing reports

### Database MCP (Production Debugging)

```json
{
  "name": "database-read-only",
  "description": "Read-only PostgreSQL access for production debugging",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "--readonly"],
  "env": {
    "DATABASE_URL": "${PRODUCTION_DATABASE_URL_READONLY}"
  }
}
```

**Use when:**

- Investigating data inconsistencies
- Writing complex analytical queries
- Debugging tenant isolation issues

### GitHub MCP (PR Workflow)

```json
{
  "name": "github",
  "description": "GitHub API for issue tracking and PR management",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

**Use when:**

- Creating issues from error patterns
- Analyzing PR review feedback
- Automating release notes generation

## See Also

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Claude Code MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- `.claude/settings.json` — MCP server permissions configuration
- `CLAUDE.md` — Main project instructions

---

**Last Updated:** 2026-06-11
**MCP Servers Configured:** 0 (placeholder directory)
**Planned:** Stripe (Phase 9), Database (production debugging), GitHub (PR automation)
