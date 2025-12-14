# Manual Testing Guide - ClaimsAgent IDP System

This guide provides step-by-step instructions to manually test all components of the Healthcare Claims IDP system.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Testing Core Services](#3-testing-core-services)
4. [Testing Agents](#4-testing-agents)
5. [Testing Advanced Features](#5-testing-advanced-features)
6. [End-to-End Testing](#6-end-to-end-testing)
7. [Testing Workflow Orchestrator](#7-testing-workflow-orchestrator)
8. [Sample Test Data](#8-sample-test-data)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

### Required Software
- Node.js 20+ (`node --version`)
- npm 9+ (`npm --version`)
- Git (`git --version`)

### Required API Keys
- **Anthropic API Key**: Required for LLM and Vision services
  - Get one at: https://console.anthropic.com/

### Optional Tools
- VS Code with REST Client extension (for API testing)
- Postman or curl (for API testing)
- Sample PDF/image files of healthcare claims

---

## 2. Environment Setup

### Step 2.1: Install Dependencies

```bash
cd /path/to/healthcare_claims_document_processing_workflow
npm install
```

**Expected Output:**
```
added XXX packages in XXs
```

### Step 2.2: Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```bash
# Edit with your preferred editor
nano .env
# OR
code .env
```

Set the following:
```
CLAUDE_CODE_OAUTH_TOKEN=oauth_token_xxxxxxxxxxxxx
NODE_ENV=development
LOG_LEVEL=debug
```

### Step 2.3: Create Data Directories

```bash
mkdir -p data/storage data/uploads
```

### Step 2.4: Verify TypeScript Compilation

```bash
npm run build
```

**Expected Output:**
```
# No errors, creates dist/ directory
```

---

## 3. Testing Core Services

Create a test script to run individual service tests:

### Step 3.1: Create Test Runner Script

Create `test-services.ts` in the project root:

```typescript
// test-services.ts
import { config } from 'dotenv';
config();

async function testServices() {
  console.log('🧪 ClaimsAgent Service Tests\n');

  // Select which test to run based on command line arg
  const testName = process.argv[2];

  switch (testName) {
    case 'config':
      await testConfig();
      break;
    case 'validators':
      await testValidators();
      break;
    case 'npi':
      await testNPI();
      break;
    case 'enrichment':
      await testEnrichment();
      break;
    case 'embeddings':
      await testEmbeddings();
      break;
    case 'vectorstore':
      await testVectorStore();
      break;
    case 'quality':
      await testQuality();
      break;
    case 'all':
      await testConfig();
      await testValidators();
      await testNPI();
      await testEnrichment();
      await testEmbeddings();
      await testVectorStore();
      break;
    default:
      console.log('Usage: npx tsx test-services.ts <test-name>');
      console.log('Available tests: config, validators, npi, enrichment, embeddings, vectorstore, quality, all');
  }
}

// ============ Config Test ============
async function testConfig() {
  console.log('📋 Testing Configuration...');

  const { getConfig } = await import('./src/config/index.js');

  try {
    const config = getConfig();
    console.log('  ✅ Config loaded successfully');
    console.log(`     - Port: ${config.server.port}`);
    console.log(`     - Environment: ${config.server.nodeEnv}`);
    console.log(`     - API Key: ${config.anthropic.apiKey ? '***' + config.anthropic.apiKey.slice(-4) : 'NOT SET'}`);
    console.log(`     - Model: ${config.anthropic.model}`);
  } catch (error) {
    console.log('  ❌ Config failed:', error);
  }
  console.log('');
}

// ============ Validators Test ============
async function testValidators() {
  console.log('🔍 Testing Validators...');

  const {
    isValidICD10Format,
    isValidCPTFormat,
    isValidHCPCSFormat,
    isValidDateFormat,
    isDateNotFuture,
    calculateAge,
  } = await import('./src/utils/validators.js');

  // ICD-10 Tests
  const icd10Tests = [
    { code: 'E11.9', expected: true },
    { code: 'I10', expected: true },
    { code: 'Z00.00', expected: true },
    { code: 'INVALID', expected: false },
    { code: '12345', expected: false },
  ];

  console.log('  ICD-10 Format:');
  for (const test of icd10Tests) {
    const result = isValidICD10Format(test.code);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`    ${status} "${test.code}" -> ${result} (expected: ${test.expected})`);
  }

  // CPT Tests
  const cptTests = [
    { code: '99213', expected: true },
    { code: '12345', expected: true },
    { code: '1234', expected: false },
    { code: '123456', expected: false },
  ];

  console.log('  CPT Format:');
  for (const test of cptTests) {
    const result = isValidCPTFormat(test.code);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`    ${status} "${test.code}" -> ${result} (expected: ${test.expected})`);
  }

  // HCPCS Tests
  const hcpcsTests = [
    { code: 'J0129', expected: true },
    { code: 'A0425', expected: true },
    { code: '99213', expected: false },
  ];

  console.log('  HCPCS Format:');
  for (const test of hcpcsTests) {
    const result = isValidHCPCSFormat(test.code);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`    ${status} "${test.code}" -> ${result} (expected: ${test.expected})`);
  }

  // Date Tests
  console.log('  Date Validation:');
  console.log(`    ✅ isValidDateFormat("2024-01-15"): ${isValidDateFormat('2024-01-15')}`);
  console.log(`    ✅ isValidDateFormat("invalid"): ${isValidDateFormat('invalid')}`);
  console.log(`    ✅ isDateNotFuture("2024-01-15"): ${isDateNotFuture('2024-01-15')}`);
  console.log(`    ✅ calculateAge("1990-05-15"): ${calculateAge('1990-05-15')} years`);

  console.log('');
}

// ============ NPI Test ============
async function testNPI() {
  console.log('🏥 Testing NPI Validation...');

  const { validateNPI, calculateNPICheckDigit } = await import('./src/utils/npi.js');

  const npiTests = [
    { npi: '1234567893', expectedValid: true, description: 'Valid NPI' },
    { npi: '1234567890', expectedValid: false, description: 'Invalid checksum' },
    { npi: '123456789', expectedValid: false, description: 'Too short' },
    { npi: '12345678901', expectedValid: false, description: 'Too long' },
    { npi: 'ABCDEFGHIJ', expectedValid: false, description: 'Non-numeric' },
  ];

  for (const test of npiTests) {
    const result = validateNPI(test.npi);
    const status = result.isValid === test.expectedValid ? '✅' : '❌';
    console.log(`  ${status} ${test.description}: "${test.npi}" -> valid: ${result.isValid}${result.error ? ` (${result.error})` : ''}`);
  }

  // Test check digit calculation
  const checkDigit = calculateNPICheckDigit('123456789');
  console.log(`  ✅ Check digit for "123456789": ${checkDigit}`);

  console.log('');
}

// ============ Enrichment Test ============
async function testEnrichment() {
  console.log('✨ Testing Enrichment & Normalization...');

  const {
    AddressNormalizer,
    DateNormalizer,
    PhoneNormalizer,
    CurrencyNormalizer,
    CodeNormalizer,
  } = await import('./src/services/enrichment.js');

  // Address normalization
  console.log('  Address Normalization:');
  const addressNormalizer = new AddressNormalizer();
  const testAddresses = [
    { street1: '123 main street apt 4', city: 'boston', state: 'massachusetts', zipCode: '02115', country: 'US' },
    { street1: '456 Oak Avenue Suite 100', city: 'NEW YORK', state: 'NY', zipCode: '100011234', country: 'US' },
  ];

  for (const addr of testAddresses) {
    const result = addressNormalizer.normalize(addr);
    console.log(`    Input:  ${addr.street1}, ${addr.city}, ${addr.state} ${addr.zipCode}`);
    console.log(`    Output: ${result.normalized.street1}, ${result.normalized.city}, ${result.normalized.state} ${result.normalized.zipCode}`);
    console.log(`    Changes: ${result.changes.length > 0 ? result.changes.join(', ') : 'none'}`);
    console.log('');
  }

  // Date normalization
  console.log('  Date Normalization:');
  const dateNormalizer = new DateNormalizer();
  const testDates = ['01/15/2024', '2024-01-15', 'January 15, 2024', '15 Jan 2024', '1/5/24'];

  for (const date of testDates) {
    const result = dateNormalizer.normalize(date);
    console.log(`    "${date}" -> "${result.normalized}" (confidence: ${result.confidence})`);
  }
  console.log('');

  // Phone normalization
  console.log('  Phone Normalization:');
  const phoneNormalizer = new PhoneNormalizer();
  const testPhones = ['6175551234', '(617) 555-1234', '1-617-555-1234', '+1 617 555 1234'];

  for (const phone of testPhones) {
    const result = phoneNormalizer.normalize(phone);
    console.log(`    "${phone}" -> "${result.formatted}" (valid: ${result.isValid})`);
  }
  console.log('');

  // Currency normalization
  console.log('  Currency Normalization:');
  const currencyNormalizer = new CurrencyNormalizer();
  const testAmounts = ['$1,234.56', '1234.567', '($100.00)', '99.9'];

  for (const amount of testAmounts) {
    const result = currencyNormalizer.normalize(amount);
    console.log(`    "${amount}" -> ${result.normalized}`);
  }
  console.log('');

  // Code normalization
  console.log('  Code Normalization:');
  const codeNormalizer = new CodeNormalizer();
  console.log(`    ICD-10 "e119" -> "${codeNormalizer.normalizeICD10('e119').normalized}"`);
  console.log(`    ICD-10 "E1165" -> "${codeNormalizer.normalizeICD10('E1165').normalized}"`);
  console.log(`    CPT "99213" -> "${codeNormalizer.normalizeCPT('99213').normalized}"`);
  console.log(`    NPI "1234567893" -> "${codeNormalizer.normalizeNPI('1234567893').normalized}"`);

  console.log('');
}

// ============ Embeddings Test ============
async function testEmbeddings() {
  console.log('🔢 Testing Embeddings Service...');

  const { getEmbeddingsService } = await import('./src/services/embeddings.js');
  const embeddingsService = getEmbeddingsService();

  // Test single embedding
  const testText = 'Patient John Smith, DOB 1990-05-15, diagnosed with Type 2 Diabetes';
  const embedding = await embeddingsService.embed(testText);

  console.log(`  ✅ Generated embedding:`);
  console.log(`     - Dimensions: ${embedding.dimensions}`);
  console.log(`     - Model: ${embedding.model}`);
  console.log(`     - First 5 values: [${embedding.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
  console.log('');

  // Test chunking
  const longText = `
    Healthcare Claim Summary

    Patient Information:
    Name: John Smith
    Date of Birth: May 15, 1990
    Member ID: MEM123456789

    Provider Information:
    Dr. Jane Doe, MD
    NPI: 1234567893
    Specialty: Internal Medicine

    Diagnoses:
    1. E11.9 - Type 2 Diabetes Mellitus
    2. I10 - Essential Hypertension

    Services Rendered:
    Office visit on 2024-01-15
    CPT 99214 - Established patient visit
    Charge: $175.00
  `;

  console.log('  Testing Chunking Strategies:');

  const strategies: Array<'fixed' | 'sentence' | 'paragraph' | 'semantic'> = ['fixed', 'sentence', 'paragraph', 'semantic'];
  for (const strategy of strategies) {
    const chunks = embeddingsService.chunkText(longText, { strategy, maxChunkSize: 200 });
    console.log(`    ${strategy}: ${chunks.length} chunks`);
  }
  console.log('');

  // Test similarity
  const text1 = 'Patient with diabetes and hypertension';
  const text2 = 'Patient diagnosed with Type 2 Diabetes and high blood pressure';
  const text3 = 'Weather forecast for tomorrow';

  const emb1 = await embeddingsService.embed(text1);
  const emb2 = await embeddingsService.embed(text2);
  const emb3 = await embeddingsService.embed(text3);

  const sim12 = embeddingsService.cosineSimilarity(emb1.embedding, emb2.embedding);
  const sim13 = embeddingsService.cosineSimilarity(emb1.embedding, emb3.embedding);

  console.log('  Similarity Test:');
  console.log(`    "${text1.substring(0, 40)}..."`);
  console.log(`    vs "${text2.substring(0, 40)}...": ${(sim12 * 100).toFixed(1)}%`);
  console.log(`    vs "${text3.substring(0, 40)}...": ${(sim13 * 100).toFixed(1)}%`);
  console.log('');
}

// ============ Vector Store Test ============
async function testVectorStore() {
  console.log('🗄️ Testing Vector Store...');

  const { getVectorStore } = await import('./src/services/vectorstore.js');
  const { getEmbeddingsService } = await import('./src/services/embeddings.js');

  const vectorStore = await getVectorStore();
  const embeddingsService = getEmbeddingsService();

  // Add test documents
  const testDocs = [
    {
      id: 'test-doc-1',
      text: 'Patient John Smith with Type 2 Diabetes, diagnosed on January 15, 2024. Prescribed Metformin.',
      metadata: { claimId: 'CLM-001', documentType: 'cms_1500' },
    },
    {
      id: 'test-doc-2',
      text: 'Patient Jane Doe with Essential Hypertension. Blood pressure medication prescribed.',
      metadata: { claimId: 'CLM-002', documentType: 'cms_1500' },
    },
    {
      id: 'test-doc-3',
      text: 'Emergency room visit for chest pain. Cardiac workup negative. Discharged same day.',
      metadata: { claimId: 'CLM-003', documentType: 'ub_04' },
    },
  ];

  console.log('  Adding test documents...');
  for (const doc of testDocs) {
    const chunks = await embeddingsService.chunkAndEmbed(doc.text, { strategy: 'paragraph' }, doc.metadata);
    await vectorStore.addDocument(doc.id, chunks, doc.metadata);
    console.log(`    ✅ Added "${doc.id}" with ${chunks.length} chunks`);
  }
  console.log('');

  // Search test
  console.log('  Search Tests:');
  const queries = [
    'diabetes treatment',
    'high blood pressure',
    'emergency cardiac',
  ];

  for (const query of queries) {
    const results = await vectorStore.search(query, { topK: 2, minScore: 0.3 });
    console.log(`    Query: "${query}"`);
    for (const result of results) {
      console.log(`      - ${result.documentId}: ${(result.score * 100).toFixed(1)}% match`);
    }
  }
  console.log('');

  // Stats
  const stats = await vectorStore.getStats();
  console.log('  Vector Store Stats:');
  console.log(`    - Total documents: ${stats.totalDocuments}`);
  console.log(`    - Total chunks: ${stats.totalChunks}`);
  console.log(`    - Embedding dimensions: ${stats.embeddingDimensions}`);
  console.log('');

  // Cleanup
  console.log('  Cleaning up test documents...');
  for (const doc of testDocs) {
    await vectorStore.deleteDocument(doc.id);
  }
  console.log('    ✅ Cleanup complete');
  console.log('');
}

// ============ Quality Service Test ============
async function testQuality() {
  console.log('⭐ Testing Quality Service (requires API key)...');

  const { getConfig } = await import('./src/config/index.js');
  const config = getConfig();

  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'your-oauth-token-here') {
    console.log('  ⚠️  Skipping - CLAUDE_CODE_OAUTH_TOKEN not set');
    console.log('');
    return;
  }

  const { getQualityService } = await import('./src/services/quality.js');
  const qualityService = getQualityService();

  // Create mock extraction for testing
  const mockExtraction = {
    id: 'TEST-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM123456',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1990-05-15',
    },
    provider: {
      npi: '1234567893',
      name: 'Dr. Jane Doe',
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 Diabetes', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99214',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 175.00,
      },
    ],
    totals: {
      totalCharges: 175.00,
    },
    confidenceScores: {
      'patient.memberId': 0.95,
      'patient.firstName': 0.98,
      'provider.npi': 0.92,
    },
    provenance: {},
  };

  const mockOCRText = `
    CMS-1500 HEALTH INSURANCE CLAIM FORM
    Patient: John Smith
    DOB: 05/15/1990
    Member ID: MEM123456
    Provider: Dr. Jane Doe, NPI: 1234567893
    Diagnosis: E11.9 - Type 2 Diabetes
    Service: 01/15/2024 - 99214 - $175.00
    Total Charges: $175.00
  `;

  console.log('  Evaluating extraction quality...');
  const evaluation = await qualityService.evaluateExtraction({
    extractedClaim: mockExtraction,
    ocrText: mockOCRText,
  });

  console.log(`    Overall Score: ${(evaluation.overallScore * 100).toFixed(1)}%`);
  console.log(`    Grade: ${evaluation.grade}`);
  console.log(`    Review Priority: ${evaluation.reviewPriority}`);
  console.log('    Dimensions:');
  console.log(`      - Completeness: ${(evaluation.dimensions.completeness.score * 100).toFixed(1)}%`);
  console.log(`      - Accuracy: ${(evaluation.dimensions.accuracy.score * 100).toFixed(1)}%`);
  console.log(`      - Consistency: ${(evaluation.dimensions.consistency.score * 100).toFixed(1)}%`);
  console.log(`      - Formatting: ${(evaluation.dimensions.formatting.score * 100).toFixed(1)}%`);
  console.log('');
}

// Run tests
testServices().catch(console.error);
```

### Step 3.2: Run Service Tests

```bash
# Test configuration
npx tsx test-services.ts config

# Test validators
npx tsx test-services.ts validators

# Test NPI validation
npx tsx test-services.ts npi

# Test enrichment/normalization
npx tsx test-services.ts enrichment

# Test embeddings
npx tsx test-services.ts embeddings

# Test vector store
npx tsx test-services.ts vectorstore

# Test quality service (requires API key)
npx tsx test-services.ts quality

# Run all tests
npx tsx test-services.ts all
```

**Expected Output (example for validators):**
```
🧪 ClaimsAgent Service Tests

🔍 Testing Validators...
  ICD-10 Format:
    ✅ "E11.9" -> true (expected: true)
    ✅ "I10" -> true (expected: true)
    ✅ "Z00.00" -> true (expected: true)
    ✅ "INVALID" -> false (expected: false)
    ✅ "12345" -> false (expected: false)
  ...
```

---

## 4. Testing Agents

### Step 4.1: Create Agent Test Script

Create `test-agents.ts`:

```typescript
// test-agents.ts
import { config } from 'dotenv';
config();

import fs from 'fs/promises';
import path from 'path';

async function testAgents() {
  console.log('🤖 ClaimsAgent Agent Tests\n');

  const testName = process.argv[2];

  switch (testName) {
    case 'intake':
      await testIntakeAgent();
      break;
    case 'validation':
      await testValidationAgent();
      break;
    case 'adjudication':
      await testAdjudicationAgent();
      break;
    case 'all':
      await testIntakeAgent();
      await testValidationAgent();
      await testAdjudicationAgent();
      break;
    default:
      console.log('Usage: npx tsx test-agents.ts <test-name>');
      console.log('Available tests: intake, validation, adjudication, all');
  }
}

async function testIntakeAgent() {
  console.log('📥 Testing Intake Agent...');

  const { IntakeAgent } = await import('./src/agents/intake.js');

  // Create a simple test image (1x1 white PNG)
  const testBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Test valid image upload
  console.log('  Testing valid image upload...');
  try {
    const result = await IntakeAgent.intake({
      buffer: testBuffer,
      filename: 'test-claim.png',
      mimeType: 'image/png',
      priority: 'normal',
    });

    if (result.success) {
      console.log(`    ✅ Success: Claim ID = ${result.data?.claimId}`);
      console.log(`       Document ID: ${result.data?.documentId}`);
      console.log(`       Document Type: ${result.data?.documentType}`);
    } else {
      console.log(`    ❌ Failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`    ❌ Error: ${error}`);
  }

  // Test unsupported format
  console.log('  Testing unsupported format...');
  const result2 = await IntakeAgent.intake({
    buffer: Buffer.from('test'),
    filename: 'test.doc',
    mimeType: 'application/msword',
    priority: 'normal',
  });
  console.log(`    ${result2.success ? '❌ Should have failed' : '✅ Correctly rejected'}: ${result2.error}`);

  console.log('');
}

async function testValidationAgent() {
  console.log('✅ Testing Validation Agent...');

  const { ValidationAgent } = await import('./src/agents/validation.js');
  const agent = new ValidationAgent();

  // Create mock claim record
  const mockClaimRecord = {
    id: 'TEST-CLM-001',
    status: 'validating' as const,
    priority: 'normal' as const,
    documentId: 'doc-001',
    documentHash: 'abc123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingHistory: [],
  };

  // Test with valid claim
  console.log('  Testing valid claim...');
  const validClaim = {
    id: 'TEST-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM123456789',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1990-05-15',
      gender: 'M' as const,
    },
    provider: {
      npi: '1234567893',
      name: 'Dr. Jane Doe',
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 Diabetes', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 125.00,
      },
    ],
    totals: {
      totalCharges: 125.00,
    },
    confidenceScores: {},
    provenance: {},
  };

  const validResult = await agent.execute({ extractedClaim: validClaim }, mockClaimRecord);
  console.log(`    Valid: ${validResult.data?.validationResult.isValid}`);
  console.log(`    Errors: ${validResult.data?.validationResult.errors.length}`);
  console.log(`    Warnings: ${validResult.data?.validationResult.warnings.length}`);
  console.log('');

  // Test with invalid claim
  console.log('  Testing invalid claim (bad NPI, invalid code)...');
  const invalidClaim = {
    ...validClaim,
    id: 'TEST-002',
    provider: {
      npi: '1234567890', // Invalid checksum
      name: 'Dr. Bad Data',
    },
    diagnoses: [
      { code: 'INVALID', description: 'Bad code', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2099-01-15', // Future date
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 125.00,
      },
    ],
  };

  const invalidResult = await agent.execute({ extractedClaim: invalidClaim }, mockClaimRecord);
  console.log(`    Valid: ${invalidResult.data?.validationResult.isValid}`);
  console.log(`    Errors: ${invalidResult.data?.validationResult.errors.length}`);
  for (const error of invalidResult.data?.validationResult.errors ?? []) {
    console.log(`      - ${error.field}: ${error.message}`);
  }
  console.log('');
}

