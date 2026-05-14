# Hardware PRD Patterns Research Report

**Research Agent:** Domain Research Agent (st8 PRD System)  
**Date:** 2026-05-13  
**Sources:** Smart Home PM GitHub repo (xgpeter/smart-home-pm), Visure Solutions PLM Guide, D2M Product Design, TechInsights BOM Database, Z2Data, EE Times, Wikipedia, industry standards documentation  
**Scope:** Hardware and product PRD frameworks for premium consumer electronics, industrial manufacturing equipment, and IoT/hardware-software integrated products

---

## Executive Summary

Hardware PRDs differ fundamentally from software PRDs because hardware decisions are largely irreversible once tooling and procurement commitments are made. Where a software PRD can be revised with a deployment, a hardware PRD mistake can cost ¥50,000+ in mold rework and months of schedule delay. This research identifies the structural patterns, stakeholder workflows, and domain-specific requirements that the st8 PRD system must support to generate effective hardware PRDs across consumer electronics, industrial equipment, and integrated IoT products.

---

## 1. Hardware-Specific PRD Sections Not Found in Software PRDs

### 1.1 Materials and Standards
Hardware PRDs must specify material grades, compositions, and allowable substitutions with direct references to standards:

- **Material Specifications:** Stainless steel grade 316L (yield strength ≥ 170 MPa, per ASTM A240), galvanized steel sheet (ASTM A653, coating G90), zinc alloy panels, polymer grades
- **Tolerances:** Permissible dimensional deviations (e.g., ±1.5 mm for duct dimensions, ±0.1mm for PCB placement)
- **Finishes:** Surface treatments, coatings, corrosion protection, powder coating specifications, anodizing grades
- **Environmental Adaptability:** Operating temperature ranges (-25°C ~ 55°C), storage temperatures, humidity ratings (40°C/93%RH), IP ratings (IP53, IP65)

### 1.2 Mechanical and Structural Specifications
- **Dimensions and Geometry:** Exact measurements, weight, space requirements, PCB dimensions, mounting holes
- **Industrial Design Constraints:** Form factor, ergonomic factors, aesthetic direction (sleek vs. rugged), brand-aligned design language
- **Assembly and Integration:** Connector types (FPC, BTB, pin headers), cable routing, modular assembly sequences
- **Mechanical Durability:** Drop tests (1m free fall), vibration resistance, key/button lifecycle (200,000 presses), motor lifecycle (100,000 cycles)

### 1.3 Electrical and RF Specifications
- **Power Architecture:** Power trees, voltage rails (3.3V, 5V, 1.8V), battery configurations, charging circuits
- **Power Budgets:** Deep sleep current (≤ 80μA), active mode current, daily power consumption models, battery life calculations
- **RF Design:** Antenna types (PIFA PCB, ceramic, external), frequency ranges, gain requirements (≥ 2dBi), VSWR (≤ 2.0), clearance zones (≥ 5mm)
- **EMC/EMI:** ESD protection (contact ±8KV, air ±15KV per IEC 61000-4-2), radiated emissions limits, conducted immunity

### 1.4 Bill of Materials (BOM)
The BOM is a foundational hardware PRD element with no software equivalent. It includes:
- **Component List:** Every part, material, sub-assembly with quantities
- **Part Numbers:** Unique identifiers for each component
- **Approved Vendor List (AVL):** Qualified suppliers for each component
- **Cost Breakdown:** Component-level pricing, target COGS (Cost of Goods Sold), margin analysis
- **Lifecycle Status:** Component obsolescence tracking, EOL (End of Life) dates
- **Alternates and Substitutes:** Second-source options for supply chain resilience
- **BOM Types:** Engineering BOM (EBOM), Manufacturing BOM (MBOM), Service BOM (SBOM)

### 1.5 Manufacturing Specifications
- **Production Processes:** Tooling requirements (injection molds, die-casting), assembly line setup, soldering methods
- **Production Volume:** MOQ (Minimum Order Quantity) targets, ramp-up curves, capacity planning
- **Quality Control:** Factory Acceptance Tests (FAT), inspection procedures, acceptance criteria, defect rate targets (PPM)
- **Factory Testing:** Production test sequences (burn-in, functional test, RF calibration), pass/fail criteria, test fixture requirements
- **Packaging and Logistics:** Packaging specifications, labeling, handling instructions, shipping requirements

