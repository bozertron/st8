# Task W3-01: Add Phase 6 API Endpoints (H1)

**Category:** HIGH
**Single Concern:** HTTP endpoint wiring for Phase 6 features

---

## Specification

Add 4 new API endpoints to backend/server.js:

### 1. POST /api/concept-file
Handler: _handleConceptFile(req, res)
- Parse JSON body: { filepath, purpose, dependsOnBehavior, valueStatement }
- Call persistence.registerConceptFile()
- Call notificationBus.publish() with CONCEPT mutation
- Return { status: 'ok', fingerprint, lifecyclePhase: 'CONCEPT' }

### 2. POST /api/mvp-lock
Handler: _handleMvpLock(req, res)
- Get all files from persistence
- Update lifecyclePhase to 'LOCKED' for CONCEPT/DEVELOPMENT files
- Log LOCK mutation for each
- Re-emit schema cards
- Return { status: 'ok', lockedFiles: count }

### 3. GET /api/prd
Handler: _handlePrd(req, res)
- Read all schema cards from .st8/schema-cards/
- Generate markdown PRD grouped by lifecycle phase
- Return PRD as text/markdown

### 4. POST /api/production-promote
Handler: _handleProductionPromote(req, res)
- Parse JSON body: { fingerprint }
- Call persistence.purgeDevelopmentData()
- Publish PRODUCTION mutation
- Return { status: 'ok', purgedMutations: count }

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/server.js
# Test each endpoint with curl
```

## Report Format
- Routes added at lines X, Y, Z, W
- Handler methods added at lines X, Y, Z, W
- Integration with persistence/notificationBus verified