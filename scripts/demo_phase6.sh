#!/usr/bin/env bash
set -e

# EduSec Phase 6 — College Presentation Live Demonstration Runner
# Executes the repeatable synthetic SIEM demonstration scenario.

echo "=========================================================="
echo " Starting EduSec Phase 6 Live SIEM Demonstration..."
echo "=========================================================="

# Check if backend is reachable on port 8080
if ! curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo "⚠ Warning: EduSec Java backend is not detected on http://localhost:8080"
    echo "  To launch backend in a separate terminal: (cd backend-java && mvn spring-boot:run)"
    echo "  Attempting to check if backend can be started or run script..."
fi

python3 "$(dirname "$0")/demo_phase6.py"
