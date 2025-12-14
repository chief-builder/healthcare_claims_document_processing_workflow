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
