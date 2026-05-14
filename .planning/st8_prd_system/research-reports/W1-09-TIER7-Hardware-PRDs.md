# W1-09-TIER7-Hardware-PRDs: Deep Analysis of Extracted Hardware PRDs

**Research Agent:** Hardware PRD Analysis Agent (st8 PRD System)  
**Date:** 2026-05-13  
**Sources:** Four extracted hardware PRD text files from the ULC/Walley, Chromatic/Sled, and BLE Mesh Hub projects, plus external hardware PRD pattern research (W2-06).  
**Scope:** Document structure, hardware-specific sections, consumer vs. IoT differences, version evolution, stakeholder language, integration points, "realness" factors, and gaps.

---

## Executive Summary

All four extracted hardware PRDs follow a **single shared template** (likely a D2M or similar product-design template) with nine major section groups in identical order. However, the *fidelity* of content varies dramatically: Walley RLC is a mature, cost-aware electrical-device PRD with specific part numbers and wiring colors; Sled 4.0 is a sparse internal-test-equipment PRD dominated by "N/A" entries; and BLE Mesh Hub is essentially a **skeleton template** with only its Overview narrative filled in. This suggests the underlying template is product-type agnostic, but the domain expertise of the author determines whether it becomes a credible engineering document or remains a questionnaire.

When compared against the external research (W2-06), these PRDs exhibit many of the expected hardware-specific modules---BOM targets, environmental ranges, CMF, durability tests---but **lack the depth** found in industry-standard PRDs: no power budgets, no certification timelines with costs, no Approved Vendor Lists, no manufacturing test protocols, and no thermal/EMC specifications.

---

## 1. Document Structure

### 1.1 Shared Template Architecture
Every extracted PRD uses the same top-level sequence:

1. **Header & Revision Status** --- Project Name, Lead, Client, revision table (REV / WHEN / WHO / WHAT / WHY)
2. **OVERVIEW** --- Product Description, Market Need, Key Features/Functionality, Compatibility/Ecosystem, Stakeholders
3. **COMMERCIALS AND REGULATORY** --- Countries of Sale, Target Launch Date, Regulatory Requirements (Safety, Emissions, Interoperability), Labeling, Country of Origin, Serial Number, Financials (BOM, COGs, MSRP, Margin, Volume, MOQ, Annual Volume, EOL)
4. **ENVIRONMENT** --- Storage Environment (Temperature, Humidity), Operating Environment (Indoor/Outdoor/Wearable, Temperature, Humidity)
5. **INDUSTRIAL DESIGN** --- Brand, Renderings, Color/Material/Finish (CMF), Logo size/placement, Connectors, Visual Interface, Touch Interface, Audio Interface (in Sled/BLE only)
6. **ELECTRICAL HARDWARE AND SENSORS** (or **SYSTEM GOALS** in Sled 4.0) --- Block Diagram, Sensor/Input Requirements, Output/Actuator Requirements, Critical BOM Components, Communication Requirements, Power Requirements. Sled 4.0 adds Topology, Frequency Response, Power Handling, Mechanical Constraints, Operational Features.
7. **DURABILITY** --- Lifetime requirements, Cycles, Chemical resistance, UV resistance, Environmental, Mechanical
8. **PACKAGING** --- In the Box, Unboxing Experience, Printing/colors/inserts/cardboard/drop requirements, Retail Requirements, SKU Combinations
9. **SERVICEABILITY** --- Repair Services, Returns Process, Repair/Return Qualifications/Tolerances, Customer Support System

### 1.2 Structural Observations
- **No Executive Summary or Purpose Statement** outside of the Market Need paragraph. Unlike software PRDs that often open with "Purpose / Scope / Definitions," these dive straight into product description.
- **No separate Risk, Dependency, or Milestone sections.** The revision table and "Target Launch Date" field carry the entire project timeline burden.
- **No Non-Functional Requirements (NFRs) section.** Environmental and durability requirements are siloed in their own sections rather than being cross-referenced as system-level constraints.
- **No Appendix or Glossary.** Terms like "personality," "TRIAC," "PWM," and "RIC" are used without definition.

