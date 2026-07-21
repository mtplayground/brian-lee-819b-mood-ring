.PHONY: build self-host-build self-host-start test

build: self-host-build

self-host-build:
	npm --prefix frontend ci
	npm --prefix frontend run build
	cd backend && cargo build --release

self-host-start:
	./backend/target/release/mood-ring-backend

test:
	npm --prefix frontend run build
	cd backend && cargo test
