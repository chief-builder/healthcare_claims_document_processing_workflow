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
7. [Sample Test Data](#7-sample-test-data)
8. [Troubleshooting](#8-troubleshooting)

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
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
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

  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'your-api-key-here') {
    console.log('  ⚠️  Skipping - ANTHROPIC_API_KEY not set');
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

  if (!conf.anthropic.apiKey || conf.anthropic.apiKey === 'your-api-key-here') {
    console.log('⚠️  ANTHROPIC_API_KEY not set - skipping LLM-dependent tests\n');
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

  if (!conf.anthropic.apiKey || conf.anthropic.apiKey === 'your-api-key-here') {
    console.log('⚠️  ANTHROPIC_API_KEY not set - skipping vision tests\n');
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

  if (!conf.anthropic.apiKey || conf.anthropic.apiKey === 'your-api-key-here') {
    console.log('⚠️  ANTHROPIC_API_KEY required for E2E test\n');
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

## 7. Sample Test Data

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

## 8. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `ANTHROPIC_API_KEY not set` | Add your API key to `.env` file |
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

---

## Next Steps

After manual testing passes:

1. **Write automated unit tests** in `tests/unit/`
2. **Set up CI/CD** with GitHub Actions
3. **Implement API server** (Phase 5-6 of implementation plan)
4. **Create integration tests** for the API
5. **Add load testing** for performance validation
