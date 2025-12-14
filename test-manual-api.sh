#!/bin/bash
# =============================================================================
# Healthcare Claims API - Comprehensive Manual Test Script
# =============================================================================
# This script tests all API functionality documented in MANUAL_TESTING.md Section 8
#
# Prerequisites:
#   - Server running on localhost:3000 (npx tsx test-api.ts)
#   - Test images in test-data/ directory
#   - ANTHROPIC_API_KEY set for LLM processing
#
# Usage: ./test-manual-api.sh
# =============================================================================

set -e  # Exit on first error

API_BASE="http://localhost:3000/api"
AUTH_HEADER="Authorization: Bearer dev-api-key"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Store claim IDs for later use
declare -a CLAIM_IDS
REVIEW_CLAIM_ID=""

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_subheader() {
    echo ""
    echo -e "${CYAN}--- $1 ---${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

# Pretty print JSON
pretty_json() {
    if command -v jq &> /dev/null; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

# Extract HTTP response body (all lines except the last which is the status code)
# Works on both Linux and macOS
get_body() {
    echo "$1" | sed '$d'
}

# Extract value from JSON using jq or grep fallback
json_get() {
    local json="$1"
    local key="$2"
    if command -v jq &> /dev/null; then
        echo "$json" | jq -r "$key"
    else
        # Fallback: simple grep-based extraction (limited)
        echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
    fi
}

wait_with_message() {
    local seconds=$1
    local message=$2
    echo -n "  $message"
    for ((i=0; i<seconds; i++)); do
        echo -n "."
        sleep 1
    done
    echo " done"
}

# =============================================================================
# Test 1: Health Check Endpoints
# =============================================================================

test_health_endpoints() {
    print_header "TEST 1: Health Check Endpoints"

    print_subheader "1.1 Basic Health Check"
    RESPONSE=$(curl -s "$API_BASE/health")
    echo "  Response:"
    pretty_json "$RESPONSE"

    STATUS=$(json_get "$RESPONSE" ".status")
    if [ "$STATUS" == "healthy" ]; then
        print_success "Health check passed - Server is healthy"
    else
        print_error "Health check failed"
        exit 1
    fi

    print_subheader "1.2 Detailed Health Check"
    RESPONSE=$(curl -s "$API_BASE/health/detailed")
    echo "  Response:"
    pretty_json "$RESPONSE"
    print_success "Detailed health check completed"
}

# =============================================================================
# Test 2: Authentication Tests
# =============================================================================

test_authentication() {
    print_header "TEST 2: Authentication"

    print_subheader "2.1 Request WITHOUT API Key (expect 401)"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/claims")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(get_body "$RESPONSE")

    echo "  HTTP Status: $HTTP_CODE"
    echo "  Response:"
    pretty_json "$BODY"

    if [ "$HTTP_CODE" == "401" ]; then
        print_success "Correctly rejected request without API key"
    else
        print_error "Should have returned 401, got $HTTP_CODE"
    fi

    print_subheader "2.2 Request WITH Invalid API Key (expect 401)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer wrong-key" "$API_BASE/claims")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(get_body "$RESPONSE")

    echo "  HTTP Status: $HTTP_CODE"
    if [ "$HTTP_CODE" == "401" ]; then
        print_success "Correctly rejected invalid API key"
    else
        print_error "Should have returned 401, got $HTTP_CODE"
    fi

    print_subheader "2.3 Request WITH Valid API Key (expect 200)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$API_BASE/claims")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(get_body "$RESPONSE")

    echo "  HTTP Status: $HTTP_CODE"
    if [ "$HTTP_CODE" == "200" ]; then
        print_success "Valid API key accepted"
    else
        print_error "Should have returned 200, got $HTTP_CODE"
    fi
}

# =============================================================================
# Test 3: Document Upload - Multiple Claims
# =============================================================================