### 1.6 Certification and Regulatory Compliance
Hardware PRDs require dedicated certification sections tracking:
- **Regional Certifications:** CCC (China), SRRC (radio), FCC (US), CE (EU), UL/ETL (safety), UKCA (UK), PSE (Japan), KC (Korea)
- **Environmental Compliance:** RoHS, REACH, WEEE, Energy Star, China能效标识
- **Industry-Specific Certifications:** GA 374 (electronic locks), GB 4943.1 (AV/IT safety), GB 4706.1 (household appliance safety)
- **Alliance Certifications:** Matter, Zigbee Certified, Works with Alexa, Made for Google, Apple HomeKit, Z-Wave Plus
- **Data Privacy:** PIPL (China), GDPR (EU), cybersecurity等级保护
- **Certification Timeline:** SRRC 4-8 weeks, CCC 6-12 weeks, FCC 4-6 weeks, CE 4-6 weeks, Matter 8-12 weeks
- **Cost Tracking:** FCC ($3K-15K), UL ($10K-50K), CE (€2K-10K)

### 1.7 Supply Chain and Procurement
- **Supplier Qualification:** Vendor assessment, factory audits, quality agreements
- **Lead Times:** Component procurement timelines, long-lead items identification
- **Supply Chain Risk:** Single-source components, geographic concentration, geopolitical exposure
- **Cost Targets:** Per-category cost budgets, target COGS, retail price positioning, margin requirements

### 1.8 Safety and Physical Security
- **Physical Safety:** Fire resistance, electrical shock protection, mechanical pinch points, chemical safety
- **Security Features:** Tamper detection, secure boot, hardware security modules (ATECC608A), anti-cloning
- **Fail-Safe Behavior:** Power-loss behavior, emergency overrides (mechanical keys), degradation modes

---

## 2. Consumer vs. Industrial Hardware PRDs

### 2.1 Consumer Product PRD Characteristics
Consumer electronics PRDs prioritize user experience, aesthetics, cost optimization, and time-to-market:

| Dimension | Consumer Product PRD |
|-----------|---------------------|
| **Primary Focus** | User experience, aesthetics, brand differentiation |
| **Cost Sensitivity** | High — BOM cost directly impacts retail competitiveness |
| **Target Retail Margin** | Typically 30-50% gross margin |
| **Aesthetics** | Critical — finish quality, color, texture, form factor |
| **Ergonomics** | User-centric design for untrained operators |
| **Environmental Range** | Moderate (indoor use, -10°C to 45°C typical) |
| **Lifecycle** | 2-5 years typical, trend-driven obsolescence |
| **Certifications** | FCC, CE, CCC, RoHS, energy efficiency |
| **BOM Complexity** | High component count, miniaturization demands |
| **Supply Chain** | Global sourcing, cost-optimized, JIT manufacturing |
| **Failure Tolerance** | Consumer-grade, RMA/return processes |
| **Documentation** | User manuals, quick-start guides, App integration |

**Example:** A smart door lock PRD (from xgpeter/smart-home-pm) includes biometric UX targets (fingerprint ≤ 1.0s), App ecosystem integration (米家 + HomeKit), BOM cost target (¥253 at 10K volume), and consumer-facing features like temporary passwords and scene联动.

### 2.2 Industrial Equipment PRD Characteristics
Industrial equipment PRDs prioritize reliability, safety, compliance, maintainability, and total cost of ownership:

| Dimension | Industrial Equipment PRD |
|-----------|-------------------------|
| **Primary Focus** | Reliability, safety, uptime, compliance |
| **Cost Sensitivity** | Total Cost of Ownership (TCO) including maintenance |
| **Target Margin** | Often lower hardware margin, higher service revenue |
| **Aesthetics** | Functional, ruggedized, often secondary to performance |
| **Ergonomics** | Operator safety, reduced fatigue for 8+ hour shifts |
| **Environmental Range** | Extreme (-40°C to 70°C, dust, moisture, vibration) |
| **Lifecycle** | 10-20 years, long-term spare parts availability |
| **Certifications** | UL, CSA, IEC, ISO (safety-critical), ATEX (explosive atmospheres), SIL (functional safety) |
| **BOM Complexity** | Lower component count but higher durability requirements |
| **Supply Chain** | Qualified suppliers, long-term agreements, regional sourcing |
| **Failure Tolerance** | Minimal — downtime can cost $100K+/hour |
| **Documentation** | Maintenance manuals, spare parts lists, service BOMs, MTBF/MTTR data |

