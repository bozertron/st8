# D9: Hardware-Software Bridge Specification

**Date:** 2026-05-13
**Status:** SPECIFICATION
**Dependencies:** D1 (Type System), D2 (Composition Engine), D3 (Template Architecture), D6/D7 (API + Data Model)

---

## 1. Vision: One PRD System for All Domains

st8 serves a technology commercialization company that spans:
- **Software:** Firmware (bare metal C/ASM) → Backend services → Frontend UIs
- **Hardware:** Premium consumer products → Industrial manufacturing equipment
- **Integration:** IoT/embedded systems that bridge both worlds

The PRD system must handle all of these without forcing users into a software-only or hardware-only box.

**Core Principle:** The same stakeholder interview process, the same composition engine, the same objection workflow — but with **domain-aware templates** that surface the right sections for the right product type.

---

## 2. Domain Detection

The system determines which templates to use based on:

### 2.1 Product Type Classification
```typescript
interface ProductProfile {
    productType: 'software' | 'hardware_consumer' | 'hardware_industrial' | 'iot' | 'hybrid';
    hasFirmware: boolean;
    hasBackend: boolean;
    hasFrontend: boolean;
    hasHardware: boolean;
    hasMechanical: boolean;
    targetMarkets: string[];
    certificationRegions: string[];
}
```

**Detection Sources:**
- Product Owner input during project setup
- File extensions in codebase (`.vue`, `.ts` → software; `.step`, `.stl` → mechanical; `.kicad` → electrical)
- Stakeholder role composition (firmware engineers present? → hasFirmware)
- Business ontology (company profile indicates primary market)

### 2.2 Settings-Driven Configuration
Using the `settings-ui.js` pattern:

```javascript
// DEFAULT_SETTINGS addition:
product: {
    product_type: 'hybrid',
    has_firmware: true,
    has_backend: true,
    has_frontend: true,
    has_hardware: true,
    has_mechanical: true,
    certification_regions: ['US', 'EU', 'APAC'],
    target_price_tier: 'premium'
}
```

The Product Owner sets these during project setup. The PRD system reads them from `settingsState.entries.product` and selects templates accordingly.

---

## 3. Template Selection Matrix

| Product Type | Software Templates | Hardware Templates | Business Templates | Integration Templates |
|-------------|-------------------|-------------------|-------------------|---------------------|
| **Pure Software** | Component PRD, API Spec, Architecture, User Stories, Test Strategy | — | Press Release, GTM, Positioning, Messaging | — |
| **Consumer Hardware** | Firmware Spec (if smart), Mobile App (if companion) | Product Spec, BOM, CMF, Packaging, Durability, Certifications | Press Release, GTM, Retailer Briefs, Reviews | HW→SW Constraint Table |
| **Industrial Equipment** | Control Software, HMI Spec, Safety Logic | Equipment Spec, BOM, Tolerances, Safety (SIL), Manufacturing, Serviceability | Channel Strategy, TCO Analysis, Maintenance Contracts | HW→SW Safety Matrix |
| **IoT/Embedded** | Firmware Architecture, Cloud Protocol, OTA, Secure Boot | MCU Selection, Power Budget, RF Spec, Sensor Spec, Antenna Design | Partnership Announcements, Data Privacy Docs | Integration Test Plan |
| **Hybrid (Full Stack)** | ALL software templates | ALL hardware templates | ALL business templates | Cross-Domain Constraint Table |

---

## 4. Hardware-Specific Sections

### 4.1 Mechanical / Industrial Design
- **CMF (Color/Material/Finish):** Target aesthetics, surface treatments
- **Form Factor:** Dimensions, weight, ergonomic requirements
- **Enclosure:** IP rating, sealing, thermal management
- **Connectors:** Types, pinouts, waterproofing