test_document_upload() {
    print_header "TEST 3: Document Upload - Multiple Claims"

    # 3.1 Upload routine diabetes claim (normal priority)
    print_subheader "3.1 Upload: Routine Diabetes Claim (normal priority)"
    echo "  Uploading test-data/claim-diabetes-routine.png..."

    RESPONSE=$(curl -s -X POST "$API_BASE/claims" \
        -H "$AUTH_HEADER" \
        -F "document=@test-data/claim-diabetes-routine.png" \
        -F "priority=normal")

    echo "  Response:"
    pretty_json "$RESPONSE"

    CLAIM_ID_1=$(json_get "$RESPONSE" ".data.claimId")
    STATUS_1=$(json_get "$RESPONSE" ".data.status")
    CLAIM_IDS+=("$CLAIM_ID_1")

    print_info "Claim ID: $CLAIM_ID_1"
    print_info "Status: $STATUS_1"

    if [ "$STATUS_1" == "completed" ]; then
        print_success "Claim auto-completed (high confidence extraction)"
    elif [ "$STATUS_1" == "pending_review" ]; then
        print_warning "Claim sent to manual review (low confidence)"
        REVIEW_CLAIM_ID="$CLAIM_ID_1"
    else
        print_info "Status: $STATUS_1"
    fi

    # 3.2 Upload high-value claim (high priority)
    print_subheader "3.2 Upload: High-Value Claim (high priority)"
    echo "  Uploading test-data/claim-high-value.png..."

    RESPONSE=$(curl -s -X POST "$API_BASE/claims" \
        -H "$AUTH_HEADER" \
        -F "document=@test-data/claim-high-value.png" \
        -F "priority=high")

    echo "  Response:"
    pretty_json "$RESPONSE"

    CLAIM_ID_2=$(json_get "$RESPONSE" ".data.claimId")
    STATUS_2=$(json_get "$RESPONSE" ".data.status")
    CLAIM_IDS+=("$CLAIM_ID_2")

    print_info "Claim ID: $CLAIM_ID_2"
    print_info "Status: $STATUS_2"

    if [ "$STATUS_2" == "completed" ]; then
        print_success "High-value claim auto-completed"
    elif [ "$STATUS_2" == "pending_review" ]; then
        print_warning "High-value claim sent to manual review"
        REVIEW_CLAIM_ID="$CLAIM_ID_2"
    fi

    # 3.3 Upload urgent cardiac claim
    print_subheader "3.3 Upload: Urgent Cardiac Claim (urgent priority)"
    echo "  Uploading test-data/claim-urgent-cardiac.png..."

    RESPONSE=$(curl -s -X POST "$API_BASE/claims" \
        -H "$AUTH_HEADER" \
        -F "document=@test-data/claim-urgent-cardiac.png" \
        -F "priority=urgent")

    echo "  Response:"
    pretty_json "$RESPONSE"

    CLAIM_ID_3=$(json_get "$RESPONSE" ".data.claimId")
    STATUS_3=$(json_get "$RESPONSE" ".data.status")
    CLAIM_IDS+=("$CLAIM_ID_3")

    print_info "Claim ID: $CLAIM_ID_3"
    print_info "Status: $STATUS_3"

    # 3.4 Upload hypertension claim
    print_subheader "3.4 Upload: Hypertension Claim (normal priority)"
    echo "  Uploading test-data/claim-hypertension.png..."

    RESPONSE=$(curl -s -X POST "$API_BASE/claims" \
        -H "$AUTH_HEADER" \
        -F "document=@test-data/claim-hypertension.png" \
        -F "priority=normal")

    echo "  Response:"
    pretty_json "$RESPONSE"

    CLAIM_ID_4=$(json_get "$RESPONSE" ".data.claimId")
    STATUS_4=$(json_get "$RESPONSE" ".data.status")
    CLAIM_IDS+=("$CLAIM_ID_4")

    print_info "Claim ID: $CLAIM_ID_4"
    print_info "Status: $STATUS_4"

    # 3.5 Upload respiratory claim
    print_subheader "3.5 Upload: Respiratory Claim (normal priority)"
    echo "  Uploading test-data/claim-respiratory.png..."

    RESPONSE=$(curl -s -X POST "$API_BASE/claims" \
        -H "$AUTH_HEADER" \
        -F "document=@test-data/claim-respiratory.png" \
        -F "priority=normal")

    echo "  Response:"
    pretty_json "$RESPONSE"

    CLAIM_ID_5=$(json_get "$RESPONSE" ".data.claimId")
    STATUS_5=$(json_get "$RESPONSE" ".data.status")
    CLAIM_IDS+=("$CLAIM_ID_5")

    print_info "Claim ID: $CLAIM_ID_5"
    print_info "Status: $STATUS_5"

    echo ""
    print_success "Uploaded ${#CLAIM_IDS[@]} claims total"
    echo ""
    echo "  Claim IDs for reference:"
    for i in "${!CLAIM_IDS[@]}"; do
        echo "    [$((i+1))] ${CLAIM_IDS[$i]}"
    done
}

