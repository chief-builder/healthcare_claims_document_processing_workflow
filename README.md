# Healthcare Claims Document Processing Workflow

[![API Docs](https://img.shields.io/badge/API%20Docs-Swagger%20UI-85EA2D?logo=swagger)](https://chief-builder.github.io/healthcare_claims_document_processing_workflow/)

An intelligent document processing (IDP) system for healthcare claims using AI-powered extraction, validation, and adjudication. Built with TypeScript and Claude AI.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [Services](#services)
- [Agents](#agents)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [OpenAPI Specification](#openapi-specification)

---

## Overview

This system processes healthcare claims documents (CMS-1500, UB-04, EOB) through an automated pipeline:

```
Document Upload → OCR/Vision → Extraction → Enrichment → Validation → Quality Assessment → Adjudication → RAG Indexing
```

### Key Capabilities

- **Multi-format Support**: CMS-1500 (Professional), UB-04 (Institutional), EOB (Explanation of Benefits)
- **AI-Powered Extraction**: Uses Claude AI for intelligent field extraction and validation
- **Vision Processing**: Direct image analysis for complex layouts and handwritten text
- **RAG (Retrieval-Augmented Generation)**: Query indexed claims using natural language
- **Quality Scoring**: Automated quality assessment with confidence tracking
- **Automated Adjudication**: Coverage determination and payment calculation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HEALTHCARE CLAIMS IDP SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   Document   │───▶│   Intake     │───▶│   Parsing    │───▶│ Extraction│ │
│  │   Upload     │    │   Agent      │    │   Agent      │    │   Agent   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └─────┬─────┘ │
│                                                                     │       │
│  ┌──────────────────────────────────────────────────────────────────┘       │
│  │                                                                          │
│  ▼                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Enrichment  │───▶│  Validation  │───▶│   Quality    │───▶│Adjudication│ │
│  │   Service    │    │   Agent      │    │   Service    │    │   Agent   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └─────┬─────┘ │
│                                                                     │       │
│  ┌──────────────────────────────────────────────────────────────────┘       │
│  │                                                                          │
│  ▼                                                                          │
│  ┌──────────────┐    ┌──────────────┐                                       │
│  │     RAG      │◀──▶│   Vector     │                                       │
│  │   Service    │    │   Store      │                                       │
│  └──────────────┘    └──────────────┘                                       │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                            SUPPORTING SERVICES                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    OCR      │  │   Vision    │  │  Embeddings │  │   Storage   │         │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Claude    │  │   Quality   │  │   Feedback  │  │    Queue    │         │
│  │   Agent     │  │   Service   │  │   Service   │  │   Service   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Document Processing

| Feature | Description |
|---------|-------------|
| **OCR** | Text extraction using Tesseract.js with preprocessing |
| **Vision AI** | Direct image analysis for layout, tables, handwriting |
| **Multi-page Support** | Process multi-page documents |
| **Format Detection** | Automatic document type classification |

### Data Extraction

| Feature | Description |
|---------|-------------|
| **Patient Info** | Member ID, name, DOB, gender, address |
| **Provider Info** | NPI, name, tax ID, specialty, address |
| **Diagnoses** | ICD-10 codes with descriptions |
| **Service Lines** | Procedure codes, dates, charges, modifiers |
| **Totals** | Charges, payments, patient responsibility |

### Validation

| Feature | Description |
|---------|-------------|
| **NPI Validation** | Luhn algorithm checksum verification |
| **ICD-10 Codes** | Reference database lookup (34 common codes) |
| **CPT Codes** | Reference database lookup (46 common codes) |
| **HCPCS Codes** | Reference database lookup (35 common codes) |
| **Date Validation** | Format and logical checks |
| **Business Rules** | Required fields, cross-field validation |

### Quality Assessment

| Feature | Description |
|---------|-------------|
| **LLM Grading** | Claude AI evaluates extraction quality |
| **Confidence Tracking** | Per-field confidence scores |
| **Review Flagging** | Automatic escalation for low confidence |
| **Grade Scale** | A (>90%), B (80-90%), C (70-80%), D (60-70%), F (<60%) |

### Adjudication

| Feature | Description |
|---------|-------------|
| **Eligibility Check** | Member coverage verification |
| **Coverage Check** | Procedure code coverage lookup |
| **Fee Schedule** | Allowed amount calculation |
| **Benefits Application** | Deductible, copay, coinsurance |
| **Payment Calculation** | Plan paid vs patient responsibility |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Installation

```bash
# Clone repository
git clone <repository-url>
cd healthcare_claims_document_processing_workflow

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your OAuth token
# CLAUDE_CODE_OAUTH_TOKEN=your-token-here

# Create data directories
mkdir -p data/storage data/uploads

# Build
npm run build
```

### Running Tests

```bash
# Core service tests
npx tsx test-services.ts all

# Agent tests
npx tsx test-agents.ts all

# RAG service tests
npx tsx test-rag.ts

# Vision service tests (requires ANTHROPIC_API_KEY)
npx tsx test-vision.ts

# End-to-end tests
npx tsx test-e2e.ts
npx tsx test-comprehensive-e2e.ts

# Test with sample fixtures
npx tsx test-with-fixtures.ts
```

---

## Project Structure

```
healthcare_claims_document_processing_workflow/
├── src/
│   ├── agents/                 # Processing agents
│   │   ├── base.ts            # Base agent class
│   │   ├── intake.ts          # Document intake
│   │   ├── parsing.ts         # Document parsing
│   │   ├── extraction.ts      # Field extraction
│   │   ├── validation.ts      # Data validation
│   │   ├── correction.ts      # Error correction
│   │   └── adjudication.ts    # Payment adjudication
│   │
│   ├── services/               # Core services
│   │   ├── claude-agent.ts    # Claude Agent SDK wrapper
│   │   ├── ocr.ts             # OCR processing
│   │   ├── vision.ts          # Vision/multimodal AI
│   │   ├── embeddings.ts      # Text embeddings
│   │   ├── vectorstore.ts     # Vector storage
│   │   ├── rag.ts             # RAG pipeline
│   │   ├── quality.ts         # Quality assessment
│   │   ├── enrichment.ts      # Data enrichment
│   │   ├── storage.ts         # File storage
│   │   ├── queue.ts           # Job queue
│   │   └── feedback.ts        # Human feedback
│   │
│   ├── models/                 # Data models (Zod schemas)
│   │   ├── claim.ts           # Claim data structures
│   │   ├── validation.ts      # Validation result types
│   │   └── adjudication.ts    # Adjudication types
│   │
│   ├── data/                   # Reference data
│   │   ├── icd10-codes.json   # ICD-10 diagnosis codes
│   │   ├── cpt-codes.json     # CPT procedure codes
│   │   ├── hcpcs-codes.json   # HCPCS codes
│   │   └── pos-codes.json     # Place of service codes
│   │
│   ├── utils/                  # Utilities
│   │   ├── validators.ts      # Code validation
│   │   ├── npi.ts             # NPI validation
│   │   ├── hash.ts            # Document hashing
│   │   └── logger.ts          # Logging
│   │
│   └── config/                 # Configuration
│       └── index.ts           # App config
│
├── test-fixtures/              # Test data
│   └── sample-claims.ts       # Sample claims
│
├── data/                       # Runtime data
│   ├── storage/               # Stored claims
│   └── uploads/               # Uploaded files
│
└── test-*.ts                   # Test scripts
```

---

## Data Models

### Document Types

```typescript
type DocumentType = 'cms_1500' | 'ub_04' | 'eob' | 'unknown';
```

| Type | Description |
|------|-------------|
| `cms_1500` | Professional/Physician claims |
| `ub_04` | Institutional/Hospital claims |
| `eob` | Explanation of Benefits |
| `unknown` | Unclassified documents |

### Claim Status

```typescript
type ClaimStatus =
  | 'received'       // Initial state
  | 'parsing'        // Document being parsed
  | 'extracting'     // Fields being extracted
  | 'validating'     // Data being validated
  | 'correcting'     // Errors being corrected
  | 'pending_review' // Human review required
  | 'adjudicating'   // Payment being calculated
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
    dateOfBirth: string;
    gender?: 'M' | 'F' | 'U';
    address?: Address;
  };
  provider: {
    npi: string;
    name: string;
    taxId?: string;
    specialty?: string;
    address?: Address;
  };
  diagnoses: Array<{
    code: string;
    description?: string;
    isPrimary: boolean;
  }>;
  serviceLines: Array<{
    lineNumber: number;
    dateOfService: string;
    procedureCode: string;
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
  confidenceScores: Record<string, number>;
  provenance: Record<string, Provenance>;
}
```

---

## Services

### Claude Agent Service

Wrapper for Claude Agent SDK with OAuth token authentication.

```typescript
import { getClaudeAgentService } from './src/services/claude-agent.js';

const claude = getClaudeAgentService();

// Simple prompt
const response = await claude.prompt('Analyze this claim...');

// JSON response
const data = await claude.promptForJSON<MyType>('Extract fields...');
```

### OCR Service

Text extraction from document images.

```typescript
import { getOCRService } from './src/services/ocr.js';

const ocr = getOCRService();
const result = await ocr.extractText(imageBuffer);
// Returns: { text, confidence, words, lines }
```

### Vision Service

Multimodal AI for document analysis. Requires `ANTHROPIC_API_KEY`.

```typescript
import { getVisionService } from './src/services/vision.js';

const vision = getVisionService();

// Layout analysis
const layout = await vision.analyzeLayout(imageBuffer);

// Form field extraction
const fields = await vision.extractFormFields(imageBuffer);

// Full claim extraction
const result = await vision.extractFromImage(imageBuffer);
```

### RAG Service

Retrieval-Augmented Generation for claim querying.

```typescript
import { getRAGService } from './src/services/rag.js';

const rag = getRAGService();

// Index a claim
await rag.indexClaim(extractedClaim);

// Query claims
const response = await rag.query({
  question: 'Which patients have diabetes?',
  maxChunks: 5,
  minRelevance: 0.5
});

// Find similar claims
const similar = await rag.findSimilarClaims(claimId, 5);
```

### Quality Service

LLM-based quality assessment.

```typescript
import { getQualityService } from './src/services/quality.js';

const quality = getQualityService();

const evaluation = await quality.evaluateExtraction({
  extractedClaim: claim,
  ocrText: rawText,
  validationResult: validationResult
});

// Returns:
// {
//   overallScore: 0.91,
//   grade: 'A',
//   requiresReview: false,
//   dimensions: { completeness, accuracy, consistency, formatting },
//   lowConfidenceFields: []
// }
```

### Enrichment Service

Data normalization and enrichment.

```typescript
import { getEnrichmentService } from './src/services/enrichment.js';

const enrichment = getEnrichmentService();

const result = await enrichment.enrichClaim(extractedClaim);
// Returns: { enrichedClaim, normalizations, enrichments, overallConfidence }
```

### Embeddings Service

Text embeddings for semantic search.

```typescript
import { getEmbeddingsService } from './src/services/embeddings.js';

const embeddings = getEmbeddingsService();

// Generate embedding
const embedding = await embeddings.embed(text);

// Chunk and embed
const chunks = await embeddings.chunkAndEmbed(text, {
  strategy: 'semantic', // 'fixed', 'sentence', 'paragraph', 'semantic'
  maxChunkSize: 500,
  overlap: 50
});
```

---

## Agents

### Base Agent

All agents extend `BaseAgent<TInput, TOutput>` with:

- Automatic logging (start, complete, error)
- Retry with exponential backoff
- Confidence-based routing
- Status transitions

### Agent Types

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| `IntakeAgent` | Document upload/storage | File buffer | Claim record |
| `ParsingAgent` | Document parsing | Claim record | Parsed data |
| `ExtractionAgent` | Field extraction | Parsed data | Extracted claim |
| `ValidationAgent` | Data validation | Extracted claim | Validation result |
| `CorrectionAgent` | Error correction | Validation errors | Corrected claim |
| `AdjudicationAgent` | Payment calculation | Validated claim | Decision |

### Usage Example

```typescript
import { ValidationAgent } from './src/agents/validation.js';
import { AdjudicationAgent } from './src/agents/adjudication.js';

const validator = new ValidationAgent();
const adjudicator = new AdjudicationAgent();

// Validate
const validation = await validator.execute(
  { extractedClaim },
  claimRecord
);

// Adjudicate
const adjudication = await adjudicator.execute(
  { extractedClaim },
  { ...claimRecord, status: 'adjudicating' }
);
```

---

## Testing

### Test Scripts

| Script | Description | Command |
|--------|-------------|---------|
| `test-services.ts` | Core service tests | `npx tsx test-services.ts all` |
| `test-agents.ts` | Agent tests | `npx tsx test-agents.ts all` |
| `test-rag.ts` | RAG service tests | `npx tsx test-rag.ts` |
| `test-vision.ts` | Vision service tests | `npx tsx test-vision.ts` |
| `test-e2e.ts` | Simple E2E test | `npx tsx test-e2e.ts` |
| `test-comprehensive-e2e.ts` | Full E2E with image | `npx tsx test-comprehensive-e2e.ts` |
| `test-with-fixtures.ts` | Test with sample data | `npx tsx test-with-fixtures.ts` |

### Test Fixtures

Sample claims are provided in `test-fixtures/sample-claims.ts`:

- **CMS-1500 Claims**: Diabetes, Cardiology, Orthopedic
- **UB-04 Claims**: ER Visit, Surgery
- **EOB Claims**: Processed office visit
- **Edge Cases**: Missing fields, invalid codes, low confidence

### Adding Test Images

Place a CMS-1500 claim image at `test-claim.png` for vision tests.

---

## API Reference

The system provides a RESTful API with WebSocket support. Full OpenAPI 3.0 specification available in [`openapi.yaml`](./openapi.yaml).

### Starting the Server

```bash
# Start the API server
npx tsx test-api.ts

# Server runs on http://localhost:3000
```

### Authentication

All endpoints except health checks require API key authentication:

```bash
# Using Bearer token (recommended)
curl -H "Authorization: Bearer dev-api-key" http://localhost:3000/api/claims

# Using X-API-Key header
curl -H "X-API-Key: dev-api-key" http://localhost:3000/api/claims
```

| Environment | API Key | Configuration |
|-------------|---------|---------------|
| Development | `dev-api-key` | Default |
| Production | Custom | Set `API_KEYS` env var |

### API Endpoints

#### Health Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Basic health check | No |
| GET | `/api/health/detailed` | Detailed health with components | No |
| GET | `/api/health/ready` | Kubernetes readiness probe | No |
| GET | `/api/health/live` | Kubernetes liveness probe | No |

#### Claims Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/claims` | Submit document for processing | Yes |
| GET | `/api/claims` | List claims with filtering | Yes |
| GET | `/api/claims/:id` | Get claim details | Yes |
| GET | `/api/claims/:id/extraction` | Get extraction results | Yes |
| GET | `/api/claims/:id/validation` | Get validation results | Yes |
| GET | `/api/claims/:id/adjudication` | Get adjudication decision | Yes |
| GET | `/api/claims/:id/history` | Get processing history | Yes |
| DELETE | `/api/claims/:id` | Delete a claim | Yes |

#### Review Queue Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/review-queue` | Get claims pending review | Yes |
| GET | `/api/review-queue/:id` | Get review details | Yes |
| POST | `/api/review-queue/:id/review` | Submit review decision | Yes |
| GET | `/api/review-queue/stats/summary` | Get review statistics | Yes |

#### Query (RAG) Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/query` | Natural language query | Yes |
| GET | `/api/query/claims/:id/similar` | Find similar claims | Yes |
| POST | `/api/query/claims/:id/index` | Index claim for RAG | Yes |
| GET | `/api/query/stats` | Get RAG statistics | Yes |

### Rate Limits

| Type | Limit | Applies To |
|------|-------|------------|
| **Strict** | 20 req/15 min | Document upload |
| **Query** | 30 req/15 min | LLM operations |
| **Default** | 100 req/15 min | Standard endpoints |
| **Lenient** | 500 req/15 min | Read operations |

### Quick Examples

**Submit a claim:**
```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Authorization: Bearer dev-api-key" \
  -F "document=@test-data/claim-diabetes-routine.png" \
  -F "priority=normal"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "claimId": "CLM-1765756746449-9B658184",
    "status": "completed",
    "processingTimeMs": 39510
  },
  "message": "Document submitted for processing"
}
```

**Get validation results:**
```bash
curl -H "Authorization: Bearer dev-api-key" \
  "http://localhost:3000/api/claims/CLM-xxx/validation"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "errors": [
      {"field": "provider.npi", "message": "NPI checksum is invalid", "isCorrectable": true}
    ],
    "warnings": [
      {"field": "serviceLines.0.chargeAmount", "message": "Charge amount appears low for CPT 99213"}
    ],
    "overallConfidence": 0.785
  }
}
```

**Submit review decision:**
```bash
curl -X POST "http://localhost:3000/api/review-queue/CLM-xxx/review" \
  -H "Authorization: Bearer dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

**Natural language query:**
```bash
curl -X POST "http://localhost:3000/api/query" \
  -H "Authorization: Bearer dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{"question": "What diabetes-related claims have been processed?", "maxChunks": 5}'
```

### Manual Testing

A comprehensive test script is provided:

```bash
# Run all API tests
./test-manual-api.sh
```

See [`MANUAL_TESTING.md`](./MANUAL_TESTING.md) Section 8 for detailed testing instructions.

---

## OpenAPI Specification

A complete OpenAPI 3.0 specification is available at [`openapi.yaml`](./openapi.yaml). This specification includes:

- All API endpoints with request/response schemas
- Authentication methods (Bearer token, API key)
- Rate limiting documentation
- Error response formats
- Example requests and responses

### Interactive API Documentation

**View online (recommended):**

👉 **[https://chief-builder.github.io/healthcare_claims_document_processing_workflow/](https://chief-builder.github.io/healthcare_claims_document_processing_workflow/)**

The hosted Swagger UI provides:
- Interactive API explorer with "Try it out" functionality
- Request/response examples
- Schema documentation
- Authentication testing

### Using the Specification Locally

**View in Swagger UI (Docker):**
```bash
docker run -p 8080:8080 -e SWAGGER_JSON=/spec/openapi.yaml -v $(pwd):/spec swaggerapi/swagger-ui

# Open http://localhost:8080
```

**Generate Client SDKs:**
```bash
# Using OpenAPI Generator
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ./generated-client
```

**Import into Postman:**
1. Open Postman
2. Click Import → File
3. Select `openapi.yaml`
4. All endpoints will be imported with examples

---

## Configuration

### Processing Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| Auto-process | 0.85 | Auto-approve if confidence >= 85% |
| Correction | 0.60 | Attempt correction if 60-85% |
| Escalation | < 0.60 | Human review if < 60% |

### Mock Data (Development)

The adjudication agent includes mock data for testing:

- **Eligibility**: All members eligible by default
- **Benefits**: $500 deductible, 20% coinsurance
- **Fee Schedule**: Common CPT codes with allowed amounts
- **Covered Procedures**: Standard E&M, labs, imaging

---

## License

MIT License

---

## Contributing

Contributions are welcome! Please read the contribution guidelines before submitting a pull request.
