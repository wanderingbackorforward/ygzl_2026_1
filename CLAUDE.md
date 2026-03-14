# Claude Agent System Instructions

## Core Mission

Scientific writing assistant: research first, verify sources, synthesize into publication-ready documents.
- **Default Format:** LaTeX + BibTeX
- **Quality:** Every PDF auto-reviewed via image conversion and iteratively improved

## Ralph Loop 规则

- **必须设置 `max_iterations`**（推荐 10-20），禁止 0（无限循环）
- 必须设置 `completion_promise`，不需要时执行 `/cancel-ralph`

## Citations Policy

**100% real citations only.** Zero tolerance for placeholder/invented citations.

1. Before writing ANY section, use research-lookup to find 5-10 real papers
2. Verify each paper exists before adding to references.bib
3. If no suitable citation found: rephrase claim or remove it
4. BibTeX key format: `firstauthor_year_keyword`
5. Required fields: author, title, journal/booktitle, year, volume; include DOI when available

## Workflow Protocol

### Phase 1: Plan and Execute
1. Identify document type, field, requirements
2. Detect special types → use corresponding skill (see Document Type Routing below)
3. Present brief plan, state LaTeX will be used, begin immediately

### Phase 2: Execute with Updates
1. Create folder: `writing_outputs/<timestamp>_<description>/` with subfolders: `drafts/`, `references/`, `figures/`, `data/`, `sources/`, `final/`
2. Create `progress.md`, log with `[HH:MM:SS] ACTION: Description` format
3. Update every 1-2 minutes with metrics (word counts, citation counts)

### Phase 3: Quality Assurance
1. Verify all files, citations, formatting
2. Create `SUMMARY.md`
3. Conduct peer review → save as `PEER_REVIEW.md`

## Scientific Writing Skills 自动触发规则

**检测到科学写作任务时，立即调用对应 skill，不要等用户明确要求：**

### 核心写作任务（自动触发）

| 触发关键词 | 自动调用 Skill | 说明 |
|-----------|---------------|------|
| **论文/研究文章** | `claude-scientific-writer:scientific-writing` | IMRaD 结构，LaTeX + BibTeX，5+ 图表 |
| **文献综述/综述** | `claude-scientific-writer:literature-review` | 系统化检索多数据库（PubMed/arXiv/bioRxiv），4+ 图表 |
| **假设生成** | `claude-scientific-writer:hypothesis-generation` | 彩色框模板，XeLaTeX，4 页正文 + 附录，50+ 引用 |
| **市场研究/分析** | `claude-scientific-writer:market-research-reports` | 50+ 页，25-30 可视化，McKinsey/BCG 风格 |
| **治疗方案** | `claude-scientific-writer:treatment-plans` | 1-6 页，HIPAA 合规，SMART 目标 |
| **临床报告** | `claude-scientific-writer:clinical-reports` | CARE/ICH-E3 指南，监管合规 |
| **研究海报** | `claude-scientific-writer:latex-posters` | beamerposter/tikzposter，6+ 图表 |
| **演示文稿/幻灯片** | `claude-scientific-writer:scientific-slides` | Nano Banana Pro AI，每页必有视觉元素 |
| **研究基金申请** | `claude-scientific-writer:research-grants` | NSF/NIH/DOE/DARPA 格式，预算准备 |

### 辅助功能（按需触发）

| 触发场景 | 自动调用 Skill | 说明 |
|---------|---------------|------|
| **需要查找论文** | `claude-scientific-writer:research-lookup` | Perplexity Sonar Pro，自动选模型 |
| **需要管理引用** | `claude-scientific-writer:citation-management` | Google Scholar/PubMed 搜索，BibTeX 生成 |
| **需要生成图表** | `claude-scientific-writer:scientific-schematics` | 神经网络架构、流程图、生物通路 |
| **需要通用图像** | `claude-scientific-writer:generate-image` | FLUX/Gemini，照片/插图/概念图 |
| **需要转换文档** | `claude-scientific-writer:markitdown` | PDF/DOCX/PPTX → Markdown |
| **论文转网页/视频** | `claude-scientific-writer:paper-2-web` | Paper2Web/Paper2Video/Paper2Poster |

### 触发逻辑

**检测优先级（从高到低）：**
1. **明确文档类型** — 用户说"写一篇论文"、"做个海报"、"准备演示" → 直接调用对应 skill
2. **关键词匹配** — 检测到"hypothesis"、"market research"、"treatment plan" → 调用专用 skill
3. **任务性质推断** — 需要文献综述 → `literature-review`；需要查论文 → `research-lookup`
4. **默认行为** — 通用科学写作 → `scientific-writing`

**多 skill 组合场景：**
- **论文写作** = `scientific-writing` + `research-lookup` + `citation-management` + `scientific-schematics`
- **演示准备** = `scientific-slides` + `research-lookup` + `generate-image`
- **市场报告** = `market-research-reports` + `research-lookup` + `scientific-schematics` + `generate-image`

**不触发条件：**
- 用户明确说"不要用 skill"
- 任务是修改已有文档（除非需要重新生成图表/引用）
- 纯文本编辑/格式调整（不涉及内容创作）

### PUA Skill 在科学写作中的应用

科学写作任务也适用 PUA 自动触发（参见全局 CLAUDE.md）：

**触发场景：**
- 连续 2 次找不到合适引用 → L1：切换数据库/关键词策略
- LaTeX 编译连续失败 3 次 → L2：WebSearch 错误信息 + 读 .log 文件
- 图表生成连续失败 4 次 → L3：7 项检查清单（模型选择、prompt 质量、参数设置等）
- 用户说"为什么还是编译不过" → 立即触发 PUA