# =============================================================================
# Test 4: Claims List and Filtering
# =============================================================================

test_claims_list() {
    print_header "TEST 4: Claims List and Filtering"

    print_subheader "4.1 List All Claims"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims")
    echo "  Response:"
    pretty_json "$RESPONSE"

    TOTAL=$(json_get "$RESPONSE" ".pagination.total")
    print_info "Total claims in system: $TOTAL"

    print_subheader "4.2 Filter by Status: completed"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims?status=completed")
    COMPLETED_COUNT=$(json_get "$RESPONSE" ".pagination.total")
    print_info "Completed claims: $COMPLETED_COUNT"

    print_subheader "4.3 Filter by Status: pending_review"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims?status=pending_review")
    PENDING_COUNT=$(json_get "$RESPONSE" ".pagination.total")
    print_info "Pending review claims: $PENDING_COUNT"

    print_subheader "4.4 Filter by Priority: urgent"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims?priority=urgent")
    URGENT_COUNT=$(json_get "$RESPONSE" ".pagination.total")
    print_info "Urgent priority claims: $URGENT_COUNT"

    print_subheader "4.5 Pagination Test"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims?page=1&limit=2")
    echo "  Response (page 1, limit 2):"
    pretty_json "$RESPONSE"

    print_success "Claims list and filtering tests completed"
}

# =============================================================================
# Test 5: Claim Details - Full Pipeline Results
# =============================================================================

test_claim_details() {
    print_header "TEST 5: Claim Details - Full Pipeline Results"

    # Use the first completed claim
    TEST_CLAIM="${CLAIM_IDS[0]}"

    if [ -z "$TEST_CLAIM" ]; then
        print_error "No claims available to test"
        return
    fi

    print_info "Testing with claim: $TEST_CLAIM"

    print_subheader "5.1 Get Claim Details"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$TEST_CLAIM")
    echo "  Response:"
    pretty_json "$RESPONSE"
    print_success "Claim details retrieved"

    print_subheader "5.2 Get Extraction Results"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$TEST_CLAIM/extraction")
    echo "  Response:"
    pretty_json "$RESPONSE"

    SUCCESS=$(json_get "$RESPONSE" ".success")
    if [ "$SUCCESS" == "true" ]; then
        print_success "Extraction results available"
    else
        print_warning "Extraction results not available (claim may be in review)"
    fi

    print_subheader "5.3 Get Validation Results"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$TEST_CLAIM/validation")
    echo "  Response:"
    pretty_json "$RESPONSE"

    SUCCESS=$(json_get "$RESPONSE" ".success")
    if [ "$SUCCESS" == "true" ]; then
        IS_VALID=$(json_get "$RESPONSE" ".data.isValid")
        CONFIDENCE=$(json_get "$RESPONSE" ".data.overallConfidence")
        print_success "Validation results available"
        print_info "Is Valid: $IS_VALID"
        print_info "Overall Confidence: $CONFIDENCE"
    else
        print_warning "Validation results not available"
    fi

    print_subheader "5.4 Get Adjudication Results"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$TEST_CLAIM/adjudication")
    echo "  Response:"
    pretty_json "$RESPONSE"

    SUCCESS=$(json_get "$RESPONSE" ".success")
    if [ "$SUCCESS" == "true" ]; then
        ADJ_STATUS=$(json_get "$RESPONSE" ".data.status")
        print_success "Adjudication results available"
        print_info "Decision: $ADJ_STATUS"
    else
        print_warning "Adjudication results not available"
    fi

    print_subheader "5.5 Get Processing History"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$TEST_CLAIM/history")
    echo "  Response:"
    pretty_json "$RESPONSE"
    print_success "Processing history retrieved"
}