**Additional Industrial-Specific Sections:**
- **Ruggedization:** Vibration resistance (MIL-STD-810), shock resistance, ingress protection (IP67+), chemical resistance
- **Functional Safety:** SIL (Safety Integrity Level) ratings, fail-safe architectures, emergency stop systems, interlocks
- **Maintainability:** MTBF (Mean Time Between Failures), MTTR (Mean Time To Repair), modular replacement design, diagnostic systems
- **Operational Requirements:** 24/7 operation cycles, duty cycles, load capacities, efficiency ratings
- **Installation Requirements:** Foundation specs, utility connections (power, air, coolant), facility integration
- **Training Requirements:** Operator certification, maintenance training programs
- **Warranty and Service:** Extended warranty terms, SLA (Service Level Agreement) commitments, field service requirements

### 2.3 Key Differences Summary

| Aspect | Consumer | Industrial |
|--------|----------|------------|
| **Design Driver** | User desire / market trend | Operational necessity / safety regulation |
| **Decision Reversibility** | Low (mold rework ¥50K+) | Very low (custom tooling, regulatory re-certification) |
| **Testing Focus** | UX, compatibility, aesthetics | Safety, reliability, environmental stress |
| **Regulatory Driver** | Market access (FCC/CE) | Operational safety (UL/IEC/SIL) |
| **Stakeholder Primary** | Industrial designers, UX engineers | Mechanical engineers, safety officers, maintenance teams |
| **Iteration Model** | Annual model updates | 10+ year platform lifecycles |
| **Cost Tracking** | BOM to retail price | TCO including installation, operation, maintenance |

---

## 3. Hardware-Software Integration PRDs (IoT, Embedded Systems)

### 3.1 The Integrated PRD Structure
IoT and embedded products require a hybrid PRD that tightly couples hardware constraints with software capabilities. The smart-home-pm repository demonstrates a 16-chapter PRD structure that goes far beyond traditional software PRDs:

**Chapters 1-11:** Standard software PRD elements (product overview, functional requirements, user flows, data needs, risks)

**Chapters 12-16:** Hardware-specific extensions:
- **Chapter 12 — Hardware Spec:** MCU selection, peripheral selection, power budgets, RF design, mechanical constraints, BOM cost framework, certifications
- **Chapter 13 — Communication Protocol:** Thing model definitions, MQTT topics, payload formats, security design
- **Chapter 14 — Firmware Architecture:** RTOS selection, flash partitioning, task allocation, state machines, low-power strategy, OTA upgrades, secure boot, factory testing
- **Chapter 15 — Testing Strategy:** Hardware reliability tests (temperature, drop, ESD, aging), firmware tests, App compatibility, communication stability, security penetration
- **Chapter 16 — Mass Production & After-sales:** Factory testing schemes, packaging lists, after-sales diagnostics, return/repair processes

### 3.2 Hardware-Software Coupling Points
Integration PRDs must explicitly document constraint flows between domains:

| Hardware Constraint | Software Impact |
|--------------------|-----------------|
| Battery-powered (sleep ≤ 80μA) | Connection strategy (WiFi only on-demand), BLE broadcast duty cycling, cloud sync intervals |
| SRAM ≤ 520KB | Task stack budgets, buffer sizes, algorithm memory footprint |
| Flash 16MB with A/B partitions | OTA package size limits, feature modularity, rollback capabilities |
| Secure chip (ATECC608A) | Key management architecture, certificate pinning, device attestation |
| Fingerprint sensor (SPI@8MHz) | Driver priority, interrupt handling, enrollment flow timing |
| Motor torque ≥ 2.5 N·m | Lock state machine, jam detection algorithm, retry policies |
| RF module pre-certified (SRRC) | Antenna selection locked, transmit power capped at 20dBm, no RF protocol modifications |

### 3.3 Cross-Domain Stakeholder Alignment
The PRD must serve as a single source of truth for:
- **Hardware Engineers:** Schematic design, layout, component selection
- **Firmware Engineers:** Driver development, RTOS configuration, memory maps, power state machines
- **Cloud Engineers:** MQTT topic design, device shadow schemas, OTA distribution
- **App Engineers:** Feature availability based on hardware capability, offline behavior
- **Test Engineers:** HIL (Hardware-in-Loop) test scenarios, environmental chamber profiles
- **Manufacturing Engineers:** Production test sequences, calibration procedures, yield targets

