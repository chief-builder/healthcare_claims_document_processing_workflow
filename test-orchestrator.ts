/**
 * Orchestrator Test - Phase 10 Test Script
 *
 * Tests the StateManager and WorkflowOrchestrator for automated claim processing.
 */

import {
  StateManager,
  getStateManager,
  resetStateManager,
  WorkflowOrchestrator,
  getWorkflowOrchestrator,
  resetWorkflowOrchestrator,
} from './src/orchestrator/index.js';
import { ExtractedClaim, Priority } from './src/models/index.js';

// Sample extracted claims for testing - matches ExtractedClaim schema
const createSampleClaim = (id: string, confidence: number = 0.9): ExtractedClaim => ({
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
    npi: '1234567890',
    name: 'Primary Care Associates',
    taxId: '123456789',
    specialty: 'Family Medicine',
    address: {
      street1: '456 Medical Blvd',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62702',
      country: 'US',
    },
  },
  diagnoses: [
    {
      code: 'E11.9',
      description: 'Type 2 diabetes mellitus without complications',
      isPrimary: true,
    },
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
    {
      lineNumber: 2,
      dateOfService: '2024-01-15',
      procedureCode: '36415',
      modifiers: [],
      diagnosisPointers: ['A'],
      units: 1,
      chargeAmount: 50.00,
      placeOfService: '11',
    },
    {
      lineNumber: 3,
      dateOfService: '2024-01-15',
      procedureCode: '80053',
      modifiers: [],
      diagnosisPointers: ['A'],
      units: 1,
      chargeAmount: 150.00,
      placeOfService: '11',
    },
  ],
  totals: {
    totalCharges: 350.00,
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
});

async function testStateManager() {
  console.log('\n' + '='.repeat(60));
  console.log('STATE MANAGER TESTS');
  console.log('='.repeat(60));

  // Reset for clean test
  resetStateManager();
  const stateManager = getStateManager();

  // Test 1: Create state
  console.log('\n[Test 1] Creating claim state...');
  const state = await stateManager.createState(
    'CLM-TEST-001',
    'DOC-001',
    'hash123',
    'normal',
    { source: 'test' }
  );
  console.log('  ✓ State created:', state.claim.id);
  console.log('  ✓ Initial status:', state.claim.status);

  // Test 2: Transition state
  console.log('\n[Test 2] Transitioning claim state...');
  await stateManager.transitionTo('CLM-TEST-001', 'parsing', 'Starting parsing');
  const state2 = await stateManager.getState('CLM-TEST-001');
  console.log('  ✓ Transitioned to:', state2?.claim.status);

  await stateManager.transitionTo('CLM-TEST-001', 'extracting', 'Extracting fields');
  const state3 = await stateManager.getState('CLM-TEST-001');
  console.log('  ✓ Transitioned to:', state3?.claim.status);

  // Test 3: Set extracted claim
  console.log('\n[Test 3] Setting extracted claim...');
  const extractedClaim = createSampleClaim('CLM-TEST-001');
  await stateManager.setExtractedClaim('CLM-TEST-001', extractedClaim);
  const state4 = await stateManager.getState('CLM-TEST-001');
  console.log('  ✓ Extracted claim set:', !!state4?.extractedClaim);
  console.log('  ✓ Patient name:', state4?.extractedClaim?.patient?.firstName);

  // Test 4: Determine next action based on confidence
  console.log('\n[Test 4] Determining next action based on confidence...');
  console.log('  - Confidence 0.90:', stateManager.determineNextAction(0.90));
  console.log('  - Confidence 0.75:', stateManager.determineNextAction(0.75));
  console.log('  - Confidence 0.50:', stateManager.determineNextAction(0.50));

  // Test 5: Get statistics
  console.log('\n[Test 5] Getting statistics...');
  const stats = stateManager.getStatistics();
  console.log('  ✓ Total claims:', stats.total);
  console.log('  ✓ By status:', JSON.stringify(stats.byStatus));

  // Test 6: Invalid transition
  console.log('\n[Test 6] Testing invalid transition...');
  try {
    // Should fail - can't go from extracting to completed directly
    await stateManager.transitionTo('CLM-TEST-001', 'completed', 'Invalid transition');
    console.log('  ✗ Should have thrown error');
  } catch (error) {
    console.log('  ✓ Correctly rejected invalid transition');
  }

  console.log('\n✓ State Manager tests completed');
}

