// test-events.ts
import { config } from 'dotenv';
config();

import { ExtractedClaim } from './src/models/index.js';

function createTestClaim(id: string): ExtractedClaim {
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
      patient: 0.90,
      provider: 0.90,
      diagnoses: 0.90,
      serviceLines: 0.90,
      totals: 0.90,
      overall: 0.90,
    },
    provenance: {},
  };
}

async function testEvents() {
  console.log('📡 Event Monitoring Tests\n');

  const {
    getWorkflowOrchestrator,
    getStateManager,
    resetStateManager,
    resetWorkflowOrchestrator,
  } = await import('./src/orchestrator/index.js');

  resetStateManager();
  resetWorkflowOrchestrator();

  const stateManager = getStateManager();
  const orchestrator = getWorkflowOrchestrator({
    enableRAGIndexing: false,
    enableQualityAssessment: false,
  });

  // Track all events
  const eventLog: Array<{ time: number; type: string; data: unknown }> = [];
  const startTime = Date.now();

  // State Manager events
  stateManager.on('state:created', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'state:created', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] state:created - ${data.claimId}`);
  });

  stateManager.on('state:transition', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'state:transition', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] state:transition - ${data.fromStatus} -> ${data.toStatus}`);
  });

  stateManager.on('state:completed', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'state:completed', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] state:completed - ${data.claimId}`);
  });

  stateManager.on('state:updated', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'state:updated', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] state:updated - ${data.claimId}`);
  });

  // Workflow events
  orchestrator.on('workflow:started', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'workflow:started', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] workflow:started - ${data.claimId}`);
  });

  orchestrator.on('workflow:stage_started', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'workflow:stage_started', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] workflow:stage_started - ${data.stage}`);
  });

  orchestrator.on('workflow:stage_completed', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'workflow:stage_completed', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] workflow:stage_completed - ${data.stage}`);
  });

  orchestrator.on('workflow:completed', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'workflow:completed', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] workflow:completed - ${data.claimId}`);
  });

  orchestrator.on('workflow:failed', (data) => {
    eventLog.push({ time: Date.now() - startTime, type: 'workflow:failed', data });
    console.log(`  [${(Date.now() - startTime).toString().padStart(4)}ms] workflow:failed - ${data.claimId}`);
  });

  // Process a claim
  console.log('[Test] Processing claim with event monitoring...\n');
  const claim = createTestClaim('CLM-EVENTS-001');
  await orchestrator.processExtractedClaim(claim, 'normal');

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('Event Summary:');
  console.log('─'.repeat(50));

  const eventCounts: Record<string, number> = {};
  for (const event of eventLog) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }

  for (const [type, count] of Object.entries(eventCounts).sort()) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\nTotal events: ${eventLog.length}`);
  console.log(`Total time: ${Date.now() - startTime}ms`);

  // Timeline visualization
  console.log('\n' + '─'.repeat(50));
  console.log('Event Timeline:');
  console.log('─'.repeat(50));

  const maxTime = Math.max(...eventLog.map(e => e.time));
  const barWidth = 40;

  for (const event of eventLog) {
    const progress = maxTime > 0 ? Math.round((event.time / maxTime) * barWidth) : 0;
    const bar = '█'.repeat(progress) + '░'.repeat(barWidth - progress);
    const shortType = event.type.replace('workflow:', 'wf:').replace('state:', 'st:');
    console.log(`  ${event.time.toString().padStart(4)}ms [${bar}] ${shortType}`);
  }

  console.log('\n✓ Event Monitoring tests completed');
}

testEvents().catch(console.error);
