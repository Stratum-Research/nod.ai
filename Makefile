.PHONY: release patch minor major push-tag help

# Get the latest tag (sorted by version)
LATEST_TAG := $(shell git tag --list 'v*' --sort=-v:refname | head -1)
CURRENT_TAG := $(if $(LATEST_TAG),$(LATEST_TAG),v0.0.0)

# Extract version numbers using shell (more reliable for arithmetic)
MAJOR := $(shell echo $(CURRENT_TAG) | sed 's/v\([0-9]*\)\..*/\1/')
MINOR := $(shell echo $(CURRENT_TAG) | sed 's/v[0-9]*\.\([0-9]*\)\..*/\1/')
PATCH := $(shell echo $(CURRENT_TAG) | sed 's/v[0-9]*\.[0-9]*\.\([0-9]*\).*/\1/')

# Increment versions using shell arithmetic
NEXT_PATCH := v$(MAJOR).$(MINOR).$(shell echo $$(($(PATCH) + 1)))
NEXT_MINOR := v$(MAJOR).$(shell echo $$(($(MINOR) + 1))).0
NEXT_MAJOR := v$(shell echo $$(($(MAJOR) + 1))).0.0

help:
	@echo "Release Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make patch   - Increment patch version (e.g., v1.0.0 -> v1.0.1)"
	@echo "  make minor   - Increment minor version (e.g., v1.0.0 -> v1.1.0)"
	@echo "  make major   - Increment major version (e.g., v1.0.0 -> v2.0.0)"
	@echo "  make release - Same as 'make patch'"
	@echo ""
	@echo "Current version: $(CURRENT_TAG)"
	@echo "Next patch: $(NEXT_PATCH)"
	@echo "Next minor: $(NEXT_MINOR)"
	@echo "Next major: $(NEXT_MAJOR)"

patch: NEXT_TAG=$(NEXT_PATCH)
minor: NEXT_TAG=$(NEXT_MINOR)
major: NEXT_TAG=$(NEXT_MAJOR)
release: patch

patch minor major release:
	@echo "Current version: $(CURRENT_TAG)"
	@echo "Creating new tag: $(NEXT_TAG)"
	@echo ""
	@echo "Staging all changes..."
	@git add -A || true
	@echo "Creating commit (if there are changes)..."
	@git commit -m "chore: bump version to $(NEXT_TAG)" || echo "No changes to commit"
	@echo "Pushing commits to origin..."
	@git push origin $(shell git branch --show-current) || true
	@echo "Creating tag $(NEXT_TAG)..."
	@git tag $(NEXT_TAG) || (echo "Error: Tag $(NEXT_TAG) already exists locally" && exit 1)
	@echo "Pushing tag $(NEXT_TAG) to origin..."
	@git push origin $(NEXT_TAG) || (echo "Error: Tag $(NEXT_TAG) already exists remotely" && exit 1)
	@echo ""
	@echo "✓ Release $(NEXT_TAG) created and pushed!"
	@echo "✓ GitHub Actions build triggered"

# Utility: Push current tag if it exists locally but not remotely
push-tag:
	@if [ -z "$(LATEST_TAG)" ]; then \
		echo "Error: No version tag found. Create one first with 'make patch' or similar."; \
		exit 1; \
	fi
	@echo "Pushing tag $(LATEST_TAG)..."
	@git push origin $(LATEST_TAG) || echo "Tag might already exist remotely"
