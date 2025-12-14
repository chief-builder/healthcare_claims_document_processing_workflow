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
