// test-comprehensive-e2e.ts
// Comprehensive End-to-End Test with Real Data
// Tests both structured (JSON) and unstructured (image) document processing

import { config } from 'dotenv';
config();

import fs from 'fs/promises';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

const testResults: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const details = await testFn();
    testResults.push({ name, passed: true, details, duration: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    testResults.push({
      name,
      passed: false,
      details: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
    });
    console.log(`  ❌ ${name}: ${error}`);
  }
}

async function testComprehensiveE2E() {
  console.log('═'.repeat(60));
  console.log('🏥 Comprehensive End-to-End Healthcare Claims Processing Test');
  console.log('═'.repeat(60));
  console.log('');

  // Check for required tokens
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!oauthToken || oauthToken === 'your-oauth-token-here') {
    console.log('⚠️  CLAUDE_CODE_OAUTH_TOKEN required for comprehensive E2E test');
    console.log('   Set this in your .env file to run the full test suite.\n');
    return;
  }

  const hasVisionCapability = !!apiKey;
  if (!hasVisionCapability) {
    console.log('ℹ️  ANTHROPIC_API_KEY not set - Vision tests will be skipped');
    console.log('   (OAuth doesn\'t support multimodal/vision API)\n');
  }

  // ═══════════════════════════════════════════════════════════════
  // PART 1: Structured Data Test (JSON Input)
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('📋 PART 1: Structured Data Processing (JSON Input)');
  console.log('─'.repeat(60));
  console.log('');

  // Create sample CMS-1500 structured data
  const structuredClaim = {
    id: 'STRUCTURED-E2E-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM-STRUCT-12345',
      firstName: 'Sarah',
      lastName: 'Johnson',
      dateOfBirth: '1978-04-22',
      gender: 'F' as const,
      address: {
        street1: '456 Oak Avenue',
        street2: 'Suite 200',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893',
      name: 'Chicago Medical Group',
      taxId: '36-1234567',
      specialty: 'Family Medicine',
      address: {
        street1: '789 Healthcare Blvd',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60602',
        country: 'US',
      },
    },
    diagnoses: [
      { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', isPrimary: true },
      { code: 'I10', description: 'Essential (primary) hypertension', isPrimary: false },
      { code: 'E78.5', description: 'Hyperlipidemia, unspecified', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-03-15',
        procedureCode: '99214',
        modifiers: ['25'],
        diagnosisPointers: ['A', 'B', 'C'],
        units: 1,
        chargeAmount: 185.00,
        placeOfService: '11',
      },
      {
        lineNumber: 2,
        dateOfService: '2024-03-15',
        procedureCode: '80053',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 45.00,
        placeOfService: '11',
      },
      {
        lineNumber: 3,
        dateOfService: '2024-03-15',
        procedureCode: '85025',
        modifiers: [],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 25.00,
        placeOfService: '11',
      },
    ],
    totals: {
      totalCharges: 255.00,
    },
    confidenceScores: {
      'patient.memberId': 0.99,
      'patient.firstName': 0.99,
      'patient.lastName': 0.99,
      'provider.npi': 0.99,
    },
    provenance: {
      source: 'structured_json_input',
      extractedAt: new Date().toISOString(),
    },
  };

  // Step 1.1: Enrichment
  console.log('Step 1.1: Enrichment & Normalization');
  await runTest('Enrich structured claim', async () => {
    const { getEnrichmentService } = await import('./src/services/enrichment.js');
    const enrichmentService = getEnrichmentService();
    const result = await enrichmentService.enrichClaim(structuredClaim);
    return `${result.normalizations.length} normalizations, ${result.enrichments.length} enrichments, confidence: ${(result.overallConfidence * 100).toFixed(0)}%`;
  });

  // Step 1.2: Validation
  console.log('Step 1.2: Validation');
  let structuredValidationResult: any;
  await runTest('Validate structured claim', async () => {
    const { ValidationAgent } = await import('./src/agents/validation.js');
    const agent = new ValidationAgent();
    const mockRecord = {
      id: structuredClaim.id,
      status: 'validating' as const,
      priority: 'normal' as const,
      documentId: 'doc-structured-001',
      documentHash: 'structured-hash-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingHistory: [],
    };
    const result = await agent.execute({ extractedClaim: structuredClaim }, mockRecord);
    structuredValidationResult = result.data?.validationResult;
    return `Valid: ${result.data?.validationResult.isValid}, Errors: ${result.data?.validationResult.errors.length}, Warnings: ${result.data?.validationResult.warnings.length}`;
  });

  // Step 1.3: Quality Assessment
  console.log('Step 1.3: Quality Assessment');
  let structuredQualityResult: any;
  await runTest('Assess extraction quality', async () => {
    const { getQualityService } = await import('./src/services/quality.js');
    const qualityService = getQualityService();
    const result = await qualityService.evaluateExtraction({
      extractedClaim: structuredClaim,
      ocrText: 'Structured JSON input - no OCR text',
      validationResult: structuredValidationResult,
    });
    structuredQualityResult = result;
    return `Grade: ${result.grade}, Score: ${(result.overallScore * 100).toFixed(0)}%, Review: ${result.requiresReview}`;
  });

  // Step 1.4: Adjudication
  console.log('Step 1.4: Adjudication');
  let structuredAdjudicationResult: any;
  await runTest('Adjudicate claim', async () => {
    const { AdjudicationAgent } = await import('./src/agents/adjudication.js');
    const agent = new AdjudicationAgent();
    const mockRecord = {
      id: structuredClaim.id,
      status: 'adjudicating' as const,
      priority: 'normal' as const,
      documentId: 'doc-structured-001',
      documentHash: 'structured-hash-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processingHistory: [],
    };
    const result = await agent.execute({ extractedClaim: structuredClaim }, mockRecord);
    structuredAdjudicationResult = result.data?.decision;
    const decision = result.data?.decision;
    return `Status: ${decision?.status}, Billed: $${decision?.totals.totalBilled.toFixed(2)}, Allowed: $${decision?.totals.totalAllowed.toFixed(2)}, Paid: $${decision?.totals.totalPaid.toFixed(2)}`;
  });

  // Step 1.5: Index for RAG
  console.log('Step 1.5: RAG Indexing');
  await runTest('Index claim for RAG', async () => {
    const { getRAGService } = await import('./src/services/rag.js');
    const ragService = getRAGService();
    await ragService.indexClaim(structuredClaim);
    return `Indexed claim ${structuredClaim.id}`;
  });

  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // PART 2: Unstructured Data Test (Image Input)
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('🖼️  PART 2: Unstructured Data Processing (Image Input)');
  console.log('─'.repeat(60));
  console.log('');

  // Check for test image
  const testImagePath = 'test-claim.png';
  let hasTestImage = false;
  let testImage: Buffer | null = null;

  try {
    testImage = await fs.readFile(testImagePath);
    hasTestImage = true;
    console.log(`  ✅ Found test image: ${testImagePath}`);
  } catch {
    console.log(`  ⚠️  No test image found at ${testImagePath}`);
    console.log('     Place a CMS-1500 claim image there to test Vision extraction');
  }

  if (hasTestImage && hasVisionCapability && testImage) {
    // Step 2.1: Vision Layout Analysis
    console.log('Step 2.1: Vision Layout Analysis');
    let layoutResult: any;
    await runTest('Analyze document layout', async () => {
      const { getVisionService } = await import('./src/services/vision.js');
      const visionService = getVisionService();
      const result = await visionService.analyzeLayout(testImage!);
      layoutResult = result;
      return `Type: ${result.documentType}, Tables: ${result.hasTables}, Handwriting: ${result.hasHandwriting}, Quality: ${result.quality}, Regions: ${result.regions.length}`;
    });

    // Step 2.2: Vision Form Field Extraction
    console.log('Step 2.2: Vision Form Field Extraction');
    let formFieldsResult: any;
    await runTest('Extract form fields', async () => {
      const { getVisionService } = await import('./src/services/vision.js');
      const visionService = getVisionService();
      const result = await visionService.extractFormFields(testImage!);
      formFieldsResult = result;
      return `Found ${result.fields.length} fields`;
    });

    // Step 2.3: Full Vision Extraction
    console.log('Step 2.3: Full Document Extraction');
    let visionExtraction: any;
    await runTest('Extract claim data from image', async () => {
      const { getVisionService } = await import('./src/services/vision.js');
      const visionService = getVisionService();
      const result = await visionService.extractFromImage(testImage!, layoutResult?.documentType);
      visionExtraction = result;
      const claim = result.extractedClaim;
      const diagCount = claim.diagnoses?.length ?? 0;
      const lineCount = claim.serviceLines?.length ?? 0;
      return `Extracted: ${diagCount} diagnoses, ${lineCount} service lines, Patient: ${claim.patient?.firstName} ${claim.patient?.lastName}`;
    });

    // If we got vision extraction, run through the pipeline
    if (visionExtraction?.extractedClaim) {
      const extractedClaim = {
        ...visionExtraction.extractedClaim,
        id: 'VISION-E2E-001',
        confidenceScores: visionExtraction.confidenceScores || {},
        provenance: {
          source: 'vision_extraction',
          extractedAt: new Date().toISOString(),
        },
      };

      // Step 2.4: Validate Vision Extraction
      console.log('Step 2.4: Validate Vision Extraction');
      await runTest('Validate vision-extracted claim', async () => {
        const { ValidationAgent } = await import('./src/agents/validation.js');
        const agent = new ValidationAgent();
        const mockRecord = {
          id: extractedClaim.id,
          status: 'validating' as const,
          priority: 'normal' as const,
          documentId: 'doc-vision-001',
          documentHash: 'vision-hash-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          processingHistory: [],
        };
        const result = await agent.execute({ extractedClaim }, mockRecord);
        return `Valid: ${result.data?.validationResult.isValid}, Errors: ${result.data?.validationResult.errors.length}`;
      });

      // Step 2.5: Quality Assessment of Vision Extraction
      console.log('Step 2.5: Quality Assessment');
      await runTest('Assess vision extraction quality', async () => {
        const { getQualityService } = await import('./src/services/quality.js');
        const qualityService = getQualityService();
        const result = await qualityService.evaluateExtraction({
          extractedClaim,
          ocrText: formFieldsResult?.fields?.map((f: any) => `${f.label}: ${f.value}`).join('\n') || '',
        });
        return `Grade: ${result.grade}, Score: ${(result.overallScore * 100).toFixed(0)}%`;
      });

      // Step 2.6: Index vision extraction for RAG
      console.log('Step 2.6: RAG Indexing');
      await runTest('Index vision-extracted claim for RAG', async () => {
        const { getRAGService } = await import('./src/services/rag.js');
        const ragService = getRAGService();
        // Only index if we have the required fields
        if (extractedClaim.patient?.memberId && extractedClaim.provider?.npi) {
          await ragService.indexClaim(extractedClaim as any);
          return `Indexed claim ${extractedClaim.id}`;
        }
        return 'Skipped - missing required fields';
      });
    }
  } else if (!hasVisionCapability) {
    console.log('  ⏭️  Skipping Vision tests (requires ANTHROPIC_API_KEY)');
  } else {
    console.log('  ⏭️  Skipping Vision tests (no test image)');
  }

  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // PART 3: RAG Query Tests
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('🔍 PART 3: RAG Query Tests');
  console.log('─'.repeat(60));
  console.log('');

  // Step 3.1: Query indexed claims
  console.log('Step 3.1: Query Claims');
  const testQueries = [
    'What patients have diabetes?',
    'What is the total charges for claims with hypertension?',
    'Which providers are in Chicago?',
  ];

  for (const query of testQueries) {
    await runTest(`Query: "${query.substring(0, 40)}..."`, async () => {
      const { getRAGService } = await import('./src/services/rag.js');
      const ragService = getRAGService();
      const result = await ragService.query({ question: query, maxChunks: 5 });
      return `Answer: ${result.answer.substring(0, 80)}... (${(result.confidence * 100).toFixed(0)}% confidence)`;
    });
  }

  // Step 3.2: Find similar claims
  console.log('Step 3.2: Similar Claims');
  await runTest('Find similar claims', async () => {
    const { getRAGService } = await import('./src/services/rag.js');
    const ragService = getRAGService();
    const similar = await ragService.findSimilarClaims('STRUCTURED-E2E-001', 3);
    return `Found ${similar.length} similar claims`;
  });

  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // PART 4: Cross-Document Comparison
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('📊 PART 4: Claims Comparison & Analytics');
  console.log('─'.repeat(60));
  console.log('');

  // Create a second structured claim for comparison
  const comparisonClaim = {
    ...structuredClaim,
    id: 'STRUCTURED-E2E-002',
    patient: {
      ...structuredClaim.patient,
      memberId: 'MEM-STRUCT-67890',
      firstName: 'Michael',
      lastName: 'Chen',
      dateOfBirth: '1965-11-08',
      gender: 'M' as const,
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', isPrimary: true },
      { code: 'I10', description: 'Essential (primary) hypertension', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-03-18',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 125.00,
        placeOfService: '11',
      },
    ],
    totals: { totalCharges: 125.00 },
  };

  // Index comparison claim
  console.log('Step 4.1: Index Comparison Claim');
  await runTest('Index comparison claim', async () => {
    const { getRAGService } = await import('./src/services/rag.js');
    const ragService = getRAGService();
    await ragService.indexClaim(comparisonClaim);
    return `Indexed claim ${comparisonClaim.id}`;
  });

  // Semantic search
  console.log('Step 4.2: Semantic Search');
  await runTest('Search for diabetes-related claims', async () => {
    const { getRAGService } = await import('./src/services/rag.js');
    const ragService = getRAGService();
    const results = await ragService.semanticSearch('diabetes management office visit', { limit: 5 });
    return `Found ${results.length} relevant chunks`;
  });

  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log('');

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const total = testResults.length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`  Tests Run: ${total}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('');

  if (failed > 0) {
    console.log('Failed Tests:');
    for (const result of testResults.filter(r => !r.passed)) {
      console.log(`  ❌ ${result.name}`);
      console.log(`     ${result.details}`);
    }
    console.log('');
  }

  // Structured claim summary
  console.log('─'.repeat(60));
  console.log('Structured Claim Summary (STRUCTURED-E2E-001):');
  console.log('─'.repeat(60));
  console.log(`  Patient: ${structuredClaim.patient.firstName} ${structuredClaim.patient.lastName}`);
  console.log(`  Provider: ${structuredClaim.provider.name}`);
  console.log(`  Diagnoses: ${structuredClaim.diagnoses.map(d => d.code).join(', ')}`);
  console.log(`  Total Charges: $${structuredClaim.totals.totalCharges.toFixed(2)}`);
  if (structuredQualityResult) {
    console.log(`  Quality Grade: ${structuredQualityResult.grade} (${(structuredQualityResult.overallScore * 100).toFixed(0)}%)`);
  }
  if (structuredAdjudicationResult) {
    console.log(`  Adjudication: ${structuredAdjudicationResult.status.toUpperCase()}`);
    console.log(`  Allowed Amount: $${structuredAdjudicationResult.totals.totalAllowed.toFixed(2)}`);
    console.log(`  Plan Paid: $${structuredAdjudicationResult.totals.totalPaid.toFixed(2)}`);
    console.log(`  Patient Responsibility: $${structuredAdjudicationResult.totals.totalPatientResponsibility.toFixed(2)}`);
  }
  console.log('');

  console.log('═'.repeat(60));
  console.log('✨ Comprehensive E2E Test Complete');
  console.log('═'.repeat(60));
}

testComprehensiveE2E().catch(console.error);
