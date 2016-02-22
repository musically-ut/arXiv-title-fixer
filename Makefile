.PHONY: all

VERSION=$(shell git describe --dirty)
ARCHIVE_NAME=arXiv-title-fixer-${VERSION}.zip

all:
	 @echo "Exporting ${ARCHIVE_NAME}"
	 @git archive HEAD -o ${ARCHIVE_NAME}