---

## 2. Hardware-Specific Sections Not Found in Software PRDs

### 2.1 Commercial & Regulatory ("The Business of Physics")
Software PRDs rarely contain BOM cost targets, MOQs, or certification lists. Walley RLC includes:
- **BOM Cost Target:** `$10` (Sep) / `$12` (Oct) at `1MM pc. Build qty.` (Walley Sep l.308; Oct l.320)
- **Volume Planning:** `MOQ of First Production Run: 1K` for business development; `Annual Volume: 1MM+ Year two` (Walley Sep l.316--319)
- **Regulatory Matrix:** `Safety (UL, CE) → UL/ETL/CE`; `Emissions (FCC, CE) → FCC/CE`; `Interoperability → Zigbee and Bluetooth Mesh` (Walley l.288--309)
- **Country of Origin & Serialization:** `USA` origin; `Bluetooth ID can serve as Serial Number` (Walley l.301--304)
- **EOL Timeline:** `36--48 Months` (Walley l.321)

These sections are the **anchor of hardware irreversibility**: once 1MM units are tooled, the BOM cost and certification scope cannot be revised with a deployment.

### 2.2 Environment & Operating Conditions
Hardware PRDs must specify the physical envelope in which the product survives:
- Walley: `Storage: -40 deg C to +70 deg C, 0% to 95% RH non-condensing`; `Operating: Indoor – Yes; Outdoor – Yes, assuming 3rd party weatherproof enclosure.` (Walley l.322--353)
- BLE Mesh Hub: identical ranges (`-40 deg C to +70 deg C`), suggesting template defaults rather than design analysis (BLE Hub l.197--211)
- Sled 4.0: narrower `0 to 40 deg C` because it is a body-worn test device (Sled l.82--88)

Software PRDs might mention "works in Chrome," but they do not specify ambient humidity.

### 2.3 Industrial Design & CMF
Consumer hardware PRDs specify physical appearance and touch:
- **CMF:** `Color – Grey; Case Materials – Aluminum & Plastic; In-tool surface finishes where possible` (Walley l.346--367)
- **Connectors & Wiring:** `3.5mm TRRS jack` with pinout `TIP=SPKR, UR=MIC1, LR=GND, S=MIC2` (Sled l.99--102); Walley specifies `14 awg` line wires and `20 awg` control wires with color coding (Black/White/Green/Red/Brown/Yellow/Orange/Blue/Grey/Purple/Pink) and `12" minimum` pre-stripped lengths (Walley l.236--273)
- **Visual/Touch Interface:** `LED on Interface box for battery life indication` (Sled l.104); `Reset/Forget-from-network is accomplished via selecting two personalities at startup` (Walley l.374--378)

### 2.4 Electrical Hardware, Sensors & BOM
These sections have **no software equivalent** because they describe physical sensing and actuation:
- **Block Diagram:** All three PRDs contain the placeholder `Paste an image here showing which hardware... will be required and how they will connect.` (Walley l.398; Sled l.115; BLE Hub l.234). This is a structural constant: the template expects a visual electrical architecture that was never inserted.
- **Sensor/Actuator Requirements:** `Accurately measure current delivered to each Triac` (Walley l.401); `Balance Armature in RIC configuration... MIC1 on body... MIC2 (100 units) on back of RIC assembly` (Sled l.110--113)
- **Power Requirements:** `Powered by supplied AC input` (Walley l.419); Sled omits battery spec entirely
- **Critical BOM Components:** `NRF52 processor, TRIAC chips, Power monitor device` (Walley Oct l.415); Sled names `ADAU1787... CT7601 PR for I2S to USB interface` (Sled l.119--121)