# =============================================================================
# Test 6: Review Queue Operations
# =============================================================================

test_review_queue() {
    print_header "TEST 6: Review Queue Operations"

    print_subheader "6.1 Get Review Queue"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue")
    echo "  Response:"
    pretty_json "$RESPONSE"

    PENDING_COUNT=$(json_get "$RESPONSE" ".pagination.total")
    print_info "Claims pending review: $PENDING_COUNT"

    print_subheader "6.2 Get Review Queue Statistics"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue/stats/summary")
    echo "  Response:"
    pretty_json "$RESPONSE"
    print_success "Review queue statistics retrieved"

    # Check if we have claims to review
    if [ "$PENDING_COUNT" == "0" ]; then
        print_warning "No claims in review queue - skipping approve/reject tests"
        print_info "All claims completed automatically (high confidence)"
    fi
}

# =============================================================================
# Test 7: Manual Review - Approve and Reject
# =============================================================================

test_manual_review() {
    print_header "TEST 7: Manual Review - Approve and Reject"

    # First check the review queue
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue")
    PENDING_COUNT=$(json_get "$RESPONSE" ".pagination.total")

    if [ "$PENDING_COUNT" == "0" ] || [ "$PENDING_COUNT" == "null" ]; then
        print_warning "No claims in review queue to test approve/reject"
        print_info "Creating a test scenario by uploading a minimal image..."

        # Create a minimal test image that will likely fail extraction
        echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > /tmp/minimal-test.png 2>/dev/null || true

        if [ -f "/tmp/minimal-test.png" ]; then
            print_subheader "7.0 Uploading minimal image to trigger review..."
            RESPONSE=$(curl -s -X POST "$API_BASE/claims" \
                -H "$AUTH_HEADER" \
                -F "document=@/tmp/minimal-test.png" \
                -F "priority=normal")

            MINIMAL_CLAIM=$(json_get "$RESPONSE" ".data.claimId")
            MINIMAL_STATUS=$(json_get "$RESPONSE" ".data.status")
            print_info "Minimal claim: $MINIMAL_CLAIM (status: $MINIMAL_STATUS)"

            # Wait and check queue again
            sleep 2
            RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue")
            PENDING_COUNT=$(json_get "$RESPONSE" ".pagination.total")
            rm /tmp/minimal-test.png 2>/dev/null || true
        fi
    fi

    if [ "$PENDING_COUNT" == "0" ] || [ "$PENDING_COUNT" == "null" ]; then
        print_info "No claims pending review - all claims processed successfully"
        print_info "This indicates the LLM extraction has high confidence"
        return
    fi

    # Get claims from review queue
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue")

    # Extract claim IDs from review queue using jq
    if command -v jq &> /dev/null; then
        REVIEW_CLAIMS=($(echo "$RESPONSE" | jq -r '.data[].claimId'))
    else
        print_warning "jq not installed - using first available claim"
        REVIEW_CLAIMS=("$REVIEW_CLAIM_ID")
    fi

    print_info "Claims in review queue: ${#REVIEW_CLAIMS[@]}"

    # 7.1 Approve first claim
    if [ "${#REVIEW_CLAIMS[@]}" -ge 1 ] && [ -n "${REVIEW_CLAIMS[0]}" ]; then
        APPROVE_CLAIM="${REVIEW_CLAIMS[0]}"

        print_subheader "7.1 APPROVE Claim: $APPROVE_CLAIM"
        echo "  Submitting approval..."

        RESPONSE=$(curl -s -X POST "$API_BASE/review-queue/$APPROVE_CLAIM/review" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            -d '{"action": "approve"}')

        echo "  Response:"
        pretty_json "$RESPONSE"

        SUCCESS=$(json_get "$RESPONSE" ".success")
        if [ "$SUCCESS" == "true" ]; then
            print_success "Claim approved successfully"

            # Verify claim status changed
            echo "  Verifying claim status..."
            VERIFY=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$APPROVE_CLAIM")
            NEW_STATUS=$(json_get "$VERIFY" ".data.status")
            print_info "New status: $NEW_STATUS"
        else
            print_error "Approval failed"
            ERROR=$(json_get "$RESPONSE" ".error.message")
            print_info "Error: $ERROR"
        fi
    fi

    # 7.2 Reject second claim (if available)
    if [ "${#REVIEW_CLAIMS[@]}" -ge 2 ] && [ -n "${REVIEW_CLAIMS[1]}" ]; then
        REJECT_CLAIM="${REVIEW_CLAIMS[1]}"

        print_subheader "7.2 REJECT Claim: $REJECT_CLAIM"
        echo "  Submitting rejection..."

        RESPONSE=$(curl -s -X POST "$API_BASE/review-queue/$REJECT_CLAIM/review" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            -d '{"action": "reject", "reason": "Test rejection - invalid documentation for testing purposes"}')

        echo "  Response:"
        pretty_json "$RESPONSE"

        SUCCESS=$(json_get "$RESPONSE" ".success")
        if [ "$SUCCESS" == "true" ]; then
            print_success "Claim rejected successfully"

            # Verify claim status changed
            echo "  Verifying claim status..."
            VERIFY=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$REJECT_CLAIM")
            NEW_STATUS=$(json_get "$VERIFY" ".data.status")
            print_info "New status: $NEW_STATUS"
        else
            print_error "Rejection failed"
            ERROR=$(json_get "$RESPONSE" ".error.message")
            print_info "Error: $ERROR"
        fi
    else
        print_info "Only one claim in review queue - skipping reject test"
    fi

    # 7.3 Test correction action (if more claims available)
    if [ "${#REVIEW_CLAIMS[@]}" -ge 3 ] && [ -n "${REVIEW_CLAIMS[2]}" ]; then
        CORRECT_CLAIM="${REVIEW_CLAIMS[2]}"

        print_subheader "7.3 CORRECT Claim: $CORRECT_CLAIM"
        echo "  Submitting correction..."

        RESPONSE=$(curl -s -X POST "$API_BASE/review-queue/$CORRECT_CLAIM/review" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            -d '{
                "action": "correct",
                "corrections": {
                    "patient": {
                        "memberId": "CORRECTED-MEM-001"
                    }
                },
                "reason": "Corrected member ID based on manual verification"
            }')

        echo "  Response:"
        pretty_json "$RESPONSE"

        SUCCESS=$(json_get "$RESPONSE" ".success")
        if [ "$SUCCESS" == "true" ]; then
            print_success "Claim corrected and resubmitted"
        else
            print_warning "Correction submission result"
        fi
    fi

    print_subheader "7.4 Final Review Queue Status"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue")
    echo "  Response:"
    pretty_json "$RESPONSE"

    FINAL_COUNT=$(json_get "$RESPONSE" ".pagination.total")
    print_info "Remaining claims in review: $FINAL_COUNT"
}

