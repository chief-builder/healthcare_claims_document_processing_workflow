// test-agents.ts
import { config } from 'dotenv';
config();

async function testAgents() {
  console.log('🤖 ClaimsAgent Agent Tests\n');

  const testName = process.argv[2];

  switch (testName) {
    case 'intake':
      await testIntakeAgent();
      break;
    case 'validation':
      await testValidationAgent();
      break;
    case 'adjudication':
      await testAdjudicationAgent();
      break;
    case 'all':
      await testIntakeAgent();
      await testValidationAgent();
      await testAdjudicationAgent();
      break;
    default:
      console.log('Usage: npx tsx test-agents.ts <test-name>');
      console.log('Available tests: intake, validation, adjudication, all');
  }
}

async function testIntakeAgent() {
  console.log('📥 Testing Intake Agent...');

  const { IntakeAgent } = await import('./src/agents/intake.js');

  // Create a simple test image (1x1 white PNG)
  const testBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Test valid image upload
  console.log('  Testing valid image upload...');
  try {
    const result = await IntakeAgent.intake({
      buffer: testBuffer,
      filename: 'test-claim.png',
      mimeType: 'image/png',
      priority: 'normal',
    });

    if (result.success) {
      console.log(`    ✅ Success: Claim ID = ${result.data?.claimId}`);
      console.log(`       Document ID: ${result.data?.documentId}`);
      console.log(`       Document Type: ${result.data?.documentType}`);
    } else {
      console.log(`    ❌ Failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`    ❌ Error: ${error}`);
  }

  // Test unsupported format
  console.log('  Testing unsupported format...');
  const result2 = await IntakeAgent.intake({
    buffer: Buffer.from('test'),
    filename: 'test.doc',
    mimeType: 'application/msword',
    priority: 'normal',
  });
  console.log(`    ${result2.success ? '❌ Should have failed' : '✅ Correctly rejected'}: ${result2.error}`);

  console.log('');
}

async function testValidationAgent() {
  console.log('✅ Testing Validation Agent...');

  const { ValidationAgent } = await import('./src/agents/validation.js');
  const agent = new ValidationAgent();

  // Create mock claim record
  const mockClaimRecord = {
    id: 'TEST-CLM-001',
    status: 'validating' as const,
    priority: 'normal' as const,
    documentId: 'doc-001',
    documentHash: 'abc123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingHistory: [],
  };

  // Test with valid claim
  console.log('  Testing valid claim...');
  const validClaim = {
    id: 'TEST-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM123456789',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1990-05-15',
      gender: 'M' as const,
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
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 125.00,
      },
    ],
    totals: {
      totalCharges: 125.00,
    },
    confidenceScores: {},
    provenance: {},
  };

  const validResult = await agent.execute({ extractedClaim: validClaim }, mockClaimRecord);
  console.log(`    Valid: ${validResult.data?.validationResult.isValid}`);
  console.log(`    Errors: ${validResult.data?.validationResult.errors.length}`);
  console.log(`    Warnings: ${validResult.data?.validationResult.warnings.length}`);
  console.log('');

  // Test with invalid claim
  console.log('  Testing invalid claim (bad NPI, invalid code)...');
  const invalidClaim = {
    ...validClaim,
    id: 'TEST-002',
    provider: {
      npi: '1234567890', // Invalid checksum
      name: 'Dr. Bad Data',
    },
    diagnoses: [
      { code: 'INVALID', description: 'Bad code', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2099-01-15', // Future date
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 125.00,
      },
    ],
  };

  const invalidResult = await agent.execute({ extractedClaim: invalidClaim }, mockClaimRecord);
  console.log(`    Valid: ${invalidResult.data?.validationResult.isValid}`);
  console.log(`    Errors: ${invalidResult.data?.validationResult.errors.length}`);
  for (const error of invalidResult.data?.validationResult.errors ?? []) {
    console.log(`      - ${error.field}: ${error.message}`);
  }
  console.log('');
}

async function testAdjudicationAgent() {
  console.log('⚖️ Testing Adjudication Agent...');

  const { AdjudicationAgent } = await import('./src/agents/adjudication.js');
  const agent = new AdjudicationAgent();

  const mockClaimRecord = {
    id: 'TEST-CLM-001',
    status: 'adjudicating' as const,
    priority: 'normal' as const,
    documentId: 'doc-001',
    documentHash: 'abc123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    processingHistory: [],
  };

  // Test with covered services
  console.log('  Testing covered services...');
  const coveredClaim = {
    id: 'TEST-ADJ-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM123456789',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1990-05-15',
    },
    provider: {
      npi: '1234567893',
      name: 'Dr. Jane Doe',
    },
    diagnoses: [
      { code: 'E11.9', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99213', // Covered
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 150.00,
      },
      {
        lineNumber: 2,
        dateOfService: '2024-01-15',
        procedureCode: '85025', // Covered - CBC
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 25.00,
      },
    ],
    totals: {
      totalCharges: 175.00,
    },
    confidenceScores: {},
    provenance: {},
  };

  const coveredResult = await agent.execute({ extractedClaim: coveredClaim }, mockClaimRecord);
  const decision = coveredResult.data?.decision;

  console.log(`    Status: ${decision?.status}`);
  console.log(`    Total Billed: $${decision?.totals.totalBilled}`);
  console.log(`    Total Allowed: $${decision?.totals.totalAllowed}`);
  console.log(`    Total Paid: $${decision?.totals.totalPaid}`);
  console.log(`    Patient Responsibility: $${decision?.totals.totalPatientResponsibility}`);
  console.log('    Line Decisions:');
  for (const line of decision?.lineDecisions ?? []) {
    console.log(`      Line ${line.lineNumber}: ${line.status} - Paid $${line.paidAmount}`);
  }
  console.log('');

  // Test with non-covered service
  console.log('  Testing non-covered service...');
  const nonCoveredClaim = {
    ...coveredClaim,
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-15',
        procedureCode: '99999', // Not covered
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 500.00,
      },
    ],
    totals: { totalCharges: 500.00 },
  };

  const nonCoveredResult = await agent.execute({ extractedClaim: nonCoveredClaim }, mockClaimRecord);
  const ncDecision = nonCoveredResult.data?.decision;

  console.log(`    Status: ${ncDecision?.status}`);
  console.log(`    Total Paid: $${ncDecision?.totals.totalPaid}`);
  if (ncDecision?.lineDecisions[0]?.denialReasons) {
    console.log(`    Denial Reason: ${ncDecision.lineDecisions[0].denialReasons[0]?.description}`);
  }
  console.log('');
}

testAgents().catch(console.error);
