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
| Phase 6: API Layer | ❌ Not Started | Express server, routes, WebSocket |
| Phase 7: Utilities | ✅ Complete | NPI, validators, hash, logger |
| Phase 8: Reference Data | ✅ Complete | ICD-10, CPT, HCPCS, POS codes |
| Phase 9: Testing | ⚠️ Partial | Manual tests only, no vitest |

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
| Comprehensive Test Suite | 7 test scripts with sample fixtures |

---

## Next Enhancement Phases

### Phase 10: Orchestrator Implementation ✅ COMPLETED

**Goal:** Implement automated workflow orchestration for hands-off claim processing.

**Status:** Implemented and tested successfully.

#### 10.1 State Manager (`src/orchestrator/state.ts`)

```typescript
// Features:
- Track claim state transitions
- Persist state to storage
- Enable resumable processing
- Query claim history
- Support concurrent claim processing
```

**Files to create:**
- `src/orchestrator/state.ts` - Claim state management
- `src/orchestrator/index.ts` - Exports

#### 10.2 Workflow Orchestrator (`src/orchestrator/workflow.ts`)

```typescript
// Features:
- Automated pipeline execution
- Confidence-based routing
- Error handling and retries
- Event emission for status updates
- Human review integration
```

**State Machine:**
```
received → parsing → extracting → validating → [correcting] → [pending_review] → adjudicating → completed
                                                                                              ↓
                                                                                           failed
```

**Configuration:**
```typescript
const THRESHOLDS = {
  AUTO_PROCEED: 0.85,        // Auto-advance if confidence >= 85%
  ATTEMPT_CORRECTION: 0.60,  // Attempt correction if 60-85%
  REQUIRE_REVIEW: 0.60       // Human review if < 60%
};
```

---

### Phase 11: API Layer (Priority: HIGH)

**Goal:** Expose RESTful API and WebSocket for external integration.

#### 11.1 Express Server Setup

**Files to create:**
```
src/api/
├── server.ts           # Express app configuration
├── websocket.ts        # WebSocket handler
├── routes/
│   ├── claims.ts       # Claims endpoints
│   ├── review.ts       # Review queue endpoints
│   └── health.ts       # Health check
└── middleware/
    ├── auth.ts         # Authentication (API keys)
    ├── validation.ts   # Request validation
    ├── upload.ts       # File upload (multer)
    └── error.ts        # Error handling
```

#### 11.2 API Endpoints

**Claims API:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/claims` | Upload | Submit document for processing |
| `GET /api/claims/:id` | Read | Get claim status and data |
| `GET /api/claims/:id/extraction` | Read | Get extracted fields |
| `GET /api/claims/:id/validation` | Read | Get validation results |
| `GET /api/claims/:id/adjudication` | Read | Get payment decision |
| `GET /api/claims` | List | List claims with filters |

**Review Queue API:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/review-queue` | List | Get pending reviews |
| `POST /api/claims/:id/review` | Submit | Submit review decision |
| `PUT /api/claims/:id/assign` | Update | Assign reviewer |

**RAG Query API:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/query` | Query | Natural language claim query |
| `GET /api/claims/:id/similar` | Search | Find similar claims |

#### 11.3 WebSocket Events

```typescript
// Server → Client events
'claim:status_changed'    // Status transition
'claim:extraction_complete'
'claim:validation_complete'
'claim:adjudication_complete'
'review:assigned'

// Client → Server events
'subscribe:claim'         // Subscribe to claim updates
'unsubscribe:claim'
```

---

### Phase 12: Formal Test Suite (Priority: MEDIUM)

**Goal:** Add comprehensive unit and integration tests using Vitest.

#### 12.1 Unit Tests

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

#### 12.2 Test Configuration

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

### Phase 13: Enhanced Features (Priority: MEDIUM)

#### 13.1 PDF Processing

**Current:** Only image processing
**Enhancement:** Native PDF parsing with pdf-lib

```typescript
// Features:
- Extract text from digital PDFs (no OCR needed)
- Extract embedded images for OCR
- Handle multi-page PDFs
- Detect form fields in PDF forms
```

#### 13.2 Expanded Code Sets

**Current:** 34 ICD-10, 46 CPT, 35 HCPCS codes
**Enhancement:** Full production code sets

| Code Set | Current | Target |
|----------|---------|--------|
| ICD-10 | 34 | 5,000+ common codes |
| CPT | 46 | 500+ common codes |
| HCPCS | 35 | 200+ common codes |

#### 13.3 Vision Extraction Improvements

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

#### 13.4 Real Database Support

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

### Phase 14: Production Readiness (Priority: LOW)

#### 14.1 Authentication & Authorization

```typescript
// Features:
- API key authentication
- JWT for user sessions
- Role-based access control (RBAC)
- Audit logging
```

#### 14.2 Monitoring & Observability

```typescript
// Features:
- Prometheus metrics endpoint
- Structured logging (JSON)
- Error tracking (Sentry integration)
- Health check endpoints
- Processing metrics dashboard
```

#### 14.3 CI/CD Pipeline

```yaml
# GitHub Actions workflow:
- Lint and type check
- Run unit tests
- Run integration tests
- Build Docker image
- Deploy to staging/production
```

#### 14.4 Docker Support

```dockerfile
# Dockerfile for containerized deployment
- Multi-stage build
- Health checks
- Non-root user
- Environment configuration
```

---

## Implementation Priority Matrix

| Phase | Priority | Effort | Business Value | Dependencies |
|-------|----------|--------|----------------|--------------|
| Phase 10: Orchestrator | HIGH | Medium | HIGH - Automation | None |
| Phase 11: API Layer | HIGH | High | HIGH - Integration | Phase 10 |
| Phase 12: Test Suite | MEDIUM | Medium | MEDIUM - Quality | None |
| Phase 13: Enhanced Features | MEDIUM | High | HIGH - Accuracy | None |
| Phase 14: Production | LOW | High | MEDIUM - Operations | All above |

---

## Recommended Next Steps

### Immediate (Next Sprint)

1. **Implement Orchestrator (Phase 10)**
   - Create `src/orchestrator/state.ts`
   - Create `src/orchestrator/workflow.ts`
   - Add automated claim processing pipeline
   - Implement confidence-based routing

2. **Start API Layer (Phase 11)**
   - Set up Express server
   - Implement claims upload endpoint
   - Add claim status endpoint

### Short-term (2-4 weeks)

3. **Complete API Layer**
   - All CRUD endpoints
   - WebSocket for real-time updates
   - Authentication middleware

4. **Add Formal Tests**
   - Unit tests for critical paths
   - Integration tests for API

### Medium-term (1-2 months)

5. **Enhanced Features**
   - PDF processing
   - Expanded code sets
   - Vision improvements

6. **Production Preparation**
   - Database migration
   - Docker containerization
   - CI/CD setup

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

## File Summary - Phase 10 & 11

**New files to create:**

```
src/
├── orchestrator/
│   ├── index.ts
│   ├── state.ts           # Claim state management
│   └── workflow.ts        # Pipeline orchestration
└── api/
    ├── server.ts          # Express setup
    ├── websocket.ts       # WebSocket handler
    ├── routes/
    │   ├── index.ts
    │   ├── claims.ts
    │   ├── review.ts
    │   └── health.ts
    └── middleware/
        ├── auth.ts
        ├── validation.ts
        ├── upload.ts
        └── error.ts

tests/
├── vitest.config.ts
└── unit/
    └── ...
```

**Estimated effort:** ~2,000 lines of code
