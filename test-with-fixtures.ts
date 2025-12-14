// test-with-fixtures.ts
// End-to-End Test using pre-defined test fixtures

import { config } from 'dotenv';
config();

import fs from 'fs/promises';

async function testWithFixtures() {
  console.log('═'.repeat(60));
  console.log('🏥 Healthcare Claims Processing - Test Fixtures Demo');
  console.log('═'.repeat(60));
  console.log('');

  // Check for OAuth token
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!oauthToken || oauthToken === 'your-oauth-token-here') {
    console.log('⚠️  CLAUDE_CODE_OAUTH_TOKEN required\n');
    return;
  }

  // Import test fixtures
  const {
    sampleCMS1500Claims,
    sampleUB04Claims,
    sampleEOBClaims,
    sampleOCRTexts,
    testScenarios,
  } = await import('./test-fixtures/sample-claims.js');

  // Import services
  const { getEnrichmentService } = await import('./src/services/enrichment.js');
  const { ValidationAgent } = await import('./src/agents/validation.js');
  const { getQualityService } = await import('./src/services/quality.js');
  const { AdjudicationAgent } = await import('./src/agents/adjudication.js');
  const { getRAGService } = await import('./src/services/rag.js');

  const enrichmentService = getEnrichmentService();
  const validationAgent = new ValidationAgent();
  const qualityService = getQualityService();
  const adjudicationAgent = new AdjudicationAgent();
  const ragService = getRAGService();

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Process CMS-1500 Claims (Professional)
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('📋 TEST 1: CMS-1500 Claims Processing');
  console.log('─'.repeat(60));
  console.log('');

  for (const claim of sampleCMS1500Claims) {
    console.log(`Processing: ${claim.id}`);
    console.log(`  Patient: ${claim.patient.firstName} ${claim.patient.lastName}`);
    console.log(`  Diagnoses: ${claim.diagnoses.map(d => d.code).join(', ')}`);
    console.log(`  Charges: $${claim.totals.totalCharges.toFixed(2)}`);

    // Enrichment
    const enriched = await enrichmentService.enrichClaim(claim);
    console.log(`  Enrichment: ${enriched.normalizations.length} normalizations, ${enriched.enrichments.length} enrichments`);

    // Validation
    const mockRecord = createMockRecord(claim.id);
    const validation = await validationAgent.execute({ extractedClaim: enriched.enrichedClaim }, mockRecord);
    console.log(`  Validation: ${validation.data?.validationResult.isValid ? '✅ Valid' : '❌ Invalid'} (${validation.data?.validationResult.errors.length} errors, ${validation.data?.validationResult.warnings.length} warnings)`);

    // Quality
    const quality = await qualityService.evaluateExtraction({
      extractedClaim: enriched.enrichedClaim,
      ocrText: sampleOCRTexts.cms1500,
      validationResult: validation.data?.validationResult,
    });
    console.log(`  Quality: Grade ${quality.grade} (${(quality.overallScore * 100).toFixed(0)}%)`);

    // Adjudication
    const adjudication = await adjudicationAgent.execute(
      { extractedClaim: enriched.enrichedClaim },
      { ...mockRecord, status: 'adjudicating' }
    );
    const decision = adjudication.data?.decision;
    console.log(`  Adjudication: ${decision?.status.toUpperCase()}`);
    console.log(`    Billed: $${decision?.totals.totalBilled.toFixed(2)} | Allowed: $${decision?.totals.totalAllowed.toFixed(2)} | Paid: $${decision?.totals.totalPaid.toFixed(2)}`);

    // Index for RAG
    await ragService.indexClaim(enriched.enrichedClaim);
    console.log(`  RAG: Indexed ✅`);
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Process UB-04 Claims (Institutional)
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('🏥 TEST 2: UB-04 Claims Processing');
  console.log('─'.repeat(60));
  console.log('');

  for (const claim of sampleUB04Claims) {
    console.log(`Processing: ${claim.id}`);
    console.log(`  Patient: ${claim.patient.firstName} ${claim.patient.lastName}`);
    console.log(`  Facility: ${claim.provider.name}`);
    console.log(`  Diagnoses: ${claim.diagnoses.map(d => d.code).join(', ')}`);
    console.log(`  Charges: $${claim.totals.totalCharges.toFixed(2)}`);

    // Enrichment
    const enriched = await enrichmentService.enrichClaim(claim);
    console.log(`  Enrichment: ${enriched.normalizations.length} normalizations, ${enriched.enrichments.length} enrichments`);

    // Validation
    const mockRecord = createMockRecord(claim.id);
    const validation = await validationAgent.execute({ extractedClaim: enriched.enrichedClaim }, mockRecord);
    console.log(`  Validation: ${validation.data?.validationResult.isValid ? '✅ Valid' : '❌ Invalid'}`);

    // Quality
    const quality = await qualityService.evaluateExtraction({
      extractedClaim: enriched.enrichedClaim,
      ocrText: sampleOCRTexts.ub04,
      validationResult: validation.data?.validationResult,
    });
    console.log(`  Quality: Grade ${quality.grade} (${(quality.overallScore * 100).toFixed(0)}%)`);

    // Adjudication
    const adjudication = await adjudicationAgent.execute(
      { extractedClaim: enriched.enrichedClaim },
      { ...mockRecord, status: 'adjudicating' }
    );
    const decision = adjudication.data?.decision;
    console.log(`  Adjudication: ${decision?.status.toUpperCase()}`);
    console.log(`    Billed: $${decision?.totals.totalBilled.toFixed(2)} | Paid: $${decision?.totals.totalPaid.toFixed(2)}`);

    // Index for RAG
    await ragService.indexClaim(enriched.enrichedClaim);
    console.log(`  RAG: Indexed ✅`);
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Validation Edge Cases
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('⚠️  TEST 3: Validation Edge Cases');
  console.log('─'.repeat(60));
  console.log('');

  // Test invalid claim with missing fields
  console.log('Scenario: Missing Required Fields');
  const missingFields = testScenarios.invalidMissingFields;
  const missingResult = await validationAgent.execute(
    { extractedClaim: missingFields as any },
    createMockRecord(missingFields.id)
  );
  console.log(`  Valid: ${missingResult.data?.validationResult.isValid ? '✅' : '❌'}`);
  console.log(`  Errors: ${missingResult.data?.validationResult.errors.length}`);
  for (const error of missingResult.data?.validationResult.errors.slice(0, 3) ?? []) {
    console.log(`    - ${error.field}: ${error.message}`);
  }
  console.log('');

  // Test invalid codes
  console.log('Scenario: Invalid Codes');
  const invalidCodes = testScenarios.invalidCodes;
  const invalidResult = await validationAgent.execute(
    { extractedClaim: invalidCodes as any },
    createMockRecord(invalidCodes.id)
  );
  console.log(`  Valid: ${invalidResult.data?.validationResult.isValid ? '✅' : '❌'}`);
  console.log(`  Errors: ${invalidResult.data?.validationResult.errors.length}`);
  for (const error of invalidResult.data?.validationResult.errors.slice(0, 3) ?? []) {
    console.log(`    - ${error.field}: ${error.message}`);
  }
  console.log('');

  // Test low confidence
  console.log('Scenario: Low Confidence Scores');
  const lowConf = testScenarios.lowConfidence;
  const lowConfQuality = await qualityService.evaluateExtraction({
    extractedClaim: lowConf as any,
    ocrText: 'Test OCR text',
  });
  console.log(`  Quality Grade: ${lowConfQuality.grade}`);
  console.log(`  Requires Review: ${lowConfQuality.requiresReview ? 'Yes ⚠️' : 'No'}`);
  console.log(`  Low Confidence Fields: ${lowConfQuality.lowConfidenceFields.length}`);
  for (const field of lowConfQuality.lowConfidenceFields) {
    console.log(`    - ${field.field}: ${(field.confidence * 100).toFixed(0)}%`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: RAG Queries
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('🔍 TEST 4: RAG Queries Across All Claims');
  console.log('─'.repeat(60));
  console.log('');

  const queries = [
    'Which patients have diabetes?',
    'What cardiac procedures were performed?',
    'List all emergency room visits',
    'What are the highest charge claims?',
    'Find claims with hypertension diagnosis',
  ];

  for (const query of queries) {
    console.log(`Query: "${query}"`);
    const result = await ragService.query({ question: query, maxChunks: 5, minRelevance: 0.3 });
    console.log(`  Answer: ${result.answer.substring(0, 100)}${result.answer.length > 100 ? '...' : ''}`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`  Sources: ${result.sources.length}`);
    console.log('');
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Similar Claims Detection
  // ═══════════════════════════════════════════════════════════════
  console.log('─'.repeat(60));
  console.log('🔗 TEST 5: Similar Claims Detection');
  console.log('─'.repeat(60));
  console.log('');

  // Find claims similar to the diabetes claim
  console.log('Finding claims similar to CMS1500-DIABETES-001:');
  const similar = await ragService.findSimilarClaims('CMS1500-DIABETES-001', 5);
  for (const s of similar) {
    console.log(`  - ${s.claimId}: ${(s.similarity * 100).toFixed(0)}% similar`);
  }
  console.log('');

  // Semantic search
  console.log('Semantic search for "cardiovascular disease treatment":');
  const searchResults = await ragService.semanticSearch('cardiovascular disease treatment', { limit: 3 });
  for (const result of searchResults) {
    console.log(`  - ${result.documentId}: ${(result.score * 100).toFixed(0)}% match`);
    console.log(`    "${result.chunk.text.substring(0, 80)}..."`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`  CMS-1500 Claims Processed: ${sampleCMS1500Claims.length}`);
  console.log(`  UB-04 Claims Processed: ${sampleUB04Claims.length}`);
  console.log(`  Validation Edge Cases: 3`);
  console.log(`  RAG Queries Executed: ${queries.length}`);
  console.log('');
  console.log('  Total Claims in RAG Index: 5');
  console.log('');
  console.log('═'.repeat(60));
  console.log('✨ Test Fixtures Demo Complete');
  console.log('═'.repeat(60));
}

function createMockRecord(claimId: string) {
  return {
    id: claimId,
    status: 'validating' as const,
    priority: 'normal' as const,
    documentId: `doc-${claimId}`,
    documentHash: `hash-${claimId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingHistory: [],
  };
}

testWithFixtures().catch(console.error);
