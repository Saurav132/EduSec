#!/usr/bin/env bash
set -e

# EduSec Phase 7 — College Presentation Live Demonstration Runner
# Executes the repeatable synthetic SIEM demonstration scenario (9-step sequence).

echo "=========================================================="
echo " Starting EduSec Phase 7 Live SIEM Demonstration..."
echo "=========================================================="

# Check if backend is reachable on port 8080
if ! curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo "⚠ Warning: EduSec Java backend is not reachable on http://localhost:8080"
    echo "  Please start the backend: (cd backend-java && mvn spring-boot:run)"
    exit 1
fi

python3 "$(dirname "$0")/demo_phase7.py"
