// test-e2e.ts
import { config } from 'dotenv';
config();

async function testE2E() {
  console.log('🚀 End-to-End Pipeline Test\n');

  // Check for OAuth token
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!oauthToken || oauthToken === 'your-oauth-token-here') {
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
    { ...mockClaimRecord, status: 'adjudicating' as const }
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
  console.log('='.repeat(50));
  console.log('📊 E2E Test Summary');
  console.log('='.repeat(50));
  console.log(`  Claim ID: ${intakeResult.data?.claimId}`);
  console.log(`  Document Type: ${mockExtraction.documentType}`);
  console.log(`  Validation: ${validationResult.data?.validationResult.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`  Quality Grade: ${qualityResult.grade}`);
  console.log(`  Adjudication: ${decision?.status.toUpperCase()}`);
  console.log(`  Payment: $${decision?.totals.totalPaid.toFixed(2)} of $${decision?.totals.totalBilled.toFixed(2)}`);
  console.log('');
}

testE2E().catch(console.error);