### 2.5 Durability & Mechanical Testing
- **Lifetime:** `Minimum 5 years` (Walley l.406)
- **Drop Test:** `Three drops to concrete from 1 meter should not affect normal operation` (Walley l.432)
- **Ingress Protection:** `IPX4` (Sled l.143)
- **Cycles / Chemical / UV:** Template prompts exist but are almost universally `N/A` or empty

### 2.6 Packaging & Serviceability
Hardware products are physical objects that must be boxed, shipped, and repaired:
- **Packaging Manifest:** Walley lists `Walley, Two shorting jumpers, Seven 10-14 AWG wire nuts, Four 16-20 AWG wire nuts, Four #4 x 3/4" sheet metal screws` (Walley l.435--441)
- **Serviceability:** All three PRDs have Repair/Returns/Tolerances/Support sections marked `TBD`, `N/A`, or empty (Walley l.451--457; Sled l.161--169; BLE Hub l.270--278)

---

## 3. Consumer vs. Industrial vs. IoT Hardware PRD Differences

Despite sharing the same template, the *content personality* of each PRD diverges sharply based on product domain.

### 3.1 Walley RLC --- Consumer/Industrial Hybrid (Electrical Infrastructure)
- **Primary Focus:** Installation-scale smart power management for electricians
- **Commercial Maturity:** Highest in dataset. Has BOM target, volume plan, certification list, EOL timeline
- **Installation-Centric Detail:** 10 "personalities" (switch/outlet/dimmer/3-way/3-phase configurations), pig-tail wiring with color codes, wire nuts, sheet metal screws---language aimed at electrical contractors
- **Safety-Driven:** `Device must be able to safely sustain 20A of power @120V for one hour` (Walley l.124--125); `Thermal overload = Failure to pass safety standards.` (Walley l.413)
- **CMF:** Explicit material choices (`Aluminum & Plastic`) and manufacturing constraints (`minimal post processing required on parts`) (Walley l.349--353)

### 3.2 Sled 4.0 --- Internal Prototype / Test Equipment (Hearing Aid R&D)
- **Primary Focus:** Acoustical validation platform for alpha testers
- **Commercial Maturity:** Lowest in dataset. `BOM Cost: N/A`, `Regulatory: N/A`, `MSRP: N/A`, `Country of Sale: N/A`
- **Audio/Electrical Precision:** Emphasizes `Frequency Response 20 Hz to 20 kHz, +/- 1 dB` (Sled l.124) and specific codec/interface chips (`ADAU1787`, `CT7601 PR`)
- **Wearable Form Factor:** `Wearable, indoor/outdoor uses` with `IPX4` rating (Sled l.80, 143)
- **Connectors as Signal Integrity Elements:** `Twin 3.5mm TRRS jacks` with explicit analog channel mapping (Sled l.100--102)
- **Volume Reality:** `MOQ of First Production Run: 200` (Sled l.67)---a prototype batch, not a consumer product

### 3.3 BLE Mesh Hub --- IoT/Industrial Gateway
- **Primary Focus:** Secure, on-premise building/factory automation gateway with no cloud dependency
- **Commercial Maturity:** Middle---but deceptive. The Overview narrative is highly detailed (security algorithms, use cases, provisioning behavior), yet every structured section below Overview is empty or contains only template prompts (`Which safety certifications are required?`, `How much do the components cost to make?`)
- **Security-Centric:** `256-bit elliptic curves`, `out-of-band authentication`, `AES-CCM using 128-bit keys`, `hub itself does not have internet connectivity` (BLE Hub l.126--139)
- **Firmware/Hardware Coupling:** Most explicit in dataset. `Based on Nordic's nRF52840 SoC which supports BLE and BLE Mesh protocols... storing provisioning data for larger networks requires additional non-volatile memory. Which is why the hub also has an external flash chip` (BLE Hub l.141--143)
- **Target User Language:** `Commercial properties: industrial buildings, warehouses, retail, hotels` (BLE Hub l.151--154)

### 3.4 Summary of Domain Differences

