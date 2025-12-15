# Test Data

This directory contains sample healthcare claim images for API testing.

## Generated Claims

| Filename | Patient | Diagnosis | Charge |
|----------|---------|-----------|--------|
| claim-diabetes-routine.png | John Smith | E11.9 | $150.00 |
| claim-hypertension.png | Maria Garcia | I10 | $200.00 |
| claim-respiratory.png | Robert Wilson | J06.9 | $100.00 |
| claim-high-value.png | Jennifer Adams | M54.5 | $45,000.00 |
| claim-urgent-cardiac.png | Thomas Brown | I21.0 | $35,000.00 |

## Usage

Upload these images via the API:

```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Authorization: Bearer dev-api-key" \
  -F "document=@test-data/claim-diabetes-routine.png" \
  -F "priority=normal"
```

## Regenerate

To regenerate the test images:

```bash
npx tsx test-data/generate-test-claims.ts
```