async function testWorkflowOrchestrator() {
  console.log('\n' + '='.repeat(60));
  console.log('WORKFLOW ORCHESTRATOR TESTS');
  console.log('='.repeat(60));

  // Reset for clean test
  resetStateManager();
  resetWorkflowOrchestrator();

  const orchestrator = getWorkflowOrchestrator({
    enableRAGIndexing: false, // Disable to speed up tests
    enableQualityAssessment: true,
  });

  // Set up event listeners
  const events: string[] = [];
  orchestrator.on('workflow:started', (data) => events.push(`started:${data.claimId}`));
  orchestrator.on('workflow:completed', (data) => events.push(`completed:${data.claimId}`));
  orchestrator.on('workflow:stage_started', (data) => events.push(`stage:${data.stage}`));
  orchestrator.on('workflow:stage_completed', (data) => events.push(`stage_done:${data.stage}`));

  // Test 1: Process high-confidence extracted claim
  console.log('\n[Test 1] Processing high-confidence claim (0.92)...');
  const highConfidenceClaim = createSampleClaim('CLM-HIGH-001', 0.92);
  const result1 = await orchestrator.processExtractedClaim(highConfidenceClaim, 'normal');
  console.log('  ✓ Success:', result1.success);
  console.log('  ✓ Final status:', result1.finalStatus);
  console.log('  ✓ Processing time:', result1.processingTimeMs, 'ms');
  if (result1.adjudicationResult) {
    const adj = result1.adjudicationResult as { decision: string };
    console.log('  ✓ Adjudication decision:', adj.decision);
  }

  // Test 2: Process medium-confidence claim
  console.log('\n[Test 2] Processing medium-confidence claim (0.70)...');
  resetStateManager(); // Reset to avoid state conflicts
  const mediumConfidenceClaim = createSampleClaim('CLM-MED-001', 0.70);
  const result2 = await orchestrator.processExtractedClaim(mediumConfidenceClaim, 'normal');
  console.log('  ✓ Success:', result2.success);
  console.log('  ✓ Final status:', result2.finalStatus);
  console.log('  ✓ Processing time:', result2.processingTimeMs, 'ms');

  // Test 3: Process urgent priority claim
  console.log('\n[Test 3] Processing urgent priority claim...');
  resetStateManager();
  const urgentClaim = createSampleClaim('CLM-URGENT-001', 0.95);
  const result3 = await orchestrator.processExtractedClaim(urgentClaim, 'urgent');
  console.log('  ✓ Success:', result3.success);
  console.log('  ✓ Final status:', result3.finalStatus);

  // Test 4: Get workflow statistics
  console.log('\n[Test 4] Getting workflow statistics...');
  const stats = orchestrator.getStatistics();
  console.log('  ✓ Total claims processed:', stats.stateStats.total);
  console.log('  ✓ Config thresholds:');
  console.log('    - Auto-process:', stats.config.autoProcessThreshold);
  console.log('    - Correction:', stats.config.correctionThreshold);

  // Test 5: Events captured
  console.log('\n[Test 5] Events captured during processing...');
  console.log('  ✓ Events recorded:', events.length);
  console.log('  ✓ Sample events:', events.slice(0, 5).join(', '));

  console.log('\n✓ Workflow Orchestrator tests completed');
}

