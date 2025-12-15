// test-rag.ts
import { config } from 'dotenv';
config();

async function testRAG() {
  console.log('🔍 Testing RAG Service\n');

  // Check for OAuth token
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!oauthToken || oauthToken === 'your-oauth-token-here') {
    console.log('⚠️  CLAUDE_CODE_OAUTH_TOKEN not set - skipping LLM-dependent tests\n');
    return;
  }

  const { getRAGService } = await import('./src/services/rag.js');
  const ragService = getRAGService();

  // Create test claims
  const testClaims = [
    {
      id: 'RAG-TEST-001',
      documentType: 'cms_1500' as const,
      patient: { memberId: 'MEM001', firstName: 'Alice', lastName: 'Johnson', dateOfBirth: '1985-03-20' },
      provider: { npi: '1234567893', name: 'Dr. Smith', specialty: 'Cardiology' },
      diagnoses: [{ code: 'I10', description: 'Essential Hypertension', isPrimary: true }],
      serviceLines: [{ lineNumber: 1, dateOfService: '2024-01-10', procedureCode: '99214', modifiers: [], diagnosisPointers: ['A'], units: 1, chargeAmount: 175.00 }],
      totals: { totalCharges: 175.00 },
      confidenceScores: {},
      provenance: {},
    },
    {
      id: 'RAG-TEST-002',
      documentType: 'cms_1500' as const,
      patient: { memberId: 'MEM002', firstName: 'Bob', lastName: 'Williams', dateOfBirth: '1970-08-15' },
      provider: { npi: '1234567893', name: 'Dr. Smith', specialty: 'Cardiology' },
      diagnoses: [{ code: 'E11.9', description: 'Type 2 Diabetes', isPrimary: true }],
      serviceLines: [{ lineNumber: 1, dateOfService: '2024-01-12', procedureCode: '99213', modifiers: [], diagnosisPointers: ['A'], units: 1, chargeAmount: 125.00 }],
      totals: { totalCharges: 125.00 },
      confidenceScores: {},
      provenance: {},
    },
  ];

  // Index claims
  console.log('📚 Indexing test claims...');
  for (const claim of testClaims) {
    try {
      await ragService.indexClaim(claim);
      console.log(`  ✅ Indexed ${claim.id}`);
    } catch (error) {
      console.log(`  ❌ Failed to index ${claim.id}: ${error}`);
    }
  }
  console.log('');

  // Test queries
  console.log('❓ Testing Q&A...');
  const queries = [
    'Which patients have diabetes?',
    'What procedures were performed by Dr. Smith?',
    'What is the total charges for hypertension patients?',
  ];

  for (const query of queries) {
    console.log(`\n  Query: "${query}"`);
    try {
      const response = await ragService.query({ question: query, maxChunks: 3 });
      console.log(`  Answer: ${response.answer}`);
      console.log(`  Confidence: ${(response.confidence * 100).toFixed(0)}%`);
      console.log(`  Sources: ${response.sources.length}`);
    } catch (error) {
      console.log(`  ❌ Query failed: ${error}`);
    }
  }
  console.log('');

  // Test similar claims
  console.log('🔗 Finding similar claims to RAG-TEST-001...');
  try {
    const similar = await ragService.findSimilarClaims('RAG-TEST-001', 3);
    for (const s of similar) {
      console.log(`  - ${s.claimId}: ${(s.similarity * 100).toFixed(0)}% similar`);
    }
  } catch (error) {
    console.log(`  ❌ Similar claims search failed: ${error}`);
  }
  console.log('');
}

testRAG().catch(console.error);
