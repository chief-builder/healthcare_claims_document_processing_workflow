# Healthcare Claims Document Processing Workflow

[![API Docs](https://img.shields.io/badge/API%20Docs-Swagger%20UI-85EA2D?logo=swagger)](https://chief-builder.github.io/healthcare_claims_document_processing_workflow/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Claude AI](https://img.shields.io/badge/Claude%20AI-Powered-orange)](https://www.anthropic.com/)

An intelligent document processing (IDP) system for healthcare claims using AI-powered extraction, validation, and adjudication. Built with TypeScript and Claude AI.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Processing Pipeline](#processing-pipeline)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [Services](#services)
- [Agents](#agents)
- [API Reference](#api-reference)
- [Real-time Updates](#real-time-updates)
- [Testing](#testing)
- [Configuration](#configuration)
- [OpenAPI Specification](#openapi-specification)

---

## Overview

This system automates the end-to-end processing of healthcare claims documents (CMS-1500, UB-04, EOB) through an intelligent pipeline that combines OCR, Vision AI, and Large Language Models.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Multi-format Support** | CMS-1500 (Professional), UB-04 (Institutional), EOB (Explanation of Benefits) |
| **AI-Powered Extraction** | Claude AI extracts structured data from unstructured documents |
| **Vision Processing** | Direct image analysis for complex layouts and handwritten text |
| **Code Validation** | NPI, ICD-10, CPT, and HCPCS code validation against reference databases |
| **Quality Scoring** | LLM-graded extraction quality with per-field confidence scores |
| **Automated Adjudication** | Coverage determination, fee schedule lookup, and payment calculation |
| **RAG Queries** | Natural language queries against indexed claims |
| **Real-time Updates** | WebSocket notifications for processing status changes |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        HEALTHCARE CLAIMS IDP SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────┐      ┌──────────────────────────────────────────────────┐     │
│   │   Client    │      │              REST API (Express)                  │     │
│   │  (Browser)  │◄────►│  /api/claims  /api/review-queue  /api/query      │     │
│   └──────┬──────┘      └──────────────────────┬───────────────────────────┘     │
│          │                                    │                                 │
│          │ WebSocket                          │                                 │
│          │ (Socket.IO)                        ▼                                 │
│          │                    ┌───────────────────────────────┐                 │
│          └───────────────────►│    Workflow Orchestrator      │                 │
│                               │    (Event-Driven Pipeline)    │                 │
│                               └───────────────┬───────────────┘                 │
│                                               │                                 │
│  ┌────────────────────────────────────────────┼────────────────────────────┐    │
│  │                         PROCESSING PIPELINE                             │    │
│  │                                                                         │    │
│  │   ┌─────────┐    ┌─────────┐    ┌───────────┐    ┌──────────────┐       │    │ 
│  │   │ Intake  │───►│ Parsing │───►│ Extraction│───►│  Validation  │       │    │
│  │   │ Agent   │    │  Agent  │    │   Agent   │    │    Agent     │       │    │
│  │   └─────────┘    └─────────┘    └───────────┘    └──────┬───────┘       │    │
│  │                                                         │               │    │
│  │                                    ┌────────────────────┼────────────┐  │    │
│  │                                    │                    │            │  │    │
│  │                                    ▼                    ▼            ▼  │    │
│  │                            ┌─────────────┐    ┌─────────────┐  ┌──────┐ │    │
│  │                            │ Correction  │    │ Adjudication│  │Review│ │    │
│  │                            │   Agent     │    │    Agent    │  │Queue │ │    │
│  │                            └─────────────┘    └──────┬──────┘  └──────┘ │    │
│  │                                                      │                  │    │
│  └──────────────────────────────────────────────────────┼──────────────────┘    │
│                                                         │                       │
│  ┌──────────────────────────────────────────────────────┼───────────────────┐   │
│  │                          SERVICES LAYER              │                   │   │
│  │                                                      ▼                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  ┌────────┐  │   │
│  │  │   LLM   │  │   OCR   │  │ Vision  │  │   RAG Service   │  │Storage │  │   │
│  │  │ Service │  │ Service │  │ Service │  │ (Vector Search) │  │Service │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘  └────────┘  │   │
│  │                                                                          │   │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────────────┐  │   │
│  │  │ Quality │  │Enrichmt │  │Embeddings│  │ Queue   │  │  Feedback     │  │   │
│  │  │ Service │  │ Service │  │ Service  │  │ Service │  │  Service      │  │   │
│  │  └─────────┘  └─────────┘  └──────────┘  └─────────┘  └───────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technologies |
|-------|--------------|
| **API** | Express.js, Socket.IO, Multer |
| **AI/ML** | Claude AI (Anthropic), Tesseract.js |
| **Data** | In-memory Vector Store, JSON Storage |
| **Validation** | Zod Schemas, Custom Validators |
| **Language** | TypeScript 5.0, Node.js 20+ |

---

## Processing Pipeline

### Claim Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CLAIM PROCESSING FLOW                              │
└──────────────────────────────────────────────────────────────────────────────┘

    Document
    Upload
       │
       ▼
  ┌─────────┐     ┌─────────┐     ┌───────────┐     ┌────────────┐
  │RECEIVED │────►│ PARSING │────►│EXTRACTING │────►│ VALIDATING │
  └─────────┘     └─────────┘     └───────────┘     └─────┬──────┘
                                                          │
                       ┌──────────────────────────────────┼───────────────────┐
                       │                                  │                   │
                       │         Confidence Check         │                   │
                       │                                  │                   │
                       ▼                                  ▼                   ▼
                 ┌──────────┐                    ┌─────────────┐      ┌────────────┐
                 │CORRECTING│                    │ADJUDICATING │      │PENDING     │
                 │          │                    │             │      │REVIEW      │
                 └────┬─────┘                    └──────┬──────┘      └────────────┘
                      │                                 │                    │
                      │ Retry                           │                    │ Human
                      │ (max 3)                         │                    │ Decision
                      ▼                                 ▼                    │
               ┌───────────┐                     ┌───────────┐               │
               │  FAILED   │                     │ COMPLETED │◄─────────────-┘
               └───────────┘                     └───────────┘
                                                       │
                                                       ▼
                                                 ┌───────────-┐
                                                 │RAG INDEX   │
                                                 │(Searchable)│
                                                 └───────────-┘
```

### Status Transitions

| From Status | To Status | Trigger |
|-------------|-----------|---------|
| `received` | `parsing` | Document intake completed |
| `parsing` | `extracting` | OCR/Vision processing done |
| `extracting` | `validating` | Fields extracted (confidence ≥ 0.5) |
| `extracting` | `pending_review` | Low confidence (< 0.5) |
| `validating` | `adjudicating` | Validation passed (confidence ≥ 0.85) |
| `validating` | `correcting` | Validation issues (0.60 - 0.85) |
| `validating` | `pending_review` | Low confidence (< 0.60) |
| `correcting` | `validating` | Correction attempted |
| `correcting` | `failed` | Max attempts exceeded |
| `adjudicating` | `completed` | Payment calculated |
| `pending_review` | `completed` | Human approved |
| `pending_review` | `failed` | Human rejected |

### Confidence Thresholds

```
 0%                    60%                   85%                  100%
  │                     │                     │                     │
  │   HUMAN REVIEW      │    CORRECTION       │   AUTO-PROCESS      │
  │   (Escalation)      │    (Retry Loop)     │   (Full Automation) │
  │◄───────────────────►│◄───────────────────►│◄───────────────────►│
```

---

## Features

### Document Processing

| Feature | Description | Service |
|---------|-------------|---------|
| **OCR** | Text extraction using Tesseract.js with preprocessing | `OCRService` |
| **Vision AI** | Direct image analysis for layout, tables, handwriting | `VisionService` |
| **Document Classification** | Automatic CMS-1500/UB-04/EOB detection | `LLMService` |
| **Multi-page Support** | Process multi-page document images | `ParsingAgent` |

### Data Extraction

| Field Category | Extracted Fields |
|----------------|------------------|
| **Patient** | Member ID, Name, DOB, Gender, Address |
| **Provider** | NPI, Name, Tax ID, Specialty, Address |
| **Diagnoses** | ICD-10 codes with descriptions, Primary indicator |
| **Service Lines** | CPT/HCPCS codes, Dates, Charges, Modifiers, Units |
| **Totals** | Total Charges, Amount Paid, Patient Responsibility |

### Validation

| Validation Type | Method | Reference Data |
|-----------------|--------|----------------|
| **NPI** | Luhn algorithm checksum | Algorithm-based |
| **ICD-10** | Database lookup | 34 common codes |
| **CPT** | Database lookup | 46 common codes |
| **HCPCS** | Database lookup | 35 common codes |
| **Dates** | Format + logical checks | Business rules |
| **Required Fields** | Completeness check | Schema-based |

### Adjudication

| Step | Description |
|------|-------------|
| **Eligibility** | Verify member coverage status |
| **Coverage** | Check procedure code coverage |
| **Fee Schedule** | Look up allowed amounts |
| **Benefits** | Apply deductible, copay, coinsurance |
| **Payment** | Calculate plan paid vs patient responsibility |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- Anthropic API Key (for Claude AI)

### Installation

```bash
# Clone repository
git clone https://github.com/chief-builder/healthcare_claims_document_processing_workflow.git
cd healthcare_claims_document_processing_workflow

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env:
#   ANTHROPIC_API_KEY=your-api-key
#   CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token (alternative)

# Create data directories
mkdir -p data/storage data/uploads

# Build
npm run build
```

### Start the API Server

```bash
# Start server on port 3000
npx tsx test-api.ts

# Server endpoints:
#   REST API: http://localhost:3000/api
#   WebSocket: ws://localhost:3000
#   Health:   http://localhost:3000/api/health
```

### Submit Your First Claim

```bash
# Submit a document for processing
curl -X POST http://localhost:3000/api/claims \
  -H "Authorization: Bearer dev-api-key" \
  -F "document=@your-claim.png" \
  -F "priority=normal"

# Response:
# {
#   "success": true,
#   "data": {
#     "claimId": "CLM-1234567890-ABCD1234",
#     "status": "completed",
#     "processingTimeMs": 35000
#   }
# }
```

---

## Project Structure

```
healthcare_claims_document_processing_workflow/
├── src/
│   ├── api/                      # REST API Layer
│   │   ├── server.ts             # Express server setup
│   │   ├── websocket.ts          # Socket.IO real-time updates
│   │   ├── routes/
│   │   │   ├── claims.ts         # /api/claims endpoints
│   │   │   ├── review.ts         # /api/review-queue endpoints
│   │   │   ├── query.ts          # /api/query (RAG) endpoints
│   │   │   └── health.ts         # Health check endpoints
│   │   └── middleware/
│   │       ├── auth.ts           # API key authentication
│   │       ├── rateLimit.ts      # Rate limiting
│   │       ├── upload.ts         # File upload (Multer)
│   │       └── validation.ts     # Request validation
│   │
│   ├── orchestrator/             # Workflow Engine
│   │   ├── workflow.ts           # Main orchestrator
│   │   └── state.ts              # State machine & persistence
│   │
│   ├── agents/                   # Processing Agents
│   │   ├── base.ts               # Base agent class
│   │   ├── intake.ts             # Document intake
│   │   ├── parsing.ts            # OCR/Vision parsing
│   │   ├── extraction.ts         # Field extraction
│   │   ├── validation.ts         # Data validation
│   │   ├── correction.ts         # Error correction
│   │   └── adjudication.ts       # Payment calculation
│   │
│   ├── services/                 # Core Services
│   │   ├── llm.ts                # Claude AI integration
│   │   ├── ocr.ts                # Tesseract.js OCR
│   │   ├── vision.ts             # Vision/multimodal AI
│   │   ├── rag.ts                # RAG pipeline
│   │   ├── vectorstore.ts        # Vector storage
│   │   ├── embeddings.ts         # Text embeddings
│   │   ├── quality.ts            # Quality assessment
│   │   ├── enrichment.ts         # Data enrichment
│   │   ├── storage.ts            # Claim persistence
│   │   ├── queue.ts              # Job queue
│   │   └── feedback.ts           # Human feedback
│   │
│   ├── models/                   # Data Models (Zod)
│   │   ├── claim.ts              # Claim schemas
│   │   ├── validation.ts         # Validation types
│   │   └── adjudication.ts       # Adjudication types
│   │
│   ├── data/                     # Reference Data
│   │   ├── icd10-codes.json      # ICD-10 codes (34)
│   │   ├── cpt-codes.json        # CPT codes (46)
│   │   ├── hcpcs-codes.json      # HCPCS codes (35)
│   │   └── pos-codes.json        # Place of service
│   │
│   ├── utils/                    # Utilities
│   │   ├── validators.ts         # Code validators
│   │   ├── npi.ts                # NPI validation
│   │   ├── hash.ts               # Document hashing
│   │   └── logger.ts             # Structured logging
│   │
│   └── config/                   # Configuration
│       └── index.ts              # Environment config
│
├── test-fixtures/                # Test Data
│   └── sample-claims.ts          # Sample claim objects
│
├── test-data/                    # Test Images
│   └── *.png                     # Sample claim images
│
├── docs/                         # GitHub Pages
│   └── index.html                # Swagger UI
│
├── openapi.yaml                  # OpenAPI 3.0 Spec
├── test-api.ts                   # API server entry
├── test-manual-api.sh            # API test script
└── MANUAL_TESTING.md             # Testing guide
```

---

## Data Models

### Document Types

| Type | Form | Description |
|------|------|-------------|
| `cms_1500` | CMS-1500 | Professional/Physician claims |
| `ub_04` | UB-04 | Institutional/Hospital claims |
| `eob` | EOB | Explanation of Benefits |
| `unknown` | - | Unclassified documents |

### Claim Status

```typescript
type ClaimStatus =
  | 'received'       // Document uploaded
  | 'parsing'        // OCR/Vision in progress
  | 'extracting'     // LLM extracting fields
  | 'validating'     // Validating extracted data
  | 'correcting'     // Attempting error correction
  | 'pending_review' // Human review required
  | 'adjudicating'   // Calculating payment
  | 'completed'      // Processing complete
  | 'failed';        // Processing failed
```

### Extracted Claim Structure

```typescript
interface ExtractedClaim {
  id: string;
  documentType: DocumentType;

  patient: {
    memberId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;      // YYYY-MM-DD
    gender?: 'M' | 'F' | 'U';
    address?: Address;
  };

  provider: {
    npi: string;              // 10-digit NPI
    name: string;
    taxId?: string;
    specialty?: string;
    address?: Address;
  };

  diagnoses: Array<{
    code: string;             // ICD-10 code
    description?: string;
    isPrimary: boolean;
  }>;

  serviceLines: Array<{
    lineNumber: number;
    dateOfService: string;    // YYYY-MM-DD
    procedureCode: string;    // CPT/HCPCS
    modifiers: string[];
    diagnosisPointers: string[];
    units: number;
    chargeAmount: number;
    placeOfService?: string;
  }>;

  totals: {
    totalCharges: number;
    amountPaid?: number;
    patientResponsibility?: number;
  };

  confidenceScores: Record<string, number>;  // Per-field confidence
  provenance: Record<string, Provenance>;    // Data source tracking
}
```

---

## Services

### LLM Service

The core AI service for document understanding and field extraction.

```typescript
import { getLLMService } from './src/services/llm.js';

const llm = getLLMService();

// Classify document type
const { type, confidence } = await llm.classifyDocument(ocrText);

// Extract all fields
const claim = await llm.extractClaim({
  ocrText,
  documentType: 'cms_1500',
  pageCount: 1
});

// Infer specific field
const field = await llm.inferField('provider.npi', ocrText, existingClaim);

// Correct invalid field
const corrected = await llm.correctField({
  fieldPath: 'provider.npi',
  currentValue: '123456789',
  error: 'NPI checksum is invalid',
  ocrText
});
```

### RAG Service

Query indexed claims using natural language.

```typescript
import { getRAGService } from './src/services/rag.js';

const rag = getRAGService();

// Index a processed claim
await rag.indexClaim(extractedClaim);

// Natural language query
const response = await rag.query({
  question: 'Which patients have diabetes diagnoses?',
  maxChunks: 5,
  minRelevance: 0.5
});

// Find similar claims
const similar = await rag.findSimilarClaims(claimId, 5);

// Get statistics
const stats = await rag.getStats();
// { totalChunks: 150, totalClaims: 25, avgChunksPerClaim: 6 }
```

### Quality Service

LLM-graded quality assessment.

```typescript
import { getQualityService } from './src/services/quality.js';

const quality = getQualityService();

const evaluation = await quality.evaluateExtraction({
  extractedClaim: claim,
  ocrText: rawText,
  validationResult
});

// Returns:
// {
//   overallScore: 0.91,
//   grade: 'A',                    // A, B, C, D, F
//   requiresReview: false,
//   dimensions: {
//     completeness: 0.95,
//     accuracy: 0.88,
//     consistency: 0.92,
//     formatting: 0.90
//   },
//   lowConfidenceFields: []
// }
```

---

## Agents

### Agent Architecture

All agents extend `BaseAgent<TInput, TOutput>` providing:

- **Automatic Logging**: Start, complete, error events
- **Retry Logic**: Exponential backoff with configurable attempts
- **Confidence Routing**: Route based on confidence scores
- **Status Transitions**: Atomic state updates

### Agent Pipeline

| Agent | Input | Output | Description |
|-------|-------|--------|-------------|
| `IntakeAgent` | File buffer | Claim record | Store document, generate ID |
| `ParsingAgent` | Claim record | OCR text | Extract text via OCR/Vision |
| `ExtractionAgent` | OCR text | Extracted claim | LLM field extraction |
| `ValidationAgent` | Extracted claim | Validation result | Validate all fields |
| `CorrectionAgent` | Validation errors | Corrected claim | LLM error correction |
| `AdjudicationAgent` | Validated claim | Payment decision | Calculate payment |

### Usage Example

```typescript
import { WorkflowOrchestrator } from './src/orchestrator/index.js';

const orchestrator = new WorkflowOrchestrator({
  autoProcessThreshold: 0.85,
  correctionThreshold: 0.60,
  maxCorrectionAttempts: 3,
  enableRAGIndexing: true
});

// Listen for events
orchestrator.on('workflow:stage_completed', ({ claimId, stage }) => {
  console.log(`Claim ${claimId} completed ${stage}`);
});

orchestrator.on('workflow:review_required', ({ claimId, reason }) => {
  console.log(`Claim ${claimId} needs review: ${reason}`);
});

// Process document
const result = await orchestrator.processDocument({
  buffer: documentBuffer,
  filename: 'claim.png',
  mimeType: 'image/png',
  priority: 'normal'
});

console.log(result.finalStatus);  // 'completed' or 'pending_review'
```

---

## API Reference

Full OpenAPI 3.0 specification: [`openapi.yaml`](./openapi.yaml)

Interactive documentation: [Swagger UI](https://chief-builder.github.io/healthcare_claims_document_processing_workflow/)

### Authentication

```bash
# Bearer token (recommended)
curl -H "Authorization: Bearer dev-api-key" http://localhost:3000/api/claims

# X-API-Key header
curl -H "X-API-Key: dev-api-key" http://localhost:3000/api/claims
```

### Endpoints Summary

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Health** | `/api/health` | GET | Basic health check |
| | `/api/health/detailed` | GET | Component status |
| **Claims** | `/api/claims` | POST | Submit document |
| | `/api/claims` | GET | List claims |
| | `/api/claims/:id` | GET | Get claim details |
| | `/api/claims/:id/extraction` | GET | Get extracted data |
| | `/api/claims/:id/validation` | GET | Get validation results |
| | `/api/claims/:id/adjudication` | GET | Get payment decision |
| **Review** | `/api/review-queue` | GET | List pending reviews |
| | `/api/review-queue/:id/review` | POST | Submit decision |
| **Query** | `/api/query` | POST | Natural language query |
| | `/api/query/claims/:id/similar` | GET | Find similar claims |

### Rate Limits

| Tier | Limit | Endpoints |
|------|-------|-----------|
| **Strict** | 20/15min | Document upload |
| **Query** | 30/15min | RAG queries |
| **Default** | 100/15min | Most endpoints |
| **Lenient** | 500/15min | Read operations |

---

## Real-time Updates

### WebSocket Events

Connect via Socket.IO for real-time claim processing updates.

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Subscribe to a specific claim
socket.emit('subscribe:claim', 'CLM-1234567890-ABCD1234');

// Listen for status updates
socket.on('claim:status_changed', ({ claimId, status, previousStatus }) => {
  console.log(`${claimId}: ${previousStatus} → ${status}`);
});

// Listen for processing completion
socket.on('claim:completed', ({ claimId, result }) => {
  console.log(`${claimId} completed:`, result);
});

// Listen for errors
socket.on('claim:error', ({ claimId, error }) => {
  console.error(`${claimId} failed:`, error);
});
```

### Available Events

| Event | Payload | Description |
|-------|---------|-------------|
| `claim:status_changed` | `{ claimId, status, previousStatus, timestamp }` | Status transition |
| `claim:stage_started` | `{ claimId, stage, timestamp }` | Processing stage started |
| `claim:stage_completed` | `{ claimId, stage, result, timestamp }` | Processing stage done |
| `claim:completed` | `{ claimId, result, timestamp }` | Full processing complete |
| `claim:error` | `{ claimId, error, timestamp }` | Processing error |
| `claim:review_required` | `{ claimId, reason, timestamp }` | Human review needed |

---

## Testing

### Test Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test-services.ts` | `npx tsx test-services.ts all` | Core service tests |
| `test-agents.ts` | `npx tsx test-agents.ts all` | Agent tests |
| `test-rag.ts` | `npx tsx test-rag.ts` | RAG service tests |
| `test-e2e.ts` | `npx tsx test-e2e.ts` | End-to-end pipeline |
| `test-manual-api.sh` | `./test-manual-api.sh` | Full API test suite |

### Running API Tests

```bash
# Start the server in one terminal
npx tsx test-api.ts

# Run the test script in another terminal
./test-manual-api.sh

# Tests:
#  ✓ Health checks
#  ✓ Authentication
#  ✓ Document upload (5 claims)
#  ✓ Claim filtering
#  ✓ Extraction/Validation/Adjudication
#  ✓ Review queue workflow
#  ✓ RAG queries
#  ✓ Error handling
```

### Test Fixtures

Sample claims in `test-fixtures/sample-claims.ts`:

- **CMS-1500**: Diabetes routine, Cardiology, Orthopedic
- **UB-04**: ER Visit, Surgery
- **EOB**: Processed claims
- **Edge Cases**: Missing fields, invalid codes, low confidence

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Required |
| `CLAUDE_CODE_OAUTH_TOKEN` | Alternative OAuth token | - |
| `PORT` | API server port | `3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `API_KEYS` | Comma-separated API keys | `dev-api-key` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |

### Processing Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| `autoProcessThreshold` | 0.85 | Auto-approve if confidence ≥ 85% |
| `correctionThreshold` | 0.60 | Attempt correction if 60-85% |
| `maxCorrectionAttempts` | 3 | Max correction retries |

---

## OpenAPI Specification

A complete OpenAPI 3.0 specification is available at [`openapi.yaml`](./openapi.yaml).

### Interactive Documentation

👉 **[https://chief-builder.github.io/healthcare_claims_document_processing_workflow/](https://chief-builder.github.io/healthcare_claims_document_processing_workflow/)**

### Local Swagger UI

```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/spec/openapi.yaml \
  -v $(pwd):/spec \
  swaggerapi/swagger-ui
```

### Generate Client SDK

```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ./generated-client
```

---

## License

MIT License

---

## Contributing

Contributions are welcome! Please read the contribution guidelines before submitting a pull request.