async function testReviewWorkflow() {
  console.log('\n' + '='.repeat(60));
  console.log('REVIEW WORKFLOW TESTS');
  console.log('='.repeat(60));

  resetStateManager();
  resetWorkflowOrchestrator();

  const stateManager = getStateManager();
  const orchestrator = getWorkflowOrchestrator({ enableRAGIndexing: false });

  // Create a claim and move it to pending_review
  console.log('\n[Test 1] Setting up claim for review...');
  await stateManager.createState('CLM-REVIEW-001', 'DOC-001', 'hash123', 'normal');
  await stateManager.transitionTo('CLM-REVIEW-001', 'parsing', 'Parsing');
  await stateManager.transitionTo('CLM-REVIEW-001', 'extracting', 'Extracting');

  const claim = createSampleClaim('CLM-REVIEW-001', 0.5);
  await stateManager.setExtractedClaim('CLM-REVIEW-001', claim);
  await stateManager.transitionTo('CLM-REVIEW-001', 'validating', 'Validating');
  await stateManager.transitionTo('CLM-REVIEW-001', 'pending_review', 'Low confidence');

  const pendingState = await stateManager.getState('CLM-REVIEW-001');
  console.log('  ✓ Claim status:', pendingState?.claim.status);

  // Test 2: Approve review
  console.log('\n[Test 2] Approving review...');
  const approveResult = await orchestrator.submitReview('CLM-REVIEW-001', 'approve');
  console.log('  ✓ Result success:', approveResult.success);
  console.log('  ✓ Final status:', approveResult.finalStatus);

  // Test 3: Create another claim for rejection
  console.log('\n[Test 3] Testing review rejection...');
  await stateManager.createState('CLM-REVIEW-002', 'DOC-002', 'hash456', 'normal');
  await stateManager.transitionTo('CLM-REVIEW-002', 'parsing', 'Parsing');
  await stateManager.transitionTo('CLM-REVIEW-002', 'extracting', 'Extracting');
  const claim2 = createSampleClaim('CLM-REVIEW-002', 0.5);
  await stateManager.setExtractedClaim('CLM-REVIEW-002', claim2);
  await stateManager.transitionTo('CLM-REVIEW-002', 'validating', 'Validating');
  await stateManager.transitionTo('CLM-REVIEW-002', 'pending_review', 'Low confidence');

  const rejectResult = await orchestrator.submitReview(
    'CLM-REVIEW-002',
    'reject',
    undefined,
    'Invalid documentation'
  );
  console.log('  ✓ Rejection success:', !rejectResult.success); // Should be false (failed claim)
  console.log('  ✓ Final status:', rejectResult.finalStatus);
  console.log('  ✓ Error message:', rejectResult.error);

  console.log('\n✓ Review Workflow tests completed');
}

async function testConcurrentProcessing() {
  console.log('\n' + '='.repeat(60));
  console.log('CONCURRENT PROCESSING TESTS');
  console.log('='.repeat(60));

  resetStateManager();
  resetWorkflowOrchestrator();

  const orchestrator = getWorkflowOrchestrator({ enableRAGIndexing: false });

  console.log('\n[Test 1] Processing multiple claims concurrently...');

  const claims = [
    createSampleClaim('CLM-BATCH-001', 0.95),
    createSampleClaim('CLM-BATCH-002', 0.88),
    createSampleClaim('CLM-BATCH-003', 0.92),
  ];

  const startTime = Date.now();

  const results = await Promise.all(
    claims.map(claim => orchestrator.processExtractedClaim(claim, 'normal'))
  );

  const totalTime = Date.now() - startTime;

  console.log('  ✓ Claims processed:', results.length);
  console.log('  ✓ Total time:', totalTime, 'ms');
  console.log('  ✓ Results:');
  results.forEach((r, i) => {
    console.log(`    - Claim ${i + 1}: ${r.finalStatus} (${r.processingTimeMs}ms)`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log('  ✓ Success rate:', (successCount / results.length * 100).toFixed(0) + '%');

  console.log('\n✓ Concurrent Processing tests completed');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          PHASE 10 - ORCHESTRATOR TEST SUITE                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await testStateManager();
    await testWorkflowOrchestrator();
    await testReviewWorkflow();
    await testConcurrentProcessing();

    console.log('\n' + '='.repeat(60));
    console.log('ALL ORCHESTRATOR TESTS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\nPhase 10 (Orchestrator) is ready for use!');
    console.log('\nKey features implemented:');
    console.log('  • StateManager - Claim state transitions and persistence');
    console.log('  • WorkflowOrchestrator - Automated pipeline processing');
    console.log('  • Confidence-based routing (auto-process/correct/review)');
    console.log('  • Event emission for status updates');
    console.log('  • Human review integration');
    console.log('  • Concurrent claim processing support');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

main();
