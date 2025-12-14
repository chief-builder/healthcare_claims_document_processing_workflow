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
      npi: '1234567893',
      name: 'Test Provider',
      taxId: '123456789',
      specialty: 'Family Medicine',
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 diabetes', isPrimary: true },
    ],
    serviceLines: [{
      lineNumber: 1,
      dateOfService: '2024-01-15',
      procedureCode: '99213',
      modifiers: [],
      diagnosisPointers: ['A'],
      units: 1,
      chargeAmount: 150.00,
      placeOfService: '11',
    }],
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

async function testConcurrent() {
  console.log('⚡ Concurrent Processing Tests\n');

  const {
    getWorkflowOrchestrator,
    resetStateManager,
    resetWorkflowOrchestrator,
  } = await import('./src/orchestrator/index.js');

  resetStateManager();
  resetWorkflowOrchestrator();

  const orchestrator = getWorkflowOrchestrator({
    enableRAGIndexing: false,
    enableQualityAssessment: false,
  });

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
      `${r.claimId.padEnd(14)} | ${((conf ?? 0) * 100).toFixed(0).padStart(5)}%     | ${r.finalStatus.padEnd(11)} | ${r.processingTimeMs.toString().padStart(5)}`
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
  console.log(`  Completed: ${stats.stateStats.byStatus.completed || 0}`);
  console.log(`  Pending review: ${stats.stateStats.byStatus.pending_review || 0}`);
  console.log(`  Failed: ${stats.stateStats.byStatus.failed || 0}`);

  console.log('\n✓ Concurrent Processing tests completed');
}

testConcurrent().catch(console.error);
