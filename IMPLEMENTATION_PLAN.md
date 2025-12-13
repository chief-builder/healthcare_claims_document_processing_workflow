# ClaimsAgent Implementation Plan

## Executive Summary

This plan outlines the implementation of a TypeScript-based healthcare claims Intelligent Document Processing (IDP) system. The system uses an agentic architecture with LLM-powered extraction, validation, and adjudication of healthcare claims from PDF and image documents.

**Estimated Scope:** ~8,500 lines of TypeScript code across 40+ files

---

## Phase 1: Project Foundation

### 1.1 Project Setup

**Files to create:**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc` - Code formatting
- `.env.example` - Environment variables template
- `.gitignore` - Git ignore patterns

**Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.x",
    "ws": "^8.x",
    "multer": "^1.4.x",
    "uuid": "^9.x",
    "zod": "^3.x",
    "winston": "^3.x",
    "tesseract.js": "^5.x",
    "pdf-lib": "^1.17.x",
    "pdf-parse": "^1.1.x",
    "sharp": "^0.33.x",
    "anthropic": "^0.x",
    "crypto-js": "^4.x",
    "ioredis": "^5.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^1.x",
    "@types/express": "^4.x",
    "@types/ws": "^8.x",
    "@types/multer": "^1.x",
    "@types/uuid": "^9.x",
    "tsx": "^4.x"
  }
}
```

### 1.2 Directory Structure

```
src/
├── index.ts                    # Application entry point
├── config/
│   └── index.ts               # Configuration management
├── models/
│   ├── claim.ts               # Claim-related types
│   ├── validation.ts          # Validation types
│   ├── adjudication.ts        # Adjudication types
│   └── index.ts               # Type exports
├── agents/
│   ├── base.ts                # Base agent class
│   ├── intake.ts              # Document intake agent
│   ├── parsing.ts             # OCR/parsing agent
│   ├── extraction.ts          # Field extraction agent
│   ├── validation.ts          # Validation agent
│   ├── correction.ts          # Correction loop agent
│   ├── adjudication.ts        # Adjudication agent
│   └── index.ts               # Agent exports
├── orchestrator/
│   ├── workflow.ts            # Pipeline orchestrator
│   ├── state.ts               # Claim state management
│   └── index.ts               # Orchestrator exports
├── services/
│   ├── ocr.ts                 # OCR service (Tesseract.js)
│   ├── llm.ts                 # LLM service (Claude API)
│   ├── storage.ts             # Document/claim storage
│   ├── queue.ts               # Review queue management
│   └── index.ts               # Service exports
├── api/
│   ├── server.ts              # Express server setup
│   ├── websocket.ts           # WebSocket handler
│   ├── routes/
│   │   ├── claims.ts          # Claims endpoints
│   │   └── review.ts          # Review queue endpoints
│   └── middleware/
│       ├── auth.ts            # Authentication
│       ├── validation.ts      # Request validation
│       └── error.ts           # Error handling
├── data/
│   ├── icd10-codes.json       # ICD-10 code set (subset)
│   ├── cpt-codes.json         # CPT code set (subset)
│   ├── hcpcs-codes.json       # HCPCS code set (subset)
│   └── pos-codes.json         # Place of service codes
├── utils/
│   ├── validators.ts          # Validation utilities
│   ├── npi.ts                 # NPI checksum validator
│   ├── hash.ts                # Document hashing
│   └── logger.ts              # Logging utility
└── types/
    └── index.ts               # Global type definitions

tests/
├── unit/
│   ├── agents/
│   ├── services/
│   └── utils/
├── integration/
│   └── api/
└── fixtures/
    ├── cms-1500-samples/
    └── ub-04-samples/
```

---

## Phase 2: Core Data Models

### 2.1 Claim Models (`src/models/claim.ts`)

Implement all TypeScript interfaces from the specification:

```typescript
// Core types to implement:
- ClaimSubmission
- ClaimStatus (union type)
- DocumentType (enum/union)
- Address
- ExtractedClaim
- Patient
- Provider
- Diagnosis
- ServiceLine
- ClaimTotals
- Provenance
- ConfidenceScores
```