| Dimension | Walley RLC | Sled 4.0 | BLE Mesh Hub |
|-----------|------------|----------|--------------|
| **Design Driver** | Electrical code compliance + installer UX | Signal fidelity + debuggability | Security + on-premise networking |
| **Cost Detail** | BOM target, volume tiers | N/A | Empty template prompts |
| **Certification Detail** | UL/ETL/CE/FCC named | N/A | Empty template prompts |
| **Electrical Focus** | AC power handling, TRIACs, current monitors | Analog I/O, I2S, USB audio | BLE Mesh, Ethernet, crypto |
| **Mechanical Focus** | Weatherproof enclosure compatibility | As small as possible | Empty |
| **Stakeholder Voice** | Electricians, contractors, utilities | Alpha testers, acoustic engineers | Building automation integrators |
| **"Realness"** | High (parts, wire colors, certifications) | Low (prototype, N/A everywhere) | Mixed (strong narrative, no data) |

---

## 4. Evolution Between Walley RLC Versions (Sep 2021 vs. Oct 2021)

Comparing the two Walley PRDs reveals how a hardware PRD matures when engineering feedback is incorporated.

### 4.1 BOM Cost Target Shift
- **September:** `The BOM target is $10 in mass production (1MM pc. Build qty.)` (Sep l.308)
- **October:** `The BOM target is $12 in mass production (1MM pc. Build qty.)` (Oct l.320)

The $2 increase suggests either scope creep, more realistic supplier quotes, or acknowledgment that the $10 target was unachievable for a UL-listed device with aluminum casing and TRIACs.

### 4.2 Specificity of Part Selection
- **September (Personality Jumper):** `via some sort of user-selectable jumper or switch that is affordable and is not a single-use item` (Sep l.225--227). This is a functional requirement with vague constraints.
- **October (Personality Jumper):** `https://www.digikey.com/en/products/detail/adam-tech/HPH2-A-10-UA-SMT/9831541 ... Terminating the circuit at specific position by a simple jumper will dictate the "personality" of the device. For cost purposes, you are welcome to suggest alternative parts and suppliers` (Oct l.235--239). This is now a **specified component** with a DigiKey URL, a named advisor (`@Winston`), and an explicit electrical mechanism.

### 4.3 Power Monitoring Component Research
- **September:** Omits power-monitor part research entirely.
- **October:** Adds `I've done some research on parts here. Microchip, ADI, Allegro, many semiconductor companies make parts. At a glance, prices range from about $0.50 - $4. I believe a part like this is viable, need confirmation: https://www.mouser.ca/new/onsemi/onsemi-ncs21xr-current-monitor/#Bullet-3` (Oct l.129--135). The PRD now includes **market research, price ranges, and a candidate Mouser link**.

### 4.4 Processor Specification
- **September:** `Processor, TRIAC chips, Power monitor device` (Sep l.397--399)---generic.
- **October:** `NRF52 processor, TRIAC chips, Power monitor device` (Oct l.415)---specifies the Nordic chipset, locking the RF/firmware architecture.

### 4.5 Reset Jumper Part Number
- **September:** Describes the reset behavior but provides no part.
- **October:** Adds `https://www.digikey.com/en/products/detail/sullins-connector-solutions/NPB02SVFN-RC/2618271` for the shorting jumper (Oct l.396).

### 4.6 Key Takeaway
The October revision is **less ambiguous and more supply-chain-aware**. It transforms functional desires into procurement candidates. However, it still lacks thermal calculations, power budgets, and certification timelines---showing that even a "mature" iteration remains incomplete relative to industry standards (W2-06).

---

## 5. Stakeholder Languages & Terminology

The PRDs contain distinct dialects corresponding to engineering disciplines. Mapping these voices helps the st8 system recognize when a section is written by (or for) a specific stakeholder.

