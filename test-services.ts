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
      // Run lightweight tests first, then heavy ones
      await testConfig();
      await testValidators();
      await testNPI();
      await testEmbeddings();    // Lightweight - run before heavy imports
      await testVectorStore();   // Uses embeddings
      await testEnrichment();    // Heavy - imports Anthropic SDK
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
    console.log('  ✅ Config loaded successfully\n');

    console.log('  🖥️  Server:');
    console.log(`     - Port: ${config.server.port}`);
    console.log(`     - Host: ${config.server.host}`);
    console.log(`     - Environment: ${config.server.nodeEnv}`);

    console.log('\n  🤖 Anthropic:');
    console.log(`     - API Key: ${config.anthropic.apiKey ? '***' + config.anthropic.apiKey.slice(-4) : 'NOT SET'}`);
    console.log(`     - Model: ${config.anthropic.model}`);

    console.log('\n  📁 Storage:');
    console.log(`     - Storage Path: ${config.storage.storagePath}`);
    console.log(`     - Upload Path: ${config.storage.uploadPath}`);

    console.log('\n  🔴 Redis:');
    console.log(`     - URL: ${config.redis.url}`);

    console.log('\n  ⚙️  Processing:');
    console.log(`     - Max Correction Attempts: ${config.processing.maxCorrectionAttempts}`);
    console.log(`     - Auto Process Confidence Threshold: ${config.processing.autoProcessConfidenceThreshold}`);
    console.log(`     - Correction Confidence Threshold: ${config.processing.correctionConfidenceThreshold}`);

    console.log('\n  📝 Logging:');
    console.log(`     - Level: ${config.logging.level}`);
    console.log(`     - Format: ${config.logging.format}`);
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
  console.log('⭐ Testing Quality Service (requires OAuth token)...');

  // Claude Agent SDK reads CLAUDE_CODE_OAUTH_TOKEN directly from environment
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  if (!oauthToken || oauthToken === 'your-oauth-token-here') {
    console.log('  ⚠️  Skipping - CLAUDE_CODE_OAUTH_TOKEN not set');
    console.log('  Set it with: export CLAUDE_CODE_OAUTH_TOKEN="your-token"');
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
