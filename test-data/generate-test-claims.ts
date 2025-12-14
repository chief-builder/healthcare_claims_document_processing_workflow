/**
 * Generate sample healthcare claim images for testing
 *
 * Usage: npx tsx test-data/generate-test-claims.ts
 *
 * This creates PNG images that simulate CMS-1500 claim forms
 * for testing the document upload and processing pipeline.
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface ClaimData {
  filename: string;
  patient: {
    name: string;
    dob: string;
    memberId: string;
    address: string;
  };
  provider: {
    name: string;
    npi: string;
    address: string;
  };
  diagnosis: {
    code: string;
    description: string;
  };
  service: {
    date: string;
    cpt: string;
    description: string;
    charge: string;
  };
  totalCharge: string;
}

const sampleClaims: ClaimData[] = [
  {
    filename: 'claim-diabetes-routine.png',
    patient: {
      name: 'John Smith',
      dob: '03/15/1975',
      memberId: 'MEM-TEST-001',
      address: '123 Oak Street, Chicago, IL 60601'
    },
    provider: {
      name: 'Dr. Sarah Johnson',
      npi: '1234567890',
      address: 'Chicago Medical Center, 456 Health Ave'
    },
    diagnosis: {
      code: 'E11.9',
      description: 'Type 2 Diabetes Mellitus'
    },
    service: {
      date: '12/01/2024',
      cpt: '99213',
      description: 'Office Visit - Established Patient',
      charge: '$150.00'
    },
    totalCharge: '$150.00'
  },
  {
    filename: 'claim-hypertension.png',
    patient: {
      name: 'Maria Garcia',
      dob: '07/22/1968',
      memberId: 'MEM-TEST-002',
      address: '789 Elm Road, Boston, MA 02115'
    },
    provider: {
      name: 'Dr. Michael Chen',
      npi: '9876543210',
      address: 'Boston Healthcare, 321 Medical Blvd'
    },
    diagnosis: {
      code: 'I10',
      description: 'Essential Hypertension'
    },
    service: {
      date: '12/05/2024',
      cpt: '99214',
      description: 'Office Visit - Moderate Complexity',
      charge: '$200.00'
    },
    totalCharge: '$200.00'
  },
  {
    filename: 'claim-respiratory.png',
    patient: {
      name: 'Robert Wilson',
      dob: '11/30/1982',
      memberId: 'MEM-TEST-003',
      address: '456 Pine Lane, Seattle, WA 98101'
    },
    provider: {
      name: 'Dr. Emily Brown',
      npi: '5555555555',
      address: 'Seattle Pulmonary Clinic, 789 Lung St'
    },
    diagnosis: {
      code: 'J06.9',
      description: 'Acute Upper Respiratory Infection'
    },
    service: {
      date: '12/10/2024',
      cpt: '99212',
      description: 'Office Visit - Straightforward',
      charge: '$100.00'
    },
    totalCharge: '$100.00'
  },
  {
    filename: 'claim-high-value.png',
    patient: {
      name: 'Jennifer Adams',
      dob: '05/18/1990',
      memberId: 'MEM-TEST-004',
      address: '321 Maple Drive, New York, NY 10001'
    },
    provider: {
      name: 'Dr. David Lee',
      npi: '1111111111',
      address: 'NYC Orthopedic Center, 555 Bone Ave'
    },
    diagnosis: {
      code: 'M54.5',
      description: 'Low Back Pain'
    },
    service: {
      date: '12/12/2024',
      cpt: '27447',
      description: 'Total Knee Arthroplasty',
      charge: '$45,000.00'
    },
    totalCharge: '$45,000.00'
  },
  {
    filename: 'claim-urgent-cardiac.png',
    patient: {
      name: 'Thomas Brown',
      dob: '02/28/1955',
      memberId: 'MEM-TEST-005',
      address: '999 Heart Street, Miami, FL 33101'
    },
    provider: {
      name: 'Dr. Lisa Martinez',
      npi: '2222222222',
      address: 'Miami Cardiac Institute, 111 Heart Blvd'
    },
    diagnosis: {
      code: 'I21.0',
      description: 'ST Elevation MI - Anterior Wall'
    },
    service: {
      date: '12/14/2024',
      cpt: '92928',
      description: 'Percutaneous Coronary Intervention',
      charge: '$35,000.00'
    },
    totalCharge: '$35,000.00'
  }
];

async function generateClaimImage(claim: ClaimData): Promise<Buffer> {
  const width = 850;
  const height = 1100;

  // Create SVG content that looks like a CMS-1500 form
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font: bold 24px Arial; fill: #000; }
        .header { font: bold 16px Arial; fill: #333; }
        .label { font: bold 12px Arial; fill: #666; }
        .value { font: 14px Arial; fill: #000; }
        .box { fill: none; stroke: #333; stroke-width: 1; }
        .section { fill: #f5f5f5; stroke: #999; stroke-width: 1; }
      </style>

      <!-- Background -->
      <rect width="100%" height="100%" fill="white"/>

      <!-- Header -->
      <rect x="20" y="20" width="810" height="60" class="section"/>
      <text x="425" y="55" text-anchor="middle" class="title">HEALTH INSURANCE CLAIM FORM</text>
      <text x="425" y="75" text-anchor="middle" class="label">CMS-1500 (02/12)</text>

      <!-- Patient Information Section -->
      <rect x="20" y="100" width="400" height="200" class="section"/>
      <text x="30" y="120" class="header">PATIENT INFORMATION</text>

      <text x="30" y="150" class="label">1. Patient Name:</text>
      <text x="150" y="150" class="value">${claim.patient.name}</text>

      <text x="30" y="175" class="label">2. Date of Birth:</text>
      <text x="150" y="175" class="value">${claim.patient.dob}</text>

      <text x="30" y="200" class="label">3. Member ID:</text>
      <text x="150" y="200" class="value">${claim.patient.memberId}</text>

      <text x="30" y="225" class="label">4. Address:</text>
      <text x="30" y="245" class="value">${claim.patient.address}</text>

      <!-- Provider Information Section -->
      <rect x="430" y="100" width="400" height="200" class="section"/>
      <text x="440" y="120" class="header">PROVIDER INFORMATION</text>

      <text x="440" y="150" class="label">21. Provider Name:</text>
      <text x="560" y="150" class="value">${claim.provider.name}</text>

      <text x="440" y="175" class="label">24J. NPI:</text>
      <text x="560" y="175" class="value">${claim.provider.npi}</text>

      <text x="440" y="200" class="label">32. Service Facility:</text>
      <text x="440" y="220" class="value">${claim.provider.address}</text>

      <!-- Diagnosis Section -->
      <rect x="20" y="320" width="810" height="100" class="section"/>
      <text x="30" y="345" class="header">DIAGNOSIS CODES (ICD-10-CM)</text>

      <rect x="30" y="360" width="60" height="25" class="box"/>
      <text x="35" y="378" class="label">21A.</text>
      <text x="100" y="378" class="value">${claim.diagnosis.code}</text>

      <text x="200" y="378" class="value">${claim.diagnosis.description}</text>

      <!-- Service Lines Section -->
      <rect x="20" y="440" width="810" height="180" class="section"/>
      <text x="30" y="465" class="header">24. SERVICE LINES</text>

      <!-- Table Header -->
      <rect x="30" y="480" width="790" height="30" fill="#e0e0e0" stroke="#999"/>
      <text x="50" y="500" class="label">Date</text>
      <text x="150" y="500" class="label">CPT Code</text>
      <text x="250" y="500" class="label">Description</text>
      <text x="550" y="500" class="label">Diagnosis Ptr</text>
      <text x="650" y="500" class="label">Units</text>
      <text x="720" y="500" class="label">Charges</text>

      <!-- Service Line 1 -->
      <rect x="30" y="510" width="790" height="30" class="box"/>
      <text x="50" y="530" class="value">${claim.service.date}</text>
      <text x="150" y="530" class="value">${claim.service.cpt}</text>
      <text x="250" y="530" class="value">${claim.service.description}</text>
      <text x="570" y="530" class="value">A</text>
      <text x="660" y="530" class="value">1</text>
      <text x="720" y="530" class="value">${claim.service.charge}</text>

      <!-- Totals Section -->
      <rect x="20" y="640" width="810" height="80" class="section"/>
      <text x="30" y="665" class="header">28. TOTAL CHARGES</text>

      <rect x="650" y="670" width="170" height="35" class="box"/>
      <text x="660" y="695" class="label">$</text>
      <text x="700" y="695" class="value">${claim.totalCharge.replace('$', '')}</text>

      <!-- Signature Section -->
      <rect x="20" y="740" width="400" height="100" class="section"/>
      <text x="30" y="765" class="header">31. SIGNATURE OF PHYSICIAN</text>
      <text x="30" y="800" class="value" style="font-style: italic;">Electronically Signed</text>
      <text x="30" y="825" class="label">Date: ${claim.service.date}</text>

      <!-- Patient Signature -->
      <rect x="430" y="740" width="400" height="100" class="section"/>
      <text x="440" y="765" class="header">12. PATIENT SIGNATURE</text>
      <text x="440" y="800" class="value">SIGNATURE ON FILE</text>

      <!-- Footer -->
      <rect x="20" y="860" width="810" height="40" fill="#f0f0f0" stroke="#999"/>
      <text x="425" y="885" text-anchor="middle" class="label">
        This is a sample claim form for testing purposes only
      </text>

      <!-- Form ID -->
      <text x="750" y="920" class="label">Form ID: TEST-${Date.now()}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function main() {
  console.log('Generating sample healthcare claim images...\n');

  const outputDir = join(process.cwd(), 'test-data');

  for (const claim of sampleClaims) {
    try {
      const imageBuffer = await generateClaimImage(claim);
      const outputPath = join(outputDir, claim.filename);
      writeFileSync(outputPath, imageBuffer);
      console.log(`✓ Created: ${claim.filename}`);
      console.log(`  Patient: ${claim.patient.name}`);
      console.log(`  Diagnosis: ${claim.diagnosis.code} - ${claim.diagnosis.description}`);
      console.log(`  Charge: ${claim.totalCharge}\n`);
    } catch (error) {
      console.error(`✗ Failed to create ${claim.filename}:`, error);
    }
  }

  // Create a simple README
  const readme = `# Test Data

This directory contains sample healthcare claim images for API testing.

## Generated Claims

| Filename | Patient | Diagnosis | Charge |
|----------|---------|-----------|--------|
${sampleClaims.map(c => `| ${c.filename} | ${c.patient.name} | ${c.diagnosis.code} | ${c.totalCharge} |`).join('\n')}

## Usage

Upload these images via the API:

\`\`\`bash
curl -X POST http://localhost:3000/api/claims \\
  -H "Authorization: Bearer dev-api-key" \\
  -F "document=@test-data/claim-diabetes-routine.png" \\
  -F "priority=normal"
\`\`\`

## Regenerate

To regenerate the test images:

\`\`\`bash
npx tsx test-data/generate-test-claims.ts
\`\`\`
`;

  writeFileSync(join(outputDir, 'README.md'), readme);
  console.log('✓ Created: README.md\n');

  console.log('Done! Test images are ready in the test-data/ directory.');
}

main().catch(console.error);