### 5.1 Electrical Engineering Voice
**Markers:** Voltage/current ranges, frequency, wire gauges, component part numbers, safety thresholds.
- `85V AC – 264V AC (50Hz – 60Hz)` (Walley l.122)
- `safely sustain 16A of power @120V continuously` (Walley l.126)
- `Multistrand – 600V Rating / 7 X 14 awg wires` (Walley l.238--241)
- `Nordic input max 3V3. Assume source as 10V source line, resistor divide to 3V or less.` (Walley l.257--258)
- `Frequency Response 20 Hz to 20 kHz, +/- 1 dB` (Sled l.124)

**Syntax:** Imperative safety limits (`must be able to safely sustain...`), physical constants (AWG, Hz, deg C), and conditional design notes (`Assume source as...`).

### 5.2 Mechanical / Industrial Design Voice
**Markers:** Materials, finishes, dimensions, assembly methods, environmental ratings.
- `Case Materials – Aluminum & Plastic` (Walley l.349)
- `In-tool surface finishes where possible – Expectation is minimal post processing` (Walley l.351--353)
- `Laser engraving for directions & Certs` (Walley l.354)
- `IPX4` (Sled l.143)
- `As small as possible, while still allowing for debug interfaces` (Sled l.129)

**Syntax:** Material-process pairing (`Aluminum & Plastic` + `In-tool surface finishes`), manufacturing constraints (`minimal post processing`), and spatial superlatives (`as small as possible`).

### 5.3 Manufacturing / Supply Chain Voice
**Markers:** BOM cost, volume tiers, MOQ, EOL, packaging manifests, part alternates.
- `BOM target is $12 in mass production (1MM pc. Build qty.)` (Walley Oct l.320)
- `Plan of record is 1K for Business Development & Case Study Generation` (Walley l.317)
- `Annual Volume 1MM+ Year two of sales` (Walley l.319)
- `Timeline for Product Refresh (EOL) 36 - 48 Months` (Walley l.321)
- `For cost purposes, you are welcome to suggest alternative parts and suppliers` (Walley Oct l.239)

**Syntax:** Business metrics attached to physical production (`1MM pc. Build qty.`), temporal planning (`36-48 Months`), and cost-driven optionality (`suggest alternative parts`).

### 5.4 Firmware / RF Integration Voice
**Markers:** Protocol stacks, provisioning, memory constraints, encryption, MCU references.
- `Present to the RF as a single outlet device with power monitoring capability` (Walley l.138)
- `Compatible with Bluetooth Mesh (Nordic), Zigbee` (Walley l.417)
- `nRF52840 SoC which supports BLE and BLE Mesh protocols... external flash chip for storing network metadata` (BLE Hub l.141--143)
- `USB C enumeration as a sound device with 4 channels in, 2 channels out` (Sled l.24)
- `Network configuration data is transferred to the computer/server whenever possible, to prevent the hub from being a single point failure` (BLE Hub l.94--99)

**Syntax:** Behavioral descriptions of how hardware state maps to network/software state (`Present to the RF as...`, `enumeration as a sound device`), and memory/storage architecture (`external flash chip for storing network metadata`).

### 5.5 Safety / Regulatory Voice
**Markers:** Certifications, failure modes, thermal limits, code compliance.
- `UL/ETL/CE` (Walley l.290)
- `Thermal overload = Failure to pass safety standards.` (Walley l.413)
- `Device must be able to safely sustain 20A of power @120V for one hour.` (Walley l.124)

**Syntax:** Direct equivalence between physical failure and regulatory failure (`Thermal overload = Failure to pass safety standards`).

---

## 6. Hardware-Software Integration Points

Hardware PRDs in this dataset contain several explicit and implicit coupling points between physical design and firmware/software behavior.

