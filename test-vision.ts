// test-vision.ts
import { config } from 'dotenv';
config();

import fs from 'fs/promises';

async function testVision() {
  console.log('👁️ Testing Vision Service\n');

  // Check for API key (Vision API requires direct Anthropic SDK, not OAuth)
  // The Claude Agent SDK's query() function doesn't support image inputs
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('⚠️  ANTHROPIC_API_KEY not set - skipping vision tests');
    console.log('   (Vision API requires direct Anthropic SDK access, OAuth not supported for multimodal)\n');
    return;
  }

  const { getVisionService } = await import('./src/services/vision.js');
  const visionService = getVisionService();

  // Check if we have a test image
  const testImagePath = 'test-claim.png'; // Put a test image here
  let testImage: Buffer;

  try {
    testImage = await fs.readFile(testImagePath);
    console.log(`✅ Loaded test image: ${testImagePath}\n`);
  } catch {
    console.log('⚠️  No test image found. Creating a simple test...\n');

    // Create a simple test with a placeholder
    // In real testing, use an actual healthcare form image
    const sharp = (await import('sharp')).default;

    // Create a simple white image with text
    testImage = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    }).png().toBuffer();

    console.log('  Created placeholder image (800x600 white)\n');
  }

  // Test layout analysis
  console.log('📐 Analyzing layout...');
  try {
    const layout = await visionService.analyzeLayout(testImage);
    console.log(`  Document Type: ${layout.documentType}`);
    console.log(`  Has Tables: ${layout.hasTables}`);
    console.log(`  Has Charts: ${layout.hasCharts}`);
    console.log(`  Has Handwriting: ${layout.hasHandwriting}`);
    console.log(`  Quality: ${layout.quality}`);
    console.log(`  Orientation: ${layout.orientation}`);
    console.log(`  Regions detected: ${layout.regions.length}`);
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
  }
  console.log('');

  // Test form field extraction
  console.log('📝 Extracting form fields...');
  try {
    const fields = await visionService.extractFormFields(testImage);
    console.log(`  Fields found: ${fields.fields.length}`);
    for (const field of fields.fields.slice(0, 5)) {
      console.log(`    - ${field.label}: "${field.value}" (${field.type}, ${(field.confidence * 100).toFixed(0)}%)`);
    }
    if (fields.fields.length > 5) {
      console.log(`    ... and ${fields.fields.length - 5} more`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error}`);
  }
  console.log('');
}

testVision().catch(console.error);
