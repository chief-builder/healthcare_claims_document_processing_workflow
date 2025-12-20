# Implemented Features - Healthcare Claims IDP System

This document provides a comprehensive listing of all features that have been implemented and tested in the Healthcare Claims Intelligent Document Processing (IDP) system.

---

## Table of Contents

1. [Implementation Summary](#implementation-summary)
2. [Core Processing Pipeline](#core-processing-pipeline)
3. [Agents](#agents)
4. [Services](#services)
5. [API Layer](#api-layer)
6. [Web User Interface](#web-user-interface)
7. [Data Models](#data-models)
8. [Reference Data](#reference-data)
9. [Utilities](#utilities)
10. [Testing Coverage](#testing-coverage)
11. [Feature Status Matrix](#feature-status-matrix)

---

## Implementation Summary

| Category | Status | Count | Notes |
|----------|--------|-------|-------|
| **Agents** | ✅ Complete | 6 | All processing pipeline agents |
| **Services** | ✅ Complete | 12 | Core + advanced AI services |
| **API Routes** | ✅ Complete | 4 routers | Claims, Review, Query, Health |
| **UI Components** | ✅ Complete | 10+ | Full React dashboard |
| **Models** | ✅ Complete | 3 | Claim, Validation, Adjudication |
| **Test Scripts** | ✅ Complete | 11 | Manual + automated tests |
| **Reference Data** | ✅ Complete | 4 | ICD-10, CPT, HCPCS, POS codes |

---

## Core Processing Pipeline

The system implements an automated workflow pipeline for healthcare claims processing:

```
Document Upload → Intake → Parsing → Extraction → Validation → [Correction] → [Review] → Adjudication → Complete
```

### Pipeline Status Transitions

| From Status | To Status | Trigger | Implementation |
|-------------|-----------|---------|----------------|
| `received` | `parsing` | Document intake completed | `IntakeAgent` |
| `parsing` | `extracting` | OCR/Vision processing done | `ParsingAgent` |
| `extracting` | `validating` | Fields extracted | `ExtractionAgent` |
| `validating` | `adjudicating` | Confidence ≥ 85% | `ValidationAgent` |
| `validating` | `correcting` | Confidence 60-85% | `ValidationAgent` |
| `validating` | `pending_review` | Confidence < 60% | `ValidationAgent` |
| `correcting` | `validating` | Correction attempted | `CorrectionAgent` |
| `correcting` | `failed` | Max attempts exceeded | `CorrectionAgent` |
| `adjudicating` | `completed` | Payment calculated | `AdjudicationAgent` |
| `pending_review` | `completed` | Human approved | `WorkflowOrchestrator` |
| `pending_review` | `failed` | Human rejected | `WorkflowOrchestrator` |

### Confidence Thresholds

| Threshold | Value | Action |
|-----------|-------|--------|
| Auto-process | ≥ 85% | Proceed directly to adjudication |
| Correction | 60-85% | Attempt auto-correction (max 3 times) |
| Human Review | < 60% | Route to review queue |

**Implementation:** `src/orchestrator/workflow.ts:45-50`

---

## Agents

### 1. Intake Agent (`src/agents/intake.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- File type validation (PDF, PNG, JPEG, TIFF)
- File size validation (50MB PDF, 20MB images)
- Content-based duplicate detection via SHA-256 hashing
- Image preprocessing (grayscale, normalization, sharpening)
- DPI upscaling for low-resolution images (< 200 DPI → 300 DPI)
- Document type classification (CMS-1500, UB-04, EOB)
- Claim ID generation (`CLM-{timestamp}-{uuid}`)
- Document storage integration

**Input/Output:**
```typescript
interface IntakeInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  priority?: Priority;
  metadata?: Record<string, string>;
}

interface IntakeOutput {
  claimId: string;
  documentId: string;
  documentType: DocumentType;
  pageCount: number;
  preprocessed: boolean;
}
```

### 2. Parsing Agent (`src/agents/parsing.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- OCR text extraction via Tesseract.js
- Word-level confidence scoring
- Bounding box detection
- Table structure detection
- Checkbox detection
- Multi-page document handling
- Fallback OCR for low-confidence results
- Vision AI integration for complex layouts

### 3. Extraction Agent (`src/agents/extraction.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- LLM-powered field extraction (Claude AI)
- Document-type-specific extraction prompts
- CMS-1500 form field extraction
- UB-04 form field extraction
- EOB data extraction
- Field-level confidence scoring
- Provenance tracking (source location)

**Extracted Fields:**
| Category | Fields |
|----------|--------|
| Patient | Member ID, Name, DOB, Gender, Address |
| Provider | NPI, Name, Tax ID, Specialty, Address |
| Diagnoses | ICD-10 codes, Descriptions, Primary indicator |
| Service Lines | Dates, CPT/HCPCS codes, Modifiers, Units, Charges, POS |
| Totals | Total Charges, Amount Paid, Patient Responsibility |

### 4. Validation Agent (`src/agents/validation.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Required field validation
- NPI checksum validation (Luhn algorithm)
- ICD-10 code format and lookup validation
- CPT code format and lookup validation
- HCPCS code format and lookup validation
- Date format and business rule validation
- Amount validation (positive numbers, totals match)
- Diagnosis pointer validation
- Place of service code validation
- LLM semantic validation (inconsistency detection)
- Low confidence field detection

**Validation Error Types:**
- `syntax` - Format errors (correctable)
- `domain` - Code lookup failures (correctable)
- `business_rule` - Logic violations (non-correctable)
- `semantic` - Logical inconsistencies

### 5. Correction Agent (`src/agents/correction.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Re-OCR for low-confidence regions
- LLM-based field inference with context
- Correction attempt tracking (max 3 attempts)
- Automatic human review escalation
- Correction history logging
- Confidence threshold routing

### 6. Adjudication Agent (`src/agents/adjudication.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Member eligibility verification
- Date of service coverage check
- Procedure code coverage verification
- Prior authorization checking
- Fee schedule lookup
- Allowed amount calculation
- Patient responsibility calculation (deductible, copay, coinsurance)
- Line-level payment decisions
- Denial reason generation
- Policy citation references
- Partial approval support

**Payment Calculation:**
```
Allowed Amount → Deductible → Coinsurance → OOP Max Check → Final Payment
```

---

## Services

### 1. Claude Agent Service (`src/services/claude-agent.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- OAuth token authentication (Claude Code)
- API key authentication fallback
- Text prompt completion
- JSON-structured responses
- Error handling and retries

### 2. OCR Service (`src/services/ocr.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Tesseract.js integration
- Worker pool management
- Language detection
- Word/line/block segmentation
- Confidence scores per word
- Table detection heuristics
- Checkbox detection
- Multi-page support

### 3. LLM Service (`src/services/llm.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Claude API integration
- Document classification
- Structured claim extraction
- Field-level inference
- Field correction suggestions
- Semantic validation
- Rate limiting and retries

### 4. Vision Service (`src/services/vision.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Multimodal Claude 3+ integration
- Direct image-to-claim extraction
- Layout analysis (document type, orientation, quality)
- Handwriting detection and extraction
- Table extraction with markdown/HTML output
- Chart/graph data extraction
- Form field detection
- OCR vs Vision comparison
- Confidence scoring per field

**Capabilities:**
| Feature | Method |
|---------|--------|
| Layout Analysis | `analyzeLayout()` |
| Claim Extraction | `extractFromImage()` |
| Table Extraction | `extractTable()` |
| Chart Extraction | `extractChart()` |
| Form Fields | `extractFormFields()` |
| Handwriting | `extractHandwriting()` |
| OCR Comparison | `compareWithOCR()` |

### 5. Storage Service (`src/services/storage.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- File-based document storage
- JSON claim state persistence
- Content-based deduplication (SHA-256)
- Document metadata management
- Claim record CRUD operations
- Status update tracking

### 6. Queue Service (`src/services/queue.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Human review queue management
- Priority-based ordering (urgent, high, normal)
- Reviewer assignment
- Review decision submission (approve/reject/correct)
- Queue statistics

### 7. Quality Service (`src/services/quality.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- LLM-as-judge extraction quality grading
- Multi-dimensional scoring (completeness, accuracy, consistency, formatting)
- Grade assignment (A, B, C, D, F)
- Low confidence field identification
- Review requirement determination

**Quality Dimensions:**
| Dimension | Description |
|-----------|-------------|
| Completeness | Required fields present |
| Accuracy | Values match source document |
| Consistency | Internal data consistency |
| Formatting | Proper date/code/amount formats |

### 8. Enrichment Service (`src/services/enrichment.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Date normalization (multiple formats → YYYY-MM-DD)
- Address normalization (formatting, abbreviations)
- Phone number normalization
- Currency normalization
- ICD-10/CPT/HCPCS code normalization
- External NPI lookup (mock)
- Normalization history tracking

### 9. Embeddings Service (`src/services/embeddings.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- TF-IDF text embeddings
- Multiple chunking strategies (fixed, sentence, paragraph, semantic)
- Configurable chunk size and overlap
- Metadata attachment to chunks
- Cosine similarity calculation

### 10. Vector Store (`src/services/vectorstore.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- In-memory vector storage
- File persistence for durability
- Document and chunk management
- Similarity search with filtering
- Metadata-based filtering
- Statistics reporting

### 11. RAG Service (`src/services/rag.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Claim indexing for search
- OCR text indexing
- Natural language queries
- Context-aware answer generation
- Source citation
- Similar claim discovery
- Document summarization
- Claim comparison
- Semantic search

**RAG Capabilities:**
| Method | Description |
|--------|-------------|
| `indexClaim()` | Index claim data for RAG |
| `query()` | Answer questions with sources |
| `askAboutClaim()` | Query specific claim |
| `findSimilarClaims()` | Find similar claims |
| `summarizeDocument()` | Generate document summary |
| `compareClaims()` | Compare two claims |
| `semanticSearch()` | Search across all claims |

### 12. Feedback Service (`src/services/feedback.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Field correction recording
- Feedback pattern analysis
- Learning insights generation
- Extraction pattern tracking

---

## API Layer

### Server Configuration (`src/api/server.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Express.js framework
- CORS support
- Helmet security headers
- JSON body parsing (1MB limit)
- Request logging
- Error handling middleware

### Middleware

| Middleware | File | Features |
|------------|------|----------|
| Authentication | `auth.ts` | API key validation (Bearer token, X-API-Key) |
| Rate Limiting | `rateLimit.ts` | Configurable tiers (strict, default, lenient, query) |
| File Upload | `upload.ts` | Multer integration (10MB limit), type validation |
| Validation | `validation.ts` | Zod schema validation for request body/params/query |
| Error Handling | `error.ts` | Consistent error response format, logging |

### Rate Limit Tiers

| Tier | Limit | Window | Endpoints |
|------|-------|--------|-----------|
| Strict | 20 | 15 min | Document upload |
| Default | 100 | 15 min | Most endpoints |
| Lenient | 500 | 15 min | Read operations |
| Query | 30 | 15 min | RAG queries |

### Routes

#### Claims API (`src/api/routes/claims.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claims` | POST | Submit document for processing |
| `/api/claims` | GET | List claims with pagination/filtering |
| `/api/claims/:id` | GET | Get claim details |
| `/api/claims/:id/extraction` | GET | Get extracted claim data |
| `/api/claims/:id/validation` | GET | Get validation results |
| `/api/claims/:id/adjudication` | GET | Get payment decision |
| `/api/claims/:id/history` | GET | Get processing history |
| `/api/claims/:id` | DELETE | Delete claim |

#### Review API (`src/api/routes/review.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/review-queue` | GET | List pending reviews with stats |
| `/api/review-queue/:id/review` | POST | Submit review decision |

#### Query API (`src/api/routes/query.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Natural language RAG query |
| `/api/query/claims/:id/similar` | GET | Find similar claims |

#### Health API (`src/api/routes/health.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Basic health check |
| `/api/health/detailed` | GET | Detailed component status |
| `/api/health/ready` | GET | Kubernetes readiness probe |
| `/api/health/live` | GET | Kubernetes liveness probe |

### WebSocket (`src/api/websocket.ts`)

**Status:** ✅ Implemented and Tested

**Features:**
- Socket.IO integration
- Real-time claim status updates
- Event subscription (single claim, all claims)
- Orchestrator event bridging

**Events:**
| Event | Direction | Description |
|-------|-----------|-------------|
| `claim:status_changed` | Server → Client | Status transition |
| `claim:stage_started` | Server → Client | Processing stage started |
| `claim:stage_completed` | Server → Client | Processing stage done |
| `claim:completed` | Server → Client | Processing complete |
| `claim:error` | Server → Client | Processing error |
| `claim:review_required` | Server → Client | Human review needed |
| `subscribe:claim` | Client → Server | Subscribe to claim updates |
| `subscribe:all` | Client → Server | Subscribe to all updates |
| `unsubscribe:claim` | Client → Server | Unsubscribe from claim |

---

## Web User Interface

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Styling | Tailwind CSS |
| Server State | React Query (TanStack) |
| Client State | Zustand (for WebSocket events) |
| Forms | React Hook Form |
| Routing | React Router v6 |
| Build | Vite |
| Icons | Lucide React |
| Date Utils | date-fns |

### Components

#### Layout (`src/ui/src/components/common/Layout.tsx`)

- Responsive header with navigation
- Mobile hamburger menu
- WebSocket connection indicator
- Settings icon
- Active route highlighting

#### Dashboard (`src/ui/src/pages/DashboardPage.tsx`)

- Stats cards (Total Claims, Pending Review, System Health, Urgent Queue)
- Quick actions panel
- Recent activity feed (real-time WebSocket updates)
- Claims list with pagination

#### Document Upload (`src/ui/src/components/claims/DocumentUpload.tsx`)

- Drag-and-drop upload zone
- Click-to-browse file selection
- File type validation (PNG, JPEG, TIFF, PDF)
- File size validation (10MB max)
- Priority selection (Normal, High, Urgent)
- Upload progress indicator
- Success/error messaging
- Redirect to claim detail on success

#### Claims List (`src/ui/src/components/claims/ClaimsList.tsx`)

- Sortable table (ID, Status, Priority, Created)
- Status filtering
- Priority filtering
- Pagination controls
- Refresh button
- Progress indicators (extraction, validation, adjudication)

#### Claim Detail (`src/ui/src/components/claims/ClaimDetail.tsx`)

- Claim overview card
- Processing history timeline
- Extracted data display
- Patient information
- Provider information
- Service lines table
- Validation results (errors, warnings)
- Adjudication decision
- Confidence scores

#### Review Queue (`src/ui/src/components/review/ReviewQueue.tsx`)

- Stats cards (Pending, Urgent, Avg Wait Time, Avg Confidence)
- Queue table (Claim ID, Patient, Priority, Waiting, Issues, Confidence)
- Review action buttons
- Pagination
- Empty state handling

#### Review Detail (`src/ui/src/components/review/ReviewDetail.tsx`)

- Side-by-side document view
- Extracted data with confidence highlighting
- Validation issues display
- Review actions (Approve, Reject, Request Correction)
- Confirmation dialogs with reason input
- Confidence score breakdown

#### Health Page (`src/ui/src/pages/HealthPage.tsx`)

- Overall status banner
- System stats (Uptime, Memory Used, Memory Total)
- Component status cards
- API information
- Refresh capability
- Error state handling

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useClaims` | `useClaims.ts` | Claims CRUD operations, upload mutation |
| `useSocket` | `useSocket.ts` | WebSocket connection, event subscription |

---

## Data Models

### Claim Models (`src/models/claim.ts`)

**Schemas (Zod):**
- `AddressSchema` - Address structure
- `PatientSchema` - Patient information
- `ProviderSchema` - Provider information
- `DiagnosisSchema` - Diagnosis with ICD-10 code
- `ServiceLineSchema` - Service line details
- `ClaimTotalsSchema` - Financial totals
- `ExtractedClaimSchema` - Complete extracted claim
- `ClaimRecordSchema` - Processing record

**Types:**
- `Priority` - `'normal' | 'high' | 'urgent'`
- `ClaimStatus` - `'received' | 'parsing' | 'extracting' | 'validating' | 'correcting' | 'pending_review' | 'adjudicating' | 'completed' | 'failed'`
- `DocumentType` - `'cms_1500' | 'ub_04' | 'eob' | 'unknown'`

### Validation Models (`src/models/validation.ts`)

**Schemas:**
- `ValidationErrorSchema` - Individual validation error
- `ValidationResultSchema` - Complete validation result

**Types:**
- `ErrorType` - `'syntax' | 'domain' | 'business_rule' | 'semantic'`

### Adjudication Models (`src/models/adjudication.ts`)

**Schemas:**
- `DenialReasonSchema` - Denial code and description
- `LineDecisionSchema` - Per-line adjudication decision
- `AdjudicationDecisionSchema` - Complete adjudication decision

**Types:**
- `DecisionStatus` - `'approved' | 'denied' | 'partial'`

---

## Reference Data

### ICD-10 Codes (`src/data/icd10-codes.json`)

- **Count:** 34 common diagnosis codes
- **Examples:** E11.9 (Diabetes), I10 (Hypertension), J06.9 (URI)
- **Format:** `{ "code": "description" }`

### CPT Codes (`src/data/cpt-codes.json`)

- **Count:** 46 common procedure codes
- **Examples:** 99213 (Office Visit), 93000 (EKG), 36415 (Venipuncture)
- **Format:** `{ "code": "description" }`

### HCPCS Codes (`src/data/hcpcs-codes.json`)

- **Count:** 35 common supply/injection codes
- **Examples:** J3301 (Kenalog), A4206 (Syringe), J0129 (Abatacept)
- **Format:** `{ "code": "description" }`

### Place of Service Codes (`src/data/pos-codes.json`)

- **Count:** 9 common location codes
- **Examples:** 11 (Office), 21 (Inpatient Hospital), 23 (ER)
- **Format:** `{ "code": "description" }`

---

## Utilities

### NPI Validator (`src/utils/npi.ts`)

- 10-digit format validation
- Luhn checksum verification
- Invalid NPI detection

### Code Validators (`src/utils/validators.ts`)

- ICD-10 format validation (letter + 2 digits + optional dot + digits)
- CPT format validation (5 digits)
- HCPCS format validation (letter + 4 digits)
- Date format validation (YYYY-MM-DD)
- Future date detection
- Positive number validation
- Diagnosis pointer validation (A-L letters)

### Hash Utility (`src/utils/hash.ts`)

- SHA-256 document hashing
- Duplicate detection support

### Logger (`src/utils/logger.ts`)

- Winston-based structured logging
- JSON format for production
- Console format for development
- Log level configuration

---

## Testing Coverage

### Test Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `test-services.ts` | Core services (config, validators, NPI, enrichment) | ✅ Verified |
| `test-agents.ts` | Agent tests (intake, validation, adjudication) | ✅ Verified |
| `test-rag.ts` | RAG service with Q&A | ✅ Verified |
| `test-vision.ts` | Vision service for image analysis | ✅ Verified |
| `test-e2e.ts` | Full end-to-end pipeline | ✅ Verified |
| `test-orchestrator.ts` | Complete orchestrator suite | ✅ Verified |
| `test-state-manager.ts` | State manager transitions | ✅ Verified |
| `test-workflow.ts` | Workflow with pre-extracted claims | ✅ Verified |
| `test-review-workflow.ts` | Human review workflow | ✅ Verified |
| `test-concurrent.ts` | Concurrent claim processing | ✅ Verified |
| `test-events.ts` | Event monitoring and timeline | ✅ Verified |
| `test-comprehensive-e2e.ts` | Comprehensive E2E with real data | ✅ Verified |
| `test-api.ts` | API server entry point | ✅ Verified |

### Test Fixtures (`test-fixtures/sample-claims.ts`)

- **CMS-1500 Claims:** 3 samples (Diabetes, Cardiology, Orthopedic)
- **UB-04 Claims:** 2 samples (ER Visit, Surgery)
- **EOB Claims:** 1 sample (Processed claim)
- **Sample OCR Text:** CMS-1500, UB-04, EOB text samples
- **Test Scenarios:** Invalid fields, Invalid codes, Low confidence, High value

### Test Data (`test-data/`)

- Generated claim images for upload testing
- Claim types: Diabetes routine, Hypertension, Respiratory, High-value, Urgent cardiac

### Performance Metrics (from test runs)

| Metric | Result |
|--------|--------|
| Concurrent Processing | 5 claims in 42ms (8ms avg) |
| Success Rate | 100% |
| Events per Claim | 24 events |
| Human Review Actions | Approve, Reject, Correct all working |

---

## Feature Status Matrix

### Phase Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Project Foundation | ✅ Complete |
| Phase 2 | Core Data Models | ✅ Complete |
| Phase 3 | Core Services | ✅ Complete |
| Phase 4 | Agent Implementation | ✅ Complete |
| Phase 5 | Orchestrator | ✅ Complete |
| Phase 6 | API Layer | ✅ Complete |
| Phase 7 | Utilities | ✅ Complete |
| Phase 8 | Reference Data | ✅ Complete |
| Phase 9 | Testing | ✅ Complete |
| Phase 10 | Orchestrator (Enhanced) | ✅ Complete |
| Phase 11 | API Layer (Enhanced) | ✅ Complete |
| Phase 12 | Web UI | ✅ Complete |
| Phase 13 | Formal Test Suite | 🔜 Planned |
| Phase 14 | Enhanced Features | 🔜 Planned |
| Phase 15 | Production Readiness | 🔜 Planned |

### Extended Features (Beyond Original Plan)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Claude Agent SDK | ✅ Implemented | OAuth token authentication |
| Vision Service | ✅ Implemented | Multimodal AI for images |
| Embeddings Service | ✅ Implemented | TF-IDF with chunking |
| Vector Store | ✅ Implemented | In-memory with persistence |
| RAG Service | ✅ Implemented | Retrieval-augmented Q&A |
| Quality Service | ✅ Implemented | LLM-based quality grading |
| Enrichment Service | ✅ Implemented | Data normalization |
| Feedback Service | ✅ Implemented | Continuous learning |
| WebSocket Updates | ✅ Implemented | Real-time status via Socket.IO |
| OpenAPI Spec | ✅ Implemented | Full API documentation |
| GitHub Pages Docs | ✅ Implemented | Swagger UI hosting |

---

## Next Steps

For planned enhancements, see [ENHANCEMENT_PLAN.md](./ENHANCEMENT_PLAN.md).

### Immediate Priorities

1. **Formal Test Suite (Phase 13)** - Vitest unit and integration tests
2. **Database Migration** - PostgreSQL with Prisma ORM
3. **Docker Containerization** - Production-ready containers
4. **CI/CD Pipeline** - GitHub Actions workflow

### Future Enhancements

1. Expanded code sets (5,000+ ICD-10, 500+ CPT codes)
2. PDF native text extraction
3. Authentication & RBAC
4. Prometheus metrics
5. Sentry error tracking

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-20 | Initial comprehensive documentation |
