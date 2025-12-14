# Enhancement Plan - Healthcare Claims IDP System

## Current Implementation Status

### Completed Phases

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Project Foundation | ✅ Complete | package.json, tsconfig, config |
| Phase 2: Core Data Models | ✅ Complete | Zod schemas, claim/validation/adjudication models |
| Phase 3: Core Services | ✅ Complete+ | OCR, LLM, Storage, Queue + Vision, RAG, Quality, Embeddings |
| Phase 4: Agent Implementation | ✅ Complete | All 6 agents implemented |
| Phase 5: Orchestrator | ✅ Complete | StateManager, WorkflowOrchestrator, automated pipeline |
| Phase 6: API Layer | 🔜 Next | Express server, routes, WebSocket |
| Phase 7: Utilities | ✅ Complete | NPI, validators, hash, logger |
| Phase 8: Reference Data | ✅ Complete | ICD-10, CPT, HCPCS, POS codes |
| Phase 9: Testing | ✅ Complete | Manual tests verified, 11 test scripts |

### Additional Features Implemented (Beyond Original Plan)

| Feature | Description |
|---------|-------------|
| Claude Agent SDK | OAuth token authentication wrapper |
| Vision Service | Multimodal AI for image analysis |
| Embeddings Service | TF-IDF text embeddings with chunking |
| Vector Store | In-memory vector storage with persistence |
| RAG Service | Retrieval-augmented generation for Q&A |
| Quality Service | LLM-based extraction quality grading |
| Enrichment Service | Data normalization (dates, addresses, codes) |
| Comprehensive Test Suite | 11 test scripts with sample fixtures |

### Test Scripts Created

| Test Script | Purpose | Status |
|-------------|---------|--------|
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

### Key Test Results (Phase 10 Orchestrator)

| Metric | Result |
|--------|--------|
| Concurrent Processing | 5 claims in 42ms (8ms avg) |
| Success Rate | 100% |
| Events per Claim | 24 events |
| Human Review Actions | Approve, Reject, Correct all working |
| Confidence Routing | auto_process (≥85%), correct (60-84%), review (<60%) |

---

## Next Enhancement Phases

### Phase 10: Orchestrator Implementation ✅ COMPLETED

**Goal:** Implement automated workflow orchestration for hands-off claim processing.

**Status:** ✅ Implemented, tested, and verified with 11 test scripts.

#### 10.1 State Manager (`src/orchestrator/state.ts`) ✅

**Implemented Features:**
- Track claim state transitions with full history
- Persist state to file-based storage
- Enable resumable processing after failures
- Query claims by status, priority, date range
- Support concurrent claim processing (5 claims in 42ms)
- EventEmitter integration for state changes

**Events Emitted:**
- `state:created` - New claim state initialized
- `state:transition` - Status change occurred
- `state:updated` - Claim data modified
- `state:completed` - Processing finished successfully

#### 10.2 Workflow Orchestrator (`src/orchestrator/workflow.ts`) ✅

**Implemented Features:**
- Automated pipeline execution with pre-extracted claims
- Confidence-based routing (auto/correct/review)
- Error handling with graceful failure states
- Event emission for workflow stages
- Human review integration with approve/reject/correct actions
- RAG indexing integration (optional)
- Quality assessment integration (optional)

**State Machine:**
```
received → parsing → extracting → validating → [correcting] → [pending_review] → adjudicating → completed
                                      ↓                              ↓                              ↓
                                   failed ←───────────────────── failed ←─────────────────────── failed
```

**Confidence Thresholds:**
```typescript
const THRESHOLDS = {
  AUTO_PROCEED: 0.85,        // Auto-advance if confidence >= 85%
  ATTEMPT_CORRECTION: 0.60,  // Attempt correction if 60-85%
  REQUIRE_REVIEW: 0.60       // Human review if < 60%
};
```

**Verified Test Results:**
| Test | Description | Result |
|------|-------------|--------|
| High-confidence (92%) | Auto-process path | ✅ Completed |
| Medium-confidence (70%) | Correction path | ✅ Completed |
| Low-confidence (50%) | Review path | ✅ Pending review |
| Human review approve | Resume to adjudication | ✅ Completed |
| Human review reject | Transition to failed | ✅ Failed |
| Human review correct | Revalidate with edits | ✅ Completed |
| Concurrent processing | 5 parallel claims | ✅ 42ms total |

---

### Phase 11: API Layer (Priority: HIGH) 🔜 NEXT

**Goal:** Expose RESTful API and WebSocket for external integration.

**Status:** Ready to implement. Orchestrator provides all backend functionality.

#### 11.1 Express Server Setup