### 3.4 Key Insight: Irreversibility Multiplier
The smart-home-pm template emphasizes: *"Software PRDs can be vague — wrong can be fixed. Hardware PRDs must be precise because hardware decisions are irreversible. Hardware-related functional decisions require 3x the validation time."*

---

## 4. BOM and Cost Analysis Representation

### 4.1 BOM Structure in Hardware PRDs
A hardware PRD BOM is hierarchical and multidimensional:

**Engineering BOM (EBOM):**
- Design-intent view created by engineers
- Reflects functional groupings (MCU subsystem, power subsystem, sensor subsystem)
- Includes reference designators, part numbers, descriptions, quantities

**Manufacturing BOM (MBOM):**
- Production view created by manufacturing engineers
- Adds packaging, consumables, assembly aids, tooling
- Includes work center assignments, assembly sequences

**Service BOM (SBOM):**
- Maintenance view for repair and spare parts
- Identifies field-replaceable units (FRUs)
- Links to service manuals and diagnostic procedures

### 4.2 Cost Framework Representation
From the smart door lock example PRD:

| Category | Components | Cost (¥) | Share |
|----------|-----------|----------|-------|
| Main Control + Wireless | ESP32-S3, crystal, antenna | 15-25 | 15% |
| Sensors | Fingerprint, touch, Hall | 30-60 | 35% |
| Power | Battery, BMS, LDO, boost | 20-40 | 20% |
| Electromechanical | Motor, lock body, springs | 30-50 | 20% |
| PCB + Connectors | 4-layer board, FPC, BTB | 10-20 | 10% |
| **Total** | | **105-195** | |

**Detailed 10K Volume BOM Example (Smart Lock):**
| Category | Components | Cost (¥) |
|----------|-----------|----------|
| Main Control + Flash + Security | ESP32-S3 + W25Q128 + ATECC608A | 28 |
| Biometrics | Fingerprint module + dual-camera | 75 |
| Power | Li battery + BMS + Buck + Boost + charging IC | 45 |
| Electromechanical | Motor + lock body + springs + reducer | 55 |
| Structure | Zinc alloy panel + acrylic + silicone | 35 |
| PCB + Connectors | 4-layer board + FPC + BTB | 15 |
| **Total** | | **≈ 253** |

### 4.3 Cost Management Practices
- **Target Costing:** Set retail price first, derive target BOM cost (typically retail ÷ 3 to ÷ 5 for electronics)
- **Should-Cost Analysis:** Estimate what a component "should" cost based on materials, labor, overhead
- **Volume Pricing Tiers:** BOMs include pricing at 1K, 10K, 100K volumes
- **Currency and Tariff Tracking:** Multi-currency BOMs with tariff exposure analysis
- **Cost Reduction Roadmap:** Planned VAVE (Value Analysis/Value Engineering) activities, component substitution timelines

### 4.4 Advanced BOM Intelligence
Modern BOM management (per TechInsights and Z2Data) includes:
- **Component Risk Scoring:** Obsolescence risk, supply chain concentration, geopolitical exposure
- **Lifecycle Forecasting:** Predicting EOL dates with 90%+ accuracy
- **Cross-Reference Recommendations:** Suggesting pin-compatible alternatives
- **Real-Time Pricing:** Dynamic updates from distributor APIs
- **Compliance Tracking:** RoHS, REACH, conflict minerals status per component

---

## 5. Regulatory and Certification Requirements

### 5.1 Certification Taxonomy
Certifications are tracked in hardware PRDs by market, product type, and risk level:

**China Market (Mandatory):**
| Certification | Scope | Timeline | Cost |
|--------------|-------|----------|------|
| CCC | Security cameras, smart locks, power adapters | 6-12 weeks | Medium |
| SRRC | All devices with WiFi/BLE/Zigbee/Thread/4G/5G | 4-8 weeks | Low |
| CTA | Cellular CPE/gateways | 4-8 weeks | Medium |
| China Energy Label | Air conditioners, refrigerators, washers | 2-4 weeks | Low |
| GA 374 | Electronic anti-theft locks (industry mandatory) | Variable | Medium |