### 4.2 Electrical / RF
- **Power Budget:** Voltage rails, current draws, battery life (if applicable)
- **MCU/Processor:** Selected chipset, clock speed, memory
- **RF Design:** Frequency bands, antenna type, range, protocols (BLE, WiFi, LoRa, etc.)
- **Sensor Array:** What sensors, their specs, sampling rates
- **ESD/EMI Protection:** Requirements and test levels

### 4.3 Bill of Materials (BOM)
- **Hierarchical BOM:** EBOM (engineering) → MBOM (manufacturing) → SBOM (software bill of materials for supply chain security)
- **Cost Targets:** Per-unit cost at various volumes (1K, 10K, 100K, 1M)
- **Approved Vendor List (AVL):** Primary and alternate suppliers
- **Lead Times:** Procurement timelines
- **End-of-Life Monitoring:** Component obsolescence tracking

### 4.4 Certifications & Regulatory
- **Target Certifications:** FCC, CE, UL, CCC, SRRC, ATEX, IEC, etc.
- **Certification Timeline:** When each must be completed
- **Certification Cost:** Budget per certification
- **Test Houses:** Which labs will perform testing
- **Standards Compliance:** ISO, MIL-STD, etc.

### 4.5 Manufacturing & Supply Chain
- **Manufacturing Process:** Assembly sequence, SMT, hand assembly, etc.
- **Tooling:** Mold costs, tooling lead times, cavitation
- **Factory Acceptance Tests (FAT):** What tests happen at the factory
- **Quality Control:** Incoming QC, in-process QC, outgoing QC
- **Supply Chain Risk:** Single-source components, geographic concentration

### 4.6 Safety & Reliability
- **Safety Standards:** IEC 62368, ISO 13849, etc.
- **Fail-Safe Behaviors:** What happens when things go wrong
- **Mean Time Between Failures (MTBF):** Target and calculation method
- **Mean Time To Repair (MTTR):** Target service procedures
- **Environmental Range:** Operating temperature, humidity, shock, vibration

---

## 5. Software-Specific Sections

Already well-covered in D3. Key additions for hardware-software integration:

### 5.1 Firmware Architecture
- **RTOS/Scheduler:** FreeRTOS, Zephyr, bare metal?
- **Memory Map:** Flash layout, RAM allocation
- **Task Breakdown:** What tasks run, their priorities, deadlines
- **Boot Sequence:** Power-on → bootloader → application
- **OTA Strategy:** Over-the-air update mechanism
- **Secure Boot:** Chain of trust, key storage

### 5.2 Communication Protocols
- **Device-to-Device:** BLE Mesh, Zigbee, Thread, proprietary RF
- **Device-to-Cloud:** MQTT, CoAP, HTTP, WebSocket
- **Payload Schemas:** Message formats, compression
- **Latency Requirements:** Real-time vs. best-effort

### 5.3 Hardware-Software Interface
- **Pin Assignment Table:** MCU pin → function → signal direction
- **Register Map:** Memory-mapped peripherals
- **Interrupt Strategy:** Which interrupts, priorities, latencies
- **DMA Channels:** What uses DMA, buffer sizes

---

## 6. Cross-Domain Constraint Table

**The most important integration artifact.** This table shows how decisions in one domain affect all others:

| Hardware Decision | Firmware Impact | Backend Impact | Frontend Impact | Business Impact |
|-------------------|----------------|----------------|-----------------|-----------------|
| MCU has 256KB RAM | Limits task count, buffer sizes | Affects payload size, caching strategy | Affects data freshness, offline mode | Affects cost, competitive positioning |
| BLE 5.0 only (no WiFi) | Simplifies stack, lower power | Requires gateway device for cloud | App must handle intermittent sync | Affects user experience promise |
| Target BOM $12 | Constrains component selection | Affects cloud infrastructure costs | Affects retail price, margin | Affects channel strategy |
| 2-year battery life | Requires aggressive sleep modes | Requires store-and-forward | Minimal UI updates | Key selling point in PR |
| IP67 rating | Affects connector choice, potting | Affects field service data | — | Enables outdoor use cases |

