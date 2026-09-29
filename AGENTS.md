# SecondBrain workspace

The project guidance lives in `.agents/skills/` and is versioned with the code. Each skill follows the portable Agent Skills `SKILL.md` format. `.claude/skills/` contains relative links to these same folders so Claude Code reads the same content:

- `secondbrain-app`: private diary UI, components, state, and user flows.
- `secondbrain-data-auth`: Supabase schema, RLS, Auth, ownership, and private routes.
- `secondbrain-landing`: public site, SEO, pricing copy, and legal pages.
- `secondbrain-operations`: integrations, environment variables, and release checks.

Read the relevant `SKILL.md` and its references before changing that area. When a code change alters project structure, components, data contracts, integrations, or release steps, update the corresponding skill or reference in the same change. Edit only the canonical files in `.agents/skills/`; do not create separate instructions for each agent. Keep these files focused on current architecture and durable practices.

Never keep Finder/iCloud conflict copies such as `page 2.tsx`. Compare them with the canonical file, preserve any unique content, and remove the duplicate. Each workspace's `prebuild` runs its duplicate-source guard. Run both workspace builds before a release. Do not commit generated output, credentials, or `.env.local`.