**Key considerations:**
- Use Zod schemas for runtime validation
- Create factory functions for default values
- Add serialization helpers for JSON storage

### 2.2 Validation Models (`src/models/validation.ts`)

```typescript
// Types to implement:
- ValidationResult
- ValidationError
- ErrorType (enum)
- FieldValidationStatus
```

### 2.3 Adjudication Models (`src/models/adjudication.ts`)

```typescript
// Types to implement:
- AdjudicationDecision
- LineDecision
- DenialReason
- EligibilityCheck
- CoverageCheck
- FeeScheduleEntry
```

---

## Phase 3: Core Services

### 3.1 OCR Service (`src/services/ocr.ts`)

**Functionality:**
- Wrap Tesseract.js for text extraction
- Extract text with bounding boxes
- Calculate confidence scores per word
- Detect tables using heuristics
- Handle multi-page documents
- Implement fallback OCR strategy

**Key methods:**
```typescript
class OCRService {
  async extractText(imageBuffer: Buffer): Promise<OCRResult>
  async extractWithBoxes(imageBuffer: Buffer): Promise<OCRBlock[]>
  async detectTables(blocks: OCRBlock[]): Promise<Table[]>
  async detectCheckboxes(imageBuffer: Buffer): Promise<Checkbox[]>
  private async fallbackExtraction(imageBuffer: Buffer): Promise<OCRResult>
}
```

### 3.2 LLM Service (`src/services/llm.ts`)

**Functionality:**
- Initialize Claude API client
- Structured extraction prompts
- Field-level inference
- Context-aware correction
- Rate limiting and retry logic

**Key methods:**
```typescript
class LLMService {
  async extractClaim(ocrText: string, docType: DocumentType): Promise<ExtractedClaim>
  async inferField(context: string, fieldName: string): Promise<FieldInference>
  async correctField(field: FieldWithContext): Promise<CorrectionResult>
  async classifyDocument(text: string): Promise<DocumentType>
}
```

**Prompt templates needed:**
- Document classification prompt
- CMS-1500 extraction prompt
- UB-04 extraction prompt
- Field correction prompt
- Semantic validation prompt

### 3.3 Storage Service (`src/services/storage.ts`)

**Functionality:**
- Store uploaded documents (filesystem or S3-compatible)
- Store claim state and extraction results
- Track processing history
- Support content-based deduplication

**Key methods:**
```typescript
class StorageService {
  async storeDocument(buffer: Buffer, metadata: DocMetadata): Promise<string>
  async getDocument(docId: string): Promise<Buffer>
  async storeClaim(claim: ClaimRecord): Promise<void>
  async getClaim(claimId: string): Promise<ClaimRecord>
  async updateClaimStatus(claimId: string, status: ClaimStatus): Promise<void>
  async checkDuplicate(hash: string): Promise<string | null>
}
```

### 3.4 Queue Service (`src/services/queue.ts`)

**Functionality:**
- Manage human review queue
- Priority-based ordering
- Assign reviewers
- Track review decisions

**Key methods:**
```typescript
class QueueService {
  async addToReview(claimId: string, reason: string, priority: Priority): Promise<void>
  async getReviewQueue(options: PaginationOptions): Promise<ReviewQueueItem[]>
  async assignReviewer(claimId: string, reviewerId: string): Promise<void>
  async submitReview(claimId: string, decision: ReviewDecision): Promise<void>
}
```

---

## Phase 4: Agent Implementation

### 4.1 Base Agent (`src/agents/base.ts`)

**Abstract class providing:**
- Common lifecycle methods
- Logging integration
- Error handling patterns
- Confidence calculation utilities
- State transition helpers

```typescript
abstract class BaseAgent<TInput, TOutput> {
  protected logger: Logger;
  protected config: AgentConfig;

  abstract process(input: TInput): Promise<AgentResult<TOutput>>;

  protected calculateConfidence(scores: number[]): number;
  protected shouldEscalate(confidence: number): boolean;
  protected logTransition(from: ClaimStatus, to: ClaimStatus): void;
}
```

### 4.2 Intake Agent (`src/agents/intake.ts`)

**Responsibilities:**
- Accept uploaded documents
- Validate file type and size
- Calculate content hash for deduplication
- Preprocess images (deskew, denoise, enhance)
- Classify document type
- Generate claim ID
- Store document and create claim record

