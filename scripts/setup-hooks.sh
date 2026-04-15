#!/bin/bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
STAGED=$(git diff --name-only --cached)
bunx biome check --write --staged
echo "$STAGED" | xargs -r git add
EOF
chmod +x .git/hooks/pre-commit
echo "pre-commit hook installed"
