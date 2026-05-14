# PM-1: Background Indexer + Continuous Analysis + LLM Insight Hooks

## Crown Jewel Architecture for Codebase Intelligence

**Status:** Research & Architectural Blueprint  
**Priority:** HIGH (Platform Foundation)  
**Scope:** Multi-layer system design for exhaustive parsing, insight catalog, and LLM-driven pattern discovery  

---

## Executive Summary

The PM-1 vision transforms Maestro Scaffolder into a **continuous insight engine** where codebase analysis becomes a living, evolving knowledge system:

1. **Layer 1 (Foundation)**: Background Indexer auto-indexes projects on addition; results cached locally
2. **Layer 2 (Depth)**: Multi-pass analyzer runs 5 iterative passes, each adding insights
3. **Layer 3 (Intelligence)**: Hook system triggers LLM experts when insights posted; experts find patterns/opportunities
4. **Layer 4 (Knowledge)**: Opportunity classifier systematizes findings into searchable catalog (granular + meta-architectural)
5. **Layer 5 (Visualization)**: Interactive playground for simulating proposed optimizations

**Key Insight**: The system doesn't just analyze code—it *evolves alongside* it. Each indexing cycle discovers new patterns; patterns drive opportunity classification; opportunities accumulate into an actionable knowledge base.

---

## Part 1: Current State

### Existing Components (Reusable)

| Component | Location | Status |
|-----------|----------|--------|
| 10-Parser Pipeline | `/src/commands/integr8/dataIngestion.ts` | ✓ Complete (Stage 1) |
| Relationship Analyzer | `/src/commands/integr8/relationshipAnalyzer.ts` | ✓ Complete (Stage 2) |
| Migration Path Generator | `/src/commands/integr8/pathGenerator.ts` | ✓ Complete (Stage 3) |
| Graph DB Schema | `/src-tauri/src/database/schema.rs` | ✓ Complete (GraphNodes/GraphEdges) |
| Parser Persistence | `/src/commands/parserPersistence.ts` | ✓ Complete |
| Historical Analyzer | `/src/commands/historicalAnalyzer.ts` | ✓ Complete (snapshots + trends) |
| Composition Analysis | `/src/commands/compositionAnalyzer.ts` | ✓ Complete (4 modes) |
| Internal Flow Analysis | `/src/commands/internalFlowAnalyzer.ts` | ✓ Complete (AST + call graphs) |
| Graph Traversal Queries | `/src/commands/graphTraversal.ts` | ✓ Complete (O(log n) lookups) |

### Critical Gaps

| Layer | Gap | Impact |
|-------|-----|--------|
| 1 | No background indexer service | Projects must be indexed synchronously (slow) |
| 1 | No cache materialization | Every query re-runs full analysis |
| 2 | No multi-pass framework | Single-pass limits insight depth |
| 2 | No per-file insight store | Insights not persisted or accumulated |
| 3 | No hook system | Insights aren't triggered for analysis |
| 3 | No LLM integration | No pattern expert analysis |
| 4 | No opportunity catalog | No systematic classification |
| 5 | No simulation engine | Can't visualize proposed changes |

---

## Part 2: 5-Layer Architecture

### Layer 1: Background Indexer + Cache

**Purpose**: Automatic project indexing with local cache; non-blocking registration.

**Key Components**:
- `BackgroundIndexer` service (queue + job manager)
- `.scaffolder-cache/index.db` (SQLite3 with WAL)
- FileWatcher for incremental updates
- ProjectIndex + FileInsightSlots + AnalysisPass tables

**Workflow**:
```
User: "Add Project" → registerProject() → Return projectId immediately
                        ↓
                    Queue indexing job (background)
                        ↓
                    Run full integr8 pipeline
                        ↓
                    Initialize per-file insight stores
                        ↓
                    Cache to .scaffolder-cache/index.db
                        ↓
                    Set up file watcher for incremental updates
```

