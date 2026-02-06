#!/bin/bash
# =============================================================================
# ORCHESTRATE.SH - Dual-Agent (Claude + Gemini) Workflow Orchestrator
# =============================================================================
# Usage: ./orchestrate.sh "Task description here"
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Config
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VISION_FILE="$PROJECT_ROOT/.architect_vision.md"
BRIDGE_FILE="$PROJECT_ROOT/AI_BRIDGE.json"
STANDARDS_FILE="$PROJECT_ROOT/docs/CONSTRUCTION_STANDARDS.md"

# Task ID generation
TASK_ID="task_$(date +%Y%m%d_%H%M%S)"

# =============================================================================
# Helper Functions
# =============================================================================

log_phase() {
    echo -e "\n${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  PHASE $1: $2${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}\n"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

update_bridge() {
    local key=$1
    local value=$2
    local bridge_path="$BRIDGE_FILE"
    # Update AI_BRIDGE.json using node for proper JSON handling
    node -e "
        const fs = require('fs');
        const bridge = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        bridge['$key'] = $value;
        bridge.last_updated = new Date().toISOString();
        fs.writeFileSync(process.argv[1], JSON.stringify(bridge, null, 2));
    " "$bridge_path"
}

update_bridge_nested() {
    local key_path=$1
    local value=$2
    local bridge_path="$BRIDGE_FILE"
    node -e "
        const fs = require('fs');
        const bridge = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        const keys = process.argv[2].split('.');
        let obj = bridge;
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = $value;
        bridge.last_updated = new Date().toISOString();
        fs.writeFileSync(process.argv[1], JSON.stringify(bridge, null, 2));
    " "$bridge_path" "$key_path"
}

check_gemini() {
    if ! command -v gemini &> /dev/null; then
        log_error "Gemini CLI not found. Please install: npm install -g @anthropic/gemini-cli"
        log_info "Or configure your Gemini API access"
        return 1
    fi
    return 0
}

check_claude() {
    if ! command -v claude &> /dev/null; then
        log_error "Claude CLI not found."
        return 1
    fi
    return 0
}

# =============================================================================
# Phase 1: Architecture (Gemini)
# =============================================================================

phase_architect() {
    local task="$1"
    log_phase "1" "ARCHITECTURE (Gemini - Product Architect)"

    update_bridge "phase" '"architecting"'
    update_bridge_nested "architect.status" '"working"'

    log_info "Task: $task"
    log_info "Gemini is analyzing the repository and writing technical spec..."

    # Gemini prompt for architecture
    local prompt="You are the Product Architect for a Construction Management SaaS.

TASK: $task

INSTRUCTIONS:
1. Analyze the existing codebase structure
2. Review docs/CONSTRUCTION_STANDARDS.md for mandatory patterns
3. Write a complete technical specification to .architect_vision.md

YOUR SPEC MUST INCLUDE:
- Database Schema (PostgreSQL/Supabase migrations)
- API Routes (Express.js with full request/response contracts)
- Frontend UI Components (React + TypeScript + Tailwind + Radix)
- State Management (TanStack Query patterns)
- Security considerations
- Offline-first requirements

Standards to enforce:
- Audit logging for all mutations
- Offline-first data patterns
- BIM/CAD compatibility where relevant

Write the spec now to .architect_vision.md with task_id: $TASK_ID"

    # Execute Gemini (adjust command based on your Gemini CLI setup)
    if check_gemini; then
        gemini "$prompt" || {
            log_warn "Gemini CLI failed. Please write spec manually to .architect_vision.md"
            update_bridge "last_error" "\"Gemini architecting failed\""
        }
    else
        log_warn "Gemini not available. Please write spec manually to .architect_vision.md"
        log_info "Opening vision file for manual editing..."
        ${EDITOR:-code} "$VISION_FILE"
    fi

    update_bridge_nested "architect.status" '"completed"'
    update_bridge_nested "architect.last_action" "\"Wrote spec for: $task\""

    log_success "Architecture phase complete. Spec written to .architect_vision.md"
    echo -e "\n${CYAN}Please review the spec before proceeding to implementation.${NC}"
    read -p "Press Enter to continue to implementation phase..."
}

# =============================================================================
# Phase 2: Implementation (Claude + Gemini in parallel)
# =============================================================================

phase_implement() {
    log_phase "2" "IMPLEMENTATION (Claude: Backend, Gemini: Frontend)"

    update_bridge "phase" '"implementing"'

    # Read the spec
    if [ ! -f "$VISION_FILE" ]; then
        log_error "No spec found at $VISION_FILE. Run architecture phase first."
        exit 1
    fi

    local spec=$(cat "$VISION_FILE")

    # Claude: Backend Implementation
    log_info "Claude (Builder) implementing backend..."
    update_bridge_nested "builder.status" '"working"'

    local claude_prompt="You are the Lead Builder for a Construction Management SaaS.

SPEC FROM ARCHITECT:
$spec

YOUR RESPONSIBILITIES:
1. Implement database migrations (Supabase SQL)
2. Create/update Express.js API routes
3. Write server-side business logic
4. Implement audit logging per CONSTRUCTION_STANDARDS.md
5. Write integration tests

After implementation:
- Update AI_BRIDGE.json: set backend_ready = true
- List any blockers or questions for the Architect

Implement now based on the spec above."

    # Run Claude for backend (this runs in current terminal)
    echo -e "\n${YELLOW}═══ CLAUDE (BACKEND) ═══${NC}\n"

    # In practice, you'd invoke Claude CLI here
    # For now, we'll prompt the user
    log_info "Claude should now implement the backend based on the spec."
    log_info "When complete, update AI_BRIDGE.json: backend_ready = true"

    # Gemini: Frontend Implementation (parallel)
    log_info "Gemini (Architect) implementing frontend..."
    update_bridge_nested "architect.status" '"implementing_frontend"'

    local gemini_frontend_prompt="You are the Frontend Lead for a Construction Management SaaS.

SPEC:
$spec

YOUR RESPONSIBILITIES:
1. Create React components with TypeScript
2. Use Tailwind CSS + Radix UI primitives
3. Implement TanStack Query hooks for API calls
4. Handle offline-first patterns (optimistic updates)
5. Follow the component hierarchy from the spec

After implementation:
- Update AI_BRIDGE.json: set frontend_ready = true

Build the frontend now."

    if check_gemini; then
        # Run Gemini in background for frontend
        gemini "$gemini_frontend_prompt" &
        GEMINI_PID=$!
        log_info "Gemini frontend implementation running (PID: $GEMINI_PID)"
    fi

    # Wait for both to complete
    log_info "Waiting for implementations to complete..."
    log_info "Update AI_BRIDGE.json when each part is ready."

    # Poll for completion
    while true; do
        local backend_ready=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$BRIDGE_FILE')).backend_ready)")
        local frontend_ready=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$BRIDGE_FILE')).frontend_ready)")

        if [ "$backend_ready" = "true" ] && [ "$frontend_ready" = "true" ]; then
            log_success "Both backend and frontend implementations complete!"
            break
        fi

        echo -n "."
        sleep 5
    done

    update_bridge_nested "builder.status" '"completed"'
    update_bridge_nested "architect.status" '"completed"'
}

# =============================================================================
# Phase 3: Validation
# =============================================================================

phase_validate() {
    log_phase "3" "VALIDATION (Testing & Review)"

    update_bridge "phase" '"validating"'

    log_info "Running test suite..."

    cd "$PROJECT_ROOT"

    # Run tests
    if npm test; then
        log_success "All tests passed!"
        update_bridge "tests_passing" 'true'

        # Gemini review
        log_info "Gemini reviewing implementation against spec..."

        local review_prompt="Review the git diff against .architect_vision.md.

If the implementation meets all requirements and follows CONSTRUCTION_STANDARDS.md:
- Append [APPROVED] to the spec
- Update AI_BRIDGE.json: api_contract_verified = true

If there are issues:
- List specific corrections needed
- Update AI_BRIDGE.json: last_error = 'description of issues'"

        if check_gemini; then
            gemini "$review_prompt"
        else
            log_warn "Manual review required. Check implementation against spec."
        fi
    else
        log_error "Tests failed!"
        update_bridge "tests_passing" 'false'
        update_bridge "last_error" '"Test suite failed"'

        log_info "Please fix failing tests before proceeding."
        exit 1
    fi
}

# =============================================================================
# Phase 4: Completion
# =============================================================================

phase_complete() {
    log_phase "4" "COMPLETION"

    local api_verified=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$BRIDGE_FILE')).api_contract_verified)")

    if [ "$api_verified" = "true" ]; then
        log_success "Task completed and verified!"

        # Archive the task
        update_bridge "phase" '"completed"'

        # Add to completed tasks
        node -e "
            const fs = require('fs');
            const bridge = JSON.parse(fs.readFileSync('$BRIDGE_FILE', 'utf8'));
            bridge.completed_tasks.push({
                task_id: '$TASK_ID',
                description: bridge.task_description,
                completed_at: new Date().toISOString()
            });
            bridge.task_id = '';
            bridge.task_description = '';
            bridge.backend_ready = false;
            bridge.frontend_ready = false;
            bridge.api_contract_verified = false;
            bridge.tests_passing = false;
            fs.writeFileSync('$BRIDGE_FILE', JSON.stringify(bridge, null, 2));
        "

        echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  TASK $TASK_ID COMPLETED SUCCESSFULLY${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}\n"
    else
        log_error "Task not verified. Please address review feedback."
        exit 1
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    if [ -z "$1" ]; then
        echo "Usage: ./orchestrate.sh \"Task description\""
        echo ""
        echo "Example:"
        echo "  ./orchestrate.sh \"Add punch list feature with photo annotations\""
        exit 1
    fi

    local task="$1"

    echo -e "\n${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     CONSTRUCTION MANAGEMENT SAAS - DUAL AGENT ORCHESTRATOR    ║${NC}"
    echo -e "${CYAN}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║  Gemini: Product Architect & Frontend Lead                    ║${NC}"
    echo -e "${CYAN}║  Claude: Lead Builder & System Integrator                     ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

    # Initialize task
    update_bridge "task_id" "\"$TASK_ID\""
    update_bridge "task_description" "\"$task\""
    update_bridge "phase" '"starting"'

    log_info "Task ID: $TASK_ID"
    log_info "Description: $task"

    # Run phases
    phase_architect "$task"
    phase_implement
    phase_validate
    phase_complete
}

# Run main with all arguments
main "$@"