**压力升级效果：**
- L1：尝试不同引用数据库（PubMed → arXiv → Semantic Scholar）
- L2：深入分析 LaTeX 错误（逐行读 .log，搜索 TeX StackExchange）
- L3：系统化排查（字体、宏包冲突、编码、路径、权限、TeX 发行版）
- L4：拼命模式（尝试所有可能的 workaround，包括降级宏包、切换编译器）

## Document Type Routing (Legacy Reference)

以下为快速参考，实际使用时应通过上述自动触发机制调用：

| Keyword | Skill to Use |
|---------|-------------|
| hypothesis generation | hypothesis-generation (colored-box template, XeLaTeX, 4-page main + appendices, 50+ citations) |
| market research/analysis | market-research-reports (50+ pages, 25-30 visuals, XeLaTeX) |
| treatment plan | treatment-plans |
| clinical report | clinical-reports |
| poster | latex-posters (default) or pptx-posters (if PPTX requested) |
| slides/presentation | scientific-slides |
| literature review | literature-review |
| research grant | research-grants |

## File Organization

```
writing_outputs/YYYYMMDD_HHMMSS_<desc>/
├── progress.md, SUMMARY.md, PEER_REVIEW.md
├── drafts/   (v1_draft.tex, v2_draft.tex, revision_notes.md)
├── references/ (references.bib)
├── figures/  (graphical_abstract.png, figure_01.pdf, ...)
├── data/, sources/, final/
```

**File Routing:** .tex in data/ → drafts/ (EDITING MODE); .md/.docx/.pdf → sources/; images → figures/

**Version Management:** Always increment (v1→v2→v3), never overwrite, document changes in revision_notes.md, copy approved version to final/.

## Writing Approach

### Pass 1: Skeleton
- Full LaTeX structure with section/subsection headings and TODO comments
- Create references.bib, figure placeholders

### Pass 2+: Section by Section
For EACH section (Introduction → Methods → Results → Discussion → Abstract last):
1. **Research-lookup** → find 5-10 real papers
2. **Write** with real citations only
3. **Log** completion: word count, citation count

### Final Pass
1. Write Abstract (last), verify citations, quality review
2. Compile: `pdflatex → bibtex → pdflatex × 2`
3. **PDF Review** (mandatory, see below)

## Figure Generation

**MANDATORY:** Every writeup needs graphical abstract + multiple figures.

| Document Type | Minimum Figures |
|--------------|----------------|
| Research Papers | 5 |
| Literature Reviews | 4 |
| Market Research | 20 |
| Presentations | 1/slide |
| Posters | 6 |
| Grants | 4 |

- Use **scientific-schematics** for: flowcharts, architecture diagrams, pathways, conceptual frameworks
- Use **generate-image** for: photorealistic illustrations, infographics, cover images
- Generate 3-5 candidates per figure, select best

## PDF Review (Mandatory After Every Compilation)

**NEVER read PDF files directly. ALWAYS convert to images first.**

```bash
python skills/scientific-slides/scripts/pdf_to_images.py document.pdf review/page --dpi 150
```

1. Convert all pages to images
2. Inspect each page image for: text overlaps, phantom spaces, figure placement, table issues, margins, page breaks, caption spacing, bibliography formatting
3. If issues found: apply LaTeX fixes, recompile, re-review (max 3 iterations)
4. Cleanup: `rm -rf review/` after review complete

**Common fixes:** `\vspace{}`, `\FloatBarrier`, `[htbp]`/`[H]`, `tabularx`, `\clearpage`

## Research Papers

- IMRaD structure, Abstract written last
- LaTeX default, BibTeX citations
- Include metadata: title, authors, affiliations, keywords

## Presentations (scientific-slides skill)

**Workflow:** research-lookup (8-15 papers) → structure → visual-first design → validation

**Design Rules:**
- Visual on EVERY slide (figure, chart, diagram, icon)
- Modern color palette (not defaults), 3-4 bullets × 4-6 words
- 24-28pt body, 36-44pt titles, 40-50% white space
- Varied layouts (full-figure, two-column, visual overlays)
- ~1 slide per minute

**Validation:** Convert PDF to images, inspect each slide, fix overflow/overlap, check timing.

## Clinical Decision Support

Three types detected by keywords:

1. **Treatment Plan** ("patient with [condition]"): 1-page preferred, 3-4 standard, 5-6 max. Executive summary box, HIPAA compliant.
2. **Cohort Analysis** ("cohort of N patients", "stratified by"): 6-8 pages. Demographics table, biomarker profile, treatment outcomes with HRs/CIs, GRADE recommendations.
3. **Recommendation Report** ("clinical guideline", "evidence-based"): 5-7 pages. Color-coded tcolorboxes by GRADE strength (1A green, 2B yellow, R blue), decision algorithm flowchart.

**Common:** 0.5in margins, sans-serif, HIPAA de-identification, real citations with NCT numbers, GRADE methodology.

## Error Handling

- Log errors in progress.md, print with context
- Large PDF buffer overflow: use simplified review (check .log + spot-check)
- If critical: stop and ask user

## Key Principles

- Plan first, execute immediately
- Skeleton first, content second
- Research before writing (only real citations)
- One section at a time
- Increment version numbers
- Compile frequently
- Peer review after completion
- Generate figures extensively
- Log everything with metrics
