# SERVER.JS FILE INDEX

**File:** `backend/server.js`
**Lines:** 1430
**Generated:** 2026-05-14

---

## SECTION 1: HEADER & IMPORTS (Lines 1-14)

```
Lines 1-14: File header, shebang, docstring, imports
├─ Line 1: #!/usr/bin/env node
├─ Lines 3-8: Module docstring
├─ Line 10: 'use strict'
├─ Line 12: const http = require('http')
├─ Line 13: const fs = require('fs')
└─ Line 14: const path = require('path')
```

**Imports:** `http`, `fs`, `path`
**Status:** ✅ Working

---

## SECTION 2: STATIC FILE SERVING (Lines 16-31)

```
Lines 16-31: Static file serving constants
├─ Line 18: STATIC_DIR = path.join(__dirname, '..')
└─ Lines 19-31: MIME_TYPES object (html, js, css, json, toml, png, jpg, svg, ttf, woff, woff2)
```

**Purpose:** Defines static directory and MIME type mappings
**Status:** ✅ Working

---

## SECTION 3: SERVER CLASS (Lines 33-1424)

### 3.1 Constructor (Lines 35-42)
```
Lines 35-42: St8Server class constructor
├─ Line 37: this.port = options.port || 3847
├─ Line 38: this.targetDir = options.targetDir || null
├─ Line 39: this.server = null
├─ Line 40: this.manifestCache = null
└─ Line 41: this.lastManifestUpdate = null
```

### 3.2 Server Startup (Lines 44-54)
```
Lines 44-54: start() method
├─ Line 45: http.createServer with _handleRequest callback
├─ Line 49: server.listen on 127.0.0.1:port
└─ Line 53: return true
```

### 3.3 Request Handler (Lines 56-78)
```
Lines 56-78: _handleRequest(req, res)
├─ Line 57: URL parsing
├─ Lines 59-62: CORS headers (localhost only)
├─ Lines 64-68: OPTIONS preflight handling
├─ Lines 70-74: API route dispatch
└─ Line 77: Static file serving fallback
```

### 3.4 API Route Dispatch (Lines 80-146)
```
Lines 80-146: _handleApiRequest(req, res, url)
├─ Line 82: /api/connection-state.json → _serveManifest
├─ Line 85: /api/ai-signal.toml → _serveToml
├─ Line 88: /api/health → _serveHealth
├─ Line 91: /api/index → _handleIndex
├─ Line 94: /api/file-intent → _handleFileIntent
├─ Line 97: /api/settings → _handleSettings
├─ Line 100: /api/verify → _handleVerify
├─ Line 103: /api/files → _handleFileList
├─ Line 106: /api/mutations → _handleMutationsSSE
├─ Line 109: /api/concept-file → _handleConceptFile
├─ Line 112: /api/mvp-lock → _handleMvpLock
├─ Line 115: /api/prd → _handlePrd
├─ Line 118: /api/production-promote → _handleProductionPromote
├─ Line 121: /api/gap-analysis → _handleGapAnalysis
├─ Line 124: /api/prd-projects → _handlePrdProjects
├─ Line 127: /api/bruno-call → _handleBrunoCall
├─ Line 130: /api/oscar-house → _handleOscarHouse
├─ Line 133: /api/needs-ai-review → _handleNeedsAIReview
├─ Line 136: /api/mark-reviewed → _handleMarkReviewed
├─ Line 139: /api/templates → _handleTemplates
└─ Line 142: default → 404
```

**Routes:** 20 API endpoints
**Status:** ✅ Working

### 3.5 Static File Serving (Lines 148-185)
```
Lines 148-185: _serveStaticFile(req, res, url)
├─ Line 152: Default to st8.html
├─ Lines 158-163: Directory traversal protection
├─ Lines 166-170: File existence check
├─ Lines 172-174: MIME type lookup
└─ Lines 177-184: File serving with error handling
```

**Status:** ✅ Working

### 3.6 Manifest Serving (Lines 187-233)
```
Lines 187-209: _serveManifest(req, res)
├─ Line 194: manifestPath = targetDir/connection-state.json
└─ Lines 196-208: File reading and response

Lines 211-233: _serveToml(req, res)
├─ Line 218: tomlPath = targetDir/ai-signal.toml
└─ Lines 220-232: File reading and response
```

**Status:** ✅ Working

### 3.7 Health Endpoint (Lines 235-243)
```
Lines 235-243: _serveHealth(req, res)
└─ Returns: status, uptime, targetDir, lastManifestUpdate
```

**Status:** ✅ Working