**North America:**
| Certification | Scope | Timeline | Cost |
|--------------|-------|----------|------|
| FCC | All radio-emitting devices | 4-6 weeks | $3K-15K |
| UL | Safety-critical electrical equipment | 8-12 weeks | $10K-50K |
| ETL | Appliance safety (UL alternative) | 6-8 weeks | $8K-30K |
| Energy Star | Energy-efficient appliances | 4-6 weeks | $5K-10K |

**Europe:**
| Certification | Scope | Timeline | Cost |
|--------------|-------|----------|------|
| CE | All products (mandatory) | 4-6 weeks | €2K-10K |
| RoHS | Hazardous substance restriction | 2-4 weeks | Bundled with CE |
| REACH | Chemical registration | 4-8 weeks | €3K-8K |
| UKCA | UK market entry (CE replacement) | 4-6 weeks | £2K-8K |
| WEEE | E-waste recycling compliance | 2 weeks | Registration fee |

**Industry Alliance Certifications:**
| Certification | Organization | Products |
|--------------|-------------|----------|
| Matter | CSA Alliance | Cross-brand interoperable smart home devices |
| Zigbee Certified | CSA Alliance | Zigbee 3.0 compatible devices |
| Works with Alexa | Amazon | Voice-controlled devices |
| Made for Google | Google | Google Home compatible devices |
| Apple HomeKit | Apple | Apple ecosystem devices |
| Z-Wave Plus | Z-Wave Alliance | Z-Wave compatible devices |
| Thread Certified | Thread Group | Thread protocol devices |

### 5.2 Tracking Certification in PRDs
Hardware PRDs track certification as a first-class project workstream:

```
Certification Workstream:
├── Product Definition Phase: Identify target markets → List required certifications
├── Design Phase: Key component selection confirming existing certifications (e.g., pre-certified WiFi modules)
├── Engineering Sample Phase: Pre-testing → Issue remediation
├── Pilot Production Phase: Formal submission → Certificate acquisition
├── Mass Production Phase: Conformance checks → Label application
└── Post-Market: Factory audits (CCC), certificate maintenance, standard updates
```

**Critical Rules (from smart-home-pm certification guide):**
1. **Certification comes first, not after** — RF/EMC issues must be resolved at PCB design stage, not after test reports fail
2. **Module reuse reduces cost** — Selecting WiFi/BLE modules already FCC/CE/SRRC certified can exempt entire device from radio testing
3. **Certification timelines are hard constraints** — SRRC takes 4-8 weeks regardless of "urgency"
4. **Post-market surveillance is real** — CCC requires annual factory audits; first failure suspends certificate

### 5.3 Data Privacy and Cybersecurity Compliance
Modern hardware PRDs must also track:
- **PIPL (China):** Minimally necessary data collection, standalone consent, data localization
- **GDPR (EU):** Cross-border data transfer mechanisms, right to deletion
- **Cybersecurity Level Protection (等保2.0):** Cloud platform/App system classification
- **IoT Security Standards:** GB/T 36951 (perception terminal security), GB/T 37044 (IoT security reference model)

---

## 6. Manufacturing Specifications

### 6.1 Tooling and Production Setup
Hardware PRDs specify production infrastructure requirements:
- **Molds and Dies:** Injection molding tooling (¥50K-500K+), die-casting dies, stamping tools
- **PCB Fabrication:** Layer count (2-layer to 12-layer+), via types, impedance control, surface finish (HASL, ENIG, OSP)
- **Assembly:** SMT line capabilities (0201 components, BGA pitch), through-hole requirements, conformal coating
- **Test Fixtures:** ICT (In-Circuit Test) fixtures, functional test jigs, RF calibration stations

### 6.2 Production Volume Planning
- **Prototype:** 5-50 units (3D prints, hand assembly)
- **Engineering Validation (EVT):** 50-200 units (design validation)
- **Design Validation (DVT):** 200-500 units (certification samples, reliability testing)
- **Production Validation (PVT):** 500-2000 units (pilot run, process validation)
- **Mass Production (MP):** 10K-1M+ units depending on market

### 6.3 Assembly Processes
- **Work Instructions:** Step-by-step assembly sequences, torque specifications, adhesive curing profiles
- **Quality Gates:** Incoming QC, in-process inspection, final functional test, outgoing audit
- **Traceability:** Serial number assignment, component lot tracking, test data logging
- **Packaging:** ESD-safe packaging, moisture barrier bags, desiccant, custom retail packaging

