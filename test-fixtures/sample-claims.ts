// test-fixtures/sample-claims.ts
// Sample healthcare claims data for testing

import { ExtractedClaim, DocumentType } from '../src/models/index.js';

/**
 * Sample CMS-1500 Claims (Professional/Physician claims)
 */
export const sampleCMS1500Claims: ExtractedClaim[] = [
  {
    id: 'CMS1500-DIABETES-001',
    documentType: 'cms_1500',
    patient: {
      memberId: 'MEM-DM-78901',
      firstName: 'Maria',
      lastName: 'Garcia',
      dateOfBirth: '1968-09-14',
      gender: 'F',
      address: {
        street1: '2847 Maple Drive',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893',
      name: 'Houston Endocrinology Associates',
      taxId: '74-1234567',
      specialty: 'Endocrinology',
      address: {
        street1: '5000 Medical Center Blvd',
        city: 'Houston',
        state: 'TX',
        zipCode: '77030',
        country: 'US',
      },
    },
    diagnoses: [
      { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', isPrimary: true },
      { code: 'E11.42', description: 'Type 2 diabetes mellitus with diabetic polyneuropathy', isPrimary: false },
      { code: 'E78.5', description: 'Hyperlipidemia, unspecified', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-20',
        procedureCode: '99214',
        modifiers: ['25'],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 195.00,
        placeOfService: '11',
      },
      {
        lineNumber: 2,
        dateOfService: '2024-02-20',
        procedureCode: '83036', // HbA1c
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 55.00,
        placeOfService: '11',
      },
      {
        lineNumber: 3,
        dateOfService: '2024-02-20',
        procedureCode: '80061', // Lipid panel
        modifiers: [],
        diagnosisPointers: ['C'],
        units: 1,
        chargeAmount: 75.00,
        placeOfService: '11',
      },
    ],
    totals: {
      totalCharges: 325.00,
    },
    confidenceScores: {
      'patient.memberId': 0.97,
      'patient.firstName': 0.99,
      'patient.lastName': 0.99,
      'provider.npi': 0.98,
      'diagnoses.0.code': 0.96,
    },
    provenance: {
      source: 'test_fixture',
      extractedAt: new Date().toISOString(),
    },
  },
  {
    id: 'CMS1500-CARDIO-002',
    documentType: 'cms_1500',
    patient: {
      memberId: 'MEM-CD-45678',
      firstName: 'Robert',
      lastName: 'Thompson',
      dateOfBirth: '1955-03-28',
      gender: 'M',
      address: {
        street1: '1234 Oak Street',
        city: 'Boston',
        state: 'MA',
        zipCode: '02115',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893',
      name: 'Boston Heart Center',
      taxId: '04-9876543',
      specialty: 'Cardiology',
      address: {
        street1: '100 Longwood Avenue',
        city: 'Boston',
        state: 'MA',
        zipCode: '02115',
        country: 'US',
      },
    },
    diagnoses: [
      { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', isPrimary: true },
      { code: 'I10', description: 'Essential (primary) hypertension', isPrimary: false },
      { code: 'I48.91', description: 'Unspecified atrial fibrillation', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-15',
        procedureCode: '99215',
        modifiers: ['25'],
        diagnosisPointers: ['A', 'B', 'C'],
        units: 1,
        chargeAmount: 275.00,
        placeOfService: '11',
      },
      {
        lineNumber: 2,
        dateOfService: '2024-02-15',
        procedureCode: '93000', // EKG
        modifiers: [],
        diagnosisPointers: ['A', 'C'],
        units: 1,
        chargeAmount: 95.00,
        placeOfService: '11',
      },
      {
        lineNumber: 3,
        dateOfService: '2024-02-15',
        procedureCode: '93306', // Echo
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 450.00,
        placeOfService: '11',
      },
    ],
    totals: {
      totalCharges: 820.00,
    },
    confidenceScores: {
      'patient.memberId': 0.95,
      'patient.firstName': 0.98,
      'provider.npi': 0.99,
    },
    provenance: {
      source: 'test_fixture',
      extractedAt: new Date().toISOString(),
    },
  },
  {
    id: 'CMS1500-ORTHO-003',
    documentType: 'cms_1500',
    patient: {
      memberId: 'MEM-OR-33221',
      firstName: 'Jennifer',
      lastName: 'Williams',
      dateOfBirth: '1982-07-19',
      gender: 'F',
      address: {
        street1: '567 Pine Avenue',
        city: 'Denver',
        state: 'CO',
        zipCode: '80202',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893',
      name: 'Rocky Mountain Orthopedics',
      taxId: '84-5678901',
      specialty: 'Orthopedic Surgery',
      address: {
        street1: '8200 E Belleview Ave',
        city: 'Denver',
        state: 'CO',
        zipCode: '80237',
        country: 'US',
      },
    },
    diagnoses: [
      { code: 'M17.11', description: 'Primary osteoarthritis, right knee', isPrimary: true },
      { code: 'M25.561', description: 'Pain in right knee', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-22',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 145.00,
        placeOfService: '11',
      },
      {
        lineNumber: 2,
        dateOfService: '2024-02-22',
        procedureCode: '20610', // Joint injection
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 185.00,
        placeOfService: '11',
      },
      {
        lineNumber: 3,
        dateOfService: '2024-02-22',
        procedureCode: 'J3301', // Kenalog injection
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 40, // 40mg
        chargeAmount: 35.00,
        placeOfService: '11',
      },
    ],
    totals: {
      totalCharges: 365.00,
    },
    confidenceScores: {},
    provenance: {
      source: 'test_fixture',
      extractedAt: new Date().toISOString(),
    },
  },
];

/**
 * Sample UB-04 Claims (Institutional/Hospital claims)
 */
export const sampleUB04Claims: ExtractedClaim[] = [
  {
    id: 'UB04-ER-001',
    documentType: 'ub_04',
    patient: {
      memberId: 'MEM-ER-99887',
      firstName: 'David',
      lastName: 'Anderson',
      dateOfBirth: '1990-12-05',
      gender: 'M',
      address: {
        street1: '789 Emergency Lane',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893',
      name: 'Chicago General Hospital',
      taxId: '36-7654321',
      specialty: 'General Acute Care Hospital',
      address: {
        street1: '1900 W Polk Street',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60612',
        country: 'US',
      },
    },
    diagnoses: [
      { code: 'K35.80', description: 'Unspecified acute appendicitis', isPrimary: true },
      { code: 'R10.9', description: 'Unspecified abdominal pain', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-10',
        procedureCode: '0450', // Emergency room - general
        modifiers: [],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 1250.00,
        revenueCode: '0450',
      },
      {
        lineNumber: 2,
        dateOfService: '2024-02-10',
        procedureCode: '74177', // CT abdomen with contrast
        modifiers: [],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 2800.00,
        revenueCode: '0350',
      },
      {
        lineNumber: 3,
        dateOfService: '2024-02-10',
        procedureCode: '44950', // Appendectomy
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 15000.00,
        revenueCode: '0360',
      },
      {
        lineNumber: 4,
        dateOfService: '2024-02-10',
        dateOfServiceEnd: '2024-02-12',
        procedureCode: '0120', // Room and board - semi-private
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 2,
        chargeAmount: 3600.00,
        revenueCode: '0120',
      },
    ],
    totals: {
      totalCharges: 22650.00,
    },
    confidenceScores: {
      'patient.memberId': 0.94,
      'diagnoses.0.code': 0.97,
    },
    provenance: {
      source: 'test_fixture',
      extractedAt: new Date().toISOString(),
    },
  },
  {
    id: 'UB04-SURGERY-002',
    documentType: 'ub_04',
    patient: {
      memberId: 'MEM-SG-55443',
      firstName: 'Patricia',
      lastName: 'Martinez',
      dateOfBirth: '1965-04-30',
      gender: 'F',
      address: {
        street1: '456 Surgery Drive',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'US',
      },
    },
    provider: {
      npi: '1234567893',
      name: 'UCLA Medical Center',
      taxId: '95-1234567',
      specialty: 'General Acute Care Hospital',
      address: {
        street1: '757 Westwood Plaza',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90095',
        country: 'US',
      },
    },
    diagnoses: [
      { code: 'K80.20', description: 'Calculus of gallbladder without cholecystitis without obstruction', isPrimary: true },
      { code: 'K82.8', description: 'Other specified diseases of gallbladder', isPrimary: false },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-18',
        procedureCode: '47562', // Laparoscopic cholecystectomy
        modifiers: [],
        diagnosisPointers: ['A', 'B'],
        units: 1,
        chargeAmount: 12500.00,
        revenueCode: '0360',
      },
      {
        lineNumber: 2,
        dateOfService: '2024-02-18',
        procedureCode: '0710', // Recovery room
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 2,
        chargeAmount: 1800.00,
        revenueCode: '0710',
      },
      {
        lineNumber: 3,
        dateOfService: '2024-02-18',
        procedureCode: '0250', // Pharmacy
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 850.00,
        revenueCode: '0250',
      },
    ],
    totals: {
      totalCharges: 15150.00,
    },
    confidenceScores: {},
    provenance: {
      source: 'test_fixture',
      extractedAt: new Date().toISOString(),
    },
  },
];

/**
 * Sample EOB (Explanation of Benefits) claims
 */
export const sampleEOBClaims: ExtractedClaim[] = [
  {
    id: 'EOB-PROCESSED-001',
    documentType: 'eob',
    patient: {
      memberId: 'MEM-EOB-11223',
      firstName: 'Susan',
      lastName: 'Lee',
      dateOfBirth: '1975-11-22',
      gender: 'F',
    },
    provider: {
      npi: '1234567893',
      name: 'Primary Care Associates',
      specialty: 'Family Medicine',
    },
    diagnoses: [
      { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-01-25',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 150.00,
        allowedAmount: 125.00,
        paidAmount: 100.00,
        patientResponsibility: 25.00,
      },
    ],
    totals: {
      totalCharges: 150.00,
      amountPaid: 100.00,
      patientResponsibility: 25.00,
    },
    confidenceScores: {},
    provenance: {
      source: 'test_fixture',
      extractedAt: new Date().toISOString(),
    },
  },
];

/**
 * Sample OCR text for testing extraction
 */
export const sampleOCRTexts = {
  cms1500: `HEALTH INSURANCE CLAIM FORM
APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12

1. MEDICARE   MEDICAID   TRICARE   CHAMPVA   GROUP HEALTH PLAN   FECA BLK LUNG   OTHER
   [X]                                        [ ]

1a. INSURED'S I.D. NUMBER: MEM-DM-78901

2. PATIENT'S NAME (Last Name, First Name, Middle Initial)
   GARCIA, MARIA

3. PATIENT'S BIRTH DATE    SEX
   09 14 1968              F [X]  M [ ]

4. INSURED'S NAME: SAME

5. PATIENT'S ADDRESS (No., Street)
   2847 MAPLE DRIVE

CITY: HOUSTON              STATE: TX

ZIP CODE: 77001            TELEPHONE: (713) 555-1234

21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY
    A. E11.65
    B. E11.42
    C. E78.5

24. A  DATE(S) OF SERVICE   B  PLACE  C  EMG  D  PROCEDURES, SERVICES   E  DIAGNOSIS  F  CHARGES
    FROM     TO              OF SVC          OR SUPPLIES                  POINTER
1.  02/20/24  02/20/24      11              99214 25                      A B          195.00
2.  02/20/24  02/20/24      11              83036                         A            55.00
3.  02/20/24  02/20/24      11              80061                         C            75.00

28. TOTAL CHARGE: $325.00

31. SIGNATURE OF PHYSICIAN
    HOUSTON ENDOCRINOLOGY ASSOCIATES

32. SERVICE FACILITY LOCATION
    5000 MEDICAL CENTER BLVD
    HOUSTON, TX 77030

33. BILLING PROVIDER INFO & PH #
    NPI: 1234567893
`,

  ub04: `UB-04 CLAIM FORM

1. BILLING PROVIDER NAME AND ADDRESS
   CHICAGO GENERAL HOSPITAL
   1900 W POLK STREET
   CHICAGO, IL 60612

8. PATIENT NAME: ANDERSON, DAVID
9. PATIENT ADDRESS: 789 EMERGENCY LANE, CHICAGO, IL 60601
10. BIRTHDATE: 12/05/1990    11. SEX: M
12. ADMISSION DATE: 02/10/2024    13. DISCHARGE DATE: 02/12/2024

18-28. CONDITION CODES

39-41. VALUE CODES

42. REV CD   43. DESCRIPTION           44. HCPCS   45. SERV DATE   46. UNITS   47. TOTAL CHARGES
0450         EMERGENCY ROOM                       02/10/24        1           1,250.00
0350         CT SCAN                   74177      02/10/24        1           2,800.00
0360         OPERATING ROOM            44950      02/10/24        1           15,000.00
0120         ROOM-SEMI                            02/10-02/12     2           3,600.00

47. TOTAL CHARGES: $22,650.00

67. PRINCIPAL DIAGNOSIS CODE: K35.80
67A-Q. OTHER DIAGNOSIS CODES: R10.9

76. ATTENDING PROVIDER NPI: 1234567893
`,

  eob: `EXPLANATION OF BENEFITS

Member: Susan Lee
Member ID: MEM-EOB-11223
Date of Birth: 11/22/1975

Claim Number: CLM-EOB-001
Date Processed: 02/01/2024

Provider: Primary Care Associates
NPI: 1234567893

Service Date: 01/25/2024
Diagnosis: J06.9 - Acute upper respiratory infection

SERVICES:
CPT Code    Description              Billed    Allowed    Plan Paid   You Owe
99213       Office Visit             $150.00   $125.00    $100.00     $25.00

TOTALS:
Total Billed:                $150.00
Total Allowed:               $125.00
Plan Paid:                   $100.00
Your Responsibility:         $25.00
  - Copay:                   $25.00
  - Deductible:              $0.00
  - Coinsurance:             $0.00

This is not a bill. Your provider may bill you for the amount shown as "You Owe".
`,
};

/**
 * Get all sample claims
 */
export function getAllSampleClaims(): ExtractedClaim[] {
  return [
    ...sampleCMS1500Claims,
    ...sampleUB04Claims,
    ...sampleEOBClaims,
  ];
}

/**
 * Get sample claims by document type
 */
export function getSampleClaimsByType(documentType: DocumentType): ExtractedClaim[] {
  switch (documentType) {
    case 'cms_1500':
      return sampleCMS1500Claims;
    case 'ub_04':
      return sampleUB04Claims;
    case 'eob':
      return sampleEOBClaims;
    default:
      return [];
  }
}

/**
 * Get a random sample claim
 */
export function getRandomSampleClaim(): ExtractedClaim {
  const allClaims = getAllSampleClaims();
  return allClaims[Math.floor(Math.random() * allClaims.length)];
}

/**
 * Sample claim scenarios for specific test cases
 */
export const testScenarios = {
  // Claim with missing required fields (should fail validation)
  invalidMissingFields: {
    id: 'INVALID-MISSING-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: '',  // Missing
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '1990-01-01',
    },
    provider: {
      npi: '',  // Missing
      name: 'Test Provider',
    },
    diagnoses: [],  // Missing
    serviceLines: [],  // Missing
    totals: { totalCharges: 0 },
    confidenceScores: {},
    provenance: {},
  },

  // Claim with invalid codes
  invalidCodes: {
    id: 'INVALID-CODES-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM-INV-001',
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '1990-01-01',
    },
    provider: {
      npi: '1234567890',  // Invalid checksum
      name: 'Test Provider',
    },
    diagnoses: [
      { code: 'INVALID', description: 'Bad ICD-10', isPrimary: true },  // Invalid ICD-10
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2099-12-31',  // Future date
        procedureCode: '00000',  // Invalid CPT
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 100.00,
      },
    ],
    totals: { totalCharges: 100.00 },
    confidenceScores: {},
    provenance: {},
  },

  // Claim with low confidence scores
  lowConfidence: {
    id: 'LOW-CONF-001',
    documentType: 'cms_1500' as const,
    patient: {
      memberId: 'MEM-LC-001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1980-05-15',
    },
    provider: {
      npi: '1234567893',
      name: 'Test Provider',
    },
    diagnoses: [
      { code: 'E11.9', description: 'Type 2 diabetes', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-01',
        procedureCode: '99213',
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 125.00,
      },
    ],
    totals: { totalCharges: 125.00 },
    confidenceScores: {
      'patient.memberId': 0.45,  // Low confidence
      'patient.firstName': 0.52,  // Low confidence
      'diagnoses.0.code': 0.38,  // Very low confidence
    },
    provenance: {},
  },

  // High-value claim (should trigger review)
  highValue: {
    id: 'HIGH-VALUE-001',
    documentType: 'ub_04' as const,
    patient: {
      memberId: 'MEM-HV-001',
      firstName: 'Premium',
      lastName: 'Patient',
      dateOfBirth: '1970-01-01',
    },
    provider: {
      npi: '1234567893',
      name: 'Major Medical Center',
    },
    diagnoses: [
      { code: 'C34.90', description: 'Malignant neoplasm of unspecified part of bronchus or lung', isPrimary: true },
    ],
    serviceLines: [
      {
        lineNumber: 1,
        dateOfService: '2024-02-01',
        procedureCode: '32480',  // Lung surgery
        modifiers: [],
        diagnosisPointers: ['A'],
        units: 1,
        chargeAmount: 85000.00,
      },
    ],
    totals: { totalCharges: 85000.00 },
    confidenceScores: {},
    provenance: {},
  },
};
