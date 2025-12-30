#!/usr/bin/env tsx

import { readdirSync, readFileSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsListFile = fileURLToPath(import.meta.url);
const docsListDir = dirname(docsListFile);
const ROOT_DIR = join(docsListDir, '..');
const DOCS_DIR = join(ROOT_DIR, 'docs');

interface ValidationError {
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning';
}

const errors: ValidationError[] = [];
const warnings: ValidationError[] = [];

function error(file: string, message: string, line?: number) {
  errors.push({ file, message, line, severity: 'error' });
}

function warning(file: string, message: string, line?: number) {
  warnings.push({ file, message, line, severity: 'warning' });
}

function walkMarkdownFiles(dir: string, base: string = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(relative(base, fullPath));
    }
  }
  return files.sort();
}

function extractFrontMatter(content: string): { frontMatter: string; body: string; error?: string } {
  if (!content.startsWith('---')) {
    return { frontMatter: '', body: content, error: 'missing front matter delimiter' };
  }
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { frontMatter: '', body: content, error: 'unterminated front matter' };
  }
  return {
    frontMatter: content.slice(3, endIndex).trim(),
    body: content.slice(endIndex + 5),
  };
}

function validateFrontMatter(file: string, frontMatter: string) {
  const lines = frontMatter.split('\n');
  const hasSummary = lines.some(l => l.trim().startsWith('summary:'));
  const hasReadWhen = lines.some(l => l.trim().startsWith('read_when:'));

  if (!hasSummary) {
    error(file, 'Missing required "summary" key in front matter');
  }

  // Check for common front matter issues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('summary:')) {
      const value = trimmed.slice('summary:'.length).trim();
      if (!value || value === '""' || value === "''") {
        error(file, 'summary is empty', i + 1);
      }
    }

    if (trimmed.startsWith('read_when:')) {
      const inline = trimmed.slice('read_when:'.length).trim();
      if (inline && !inline.startsWith('[')) {
        warning(file, 'read_when should use array format [- item1, - item2] or inline [item1, item2]', i + 1);
      }
    }
  }
}

function extractLinks(content: string): { text: string; url: string; line: number }[] {
  const links: { text: string; url: string; line: number }[] = [];
  const lines = content.split('\n');
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  lines.forEach((line, idx) => {
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        line: idx + 1,
      });
    }
  });

  return links;
}

function validateLinks(file: string, content: string, filePath: string) {
  const links = extractLinks(content);

  for (const link of links) {
    // Skip external links and anchors
    if (link.url.startsWith('http://') || link.url.startsWith('https://') || link.url.startsWith('#')) {
      continue;
    }

    // Resolve relative paths
    const targetPath = resolve(dirname(filePath), link.url);
    const targetRelative = relative(ROOT_DIR, targetPath);

    // Check if file exists
    try {
      statSync(targetPath);
    } catch {
      error(file, `Broken link: [${link.text}](${link.url}) -> ${targetRelative} not found`, link.line);
      continue;
    }

    // Check for absolute paths in markdown links (should be relative)
    if (link.url.startsWith('/')) {
      warning(file, `Absolute path in link: [${link.text}](${link.url}) - use relative paths`, link.line);
    }

    // Check for relative links that go above root
    if (link.url.startsWith('../') && targetRelative.startsWith('..')) {
      warning(file, `Link goes above repo root: [${link.text}](${link.url})`, link.line);
    }
  }
}

function validateMarkdownSyntax(file: string, content: string) {
  const lines = content.split('\n');

  // Check for common issues
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for trailing whitespace
    if (line !== trimmed) {
      warning(file, 'Trailing whitespace', i + 1);
    }

    // Check for bare URLs that should be links (http/https not in markdown)
    if (/https?:\/\/[^\s)]+$/.test(trimmed) && !trimmed.startsWith('http')) {
      warning(file, `Bare URL detected: ${trimmed.substring(0, 50)}...`, i + 1);
    }

    // Check for code blocks without language
    if (trimmed.startsWith('```') && trimmed === '```') {
      warning(file, 'Code block without language specifier', i + 1);
    }
  }
}

function main() {
  if (!statSync(DOCS_DIR).isDirectory()) {
    console.log('No docs/ folder found, skipping validation.');
    return;
  }

  const markdownFiles = walkMarkdownFiles(DOCS_DIR);

  console.log(`Validating ${markdownFiles.length} markdown files in ${DOCS_DIR}...\n`);

  for (const relativePath of markdownFiles) {
    const fullPath = join(DOCS_DIR, relativePath);
    const content = readFileSync(fullPath, 'utf8');

    // Validate front matter
    const { frontMatter, body, error: fmError } = extractFrontMatter(content);
    if (fmError) {
      error(relativePath, fmError);
    } else {
      validateFrontMatter(relativePath, frontMatter);
    }

    // Validate links
    validateLinks(relativePath, body, fullPath);

    // Validate markdown syntax
    validateMarkdownSyntax(relativePath, content);
  }

  // Print results
  for (const err of errors) {
    const loc = err.line ? `:${err.line}` : '';
    console.error(`❌ ${err.file}${loc}: ${err.message}`);
  }

  for (const warn of warnings) {
    const loc = warn.line ? `:${warn.line}` : '';
    console.warn(`⚠️  ${warn.file}${loc}: ${warn.message}`);
  }

  const totalErrors = errors.length;
  const totalWarnings = warnings.length;

  console.log(`\n${totalErrors} errors, ${totalWarnings} warnings`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main();
