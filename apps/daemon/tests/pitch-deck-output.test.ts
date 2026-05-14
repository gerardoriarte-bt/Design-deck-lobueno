import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Pitch deck deliverability — validates that HTML output from the
// agency-pitch-deck skill meets the structural requirements in SKILL.md.
// ---------------------------------------------------------------------------

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function validatePitchDeckHtml(html: string, expectedSlideCount: number): ValidationResult {
  const errors: string[] = [];

  const slideMatches = html.match(/<div[^>]+class="[^"]*\bslide\b[^"]*"/g) ?? [];
  if (slideMatches.length !== expectedSlideCount) {
    errors.push(
      `Expected ${expectedSlideCount} slides, found ${slideMatches.length}`,
    );
  }

  if (!/<div[^>]+class="slide dark active"/.test(html)) {
    errors.push('First slide must have class="slide dark active"');
  }

  if (/<div[^>]+class="slide accent active"/.test(html)) {
    errors.push('Last slide must have class="slide accent" without "active"');
  }
  if (!/<div[^>]+class="slide accent"/.test(html)) {
    errors.push('Last slide must have class="slide accent"');
  }

  const counterMatch = html.match(/id="cnt"[^>]*>([^<]+)<\/span>/);
  if (!counterMatch) {
    errors.push('Counter element with id="cnt" not found');
  } else {
    const counterText = counterMatch[1]!.trim();
    if (!counterText.startsWith('1/')) {
      errors.push(`Counter must start with "1/", got "${counterText}"`);
    }
    const total = parseInt(counterText.split('/')[1] ?? '', 10);
    if (total !== expectedSlideCount) {
      errors.push(
        `Counter total must be ${expectedSlideCount}, got ${total}`,
      );
    }
  }

  if (/\{\{[^}]+\}\}/.test(html)) {
    const placeholders = html.match(/\{\{[^}]+\}\}/g) ?? [];
    errors.push(`Unreplaced placeholders found: ${placeholders.join(', ')}`);
  }

  if (!/<div class="nav"/.test(html)) {
    errors.push('Navigation bar (.nav) is missing');
  }
  if (!/<button onclick="go\(-1\)"/.test(html)) {
    errors.push('Previous navigation button is missing');
  }
  if (!/<button onclick="go\(1\)"/.test(html)) {
    errors.push('Next navigation button is missing');
  }

  if (!/<script>/.test(html)) {
    errors.push('Navigation script block is missing');
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildSlide(classes: string, id: string, content = '<h2>Content</h2>') {
  return `<div class="${classes}" id="${id}">${content}</div>`;
}

function buildValidDeck(slideCount: number): string {
  const slides = [
    buildSlide('slide dark active', 's1', '<h1>Acme</h1>'),
    ...Array.from({ length: slideCount - 2 }, (_, i) =>
      buildSlide('slide', `s${i + 2}`, `<h2>Slide ${i + 2}</h2>`),
    ),
    buildSlide('slide accent', 's-last', '<h1>Hablemos</h1>'),
  ].join('\n');

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Acme</title></head>
<body>
<div class="deck" id="deck">
${slides}
</div>
<div class="nav">
  <button onclick="go(-1)">←</button>
  <span class="count" id="cnt">1/${slideCount}</span>
  <button onclick="go(1)">→</button>
</div>
<script>
const slides=document.querySelectorAll('.slide');
let i=0;
function show(n){slides[i].classList.remove('active');i=Math.max(0,Math.min(slides.length-1,n));slides[i].classList.add('active');document.getElementById('cnt').textContent=(i+1)+'/'+slides.length;}
function go(d){show(i+d);}
document.getElementById('cnt').textContent='1/'+slides.length;
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pitch-deck deliverability', () => {
  it('accepts a structurally valid 8-slide deck', () => {
    const { ok, errors } = validatePitchDeckHtml(buildValidDeck(8), 8);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });

  it('accepts a valid deck with non-default slide count (10)', () => {
    const { ok } = validatePitchDeckHtml(buildValidDeck(10), 10);
    expect(ok).toBe(true);
  });

  it('rejects when slide count does not match expected', () => {
    const html = buildValidDeck(8);
    const { ok, errors } = validatePitchDeckHtml(html, 10);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('Expected 10 slides, found 8'))).toBe(true);
  });

  it('rejects when first slide lacks "dark active"', () => {
    const html = buildValidDeck(8).replace('slide dark active', 'slide active');
    const { ok, errors } = validatePitchDeckHtml(html, 8);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('dark active'))).toBe(true);
  });

  it('rejects when last slide has "active" class', () => {
    const html = buildValidDeck(8).replace('slide accent"', 'slide accent active"');
    const { ok, errors } = validatePitchDeckHtml(html, 8);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('without "active"'))).toBe(true);
  });

  it('rejects when unreplaced placeholders remain', () => {
    const html = buildValidDeck(8).replace('<h1>Acme</h1>', '<h1>{{company_name}}</h1>');
    const { ok, errors } = validatePitchDeckHtml(html, 8);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('{{company_name}}'))).toBe(true);
  });

  it('rejects when counter total is wrong', () => {
    const html = buildValidDeck(8).replace('1/8', '1/5');
    const { ok, errors } = validatePitchDeckHtml(html, 8);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('Counter total must be 8'))).toBe(true);
  });

  it('rejects when navigation bar is missing', () => {
    const html = buildValidDeck(8).replace('<div class="nav">', '<div class="controls">');
    const { ok, errors } = validatePitchDeckHtml(html, 8);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('.nav'))).toBe(true);
  });

  it('rejects when script block is missing', () => {
    const html = buildValidDeck(8).replace(/<script>[\s\S]*?<\/script>/, '');
    const { ok, errors } = validatePitchDeckHtml(html, 8);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('script'))).toBe(true);
  });
});
