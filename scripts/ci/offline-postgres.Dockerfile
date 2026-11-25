# CI-only runtime. Dependencies are installed before entering network=none.
# Two upstream images must share the same Debian bookworm ABI.
FROM node:22-bookworm AS node-runtime
FROM postgres:16-bookworm
COPY --from=node-runtime /usr/local/ /usr/local/
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version && initdb --version && command -v gosu
WORKDIR /workspace
ENTRYPOINT []
CMD ["/bin/bash"]
