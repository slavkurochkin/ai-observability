#!/bin/bash
# Script to build and link the package for local testing

set -e

echo "🔨 Building package..."
npm install
npm run build

echo "🔗 Linking package globally..."
npm link

echo "✅ Package built and linked!"
echo ""
echo "📦 Next steps:"
echo "   1. In your project directory, run: npm link @ai-observability/client"
echo "   2. Import and use: import { initObservability } from '@ai-observability/client'"
echo ""
echo "💡 Tip: Run 'npm run dev' in this directory for watch mode"