### 6.4 Factory Acceptance Testing (FAT)
The PRD defines production test protocols:

**Example Smart Lock Factory Test (from xgpeter/smart-home-pm):**
| Test Item | Method | Pass Criteria |
|-----------|--------|---------------|
| Peripheral I2C Scan | Scan I2C bus | Fingerprint/touch/security chip/camera all ACK |
| Fingerprint Module | Standard fake finger image acquisition | No dead pixels, contrast ≥ 50 |
| Camera | Standard test chart photo | Resolution/distortion qualified |
| Motor | Forward/reverse 3 cycles each | Current ≤ 500mA (no load) |
| LED/Buzzer | GPIO sequential activation | Color/volume normal |
| WiFi Fixed Frequency | Spectrum analyzer transmit power | 18 ± 2dBm |
| MAC/SN Write | Burn unique serial number | Read-back verification passed |
| Complete Lock/Unlock Cycle | One complete unlocking cycle | Motor normal, bolt position correct |

---

## 7. Stakeholder Differences in Hardware PRDs

### 7.1 Hardware PRD Stakeholder Map

| Stakeholder | Primary Concerns | PRD Sections They Own/Review |
|-------------|-----------------|------------------------------|
| **Mechanical Engineers** | Dimensions, tolerances, materials, structural integrity, thermal management, assembly feasibility | Mechanical structure, environmental adaptability, packaging |
| **Electrical Engineers** | Schematic design, signal integrity, power distribution, EMI/EMC, component selection | Power architecture, RF design, sensor interfaces, ESD protection |
| **Firmware Engineers** | Resource constraints, real-time performance, power state machines, OTA, security | Flash/memory layout, task allocation, state machines, communication protocols |
| **Manufacturing Engineers** | DFM (Design for Manufacturing), DFA (Design for Assembly), yield optimization, test coverage | Manufacturing specs, test protocols, tooling requirements, MBOM |
| **Procurement/SCM** | Cost targets, supplier qualification, lead times, MOQ, supply chain risk | BOM, AVL, alternate components, cost framework |
| **Regulatory/Compliance** | Certification requirements, safety standards, data privacy, environmental regulations | Certification roadmap, compliance checklists, test standards |
| **Industrial Designers** | Aesthetics, user interaction, form factor, CMF (Color/Material/Finish) | Aesthetic direction, UX flows, ergonomic requirements |
| **Quality Assurance** | Reliability targets, defect rates, test coverage, traceability | Test strategy, acceptance criteria, reliability specs |
| **Sales/Marketing** | Feature differentiation, pricing, competitive positioning, channel requirements | Product overview, competitive analysis, target retail price |
| **After-Sales Service** | Repairability, spare parts availability, diagnostic capability, warranty costs | Service BOM, diagnostic design, FRU identification |

### 7.2 Review Workflow
Hardware PRDs require structured cross-functional review:
1. **Concept Review:** Industrial design + marketing + PM align on product direction
2. **Technical Feasibility Review:** Hardware + firmware + cloud engineers validate architecture
3. **Design Review:** All engineering disciplines review detailed specs before EVT
4. **Manufacturing Readiness Review:** Manufacturing + procurement + quality review DFM/DFA
5. **Certification Readiness Review:** Regulatory + hardware + test engineers confirm test plans
6. **Production Readiness Review:** Full stakeholder review before PVT

### 7.3 Approval Authority Matrix
| Decision | Approvers |
|----------|-----------|
| MCU/platform selection | Hardware Lead + Firmware Lead + Procurement |
| BOM cost target exceed | PM + Hardware Lead + Supply Chain Manager |
| Certification scope change | Regulatory Lead + PM + Sales |
| Manufacturing process change | Manufacturing Lead + Quality Lead + Hardware Lead |
| Mold/tooling investment | PM + Finance + Manufacturing Director |

---

## 8. Specific Recommendations for st8

### 8.1 Template Architecture
st8 should implement a **modular, composable PRD template system** rather than a single monolithic template:

**Base Template (Software + Hardware Common):**
- Document information
- Product overview and goals
- Target users and personas
- Scope boundaries (must include "non-goals")
- Functional requirements with acceptance criteria
- Non-functional requirements
- User flows and journey maps
- Data requirements
- Risk and dependency tracking
- Version planning and milestones

