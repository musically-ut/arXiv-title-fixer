.PHONY: all chrome firefox readybuild

VERSION=$(shell git describe --dirty)
ARCHIVE_NAME=arXiv-title-fixer-${VERSION}.zip

readybuild:
	@echo "Preparing .tmp for building ..."
	@rm -rf .tmp/
	@mkdir -p .tmp/
	@mkdir -p build/
	@rsync -av webext .tmp/ --exclude="*.orig" --exclude="*~" --exclude="*.sw?"
	@cp LICENSE README.md .tmp/

chrome: readybuild
	@echo "Exporting build/${ARCHIVE_NAME}.chrome.zip"
	@cat manifest.template.json | jq 'del(.applications)' > .tmp/manifest.json
	@cd .tmp; zip -r ../build/${ARCHIVE_NAME}.chrome.zip .

firefox: readybuild
	@echo "Exporting Firefox build"
	@cat manifest.template.json | jq 'del(.permissions[] | select(. == "declarativeContent"))' > .tmp/manifest.json
	@web-ext lint --source-dir=.tmp/ --ignore-files "webext/options_ui/js/semantic.js" "webext/options_ui/js/jquery*.min.js"  
	@web-ext build --source-dir=.tmp/ --overwrite-dest --artifacts-dir=build/

all: firefox chrome
	@echo "Exporting ${ARCHIVE_NAME}"
	@git archive HEAD -o ${ARCHIVE_NAME}