**Files to create:**
```
src/api/
├── server.ts           # Express app configuration
├── websocket.ts        # WebSocket handler (Socket.IO)
├── routes/
│   ├── index.ts        # Route aggregation
│   ├── claims.ts       # Claims endpoints
│   ├── review.ts       # Review queue endpoints
│   ├── query.ts        # RAG query endpoints
│   └── health.ts       # Health check
└── middleware/
    ├── auth.ts         # API key authentication
    ├── validation.ts   # Request validation (Zod)
    ├── upload.ts       # File upload (multer)
    ├── rateLimit.ts    # Rate limiting
    └── error.ts        # Error handling
```

**Dependencies to add:**
```bash
npm install express cors helmet multer socket.io express-rate-limit
npm install -D @types/express @types/cors @types/multer
```

#### 11.2 API Endpoints

**Claims API:**
| Endpoint | Method | Description | Orchestrator Method |
|----------|--------|-------------|---------------------|
| `POST /api/claims` | Upload | Submit document for processing | `processDocument()` |
| `GET /api/claims/:id` | Read | Get claim status and data | `stateManager.getState()` |
| `GET /api/claims/:id/extraction` | Read | Get extracted fields | `stateManager.getExtractedClaim()` |
| `GET /api/claims/:id/validation` | Read | Get validation results | `stateManager.getValidationResult()` |
| `GET /api/claims/:id/adjudication` | Read | Get payment decision | `stateManager.getAdjudicationResult()` |
| `GET /api/claims` | List | List claims with filters | `stateManager.listStates()` |
| `DELETE /api/claims/:id` | Delete | Remove claim and data | `stateManager.deleteState()` |

**Review Queue API:**
| Endpoint | Method | Description | Orchestrator Method |
|----------|--------|-------------|---------------------|
| `GET /api/review-queue` | List | Get pending reviews | `stateManager.listByStatus('pending_review')` |
| `POST /api/claims/:id/review` | Submit | Submit review decision | `orchestrator.submitReview()` |
| `GET /api/claims/:id/history` | Read | Get processing history | `stateManager.getHistory()` |

**RAG Query API:**
| Endpoint | Method | Description | Service Method |
|----------|--------|-------------|----------------|
| `POST /api/query` | Query | Natural language claim query | `ragService.query()` |
| `GET /api/claims/:id/similar` | Search | Find similar claims | `ragService.findSimilarClaims()` |

#### 11.3 WebSocket Events (Socket.IO)

```typescript
// Server → Client events (real-time updates)
'claim:created'              // New claim received
'claim:status_changed'       // Status transition (from orchestrator events)
'claim:extraction_complete'  // Extraction finished
'claim:validation_complete'  // Validation finished
'claim:review_required'      // Needs human review
'claim:adjudication_complete'// Adjudication finished
'claim:completed'            // Processing complete
'claim:failed'               // Processing failed

// Client → Server events
'subscribe:claim'            // Subscribe to single claim updates
'subscribe:all'              // Subscribe to all claim updates
'unsubscribe:claim'          // Unsubscribe from claim
```

#### 11.4 Implementation Notes

The API layer will bridge the existing orchestrator to HTTP/WebSocket:

```typescript
// Example: POST /api/claims handler
app.post('/api/claims', upload.single('document'), async (req, res) => {
  const orchestrator = getWorkflowOrchestrator();

  // Process uploaded document
  const result = await orchestrator.processDocument(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
    req.body.priority || 'normal'
  );

  // Emit WebSocket event
  io.emit('claim:created', { claimId: result.claimId });

  res.status(201).json(result);
});
```

---

### Phase 12: Web UI (Priority: HIGH) ✅ COMPLETED

**Goal:** Provide a user interface for claim submission, status tracking, and human review.

**Status:** COMPLETED - Full React 18 web interface implemented.

#### 12.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React 18+ | Industry standard, component-based |
| Styling | Tailwind CSS | Rapid UI development |
| State | React Query + Zustand | Server state + client state |
| Forms | React Hook Form + Zod | Type-safe form validation |
| WebSocket | Socket.IO Client | Real-time updates |
| Build | Vite | Fast development and build |

**Project structure:**
```
src/ui/
├── components/
│   ├── claims/
│   │   ├── ClaimUpload.tsx       # Drag-and-drop upload
│   │   ├── ClaimList.tsx         # Claims table with filters
│   │   ├── ClaimDetail.tsx       # Single claim view
│   │   └── ClaimTimeline.tsx     # Processing history
│   ├── review/
│   │   ├── ReviewQueue.tsx       # Pending review list
│   │   ├── ReviewDetail.tsx      # Side-by-side document view
│   │   └── CorrectionForm.tsx    # Edit extracted fields
│   ├── extraction/
│   │   ├── ExtractionViewer.tsx  # Extracted data display
│   │   └── ConfidenceIndicator.tsx # Visual confidence scores
│   └── common/
│       ├── Layout.tsx
│       ├── Navbar.tsx
│       └── StatusBadge.tsx
├── hooks/
│   ├── useClaims.ts              # React Query hooks
│   ├── useWebSocket.ts           # Socket.IO connection
│   └── useReviewQueue.ts
├── pages/
│   ├── Dashboard.tsx             # Overview with stats
│   ├── Claims.tsx                # Claim list and upload
│   ├── ClaimDetail.tsx           # Single claim view
│   ├── ReviewQueue.tsx           # Human review interface
│   └── Query.tsx                 # RAG natural language query
└── App.tsx
```