**Hardware Extension Modules (selectively appended):**
- **Module H1 — Mechanical Specifications:** Dimensions, tolerances, materials, finishes, structural requirements
- **Module H2 — Electrical & RF Specifications:** Power architecture, power budgets, RF design, antenna requirements, EMC
- **Module H3 — BOM & Cost Framework:** Hierarchical BOM (EBOM/MBOM/SBOM), cost targets, AVL, alternate tracking
- **Module H4 — Manufacturing Specs:** Production volume plans, assembly processes, tooling requirements, test protocols, packaging
- **Module H5 — Certification & Compliance:** Regional certification matrices, timelines, costs, compliance standards tracking
- **Module H6 — Supply Chain:** Supplier qualification, lead times, risk assessment, procurement strategy
- **Module H7 — Safety & Security:** Physical safety requirements, hardware security architecture, fail-safe behaviors

**IoT/Integration Extension Modules:**
- **Module I1 — Hardware Spec:** MCU selection, peripheral table, pin assignments, resource budgets
- **Module I2 — Communication Protocol:** Thing models, MQTT topics, payload schemas, security design
- **Module I3 — Firmware Architecture:** RTOS selection, memory maps, task allocation, state machines, OTA, low-power strategy
- **Module I4 — Integration Test Strategy:** Hardware-in-loop testing, communication stability, cross-domain regression

### 8.2 Domain-Specific Defaults
st8 should apply different defaults based on product type:

| Product Type | Default Modules | Key Defaults |
|-------------|-----------------|--------------|
| **Pure Software** | Base only | Agile sprints, deployment pipelines, no hardware sections |
| **Consumer Electronics** | Base + H1-H7 + I1-I4 (as needed) | FCC/CE default, cost-focused BOM, UX-driven priorities |
| **Industrial Equipment** | Base + H1-H7 (heavy emphasis on H4, H5, H7) | UL/IEC default, TCO analysis, reliability-focused, 10+ year lifecycle |
| **IoT/Smart Device** | Base + All Integration Modules | Dual hardware-software spec, certification-heavy, power budget critical |
| **Premium/Lifestyle Product** | Base + H1-H3 + heavy H1 aesthetics | CMF specifications, brand alignment, premium material focus |

### 8.3 Data Structure Recommendations

**BOM as First-Class Entity:**
```yaml
bom:
  version: "1.2"
  type: "EBOM"  # EBOM | MBOM | SBOM
  target_volume: "10K"
  currency: "CNY"
  total_target_cost: 253
  categories:
    - name: "Main Control"
      target_cost_range: [15, 25]
      components:
        - part_number: "ESP32-S3-WROOM-1"
          description: "WiFi+BLE dual-core MCU module"
          manufacturer: "Espressif"
          avl: ["DigiKey", "Mouser", "立创商城"]
          unit_cost: 28
          qty: 1
          lifecycle_status: "Active"
          alternates: ["ESP32-S3-WROOM-1-N16R8"]
          certifications: ["FCC", "CE", "SRRC"]
```

**Certification Tracker:**
```yaml
certifications:
  - name: "CCC"
    region: "China"
    scope: "Security camera, smart lock"
    authority: "CQC"
    timeline_weeks: [6, 12]
    cost_usd: 5000
    status: "Planned"
    dependencies: ["Engineering samples", "Factory audit"]
    critical_path: true
```

**Power Budget Model:**
```yaml
power_budget:
  battery_type: "Li-ion 3.7V 10000mAh"
  deep_sleep_ua: 50
  modes:
    - name: "Deep Sleep"
      current_ua: 50
      duration_hours: 23.5
      daily_mah: 1.18
    - name: "WiFi Connected"
      current_ma: 120
      duration_hours: 0.3
      daily_mah: 36.0
  total_daily_mah: 39.1
  target_battery_life_months: 12
```

### 8.4 Prompt Engineering Recommendations
To generate high-quality hardware PRDs, st8 should:

1. **Elicit Hardware-Specific Context Early:**
   - "Is this a battery-powered or mains-powered device?"
   - "What is your target retail price and volume?"
   - "Which markets will this launch in?"
   - "Are there pre-certified modules you prefer?"

2. **Surface Irreversibility Warnings:**
   - Flag decisions that lock in mold costs, RF certification, or component supply chains
   - Require confidence levels (%) on hardware decisions
   - Suggest prototyping and validation gates before tooling commitment