### 6.1 MCU Selection Constraining Firmware
- **Walley (Oct):** `NRF52 processor` selection (Oct l.415) implicitly locks the firmware team to Nordic's SDK, BLE Mesh stack, and GPIO constraints. The PRD does not make this dependency explicit, but the external research (W2-06) notes that `a change in MCU selection can invalidate MQTT topic design` and memory maps.
- **BLE Mesh Hub:** Explicitly states `Based on Nordic's nRF52840 SoC... While nRF52840 has plenty of memory for firmware itself, storing provisioning data for larger networks requires additional non-volatile memory. Which is why the hub also has an external flash chip` (BLE Hub l.141--143). This is the **clearest hardware→software constraint** in the dataset: firmware memory is adequate, but *network metadata* overflows to external storage, requiring firmware to manage a flash translation layer or file system.

### 6.2 Communication Protocol Requirements
- **Walley:** `Bluetooth Mesh – Standard, Zigbee – Standard` (Walley l.264--265). These requirements dictate the RF firmware stack, antenna design, and certification path. The PRD does not specify whether both protocols run simultaneously or are mutually exclusive---a critical firmware architecture decision.
- **Sled 4.0:** `USB C enumeration as a sound device with 4 channels in, 2 channels out` (Sled l.24). This requires firmware to present a standard USB Audio Class descriptor, which in turn constrains the `CT7601 PR` bridge chip firmware and the host driver expectations.
- **BLE Mesh Hub:** `acts as a proxy for standard BLE protocol, which will allow the authorized user to configure the network using smart devices with BLE capabilities such as tablets, or phones` (BLE Hub l.134--136). This creates a dual-mode requirement: the hub must run both BLE Mesh (network layer) and standard BLE GAP/GATT (proxy layer), increasing firmware complexity.

### 6.3 Personality / Configuration Systems
- **Walley:** The 10 "personalities" are both hardware configurations (which wires terminate where) and **firmware identity configurations** (`Present to the RF as a single outlet device... Present to the RF as two independent outlets`). The jumper-based selection (physical) determines the RF advertising profile and control-loop behavior (firmware). The PRD documents both sides but does not include a mapping table showing which GPIOs map to which personality modes.

### 6.4 Security Architecture
- **BLE Mesh Hub:** Hardware security is defined by cryptographic requirements (`256-bit elliptic curves`, `AES-CCM using 128-bit keys`) that must be implemented in firmware on the nRF52840. The PRD notes `physical authentication requirement` (BLE Hub l.81--82), meaning the firmware must enforce a hardware-based authentication flow (e.g., button press, NFC tap) before provisioning.

### 6.5 Missing Integration Artifacts
None of the PRDs include:
- **Pin assignment tables** showing MCU GPIO → peripheral mapping
- **Memory/flash budgets** aligned with firmware feature sets
- **OTA update requirements** tied to flash chip size
- **Hardware-in-Loop (HIL) test scenarios** verifying firmware behavior under thermal or voltage stress

---

## 7. The "Realness" Factor

A PRD feels "real" to stakeholders when it contains **specific, irreversible commitments**: exact costs, exact dates, exact part numbers, exact wire colors, exact certifications. We can rank the four PRDs by realness.

### 7.1 Walley RLC --- Highest Realness
**What makes it feel real:**
- **BOM target with volume tier:** `$12 at 1MM` (Oct l.320)
- **Launch date:** `January 2022 Mass Production` (Walley l.287)
- **Regulatory marks named:** `UL/ETL/CE`, `FCC/CE` (Walley l.290--305)
- **Physical installation detail:** 13 wire colors, two AWG gauges, `12" minimum` lengths, wire nuts, screws (Walley l.236--273)
- **Part URLs:** DigiKey and Mouser links for personality jumper, reset jumper, and current monitor (Oct l.235, 396, 135)
- **Power safety limits:** `20A for one hour`, `16A continuous` (Walley l.124--126)
- **MOQ and ramp plan:** `1K` then `1MM+ Year two` (Walley l.317--319)