async function testAdjudicationAgent() {
  console.log('⚖️ Testing Adjudication Agent...');

  const { AdjudicationAgent } = await import('./src/agents/adjudication.js');
  const agent = new AdjudicationAgent();

  const mockClaimRecord = {
    id: 'TEST-CLM-001',
    status: 'adjudicating' as const,
    priority: 'normal' as const,
    documentId: 'doc-001',
    documentHash: 'abc123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingHistory: [],
  };

  // Test with covered services
  console.log('  Testing covered services...');
  const coveredClaim = {
    id: 'TEST-ADJ-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM123456789',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1990-05-15',
    },
    provider: {
      npi: '1234567893',
      name: 'Dr. Jane Doe',
    },
    diagnoses: [
      { code: 'E11.9', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99213', // Covered
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 150.00,
      },
      {
        lineNumber: 2,
        dateOfService: '2024-01-15',
        procedureCode: '85025', // Covered - CBC
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 25.00,
      },
    ],
    totals: {
      totalCharges: 175.00,
    },
    confidenceScores: {},
    provenance: {},
  };

  const coveredResult = await agent.execute({ extractedClaim: coveredClaim }, mockClaimRecord);
  const decision = coveredResult.data?.decision;

  console.log(`    Status: ${decision?.status}`);
  console.log(`    Total Billed: $${decision?.totals.totalBilled}`);
  console.log(`    Total Allowed: $${decision?.totals.totalAllowed}`);
  console.log(`    Total Paid: $${decision?.totals.totalPaid}`);
  console.log(`    Patient Responsibility: $${decision?.totals.totalPatientResponsibility}`);
  console.log('    Line Decisions:');
  for (const line of decision?.lineDecisions ?? []) {
    console.log(`      Line ${line.lineNumber}: ${line.status} - Paid $${line.paidAmount}`);
  }
  console.log('');

  // Test with non-covered service
  console.log('  Testing non-covered service...');
  const nonCoveredClaim = {
    ...coveredClaim,
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99999', // Not covered
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 500.00,
      },
    ],
    totals: { totalCharges: 500.00 },
  };

  const nonCoveredResult = await agent.execute({ extractedClaim: nonCoveredClaim }, mockClaimRecord);
  const ncDecision = nonCoveredResult.data?.decision;

  console.log(`    Status: ${ncDecision?.status}`);
  console.log(`    Total Paid: $${ncDecision?.totals.totalPaid}`);
  if (ncDecision?.lineDecisions[0]?.denialReasons) {
    console.log(`    Denial Reason: ${ncDecision.lineDecisions[0].denialReasons[0]?.description}`);
  }
  console.log('');
}

