# BlindSpot — Feedback on Nebius Token Factory, AI Cloud & NVIDIA Nemotron Models
*Nebius x NVIDIA Global AI Hackathon · Developer Feedback Submission*

## 1. Overview of Platform Usage

BlindSpot leveraged Nebius Token Factory as the primary inference engine powering three distinct tiers of NVIDIA Nemotron models:
1. **NVIDIA Nemotron-3 Nano (30B)** (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`) for lightweight page-state digests and landmark summarization.
2. **NVIDIA Nemotron-3 Super (120B)** (`nvidia/nemotron-3-super-120b-a12b`) for synthesized barrier analysis, severity grading, and WCAG 2.2 criterion mapping.
3. **NVIDIA Nemotron-3 Ultra (550B)** (`nvidia/Nemotron-3-Ultra-550b-a55b`) for generating surgical CSS, HTML, attribute, and script patches.

Grounded retrieval was executed via **Tavily API** for authoritative WCAG criterion specifications. All verdicts were decided deterministically via a Playwright Chromium harness.

---

## 2. Nebius Token Factory Feedback

### What we used it for
Low-latency inference for all three Nemotron model tiers across real-time user audits and parallel batch benchmark runs.

### What worked well
- **OpenAI API Compatibility**: Dropping the standard `openai` Node SDK directly in front of `https://api.tokenfactory.nebius.ai/v1` with a custom `apiKey` and `baseURL` worked seamlessly on the first try.
- **Model Diversity**: Having Nano (30B), Super (120B), and Ultra (550B) available on the exact same endpoint allowed us to implement sophisticated model routing without multi-vendor orchestration overhead.
- **High Token Throughput**: Nano digests returned with rapid responsiveness, allowing the user dashboard to stream live stage updates swiftly without blocking the main workflow.

### What needs work & specific friction points
1. **Strict JSON Schema Enforcement (`json_object` vs `json_schema`)**:
   - *Behavior*: While `response_format: { type: "json_object" }` is supported, occasionally models would wrap JSON in markdown code blocks (` ```json ... ``` `).
   - *Recommendation*: Support OpenAI-style Structured Outputs (`response_format: { type: "json_schema", json_schema: { ... } }`) to enforce strict conformance to JSON schemas at the decoding level.
2. **Catalog Documentation & Model Identifiers**:
   - *Behavior*: Discovering the exact string identifier for each model tier required exploring the web portal.
   - *Recommendation*: Provide a public `/v1/models` endpoint returning detailed context limits, parameter sizes, and recommended system prompts for each Nemotron release.
3. **Usage & Balance Tracking API**:
   - *Behavior*: Querying remaining credits or setting fine-grained project budget caps had to be managed manually in application code.
   - *Recommendation*: Add a programmatic usage/balance endpoint in Token Factory so developer agents can autonomously guard their token spending.

---

## 3. NVIDIA Nemotron Models Feedback

### Nemotron-3 Nano (30B)
- **Role**: Summarizing raw accessibility tree nodes and focus stops into compact `StateDigest` records.
- **Strengths**: Extremely fast and predictable. Followed system instructions without hallucinating landmarks.
- **Improvements**: Prone to outputting empty arrays if the input payload exceeded 35 stops; providing a recommended sliding-window prompt pattern in model documentation would help.

### Nemotron-3 Super (120B)
- **Role**: Reasoning across multiple focus stops to classify severity (Blocker, Major, Minor) and link to WCAG criteria.
- **Strengths**: High contextual comprehension. When given Tavily search results on WCAG 2.1.2 or 2.4.3, Super accurately summarized the real-world impact on keyboard and screen-reader users in a single clear, empathetic sentence.
- **Improvements**: Temperature needed to be clamped strictly to `0.1`; at higher temperatures, it occasionally suggested adding `tabindex="1"`, which violates accessibility best practices (positive tabindex).

### Nemotron-3 Ultra (550B)
- **Role**: Writing surgical code repairs (CSS `:focus-visible` rules, `aria-label` attributes, DOM bypass links, and scoped keyboard event listeners).
- **Strengths**: Outstanding code generation capability. The patches generated for dialog Escape handlers and focus indicator restorations passed our strict security linter on the first try.
- **Improvements**: While latency was acceptable for a developer audit, streaming token support on patch generation would enhance the real-time UX.

---

## 4. Onboarding & Overall Experience

- **Account to First Successful Call**: ~12 minutes from API key creation to executing `scripts/hello-models.ts`.
- **Would we build with it again?**: **Yes, absolutely.** The combination of Nebius Token Factory's inference speed and NVIDIA's Nemotron model family provided an ideal foundation for a multi-tiered agentic system where cost, latency, and reasoning capability are balanced across discrete workflow stages.
