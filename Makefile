.PHONY: all chrome firefox readybuild

VERSION=$(shell git describe --dirty)
ARCHIVE_NAME=arXiv-title-fixer-${VERSION}.zip
TMP_DIR=tmp

readybuild:
	@echo "Preparing $(TMP_DIR) for building ..."
	@rm -rf $(TMP_DIR)/
	@mkdir -p $(TMP_DIR)/
	@mkdir -p build/
	@rsync -av webext $(TMP_DIR)/ --exclude="*.orig" --exclude="*~" --exclude="*.sw?"
	@cp LICENSE README.md $(TMP_DIR)/

chrome: readybuild
	@echo "Exporting build/${ARCHIVE_NAME}.chrome.zip"
	@cat manifest.template.json | jq 'del(.applications)' > $(TMP_DIR)/manifest.json
	@cd $(TMP_DIR); zip -r ../build/${ARCHIVE_NAME}.chrome.zip .

firefox: readybuild
	@echo "Exporting Firefox build"
	@cat manifest.template.json | jq 'del(.permissions[] | select(. == "declarativeContent"))' > $(TMP_DIR)/manifest.json
	@web-ext lint --source-dir=$(TMP_DIR)/ --ignore-files "webext/options_ui/js/semantic.js" "webext/options_ui/js/jquery*.min.js"
	@web-ext build --source-dir=$(TMP_DIR)/ --overwrite-dest --artifacts-dir=build/

all: firefox chrome
	@echo "Exporting ${ARCHIVE_NAME}"
	@git archive HEAD -o ${ARCHIVE_NAME}