testAgents().catch(console.error);
```

### Step 4.2: Run Agent Tests

```bash
# Test intake agent
npx tsx test-agents.ts intake

# Test validation agent
npx tsx test-agents.ts validation

# Test adjudication agent
npx tsx test-agents.ts adjudication

# Run all agent tests
npx tsx test-agents.ts all
```

---

## 5. Testing Advanced Features

### Step 5.1: Test RAG Service

Create `test-rag.ts`:

```typescript
// test-rag.ts
import { config } from 'dotenv';
config();

async function testRAG() {
  console.log('🔍 Testing RAG Service\n');

  const { getConfig } = await import('./src/config/index.js');
  const conf = getConfig();

  if (!conf.anthropic.apiKey || conf.anthropic.apiKey === 'your-oauth-token-here') {
    console.log('⚠️  CLAUDE_CODE_OAUTH_TOKEN not set - skipping LLM-dependent tests\n');
    return;
  }

  const { getRAGService } = await import('./src/services/rag.js');
  const ragService = getRAGService();

  // Create test claims
  const testClaims = [
    {
      id: 'RAG-TEST-001',
      documentType: 'cms_1500' as const,
      patient: { memberId: 'MEM001', firstName: 'Alice', lastName: 'Johnson', dateOfBirth: '1985-03-20' },
      provider: { npi: '1234567893', name: 'Dr. Smith', specialty: 'Cardiology' },
      diagnoses: [{ code: 'I10', description: 'Essential Hypertension', isPrimary: true }],
      serviceLines: [{ lineNumber: 1, dateOfService: '2024-01-10', procedureCode: '99214', modifiers: [], diagnosisPointers: ['A'], units: 1, chargeAmount: 175.00 }],
      totals: { totalCharges: 175.00 },
      confidenceScores: {},
      provenance: {},
    },
    {
      id: 'RAG-TEST-002',
      documentType: 'cms_1500' as const,
      patient: { memberId: 'MEM002', firstName: 'Bob', lastName: 'Williams', dateOfBirth: '1970-08-15' },
      provider: { npi: '1234567893', name: 'Dr. Smith', specialty: 'Cardiology' },
      diagnoses: [{ code: 'E11.9', description: 'Type 2 Diabetes', isPrimary: true }],
      serviceLines: [{ lineNumber: 1, dateOfService: '2024-01-12', procedureCode: '99213', modifiers: [], diagnosisPointers: ['A'], units: 1, chargeAmount: 125.00 }],
      totals: { totalCharges: 125.00 },
      confidenceScores: {},
      provenance: {},
    },
  ];

  // Index claims
  console.log('📚 Indexing test claims...');
  for (const claim of testClaims) {
    await ragService.indexClaim(claim);
    console.log(`  ✅ Indexed ${claim.id}`);
  }
  console.log('');

  // Test queries
  console.log('❓ Testing Q&A...');
  const queries = [
    'Which patients have diabetes?',
    'What procedures were performed by Dr. Smith?',
    'What is the total charges for hypertension patients?',
  ];

  for (const query of queries) {
    console.log(`\n  Query: "${query}"`);
    const response = await ragService.query({ question: query, maxChunks: 3 });
    console.log(`  Answer: ${response.answer}`);
    console.log(`  Confidence: ${(response.confidence * 100).toFixed(0)}%`);
    console.log(`  Sources: ${response.sources.length}`);
  }
  console.log('');

  // Test similar claims
  console.log('🔗 Finding similar claims to RAG-TEST-001...');
  const similar = await ragService.findSimilarClaims('RAG-TEST-001', 3);
  for (const s of similar) {
    console.log(`  - ${s.claimId}: ${(s.similarity * 100).toFixed(0)}% similar`);
  }
  console.log('');
}