**What undermines realness:**
- `TBD` appears 15+ times (Brand, Renderings, MSRP, COGs, Margin, Unboxing Experience, Repair/Returns/Support)
- No actual block diagram image (`Paste an image here`)
- No power budget, thermal simulation, or EMC test plan
- No certification timeline with costs ($10K--50K for UL per W2-06 is not reflected)

### 7.2 Sled 4.0 --- Low Realness (Prototype Reality)
**What makes it feel real:**
- Specific silicon: `ADAU1787`, `CT7601 PR` (Sled l.119--121)
- Precise analog spec: `20 Hz to 20 kHz, +/- 1 dB` (Sled l.124)
- Connector pinout: `TIP=SPKR, UR=MIC1, LR=GND, S=MIC2` (Sled l.102)
- `MOQ 200` and launch date `August 1, 2022` (Sled l.37, 67)

**What undermines realness:**
- `N/A` dominates every commercial, regulatory, durability, and serviceability field
- No BOM cost, no certifications, no service plan, no packaging detail
- Reads as an internal R&D checkout sheet rather than a product contract

### 7.3 BLE Mesh Hub --- Mixed Realness (Strong Narrative, Empty Structure)
**What makes it feel real:**
- Rich security narrative: `256-bit elliptic curves`, `AES-CCM`, `no internet connectivity` (BLE Hub l.126--139)
- Clear use cases: `smart lighting, indoor asset tracking, alarm systems` (BLE Hub l.55--59)
- Explicit hardware justification: `external flash chip for storing network metadata` (BLE Hub l.143)

**What undermines realness:**
- Every structured field below Overview contains only **template prompts** (`Which safety certifications are required?`, `How much do the components cost to make?`)
- No BOM, no cost, no temperature/humidity justification (just template defaults), no connector list, no durability test
- The PRD is a **narrative draft pasted into a template** rather than an engineering specification

### 7.4 Missing "Realness" Elements Across the Dataset
When compared against the external research (W2-06), these PRDs lack the following credibility anchors:
1. **Certification cost and timeline matrix** (e.g., FCC $3K--15K, 4--6 weeks)
2. **Power budget model** (deep sleep uA, active mode mA, battery life calculation)
3. **Should-cost analysis** or category-level BOM breakdown (Main Control 15%, Sensors 35%, etc.)
4. **Approved Vendor List (AVL)** and alternate components for supply chain resilience
5. **Factory Acceptance Test (FAT)** criteria with pass/fail thresholds
6. **Thermal management plan** (heat sinks, PCB copper weight, ambient derating)
7. **EMC/EMI test plan** (ESD levels, radiated emissions limits)
8. **Firmware memory/flash budget** aligned with feature set
9. **Traceability requirements** (serial number assignment, component lot tracking)
10. **Quality gates** (incoming QC, in-process inspection, defect rate PPM targets)

---

## 8. Gaps in the Hardware PRDs

### 8.1 Critical Missing Sections
| Gap | Impact | Evidence in Dataset |
|-----|--------|---------------------|
| **Actual Block Diagrams** | Electrical architecture is invisible | All three say "Paste an image here" |
| **Power Budget / Thermal Analysis** | Cannot validate battery life or heat dissipation | Walley: "Powered by supplied AC input" only; Sled: no battery spec |
| **Certification Timeline & Cost** | Launch date is ungrounded; UL can take 8--12 weeks and $10K--50K | Walley names certs but provides no timeline or budget |
| **Manufacturing Test Protocol** | Factory has no pass/fail criteria | All sections empty or TBD |
| **Pin Assignment / MCU Resource Budget** | Firmware team lacks constraint table | BLE Hub mentions nRF52840 but lists no GPIO map |
| **Supply Chain Risk Assessment** | Single-source components could halt production | Walley mentions one DigiKey part with no alternates listed |
| **EMC / EMI / ESD Specifications** | PCB layout lacks design rules | No mention of ESD, radiated emissions, or immunity |
| **Assembly Sequences / DFM** | Tooling and assembly line cannot be planned | `Expectation is minimal post processing` is vague |
| **Service BOM / FRU Identification** | Repair and spare parts impossible to stock | All serviceability fields are TBD or N/A |
| **OTA / Firmware Update Architecture** | Field updates unplanned | Not mentioned in any PRD except implied by "NRF52" ecosystem |

