const fs = require('fs');
const path = require('path');
const os = require('os');

class TemplateEngine {
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || path.join(os.homedir(), '.st8', 'templates');
    this.ensureDefaultTemplates();
  }

  fillTemplate(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  detectVariables(template) {
    const vars = new Set();
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }

  loadTemplate(name) {
    const filePath = path.join(this.templatesDir, `${name}.md`);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  saveTemplate(name, content) {
    const filePath = path.join(this.templatesDir, `${name}.md`);
    try {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (err) {
      return false;
    }
  }

  listTemplates() {
    try {
      const files = fs.readdirSync(this.templatesDir);
      const templates = [];
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.slice(0, -3);
          const filePath = path.join(this.templatesDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const firstLine = content.split('\n')[0];
          const description = firstLine.startsWith('# ') ? firstLine.slice(2).trim() : '';
          templates.push({ name, description });
        }
      }
      return templates;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  createFromTemplate(name, variables) {
    const template = this.loadTemplate(name);
    if (template === null) {
      return null;
    }
    return this.fillTemplate(template, variables);
  }

  ensureDefaultTemplates() {
    const defaults = {
      'press-release': `# Press Release

# {{product_name}} Launches {{launch_date}}

{{tagline}}

Today we are excited to announce the launch of {{product_name}}.
`,
      'technical-spec': `# Technical Specification

## Feature: {{feature_name}}

**Author:** {{author}}  
**Date:** {{date}}

This document outlines the technical specification for {{feature_name}}.
`,
      'gtm-plan': `# Go-to-Market Plan

## Product: {{product_name}}

**Target Audience:** {{target_audience}}  
**Launch Date:** {{launch_date}}

This plan outlines the go-to-market strategy for {{product_name}}.
`
    };

    for (const [name, content] of Object.entries(defaults)) {
      const filePath = path.join(this.templatesDir, `${name}.md`);
      if (!fs.existsSync(filePath)) {
        this.saveTemplate(name, content);
      }
    }
  }
}

module.exports = { TemplateEngine };