**How the Composition Engine Generates This:**
1. Extract hardware specs from schema cards (if hardware files present)
2. Extract firmware constraints from code analysis
3. Query business ontology for market implications
4. LLM generates the cross-impact narrative
5. Presents as a table in the technical PRD + as talking points in the press release

---

## 7. The "Reality Fabrication" for Hardware

The same "make it real before kickoff" principle applies to hardware, but the artifacts are different:

### For Consumer Products:
- **3D Renders** (if available) or **sketches** uploaded by industrial designer
- **Packaging mockups** showing retail presentation
- **Unboxing experience** description
- **Lifestyle photography concepts** (product in use)
- **Review quotes** from hypothetical reviewers: *"The build quality is exceptional — the aluminum unibody feels like it belongs in a much more expensive product."*

### For Industrial Equipment:
- **Factory floor layout** showing where the equipment fits
- **Operator interface mockups** (HMI screens)
- **Maintenance schedule** and **spare parts list**
- **ROI calculator** showing payback period
- **Case study quotes:** *"After installing the Sled 4.0, our throughput increased 40% while maintenance downtime dropped 60%."*

### For IoT/Embedded:
- **Dashboard mockups** showing data visualization
- **Mobile app screenshots** (if companion app)
- **Network topology diagram**
- **Data flow diagram** from sensor → edge → cloud → user

---

## 8. Hardware PRD Lifecycle Mapping

Hardware has different lifecycle needs than software:

| st8 Phase | Hardware Milestone | PRD Output |
|-----------|-------------------|------------|
| **CONCEPT** | Product idea, market opportunity | Press release draft, opportunity map, rough BOM estimate |
| **LOCKED** | Design freeze, architecture defined | Full PRD package, locked BOM target, certification plan, GTM strategy |
| **WIRING** | Prototype development | Engineering PRDs, prototype test plans, supplier negotiations |
| **DEVELOPMENT** | EVT → DVT → PVT | Engineering change orders, test reports, compliance documentation |
| **PRODUCTION** | Mass production | Factory procedures, QC checklists, packaging specs, launch materials |

**Hardware-specific gates:**
- **EVT Gate (Engineering Verification Test):** Does the prototype function? (WIRING → DEVELOPMENT)
- **DVT Gate (Design Verification Test):** Does it meet all specs? (DEVELOPMENT mid-point)
- **PVT Gate (Production Verification Test):** Can the factory build it consistently? (DEVELOPMENT → PRODUCTION)

---

## 9. Settings Integration

Using `settings-ui.js`, the hardware-software bridge is configured in the `product` category:

```javascript
// DEFAULT_SETTINGS addition:
product: {
    // Classification
    product_type: 'hybrid',
    
    // Software flags
    has_firmware: true,
    has_backend: true,
    has_frontend: true,
    has_mobile_app: true,
    
    // Hardware flags
    has_mechanical: true,
    has_electrical: true,
    has_rf: true,
    
    // Market
    target_market: 'consumer_electronics',
    target_price: 1299,
    target_margin: 2.0,
    target_regions: ['US', 'EU', 'APAC'],
    
    // Certifications
    required_certifications: ['FCC', 'CE', 'RoHS'],
    target_certification_date: '2026-12-01',
    
    // Manufacturing
    target_volume_first_year: 50000,
    target_bom_cost: 350,
    manufacturing_region: 'Shenzhen'
}
```

All of these fields are **automatically rendered as form inputs** by `settings-ui.js` and **automatically persisted** via `/api/settings`.

The composition engine reads these values and injects them into templates:
- `{{product.target_price}}` → `$1,299` in press release
- `{{product.target_margin}}` → `2x` in financial projections
- `{{product.target_regions}}` → `US, EU, APAC` in GTM plan

---