**Effort**: 60 hours | **Timeline**: Week 1-2

---

### Layer 2: Multi-Pass Analysis Pipeline

**Purpose**: Iterative depth accumulation; each pass adds new insights.

**5 Passes**:
1. **Baseline**: File complexity, export/import ratios, structural metrics
2. **Dependency Health**: Circular dependencies, breaking changes, version conflicts
3. **Pattern Detection**: Recurring issues (high complexity in directories, unused patterns)
4. **Security**: Vulnerabilities, compliance, sensitive data flows
5. **Meta-Architectural**: System-wide patterns, scaling limitations, abstraction gaps

**InsightRecord Schema**:
```typescript
interface InsightRecord {
  insightId: string;
  filePath: string;
  timestamp: timestamp;
  passNumber: number;
  insightType: 'unused_export' | 'circular_dependency' | 'anti_pattern' | ...;
  confidence: number; // 0-1
  content: string;
  relatedNodeIds: string[]; // Graph node IDs
  context: Record<string, any>; // Metrics, details
}
```

**Storage**: FileInsightSlots table per project per file

**Effort**: 140 hours | **Timeline**: Week 3-6

---

### Layer 3: Hook System + LLM Experts

**Purpose**: Trigger intelligent analysis when insights posted; discover patterns and opportunities.

**Hook Types**:
1. **New Insight Hook**: Fire on any insight
2. **Pattern Hook**: Fire when 3+ similar insights detected in same directory/module
3. **Threshold Hook**: Fire when issue count exceeds limit
4. **Scheduled Hook**: Fire on cron schedule

**LLM Experts** (GPT-4/4-turbo):
- **Pattern Analyst**: Identifies recurring patterns, root causes
- **Performance Advisor**: Suggests specific optimizations
- **Architecture Reviewer**: Proposes systemic refactorings
- **Security Analyst**: Identifies vulnerabilities and mitigations

**Workflow**:
```
Insights Posted → FileInsightSlots updated
                        ↓
            InsightHookManager.fireHooks()
                        ↓
        Pattern hook detects 3+ similar issues
                        ↓
        Format insights → LLM expert prompt
                        ↓
        Invoke GPT-4: "Analyze these patterns"
                        ↓
        LLM returns: finding, severity, suggestion, reasoning
                        ↓
        Store to OpportunityCatalog table
```

**Effort**: 90 hours | **Timeline**: Week 5-7

---

### Layer 4: Opportunity Classification Engine

**Purpose**: Systematize insights into searchable, actionable opportunities.

**Opportunity Schema**:
```typescript
interface Opportunity {
  opportunityId: string;
  category: 'granular' | 'meta_architectural';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedComponents: string[];
  pattern: { name, occurrences, trend };
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  estimatedImpact: 'low' | 'medium' | 'high' | 'transformational';
  proposedOptimization: string;
  relatedOpportunities: string[];
  discoveredAt: timestamp;
}
```

**Query API**:
- `listOpportunities(filters)` → filtered list
- `getImpactRoadmap()` → sorted by impact/effort (quick wins first)
- `getPatternInsights()` → pattern frequency analysis

**Effort**: 60 hours | **Timeline**: Week 7

---

### Layer 5: Visualization + Simulation Playground

**Purpose**: Enable users to "play with concepts" and visualize proposed changes.

**UI Components**:
- **Left Panel**: Opportunity explorer with filters (category, severity, impact/effort ratio)
- **Middle Panel**: Current architecture graph (D3.js) with affected modules highlighted
- **Right Panel**: Proposed state + simulation controls

**Simulation Engine**:
- Computes baseline metrics (complexity, coupling, cohesion, test coverage)
- Applies proposed changes (conceptually)
- Outputs delta metrics: complexity change %, maintainability improvement, coupling reduction
- Risk assessment: breaking changes, rollback feasibility, tests required

**Effort**: 110 hours | **Timeline**: Week 8-10