**Process flow:**
1. Validate file (type, size) → DI-01, DI-02
2. Check duplicate → DI-07
3. Preprocess if image → DI-05
4. Classify document type → DI-04
5. Store and create claim → DI-06

### 4.3 Parsing Agent (`src/agents/parsing.ts`)

**Responsibilities:**
- Extract all text via OCR
- Calculate word-level confidence
- Detect and extract tables
- Detect checkboxes
- Reconstruct reading order
- Apply fallback OCR if needed

**Process flow:**
1. Load document pages
2. Run OCR on each page → OP-01, OP-03
3. Extract bounding boxes → OP-02
4. Detect tables → OP-04
5. Detect checkboxes → OP-06
6. Reconstruct reading order → OP-07
7. Check confidence, apply fallback if needed → OP-08

### 4.4 Extraction Agent (`src/agents/extraction.ts`)

**Responsibilities:**
- Use LLM to extract structured claim data
- Handle CMS-1500 and UB-04 formats
- Extract all required fields (FE-01 through FE-10)
- Calculate field-level confidence
- Link fields to source provenance

**Process flow:**
1. Prepare extraction prompt with OCR text
2. Call LLM for structured extraction
3. Parse LLM response into ExtractedClaim
4. Calculate confidence scores
5. Map fields to source bounding boxes

**Extraction prompts (document-specific):**
- CMS-1500: Form fields at known positions
- UB-04: Different field layout
- EOB: Payment/denial information

### 4.5 Validation Agent (`src/agents/validation.ts`)

**Responsibilities:**
- Validate ICD-10 codes → VA-01
- Validate CPT/HCPCS codes → VA-02
- Validate NPI format and checksum → VA-03
- Validate dates → VA-04
- Check required fields → VA-05
- Validate amounts → VA-06, VA-07
- Validate diagnosis pointers → VA-08
- Detect semantic inconsistencies → VA-09
- Generate structured error list → VA-10

**Validators to implement:**
```typescript
validateICD10(code: string): ValidationError | null
validateCPT(code: string): ValidationError | null
validateHCPCS(code: string): ValidationError | null
validateNPI(npi: string): ValidationError | null
validateDate(date: string, rules: DateRules): ValidationError | null
validateRequired(claim: ExtractedClaim, docType: DocumentType): ValidationError[]
validateAmounts(claim: ExtractedClaim): ValidationError[]
validateDiagnosisPointers(claim: ExtractedClaim): ValidationError[]
validateSemantics(claim: ExtractedClaim): ValidationError[]
```

### 4.6 Correction Agent (`src/agents/correction.ts`)

**Responsibilities:**
- Re-OCR specific regions for low-confidence fields → CL-01
- Use LLM to infer corrections → CL-02
- Track correction attempts (max 3) → CL-03, CL-04
- Route to human review if needed → CL-05
- Store correction history → CL-07

**Process flow:**
1. Identify low-confidence or invalid fields
2. For each field, attempt correction:
   a. Re-OCR if OCR confidence was low
   b. Use LLM inference with surrounding context
   c. Re-validate corrected value
3. After 3 attempts, route to human review
4. Log all correction attempts

### 4.7 Adjudication Agent (`src/agents/adjudication.ts`)

**Responsibilities:**
- Check member eligibility → AD-01
- Verify procedure coverage → AD-02
- Apply fee schedule → AD-03
- Calculate patient responsibility → AD-04
- Generate denial reasons → AD-05
- Provide decision explanation → AD-06
- Support partial approvals → AD-07
- Calculate line-level payments → AD-08

**Process flow:**
1. Check member eligibility for DOS
2. For each service line:
   a. Check coverage under plan
   b. Look up allowed amount from fee schedule
   c. Calculate payment and patient responsibility
   d. Generate denial reasons if applicable
3. Calculate claim-level totals
4. Generate explanation with policy citations

**Mock data needed:**
- Sample member eligibility data
- Sample coverage rules
- Sample fee schedule

---

## Phase 5: Orchestrator

### 5.1 Workflow Orchestrator (`src/orchestrator/workflow.ts`)

