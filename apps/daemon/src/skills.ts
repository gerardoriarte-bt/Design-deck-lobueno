// @ts-nocheck
// Skill registry. Scans <projectRoot>/skills/* for SKILL.md files, parses
// front-matter, returns listing. No watching in this MVP — re-scans on every
// GET /api/skills, which is fine for dozens of skills.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

export async function listSkills(skillsRoot) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(skillsRoot, entry.name);
    const skillPath = path.join(dir, "SKILL.md");
    try {
      const stats = await stat(skillPath);
      if (!stats.isFile()) continue;
      const raw = await readFile(skillPath, "utf8");
      const { data, body } = parseFrontmatter(raw);
      const hasAttachments = await dirHasAttachments(dir);
      const mode = data.od?.mode || inferMode(body, data.description);
      out.push({
        id: data.name || entry.name,
        name: data.name || entry.name,
        description: data.description || "",
        triggers: Array.isArray(data.triggers) ? data.triggers : [],
        mode,
        platform: normalizePlatform(
          data.od?.platform,
          mode,
          body,
          data.description
        ),
        scenario: normalizeScenario(data.od?.scenario, body, data.description),
        previewType: data.od?.preview?.type || "html",
        designSystemRequired: data.od?.design_system?.requires ?? true,
        defaultFor: normalizeDefaultFor(data.od?.default_for),
        upstream:
          typeof data.od?.upstream === "string" ? data.od.upstream : null,
        featured: normalizeFeatured(data.od?.featured),
        // Optional metadata hints used by 'Use this prompt' fast-create so
        // the resulting project mirrors the shipped example.html. Each hint
        // is only consumed when its kind matches the skill mode; missing
        // hints fall back to the same defaults the new-project form uses.
        fidelity: normalizeFidelity(data.od?.fidelity),
        speakerNotes: normalizeBoolHint(data.od?.speaker_notes),
        animations: normalizeBoolHint(data.od?.animations),
        examplePrompt: derivePrompt(data),
        inputs: normalizeInputs(data.od?.inputs),
        parameters: normalizeParameters(data.od?.parameters),
        designSystemSections: normalizeStringArray(data.od?.design_system?.sections),
        body: hasAttachments ? withSkillRootPreamble(body, dir) : body,
        dir,
      });
    } catch {
      // Skip unreadable entries — this is discovery, not validation.
    }
  }
  return out;
}

// Skills that ship side files (e.g. `assets/template.html`, `references/*.md`)
// need the agent to know where the skill lives on disk — relative paths in the
// SKILL.md body resolve against the agent's CWD, which is the daemon root, not
// the skill folder. We prepend a short preamble so any capable code agent can
// open those files via absolute paths.
function withSkillRootPreamble(body, dir) {
  const preamble = [
    "> **Skill root (absolute):** `" + dir + "`",
    ">",
    "> This skill ships side files alongside `SKILL.md`. When the workflow",
    "> below references relative paths such as `assets/template.html` or",
    "> `references/layouts.md`, resolve them against the skill root above and",
    "> open them via their full absolute path.",
    "",
    "",
  ].join("\n");
  return preamble + body;
}

async function dirHasAttachments(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some(
      (e) =>
        e.name !== "SKILL.md" &&
        (e.isDirectory() || /\.(md|html|css|js|json|txt)$/i.test(e.name))
    );
  } catch {
    return false;
  }
}

function normalizeDefaultFor(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

// Optional `od.fidelity` hint for prototype skills. Only 'wireframe' and
// 'high-fidelity' are meaningful — anything else collapses to null so the
// caller falls back to the form default ('high-fidelity').
function normalizeFidelity(value) {
  if (value === "wireframe" || value === "high-fidelity") return value;
  return null;
}

// Coerce truthy / falsy strings ("true", "yes", "false", "no") and booleans
// to a real boolean. Returns null for anything we can't interpret so the
// caller knows to fall back to the form default.
function normalizeBoolHint(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "yes" || v === "1") return true;
    if (v === "false" || v === "no" || v === "0") return false;
  }
  return null;
}

