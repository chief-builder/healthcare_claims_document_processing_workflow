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