**Responsibilities:**
- Manage claim processing pipeline
- Route based on confidence thresholds
- Handle agent failures and retries
- Emit status updates via WebSocket
- Coordinate human review integration

**State machine:**
```
received → parsing → extracting → validating → [correcting] → [pending_review] → adjudicating → completed
                                                                                              ↓
                                                                                           failed
```

**Confidence-based routing:**
```typescript
const THRESHOLDS = {
  AUTO_PROCEED: 0.95,
  ATTEMPT_CORRECTION: 0.80,
  REQUIRE_REVIEW: 0.80
};
```

### 5.2 State Manager (`src/orchestrator/state.ts`)

**Responsibilities:**
- Track claim state transitions
- Store intermediate results
- Enable resumable processing
- Provide state query interface

---

## Phase 6: API Layer

### 6.1 Express Server (`src/api/server.ts`)

- Configure Express with middleware
- Set up routes
- Initialize WebSocket server
- Health check endpoint

### 6.2 Claims Routes (`src/api/routes/claims.ts`)

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/claims` | POST | `submitClaim` - Upload and process claim |
| `/claims/:id` | GET | `getClaim` - Get claim status and data |
| `/claims/:id/extraction` | GET | `getExtraction` - Get extracted fields |
| `/claims/:id/validation` | GET | `getValidation` - Get validation results |
| `/claims/:id/adjudication` | GET | `getAdjudication` - Get decision |

### 6.3 Review Routes (`src/api/routes/review.ts`)

| Endpoint | Method | Handler |
|----------|--------|---------|
| `/review-queue` | GET | `getQueue` - List pending reviews |
| `/claims/:id/review` | POST | `submitReview` - Submit review decision |

### 6.4 WebSocket Handler (`src/api/websocket.ts`)

- Real-time status updates
- Subscribe to claim updates
- Broadcast state transitions

### 6.5 Middleware

**Error Middleware (`src/api/middleware/error.ts`):**
- Consistent error response format
- Error logging
- Status code mapping

**Validation Middleware (`src/api/middleware/validation.ts`):**
- Request body validation using Zod
- File upload validation

---

## Phase 7: Utilities

### 7.1 NPI Validator (`src/utils/npi.ts`)

Implement Luhn checksum validation for NPI numbers.

### 7.2 Document Hash (`src/utils/hash.ts`)

Content-based hashing for duplicate detection.

### 7.3 Validators (`src/utils/validators.ts`)

- Date format validators
- Code format validators (ICD-10, CPT, HCPCS)
- Amount validators

### 7.4 Logger (`src/utils/logger.ts`)

Winston-based structured logging.

---

## Phase 8: Reference Data

### 8.1 Code Sets

Create JSON files with subsets of healthcare code sets:

**`src/data/icd10-codes.json`:**
```json
{
  "E11.9": "Type 2 diabetes mellitus without complications",
  "I10": "Essential (primary) hypertension",
  ...
}
```

**`src/data/cpt-codes.json`:**
```json
{
  "99213": "Office outpatient visit, est patient, 20-29 min",
  "99214": "Office outpatient visit, est patient, 30-39 min",
  ...
}
```

**`src/data/hcpcs-codes.json`:**
```json
{
  "J0129": "Injection, abatacept, 10 mg",
  ...
}
```

**`src/data/pos-codes.json`:**
```json
{
  "11": "Office",
  "21": "Inpatient Hospital",
  "22": "Outpatient Hospital",
  "23": "Emergency Room"
}
```

---

## Phase 9: Testing

### 9.1 Unit Tests

**Agent tests (`tests/unit/agents/`):**
- Test each agent in isolation with mocked dependencies
- Test confidence calculations
- Test error handling

**Service tests (`tests/unit/services/`):**
- OCR service with sample images
- LLM service with mocked API
- Storage service with temp files

**Utility tests (`tests/unit/utils/`):**
- NPI validation
- Code format validation
- Date validation

### 9.2 Integration Tests

**API tests (`tests/integration/api/`):**
- Full endpoint testing
- File upload testing
- WebSocket testing

### 9.3 Test Fixtures

Create sample documents:
- Valid CMS-1500 PDF
- Valid UB-04 PDF
- Low-quality scan
- Multi-page document
- Document with handwriting

---

## Implementation Order

### Step 1: Foundation (Setup)
1. Initialize project with `package.json` and `tsconfig.json`
2. Create directory structure
3. Set up linting and formatting
4. Configure environment variables

### Step 2: Models and Types
1. Implement all TypeScript interfaces in `src/models/`
2. Create Zod schemas for validation
3. Export types from index files

### Step 3: Utilities
1. Implement logger
2. Implement NPI validator
3. Implement code validators
4. Implement hash utility

### Step 4: Reference Data
1. Create ICD-10 codes JSON (sample subset)
2. Create CPT codes JSON (sample subset)
3. Create HCPCS codes JSON (sample subset)
4. Create POS codes JSON

### Step 5: Core Services
1. Implement storage service (file-based initially)
2. Implement OCR service with Tesseract.js
3. Implement LLM service with Claude API
4. Implement queue service

### Step 6: Base Agent
1. Implement base agent abstract class
2. Add common utilities and patterns

### Step 7: Agents (in pipeline order)
1. Intake Agent
2. Parsing Agent
3. Extraction Agent
4. Validation Agent
5. Correction Agent
6. Adjudication Agent

### Step 8: Orchestrator
1. Implement state manager
2. Implement workflow orchestrator
3. Add confidence-based routing

### Step 9: API Layer
1. Set up Express server
2. Implement claims routes
3. Implement review routes
4. Add WebSocket support
5. Add error handling middleware

### Step 10: Testing
1. Write unit tests for utilities
2. Write unit tests for services
3. Write unit tests for agents
4. Write integration tests for API
5. Create test fixtures

---

## Technical Decisions

### 1. OCR Strategy
- **Primary:** Tesseract.js (no external API dependency)
- **Fallback:** Re-run with different preprocessing
- **Rationale:** Self-contained, no API costs, good for printed text

### 2. LLM Integration
- **Provider:** Anthropic Claude API
- **Model:** claude-3-sonnet (balance of speed/quality)
- **Rationale:** Strong structured extraction, good at healthcare domain

### 3. Storage
- **Initial:** File system with JSON state files
- **Future:** PostgreSQL + S3
- **Rationale:** Simple to start, easy to test, can upgrade later

### 4. State Management
- **Approach:** In-memory with file persistence
- **Future:** Redis for distributed processing
- **Rationale:** Simple for single-instance, upgrade path clear

### 5. Confidence Calculation
- **OCR Confidence:** From Tesseract word-level confidence
- **Extraction Confidence:** Combination of OCR confidence and LLM self-reported confidence
- **Overall Confidence:** Weighted average with field importance

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OCR accuracy on poor scans | Preprocessing pipeline + fallback strategy |
| LLM hallucination | Constrained output formats + validation |
| Code set completeness | Note that sample sets used, plan for full sets |
| Processing time | Async processing with status updates |
| Human review bottleneck | Priority queue + metrics monitoring |

---

## Success Metrics (v1.0 Targets)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Document intake success | >99% | Valid documents processed / total submitted |
| OCR accuracy (printed) | >98% | Character accuracy on test set |
| Field extraction accuracy | >95% | Correctly extracted fields / total fields |
| Auto-adjudication rate | >70% | Claims auto-processed / total claims |
| Processing time (p95) | <30s | Time from submit to decision |

---

## Files to Create (Summary)

**Configuration (4 files):**
- `package.json`
- `tsconfig.json`
- `.eslintrc.json`
- `.env.example`

**Source Code (35+ files):**
- `src/index.ts`
- `src/config/index.ts`
- `src/models/` (4 files)
- `src/agents/` (8 files)
- `src/orchestrator/` (3 files)
- `src/services/` (5 files)
- `src/api/` (7 files)
- `src/data/` (4 files)
- `src/utils/` (5 files)
- `src/types/index.ts`

**Tests (15+ files):**
- Unit tests for all modules
- Integration tests for API
- Test fixtures

---

## Next Steps

1. Review and approve this plan
2. Begin implementation starting with Phase 1 (Project Foundation)
3. Iterate through phases, testing each before moving to next
4. Final integration testing and documentation