// Coerce `od.featured` into a numeric priority. Lower numbers float to the
// top of the Examples gallery; `true` is treated as priority 1; anything
// missing/unrecognised becomes null so non-featured skills keep their
// natural alphabetical order.
function normalizeFeatured(value) {
  if (value === true) return 1;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Prefer an explicitly authored `od.example_prompt`. Fall back to the
// skill description's first sentence — it's already written in actionable
// language ("Admin / analytics dashboard in a single HTML file…") so it
// serves as a passable starter prompt.
function derivePrompt(data) {
  const explicit = data.od?.example_prompt;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const desc =
    typeof data.description === "string" ? data.description.trim() : "";
  if (!desc) return "";
  const collapsed = desc.replace(/\s+/g, " ").trim();
  const firstSentence = collapsed.match(/^.+?[.!?。！？](?:\s|$)/)?.[0]?.trim();
  return (firstSentence || collapsed).slice(0, 320);
}

function inferMode(body, description) {
  const hay = `${description ?? ""}\n${body ?? ""}`.toLowerCase();
  if (/\bppt|deck|slide|presentation|幻灯|投影/.test(hay)) return "deck";
  if (/\bdesign[- ]system|\bdesign\.md|\bdesign tokens/.test(hay))
    return "design-system";
  if (/\btemplate\b/.test(hay)) return "template";
  return "prototype";
}

// Validate platform tag — only desktop / mobile are meaningful for the
// Examples gallery. Falls back to autodetecting "mobile" from descriptions
// so legacy skills sort under the right pill without authoring changes.
function normalizePlatform(value, mode, body, description) {
  if (value === "desktop" || value === "mobile") return value;
  if (mode !== "prototype") return null;
  const hay = `${description ?? ""}\n${body ?? ""}`.toLowerCase();
  if (/mobile|phone|ios|android|手机|移动端/.test(hay)) return "mobile";
  return "desktop";
}

// Normalise a scenario tag to a small fixed vocabulary so the filter pills
// stay tidy. Unknown values pass through verbatim so authors can experiment;
// missing values default to "general".
const KNOWN_SCENARIOS = new Set([
  "general",
  "engineering",
  "product",
  "design",
  "marketing",
  "sales",
  "finance",
  "hr",
  "operations",
  "support",
  "legal",
  "education",
  "personal",
]);
function normalizeScenario(value, body, description) {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v) return v;
  }
  const hay = `${description ?? ""}\n${body ?? ""}`.toLowerCase();
  if (/finance|invoice|expense|budget|p&l|revenue/.test(hay)) return "finance";
  if (/\bhr\b|onboarding|payroll|employee|人事/.test(hay)) return "hr";
  if (/marketing|campaign|brand|landing/.test(hay)) return "marketing";
  if (/runbook|incident|deploy|engineering|sre|api/.test(hay))
    return "engineering";
  if (/spec|prd|roadmap|product manager|product team/.test(hay))
    return "product";
  if (/design system|moodboard|mockup|ui kit/.test(hay)) return "design";
  if (/sales|quote|proposal|lead/.test(hay)) return "sales";
  if (/operations|ops|logistics|inventory/.test(hay)) return "operations";
  return "general";
}
// Surface the vocabulary so callers (frontend filter UI) could mirror it
// later if they want to. Not exported today, kept here for documentation.
void KNOWN_SCENARIOS;

// ---------- od.inputs / od.parameters normalizers ----------

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return null;
  const result = value.filter((v) => typeof v === 'string' && v.trim());
  return result.length > 0 ? result : null;
}

const VALID_INPUT_TYPES = new Set(['string', 'integer', 'enum', 'boolean']);
const VALID_PARAM_TYPES = new Set(['hue', 'spacing', 'font-scale', 'opacity']);

function normalizeInputs(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const type = typeof item.type === 'string' && VALID_INPUT_TYPES.has(item.type)
      ? item.type
      : 'string';
    const out = { name: String(item.name ?? ''), type };
    if (!out.name) return [];
    if (item.required === true) out.required = true;
    if (item.default !== undefined && item.default !== null) out.default = item.default;
    if (type === 'integer') {
      if (typeof item.min === 'number') out.min = item.min;
      if (typeof item.max === 'number') out.max = item.max;
    }
    if (type === 'enum' && Array.isArray(item.values)) {
      out.values = item.values.map(String);
    }
    return [out];
  });
}

function normalizeParameters(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const type = typeof item.type === 'string' && VALID_PARAM_TYPES.has(item.type)
      ? item.type
      : null;
    if (!type) return [];
    const name = String(item.name ?? '');
    if (!name) return [];
    const def = typeof item.default === 'number' ? item.default : 0;
    const range = Array.isArray(item.range) && item.range.length === 2
      ? [Number(item.range[0]), Number(item.range[1])]
      : [0, 100];
    return [{ name, type, default: def, range }];
  });
}