### 8.2 Template Limitations
The shared template has several structural weaknesses:
1. **No Risk or Dependency Section.** Hardware PRDs should track long-lead items, certification dependencies, and single-source risks (W2-06). The template offers only a revision history table.
2. **No Cross-Domain Constraint Tables.** The external research highlights the need for explicit `Hardware Constraint → Software Impact` matrices (e.g., `Sleep <= 80uA` → `WiFi on-demand only`). None of the PRDs include these.
3. **No Should-Cost or VAVE Section.** While Walley includes a BOM target, there is no breakdown by category (main control, power, sensors, structure) or planned cost-reduction roadmap.
4. **Flat DURABILITY Section.** Drop tests, chemical resistance, UV, and environmental are listed as equal prompts. In reality, Walley should emphasize thermal and electrical safety; Sled should emphasize sweat/IPX4 and cable flex cycles; BLE Hub should emphasize dust and 24/7 uptime. The template does not guide domain-specific prioritization.
5. **No Firmware Architecture Section.** The template stops at "Communication Requirements" and "Power Requirements." It does not include flash partitioning, RTOS selection, task allocation, or OTA strategy---all critical for IoT devices like Walley and BLE Mesh Hub.

### 8.3 Recommendations for st8
Based on this analysis, the st8 PRD system should:

1. **Detect Template vs. Content Gaps:** Flag sections that still contain placeholder prompts (e.g., "Which safety certifications are required?") and replace them with domain-specific defaults or elicitation questions.
2. **Enforce Hardware-Specific Checklists:** Before considering a hardware PRD "complete," st8 should verify the presence of: BOM with target cost, certification list with timeline, environmental range, power budget (if battery-powered), and at least one manufacturing test criterion.
3. **Generate Cross-Domain Constraint Tables:** When a PRD names an MCU (e.g., `nRF52840`), st8 should auto-suggest a `Hardware → Firmware` constraint table (memory, GPIO, protocol stack, flash layout).
4. **Differentiate Defaults by Product Type:**
   - **Consumer Electrical (Walley-like):** Default certifications = UL/FCC/CE; default durability = drop test + thermal; default focus = installer UX + BOM cost.
   - **Prototype/Test Equipment (Sled-like):** Default focus = signal fidelity + debug interfaces; suppress commercial/regulatory sections rather than filling them with "N/A."
   - **IoT Gateway (BLE Hub-like):** Default sections = security architecture, firmware memory budget, communication protocol spec, external flash justification, and no-internet-connectivity rationale.
5. **Surface Irreversibility Warnings:** When a PRD commits to a specific part URL (DigiKey/Mouser), st8 should flag: "This selection affects PCB footprint, BOM cost, and lead time. Suggest alternate suppliers before locking."
6. **Include "Realness" Scoring:** A PRD should be scored on specificity metrics: number of part numbers, number of quantified thresholds (voltage, current, temperature, dB), presence of cost targets, and presence of certification names. Walley scores high; BLE Hub scores low despite a strong narrative.

---

## Appendix: Source Files Analyzed

1. `Walley_RLC_-_PRD_-_10182021_docx.txt` --- 458 lines, October 2021 revision with team feedback incorporated
2. `Walley_RLC_-_PRD_-_09072021_-_For_Team_Feedback_docx.txt` --- 442 lines, September 2021 baseline
3. `Sled_4_0_PRD_docx.txt` --- 169 lines, Chromatic hearing-aid test platform PRD
4. `BLE_Mesh_Hub_PRD_odt.txt` --- 278 lines, IoT gateway PRD (template-heavy)
5. `W2-06-Hardware-PRD-Patterns.md` --- External hardware PRD pattern research for comparative analysis