---

## Part 3: Data Flow Integration

### "Add Project" → Auto-Index → Insights

```
┌─── User: "Add Project" ───┐
│  (Non-blocking)           │
└──────────┬────────────────┘
           ↓
    [Layer 1] Background Indexer
    - Create ProjectIndex row
    - Queue job
    - Return projectId
           ↓
    [Background Job]
    - Run integr8 pipeline (10 parsers → graph)
    - Init FileInsightSlots
    - Run MultiPassAnalyzer (5 passes)
    - Store insights to DB
           ↓
    [Layer 3] Hook System
    - Detect patterns (3+ similar insights)
    - Trigger LLM analysis
    - Store opportunities
           ↓
    [Layer 4] Opportunity Classifier
    - Classify by category/severity/effort
    - Link related opportunities
           ↓
    [Layer 5] UI Playground
    - Render opportunities
    - Enable simulation
```

---

## Part 4: Implementation Roadmap

| Phase | Components | Effort | Timeline |
|-------|-----------|--------|----------|
| **1** | Background Indexer + Cache | 60h | Week 1-2 |
| **2** | Multi-Pass Analyzer (Passes 1-5) | 140h | Week 3-6 |
| **3** | LLM Experts + Hooks | 90h | Week 5-7 |
| **4** | Opportunity Classifier | 60h | Week 7 |
| **5** | UI Playground + Simulator | 110h | Week 8-10 |
| **6** | Testing + Hardening | 60h | Week 10-12 |
| **Total** | **5 Layers** | **570h** | **~14 weeks** |

---

## Part 5: New Dependencies

```json
{
  "llm": { "openai": "^4.0.0" },
  "metrics": { "typhonjs-escomplex": "^2.0.0" },
  "visualization": { "d3": "^7.0.0" }
}
```

---

## Part 6: Reusable Existing Components

✓ integr8 pipeline (Stage 1-3)
✓ GraphTraversal queries (impact analysis)
✓ CompositionAnalyzer (multi-mode logic)
✓ InternalFlowAnalyzer (AST parsing)
✓ HistoricalAnalyzer (trend detection)
✓ ParserPersistence (DB storage)
✓ Tauri IPC (background notifications)

---

## Part 7: Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Async Indexing (Layer 1)** | "Add Project" must be instant; indexing happens background. Matches "automatically indexed" vision. |
| **Multi-Pass (Layer 2)** | Each pass adds depth; accumulation enables discovery of meta patterns. Mirrors human code review iterative process. |
| **Hook-Based Triggers (Layer 3)** | Efficient: only run LLM when patterns emerge. Decouples insight generation from LLM analysis. |
| **Local Cache** | .scaffolder-cache/ avoids external dependencies; portable across machines. Cache invalidation via file watcher. |
| **Graph-Backed Simulation (Layer 5)** | Reuses existing GraphNodes/GraphEdges; enables accurate impact analysis. |

---

## Part 8: Success Metrics

- **Baseline Indexing**: 10-15 min for 1000-file project (first run async)
- **Cache Hits**: <50ms for subsequent queries
- **Insight Accumulation**: 50+ insights per pass; 250+ total after 5 passes
- **LLM Response Time**: <5s per expert visit (cached where possible)
- **UI Responsiveness**: <200ms for opportunity filtering/sorting
- **Pattern Detection Accuracy**: 85%+ precision (validated against domain experts)

---

## Conclusion

PM-1 positions Maestro Scaffolder as a **transformational platform** for codebase intelligence. By combining exhaustive multi-pass analysis, LLM-driven pattern discovery, and continuous insight accumulation, the system evolves from a static analyzer into a **living codebase advisor**—discovering opportunities, classifying patterns, and guiding architectural decisions in real-time.

The 5-layer architecture is modular, reusable-component rich, and production-capable. Implementation is staged to de-risk complexity and enable early feedback.