#### 12.2 Key UI Features

**Claims Dashboard:**
- Real-time claim status updates via WebSocket
- Drag-and-drop document upload (PDF, PNG, JPG, TIFF)
- Filter by status, priority, date range
- Processing statistics and metrics

**Claim Detail View:**
- Original document viewer (PDF.js / image viewer)
- Extracted fields with confidence highlighting
- Validation errors and warnings
- Processing history timeline
- Adjudication decision details

**Review Queue Interface:**
- List of claims requiring human review
- Side-by-side: original document | extracted data
- Confidence-based field highlighting (red/yellow/green)
- Action buttons: Approve | Reject | Correct
- Inline field correction with validation
- Bulk actions for multiple claims

**RAG Query Interface:**
- Natural language question input
- Answer with source citations
- Similar claims display
- Query history

---

### Phase 13: Formal Test Suite (Priority: MEDIUM)

**Goal:** Add comprehensive unit and integration tests using Vitest.

#### 13.1 Unit Tests

**Files to create:**
```
tests/
├── unit/
│   ├── agents/
│   │   ├── intake.test.ts
│   │   ├── validation.test.ts
│   │   └── adjudication.test.ts
│   ├── services/
│   │   ├── ocr.test.ts
│   │   ├── embeddings.test.ts
│   │   ├── quality.test.ts
│   │   └── rag.test.ts
│   └── utils/
│       ├── npi.test.ts
│       └── validators.test.ts
├── integration/
│   ├── api/
│   │   ├── claims.test.ts
│   │   └── review.test.ts
│   └── workflow/
│       └── pipeline.test.ts
└── fixtures/
    ├── claims/
    │   ├── valid-cms1500.json
    │   └── invalid-claim.json
    └── images/
        └── sample-claim.png
```

#### 13.2 Test Configuration

```typescript
// vitest.config.ts
export default {
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      threshold: { lines: 80, functions: 80, branches: 70 }
    }
  }
}
```

---

### Phase 14: Enhanced Features (Priority: MEDIUM)

#### 14.1 PDF Processing

**Current:** Only image processing
**Enhancement:** Native PDF parsing with pdf-lib

```typescript
// Features:
- Extract text from digital PDFs (no OCR needed)
- Extract embedded images for OCR
- Handle multi-page PDFs
- Detect form fields in PDF forms
```

#### 14.2 Expanded Code Sets

**Current:** 34 ICD-10, 46 CPT, 35 HCPCS codes
**Enhancement:** Full production code sets

| Code Set | Current | Target |
|----------|---------|--------|
| ICD-10 | 34 | 5,000+ common codes |
| CPT | 46 | 500+ common codes |
| HCPCS | 35 | 200+ common codes |

#### 14.3 Vision Extraction Improvements

**Current Issues (from test results):**
- Missing patient name, provider NPI
- Some ICD-10 codes not recognized (F90.0, Z65.4)
- Empty procedure codes

**Improvements:**
```typescript
// Enhanced prompts with:
- More specific field extraction instructions
- Better handling of handwritten text
- Checkbox detection for form fields
- Multi-pass extraction for low-confidence fields
```

#### 14.4 Real Database Support

**Current:** File-based JSON storage
**Enhancement:** PostgreSQL with Prisma

```typescript
// Schema additions:
- claims table
- documents table
- validation_results table
- adjudication_decisions table
- review_queue table
- audit_log table
```

---

### Phase 15: Production Readiness (Priority: LOW)

#### 15.1 Authentication & Authorization

```typescript
// Features:
- API key authentication
- JWT for user sessions
- Role-based access control (RBAC)
- Audit logging
```

#### 15.2 Monitoring & Observability

```typescript
// Features:
- Prometheus metrics endpoint
- Structured logging (JSON)
- Error tracking (Sentry integration)
- Health check endpoints
- Processing metrics dashboard
```

#### 15.3 CI/CD Pipeline

```yaml
# GitHub Actions workflow:
- Lint and type check
- Run unit tests
- Run integration tests
- Build Docker image
- Deploy to staging/production
```

#### 15.4 Docker Support

```dockerfile
# Dockerfile for containerized deployment
- Multi-stage build
- Health checks
- Non-root user
- Environment configuration
```

---

## Implementation Priority Matrix