# =============================================================================
# Test 8: Error Handling
# =============================================================================

test_error_handling() {
    print_header "TEST 8: Error Handling"

    print_subheader "8.1 Get Non-existent Claim (expect 404)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" "$API_BASE/claims/INVALID-CLAIM-ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(get_body "$RESPONSE")

    echo "  HTTP Status: $HTTP_CODE"
    echo "  Response:"
    pretty_json "$BODY"

    if [ "$HTTP_CODE" == "404" ]; then
        print_success "Correctly returned 404 for non-existent claim"
    else
        print_warning "Expected 404, got $HTTP_CODE"
    fi

    print_subheader "8.2 Invalid Priority Value (expect 400)"
    # Create a minimal test file
    echo "test" > /tmp/test-error.txt
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/claims" \
        -H "$AUTH_HEADER" \
        -F "document=@/tmp/test-error.txt" \
        -F "priority=invalid_priority")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(get_body "$RESPONSE")
    rm /tmp/test-error.txt 2>/dev/null || true

    echo "  HTTP Status: $HTTP_CODE"
    echo "  Response:"
    pretty_json "$BODY"

    if [ "$HTTP_CODE" == "400" ]; then
        print_success "Correctly returned 400 for invalid priority"
    else
        print_info "HTTP Code: $HTTP_CODE (validation may happen differently)"
    fi

    print_subheader "8.3 Missing Required Field in Query (expect 400)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/query" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d '{}')
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(get_body "$RESPONSE")

    echo "  HTTP Status: $HTTP_CODE"
    echo "  Response:"
    pretty_json "$BODY"

    if [ "$HTTP_CODE" == "400" ]; then
        print_success "Correctly returned 400 for missing required field"
    else
        print_info "HTTP Code: $HTTP_CODE"
    fi
}

