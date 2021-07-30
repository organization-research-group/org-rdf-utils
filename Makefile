SRC_FILES := $(shell find src)

TS_FILES := $(shell find src -name '*.ts')

MJS_EXPORT_DIR := dist/esm
CJS_EXPORT_DIR := dist/cjs

MJS_EXPORTED_FILES := $(subst src,$(MJS_EXPORT_DIR),$(subst .ts,.js,$(TS_FILES)))
CJS_EXPORTED_FILES := $(subst src,$(CJS_EXPORT_DIR),$(subst .ts,.cjs,$(TS_FILES)))

ESBUILD_BIN := node_modules/.bin/esbuild
DTS_BIN := node_modules/.bin/dts-bundle-generator

.PHONY: all
all: dist/index.d.ts $(MJS_EXPORTED_FILES) $(CJS_EXPORTED_FILES)

.PHONY: clean
clean:
	rm -rf node_modules dist

.PHONY: check
check:
	tsc --noEmit -p .

dist/index.d.ts: $(TS_FILES) | node_modules
	$(DTS_BIN) -o $@ src/index.ts

node_modules: package.json
	npm ci

$(MJS_EXPORT_DIR)/%.js: src/%.ts | node_modules
	$(ESBUILD_BIN) --platform=neutral --format=esm $^ --outdir=$(MJS_EXPORT_DIR)

$(CJS_EXPORT_DIR)/%.cjs: src/%.ts | node_modules
	$(ESBUILD_BIN) --platform=node --format=cjs --out-extension:.js=.cjs $^ --outdir=$(CJS_EXPORT_DIR)