| Phase | Priority | Effort | Business Value | Dependencies | Status |
|-------|----------|--------|----------------|--------------|--------|
| Phase 10: Orchestrator | HIGH | Medium | HIGH - Automation | None | ✅ Complete |
| Phase 11: API Layer | HIGH | Medium | HIGH - Integration | Phase 10 | ✅ COMPLETED |
| Phase 12: Web UI | HIGH | High | HIGH - User Experience | Phase 11 | ✅ COMPLETED |
| Phase 13: Test Suite | MEDIUM | Medium | MEDIUM - Quality | None | Planned |
| Phase 14: Enhanced Features | MEDIUM | High | HIGH - Accuracy | None | Planned |
| Phase 15: Production | LOW | High | MEDIUM - Operations | All above | Planned |

---

## Recommended Next Steps

### ✅ COMPLETED: API Layer (Phase 11)

1. **Express Server Setup** ✅
   - Installed dependencies: express, cors, helmet, multer, socket.io
   - Created `src/api/server.ts` with Express configuration
   - Added middleware for CORS, helmet, rate limiting
   - Configured multer for file uploads (10MB limit)

2. **Core API Endpoints** ✅
   - `POST /api/claims` - Document upload with orchestrator integration
   - `GET /api/claims/:id` - Claim status and data retrieval
   - `GET /api/claims` - List claims with filtering
   - `POST /api/review-queue/:id/review` - Human review submission
   - `GET /api/review-queue` - Pending review list

3. **WebSocket Integration** ✅
   - Socket.IO for real-time updates
   - Orchestrator events bridged to WebSocket broadcasts
   - Client subscription management (subscribe:claim, subscribe:all)

### ✅ COMPLETED: Web UI (Phase 12)

4. **UI Project Setup** ✅
   - Vite + React 18 + TypeScript project in `src/ui/`
   - Tailwind CSS with custom theme
   - React Query for server state, Zustand for socket events

5. **Core UI Components** ✅
   - Dashboard with claims overview and real-time status
   - Document upload with drag-and-drop
   - Review queue interface with approve/reject/correct
   - Claim detail with extraction and validation views
   - System health monitoring page

### Immediate Priority: Testing & Production

6. **Formal Test Suite (Phase 13)**
   - Unit tests with Vitest
   - Integration tests for API endpoints
   - E2E tests for UI workflows

7. **Production Preparation (Phase 15)**
   - Database migration (PostgreSQL)
   - Docker containerization
   - CI/CD with GitHub Actions
   - Authentication and authorization

---

## Success Metrics for Next Phase

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p95) | < 200ms | GET endpoints |
| Claim Processing Time (p95) | < 45s | End-to-end |
| API Availability | > 99.5% | Uptime monitoring |
| Test Coverage | > 80% | Lines covered |
| Auto-adjudication Rate | > 75% | No human review |

---

## File Summary - Current State & Next Phases

### Completed Files (Phase 10: Orchestrator) ✅

```
src/orchestrator/
├── index.ts               # Exports and singleton management
├── state.ts               # Claim state management (EventEmitter)
└── workflow.ts            # Pipeline orchestration with routing
```

### Test Scripts Created ✅

```
test-services.ts           # Core service tests
test-agents.ts             # Agent tests
test-rag.ts                # RAG service tests
test-vision.ts             # Vision service tests
test-e2e.ts                # End-to-end pipeline test
test-orchestrator.ts       # Full orchestrator suite
test-state-manager.ts      # State manager tests
test-workflow.ts           # Workflow orchestrator tests
test-review-workflow.ts    # Human review workflow tests
test-concurrent.ts         # Concurrent processing tests
test-events.ts             # Event monitoring tests
```

### Files to Create (Phase 11: API Layer)

```
src/api/
├── server.ts              # Express app configuration
├── websocket.ts           # Socket.IO handler
├── routes/
│   ├── index.ts           # Route aggregation
│   ├── claims.ts          # Claims CRUD endpoints
│   ├── review.ts          # Review queue endpoints
│   ├── query.ts           # RAG query endpoints
│   └── health.ts          # Health check endpoint
└── middleware/
    ├── auth.ts            # API key authentication
    ├── validation.ts      # Zod request validation
    ├── upload.ts          # Multer file upload
    ├── rateLimit.ts       # Rate limiting
    └── error.ts           # Error handling
```

### Files to Create (Phase 12: Web UI)

```
src/ui/
├── components/
│   ├── claims/            # Claim-related components
│   ├── review/            # Review queue components
│   ├── extraction/        # Extraction viewer components
│   └── common/            # Shared components
├── hooks/                 # React Query + Socket.IO hooks
├── pages/                 # Page components
├── App.tsx                # Root component
└── main.tsx               # Entry point
```

**Estimated effort:**
- Phase 11 (API): ~800 lines of code
- Phase 12 (UI): ~2,000 lines of code