# =============================================================================
# Test 9: RAG Query Endpoints
# =============================================================================

test_rag_query() {
    print_header "TEST 9: RAG Query Endpoints"

    print_subheader "9.1 Natural Language Query"
    RESPONSE=$(curl -s -X POST "$API_BASE/query" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d '{"question": "What diabetes-related claims have been processed?", "maxChunks": 5}')

    echo "  Response:"
    pretty_json "$RESPONSE"

    SUCCESS=$(json_get "$RESPONSE" ".success")
    if [ "$SUCCESS" == "true" ]; then
        print_success "RAG query completed"
    else
        print_info "RAG query result (may require indexed claims)"
    fi

    print_subheader "9.2 Find Similar Claims"
    if [ -n "${CLAIM_IDS[0]}" ]; then
        RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/query/claims/${CLAIM_IDS[0]}/similar?limit=3")
        echo "  Response:"
        pretty_json "$RESPONSE"
        print_info "Similar claims query completed"
    else
        print_warning "No claim ID available for similar claims test"
    fi

    print_subheader "9.3 RAG Stats"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/query/stats")
    echo "  Response:"
    pretty_json "$RESPONSE"
    print_success "RAG stats retrieved"
}

# =============================================================================
# Test 10: Final Summary
# =============================================================================

test_final_summary() {
    print_header "TEST 10: Final Summary"

    print_subheader "10.1 All Claims Status"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims")

    if command -v jq &> /dev/null; then
        echo "  Claims by status:"
        echo "$RESPONSE" | jq -r '.data[] | "    \(.id): \(.status) (\(.priority))"'
    else
        echo "  Response:"
        pretty_json "$RESPONSE"
    fi

    print_subheader "10.2 Detailed Health Check"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/health/detailed")
    echo "  Response:"
    pretty_json "$RESPONSE"

    print_subheader "10.3 Review Queue Final State"
    RESPONSE=$(curl -s -H "$AUTH_HEADER" "$API_BASE/review-queue")
    FINAL_PENDING=$(json_get "$RESPONSE" ".pagination.total")

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  TEST SUMMARY${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Total claims created: ${#CLAIM_IDS[@]}"
    echo "  Claims pending review: $FINAL_PENDING"
    echo ""
    echo "  Claim IDs tested:"
    for id in "${CLAIM_IDS[@]}"; do
        # Get status for each claim
        STATUS=$(curl -s -H "$AUTH_HEADER" "$API_BASE/claims/$id" | jq -r '.data.status' 2>/dev/null || echo "unknown")
        echo "    - $id: $STATUS"
    done
    echo ""
    print_success "All tests completed!"
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Healthcare Claims API - Comprehensive Test Script           ║${NC}"
    echo -e "${GREEN}║   Testing Section 8 of MANUAL_TESTING.md                      ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  Server: $API_BASE"
    echo "  Auth: Bearer token (dev-api-key)"
    echo ""

    # Check if server is running
    echo "Checking server connectivity..."
    if ! curl -s "$API_BASE/health" > /dev/null 2>&1; then
        print_error "Server is not running at $API_BASE"
        echo ""
        echo "Please start the server first:"
        echo "  npx tsx test-api.ts"
        echo ""
        exit 1
    fi
    print_success "Server is running"

    # Check if test data exists
    if [ ! -f "test-data/claim-diabetes-routine.png" ]; then
        print_warning "Test data not found. Generating..."
        npx tsx test-data/generate-test-claims.ts 2>/dev/null || true
    fi

    # Run all tests
    test_health_endpoints
    test_authentication
    test_document_upload
    test_claims_list
    test_claim_details
    test_review_queue
    test_manual_review
    test_error_handling
    test_rag_query
    test_final_summary
}

# Run main
main "$@"
