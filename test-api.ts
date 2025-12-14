// test-api.ts
import { config } from 'dotenv';
config();

async function testAPI() {
  console.log('🌐 API Server Tests\n');

  const { startServer, stopServer } = await import('./src/api/index.js');
  const { getStateManager, resetStateManager } = await import('./src/orchestrator/index.js');

  resetStateManager();

  // Start server
  console.log('[Setup] Starting server...');
  const { server } = await startServer(3001);
  console.log('  Server started on port 3001\n');

  const baseUrl = 'http://localhost:3001';
  const apiKey = 'dev-api-key';

  try {
    // Test 1: Health check
    console.log('[Test 1] Health check...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    console.log(`  Status: ${health.status}`);
    console.log(`  Uptime: ${health.uptime.toFixed(2)}s`);

    // Test 2: API info
    console.log('\n[Test 2] API info...');
    const infoRes = await fetch(`${baseUrl}/api`);
    const info = await infoRes.json();
    console.log(`  Name: ${info.name}`);
    console.log(`  Endpoints: ${Object.keys(info.endpoints).length}`);

    // Test 3: List claims (empty)
    console.log('\n[Test 3] List claims (empty)...');
    const listRes = await fetch(`${baseUrl}/api/claims`, {
      headers: { 'X-API-Key': apiKey },
    });
    const list = await listRes.json();
    console.log(`  Success: ${list.success}`);
    console.log(`  Total claims: ${list.pagination.total}`);

    // Test 4: Create a test claim state directly
    console.log('\n[Test 4] Create test claim...');
    const stateManager = getStateManager();
    await stateManager.createState('TEST-API-001', 'DOC-001', 'hash123', 'normal');
    console.log('  Created claim: TEST-API-001');

    // Test 5: Get claim details
    console.log('\n[Test 5] Get claim details...');
    const claimRes = await fetch(`${baseUrl}/api/claims/TEST-API-001`, {
      headers: { 'X-API-Key': apiKey },
    });
    const claim = await claimRes.json();
    console.log(`  Success: ${claim.success}`);
    console.log(`  Status: ${claim.data.status}`);
    console.log(`  Priority: ${claim.data.priority}`);

    // Test 6: Get claim not found
    console.log('\n[Test 6] Get non-existent claim (404 expected)...');
    const notFoundRes = await fetch(`${baseUrl}/api/claims/INVALID-ID`, {
      headers: { 'X-API-Key': apiKey },
    });
    console.log(`  Status code: ${notFoundRes.status}`);
    const notFound = await notFoundRes.json();
    console.log(`  Error code: ${notFound.error.code}`);

    // Test 7: Review queue (empty)
    console.log('\n[Test 7] Review queue...');
    const reviewRes = await fetch(`${baseUrl}/api/review-queue`, {
      headers: { 'X-API-Key': apiKey },
    });
    const review = await reviewRes.json();
    console.log(`  Success: ${review.success}`);
    console.log(`  Pending reviews: ${review.pagination.total}`);

    // Test 8: Detailed health check
    console.log('\n[Test 8] Detailed health check...');
    const detailedRes = await fetch(`${baseUrl}/api/health/detailed`);
    const detailed = await detailedRes.json();
    console.log(`  Memory used: ${detailed.memory.used}MB`);
    console.log(`  Total claims: ${detailed.components.stateManager.totalClaims}`);

    // Test 9: Unauthorized access
    console.log('\n[Test 9] Unauthorized access (401 expected)...');
    const unauthRes = await fetch(`${baseUrl}/api/claims`);
    console.log(`  Status code: ${unauthRes.status}`);
    const unauth = await unauthRes.json();
    console.log(`  Error: ${unauth.error.message}`);

    // Test 10: RAG query endpoint
    console.log('\n[Test 10] RAG query endpoint...');
    const queryRes = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        question: 'What claims are in the system?',
        maxChunks: 3,
      }),
    });
    const query = await queryRes.json();
    console.log(`  Success: ${query.success}`);
    console.log(`  Answer length: ${query.data?.answer?.length || 0} chars`);

    console.log('\n✓ All API tests completed');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
  } finally {
    // Stop server
    console.log('\n[Cleanup] Stopping server...');
    await stopServer();
    console.log('  Server stopped');
  }
}

testAPI().catch(console.error);
