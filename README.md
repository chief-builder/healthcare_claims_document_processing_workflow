# Healthcare Claims Document Processing Workflow

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

### Configuration

Environment variables (`.env`):

```bash
# Authentication (choose one)
CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token    # For Claude Agent SDK
ANTHROPIC_API_KEY=your-api-key              # For Vision (multimodal)

# Application
NODE_ENV=development
LOG_LEVEL=info

# Processing thresholds
AUTO_PROCESS_CONFIDENCE_THRESHOLD=0.85
CORRECTION_CONFIDENCE_THRESHOLD=0.6
```

### Validation Codes

The system includes reference databases for:

- **ICD-10**: 34 common diagnosis codes
- **CPT**: 46 common procedure codes
- **HCPCS**: 35 common supply/drug codes
- **POS**: Place of service codes

### Adjudication Logic

1. **Eligibility Check**: Verify member is active
2. **Coverage Check**: Verify procedure is covered
3. **Fee Schedule**: Look up allowed amount
4. **Benefits Calculation**:
   - Apply deductible (remaining portion)
   - Apply copay (if applicable)
   - Apply coinsurance (% after deductible)
5. **Payment Determination**: Plan paid = Allowed - Patient responsibility

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