### 3.8 Index Endpoint (Lines 245-314)
```
Lines 245-314: _handleIndex(req, res)
├─ Lines 247-251: POST method validation
├─ Lines 253-268: Body size limit (1KB)
├─ Lines 270-313: Request handling
│   ├─ Line 283: require('./indexer')
│   ├─ Line 284: require('./manifestGenerator')
│   ├─ Line 285: require('./persistence')
│   ├─ Line 287: indexDirectory(targetDir, { write: false })
│   ├─ Lines 290-297: Enrich with intents
│   └─ Line 299: writeManifests(result.files, targetDir)
```

**Status:** ✅ Working
**Dependencies:** `indexer`, `manifestGenerator`, `persistence`

### 3.9 File Intent Endpoint (Lines 316-413)
```
Lines 316-413: _handleFileIntent(req, res)
├─ Lines 318-322: POST method validation
├─ Lines 324-339: Body size limit (1KB)
└─ Lines 341-412: Request handling
    ├─ Line 344: Parse fingerprint, purpose, dependsOnBehavior, valueStatement
    ├─ Line 345: require('./persistence')
    ├─ Line 350: persistence.upsertIntent()
    ├─ Line 358: persistence.logActivity()
    ├─ Lines 366-396: Regenerate manifest with updated intent
    └─ Line 399: Response with fingerprint
```

**Status:** ✅ Working
**Dependencies:** `persistence`

### 3.10 Settings Endpoint (Lines 415-490)
```
Lines 415-490: _handleSettings(req, res, url)
├─ Line 416: require('./persistence')
├─ Lines 420-435: GET handler
│   ├─ Line 424: category from query params
│   ├─ Line 427: getSettingsByCategory(category)
│   └─ Line 429: getAllSettings()
└─ Lines 437-484: POST handler
    ├─ Lines 440-454: Body size limit (1KB)
    └─ Lines 456-478: Request handling
        ├─ Line 459: Parse category, key, value
        └─ Line 465: upsertSetting(category, key, value)
```

**Status:** ✅ Working
**Dependencies:** `persistence`

### 3.11 File List Endpoint (Lines 492-542)
```
Lines 492-542: _handleFileList(req, res, url)
├─ Line 494: requestedPath from query params
├─ Lines 498-499: Tilde expansion
├─ Lines 504-519: Directory traversal protection
├─ Lines 521-526: Path existence validation
└─ Lines 528-541: Directory listing
```

**Status:** ✅ Working
**Dependencies:** `os`, `fs`, `path`

### 3.12 Verify Endpoint (Lines 544-738)
```
Lines 544-738: _handleVerify(req, res)
├─ Lines 546-550: POST method validation
├─ Lines 552-567: Body size limit (1KB)
└─ Lines 569-737: Request handling
    ├─ Lines 573-603: Path resolution and validation
    ├─ Lines 605-612: Persistence initialization
    ├─ Lines 613-627: Results structure
    ├─ Lines 630-695: File verification loop
    │   ├─ Lines 642-651: Missing file check
    │   └─ Lines 653-691: Hash and size verification
    ├─ Lines 697-711: Orphan file detection
    ├─ Lines 714-721: Activity logging
    └─ Lines 723-724: Response
```

**Status:** ✅ Working
**Dependencies:** `persistence`, `indexer`, `crypto`

### 3.13 Mutations SSE Endpoint (Lines 740-747)
```
Lines 740-747: _handleMutationsSSE(req, res)
├─ Line 741: require('./notificationBus')
└─ Line 744: notificationBus.addSSEClient(res, { allowedOrigin })
```

**Status:** ✅ Working
**Dependencies:** `notificationBus`

### 3.14 Concept File Endpoint (Lines 749-839)
```
Lines 749-839: _handleConceptFile(req, res)
├─ Lines 752-756: POST method validation
├─ Lines 758-773: Body size limit (1KB)
└─ Lines 775-838: Request handling
    ├─ Line 789: Parse filepath, purpose, dependsOnBehavior, valueStatement
    ├─ Line 803: persistence.registerConceptFile()
    ├─ Lines 810-818: upsertIntent if provided
    └─ Lines 820-825: notificationBus.publish(CONCEPT)
```

**Status:** ✅ Working
**Dependencies:** `persistence`, `notificationBus`