3. **Generate Cross-Domain Constraint Tables:**
   - Automatically produce hardware→software constraint matrices
   - Highlight resource conflicts (e.g., GPIO shortages, memory overruns)

4. **Include Certification Timeline Integration:**
   - Automatically add certification milestones to project timelines
   - Warn when hardware decisions invalidate pre-certified module assumptions

5. **Support Multi-Currency, Multi-Volume BOMs:**
   - Generate BOMs at 1K/10K/100K pricing tiers
   - Track cost as design evolves
   - Flag when components exceed category budgets

### 8.5 Quality Checklist for Hardware PRDs
st8 should enforce hardware-specific PRD completeness:

- [ ] BOM present with component-level detail
- [ ] Target COGS specified and aligned with retail pricing strategy
- [ ] Power budget calculated (for battery-powered devices)
- [ ] Certification roadmap with timelines and costs
- [ ] Manufacturing test protocol defined
- [ ] Environmental operating range specified
- [ ] Safety and fail-safe behaviors documented
- [ ] Supply chain risk assessment (single-source components identified)
- [ ] Mechanical constraints documented (if applicable)
- [ ] RF design requirements specified (if wireless)
- [ ] Firmware memory/flash budget aligned with hardware selection
- [ ] Factory acceptance test criteria defined
- [ ] Packaging and logistics requirements included
- [ ] After-sales service and diagnostic capability addressed

---

## 9. Key Research Findings

1. **Hardware PRDs require 16+ chapters vs. 8-10 for software PRDs.** The additional chapters cover hardware specs, communication protocols, firmware architecture, testing strategies, and mass production — areas with no software equivalent.

2. **BOM is the central artifact of hardware PRDs.** Unlike software where dependencies are npm packages, hardware dependencies are physical components with lead times, MOQs, lifecycle statuses, and geopolitical risks. The BOM must be a living document updated throughout the product lifecycle.

3. **Certification is a project workstream, not a checkbox.** Hardware PRDs must treat certification with the same rigor as feature development — with timelines, costs, dependencies, and risk mitigation. A single certification failure can delay launch by 2-3 months.

4. **Consumer and industrial PRDs diverge significantly.** Consumer PRDs optimize for UX, aesthetics, and cost-to-retail. Industrial PRDs optimize for safety, reliability, maintainability, and TCO. st8 must support both paradigms with appropriate defaults and emphasis.

5. **IoT PRDs are essentially three PRDs in one.** They must simultaneously specify hardware constraints, firmware architecture, and cloud/software behavior, with explicit traceability between domains. A change in MCU selection can invalidate MQTT topic design; a change in cloud protocol can require firmware memory reallocation.

6. **Manufacturing specifications are design inputs, not afterthoughts.** DFM/DFA considerations must be included in the PRD before EVT. Reworking a design for manufacturability after tooling is cut is exponentially more expensive than designing for manufacture from the start.

7. **Stakeholder diversity is higher in hardware.** A software PRD primarily serves engineering and product. A hardware PRD serves mechanical, electrical, firmware, manufacturing, procurement, regulatory, quality, sales, and after-sales teams — each with distinct information needs and approval authority.

---

## Appendix: Source Documents

1. **xgpeter/smart-home-pm** (GitHub, 2026-05-12) — Smart Home Product Manager skill with 16-chapter PRD template, hardware spec template, certification guide (40+ standards), and complete smart door lock PRD example
2. **Visure Solutions — "How to Write Mechanical Specifications"** (2026-04-24) — Comprehensive mechanical specification writing guide covering ASME, ISO, ASTM, ANSI standards
3. **D2M Product Design — "Product Design Specification: What It Is, Why It Matters & How to Write One"** (2023-11-08) — PDS fundamentals with 8 requirements framework
4. **TechInsights — BOM Database** (2026-02-20) — Consumer electronics teardown BOM data and cost analysis
5. **Z2Data — "What Is a BOM in Electronics Design and Manufacturing?"** (2026-04-30) — Electronics BOM types, AVL, lifecycle management
6. **Wikipedia — "Product Requirements Document," "Design Specification," "Bill of Materials"** — Foundational definitions and standard structures
7. **EE Times — "BOM Management Expert Guide for Electronics Manufacturers"** (2025-02-01) — BOM best practices for electronics