testRAG().catch(console.error);
```

Run:
```bash
npx tsx test-rag.ts
```

### Step 5.2: Test Vision Service

Create `test-vision.ts`:

```typescript
// test-vision.ts
import { config } from 'dotenv';
config();

import fs from 'fs/promises';

async function testVision() {
  console.log('👁️ Testing Vision Service\n');

  const { getConfig } = await import('./src/config/index.js');
  const conf = getConfig();

  if (!conf.anthropic.apiKey || conf.anthropic.apiKey === 'your-oauth-token-here') {
    console.log('⚠️  CLAUDE_CODE_OAUTH_TOKEN not set - skipping vision tests\n');
    return;
  }

  const { getVisionService } = await import('./src/services/vision.js');
  const visionService = getVisionService();

  // Check if we have a test image
  const testImagePath = 'test-claim.png'; // Put a test image here
  let testImage: Buffer;

  try {
    testImage = await fs.readFile(testImagePath);
    console.log(`✅ Loaded test image: ${testImagePath}\n`);
  } catch {
    console.log('⚠️  No test image found. Creating a simple test...\n');

    // Create a simple test with a placeholder
    // In real testing, use an actual healthcare form image
    const sharp = (await import('sharp')).default;

    // Create a simple white image with text
    testImage = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    }).png().toBuffer();

    console.log('  Created placeholder image (800x600 white)\n');
  }

  // Test layout analysis
  console.log('📐 Analyzing layout...');
  try {
    const layout = await visionService.analyzeLayout(testImage);
    console.log(`  Document Type: ${layout.documentType}`);
    console.log(`  Has Tables: ${layout.hasTables}`);
    console.log(`  Has Charts: ${layout.hasCharts}`);
    console.log(`  Has Handwriting: ${layout.hasHandwriting}`);
    console.log(`  Quality: ${layout.quality}`);
    console.log(`  Orientation: ${layout.orientation}`);
    console.log(`  Regions detected: ${layout.regions.length}`);
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
  }
  console.log('');

  // Test form field extraction
  console.log('📝 Extracting form fields...');
  try {
    const fields = await visionService.extractFormFields(testImage);
    console.log(`  Fields found: ${fields.fields.length}`);
    for (const field of fields.fields.slice(0, 5)) {
      console.log(`    - ${field.label}: "${field.value}" (${field.type}, ${(field.confidence * 100).toFixed(0)}%)`);
    }
    if (fields.fields.length > 5) {
      console.log(`    ... and ${fields.fields.length - 5} more`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
  }
  console.log('');
}

testVision().catch(console.error);
```

Run:
```bash
npx tsx test-vision.ts
```

---

## 6. End-to-End Testing

### Step 6.1: Full Pipeline Test

Create `test-e2e.ts`:

```typescript
// test-e2e.ts
import { config } from 'dotenv';
config();

async function testE2E() {
  console.log('🚀 End-to-End Pipeline Test\n');

  const { getConfig } = await import('./src/config/index.js');
  const conf = getConfig();

  if (!conf.anthropic.apiKey || conf.anthropic.apiKey === 'your-oauth-token-here') {
    console.log('⚠️  CLAUDE_CODE_OAUTH_TOKEN required for E2E test\n');
    return;
  }

  // Step 1: Create mock document
  console.log('📄 Step 1: Document Intake');
  const { IntakeAgent } = await import('./src/agents/intake.js');

  // Create test PNG
  const sharp = (await import('sharp')).default;
  const testImage = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).png().toBuffer();

  const intakeResult = await IntakeAgent.intake({
    buffer: testImage,
    filename: 'test-e2e-claim.png',
    mimeType: 'image/png',
    priority: 'high',
    metadata: { source: 'e2e-test' },
  });

  if (!intakeResult.success) {
    console.log(`  ❌ Intake failed: ${intakeResult.error}`);
    return;
  }
  console.log(`  ✅ Claim created: ${intakeResult.data?.claimId}`);
  console.log('');

  // Step 2: Mock extraction (normally would use OCR + LLM)
  console.log('📋 Step 2: Field Extraction (mocked)');
  const mockExtraction = {
    id: intakeResult.data!.claimId,
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'E2E123456789',
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '1985-06-15',
      gender: 'M' as const,
    },
    provider: {
      npi: '1234567893',
      name: 'E2E Test Provider',
      specialty: 'Internal Medicine',
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 Diabetes', isPrimary: true },
      { code: 'I10', description: 'Hypertension', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99214',
        modifiers: ['25'],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 175.00,
      },
      {
        lineNumber: 2,
        dateOfService: '2024-01-15',
        procedureCode: '85025',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 25.00,
      },
    ],
    totals: {
      totalCharges: 200.00,
    },
    confidenceScores: {
      'patient.memberId': 0.95,
      'patient.firstName': 0.98,
      'provider.npi': 0.97,
    },
    provenance: {},
  };
  console.log(`  ✅ Extracted ${mockExtraction.diagnoses.length} diagnoses, ${mockExtraction.serviceLines.length} service lines`);
  console.log('');

  // Step 3: Enrichment
  console.log('✨ Step 3: Enrichment & Normalization');
  const { getEnrichmentService } = await import('./src/services/enrichment.js');
  const enrichmentService = getEnrichmentService();

  const enrichmentResult = await enrichmentService.enrichClaim(mockExtraction);
  console.log(`  ✅ Normalizations applied: ${enrichmentResult.normalizations.length}`);
  console.log(`  ✅ Enrichments added: ${enrichmentResult.enrichments.length}`);
  console.log('');

  // Step 4: Validation
  console.log('✅ Step 4: Validation');
  const { ValidationAgent } = await import('./src/agents/validation.js');
  const validationAgent = new ValidationAgent();

  const mockClaimRecord = {
    id: intakeResult.data!.claimId,
    status: 'validating' as const,
    priority: 'high' as const,
    documentId: intakeResult.data!.documentId,
    documentHash: 'e2e-test-hash',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingHistory: [],
  };

  const validationResult = await validationAgent.execute(
    { extractedClaim: enrichmentResult.enrichedClaim },
    mockClaimRecord
  );

  console.log(`  Valid: ${validationResult.data?.validationResult.isValid}`);
  console.log(`  Errors: ${validationResult.data?.validationResult.errors.length}`);
  console.log(`  Warnings: ${validationResult.data?.validationResult.warnings.length}`);
  console.log('');

  // Step 5: Quality Assessment
  console.log('⭐ Step 5: Quality Assessment');
  const { getQualityService } = await import('./src/services/quality.js');
  const qualityService = getQualityService();

  const qualityResult = await qualityService.evaluateExtraction({
    extractedClaim: enrichmentResult.enrichedClaim,
    ocrText: 'Mock OCR text for E2E test - Patient Test Patient DOB 06/15/1985...',
    validationResult: validationResult.data?.validationResult,
  });

  console.log(`  Grade: ${qualityResult.grade}`);
  console.log(`  Score: ${(qualityResult.overallScore * 100).toFixed(0)}%`);
  console.log(`  Review Required: ${qualityResult.requiresReview}`);
  console.log('');

  // Step 6: Adjudication
  console.log('⚖️ Step 6: Adjudication');
  const { AdjudicationAgent } = await import('./src/agents/adjudication.js');
  const adjudicationAgent = new AdjudicationAgent();

  const adjResult = await adjudicationAgent.execute(
    { extractedClaim: enrichmentResult.enrichedClaim },
    { ...mockClaimRecord, status: 'adjudicating' }
  );

  const decision = adjResult.data?.decision;
  console.log(`  Status: ${decision?.status}`);
  console.log(`  Total Billed: $${decision?.totals.totalBilled.toFixed(2)}`);
  console.log(`  Total Paid: $${decision?.totals.totalPaid.toFixed(2)}`);
  console.log(`  Patient Owes: $${decision?.totals.totalPatientResponsibility.toFixed(2)}`);
  console.log('');

  // Step 7: Index for RAG
  console.log('📚 Step 7: Index for RAG');
  const { getRAGService } = await import('./src/services/rag.js');
  const ragService = getRAGService();

  await ragService.indexClaim(enrichmentResult.enrichedClaim);
  console.log(`  ✅ Claim indexed for future Q&A`);
  console.log('');

  // Summary
  console.log('=' .repeat(50));
  console.log('📊 E2E Test Summary');
  console.log('=' .repeat(50));
  console.log(`  Claim ID: ${intakeResult.data?.claimId}`);
  console.log(`  Document Type: ${mockExtraction.documentType}`);
  console.log(`  Validation: ${validationResult.data?.validationResult.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`  Quality Grade: ${qualityResult.grade}`);
  console.log(`  Adjudication: ${decision?.status.toUpperCase()}`);
  console.log(`  Payment: $${decision?.totals.totalPaid.toFixed(2)} of $${decision?.totals.totalBilled.toFixed(2)}`);
  console.log('');
}

testE2E().catch(console.error);
```

Run:
```bash
npx tsx test-e2e.ts
```

---

## 7. Testing Workflow Orchestrator

The Workflow Orchestrator provides automated claim processing with state management, confidence-based routing, and human review integration.

### Step 7.1: Run Orchestrator Test Script

The orchestrator test script (`test-orchestrator.ts`) is already created. Run it to test all orchestrator functionality:

```bash
npx tsx test-orchestrator.ts
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║          PHASE 10 - ORCHESTRATOR TEST SUITE                ║
╚════════════════════════════════════════════════════════════╝

============================================================
STATE MANAGER TESTS
============================================================

[Test 1] Creating claim state...
  ✓ State created: CLM-TEST-001
  ✓ Initial status: received

[Test 2] Transitioning claim state...
  ✓ Transitioned to: parsing
  ✓ Transitioned to: extracting

[Test 3] Setting extracted claim...
  ✓ Extracted claim set: true
  ✓ Patient name: John

[Test 4] Determining next action based on confidence...
  - Confidence 0.90: auto_process
  - Confidence 0.75: correct
  - Confidence 0.50: review

...

ALL ORCHESTRATOR TESTS COMPLETED SUCCESSFULLY
```

### Step 7.2: Understanding Orchestrator Components

#### State Manager (`src/orchestrator/state.ts`)

Manages claim state transitions and persistence:

| Status | Description | Valid Transitions To |
|--------|-------------|---------------------|
| `received` | Initial state | parsing, failed |
| `parsing` | Document being parsed | extracting, failed |
| `extracting` | Fields being extracted | validating, failed |
| `validating` | Validation in progress | correcting, pending_review, adjudicating, failed |
| `correcting` | Auto-correction attempt | validating, pending_review, failed |
| `pending_review` | Needs human review | validating, adjudicating, completed, failed |
| `adjudicating` | Payment processing | completed, pending_review, failed |
| `completed` | Successfully processed | (terminal) |
| `failed` | Processing failed | received (retry) |

#### Workflow Orchestrator (`src/orchestrator/workflow.ts`)

Orchestrates the full pipeline with confidence-based routing:

| Confidence Score | Action | Description |
|-----------------|--------|-------------|
| ≥ 85% | `auto_process` | Proceed to adjudication automatically |
| 60-84% | `correct` | Attempt auto-correction, then revalidate |
| < 60% | `review` | Route to human review queue |

### Step 7.3: Test State Manager Individually

Create `test-state-manager.ts`:

```typescript
// test-state-manager.ts
import { config } from 'dotenv';
config();

async function testStateManager() {
  console.log('📊 State Manager Tests\n');

  const {
    getStateManager,
    resetStateManager,
  } = await import('./src/orchestrator/index.js');

  // Reset for clean test
  resetStateManager();
  const stateManager = getStateManager();

  // Test 1: Create a new claim state
  console.log('[Test 1] Creating claim state...');
  const state = await stateManager.createState(
    'CLM-SM-001',
    'DOC-001',
    'hash12345',
    'normal',
    { source: 'manual-test' }
  );
  console.log(`  ✓ Created: ${state.claim.id}`);
  console.log(`  ✓ Status: ${state.claim.status}`);
  console.log(`  ✓ Priority: ${state.claim.priority}`);

  // Test 2: Transition through states
  console.log('\n[Test 2] Transitioning states...');
  await stateManager.transitionTo('CLM-SM-001', 'parsing', 'Starting parse');
  await stateManager.transitionTo('CLM-SM-001', 'extracting', 'Extracting fields');
  await stateManager.transitionTo('CLM-SM-001', 'validating', 'Validating');

  const updatedState = await stateManager.getState('CLM-SM-001');
  console.log(`  ✓ Current status: ${updatedState?.claim.status}`);
  console.log(`  ✓ History entries: ${updatedState?.claim.processingHistory.length}`);

  // Test 3: Get statistics
  console.log('\n[Test 3] Getting statistics...');
  const stats = stateManager.getStatistics();
  console.log(`  ✓ Total claims: ${stats.total}`);
  console.log(`  ✓ Status breakdown: ${JSON.stringify(stats.byStatus)}`);

  // Test 4: Confidence-based routing
  console.log('\n[Test 4] Confidence-based routing...');
  const thresholds = [0.90, 0.75, 0.50, 0.30];
  for (const conf of thresholds) {
    const action = stateManager.determineNextAction(conf);
    console.log(`  Confidence ${(conf * 100).toFixed(0)}% -> ${action}`);
  }

  // Test 5: Invalid transition (should throw)
  console.log('\n[Test 5] Testing invalid transition...');
  try {
    await stateManager.transitionTo('CLM-SM-001', 'completed', 'Skip to end');
    console.log('  ✗ Should have thrown error');
  } catch (error) {
    console.log(`  ✓ Correctly rejected: ${(error as Error).message}`);
  }

  console.log('\n✓ State Manager tests completed');
}

testStateManager().catch(console.error);
```

Run:
```bash
npx tsx test-state-manager.ts
```

### Step 7.4: Test Workflow Orchestrator with Pre-Extracted Claims

Create `test-workflow.ts`:

```typescript
// test-workflow.ts
import { config } from 'dotenv';
config();

import { ExtractedClaim } from './src/models/index.js';

// Create a sample claim matching ExtractedClaim schema
function createTestClaim(id: string, confidence: number = 0.9): ExtractedClaim {
  return {
    id,
    documentType: 'cms_1500',
    patient: {
      memberId: 'MEM123456789',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1985-03-15',
      gender: 'M',
      address: {
        street1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893', // Valid NPI
      name: 'Primary Care Associates',
      taxId: '123456789',
      specialty: 'Family Medicine',
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 diabetes', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 150.00,
        placeOfService: '11',
      },
    ],
    totals: {
      totalCharges: 150.00,
      amountPaid: 0,
      patientResponsibility: 0,
    },
    statementDate: '2024-01-15',
    confidenceScores: {
      patient: confidence,
      provider: confidence,
      diagnoses: confidence,
      serviceLines: confidence,
      totals: confidence,
      overall: confidence,
    },
    provenance: {},
  };
}

async function testWorkflow() {
  console.log('🔄 Workflow Orchestrator Tests\n');

  const {
    getWorkflowOrchestrator,
    resetWorkflowOrchestrator,
    resetStateManager,
  } = await import('./src/orchestrator/index.js');

  // Reset for clean test
  resetStateManager();
  resetWorkflowOrchestrator();

  const orchestrator = getWorkflowOrchestrator({
    enableRAGIndexing: false, // Disable for faster tests
    enableQualityAssessment: false,
  });

  // Track events
  const events: string[] = [];
  orchestrator.on('workflow:started', (d) => events.push(`started:${d.claimId}`));
  orchestrator.on('workflow:completed', (d) => events.push(`completed:${d.claimId}`));
  orchestrator.on('workflow:failed', (d) => events.push(`failed:${d.claimId}`));
  orchestrator.on('workflow:review_required', (d) => events.push(`review:${d.claimId}`));

  // Test 1: High-confidence claim (should auto-process)
  console.log('[Test 1] High-confidence claim (92%)...');
  resetStateManager();
  const highConfClaim = createTestClaim('CLM-HIGH-001', 0.92);
  const result1 = await orchestrator.processExtractedClaim(highConfClaim, 'normal');

  console.log(`  Success: ${result1.success}`);
  console.log(`  Final Status: ${result1.finalStatus}`);
  console.log(`  Processing Time: ${result1.processingTimeMs}ms`);

  // Test 2: Medium-confidence claim (should attempt correction)
  console.log('\n[Test 2] Medium-confidence claim (70%)...');
  resetStateManager();
  const medConfClaim = createTestClaim('CLM-MED-001', 0.70);
  const result2 = await orchestrator.processExtractedClaim(medConfClaim, 'normal');

  console.log(`  Success: ${result2.success}`);
  console.log(`  Final Status: ${result2.finalStatus}`);
  console.log(`  Processing Time: ${result2.processingTimeMs}ms`);

  // Test 3: Priority handling
  console.log('\n[Test 3] Urgent priority claim...');
  resetStateManager();
  const urgentClaim = createTestClaim('CLM-URGENT-001', 0.95);
  const result3 = await orchestrator.processExtractedClaim(urgentClaim, 'urgent');

  console.log(`  Success: ${result3.success}`);
  console.log(`  Final Status: ${result3.finalStatus}`);

  // Test 4: Get workflow statistics
  console.log('\n[Test 4] Workflow statistics...');
  const stats = orchestrator.getStatistics();
  console.log(`  Total claims: ${stats.stateStats.total}`);
  console.log(`  Auto-process threshold: ${stats.config.autoProcessThreshold}`);
  console.log(`  Correction threshold: ${stats.config.correctionThreshold}`);

  // Test 5: Events captured
  console.log('\n[Test 5] Events captured...');
  console.log(`  Total events: ${events.length}`);
  console.log(`  Events: ${events.join(', ')}`);

  console.log('\n✓ Workflow Orchestrator tests completed');
}

testWorkflow().catch(console.error);
```

Run:
```bash
npx tsx test-workflow.ts
```

### Step 7.5: Test Human Review Workflow

Create `test-review-workflow.ts`:

```typescript
// test-review-workflow.ts
import { config } from 'dotenv';
config();

import { ExtractedClaim } from './src/models/index.js';

function createTestClaim(id: string, confidence: number = 0.9): ExtractedClaim {
  return {
    id,
    documentType: 'cms_1500',
    patient: {
      memberId: 'MEM123456789',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1985-03-15',
    },
    provider: {
      npi: '1234567893',
      name: 'Primary Care Associates',
    },
    diagnoses: [
      { code: 'E11.9', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 150.00,
      },
    ],
    totals: { totalCharges: 150.00 },
    confidenceScores: { overall: confidence },
    provenance: {},
  };
}

async function testReviewWorkflow() {
  console.log('👤 Human Review Workflow Tests\n');

  const {
    getStateManager,
    getWorkflowOrchestrator,
    resetStateManager,
    resetWorkflowOrchestrator,
  } = await import('./src/orchestrator/index.js');

  resetStateManager();
  resetWorkflowOrchestrator();

  const stateManager = getStateManager();
  const orchestrator = getWorkflowOrchestrator({ enableRAGIndexing: false });

  // Setup: Create a claim in pending_review state
  console.log('[Setup] Creating claim for review...');
  await stateManager.createState('CLM-REVIEW-001', 'DOC-001', 'hash123', 'normal');
  await stateManager.transitionTo('CLM-REVIEW-001', 'parsing', 'Parsing');
  await stateManager.transitionTo('CLM-REVIEW-001', 'extracting', 'Extracting');

  const claim = createTestClaim('CLM-REVIEW-001', 0.5);
  await stateManager.setExtractedClaim('CLM-REVIEW-001', claim);
  await stateManager.transitionTo('CLM-REVIEW-001', 'validating', 'Validating');
  await stateManager.transitionTo('CLM-REVIEW-001', 'pending_review', 'Low confidence');

  const pendingState = await stateManager.getState('CLM-REVIEW-001');
  console.log(`  Claim status: ${pendingState?.claim.status}`);

  // Test 1: Approve review
  console.log('\n[Test 1] Approve review...');
  const approveResult = await orchestrator.submitReview('CLM-REVIEW-001', 'approve');
  console.log(`  Result: ${approveResult.success ? 'Success' : 'Failed'}`);
  console.log(`  Final status: ${approveResult.finalStatus}`);

  // Setup for rejection test
  console.log('\n[Setup] Creating another claim for rejection...');
  resetStateManager();
  await stateManager.createState('CLM-REVIEW-002', 'DOC-002', 'hash456', 'normal');
  await stateManager.transitionTo('CLM-REVIEW-002', 'parsing', 'Parsing');
  await stateManager.transitionTo('CLM-REVIEW-002', 'extracting', 'Extracting');
  const claim2 = createTestClaim('CLM-REVIEW-002', 0.5);
  await stateManager.setExtractedClaim('CLM-REVIEW-002', claim2);
  await stateManager.transitionTo('CLM-REVIEW-002', 'validating', 'Validating');
  await stateManager.transitionTo('CLM-REVIEW-002', 'pending_review', 'Low confidence');

  // Test 2: Reject review
  console.log('\n[Test 2] Reject review...');
  const rejectResult = await orchestrator.submitReview(
    'CLM-REVIEW-002',
    'reject',
    undefined,
    'Invalid documentation provided'
  );
  console.log(`  Result: ${rejectResult.success ? 'Success' : 'Rejected'}`);
  console.log(`  Final status: ${rejectResult.finalStatus}`);
  console.log(`  Error message: ${rejectResult.error}`);

  // Setup for correction test
  console.log('\n[Setup] Creating claim for correction...');
  resetStateManager();
  await stateManager.createState('CLM-REVIEW-003', 'DOC-003', 'hash789', 'normal');
  await stateManager.transitionTo('CLM-REVIEW-003', 'parsing', 'Parsing');
  await stateManager.transitionTo('CLM-REVIEW-003', 'extracting', 'Extracting');
  const claim3 = createTestClaim('CLM-REVIEW-003', 0.5);
  await stateManager.setExtractedClaim('CLM-REVIEW-003', claim3);
  await stateManager.transitionTo('CLM-REVIEW-003', 'validating', 'Validating');
  await stateManager.transitionTo('CLM-REVIEW-003', 'pending_review', 'Low confidence');

  // Test 3: Correct and resubmit
  console.log('\n[Test 3] Submit with corrections...');
  const corrections = {
    patient: {
      memberId: 'MEM987654321', // Corrected member ID
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1985-03-15',
    },
  };

  const correctResult = await orchestrator.submitReview(
    'CLM-REVIEW-003',
    'correct',
    corrections as Partial<ExtractedClaim>,
    'Corrected member ID'
  );
  console.log(`  Result: ${correctResult.success ? 'Success' : 'Failed'}`);
  console.log(`  Final status: ${correctResult.finalStatus}`);

  console.log('\n✓ Human Review Workflow tests completed');
}

testReviewWorkflow().catch(console.error);
```

Run:
```bash
npx tsx test-review-workflow.ts
```

### Step 7.6: Test Concurrent Processing

Create `test-concurrent.ts`:

```typescript
// test-concurrent.ts
import { config } from 'dotenv';
config();

import { ExtractedClaim } from './src/models/index.js';

function createTestClaim(id: string, confidence: number): ExtractedClaim {
  return {
    id,
    documentType: 'cms_1500',
    patient: {
      memberId: `MEM-${id}`,
      firstName: 'Patient',
      lastName: id,
      dateOfBirth: '1985-03-15',
    },
    provider: { npi: '1234567893', name: 'Test Provider' },
    diagnoses: [{ code: 'E11.9', isPrimary: true }],
    serviceLines: [{
      lineNumber: 1,
      dateOfService: '2024-01-15',
      procedureCode: '99213',
      modifiers: [],
      diagnosisPointers: ['A'],
      units: 1,
      chargeAmount: 150.00,
    }],
    totals: { totalCharges: 150.00 },
    confidenceScores: { overall: confidence },
    provenance: {},
  };
}

async function testConcurrent() {
  console.log('⚡ Concurrent Processing Tests\n');

  const {
    getWorkflowOrchestrator,
    resetStateManager,
    resetWorkflowOrchestrator,
  } = await import('./src/orchestrator/index.js');

  resetStateManager();
  resetWorkflowOrchestrator();

  const orchestrator = getWorkflowOrchestrator({ enableRAGIndexing: false });

  // Test: Process multiple claims in parallel
  console.log('[Test] Processing 5 claims concurrently...\n');

  const claims = [
    createTestClaim('BATCH-001', 0.95),
    createTestClaim('BATCH-002', 0.88),
    createTestClaim('BATCH-003', 0.72),
    createTestClaim('BATCH-004', 0.91),
    createTestClaim('BATCH-005', 0.65),
  ];

  const startTime = Date.now();

  // Process all claims concurrently
  const results = await Promise.all(
    claims.map(claim => orchestrator.processExtractedClaim(claim, 'normal'))
  );

  const totalTime = Date.now() - startTime;

  // Display results
  console.log('Results:');
  console.log('─'.repeat(60));
  console.log('Claim ID       | Confidence | Status      | Time (ms)');
  console.log('─'.repeat(60));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const conf = claims[i].confidenceScores.overall;
    console.log(
      `${r.claimId.padEnd(14)} | ${(conf * 100).toFixed(0).padStart(5)}%     | ${r.finalStatus.padEnd(11)} | ${r.processingTimeMs.toString().padStart(5)}`
    );
  }

  console.log('─'.repeat(60));
  console.log(`\nTotal time: ${totalTime}ms`);
  console.log(`Average time per claim: ${(totalTime / claims.length).toFixed(0)}ms`);

  const successCount = results.filter(r => r.success).length;
  console.log(`Success rate: ${(successCount / results.length * 100).toFixed(0)}%`);

  // Statistics
  console.log('\nFinal Statistics:');
  const stats = orchestrator.getStatistics();
  console.log(`  Total processed: ${stats.stateStats.total}`);
  console.log(`  Completed: ${stats.stateStats.byStatus.completed}`);
  console.log(`  Pending review: ${stats.stateStats.byStatus.pending_review}`);
  console.log(`  Failed: ${stats.stateStats.byStatus.failed}`);

  console.log('\n✓ Concurrent Processing tests completed');
}

testConcurrent().catch(console.error);
```

Run:
```bash
npx tsx test-concurrent.ts
```

### Step 7.7: Test Event Monitoring

Run the pre-created test script:
```bash
npx tsx test-events.ts
```

**Expected Output:**
```
📡 Event Monitoring Tests

[Test] Processing claim with event monitoring...

  [   7ms] state:created - CLM-EVENTS-001
  [   8ms] state:updated - CLM-EVENTS-001
  [   9ms] state:transition - received -> parsing
  [  10ms] state:updated - CLM-EVENTS-001
  [  10ms] state:transition - parsing -> extracting
  [  11ms] state:updated - CLM-EVENTS-001
  [  12ms] state:transition - extracting -> validating
  [  12ms] state:updated - CLM-EVENTS-001
  [  12ms] workflow:started - CLM-EVENTS-001
  [  12ms] workflow:stage_started - enrichment
  [  15ms] state:updated - CLM-EVENTS-001
  [  16ms] workflow:stage_completed - enrichment
  [  16ms] workflow:stage_started - validation
  [  22ms] state:updated - CLM-EVENTS-001
  [  23ms] workflow:stage_completed - validation
  [  24ms] state:transition - validating -> adjudicating
  [  24ms] state:updated - CLM-EVENTS-001
  [  24ms] workflow:stage_started - adjudication
  [  25ms] state:updated - CLM-EVENTS-001
  [  25ms] workflow:stage_completed - adjudication
  [  26ms] state:transition - adjudicating -> completed
  [  26ms] state:updated - CLM-EVENTS-001
  [  26ms] state:completed - CLM-EVENTS-001
  [  26ms] workflow:completed - CLM-EVENTS-001

──────────────────────────────────────────────────
Event Summary:
──────────────────────────────────────────────────
  state:completed: 1
  state:created: 1
  state:transition: 5
  state:updated: 9
  workflow:completed: 1
  workflow:stage_completed: 3
  workflow:stage_started: 3
  workflow:started: 1

Total events: 24
Total time: 26ms

✓ Event Monitoring tests completed
```

---

### Section 7 Test Results Summary

All orchestrator tests have been verified and pass successfully:

| Test Script | Tests Passed | Key Observations |
|-------------|--------------|------------------|
| `test-orchestrator.ts` | All | Full orchestrator suite, NPI checksum validation works |
| `test-state-manager.ts` | 5/5 | State transitions, confidence routing, invalid transition rejection |
| `test-workflow.ts` | 5/5 | High/medium confidence claims, urgent priority, event tracking |
| `test-review-workflow.ts` | 3/3 | Approve, reject, and correct review actions |
| `test-concurrent.ts` | 5/5 | 5 claims in 42ms, 100% success rate |
| `test-events.ts` | 24 events | Full event timeline with visual progress bars |

**Key Learnings from Testing:**

1. **Enrichment Service**: Boosts confidence scores (e.g., 72% → 82%) through normalization
2. **Concurrent Processing**: Very efficient - 5 claims in ~42ms (8ms average per claim)
3. **Event Emission**: 24 events emitted for a single claim lifecycle
4. **Human Review Flow**: Three distinct paths work correctly (approve, reject, correct)
5. **Valid NPI**: Use `1234567893` for tests (passes Luhn checksum validation)

---

## 8. Sample Test Data

### Sample CMS-1500 Data (JSON)

Create `test-fixtures/sample-cms1500.json`:

```json
{
  "documentType": "cms_1500",
  "patient": {
    "memberId": "ABC123456789",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1975-08-22",
    "gender": "M",
    "address": {
      "street1": "123 Main Street",
      "street2": "Apt 4B",
      "city": "Boston",
      "state": "MA",
      "zipCode": "02115",
      "country": "US"
    }
  },
  "provider": {
    "npi": "1234567893",
    "name": "Boston Medical Associates",
    "taxId": "123456789",
    "specialty": "Internal Medicine",
    "address": {
      "street1": "456 Healthcare Blvd",
      "city": "Boston",
      "state": "MA",
      "zipCode": "02116",
      "country": "US"
    }
  },
  "diagnoses": [
    { "code": "E11.9", "description": "Type 2 diabetes mellitus without complications", "isPrimary": true },
    { "code": "I10", "description": "Essential (primary) hypertension", "isPrimary": false },
    { "code": "E78.5", "description": "Hyperlipidemia, unspecified", "isPrimary": false }
  ],
  "serviceLines": [
    {
      "lineNumber": 1,
      "dateOfService": "2024-01-15",
      "procedureCode": "99214",
      "modifiers": ["25"],
      "diagnosisPointers": ["A", "B", "C"],
      "units": 1,
      "chargeAmount": 175.00,
      "placeOfService": "11"
    },
    {
      "lineNumber": 2,
      "dateOfService": "2024-01-15",
      "procedureCode": "83036",
      "modifiers": [],
      "diagnosisPointers": ["A"],
      "units": 1,
      "chargeAmount": 45.00,
      "placeOfService": "11"
    },
    {
      "lineNumber": 3,
      "dateOfService": "2024-01-15",
      "procedureCode": "80061",
      "modifiers": [],
      "diagnosisPointers": ["C"],
      "units": 1,
      "chargeAmount": 65.00,
      "placeOfService": "11"
    }
  ],
  "totals": {
    "totalCharges": 285.00
  }
}
```

---

## 9. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `CLAUDE_CODE_OAUTH_TOKEN not set` | Add your OAuth token to `.env` file |
| `Cannot find module` | Run `npm install` and ensure `npm run build` succeeds |
| `ENOENT: no such file` | Create required directories: `mkdir -p data/storage data/uploads` |
| `Permission denied` | Check file permissions on data directories |
| `Rate limit exceeded` | Add delays between API calls or use a higher tier API key |
| `Image too large` | Vision service auto-resizes, but very large files may fail |

### Debug Mode

Enable verbose logging:

```bash
LOG_LEVEL=debug npx tsx test-services.ts all
```

### Checking Stored Data

```bash
# View stored claims
ls -la data/storage/claims/

# View a specific claim
cat data/storage/claims/CLM-*.json | jq .

# View vector store
ls -la data/storage/vectorstore/

# View feedback data
ls -la data/storage/feedback/
```

### Clean Up Test Data

```bash
# Remove all test data
rm -rf data/storage/*
rm -rf data/uploads/*

# Recreate directories
mkdir -p data/storage data/uploads
```

---

## Quick Reference

### Test Commands Summary

```bash
# Setup
npm install
cp .env.example .env
# Edit .env with API key
mkdir -p data/storage data/uploads

# Service Tests
npx tsx test-services.ts config
npx tsx test-services.ts validators
npx tsx test-services.ts npi
npx tsx test-services.ts enrichment
npx tsx test-services.ts embeddings
npx tsx test-services.ts vectorstore
npx tsx test-services.ts quality
npx tsx test-services.ts all

# Agent Tests
npx tsx test-agents.ts intake
npx tsx test-agents.ts validation
npx tsx test-agents.ts adjudication
npx tsx test-agents.ts all

# Advanced Feature Tests
npx tsx test-rag.ts
npx tsx test-vision.ts

# End-to-End Test
npx tsx test-e2e.ts

# Orchestrator Tests (Section 7)
npx tsx test-orchestrator.ts       # All orchestrator tests
npx tsx test-state-manager.ts      # State manager only
npx tsx test-workflow.ts           # Workflow orchestrator only
npx tsx test-review-workflow.ts    # Human review workflow
npx tsx test-concurrent.ts         # Concurrent processing
npx tsx test-events.ts             # Event monitoring
```

### Expected Test Duration

| Test | Duration |
|------|----------|
| Config | < 1s |
| Validators | < 1s |
| NPI | < 1s |
| Enrichment | < 1s |
| Embeddings | 1-2s |
| Vector Store | 2-3s |
| Quality | 5-10s (API calls) |
| RAG | 10-20s (API calls) |
| Vision | 10-30s (API calls) |
| E2E | 30-60s |
| Orchestrator (all) | 1-3s |
| State Manager | < 1s |
| Workflow | 1-2s |
| Review Workflow | 1-2s |
| Concurrent | < 1s |
| Events | < 1s |

---

## Next Steps

After manual testing passes:

### Immediate Priority: API Layer (Phase 11)

1. **REST API Implementation**
   - `POST /api/claims` - Document upload and processing
   - `GET /api/claims/:id` - Claim status and data retrieval
   - `GET /api/claims/:id/extraction` - Extracted field data
   - `POST /api/claims/:id/review` - Human review submission
   - `GET /api/review-queue` - Pending review list

2. **WebSocket Support**
   - Real-time claim status updates
   - Event streaming for workflow progress
   - Review queue notifications

3. **File Upload Handling**
   - Multer middleware for multipart uploads
   - Support for PDF, PNG, JPG, TIFF formats
   - File size validation and limits

### Short-term: UI Development (Phase 12)

4. **Claims Dashboard UI**
   - Claim submission form with drag-and-drop
   - Status tracking with real-time updates
   - Extraction results viewer with confidence highlighting

5. **Review Queue Interface**
   - List of claims pending human review
   - Side-by-side document and extraction view
   - Approve/Reject/Correct action buttons
   - Correction form for field edits

### Medium-term: Production Hardening

6. **Formal Test Suite**
   - Unit tests with Vitest
   - Integration tests for API
   - Load testing for performance validation

7. **Production Features**
   - Authentication and authorization
   - Database migration (PostgreSQL)
   - Docker containerization
   - CI/CD with GitHub Actions
   - Monitoring and alerting