### 3.15 MVP Lock Endpoint (Lines 841-928)
```
Lines 841-928: _handleMvpLock(req, res)
├─ Lines 842-846: POST method validation
├─ Lines 848-864: Body size limit (1KB)
└─ Lines 866-927: Request handling
    ├─ Lines 877-907: Lock all CONCEPT/DEVELOPMENT files
    │   ├─ Line 882: UPDATE lifecyclePhase = 'LOCKED'
    │   ├─ Line 886: logMutation(LOCK)
    │   └─ Line 895: notificationBus.publish(LOCK)
    ├─ Lines 910-914: Re-emit all schema cards
    └─ Line 917: Response with lockedFiles count
```

**Status:** ✅ Working
**Dependencies:** `persistence`, `schemaCardEmitter`, `notificationBus`

### 3.16 PRD Endpoint (Lines 930-959)
```
Lines 930-959: _handlePrd(req, res)
├─ Lines 931-935: GET method validation
├─ Line 944: require('./prdGenerator')
├─ Line 947: loadSchemaCards(cardsDir)
└─ Line 948: generatePRD(cards)
```

**Status:** ✅ Working
**Dependencies:** `prdGenerator`

### 3.17 Production Promote Endpoint (Lines 961-1028)
```
Lines 961-1028: _handleProductionPromote(req, res)
├─ Lines 962-966: POST method validation
├─ Lines 968-981: Body size limit (1KB)
└─ Lines 982-1027: Request handling
    ├─ Line 1008: persistence.purgeDevelopmentData(fingerprint)
    └─ Lines 1010-1014: notificationBus.publish(PRODUCTION)
```

**Status:** ✅ Working
**Dependencies:** `persistence`, `notificationBus`

### 3.18 Gap Analysis Endpoint (Lines 1030-1069)
```
Lines 1030-1069: _handleGapAnalysis(req, res)
├─ Lines 1031-1035: GET method validation
├─ Line 1039: require('./gapAnalyzer')
├─ Line 1045: new GapAnalyzer(schemaCardsDir, persistence)
├─ Line 1046: analyzer.analyze()
└─ Lines 1048-1057: Content negotiation (JSON or Markdown)
```

**Status:** ✅ Working
**Dependencies:** `gapAnalyzer`, `persistence`

### 3.19 PRD Projects Endpoint (Lines 1071-1169)
```
Lines 1071-1169: _handlePrdProjects(req, res, url)
├─ Lines 1072-1110: GET handler
│   ├─ Lines 1074-1094: Get single project by name
│   └─ Lines 1096-1109: List all projects
└─ Lines 1111-1168: POST handler
    ├─ Lines 1113-1127: Body size limit (2KB)
    └─ Lines 1129-1164: Request handling
        ├─ Line 1132: Parse name, template, variables
        └─ Line 1143: createPRDProject(name, projectPath, template, variables)
```

**Status:** ✅ Working
**Dependencies:** `persistence`

### 3.20 Bruno Call Endpoint (Lines 1171-1224)
```
Lines 1171-1224: _handleBrunoCall(req, res)
├─ Lines 1172-1176: POST method validation
├─ Lines 1178-1192: Body size limit (1KB)
└─ Lines 1194-1223: Request handling
    ├─ Line 1200: require('./brunoOscar')
    ├─ Line 1207: new BrunoOscar(persistence, notificationBus)
    └─ Line 1208: bruno.runBrunoCall(threshold)
```

**Status:** ✅ Working
**Dependencies:** `brunoOscar`, `persistence`, `notificationBus`

### 3.21 Oscar House Endpoint (Lines 1226-1279)
```
Lines 1226-1279: _handleOscarHouse(req, res)
├─ Lines 1227-1231: POST method validation
├─ Lines 1233-1247: Body size limit (1KB)
└─ Lines 1249-1278: Request handling
    ├─ Line 1255: require('./brunoOscar')
    ├─ Line 1262: new BrunoOscar(persistence, notificationBus)
    └─ Line 1263: oscar.runOscarHouse(gracePeriod)
```

**Status:** ✅ Working
**Dependencies:** `brunoOscar`, `persistence`, `notificationBus`

### 3.22 Needs AI Review Endpoint (Lines 1281-1304)
```
Lines 1281-1304: _handleNeedsAIReview(req, res)
├─ Lines 1282-1286: GET method validation
├─ Line 1293: persistence.getFilesNeedingAIReview()
```

**Status:** ✅ Working
**Dependencies:** `persistence`

### 3.23 Mark Reviewed Endpoint (Lines 1306-1360)
```
Lines 1306-1360: _handleMarkReviewed(req, res)
├─ Lines 1307-1311: POST method validation
├─ Lines 1313-1327: Body size limit (1KB)
└─ Lines 1329-1359: Request handling
    ├─ Line 1332: Parse filepath, approved, notes
    └─ Line 1344: persistence.markAIReviewed(filepath)
```