## 10. Multi-Domain Stakeholder Support

The stakeholder interview system must support personas that don't exist in pure-software PRD systems:

### New Stakeholder Personas:
- **Electrical Engineer:** Talks about chipsets, power budgets, signal integrity
- **Mechanical Engineer:** Talks about materials, tolerances, thermal management, CMF
- **Firmware Engineer:** Talks about RTOS, memory constraints, real-time requirements
- **Manufacturing/Tooling Engineer:** Talks about mold costs, assembly sequences, QC
- **Procurement:** Talks about AVL, lead times, volume pricing
- **Regulatory Affairs:** Talks about certifications, standards, compliance
- **Industrial Designer:** Talks about form factor, user interaction, aesthetics
- **Packaging Engineer:** Talks about unboxing, retail presentation, shipping

### Persona-Specific Interview Questions:

**Electrical Engineer:**
- "What's the most exciting chipset or component you've been wanting to use?"
- "What's your power budget sweet spot for this class of product?"
- "Any RF or signal integrity concerns we should architect around?"

**Mechanical Engineer:**
- "What materials would make this product feel premium at the target price?"
- "What manufacturing process do you think is most appropriate for the volume?"
- "What environmental conditions must this survive?"

**Firmware Engineer:**
- "What's your preferred RTOS or bare-metal approach?"
- "What's the memory and processing headroom you need?"
- "How do you want to handle OTA updates and secure boot?"

**Manufacturing Engineer:**
- "What's your target cycle time per unit?"
- "What tests should happen on the line vs. in the lab?"
- "What's your biggest concern about scaling to volume?"

---

## 11. BOM Integration with Schema Cards

For hardware projects, the file registry can track hardware files:
- `.kicad_pcb` → Electrical design
- `.step`, `.stl` → Mechanical models
- `.csv`, `.xlsx` → BOM spreadsheets
- `.pdf` → Datasheets, spec sheets

The schema card for a BOM file:
```json
{
    "filepath": "hardware/BOM-v1.xlsx",
    "fingerprint": "hardware/BOM-v1.xlsx||1683745598",
    "intent": {
        "purpose": "Bill of Materials for premium headphone",
        "valueStatement": "Tracks all components, costs, and suppliers"
    },
    "exports": [
        { "kind": "BOM", "name": "Headphone_BOM", "total_cost": 347.50 }
    ],
    "lifecyclePhase": "LOCKED",
    "status": "GREEN"
}
```

The composition engine reads this and generates:
- BOM table in the hardware PRD
- Cost analysis in the financial projections
- Supplier list for procurement stakeholder interview prep

---

## 12. Summary

The hardware-software bridge is achieved through:

1. **Product Type Detection** — classify the project based on files, stakeholders, and settings
2. **Domain-Aware Templates** — select the right template set for the product type
3. **Cross-Domain Constraint Tables** — show how decisions in one domain affect others
4. **Hardware-Specific Sections** — BOM, certifications, manufacturing, safety
5. **Hardware-Specific Stakeholders** — interview personas for ME, EE, firmware, manufacturing
6. **Hardware Lifecycle Gates** — EVT, DVT, PVT mapped to st8 phases
7. **Settings-Driven Configuration** — product profile in `settings-ui.js`
8. **Schema Card Integration** — hardware files get cards too, feeding the composition engine

**The key insight:** st8's universal schema card system doesn't care if a file is `.vue` or `.kicad_pcb`. The composition engine doesn't care if it's generating a press release or a certification tracker. The stakeholder interview system doesn't care if it's talking to a frontend developer or a mechanical engineer. **The architecture is universal; the content is domain-specific.**

---

**Research Sources:**
- W1-09: Hardware PRD analysis (Walley RLC, Sled 4.0, BLE Mesh Hub)
- W2-06: Hardware PRD best practices (external research)
- W2-08: PRD package formats
- FOUNDER-VISION.md: Cross-department alignment