**Status:** ✅ Working
**Dependencies:** `persistence`

### 3.24 Templates Endpoint (Lines 1362-1416)
```
Lines 1362-1416: _handleTemplates(req, res, url)
├─ Lines 1363-1373: GET handler
│   └─ Line 1367: engine.listTemplates()
└─ Lines 1374-1415: POST handler
    ├─ Lines 1375-1389: Body size limit (2KB)
    └─ Lines 1391-1411: Request handling
        ├─ Line 1394: Parse name, content, description
        └─ Line 1403: engine.saveTemplate(name, content)
```

**Status:** ✅ Working
**Dependencies:** `templateEngine`

### 3.25 Server Stop (Lines 1418-1423)
```
Lines 1418-1423: stop() method
└─ Line 1420: this.server.close()
```

**Status:** ✅ Working

---

## SECTION 4: EXPORTS (Lines 1426-1430)

```
Lines 1426-1430: Module exports
└─ Line 1428: module.exports = { St8Server }
```

**Exports:** `St8Server` (class)
**Status:** ✅ Working

---

## SUMMARY

| Section | Lines | Purpose | Status |
|---------|-------|---------|--------|
| Header & Imports | 1-14 | File setup | ✅ |
| Static File Serving | 16-31 | Constants | ✅ |
| Server Class | 33-1424 | All server logic | ✅ |
| Exports | 1426-1430 | Module exports | ✅ |

### API Endpoints (20 total)

| Endpoint | Method | Handler | Lines |
|----------|--------|---------|-------|
| `/api/connection-state.json` | GET | _serveManifest | 187-209 |
| `/api/ai-signal.toml` | GET | _serveToml | 211-233 |
| `/api/health` | GET | _serveHealth | 235-243 |
| `/api/index` | POST | _handleIndex | 245-314 |
| `/api/file-intent` | POST | _handleFileIntent | 316-413 |
| `/api/settings` | GET/POST | _handleSettings | 415-490 |
| `/api/verify` | POST | _handleVerify | 544-738 |
| `/api/files` | GET | _handleFileList | 492-542 |
| `/api/mutations` | GET | _handleMutationsSSE | 740-747 |
| `/api/concept-file` | POST | _handleConceptFile | 749-839 |
| `/api/mvp-lock` | POST | _handleMvpLock | 841-928 |
| `/api/prd` | GET | _handlePrd | 930-959 |
| `/api/production-promote` | POST | _handleProductionPromote | 961-1028 |
| `/api/gap-analysis` | GET | _handleGapAnalysis | 1030-1069 |
| `/api/prd-projects` | GET/POST | _handlePrdProjects | 1071-1169 |
| `/api/bruno-call` | POST | _handleBrunoCall | 1171-1224 |
| `/api/oscar-house` | POST | _handleOscarHouse | 1226-1279 |
| `/api/needs-ai-review` | GET | _handleNeedsAIReview | 1281-1304 |
| `/api/mark-reviewed` | POST | _handleMarkReviewed | 1306-1360 |
| `/api/templates` | GET/POST | _handleTemplates | 1362-1416 |

### Proposed Split

| Target File | Source Lines | Purpose |
|-------------|--------------|---------|
| `src/0_core/0_server/0_app.js` | 33-78 | Server class, constructor, request handler |
| `src/0_core/0_server/0_index.js` | 1418-1430 | Start/stop methods, exports |
| `src/0_core/0_server/0_routes/0_api/0_files.js` | 103-105, 492-542 | /api/files endpoint |
| `src/0_core/0_server/0_routes/0_api/0_connections.js` | 82-84, 187-209 | /api/connection-state.json endpoint |
| `src/0_core/0_server/0_routes/0_api/0_schema-cards.js` | 115-117, 930-959 | /api/prd endpoint |
| `src/0_core/0_server/0_routes/0_api/0_settings.js` | 97-99, 415-490 | /api/settings endpoint |
| `src/0_core/0_server/0_routes/0_api/0_health.js` | 88-90, 235-243 | /api/health endpoint |
| `src/0_core/0_server/0_routes/0_api/0_sse.js` | 106-108, 740-747 | /api/mutations SSE endpoint |
| `src/0_core/0_server/0_middleware/0_error-handler.js` | — | Error handling middleware |
| `src/0_core/0_server/0_middleware/0_request-logger.js` | — | Request logging middleware |
| `src/0_core/0_server/0_middleware/0_cors.js` | 59-68 | CORS middleware |

---

*Generated for architecture refactoring reference*
